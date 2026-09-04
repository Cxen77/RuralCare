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
import { reverseGeocode, DEFAULT_LOCATION } from '../../services/location/locationUtils';

import * as ExpoLocation from 'expo-location';
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
  onOpenMap?: () => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  visible,
  title = 'Select Location',
  initialLocation,
  onClose,
  onLocationConfirmed,
  onOpenMap,
}) => {
  if (!visible) return null;

  const [latitude, setLatitude] = useState<number>(initialLocation?.latitude || DEFAULT_LOCATION.latitude);
  const [longitude, setLongitude] = useState<number>(initialLocation?.longitude || DEFAULT_LOCATION.longitude);
  const [address, setAddress] = useState<string>(initialLocation?.address || DEFAULT_LOCATION.address);
  const [loadingGps, setLoadingGps] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  const [focusNonce, setFocusNonce] = useState(0);

  // Strict separation of initialization
  const isInitializedRef = useRef(false);
  const gpsSelectionInProgressRef = useRef(false);
  const locationRequestIdRef = useRef(0);

  // useEffect moved below handleUseMyLocation

  const timerRef = React.useRef<NodeJS.Timeout>();

  const debouncedHandleLocationChange = useCallback(
    (newLat: number, newLng: number) => {
      // Ignore map dragging events if we are explicitly running GPS logic
      if (gpsSelectionInProgressRef.current) return;

      console.log('[LOCATION] REGION CHANGE', { lat: newLat, lng: newLng });
      setLatitude(newLat);
      setLongitude(newLng);

      const requestId = ++locationRequestIdRef.current;
      clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        setResolvingAddress(true);
        try {
          const addr = await reverseGeocode(newLat, newLng);
          if (requestId === locationRequestIdRef.current) {
            console.log('[LOCATION] ADDRESS RESULT', addr);
            setAddress(addr);
          }
        } catch {
          if (requestId === locationRequestIdRef.current) {
            setAddress(`Lat: ${newLat.toFixed(4)}, Lon: ${newLng.toFixed(4)}`);
          }
        } finally {
          if (requestId === locationRequestIdRef.current) {
            setResolvingAddress(false);
          }
        }
      }, 500);
    },
    []
  );

  const handleUseMyLocation = async () => {
    if (loadingGps) return; // Prevent duplicate requests
    setLoadingGps(true);
    setPermissionNotice(null);

    const requestId = ++locationRequestIdRef.current;
    gpsSelectionInProgressRef.current = true;

    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionNotice('Location permission is off. You can still choose your location manually.');
        setLoadingGps(false);
        gpsSelectionInProgressRef.current = false;
        return;
      }

      let currentLocation = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      }).catch(() => null);

      if (!currentLocation) {
        currentLocation = await ExpoLocation.getLastKnownPositionAsync().catch(() => null);
      }

      if (currentLocation?.coords) {
        const { latitude: curLat, longitude: curLng } = currentLocation.coords;
        console.log('[LOCATION] GPS RESULT', { curLat, curLng });

        // Update selectedLocation exactly once
        setLatitude(curLat);
        setLongitude(curLng);
        
        // Move MapLibre camera exactly once
        setFocusNonce(prev => prev + 1);

        setResolvingAddress(true);
        const resolvedAddr = await reverseGeocode(curLat, curLng);
        
        if (requestId === locationRequestIdRef.current) {
          console.log('[LOCATION] GPS ADDRESS RESULT', resolvedAddr);
          setAddress(resolvedAddr);
          setResolvingAddress(false);
        }
        
        setLoadingGps(false);
        gpsSelectionInProgressRef.current = false;
        return;
      }

      setPermissionNotice('Could not get GPS signal. Please try again or choose manually.');
    } catch (err: any) {
      setPermissionNotice('Failed to access location. Please check your device settings.');
    } finally {
      if (requestId === locationRequestIdRef.current) {
        setLoadingGps(false);
        gpsSelectionInProgressRef.current = false;
      }
    }
  };

  useEffect(() => {
    if (visible) {
      if (!isInitializedRef.current) {
        const hasValidLocation = initialLocation?.latitude && initialLocation.latitude !== 0;
        const lat = hasValidLocation ? initialLocation.latitude : DEFAULT_LOCATION.latitude;
        const lng = hasValidLocation ? initialLocation.longitude : DEFAULT_LOCATION.longitude;
        
        setLatitude(lat as number);
        setLongitude(lng as number);
        setAddress(initialLocation?.address || DEFAULT_LOCATION.address);
        setPermissionNotice(null);
        isInitializedRef.current = true;
        
        if (!hasValidLocation) {
          // Immediately try to get live location if falling back to default
          handleUseMyLocation();
        }
      }
    } else {
      isInitializedRef.current = false; // Reset when closed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialLocation]);

  const handleConfirm = () => {
    onLocationConfirmed({
      latitude,
      longitude,
      address,
      updatedAt: new Date().toISOString(),
    });
    isInitializedRef.current = false;
    onClose();
  };

  const handleClose = () => {
    isInitializedRef.current = false;
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <MaterialIcons name="location-on" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Your Location</Text>
                <Text style={styles.subtitle}>Drag pin or tap map to adjust</Text>
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
              zoom={16}
              draggableMarker
              onLocationSelected={debouncedHandleLocationChange}
              focusNonce={focusNonce}
              height={280}
              borderRadius={Radii.lg}
            />

            <TouchableOpacity
              style={styles.gpsFab}
              onPress={handleUseMyLocation}
              disabled={loadingGps}
              activeOpacity={0.85}
              accessibilityLabel="Use My Current GPS Location"
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
                <Text style={styles.addressLabel}>SELECTED LOCATION</Text>
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
              style={{ flex: 1, marginRight: Spacing.sm }}
            />
            <Button
              label="Confirm Location"
              icon="check"
              variant="primary"
              onPress={handleConfirm}
              style={{ flex: 1.5 }}
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
    backgroundColor: Colors.primaryLight,
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
