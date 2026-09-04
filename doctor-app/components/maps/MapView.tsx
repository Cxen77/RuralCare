import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
  DimensionValue,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../../constants/theme';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  subtitle?: string;
  type?: 'patient' | 'doctor' | 'clinic' | 'hospital';
}

export interface MapViewProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  markers?: MapMarker[];
  draggableMarker?: boolean;
  onLocationSelected?: (lat: number, lng: number) => void;
  interactive?: boolean;
  height?: DimensionValue;
  width?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

let NativeWebView: any = null;
try {
  NativeWebView = require('react-native-webview').WebView;
} catch {
  NativeWebView = null;
}

export const MapView: React.FC<MapViewProps> = ({
  latitude,
  longitude,
  zoom = 15,
  markers = [],
  draggableMarker = false,
  onLocationSelected,
  interactive = true,
  height = 200,
  width = '100%',
  borderRadius = Radii.md,
  style,
}) => {
  const safeLat = isNaN(latitude) || latitude === 0 ? 25.9856 : latitude;
  const safeLng = isNaN(longitude) || longitude === 0 ? 85.2281 : longitude;

  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [centerLat, setCenterLat] = useState(safeLat);
  const [centerLng, setCenterLng] = useState(safeLng);
  const [useNativeFallback, setUseNativeFallback] = useState(!NativeWebView);

  useEffect(() => {
    setCenterLat(safeLat);
    setCenterLng(safeLng);
  }, [safeLat, safeLng]);

  const htmlContent = useMemo(() => {
    const markersJson = JSON.stringify(markers);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background: #F0FDF4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .custom-pin {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: white;
      font-size: 16px;
      font-weight: bold;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      border: 2px solid #FFFFFF;
    }
    .pin-doctor { background: #006A60; }
    .pin-clinic { background: #0284C7; }
    .pin-patient { background: #E11D48; }
    .pin-hospital { background: #7C3AED; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    try {
      var map = L.map('map', {
        center: [${safeLat}, ${safeLng}],
        zoom: ${currentZoom},
        zoomControl: ${interactive},
        dragging: ${interactive},
        touchZoom: ${interactive},
        scrollWheelZoom: ${interactive}
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      function createPinIcon(type, emoji) {
        var cls = 'pin-clinic';
        if (type === 'doctor') cls = 'pin-doctor';
        if (type === 'patient') cls = 'pin-patient';
        if (type === 'hospital') cls = 'pin-hospital';
        return L.divIcon({
          className: '',
          html: '<div class="custom-pin ' + cls + '">' + (emoji || '🏥') + '</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });
      }

      var markersData = ${markersJson};
      if (markersData && markersData.length > 0) {
        markersData.forEach(function(m) {
          var emoji = '🏥';
          if (m.type === 'doctor') emoji = '👨‍⚕️';
          if (m.type === 'patient') emoji = '👤';
          if (m.type === 'clinic') emoji = '🏥';
          var icon = createPinIcon(m.type, emoji);
          var marker = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
          if (m.title) {
            marker.bindPopup('<b>' + m.title + '</b>' + (m.subtitle ? '<br>' + m.subtitle : ''));
          }
        });
      }

      ${
        draggableMarker
          ? `
        var activeMarker = L.marker([${safeLat}, ${safeLng}], {
          draggable: true,
          icon: createPinIcon('clinic', '🏥')
        }).addTo(map);

        function notifyLocation(lat, lng) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOCATION_CHANGED', lat: lat, lng: lng }));
          } else if (window.parent) {
            window.parent.postMessage({ type: 'LOCATION_CHANGED', lat: lat, lng: lng }, '*');
          }
        }

        activeMarker.on('dragend', function(e) {
          var pos = e.target.getLatLng();
          notifyLocation(pos.lat, pos.lng);
        });

        map.on('click', function(e) {
          activeMarker.setLatLng(e.latlng);
          notifyLocation(e.latlng.lat, e.latlng.lng);
        });
      `
          : markers.length === 0
          ? `
        var singleMarker = L.marker([${safeLat}, ${safeLng}], {
          icon: createPinIcon('clinic', '🏥')
        }).addTo(map);
      `
          : ''
      }
    } catch(err) {
      console.error(err);
    }
  </script>
</body>
</html>`;
  }, [safeLat, safeLng, currentZoom, markers, draggableMarker, interactive]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'LOCATION_CHANGED' && onLocationSelected) {
        onLocationSelected(data.lat, data.lng);
      }
    } catch {}
  };

  const containerStyle = [
    styles.container,
    { height, width, borderRadius },
    style,
  ];

  if (Platform.OS === 'web') {
    return (
      <View style={containerStyle}>
        <iframe
          title="OpenStreetMap"
          srcDoc={htmlContent}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: typeof borderRadius === 'number' ? borderRadius : 12,
          }}
        />
      </View>
    );
  }

  if (NativeWebView && !useNativeFallback) {
    return (
      <View style={containerStyle}>
        <NativeWebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          onMessage={handleMessage}
          onError={() => setUseNativeFallback(true)}
          scrollEnabled={false}
          overScrollMode="never"
          style={[styles.webview, { borderRadius }]}
          containerStyle={{ borderRadius }}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={styles.osmHeader}>
        <View style={styles.osmBadge}>
          <MaterialIcons name="map" size={14} color={Colors.primary} />
          <Text style={styles.osmBadgeText}>OpenStreetMap • Clinic Map</Text>
        </View>
        <Text style={styles.osmCoordsText}>
          {centerLat.toFixed(4)}°N, {centerLng.toFixed(4)}°E
        </Text>
      </View>

      <TouchableOpacity
        style={styles.mapCanvas}
        activeOpacity={interactive ? 0.95 : 1}
        onPress={(e) => {
          if (!interactive || !draggableMarker) return;
          const { locationX, locationY } = e.nativeEvent;
          const deltaLat = (locationY - 100) * -0.0002;
          const deltaLng = (locationX - 150) * 0.0002;
          const newLat = centerLat + deltaLat;
          const newLng = centerLng + deltaLng;
          setCenterLat(newLat);
          setCenterLng(newLng);
          onLocationSelected?.(newLat, newLng);
        }}
      >
        <View style={styles.gridVertical1} />
        <View style={styles.gridVertical2} />
        <View style={styles.gridHorizontal1} />
        <View style={styles.gridHorizontal2} />

        <View style={styles.roadMain} />
        <View style={styles.roadSecondary} />

        {markers.map((m) => (
          <View key={m.id} style={[styles.markerPin, styles.pinClinic]}>
            <MaterialIcons name="local-hospital" size={22} color={Colors.white} />
            {m.title && (
              <View style={styles.markerTooltip}>
                <Text style={styles.markerTooltipText} numberOfLines={1}>
                  {m.title}
                </Text>
              </View>
            )}
          </View>
        ))}

        {draggableMarker && (
          <View style={styles.centerPinWrap}>
            <View style={styles.centerPinPulse} />
            <View style={styles.centerPin}>
              <MaterialIcons name="place" size={28} color="#0284C7" />
            </View>
            <View style={styles.centerMarkerTooltip}>
              <Text style={styles.centerMarkerTooltipText}>Tap anywhere to place clinic pin</Text>
            </View>
          </View>
        )}

        {!draggableMarker && markers.length === 0 && (
          <View style={styles.centerPinWrap}>
            <View style={[styles.markerPin, styles.pinClinic]}>
              <MaterialIcons name="local-hospital" size={22} color={Colors.white} />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {interactive && (
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setCurrentZoom((z) => Math.min(z + 1, 19))}
            activeOpacity={0.7}
          >
            <MaterialIcons name="add" size={18} color={Colors.secondary} />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setCurrentZoom((z) => Math.max(z - 1, 5))}
            activeOpacity={0.7}
          >
            <MaterialIcons name="remove" size={18} color={Colors.secondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    position: 'relative',
  },
  webview: {
    backgroundColor: 'transparent',
  },
  osmHeader: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  osmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    ...Shadows.sm,
  },
  osmBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  osmCoordsText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  mapCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#E8F4EC',
  },
  gridVertical1: {
    position: 'absolute',
    left: '33%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#D1E7DD',
  },
  gridVertical2: {
    position: 'absolute',
    left: '66%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#D1E7DD',
  },
  gridHorizontal1: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#D1E7DD',
  },
  gridHorizontal2: {
    position: 'absolute',
    top: '70%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#D1E7DD',
  },
  roadMain: {
    position: 'absolute',
    top: '48%',
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: '#FEF08A',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EAB308',
  },
  roadSecondary: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '52%',
    width: 6,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
  },
  centerPinWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  centerPinPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
  },
  centerPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerMarkerTooltip: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    marginTop: 2,
  },
  centerMarkerTooltipText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '600',
  },
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    ...Shadows.md,
  },
  pinClinic: {
    backgroundColor: '#0284C7',
  },
  markerTooltip: {
    position: 'absolute',
    bottom: 34,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  markerTooltipText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  zoomControls: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: Colors.white,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    ...Shadows.sm,
    zIndex: 10,
  },
  zoomBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: Colors.outlineLight,
  },
});
