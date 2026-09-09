import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

const GEOAPIFY_KEY = 'd134eae980bd4bb7a9fe479f04e6c898';
const MAP_STYLE = `https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=${GEOAPIFY_KEY}`;
const FALLBACK_STYLE = 'https://demotiles.maplibre.org/style.json';

const DEFAULT_COORDS = {
  latitude: 25.9890,
  longitude: 85.2310,
  address: 'Station Road, Ramnagar, Vaishali, Bihar'
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

export default function HospitalLocationPickerModal({
  isOpen,
  onClose,
  initialLocation,
  hospitalId,
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
      if (!res.ok) throw new Error('Geocoding service unavailable');
      const data = await res.json();
      const feature = data.features?.[0];
      if (feature) {
        const p = feature.properties || {};
        const formatted =
          p.formatted ||
          [p.address_line1, p.address_line2, p.city || p.county, p.state, p.postcode]
            .filter(Boolean)
            .join(', ');
        if (formatted) {
          setAddress(formatted);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[HOSPITAL GEO] Reverse geocode failed:', err);
      }
    } finally {
      setResolvingAddress(false);
    }
  }, []);

  // Update position helper
  const updatePosition = useCallback((newLat, newLng, shouldReverse = true) => {
    setLatitude(newLat);
    setLongitude(newLng);
    setErrorNotice(null);

    if (markerRef.current) {
      markerRef.current.setLngLat([newLng, newLat]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.easeTo({ center: [newLng, newLat], duration: 400 });
    }

    if (shouldReverse) {
      if (reverseTimeoutRef.current) clearTimeout(reverseTimeoutRef.current);
      reverseTimeoutRef.current = setTimeout(() => {
        reverseGeocode(newLat, newLng);
      }, 350);
    }
  }, [reverseGeocode]);

  // Handle autocomplete input change with debouncing
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setErrorNotice(null);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const bias = `&bias=proximity:${longitude},${latitude}`;
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(val)}&filter=countrycode:in${bias}&limit=5&apiKey=${GEOAPIFY_KEY}`
        );
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setSuggestions(data.features || []);
      } catch (err) {
        console.warn('[HOSPITAL GEO] Autocomplete search failed:', err);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  // Select autocomplete suggestion
  const handleSelectSuggestion = (feature) => {
    const [sLng, sLat] = feature.geometry.coordinates;
    const p = feature.properties || {};
    const formatted =
      p.formatted ||
      [p.address_line1, p.address_line2, p.city, p.state, p.postcode].filter(Boolean).join(', ');

    setSuggestions([]);
    setSearchQuery('');
    setAddress(formatted);
    updatePosition(sLat, sLng, false);
  };

  // Use browser GPS
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorNotice('Geolocation is not supported by your browser.');
      return;
    }

    setLoadingGps(true);
    setErrorNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoadingGps(false);
        const { latitude: gpsLat, longitude: gpsLng } = pos.coords;
        updatePosition(gpsLat, gpsLng, true);
      },
      (err) => {
        setLoadingGps(false);
        console.warn('[HOSPITAL GEO] GPS error:', err);
        let msg = 'Could not get your location. Please select on the map or search.';
        if (err.code === 1) msg = 'Location permission denied. Please click on the map to set location.';
        else if (err.code === 2) msg = 'Location unavailable. Please select manually on the map.';
        else if (err.code === 3) msg = 'Location request timed out. Please try again or click the map.';
        setErrorNotice(msg);
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
        hospitalId: hospitalId || 'hosp-601',
        latitude: Number(numLat.toFixed(6)),
        longitude: Number(numLng.toFixed(6)),
        address: (address || '').trim() || 'Hospital Command Center',
      };

      const saveFn = api.put ? api.put.bind(api) : (api.patch ? api.patch.bind(api) : api.post.bind(api));
      const res = await saveFn('/hospitals/location', payload);

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
      console.error('[HOSPITAL LOCATION] Location update failed:', err);
      setErrorNotice(err?.message || 'Unable to save hospital location. Please try again.');
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

    // Create custom draggable teal/emerald hospital pin
    const el = document.createElement('div');
    el.className = 'location-picker-custom-pin';
    el.style.width = '38px';
    el.style.height = '38px';
    el.style.borderRadius = '50%';
    el.style.background = '#00685f';
    el.style.border = '3px solid #ffffff';
    el.style.boxShadow = '0 3px 14px rgba(0, 104, 95, 0.5)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.color = '#ffffff';
    el.style.cursor = 'grab';
    el.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px;">local_hospital</span>';

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
    <div className="modal-backdrop" style={{ zIndex: 1100, overflowY: 'auto', padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="modal-card"
        style={{
          maxWidth: 780,
          width: '95%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 16,
          boxShadow: '0 20px 40px -8px rgba(0, 40, 50, 0.28)',
          margin: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            background: 'var(--surface-white)',
            borderBottom: '1px solid var(--outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(0, 104, 95, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined fill" style={{ fontSize: 22 }}>
                add_location_alt
              </span>
            </div>
            <div>
              <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>
                Update Hospital Command Location
              </h2>
              <p style={{ fontSize: 11.5, margin: 0, color: 'var(--on-surface-variant)' }}>
                Set exact hospital coordinates so patients and 108 ambulances see your facility on their live map
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Top Quick Confirm Button (Always visible without scrolling) */}
            <button
              type="button"
              className="btn btn-primary"
              id="header-confirm-location-btn"
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0, 104, 95, 0.35)',
              }}
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>
                    progress_activity
                  </span>
                  Saving…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined fill" style={{ fontSize: 16 }}>
                    check_circle
                  </span>
                  Confirm Location
                </>
              )}
            </button>

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
        </div>

        {/* Search & Actions Bar */}
        <div
          style={{
            padding: '10px 20px',
            background: 'var(--surface-dim)',
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
                background: '#ffffff',
              }}
              placeholder="Search hospital address, landmark, town, or pincode..."
              value={searchQuery}
              onChange={handleSearchChange}
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

            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  zIndex: 200,
                  overflow: 'hidden',
                }}
              >
                {suggestions.map((s, idx) => (
                  <div
                    key={s.properties?.place_id || idx}
                    onClick={() => handleSelectSuggestion(s)}
                    style={{
                      padding: '10px 14px',
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderBottom: idx < suggestions.length - 1 ? '1px solid var(--outline-variant)' : 'none',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-dim)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary)' }}>
                      location_on
                    </span>
                    <span style={{ color: 'var(--on-surface)' }}>{s.properties?.formatted}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleUseCurrentLocation}
            disabled={loadingGps}
            title="Use current GPS device coordinates"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              height: 38,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 16,
                animation: loadingGps ? 'spin 1s linear infinite' : 'none',
              }}
            >
              {loadingGps ? 'progress_activity' : 'my_location'}
            </span>
            {loadingGps ? 'Locating…' : 'Use Current GPS'}
          </button>
        </div>

        {/* Quick Regional Presets */}
        <div
          style={{
            padding: '8px 22px',
            background: 'var(--surface-white)',
            borderBottom: '1px solid var(--outline-variant)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
            Hospital Presets:
          </span>
          {[
            { label: 'Ramnagar CHC', lat: 25.9890, lng: 85.2310, addr: 'Station Road, Ramnagar, Vaishali, Bihar' },
            { label: 'District Civil Hospital Hajipur', lat: 25.6858, lng: 85.2146, addr: 'Civil Lines, Hajipur, Vaishali, Bihar' },
            { label: 'Vaishali Sub-District Hospital', lat: 25.9912, lng: 85.1278, addr: 'Near Bus Stand, Vaishali, Bihar' },
            { label: 'Lalganj Referral Hospital', lat: 25.8672, lng: 85.1764, addr: 'Main Chowk, Lalganj, Vaishali, Bihar' },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="tag-preset-pill"
              onClick={() => {
                setAddress(preset.addr);
                updatePosition(preset.lat, preset.lng, false);
              }}
              style={{
                fontSize: 11.5,
                padding: '3px 10px',
                borderRadius: 20,
                border: '1px solid var(--outline-variant)',
                background: 'var(--surface-dim)',
                color: 'var(--on-surface)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Map Canvas Container */}
        <div style={{ position: 'relative', flex: 1, minHeight: 220, height: 260, background: '#e2e8f0' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />

          {/* Floating Instruction Banner */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 14,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(4px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--on-surface)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <span className="material-symbols-outlined fill" style={{ fontSize: 15, color: 'var(--primary)' }}>
              touch_app
            </span>
            Click map or drag the hospital pin to set exact coordinates
          </div>

          {errorNotice && (
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 14,
                right: 14,
                padding: '8px 14px',
                borderRadius: 8,
                background: 'rgba(254, 226, 226, 0.96)',
                border: '1px solid #f87171',
                color: '#991b1b',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                zIndex: 10,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
              {errorNotice}
            </div>
          )}
        </div>

        {/* Bottom Coordinates & Address Confirmation Section */}
        <div
          style={{
            padding: '10px 20px',
            background: 'var(--surface-white)',
            borderTop: '1px solid var(--outline-variant)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {/* Coordinate display chips */}
            <div
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'var(--surface-dim)',
                border: '1px solid var(--outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                LATITUDE:
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>
                {latitude ? latitude.toFixed(6) : '—'}
              </span>
            </div>

            <div
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'var(--surface-dim)',
                border: '1px solid var(--outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                LONGITUDE:
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>
                {longitude ? longitude.toFixed(6) : '—'}
              </span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-surface-variant)' }}>
                CONFIRMED HOSPITAL ADDRESS
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
                fontSize: 12.5,
                resize: 'none',
                padding: '6px 10px',
              }}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Station Road, Near Block Development Office, Ramnagar, Vaishali, Bihar"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--surface-dim)',
            borderTop: '1px solid var(--outline-variant)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            id="footer-confirm-location-btn"
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 22px',
              fontWeight: 700,
              fontSize: 13.5,
              boxShadow: '0 3px 12px rgba(0, 104, 95, 0.35)',
            }}
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>
                  progress_activity
                </span>
                Saving Location...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined fill" style={{ fontSize: 18 }}>
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
