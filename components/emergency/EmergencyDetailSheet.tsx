import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { calculateDistanceKm, openDirections } from '../../services/location/locationUtils';

export interface EmergencyData {
  id: string;
  _id?: string;
  emergencyType: string;
  description?: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  address?: string;
  reporterName?: string;
  status: 'reported' | 'verified' | 'dispatched' | 'resolved';
  severity?: 'critical' | 'high' | 'moderate';
  assignedHospitalName?: string;
  ambulanceVehicle?: string;
  driverName?: string;
  driverPhone?: string;
  etaMinutes?: number;
  ambulanceStatus?: string;
  createdAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  timeline?: Array<{
    status: string;
    timestamp: string;
    note?: string;
    updatedBy?: string;
  }>;
}

interface Props {
  emergency: EmergencyData | null;
  onClose: () => void;
  userCoords?: { latitude: number; longitude: number } | null;
}

const STATUS_CONFIG = {
  reported: { label: 'Reported', color: '#DC2626', bg: '#FEF2F2', icon: 'campaign' },
  verified: { label: 'Verified by Medic', color: '#EA580C', bg: '#FFF7ED', icon: 'verified' },
  dispatched: { label: 'Ambulance En Route', color: '#2563EB', bg: '#EFF6FF', icon: 'directions-car' },
  resolved: { label: 'Resolved / Handled', color: '#16A34A', bg: '#F0FDF4', icon: 'check-circle' },
};

function formatEmergencyType(type: string): string {
  switch (type) {
    case 'road_accident': return 'Road Accident';
    case 'medical_emergency': return 'Medical Emergency';
    case 'fire': return 'Fire Incident';
    case 'natural_hazard': return 'Natural Hazard';
    default: return 'Emergency Incident';
  }
}

export const EmergencyDetailSheet: React.FC<Props> = ({ emergency, onClose, userCoords }) => {
  if (!emergency) return null;

  const currentStatus = emergency.status || 'reported';
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.reported;

  const distanceKm = userCoords
    ? calculateDistanceKm(userCoords.latitude, userCoords.longitude, emergency.latitude, emergency.longitude)
    : null;

  const handleCallDriver = () => {
    if (emergency.driverPhone) {
      Linking.openURL(`tel:${emergency.driverPhone.replace(/[^0-9+]/g, '')}`);
    }
  };

  const handleDirections = () => {
    openDirections(emergency.latitude, emergency.longitude);
  };

  return (
    <Modal visible={!!emergency} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetCard}>
          {/* Top Grabber */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.color }]}>
                <MaterialIcons name={statusCfg.icon as any} size={14} color={statusCfg.color} />
                <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
                  {statusCfg.label.toUpperCase()}
                </Text>
              </View>
              {distanceKm !== null && (
                <Text style={styles.distLabel}>
                  {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm} km away`}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={22} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Live Photo Banner */}
            <View style={styles.photoWrap}>
              {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
              {/* @ts-ignore */}
              <Image source={{ uri: emergency.imageUrl }} style={styles.photo} />
              <View style={styles.photoOverlay}>
                <Text style={styles.incidentTypeTitle}>
                  {formatEmergencyType(emergency.emergencyType)}
                </Text>
                {emergency.reporterName && (
                  <Text style={styles.reporterSub}>Reported by {emergency.reporterName}</Text>
                )}
              </View>
            </View>

            {/* Address & Navigation Row */}
            <View style={styles.addressBox}>
              <View style={styles.addressIconWrap}>
                <MaterialIcons name="place" size={20} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressTitle}>{emergency.address || 'GPS Coordinate Lock'}</Text>
                <Text style={styles.coordsSub}>
                  {emergency.latitude.toFixed(5)}, {emergency.longitude.toFixed(5)}
                </Text>
              </View>
              <TouchableOpacity style={styles.directionsBtn} onPress={handleDirections} activeOpacity={0.8}>
                <MaterialIcons name="directions" size={16} color="#FFFFFF" />
                <Text style={styles.directionsBtnText}>Directions</Text>
              </TouchableOpacity>
            </View>

            {/* Incident Description */}
            {emergency.description ? (
              <View style={styles.infoCard}>
                <Text style={styles.cardLabel}>Incident Details</Text>
                <Text style={styles.descText}>{emergency.description}</Text>
              </View>
            ) : null}

            {/* Responding Ambulance & Hospital Card (If Dispatched) */}
            {emergency.assignedHospitalName || emergency.ambulanceVehicle ? (
              <View style={styles.dispatchCard}>
                <View style={styles.dispatchHead}>
                  <View style={styles.ambulanceIconWrap}>
                    <MaterialIcons name="emergency" size={18} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dispatchTitle}>Emergency Response Dispatched</Text>
                    <Text style={styles.dispatchHospital}>{emergency.assignedHospitalName}</Text>
                  </View>
                  {emergency.etaMinutes ? (
                    <View style={styles.etaPill}>
                      <Text style={styles.etaPillText}>ETA ~{emergency.etaMinutes}m</Text>
                    </View>
                  ) : null}
                </View>

                {emergency.ambulanceVehicle ? (
                  <View style={styles.vehicleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vehicleNum}>Ambulance: {emergency.ambulanceVehicle}</Text>
                      {emergency.driverName ? (
                        <Text style={styles.driverName}>Driver: {emergency.driverName}</Text>
                      ) : null}
                    </View>
                    {emergency.driverPhone ? (
                      <TouchableOpacity style={styles.callDriverBtn} onPress={handleCallDriver} activeOpacity={0.8}>
                        <MaterialIcons name="phone" size={16} color="#FFFFFF" />
                        <Text style={styles.callDriverBtnText}>Call Driver</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.pendingDispatchCard}>
                <MaterialIcons name="hourglass-top" size={20} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingTitle}>Awaiting Hospital Dispatch</Text>
                  <Text style={styles.pendingSub}>
                    Nearby district trauma units and medical staff have been alerted via real-time network.
                  </Text>
                </View>
              </View>
            )}

            {/* Timeline Progress */}
            {emergency.timeline && emergency.timeline.length > 0 ? (
              <View style={styles.timelineCard}>
                <Text style={styles.cardLabel}>Incident Timeline</Text>
                <View style={styles.timelineList}>
                  {emergency.timeline.map((t, index) => (
                    <View key={index} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineStatus}>
                          {t.status.toUpperCase()} • {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {t.note ? <Text style={styles.timelineNote}>{t.note}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>Close View</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  distLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  scroll: {
    maxHeight: 560,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  photoWrap: {
    width: '100%',
    height: 220,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
    ...Shadows.sm,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  incidentTypeTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  reporterSub: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '500',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.md,
    padding: 12,
  },
  addressIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  coordsSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.sm,
    ...Shadows.sm,
  },
  directionsBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.md,
    padding: 14,
    gap: 6,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
  },
  dispatchCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: Radii.md,
    padding: 14,
    gap: 12,
  },
  dispatchHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ambulanceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
  },
  dispatchHospital: {
    fontSize: 11.5,
    color: '#3B82F6',
    fontWeight: '600',
    marginTop: 1,
  },
  etaPill: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  etaPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  vehicleNum: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  driverName: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  callDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  callDriverBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  pendingDispatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: Radii.md,
    padding: 14,
  },
  pendingTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#B45309',
  },
  pendingSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 15,
  },
  timelineCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.md,
    padding: 14,
    gap: 10,
  },
  timelineList: {
    gap: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  timelineStatus: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  timelineNote: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
});
