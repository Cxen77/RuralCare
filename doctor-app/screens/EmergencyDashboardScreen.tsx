import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { io } from 'socket.io-client/dist/socket.io.js';
import { Colors, Radii, Spacing, Shadows } from '../constants/theme';
import { api } from '../services/api';

export interface IncidentReport {
  id: string;
  _id?: string;
  emergencyType: string;
  description?: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  address?: string;
  reporterName?: string;
  reporterPhone?: string;
  status: 'reported' | 'verified' | 'dispatched' | 'resolved';
  severity?: 'critical' | 'high' | 'moderate';
  assignedHospitalName?: string;
  ambulanceVehicle?: string;
  driverName?: string;
  driverPhone?: string;
  etaMinutes?: number;
  ambulanceStatus?: string;
  createdAt?: string;
  timeline?: Array<{
    status: string;
    timestamp: string;
    note?: string;
    updatedBy?: string;
  }>;
}

const SEVERITY_COLORS = {
  critical: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  high: { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  moderate: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
};

export const EmergencyDashboardScreen: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'reported' | 'verified' | 'dispatched' | 'resolved'>('all');

  // Dispatch Modal State
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('UP-53-AMB-108');
  const [hospitalName, setHospitalName] = useState('District Hospital Trauma Wing');
  const [driverName, setDriverName] = useState('Mohan Lal');
  const [driverPhone, setDriverPhone] = useState('+91 94151 99882');
  const [etaMinutes, setEtaMinutes] = useState('10');
  const [actionLoading, setActionLoading] = useState(false);

  // Photo Zoom Modal State
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Fetch initial incidents
  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const res = await api.get<IncidentReport[]>('/emergencies');
      if (Array.isArray(res)) {
        setIncidents(res);
      }
    } catch (err: any) {
      console.warn('[DoctorApp] Failed to load emergencies:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();

    // Connect to real-time Socket.IO
    const API_URL = 'http://localhost:4000';
    const socket = io(API_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join', { role: 'doctor' });
    });

    socket.on('emergency:created', (newIncident: IncidentReport) => {
      setIncidents((prev) => [newIncident, ...prev.filter((i) => (i.id || i._id) !== (newIncident.id || newIncident._id))]);
    });

    socket.on('emergency:alert', (payload: any) => {
      if (payload?.emergency) {
        setIncidents((prev) => [payload.emergency, ...prev.filter((i) => (i.id || i._id) !== (payload.emergency.id || payload.emergency._id))]);
      }
    });

    socket.on('emergency:updated', (updated: IncidentReport) => {
      setIncidents((prev) => prev.map((i) => ((i.id || i._id) === (updated.id || updated._id) ? updated : i)));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleVerify = async (incident: IncidentReport) => {
    try {
      setActionLoading(true);
      const incId = incident.id || incident._id;
      await api.patch(`/emergencies/${incId}/status`, {
        status: 'verified',
        note: 'Physician verified incident details and validated emergency triage level.',
      });
      Alert.alert('Incident Verified', 'The emergency incident has been marked as verified on the Care Map.');
      fetchIncidents();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to verify incident.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDispatch = (incident: IncidentReport) => {
    setSelectedIncident(incident);
    setDispatchModalVisible(true);
  };

  const handleConfirmDispatch = async () => {
    if (!selectedIncident) return;
    try {
      setActionLoading(true);
      const incId = selectedIncident.id || selectedIncident._id;
      await api.post(`/emergencies/${incId}/dispatch`, {
        hospitalName,
        vehicleNumber,
        driverName,
        driverPhone,
        etaMinutes: parseInt(etaMinutes, 10) || 10,
      });

      Alert.alert(
        'Ambulance Dispatched',
        `Ambulance ${vehicleNumber} dispatched to the scene. Care Map status updated to Dispatched.`
      );
      setDispatchModalVisible(false);
      fetchIncidents();
    } catch (err: any) {
      Alert.alert('Dispatch Error', err.message || 'Failed to dispatch ambulance.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkArrived = async (incident: IncidentReport) => {
    try {
      setActionLoading(true);
      const incId = incident.id || incident._id;
      await api.patch(`/emergencies/${incId}/status`, {
        status: 'arrived',
        note: 'Emergency response medical team has arrived at the location.',
      });
      Alert.alert('Status Updated', 'Ambulance team marked as arrived at the scene.');
      fetchIncidents();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (incident: IncidentReport) => {
    Alert.prompt
      ? Alert.prompt(
          'Resolve Incident',
          'Add a brief resolution note for medical records:',
          async (notes) => {
            try {
              setActionLoading(true);
              const incId = incident.id || incident._id;
              await api.post(`/emergencies/${incId}/resolve`, {
                resolutionNotes: notes || 'Patient stabilized and incident cleared.',
              });
              fetchIncidents();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setActionLoading(false);
            }
          }
        )
      : (async () => {
          try {
            setActionLoading(true);
            const incId = incident.id || incident._id;
            await api.post(`/emergencies/${incId}/resolve`, {
              resolutionNotes: 'Patient safely stabilized and transported to emergency ward.',
            });
            Alert.alert('Incident Resolved', 'Emergency marked as resolved on Care Map and ambulance returned to available.');
            fetchIncidents();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setActionLoading(false);
          }
        })();
  };

  const openDirections = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  };

  // KPIs
  const criticalCount = incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length;
  const activeCount = incidents.filter((i) => i.status !== 'resolved').length;
  const dispatchedCount = incidents.filter((i) => i.status === 'dispatched').length;

  const filteredIncidents = incidents.filter((i) => {
    if (statusFilter === 'all') return true;
    return i.status === statusFilter;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Emergency KPI Strip */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
          <Text style={[styles.kpiValue, { color: '#DC2626' }]}>{criticalCount}</Text>
          <Text style={[styles.kpiLabel, { color: '#991B1B' }]}>Critical Alerts</Text>
        </View>

        <View style={[styles.kpiCard, { borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }]}>
          <Text style={[styles.kpiValue, { color: '#EA580C' }]}>{activeCount}</Text>
          <Text style={[styles.kpiLabel, { color: '#9A3412' }]}>Active Emergencies</Text>
        </View>

        <View style={[styles.kpiCard, { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}>
          <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{dispatchedCount}</Text>
          <Text style={[styles.kpiLabel, { color: '#1E40AF' }]}>Ambulances Dispatched</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {(['all', 'reported', 'verified', 'dispatched', 'resolved'] as const).map((tab) => {
            const isSelected = statusFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterTab, isSelected && styles.filterTabActive]}
                onPress={() => setStatusFilter(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterTabText, isSelected && styles.filterTabTextActive]}>
                  {tab === 'all' ? 'All Incidents' : tab.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List of Incidents */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerText}>Loading real-time incidents...</Text>
        </View>
      ) : filteredIncidents.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialIcons name="check-circle" size={48} color="#059669" />
          <Text style={styles.emptyTitle}>No Incidents Reported</Text>
          <Text style={styles.emptySub}>
            Care Map monitoring is active. You will be alerted immediately if a citizen reports an emergency.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filteredIncidents.map((incident) => {
            const sev = SEVERITY_COLORS[incident.severity || 'high'] || SEVERITY_COLORS.high;
            const incId = incident.id || incident._id;
            return (
              <View key={incId} style={styles.incidentCard}>
                {/* Header: Type, Severity, Time */}
                <View style={styles.incidentHead}>
                  <View style={styles.incidentTypeWrap}>
                    <MaterialIcons name="emergency" size={18} color="#DC2626" />
                    <Text style={styles.incidentTypeName}>
                      {incident.emergencyType.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>

                  <View style={[styles.sevBadge, { backgroundColor: sev.bg, borderColor: sev.border }]}>
                    <Text style={[styles.sevBadgeText, { color: sev.text }]}>
                      {(incident.severity || 'high').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Main Content: Photo Thumbnail + Details */}
                <View style={styles.incidentBody}>
                  {incident.imageUrl ? (
                    <TouchableOpacity
                      onPress={() => setZoomedImage(incident.imageUrl)}
                      activeOpacity={0.85}
                      style={styles.thumbWrap}
                    >
                      {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                      {/* @ts-ignore */}
                      <Image source={{ uri: incident.imageUrl }} style={styles.thumb} />
                      <View style={styles.zoomPill}>
                        <MaterialIcons name="zoom-in" size={14} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ) : null}

                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.incidentAddress} numberOfLines={2}>
                      📍 {incident.address || `${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`}
                    </Text>

                    {incident.description ? (
                      <Text style={styles.incidentDesc} numberOfLines={3}>
                        "{incident.description}"
                      </Text>
                    ) : null}

                    <Text style={styles.incidentReporter}>
                      Reported by {incident.reporterName || 'Citizen'} • {incident.createdAt ? new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                    </Text>
                  </View>
                </View>

                {/* Dispatched Info Banner (if dispatched) */}
                {incident.assignedHospitalName || incident.ambulanceVehicle ? (
                  <View style={styles.dispatchBanner}>
                    <MaterialIcons name="directions-car" size={16} color="#2563EB" />
                    <Text style={styles.dispatchBannerText}>
                      Dispatched: {incident.ambulanceVehicle || 'Ambulance'} ({incident.assignedHospitalName})
                      {incident.etaMinutes ? ` • ETA ~${incident.etaMinutes}m` : ''}
                    </Text>
                  </View>
                ) : null}

                {/* Status and Action Buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.mapBtn}
                    onPress={() => openDirections(incident.latitude, incident.longitude)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="directions" size={16} color={Colors.primary} />
                    <Text style={styles.mapBtnText}>Directions</Text>
                  </TouchableOpacity>

                  {incident.status === 'reported' && (
                    <TouchableOpacity
                      style={styles.verifyBtn}
                      onPress={() => handleVerify(incident)}
                      disabled={actionLoading}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="verified" size={16} color="#EA580C" />
                      <Text style={styles.verifyBtnText}>Verify</Text>
                    </TouchableOpacity>
                  )}

                  {(incident.status === 'reported' || incident.status === 'verified') && (
                    <TouchableOpacity
                      style={styles.dispatchBtn}
                      onPress={() => handleOpenDispatch(incident)}
                      disabled={actionLoading}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.dispatchBtnText}>Dispatch Ambulance</Text>
                    </TouchableOpacity>
                  )}

                  {incident.status === 'dispatched' && (
                    <>
                      <TouchableOpacity
                        style={styles.arrivedBtn}
                        onPress={() => handleMarkArrived(incident)}
                        disabled={actionLoading}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="location-on" size={16} color="#059669" />
                        <Text style={styles.arrivedBtnText}>Mark Arrived</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.resolveBtn}
                        onPress={() => handleResolve(incident)}
                        disabled={actionLoading}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                        <Text style={styles.resolveBtnText}>Resolve</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {incident.status === 'resolved' && (
                    <View style={styles.resolvedBadge}>
                      <MaterialIcons name="check-circle" size={16} color="#059669" />
                      <Text style={styles.resolvedBadgeText}>Resolved</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Dispatch Ambulance Modal */}
      <Modal visible={dispatchModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.dispatchModalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="emergency" size={22} color="#2563EB" />
                <Text style={styles.modalTitle}>Dispatch Emergency Ambulance</Text>
              </View>
              <TouchableOpacity onPress={() => setDispatchModalVisible(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 12, padding: 16 }}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Hospital Emergency Wing</Text>
                <TextInput
                  style={styles.input}
                  value={hospitalName}
                  onChangeText={setHospitalName}
                  placeholder="e.g. Gorakhpur District Hospital"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Ambulance Vehicle Registration</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  placeholder="e.g. UP-53-AMB-108"
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Driver Name</Text>
                  <TextInput
                    style={styles.input}
                    value={driverName}
                    onChangeText={setDriverName}
                    placeholder="Driver Name"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Driver Phone</Text>
                  <TextInput
                    style={styles.input}
                    value={driverPhone}
                    onChangeText={setDriverPhone}
                    placeholder="+91..."
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Estimated Time of Arrival (Minutes)</Text>
                <TextInput
                  style={styles.input}
                  value={etaMinutes}
                  onChangeText={setEtaMinutes}
                  keyboardType="numeric"
                  placeholder="e.g. 10"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.confirmDispatchBtn}
                onPress={handleConfirmDispatch}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmDispatchBtnText}>Authorize & Dispatch Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Zoom Modal */}
      <Modal visible={!!zoomedImage} transparent animationType="fade">
        <View style={styles.zoomOverlay}>
          <TouchableOpacity style={styles.closeZoomBtn} onPress={() => setZoomedImage(null)}>
            <MaterialIcons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {zoomedImage && (
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            <Image source={{ uri: zoomedImage }} style={styles.fullImage} />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: Spacing.md,
    gap: 14,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  tabScrollWrap: {
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  tabScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  centerText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  list: {
    gap: 12,
  },
  incidentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    ...Shadows.sm,
  },
  incidentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  incidentTypeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  incidentTypeName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  sevBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  incidentBody: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbWrap: {
    width: 90,
    height: 75,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  zoomPill: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 2,
    borderRadius: 4,
  },
  incidentAddress: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  incidentDesc: {
    fontSize: 11.5,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  incidentReporter: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  dispatchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dispatchBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E40AF',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  mapBtnText: {
    color: Colors.primary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  verifyBtnText: {
    color: '#EA580C',
    fontSize: 11.5,
    fontWeight: '700',
  },
  dispatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#2563EB',
    ...Shadows.sm,
  },
  dispatchBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  arrivedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  arrivedBtnText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '700',
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#16A34A',
    ...Shadows.sm,
  },
  resolveBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#ECFDF5',
  },
  resolvedBadgeText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  dispatchModalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  formGroup: {
    gap: 4,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#0F172A',
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  confirmDispatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: Radii.md,
    ...Shadows.sm,
  },
  confirmDispatchBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  closeZoomBtn: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 10,
  },
  fullImage: {
    width: '100%',
    height: '80%',
    resizeMode: 'contain',
  },
});
