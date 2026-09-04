import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import * as MapLibreGL from '@maplibre/maplibre-react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  subtitle?: string;
  type?: 'patient' | 'doctor' | 'clinic' | 'hospital';
}

export interface MapRoute {
  coordinates: [number, number][];
  distanceKm?: number;
  durationMin?: number;
}

export interface MapViewProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  markers?: MapMarker[];
  focusNonce?: number;
  fitNonce?: number;
  route?: MapRoute | null;
  draggableMarker?: boolean;
  onLocationSelected?: (lat: number, lng: number) => void;
  onMarkerPress?: (markerId: string) => void;
  interactive?: boolean;
  height?: any;
  borderRadius?: number;
}

// ─── Geoapify style URL ─────────────────────────────────────────────────────

const GEOAPIFY_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || '';
const MAP_STYLE = GEOAPIFY_KEY
  ? `https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=${GEOAPIFY_KEY}`
  : 'https://demotiles.maplibre.org/style.json';

// ─── Default center (Nepal) ─────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [85.2281, 25.9856]; // [lng, lat]
const DEFAULT_ZOOM = 13;

// ─── Marker Styles ──────────────────────────────────────────────────────────

const DoctorPin: React.FC = () => (
  <View style={markerStyles.doctorOuter}>
    <View style={markerStyles.doctorInner}>
      <View style={markerStyles.doctorCross}>
        <View style={markerStyles.crossH} />
        <View style={markerStyles.crossV} />
      </View>
    </View>
    <View style={markerStyles.doctorTail} />
  </View>
);

const PatientDot: React.FC = () => (
  <View style={markerStyles.patientOuter}>
    <View style={markerStyles.patientPulse} />
    <View style={markerStyles.patientDot} />
  </View>
);

// ─── Component ──────────────────────────────────────────────────────────────

