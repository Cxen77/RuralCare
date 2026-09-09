import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, DimensionValue } from 'react-native';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  subtitle?: string;
  type?: 'patient' | 'doctor' | 'clinic' | 'hospital' | 'pharmacy';
}

export interface MapRoute {
  coordinates: [number, number][]; // [lat, lng] pairs (OSRM convention)
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
  onRegionWillChange?: () => void;
  onMarkerPress?: (markerId: string) => void;
  interactive?: boolean;
  height?: DimensionValue;
  width?: DimensionValue;
  borderRadius?: number;
}

// ─── Geoapify MapLibre Style URL (Identical to native Android MapView) ────────
const GEOAPIFY_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || '';
const MAP_STYLE = GEOAPIFY_KEY
  ? `https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=${GEOAPIFY_KEY}`
  : 'https://demotiles.maplibre.org/style.json';

const DEFAULT_CENTER: [number, number] = [85.2281, 25.9856]; // [lng, lat]
const DEFAULT_ZOOM = 15;

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
  onRegionWillChange,
  onMarkerPress,
  interactive = true,
  height = '100%',
  width = '100%',
  borderRadius = 0,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const centerLng = longitude != null && !isNaN(longitude) ? longitude : DEFAULT_CENTER[0];
  const centerLat = latitude != null && !isNaN(latitude) ? latitude : DEFAULT_CENTER[1];

  const isDefaultCoords = (lng: number, lat: number) =>
    Math.abs(lng - DEFAULT_CENTER[0]) < 0.0001 && Math.abs(lat - DEFAULT_CENTER[1]) < 0.0001;

  const hasRealCoords =
    longitude != null &&
    !isNaN(longitude) &&
    latitude != null &&
    !isNaN(latitude) &&
    latitude !== 0 &&
    longitude !== 0 &&
    !isDefaultCoords(longitude, latitude);

  // Freeze initial center so center changes during dragging never reload the iframe
  const initialCenterRef = useRef<[number, number]>(
    hasRealCoords ? [longitude!, latitude!] : [centerLng, centerLat]
  );

  // If initialCenterRef was initialized to DEFAULT_CENTER, but real coordinates arrive, update it
  if (hasRealCoords && isDefaultCoords(initialCenterRef.current[0], initialCenterRef.current[1])) {
    initialCenterRef.current = [longitude!, latitude!];
  }

  // Route GeoJSON in MapLibre format ([lng, lat])
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
            // Convert [lat, lng] to MapLibre [lng, lat]
            coordinates: route.coordinates.map(([lat, lng]) => [lng, lat]),
          },
        },
      ],
    };
  }, [route]);

  // Handle messages sent from the MapLibre GL iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'REGION_WILL_CHANGE' && onRegionWillChange) {
          onRegionWillChange();
        } else if (data.type === 'MARKER_PRESS' && data.id && onMarkerPress) {
          onMarkerPress(data.id);
        } else if (
          data.type === 'LOCATION_CHANGED' &&
          typeof data.lat === 'number' &&
          typeof data.lng === 'number' &&
          onLocationSelected
        ) {
          onLocationSelected(data.lat, data.lng);
        }
      } catch {
        // Ignore non-JSON or external window messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMarkerPress, onLocationSelected, onRegionWillChange]);

  // Forward reactive updates to the MapLibre GL JS instance inside the iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'UPDATE_STATE',
        center: [centerLng, centerLat],
        zoom,
        focusNonce,
        fitNonce,
        markers,
        routeGeoJSON,
        draggableMarker,
      },
      '*'
    );
  }, [centerLng, centerLat, zoom, focusNonce, fitNonce, markers, routeGeoJSON, draggableMarker]);

  // Build the complete MapLibre GL JS HTML document with Geoapify osm-bright-grey vector style
  const htmlContent = useMemo(() => {
    const initialMarkersJson = JSON.stringify(markers);
    const initialRouteJson = JSON.stringify(routeGeoJSON);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>RuralCare Geoapify Map</title>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #ECEFF1;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* ── Doctor Pin: Inline styled in createDoctorElement ── */

    /* ── Patient Dot: Identical to native Android PatientDot ── */
    .patient-dot-wrap {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -50%);
    }
    .patient-pulse-ring {
      position: absolute;
      width: 26px;
      height: 26px;
      border-radius: 13px;
      background: rgba(8, 127, 140, 0.18);
      border: 1px solid rgba(8, 127, 140, 0.35);
      animation: pulseAnim 2.2s infinite ease-out;
    }
    .patient-inner-dot {
      width: 12px;
      height: 12px;
      border-radius: 6px;
      background: #087F8C;
      border: 2px solid #FFFFFF;
      box-shadow: 0 2px 5px rgba(0,0,0,0.25);
      z-index: 2;
    }
    @keyframes pulseAnim {
      0% { transform: scale(0.9); opacity: 0.8; }
      70% { transform: scale(1.4); opacity: 0; }
      100% { transform: scale(1.4); opacity: 0; }
    }

    /* ── Center Pin for Location Picker: Identical to native Android centerPin ── */
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
      background: #087F8C;
      border: 3px solid #FFFFFF;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
    }
    .center-pin-tail {
      width: 3px;
      height: 14px;
      background: #087F8C;
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

    /* ── MapLibre Popup Styling ── */
    .maplibregl-popup-content {
      padding: 8px 12px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 13px;
      line-height: 1.35;
      color: #1A1A1A;
    }
    .popup-title { font-weight: 700; color: #087F8C; }
    .popup-sub { font-size: 11px; color: #666666; margin-top: 2px; }
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
      var latestMarkers = ${initialMarkersJson};
      var latestRouteData = ${initialRouteJson};

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
          console.log('[MapView] 3D buildings layer setup:', err);
        }
      });

      function notify(msg) {
        if (window.parent) {
          window.parent.postMessage(msg, '*');
        }
      }

      function createDoctorElement(m) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#087F8C;border:3px solid #fff;box-shadow:0 2px 8px rgba(8,127,140,0.45);display:flex;align-items:center;justify-content:center;cursor:pointer;';
        wrap.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M19 9.5h-4.5V5h-5v4.5H5v5h4.5V19h5v-4.5H19v-5z"/></svg>';
        wrap.addEventListener('click', function(e) {
          e.stopPropagation();
          notify({ type: 'MARKER_PRESS', id: m.id });
        });
        return wrap;
      }

      function createPatientElement() {
        var wrap = document.createElement('div');
        wrap.className = 'patient-dot-wrap';
        wrap.innerHTML = '<div class="patient-pulse-ring"></div><div class="patient-inner-dot"></div>';
        return wrap;
      }

      function createPharmacyElement(m) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#059669;border:3px solid #fff;box-shadow:0 2px 8px rgba(5,150,105,0.45);display:flex;align-items:center;justify-content:center;cursor:pointer;';
        wrap.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>';
        wrap.addEventListener('click', function(e) {
          e.stopPropagation();
          notify({ type: 'MARKER_PRESS', id: m.id });
        });
        return wrap;
      }

      function createHospitalElement(m) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'width:34px;height:34px;border-radius:50%;background:#0284c7;border:3px solid #fff;box-shadow:0 3px 10px rgba(2,132,199,0.5);display:flex;align-items:center;justify-content:center;cursor:pointer;';
        wrap.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>';
        wrap.addEventListener('click', function(e) {
          e.stopPropagation();
          notify({ type: 'MARKER_PRESS', id: m.id });
        });
        return wrap;
      }

      function syncMarkers(markersList) {
        activeMarkers.forEach(function(m) { m.remove(); });
        activeMarkers = [];

        if (!markersList || !markersList.length || isDraggable) return;

        markersList.forEach(function(item) {
          if (item.latitude == null || item.longitude == null) return;
          var el;
          if (item.type === 'patient') {
            el = createPatientElement();
          } else if (item.type === 'pharmacy') {
            el = createPharmacyElement(item);
          } else if (item.type === 'hospital') {
            el = createHospitalElement(item);
          } else {
            el = createDoctorElement(item);
          }
          var anchor = 'center';
          var marker = new maplibregl.Marker({ element: el, anchor: anchor })
            .setLngLat([item.longitude, item.latitude])
            .addTo(map);

          if (item.title) {
            var popupHtml = '<div class="popup-title">' + item.title + '</div>' +
              (item.subtitle ? '<div class="popup-sub">' + item.subtitle + '</div>' : '');
            marker.setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(popupHtml));
          }

          activeMarkers.push(marker);
        });
      }

      function syncRoute(routeData) {
        if (!map.getSource('route-source')) {
          if (!routeData) return;
          map.addSource('route-source', {
            type: 'geojson',
            data: routeData
          });
          // Casing layer: #FFFFFF 7px (Identical to native Android)
          map.addLayer({
            id: 'route-line-casing',
            type: 'line',
            source: 'route-source',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 7,
              'line-opacity': 0.8
            }
          });
          // Core line: #087F8C 4px (Identical to native Android)
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-source',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#087F8C',
              'line-width': 4,
              'line-opacity': 0.9
            }
          });
        } else {
          if (routeData) {
            map.getSource('route-source').setData(routeData);
            if (map.getLayer('route-line-casing')) map.setLayoutProperty('route-line-casing', 'visibility', 'visible');
            if (map.getLayer('route-line')) map.setLayoutProperty('route-line', 'visibility', 'visible');
          } else {
            if (map.getLayer('route-line-casing')) map.setLayoutProperty('route-line-casing', 'visibility', 'none');
            if (map.getLayer('route-line')) map.setLayoutProperty('route-line', 'visibility', 'none');
          }
        }
      }

      map.on('load', function() {
        syncMarkers(latestMarkers);
        syncRoute(latestRouteData);
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
        map.flyTo({ center: e.lngLat, duration: 300 });
      });

      // Handle reactive state updates from React Native
      var lastFocusNonce = 0;
      var lastFitNonce = 0;
      window.addEventListener('message', function(event) {
        var msg = event.data;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'UPDATE_STATE') {
          if (msg.markers !== undefined) latestMarkers = msg.markers;
          if (msg.routeGeoJSON !== undefined) latestRouteData = msg.routeGeoJSON;
          isDraggable = !!msg.draggableMarker;
          var pinEl = document.getElementById('center-pin-wrap');
          if (pinEl) pinEl.style.display = isDraggable ? 'flex' : 'none';

          if (map.loaded()) {
            syncMarkers(latestMarkers);
            syncRoute(latestRouteData);
          }

          if (msg.fitNonce && msg.fitNonce !== lastFitNonce && latestMarkers && latestMarkers.length > 0) {
            lastFitNonce = msg.fitNonce;
            var bounds = new maplibregl.LngLatBounds();
            latestMarkers.forEach(function(m) {
              if (m.latitude != null && m.longitude != null) {
                bounds.extend([m.longitude, m.latitude]);
              }
            });
            if (!bounds.isEmpty()) {
              map.fitBounds(bounds, { padding: 60, duration: 600 });
            }
          } else if (msg.focusNonce && msg.focusNonce !== lastFocusNonce) {
            lastFocusNonce = msg.focusNonce;
            if (msg.center) {
              map.flyTo({ center: msg.center, zoom: msg.zoom || map.getZoom(), duration: 500 });
            }
          } else if (!userHasMovedMap && msg.center) {
            var isDefault = Math.abs(msg.center[0] - ${DEFAULT_CENTER[0]}) < 0.0001 && Math.abs(msg.center[1] - ${DEFAULT_CENTER[1]}) < 0.0001;
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

  return (
    <View style={[styles.container, { height, width, borderRadius, overflow: 'hidden' }]}>
      <iframe
        ref={iframeRef}
        title="RuralCare Geoapify Map"
        srcDoc={htmlContent}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: typeof borderRadius === 'number' ? borderRadius : 0,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ECEFF1',
    position: 'relative',
  },
});
