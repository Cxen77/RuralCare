import React, { useEffect, useState, useCallback } from 'react';
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
  if (!visible) return null;

  const defaultLat = initialLocation?.latitude && initialLocation.latitude !== 0 ? initialLocation.latitude : 25.9856;
  const defaultLng = initialLocation?.longitude && initialLocation.longitude !== 0 ? initialLocation.longitude : 85.2281;

  const [latitude, setLatitude] = useState<number>(defaultLat);
  const [longitude, setLongitude] = useState<number>(defaultLng);
  const [address, setAddress] = useState<string>(initialLocation?.address || 'Main Road, Ramnagar, Vaishali, Bihar');
  const [loadingGps, setLoadingGps] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const lat = initialLocation?.latitude && initialLocation.latitude !== 0 ? initialLocation.latitude : 25.9856;
      const lng = initialLocation?.longitude && initialLocation.longitude !== 0 ? initialLocation.longitude : 85.2281;
      setLatitude(lat);
      setLongitude(lng);
      setAddress(initialLocation?.address || 'Main Road, Ramnagar, Vaishali, Bihar');
      setPermissionNotice(null);
    }
  }, [visible, initialLocation]);

  const handleLocationChange = useCallback(async (newLat: number, newLng: number) => {
    setLatitude(newLat);
    setLongitude(newLng);
    setResolvingAddress(true);
    try {
      const addr = await reverseGeocode(newLat, newLng);
      setAddress(addr);
    } catch {
      setAddress(`Lat: ${newLat.toFixed(4)}, Lon: ${newLng.toFixed(4)}`);
    } finally {
      setResolvingAddress(false);
    }
  }, []);

  const handleUseMyLocation = async () => {
    setLoadingGps(true);
    setPermissionNotice(null);

    try {
      if (ExpoLocation && ExpoLocation.requestForegroundPermissionsAsync) {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermissionNotice('Location permission is off. You can still choose your location manually.');
          setLoadingGps(false);
          return;
        }

        const currentLocation = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy ? ExpoLocation.Accuracy.Balanced : 3,
        });

        if (currentLocation?.coords) {
          const { latitude: curLat, longitude: curLng } = currentLocation.coords;
          setLatitude(curLat);
          setLongitude(curLng);
          setResolvingAddress(true);
          const resolvedAddr = await reverseGeocode(curLat, curLng);
          setAddress(resolvedAddr);
          setResolvingAddress(false);
          setLoadingGps(false);
          return;
        }
      }

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const curLat = position.coords.latitude;
            const curLng = position.coords.longitude;
            setLatitude(curLat);
            setLongitude(curLng);
            setResolvingAddress(true);
            const resolvedAddr = await reverseGeocode(curLat, curLng);
            setAddress(resolvedAddr);
            setResolvingAddress(false);
            setLoadingGps(false);
          },
          () => {
            setPermissionNotice('Location permission is off. You can still choose your location manually.');
            setLoadingGps(false);
          },
          { enableHighAccuracy: false, timeout: 5000 }
        );
        return;
      }

      setPermissionNotice('Location permission is off. You can still choose your location manually.');
    } catch (err: any) {
      setPermissionNotice('Location permission is off. You can still choose your location manually.');
    } finally {
      setLoadingGps(false);
    }
  };

  const handleConfirm = () => {
    onLocationConfirmed({
      latitude,
      longitude,
      address,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
            <IconButton icon="close" size="sm" variant="plain" onPress={onClose} />
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
              onLocationSelected={handleLocationChange}
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
