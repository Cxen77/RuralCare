import React, { useMemo, useRef, useEffect } from 'react';
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
import { Colors, Radii } from '../../constants/theme';

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
  focusNonce?: number;
  draggableMarker?: boolean;
  onLocationSelected?: (lat: number, lng: number) => void;
  onRegionWillChange?: () => void;
  interactive?: boolean;
  height?: DimensionValue;
  width?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

// ─── Geoapify MapLibre Style URL (Unified with Patient App) ──────────────────
const GEOAPIFY_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || '';
const MAP_STYLE = GEOAPIFY_KEY
  ? `https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=${GEOAPIFY_KEY}`
  : 'https://demotiles.maplibre.org/style.json';

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
  focusNonce = 0,
  draggableMarker = false,
  onLocationSelected,
  onRegionWillChange,
  interactive = true,
  height = 300,
  width = '100%',
  borderRadius = 12,
  style,
}) => {
  const safeLat = !isNaN(latitude) && latitude !== 0 ? latitude : 25.9856;
  const safeLng = !isNaN(longitude) && longitude !== 0 ? longitude : 85.2281;

  const isDefaultCoords = (lng: number, lat: number) =>
    Math.abs(lng - 85.2281) < 0.0001 && Math.abs(lat - 25.9856) < 0.0001;

  const hasRealCoords =
    longitude != null &&
    !isNaN(longitude) &&
    latitude != null &&
    !isNaN(latitude) &&
    latitude !== 0 &&
    longitude !== 0 &&
    !isDefaultCoords(longitude, latitude);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Freeze initial center so center changes during dragging never reload the iframe
  const initialCenterRef = useRef<[number, number]>(
    hasRealCoords ? [longitude!, latitude!] : [safeLng, safeLat]
  );

  // If initialCenterRef was initialized to default, but real coordinates arrive, update it
  if (hasRealCoords && isDefaultCoords(initialCenterRef.current[0], initialCenterRef.current[1])) {
    initialCenterRef.current = [longitude!, latitude!];
  }

  // Handle messages on web platform
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWebMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.type === 'REGION_WILL_CHANGE' && onRegionWillChange) {
          onRegionWillChange();
        } else if (data?.type === 'LOCATION_CHANGED' && onLocationSelected) {
          onLocationSelected(data.lat, data.lng);
        }
      } catch {}
    };

    window.addEventListener('message', handleWebMessage);
    return () => window.removeEventListener('message', handleWebMessage);
  }, [onLocationSelected, onRegionWillChange]);

  // Forward reactive updates to the MapLibre GL JS instance inside the iframe
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'UPDATE_STATE',
        center: [safeLng, safeLat],
        zoom,
        focusNonce,
        markers,
        draggableMarker,
      },
      '*'
    );
  }, [safeLng, safeLat, zoom, focusNonce, markers, draggableMarker]);

  const htmlContent = useMemo(() => {
    const markersJson = JSON.stringify(markers);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>RuralCare Doctor Map</title>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background: #F0FDF4;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* ── Doctor / Clinic Pin ── */
    .doctor-pin-wrap {
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translate(-50%, -100%);
      transition: transform 0.15s ease-out;
    }
    .doctor-pin-head {
      width: 30px;
      height: 30px;
      border-radius: 15px;
      background: #006A60;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .doctor-cross-h {
      position: absolute;
      width: 12px;
      height: 3px;
      border-radius: 1.5px;
      background: #FFFFFF;
    }
    .doctor-cross-v {
      position: absolute;
      width: 3px;
      height: 12px;
      border-radius: 1.5px;
      background: #FFFFFF;
    }
    .doctor-pin-tail {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 7px solid #006A60;
      margin-top: -2px;
    }

    /* ── Center Pin for Draggable / Location Picker ── */
    .center-pin-fixed {
      position: absolute;
      top: 50%;
      left: 50%;
      pointer-events: none;
      transform: translate(-50%, -100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 20;
    }
    .center-pin-head {
      width: 28px;
      height: 28px;
      border-radius: 14px;
      background: #006A60;
      border: 3px solid #FFFFFF;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
    }
    .center-pin-tail {
      width: 3px;
      height: 14px;
      background: #006A60;
      border-radius: 2px;
      margin-top: -2px;
    }
    .center-pin-shadow {
      width: 12px;
      height: 4px;
      border-radius: 6px;
      background: rgba(0,0,0,0.25);
      margin-top: 2px;
    }

    .maplibregl-popup-content {
      padding: 6px 10px;
      border-radius: 6px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.15);
      font-size: 12px;
      color: #1A1A1A;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="center-pin-wrap" class="center-pin-fixed" style="display: ${draggableMarker ? 'flex' : 'none'};">
    <div class="center-pin-head"></div>
    <div class="center-pin-tail"></div>
    <div class="center-pin-shadow"></div>
  </div>

  <script>
    (function() {
      var mapStyle = "${MAP_STYLE}";
      var centerCoord = [${initialCenterRef.current[0]}, ${initialCenterRef.current[1]}];
      var initialZoom = ${zoom};
      var isInteractive = ${interactive};
      var isDraggable = ${draggableMarker};

      var activeMarkers = [];

      var map = new maplibregl.Map({
        container: 'map',
        style: mapStyle,
        center: centerCoord,
        zoom: initialZoom,
        pitch: isDraggable ? 0 : 25,
        maxPitch: 60,
        interactive: isInteractive,
        attributionControl: false
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

      map.on('load', function() {
        try {
          if (!map.getLayer('3d-buildings') && map.getSource('default')) {
            map.addLayer({
              id: '3d-buildings',
              source: 'default',
              'source-layer': 'building',
              type: 'fill-extrusion',
              minzoom: 14,
              paint: {
                'fill-extrusion-color': '#dfdbd7',
                'fill-extrusion-height': [
                  'interpolate', ['linear'], ['zoom'],
                  14, 0,
                  14.5, ['coalesce', ['get', 'render_height'], 10]
                ],
                'fill-extrusion-base': [
                  'interpolate', ['linear'], ['zoom'],
                  14, 0,
                  14.5, ['coalesce', ['get', 'render_min_height'], 0]
                ],
                'fill-extrusion-opacity': 0.8
              }
            }, 'building-top');
          }
        } catch (err) {
          console.log('[MapView] 3D buildings setup:', err);
        }
        syncMarkers(${markersJson});
      });

      function notify(msg) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        } else if (window.parent) {
          window.parent.postMessage(JSON.stringify(msg), '*');
        }
      }

      function createPinElement(m) {
        var wrap = document.createElement('div');
        wrap.className = 'doctor-pin-wrap';
        wrap.innerHTML = '<div class="doctor-pin-head"><div class="doctor-cross-h"></div><div class="doctor-cross-v"></div></div><div class="doctor-pin-tail"></div>';
        if (m && m.id) {
          wrap.addEventListener('click', function(e) {
            e.stopPropagation();
            notify({ type: 'MARKER_PRESS', id: m.id });
          });
        }
        return wrap;
      }

      function syncMarkers(markersList) {
        activeMarkers.forEach(function(m) { m.remove(); });
        activeMarkers = [];

        if (!markersList || !markersList.length || isDraggable) return;

        markersList.forEach(function(item) {
          if (item.latitude == null || item.longitude == null) return;
          var el = createPinElement(item);
          var marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([item.longitude, item.latitude])
            .addTo(map);

          if (item.title) {
            marker.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<b>' + item.title + '</b>' + (item.subtitle ? '<br>' + item.subtitle : '')));
          }

          activeMarkers.push(marker);
        });
      }

      map.on('load', function() {
        syncMarkers(${markersJson});
      });

      // Handle map movement for draggable center pin (Location Picker):
      // Emit REGION_WILL_CHANGE on drag start, and LOCATION_CHANGED only after movement finishes
      var userHasMovedMap = false;
      map.on('movestart', function() {
        userHasMovedMap = true;
        if (!isDraggable) return;
        notify({ type: 'REGION_WILL_CHANGE' });
      });

      map.on('moveend', function() {
        if (!isDraggable) return;
        var center = map.getCenter();
        notify({ type: 'LOCATION_CHANGED', lat: center.lat, lng: center.lng });
      });

      map.on('click', function(e) {
        if (!isDraggable) return;
        map.flyTo({ center: e.lngLat, duration: 400 });
      });

      // Handle reactive state updates from React (UPDATE_STATE messages)
      var lastFocusNonce = 0;
      window.addEventListener('message', function(event) {
        var msg = event.data;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'UPDATE_STATE') {
          isDraggable = !!msg.draggableMarker;
          var pinEl = document.getElementById('center-pin-wrap');
          if (pinEl) pinEl.style.display = isDraggable ? 'flex' : 'none';

          if (map.loaded()) {
            syncMarkers(msg.markers);
          }

          if (msg.focusNonce && msg.focusNonce !== lastFocusNonce) {
            lastFocusNonce = msg.focusNonce;
            if (msg.center) {
              map.flyTo({ center: msg.center, zoom: msg.zoom || map.getZoom(), duration: 500 });
            }
          } else if (!userHasMovedMap && msg.center) {
            var isDefault = Math.abs(msg.center[0] - 85.2281) < 0.0001 && Math.abs(msg.center[1] - 25.9856) < 0.0001;
            if (!isDefault) {
              map.setCenter(msg.center);
              if (msg.zoom) map.setZoom(msg.zoom);
            }
          }
        }
      });
    })();
  </script>
</body>
</html>`;
  }, [zoom, interactive, draggableMarker]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'REGION_WILL_CHANGE' && onRegionWillChange) {
        onRegionWillChange();
      } else if (data.type === 'LOCATION_CHANGED' && onLocationSelected) {
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
          ref={iframeRef as any}
          title="RuralCare Geoapify Map"
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

  if (NativeWebView) {
    return (
      <View style={containerStyle}>
        <NativeWebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          onMessage={handleMessage}
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
          <Text style={styles.osmBadgeText}>Geoapify • MapLibre</Text>
        </View>
        <Text style={styles.osmCoordsText}>
          {safeLat.toFixed(4)}°N, {safeLng.toFixed(4)}°E
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
          const newLat = safeLat + deltaLat;
          const newLng = safeLng + deltaLng;
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
              <MaterialIcons name="place" size={28} color="#006A60" />
            </View>
            <View style={styles.centerMarkerTooltip}>
              <Text style={styles.centerMarkerTooltipText}>Tap to set clinic location</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ECEFF1',
    overflow: 'hidden',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  osmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  osmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  osmBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  osmCoordsText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  mapCanvas: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    position: 'relative',
    overflow: 'hidden',
  },
  gridVertical1: {
    position: 'absolute',
    left: '33%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#C8E6C9',
  },
  gridVertical2: {
    position: 'absolute',
    left: '66%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#C8E6C9',
  },
  gridHorizontal1: {
    position: 'absolute',
    top: '33%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#C8E6C9',
  },
  gridHorizontal2: {
    position: 'absolute',
    top: '66%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#C8E6C9',
  },
  roadMain: {
    position: 'absolute',
    top: '48%',
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: '#FFF9C4',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FFF176',
  },
  roadSecondary: {
    position: 'absolute',
    left: '52%',
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: '#FFF9C4',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#FFF176',
  },
  markerPin: {
    position: 'absolute',
    top: '40%',
    left: '48%',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pinClinic: {
    backgroundColor: '#006A60',
  },
  markerTooltip: {
    position: 'absolute',
    bottom: 36,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 100,
    alignItems: 'center',
  },
  markerTooltipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -14 }, { translateY: -28 }],
    alignItems: 'center',
  },
  centerPinPulse: {
    position: 'absolute',
    bottom: 0,
    width: 16,
    height: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.3)',
  },
  centerPin: {
    alignItems: 'center',
  },
  centerMarkerTooltip: {
    marginTop: 4,
    backgroundColor: '#006A60',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  centerMarkerTooltipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
