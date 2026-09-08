import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

const GEOAPIFY_KEY = 'd134eae980bd4bb7a9fe479f04e6c898';
const MAP_STYLE = `https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=${GEOAPIFY_KEY}`;
const FALLBACK_STYLE = 'https://demotiles.maplibre.org/style.json';

const DEFAULT_COORDS = {
  latitude: 25.9870,
  longitude: 85.2290,
  address: 'Main Road, Ramnagar, Vaishali, Bihar'
};

function isValidCoordinate(lat, lng) {
  return (
    typeof lat === 'number' &&
    !isNaN(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    !isNaN(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export default function PharmacyLocationPickerModal({
  isOpen,
  onClose,
  initialLocation,
  onLocationSaved,
}) {
  const initLat = isValidCoordinate(initialLocation?.latitude, initialLocation?.longitude)
    ? Number(initialLocation.latitude)
    : DEFAULT_COORDS.latitude;
  const initLng = isValidCoordinate(initialLocation?.latitude, initialLocation?.longitude)
    ? Number(initialLocation.longitude)
    : DEFAULT_COORDS.longitude;
  const initAddr = initialLocation?.address || DEFAULT_COORDS.address;

  const [latitude, setLatitude] = useState(initLat);
  const [longitude, setLongitude] = useState(initLng);
  const [address, setAddress] = useState(initAddr);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const reverseTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Sync with initialLocation when modal opens
  useEffect(() => {
    if (isOpen) {
      const lat = isValidCoordinate(initialLocation?.latitude, initialLocation?.longitude)
        ? Number(initialLocation.latitude)
        : DEFAULT_COORDS.latitude;
      const lng = isValidCoordinate(initialLocation?.latitude, initialLocation?.longitude)
        ? Number(initialLocation.longitude)
        : DEFAULT_COORDS.longitude;
      const addr = initialLocation?.address || DEFAULT_COORDS.address;

      setLatitude(lat);
      setLongitude(lng);
      setAddress(addr);
      setSearchQuery('');
      setSuggestions([]);
      setErrorNotice(null);

      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter([lng, lat]);
      }
    }
  }, [isOpen, initialLocation?.latitude, initialLocation?.longitude, initialLocation?.address]);

  // Reverse geocode coordinate using Geoapify
  const reverseGeocode = useCallback(async (lat, lng) => {
    if (!isValidCoordinate(lat, lng)) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setResolvingAddress(true);
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_KEY}`,
        { signal: controller.signal }
      );
      if (res.ok) {
        const json = await res.json();
        const feat = json?.features?.[0]?.properties;
        if (feat) {
          const resolved =
            feat.formatted ||
            [feat.address_line1, feat.city || feat.county, feat.state].filter(Boolean).join(', ');
          if (resolved) {
            setAddress(resolved);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Reverse geocode error:', err);
      }
    } finally {
      setResolvingAddress(false);
    }
  }, []);

  // Update pin position and pan map
  const updatePosition = useCallback((newLat, newLng, triggerReverse = true) => {
    setLatitude(newLat);
    setLongitude(newLng);

    if (markerRef.current) {
      markerRef.current.setLngLat([newLng, newLat]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.easeTo({ center: [newLng, newLat], zoom: 15 });
    }

    if (triggerReverse) {
      if (reverseTimeoutRef.current) clearTimeout(reverseTimeoutRef.current);
      reverseTimeoutRef.current = setTimeout(() => {
        reverseGeocode(newLat, newLng);
      }, 400);
    }
  }, [reverseGeocode]);

  // Search Address Autocomplete
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val || val.trim().length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(val)}&apiKey=${GEOAPIFY_KEY}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.features || []);
        }
      } catch (err) {
        console.warn('Search autocomplete error:', err);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  // Select autocomplete suggestion
  const handleSelectSuggestion = (feature) => {
    const coords = feature.geometry?.coordinates;
    if (coords && coords.length >= 2) {
      const [lng, lat] = coords;
      const formatted = feature.properties?.formatted || feature.properties?.name || searchQuery;
      setAddress(formatted);
      setSearchQuery('');
      setSuggestions([]);
      updatePosition(lat, lng, false);
    }
  };

  // GPS "Use Current Location"
  const handleGpsLocation = () => {
    if (!navigator.geolocation) {
      setErrorNotice('Geolocation is not supported by your browser.');
      return;
    }

    setLoadingGps(true);
    setErrorNotice(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: curLat, longitude: curLng } = position.coords;
        setLoadingGps(false);
        updatePosition(curLat, curLng, true);
      },
      (error) => {
        setLoadingGps(false);
        console.warn('GPS error:', error);
        setErrorNotice(
          error.code === 1
            ? 'Location permission denied. Please allow location access in your browser or search for your address.'
            : 'Unable to retrieve your current location. Please search or pick on map.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Save location to backend
  const handleSave = async () => {
    const numLat = Number(latitude);
    const numLng = Number(longitude);

    if (!isValidCoordinate(numLat, numLng)) {
      setErrorNotice('Please select a valid location on the map (-90 to +90 lat, -180 to +180 lng).');
      return;
    }

    setSaving(true);
    setErrorNotice(null);

    try {
      const payload = {
        latitude: Number(numLat.toFixed(6)),
        longitude: Number(numLng.toFixed(6)),
        address: (address || '').trim() || 'Pharmacy Location',
      };

      const res = await api.put('/pharmacy/location', payload);

      setSaving(false);
      const saved = {
        latitude: res?.latitude ?? payload.latitude,
        longitude: res?.longitude ?? payload.longitude,
        address: res?.address ?? payload.address,
      };

      if (markerRef.current) {
        markerRef.current.setLngLat([saved.longitude, saved.latitude]);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter([saved.longitude, saved.latitude]);
      }

      if (onLocationSaved) {
        onLocationSaved(saved);
      }
      onClose();
    } catch (err) {
      setSaving(false);
      console.error('[PHARMACY LOCATION] Location confirmation failed:', err);
      setErrorNotice(err?.message || 'Unable to save location. Please try again.');
    }
  };

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const maplibregl = window.maplibregl;
    if (!maplibregl) {
      console.error('MapLibre GL is not loaded in window.');
      return;
    }

    // Clean up old instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const startLat = isValidCoordinate(initialLocation?.latitude, initialLocation?.longitude)
      ? Number(initialLocation.latitude)
      : (isValidCoordinate(latitude, longitude) ? Number(latitude) : DEFAULT_COORDS.latitude);
    const startLng = isValidCoordinate(initialLocation?.latitude, initialLocation?.longitude)
      ? Number(initialLocation.longitude)
      : (isValidCoordinate(latitude, longitude) ? Number(longitude) : DEFAULT_COORDS.longitude);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [startLng, startLat],
      zoom: 14,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('error', () => {
      if (map.getStyle()?.sprite !== FALLBACK_STYLE) {
        map.setStyle(FALLBACK_STYLE);
      }
    });

    // Create custom draggable emerald pharmacy pin
    const el = document.createElement('div');
    el.className = 'location-picker-custom-pin';
    el.style.width = '36px';
    el.style.height = '36px';
    el.style.borderRadius = '50%';
    el.style.background = '#00646f';
    el.style.border = '3px solid #ffffff';
    el.style.boxShadow = '0 3px 12px rgba(0, 100, 111, 0.45)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.color = '#ffffff';
    el.style.cursor = 'grab';
    el.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;">local_pharmacy</span>';

    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([startLng, startLat])
      .addTo(map);

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      updatePosition(lngLat.lat, lngLat.lng, true);
    });

    // Also allow clicking anywhere on map to move pin
    map.on('click', (e) => {
      updatePosition(e.lngLat.lat, e.lngLat.lng, true);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: 780,
          width: '94%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 16,
          boxShadow: '0 20px 40px -8px rgba(0, 40, 50, 0.28)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            background: 'var(--surface-container-lowest)',
            borderBottom: '1px solid var(--outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(0, 100, 111, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <span className="material-symbols-outlined fill" style={{ fontSize: 22 }}>
                add_location_alt
              </span>
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>
                Update Pharmacy Location
              </h2>
              <p style={{ fontSize: 12, margin: 0, color: 'var(--on-surface-variant)' }}>
                Set your exact pharmacy storefront coordinates for accurate patient routing and distance calculation
              </p>
            </div>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="Close"
            style={{ width: 34, height: 34 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div
          style={{
            padding: '12px 22px',
            background: 'var(--surface-container-low)',
            borderBottom: '1px solid var(--outline-variant)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 18,
                color: 'var(--on-surface-variant)',
              }}
            >
              search
            </span>
            <input
              type="text"
              className="search-input"
              style={{
                width: '100%',
                paddingLeft: 38,
                paddingRight: searching ? 34 : 12,
                height: 38,
                borderRadius: 8,
                fontSize: 13,
                border: '1px solid var(--outline-variant)',
                background: 'var(--surface-container-lowest)',
              }}
              placeholder="Search address, landmark, village, or pincode..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {searching && (
              <span
                className="material-symbols-outlined"
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 16,
                  color: 'var(--primary)',
                  animation: 'spin 1s linear infinite',
                }}
              >
                progress_activity
              </span>
            )}

            {/* Autocomplete Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                  zIndex: 200,
                  marginTop: 4,
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSuggestion(item)}
                    style={{
                      padding: '8px 12px',
                      fontSize: 12.5,
                      borderBottom: idx < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f5fbfb')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 16, color: 'var(--primary)' }}
                    >
                      location_on
                    </span>
                    <span style={{ flex: 1 }}>{item.properties?.formatted}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GPS Location Button */}
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleGpsLocation}
            disabled={loadingGps}
            style={{
              height: 38,
              padding: '0 14px',
              fontSize: 12.5,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              borderRadius: 8,
              borderColor: 'var(--primary)',
              color: 'var(--primary)',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 17,
                animation: loadingGps ? 'spin 1s linear infinite' : 'none',
              }}
            >
              {loadingGps ? 'progress_activity' : 'my_location'}
            </span>
            <span>{loadingGps ? 'Detecting GPS...' : 'Use My GPS'}</span>
          </button>
        </div>

        {/* Notice/Alert */}
        {errorNotice && (
          <div
            style={{
              padding: '8px 20px',
              background: 'var(--error-container)',
              color: 'var(--on-error-container)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
            <span>{errorNotice}</span>
          </div>
        )}

        {/* Map Container */}
        <div style={{ position: 'relative', height: 350, width: '100%', background: '#eaeaea' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

          {/* Map Guidance Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(6px)',
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--on-surface-variant)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--primary)' }}>
              touch_app
            </span>
            <span>Click map or drag the emerald pin to position your storefront</span>
          </div>
        </div>

        {/* Location Form & Coordinate Review */}
        <div
          style={{
            padding: '14px 22px',
            background: 'var(--surface-container-lowest)',
            borderTop: '1px solid var(--outline-variant)',
          }}
        >
          <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
            {/* Coordinate display chips */}
            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--surface-container-low)',
                border: '1px solid var(--outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 11.5, color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                LATITUDE:
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>
                {latitude ? latitude.toFixed(6) : '—'}
              </span>
            </div>

            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--surface-container-low)',
                border: '1px solid var(--outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 11.5, color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                LONGITUDE:
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>
                {longitude ? longitude.toFixed(6) : '—'}
              </span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--on-surface-variant)' }}>
                CONFIRMED PHARMACY ADDRESS
              </label>
              {resolvingAddress && (
                <span style={{ fontSize: 11, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13, animation: 'spin 1s linear infinite' }}>
                    progress_activity
                  </span>
                  Resolving address...
                </span>
              )}
            </div>
            <textarea
              className="form-input"
              rows={2}
              style={{
                width: '100%',
                borderRadius: 8,
                fontSize: 13,
                resize: 'none',
                padding: '8px 12px',
              }}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Shop #4, Main Bazar Road, Ramnagar, Vaishali, Bihar"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 22px',
            background: 'var(--surface-container-low)',
            borderTop: '1px solid var(--outline-variant)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>
                  progress_activity
                </span>
                Saving...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined fill" style={{ fontSize: 16 }}>
                  check_circle
                </span>
                Confirm & Save Location
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
