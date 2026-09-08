import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const GEOAPIFY_KEY = 'd134eae980bd4bb7a9fe479f04e6c898';
const MAP_STYLE = `https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=${GEOAPIFY_KEY}`;
const FALLBACK_STYLE = 'https://demotiles.maplibre.org/style.json';

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

function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function FulfillmentMapModal({ isOpen, onClose, targetId, prescriptionCode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Fetch canonical location details from authorized backend endpoint
  useEffect(() => {
    if (!isOpen || !targetId) return;

    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    setRouteInfo(null);

    api
      .get(`/pharmacy/fulfillment-location/${targetId}`)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load fulfillment location data.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, targetId]);

  // Initialize and update MapLibre GL map
  useEffect(() => {
    if (!isOpen || loading || !data || !mapContainerRef.current) return;

    const patientLat = data?.patient?.latitude;
    const patientLng = data?.patient?.longitude;
    const pharmacyLat = data?.pharmacy?.latitude;
    const pharmacyLng = data?.pharmacy?.longitude;

    const hasPatient = isValidCoordinate(patientLat, patientLng);
    const hasPharmacy = isValidCoordinate(pharmacyLat, pharmacyLng);

    // If neither coordinate is valid, do not plot misleading map
    if (!hasPatient && !hasPharmacy) return;

    const maplibregl = window.maplibregl;
    if (!maplibregl) {
      console.error('MapLibre GL is not loaded in the window.');
      return;
    }

    // Determine initial center
    const centerLng = hasPatient ? patientLng : pharmacyLng;
    const centerLat = hasPatient ? patientLat : pharmacyLat;

    // Clean up previous instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    let map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLE,
        center: [centerLng, centerLat],
        zoom: hasPatient && hasPharmacy ? 11 : 14,
      });
      mapInstanceRef.current = map;
    } catch (e) {
      console.warn('Geoapify style failed, falling back to demo tiles:', e);
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: FALLBACK_STYLE,
        center: [centerLng, centerLat],
        zoom: hasPatient && hasPharmacy ? 11 : 14,
      });
      mapInstanceRef.current = map;
    }

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', async () => {
      // 1. Add Pharmacy Marker
      if (hasPharmacy) {
        const phEl = document.createElement('div');
        phEl.className = 'pharmacy-map-marker';
        phEl.innerHTML = `
          <div style="
            width: 36px;
            height: 36px;
            border-radius: 18px;
            background: #087F8C;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            cursor: pointer;
          ">
            <span class="material-symbols-outlined" style="font-size: 20px;">local_pharmacy</span>
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 8px solid #087F8C;
            margin: -2px auto 0;
          "></div>
        `;

        const phPopup = new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 4px;">
            <div style="font-weight: 800; font-size: 13px; color: #087F8C;">${data.pharmacy.name}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">${data.pharmacy.address}</div>
            <div style="font-family: monospace; font-size: 10px; color: #64748B; margin-top: 4px;">
              ${pharmacyLat.toFixed(5)}° N, ${pharmacyLng.toFixed(5)}° E
            </div>
            <div style="font-size: 10px; font-weight: 700; color: #087F8C; margin-top: 2px;">📍 Pharmacy / Pickup Location</div>
          </div>
        `);

        new maplibregl.Marker({ element: phEl, anchor: 'bottom' })
          .setLngLat([pharmacyLng, pharmacyLat])
          .setPopup(phPopup)
          .addTo(map);
      }

      // 2. Add Patient Marker
      if (hasPatient) {
        const patEl = document.createElement('div');
        patEl.className = 'patient-map-marker';
        patEl.innerHTML = `
          <div style="
            position: relative;
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <div style="
              position: absolute;
              width: 32px;
              height: 32px;
              border-radius: 16px;
              background: rgba(37, 99, 235, 0.25);
              border: 1px solid rgba(37, 99, 235, 0.4);
            "></div>
            <div style="
              width: 14px;
              height: 14px;
              border-radius: 7px;
              background: #2563EB;
              border: 2px solid #FFFFFF;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              z-index: 2;
            "></div>
          </div>
        `;

        const patPopup = new maplibregl.Popup({ offset: 15 }).setHTML(`
          <div style="padding: 4px;">
            <div style="font-weight: 800; font-size: 13px; color: #2563EB;">Patient: ${data.patient.name}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">${data.patient.address}</div>
            <div style="font-family: monospace; font-size: 10px; color: #64748B; margin-top: 4px;">
              ${patientLat.toFixed(5)}° N, ${patientLng.toFixed(5)}° E
            </div>
            <div style="font-size: 10px; font-weight: 700; color: #2563EB; margin-top: 2px;">📍 Patient Delivery / Residence</div>
          </div>
        `);

        new maplibregl.Marker({ element: patEl })
          .setLngLat([patientLng, patientLat])
          .setPopup(patPopup)
          .addTo(map);
      }

      // 3. Fit bounds if both exist
      if (hasPatient && hasPharmacy) {
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend([pharmacyLng, pharmacyLat]);
        bounds.extend([patientLng, patientLat]);
        map.fitBounds(bounds, { padding: 70, maxZoom: 14 });

        // 4. Fetch real OSRM Driving Route Polyline
        setRouteLoading(true);
        try {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pharmacyLng},${pharmacyLat};${patientLng},${patientLat}?overview=full&geometries=geojson`;
          const res = await fetch(osrmUrl);
          if (res.ok) {
            const json = await res.json();
            const route = json?.routes?.[0];
            if (route?.geometry?.coordinates) {
              setRouteInfo({
                distanceKm: Math.round((route.distance / 1000) * 10) / 10,
                durationMin: Math.round(route.duration / 60),
                isRealDrivingRoute: true,
              });

              if (map.getSource('route')) {
                map.getSource('route').setData(route.geometry);
              } else {
                map.addSource('route', {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    properties: {},
                    geometry: route.geometry,
                  },
                });

                map.addLayer({
                  id: 'route-line',
                  type: 'line',
                  source: 'route',
                  layout: {
                    'line-join': 'round',
                    'line-cap': 'round',
                  },
                  paint: {
                    'line-color': '#087F8C',
                    'line-width': 4.5,
                    'line-opacity': 0.85,
                  },
                });
              }
            }
          }
        } catch {
          // Fall back gracefully to Haversine straight-line distance
          const haversineDist = calculateHaversineDistanceKm(pharmacyLat, pharmacyLng, patientLat, patientLng);
          setRouteInfo({
            distanceKm: haversineDist,
            durationMin: Math.round((haversineDist || 0) * 2.5),
            isRealDrivingRoute: false,
          });
        } finally {
          setRouteLoading(false);
        }
      }
    });

    // Resize map when window or modal size changes
    const timer = setTimeout(() => {
      map.resize();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, loading, data]);

  if (!isOpen) return null;

  const patient = data?.patient;
  const pharmacy = data?.pharmacy;

  const hasPatientCoords = isValidCoordinate(patient?.latitude, patient?.longitude);
  const hasPharmacyCoords = isValidCoordinate(pharmacy?.latitude, pharmacy?.longitude);
  const hasAnyCoords = hasPatientCoords || hasPharmacyCoords;

  const distKm = routeInfo?.distanceKm ?? data?.distanceKm ?? calculateHaversineDistanceKm(pharmacy?.latitude, pharmacy?.longitude, patient?.latitude, patient?.longitude);

  const googleMapsUrl =
    hasPatientCoords && hasPharmacyCoords
      ? `https://www.google.com/maps/dir/?api=1&origin=${pharmacy.latitude},${pharmacy.longitude}&destination=${patient.latitude},${patient.longitude}`
      : hasPharmacyCoords
      ? `https://www.google.com/maps/search/?api=1&query=${pharmacy.latitude},${pharmacy.longitude}`
      : hasPatientCoords
      ? `https://www.google.com/maps/search/?api=1&query=${patient.latitude},${patient.longitude}`
      : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          width: '100%',
          maxWidth: 900,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(8, 127, 140, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#087F8C',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>map</span>
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Fulfillment & Patient Location Map
              </h2>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                Prescription: <strong style={{ fontFamily: 'monospace', color: '#087F8C' }}>{prescriptionCode || data?.prescriptionCode || targetId}</strong>
                {data?.status ? ` · Status: ${data.status.replace(/_/g, ' ').toUpperCase()}` : ''}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close Map"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 36, animation: 'spin 1.5s linear infinite', color: '#087F8C' }}>
                progress_activity
              </span>
              <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>Loading verified location coordinates...</div>
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 42 }}>error</span>
              <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>Unable to Load Location</div>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{error}</div>
            </div>
          ) : !hasAnyCoords ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#94A3B8' }}>location_off</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginTop: 8 }}>Location Unavailable</h3>
              <p style={{ fontSize: 13, maxWidth: 440, margin: '8px auto 0', color: '#64748B' }}>
                Neither the patient nor the pharmacy has verified coordinates on record. RuralCare strictly refrains from guessing or generating inaccurate coordinates.
              </p>
              {patient?.address && (
                <div style={{ marginTop: 16, padding: '10px 16px', background: '#F8FAFC', borderRadius: 8, display: 'inline-block', border: '1px solid #E2E8F0', fontSize: 12 }}>
                  Recorded Address: <strong>{patient.address}</strong>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Top Location Summary Badges */}
              <div
                style={{
                  padding: '12px 20px',
                  background: '#FFFFFF',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 12,
                }}
              >
                {/* Pharmacy Card */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 8, borderRadius: 8, backgroundColor: 'rgba(8, 127, 140, 0.05)', border: '1px solid rgba(8, 127, 140, 0.2)' }}>
                  <span className="material-symbols-outlined" style={{ color: '#087F8C', fontSize: 20, marginTop: 2 }}>storefront</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#087F8C', textTransform: 'uppercase' }}>Pharmacy / Pickup Point</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pharmacy?.name}</div>
                    <div style={{ fontSize: 11.5, color: '#475569' }}>{pharmacy?.address}</div>
                    {hasPharmacyCoords ? (
                      <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#087F8C', marginTop: 2 }}>
                        {pharmacy.latitude.toFixed(6)}, {pharmacy.longitude.toFixed(6)}
                      </div>
                    ) : (
                      <span style={{ fontSize: 10.5, color: '#DC2626', fontWeight: 600 }}>No Store Coordinates</span>
                    )}
                  </div>
                </div>

                {/* Patient Card */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 8, borderRadius: 8, backgroundColor: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                  <span className="material-symbols-outlined" style={{ color: '#2563EB', fontSize: 20, marginTop: 2 }}>person_pin_circle</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>Patient Delivery / Residence</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{patient?.name}</div>
                    <div style={{ fontSize: 11.5, color: '#475569' }}>{patient?.address}</div>
                    {hasPatientCoords ? (
                      <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#2563EB', marginTop: 2 }}>
                        {patient.latitude.toFixed(6)}, {patient.longitude.toFixed(6)}
                      </div>
                    ) : (
                      <span style={{ fontSize: 10.5, color: '#DC2626', fontWeight: 600 }}>Patient Coordinates Unavailable</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Map Container */}
              <div style={{ position: 'relative', width: '100%', height: 420, backgroundColor: '#ECEFF1' }}>
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

                {/* Route Loading Indicator Overlay */}
                {routeLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      padding: '6px 12px',
                      borderRadius: 20,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#087F8C',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      zIndex: 10,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>
                      sync
                    </span>
                    Calculating Driving Route...
                  </div>
                )}
              </div>

              {/* Footer with Distance, Estimated Travel Time, and Directions */}
              <div
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#F8FAFC',
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {distKm != null && distKm > 0 ? (
                    <div>
                      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                        {routeInfo?.isRealDrivingRoute ? 'Driving Distance' : 'Estimated Distance'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                        {distKm} km
                        {routeInfo?.durationMin ? (
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginLeft: 6 }}>
                            (~{routeInfo.durationMin} min drive)
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#64748B' }}>
                      📍 Viewing single location point on map
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>directions</span>
                      External Directions
                    </a>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={onClose}>
                    Done
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