export const MapView: React.FC<MapViewProps> = ({
  latitude,
  longitude,
  zoom = DEFAULT_ZOOM,
  markers = [],
  focusNonce = 0,
  fitNonce = 0,
  route,
  draggableMarker = false,
  onLocationSelected,
  onMarkerPress,
  interactive = true,
  height = '100%',
  borderRadius = 0,
}) => {
  const cameraRef = useRef<React.ElementRef<typeof MapLibreGL.Camera>>(null);
  const mapRef = useRef<React.ElementRef<typeof MapLibreGL.MapView>>(null);

  // Center coordinate [lng, lat] for MapLibre
  const center: [number, number] = useMemo(
    () =>
      latitude != null && longitude != null
        ? [longitude, latitude]
        : DEFAULT_CENTER,
    [latitude, longitude]
  );

  // ─── Focus camera on center when focusNonce changes ───────────────────
  useEffect(() => {
    if (focusNonce > 0 && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: center,
        zoomLevel: zoom,
        animationDuration: 300,
        animationMode: 'easeTo',
      });
    }
  }, [focusNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fit all markers when fitNonce changes ────────────────────────────
  useEffect(() => {
    if (fitNonce > 0 && markers.length > 0 && cameraRef.current) {
      const lats = markers.map(m => m.latitude);
      const lngs = markers.map(m => m.longitude);
      const sw: [number, number] = [Math.min(...lngs) - 0.01, Math.min(...lats) - 0.01];
      const ne: [number, number] = [Math.max(...lngs) + 0.01, Math.max(...lats) + 0.01];
      cameraRef.current.fitBounds(ne, sw, [60, 60, 60, 60], 600);
    }
  }, [fitNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Route GeoJSON ────────────────────────────────────────────────────
  const routeGeoJSON = useMemo(() => {
    if (!route || !route.coordinates || route.coordinates.length < 2) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            // route.coordinates is [lat, lng] pairs — MapLibre needs [lng, lat]
            coordinates: route.coordinates.map(([lat, lng]) => [lng, lat]),
          },
        },
      ],
    };
  }, [route]);

  // ─── Handle region change for location picker (center-pin mode) ───────
  const handleRegionDidChange = useCallback(
    (feature: GeoJSON.Feature) => {
      if (!draggableMarker || !onLocationSelected) return;
      if (!feature.properties?.isUserInteraction) return; // Ignore programmatic camera movements
      const geom = feature.geometry as GeoJSON.Point;
      if (geom && geom.coordinates) {
        const [lng, lat] = geom.coordinates;
        onLocationSelected(lat, lng);
      }
    },
    [draggableMarker, onLocationSelected]
  );

  return (
    <View style={[styles.container, { height, borderRadius, overflow: 'hidden' }]}>
      <MapLibreGL.MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={MAP_STYLE}
        logoEnabled={false}
        attributionPosition={{ bottom: 8, left: 8 }}
        compassEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        pitchEnabled={false}
        rotateEnabled={false}
        onRegionDidChange={draggableMarker ? handleRegionDidChange : undefined}
        onDidFinishLoadingStyle={() => console.log('[MapView] onDidFinishLoadingStyle')}
        onDidFinishLoadingMap={() => console.log('[MapView] onDidFinishLoadingMap')}
        onDidFailLoadingMap={() => console.log('[MapView] onDidFailLoadingMap')}
      >
        {/* Camera */}
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel: zoom,
          }}
        />

        {/* Doctor markers */}
        {!draggableMarker &&
          markers
            .filter(m => m.type === 'doctor' || m.type === 'clinic' || m.type === 'hospital')
            .map(marker => (
              <MapLibreGL.MarkerView
                key={marker.id}
                id={`marker-${marker.id}`}
                coordinate={[marker.longitude, marker.latitude]}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={() => onMarkerPress?.(marker.id)}
                  style={markerStyles.touchable}
                >
                  <DoctorPin />
                </View>
              </MapLibreGL.MarkerView>
            ))}

        {/* Patient marker */}
        {!draggableMarker &&
          markers
            .filter(m => m.type === 'patient')
            .map(marker => (
              <MapLibreGL.MarkerView
                key={marker.id}
                id={`marker-${marker.id}`}
                coordinate={[marker.longitude, marker.latitude]}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <PatientDot />
              </MapLibreGL.MarkerView>
            ))}

        {/* Route polyline */}
        {routeGeoJSON && (
          <MapLibreGL.ShapeSource id="route-source" shape={routeGeoJSON}>
            <MapLibreGL.LineLayer
              id="route-line-casing"
              style={{
                lineColor: '#FFFFFF',
                lineWidth: 7,
                lineOpacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <MapLibreGL.LineLayer
              id="route-line"
              style={{
                lineColor: '#087F8C',
                lineWidth: 4,
                lineOpacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapLibreGL.ShapeSource>
        )}
      </MapLibreGL.MapView>

      {/* Center pin for location picker mode */}
      {draggableMarker && (
        <View style={styles.centerPinWrap} pointerEvents="none">
          <View style={styles.centerPin}>
            <View style={styles.centerPinHead} />
            <View style={styles.centerPinTail} />
          </View>
          <View style={styles.centerPinShadow} />
        </View>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#ECEFF1',
  },
  map: {
    flex: 1,
  },
  centerPinWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPin: {
    alignItems: 'center',
    marginTop: -36, // offset so the pin point sits at exact center
  },
  centerPinHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#087F8C',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
  },
  centerPinTail: {
    width: 3,
    height: 14,
    backgroundColor: '#087F8C',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    marginTop: -2,
  },
  centerPinShadow: {
    width: 12,
    height: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop: 2,
  },
});

const markerStyles = StyleSheet.create({
  touchable: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  // Doctor teardrop pin
  doctorOuter: {
    alignItems: 'center',
  },
  doctorInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#087F8C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
  },
  doctorCross: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossH: {
    position: 'absolute',
    width: 12,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  crossV: {
    position: 'absolute',
    width: 3,
    height: 12,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  doctorTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#087F8C',
    marginTop: -2,
  },
  // Patient pulsing dot
  patientOuter: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(8, 127, 140, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(8, 127, 140, 0.25)',
  },
  patientDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#087F8C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
    }),
  },
});
