import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { Button, Card, IconButton } from '../ui';
import { MapView } from './MapView';
import { reverseGeocode } from '../../services/locationUtils';

let ExpoLocation: any = null;
try {
  ExpoLocation = require('expo-location');
} catch {
  ExpoLocation = null;
}

export interface ConfirmedLocation {
  latitude: number;
  longitude: number;
  address: string;
  updatedAt: string;
}

export interface LocationPickerProps {
  visible: boolean;
  title?: string;
  initialLocation?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  onClose: () => void;
  onLocationConfirmed: (loc: ConfirmedLocation) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  visible,
  title = 'Select Clinic / PHC Location',
  initialLocation,
  onClose,
  onLocationConfirmed,
}) => {
  // All hooks MUST be declared before any conditional returns (Rules of Hooks)
  const defaultLat = initialLocation?.latitude && initialLocation.latitude !== 0 ? initialLocation.latitude : 25.9856;
  const defaultLng = initialLocation?.longitude && initialLocation.longitude !== 0 ? initialLocation.longitude : 85.2281;

  const [latitude, setLatitude] = useState<number>(defaultLat);
  const [longitude, setLongitude] = useState<number>(defaultLng);
  const [address, setAddress] = useState<string>(initialLocation?.address || 'Main Road, Ramnagar, Vaishali, Bihar');
  const [loadingGps, setLoadingGps] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const timerRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const locationRequestIdRef = useRef(0);
  const gpsSelectionInProgressRef = useRef(false);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      if (!isInitializedRef.current) {
        const hasRealCoords =
          initialLocation?.latitude != null &&
          !isNaN(initialLocation.latitude) &&
          initialLocation.latitude !== 0 &&
          initialLocation?.longitude != null &&
          !isNaN(initialLocation.longitude) &&
          initialLocation.longitude !== 0 &&
          !(Math.abs(initialLocation.latitude - 25.9856) < 0.0001 && Math.abs(initialLocation.longitude - 85.2281) < 0.0001);

        const lat = hasRealCoords ? (initialLocation!.latitude as number) : 25.9856;
        const lng = hasRealCoords ? (initialLocation!.longitude as number) : 85.2281;
        setLatitude(lat);
        setLongitude(lng);
        setAddress(initialLocation?.address || 'Main Road, Ramnagar, Vaishali, Bihar');
        setPermissionNotice(null);
        if (hasRealCoords) {
          setFocusNonce(n => n + 1);
        }
        isInitializedRef.current = true;
      }
    } else {
      isInitializedRef.current = false;
    }
  }, [visible, initialLocation?.latitude, initialLocation?.longitude, initialLocation?.address]);

  const handleRegionWillChange = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    locationRequestIdRef.current++;
    setResolvingAddress(false);
  }, []);

  const handleLocationChange = useCallback((newLat: number, newLng: number) => {
    // Ignore map dragging events if we are explicitly running GPS logic
    if (gpsSelectionInProgressRef.current) return;

    setLatitude(newLat);
    setLongitude(newLng);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const requestId = ++locationRequestIdRef.current;

    timerRef.current = setTimeout(async () => {
      if (requestId !== locationRequestIdRef.current) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setResolvingAddress(true);

      try {
        const addr = await reverseGeocode(newLat, newLng, controller.signal);
        if (requestId === locationRequestIdRef.current && !controller.signal.aborted) {
          setAddress(addr);
        }
      } catch {
        if (requestId === locationRequestIdRef.current && !controller.signal.aborted) {
          setAddress(`Lat: ${newLat.toFixed(4)}, Lon: ${newLng.toFixed(4)}`);
        }
      } finally {
        if (requestId === locationRequestIdRef.current) {
          setResolvingAddress(false);
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      }
    }, 750);
  }, []);

  const handleUseMyLocation = useCallback(async () => {
    if (loadingGps) return;
    setLoadingGps(true);
    setPermissionNotice(null);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const requestId = ++locationRequestIdRef.current;
    gpsSelectionInProgressRef.current = true;

    const resolveAndFinish = async (curLat: number, curLng: number) => {
      setLatitude(curLat);
      setLongitude(curLng);
      setFocusNonce(prev => prev + 1);
      setResolvingAddress(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const resolvedAddr = await reverseGeocode(curLat, curLng, controller.signal);
        if (requestId === locationRequestIdRef.current && !controller.signal.aborted) {
          setAddress(resolvedAddr);
          setResolvingAddress(false);
        }
      } catch {
        if (requestId === locationRequestIdRef.current && !controller.signal.aborted) {
          setAddress(`Lat: ${curLat.toFixed(4)}, Lon: ${curLng.toFixed(4)}`);
          setResolvingAddress(false);
        }
      }
      setLoadingGps(false);
      gpsSelectionInProgressRef.current = false;
    };

    try {
      // 1. Browser Geolocation API on Web (instant & native browser permission prompt)
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        return new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              await resolveAndFinish(position.coords.latitude, position.coords.longitude);
              resolve();
            },
            (geoErr) => {
              console.log('[GPS web error]:', geoErr?.message);
              setPermissionNotice('Location permission denied or unavailable. You can drag the map to set location.');
              setLoadingGps(false);
              gpsSelectionInProgressRef.current = false;
              resolve();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
          );
        });
      }

      // 2. Native expo-location for iOS / Android
      if (ExpoLocation && ExpoLocation.requestForegroundPermissionsAsync) {
        try {
          const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const currentLocation = await ExpoLocation.getCurrentPositionAsync({
              accuracy: ExpoLocation.Accuracy ? ExpoLocation.Accuracy.Balanced : 3,
            }).catch(() => null);

            if (currentLocation?.coords) {
              await resolveAndFinish(currentLocation.coords.latitude, currentLocation.coords.longitude);
              return;
            }
          }
        } catch (e) {
          console.log('[GPS native error]:', e);
        }
      }

      setPermissionNotice('Location permission is off. You can drag the pin manually.');
    } catch (err: any) {
      setPermissionNotice('Failed to access location. Please check your device settings.');
    } finally {
      if (requestId === locationRequestIdRef.current) {
        setLoadingGps(false);
        gpsSelectionInProgressRef.current = false;
      }
    }
  }, [loadingGps]);

  const handleConfirm = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    onLocationConfirmed({
      latitude,
      longitude,
      address,
      updatedAt: new Date().toISOString(),
    });
    isInitializedRef.current = false;
    onClose();
  }, [latitude, longitude, address, onLocationConfirmed, onClose]);

  const handleClose = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isInitializedRef.current = false;
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <MaterialIcons name="local-hospital" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>Drag pin or tap map to set your clinic location</Text>
              </View>
            </View>
            <IconButton icon="close" size="sm" variant="plain" onPress={handleClose} />
          </View>

          {permissionNotice && (
            <View style={styles.permissionAlert}>
              <MaterialIcons name="info-outline" size={16} color="#B45309" />
              <Text style={styles.permissionAlertText}>{permissionNotice}</Text>
            </View>
          )}

          <View style={styles.mapWrapper}>
            <MapView
              latitude={latitude}
              longitude={longitude}
              zoom={15}
              draggableMarker
              onRegionWillChange={handleRegionWillChange}
              onLocationSelected={handleLocationChange}
              focusNonce={focusNonce}
              height={260}
              borderRadius={Radii.lg}
            />

            <TouchableOpacity
              style={styles.gpsFab}
              onPress={handleUseMyLocation}
              disabled={loadingGps}
              activeOpacity={0.85}
              accessibilityLabel="Use Current GPS Location"
            >
              {loadingGps ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <MaterialIcons name="my-location" size={18} color={Colors.primary} />
                  <Text style={styles.gpsFabText}>Use My Location</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Card radius={Radii.md} style={styles.addressCard}>
            <View style={styles.addressRow}>
              <MaterialIcons name="place" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addressLabel}>Clinic / Facility Address</Text>
                {resolvingAddress ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.resolvingText}>Finding address...</Text>
                  </View>
                ) : (
                  <Text style={styles.addressText} numberOfLines={2}>
                    {address}
                  </Text>
                )}
                <Text style={styles.coordsText}>
                  {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E
                </Text>
              </View>
            </View>
          </Card>

          <View style={styles.footer}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              label="Confirm Location"
              icon="check"
              variant="primary"
              onPress={handleConfirm}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.md,
    gap: 12,
    maxHeight: '90%',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.secondary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  permissionAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  permissionAlertText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    fontWeight: '500',
  },
  mapWrapper: {
    position: 'relative',
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  gpsFab: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.full,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  gpsFabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  addressCard: {
    padding: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
    marginTop: 2,
  },
  resolvingText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  coordsText: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 16 : 4,
  },
});
