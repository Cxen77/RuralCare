import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { calculateDistanceKm } from '../../services/location/locationUtils';
import { EmergencyData } from './EmergencyDetailSheet';

interface Props {
  emergency: EmergencyData | null;
  userCoords?: { latitude: number; longitude: number } | null;
  onPress: (emergency: EmergencyData) => void;
  onDismiss: () => void;
}

export const CommunityNotificationToast: React.FC<Props> = ({
  emergency,
  userCoords,
  onPress,
  onDismiss,
}) => {
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    if (emergency) {
      Animated.spring(slideAnim, {
        toValue: 16,
        useNativeDriver: true,
        bounciness: 6,
      }).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [emergency]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  if (!emergency) return null;

  const distKm = userCoords
    ? calculateDistanceKm(userCoords.latitude, userCoords.longitude, emergency.latitude, emergency.longitude)
    : null;

  const distText = distKm !== null
    ? (distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm} km`)
    : null;

  const typeName = emergency.emergencyType.replace(/_/g, ' ').toUpperCase();

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          handleDismiss();
          onPress(emergency);
        }}
        activeOpacity={0.9}
      >
        <View style={styles.iconWrap}>
          <MaterialIcons name="campaign" size={22} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>🚨 {typeName} REPORTED</Text>
            {distText ? (
              <Text style={styles.distPill}>• {distText} away</Text>
            ) : null}
          </View>
          <Text style={styles.addressSub} numberOfLines={1}>
            {emergency.address || 'Tap to view live on Care Map'}
          </Text>
        </View>

        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="close" size={18} color="#CBD5E1" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F172A',
    borderRadius: Radii.lg,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    ...Shadows.lg,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  distPill: {
    color: '#F87171',
    fontSize: 11.5,
    fontWeight: '700',
  },
  addressSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
});
