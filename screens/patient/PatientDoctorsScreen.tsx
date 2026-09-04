/**
 * Patient Doctors Screen
 * Doctor discovery, specialty filtering, live booking via context
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { useCarePlatform } from '../../context/CarePlatformContext';
import { Button, Chip, Card } from '../../components/ui';

interface Props {
  onOpenBooking: (doctorId: string, name: string, specialty: string, clinic: string) => void;
  onOpenDoctorMap?: (doctorId: string, name: string) => void;
}

export const PatientDoctorsScreen: React.FC<Props> = ({ onOpenBooking, onOpenDoctorMap }) => {
  const { doctors, appointments } = useCarePlatform();
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [showAyushmanOnly, setShowAyushmanOnly] = useState(false);

  const specialties = useMemo(() => {
    const set = new Set(doctors.map(d => d.specialty));
    return ['All', ...Array.from(set)];
  }, [doctors]);

  const filtered = useMemo(() => {
    let list = [...doctors];
    if (selectedSpecialty !== 'All') list = list.filter(d => d.specialty === selectedSpecialty);
    if (showAyushmanOnly) list = list.filter(d => d.ayushmanPaneled);
    return list.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [doctors, selectedSpecialty, showAyushmanOnly]);

  const getActiveAppt = (docId: string) => appointments.find(a => a.doctorId === docId && ['confirmed', 'in_consultation'].includes(a.status));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.viewOnMapBtn} onPress={() => onOpenDoctorMap?.(filtered[0]?.id, filtered[0]?.name || '')}>
        <MaterialIcons name="map" size={16} color={Colors.primary} />
        <Text style={styles.viewOnMapText}>View on Map</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>Find Nearby Doctors</Text>
      <Text style={styles.subheading}>{filtered.length} doctors found • Sorted by distance</Text>

      {/* Specialty Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {specialties.map(sp => (
          <TouchableOpacity
            key={sp}
            style={[styles.filterChip, selectedSpecialty === sp && styles.filterChipActive]}
            onPress={() => setSelectedSpecialty(sp)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, selectedSpecialty === sp && styles.filterChipTextActive]}>{sp}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Ayushman Toggle */}
      <TouchableOpacity style={styles.ayushmanToggle} onPress={() => setShowAyushmanOnly(!showAyushmanOnly)} activeOpacity={0.7}>
        <MaterialIcons name={showAyushmanOnly ? 'check-box' : 'check-box-outline-blank'} size={20} color={Colors.primary} />
        <Text style={styles.ayushmanText}>Ayushman PM-JAY (₹0 consultation) only</Text>
      </TouchableOpacity>

      {/* Doctor Cards */}
      {filtered.map(doc => {
        const activeAppt = getActiveAppt(doc.id);
        return (
          <Card key={doc.id} padding={14} radius={Radii.lg} style={styles.docCard}>
            <View style={styles.docHeader}>
              <View style={styles.docAvatar}>
                <MaterialIcons name="person" size={26} color={Colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.docName}>{doc.name}</Text>
                  {doc.isAvailable && <View style={styles.onlineDot} />}
                </View>
                <Text style={styles.docSpecialty}>{doc.specialty} • {doc.qualification}</Text>
                <Text style={styles.docClinic}>{doc.clinicName} ({doc.distanceKm} km)</Text>
              </View>
            </View>

            <View style={styles.docStats}>
              <View style={styles.statBadge}>
                <MaterialIcons name="star" size={14} color="#D97706" />
                <Text style={styles.statText}>{doc.rating}</Text>
                <Text style={styles.statSub}>({doc.reviewCount})</Text>
              </View>
              {doc.ayushmanPaneled && (
                <View style={[styles.statBadge, { backgroundColor: Colors.tertiaryContainer }]}>
                  <Text style={[styles.statText, { color: Colors.tertiary }]}>Ayushman ₹0</Text>
                </View>
              )}
              {doc.teleconsultation && (
                <View style={[styles.statBadge, { backgroundColor: Colors.primaryLight }]}>
                  <MaterialIcons name="videocam" size={12} color={Colors.primary} />
                  <Text style={[styles.statText, { color: Colors.primary }]}>Teleconsult</Text>
                </View>
              )}
              {!doc.isAvailable && (
                <View style={[styles.statBadge, { backgroundColor: Colors.surfaceContainerHigh }]}>
                  <Text style={[styles.statText, { color: Colors.onSurfaceVariant }]}>Unavailable</Text>
                </View>
              )}
            </View>

            {activeAppt ? (
              <View style={styles.activeApptBanner}>
                <MaterialIcons name="event-available" size={16} color={Colors.tertiary} />
                <Text style={styles.activeApptText}>
                  Appointment {activeAppt.status === 'in_consultation' ? 'in progress' : `at ${activeAppt.time}`}
                </Text>
              </View>
            ) : doc.isAvailable ? (
              <Button
                label={`Book with ${(doc.name || 'Doctor').split(' ').slice(0, 2).join(' ')}`}
                icon="event"
                block
                onPress={() => onOpenBooking(doc.id, doc.name, doc.specialty, doc.clinicName)}
              />
            ) : null}
          </Card>
        );
      })}

      {filtered.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="search-off" size={48} color={Colors.outline} />
          <Text style={styles.emptyText}>No doctors match your filters</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, gap: 12, paddingBottom: 24 },
  heading: { fontSize: 20, fontWeight: '800', color: Colors.onSurface },
  viewOnMapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceContainerLowest, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.outlineLight, alignSelf: 'flex-start', marginBottom: 4 },
  viewOnMapText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  subheading: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: -8 },
  filterRow: { gap: 8, paddingVertical: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.full, backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineLight },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.onSurfaceVariant },
  filterChipTextActive: { color: Colors.white },
  ayushmanToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ayushmanText: { fontSize: 12, fontWeight: '600', color: Colors.onSurfaceVariant },
  docCard: { gap: 10 },
  docHeader: { flexDirection: 'row', gap: 12 },
  docAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 15, fontWeight: '700', color: Colors.onSurface },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.tertiary },
  docSpecialty: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 1 },
  docClinic: { fontSize: 11, fontWeight: '600', color: Colors.onSurfaceVariant, marginTop: 2 },
  docStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceContainerLow, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.outlineLight },
  statText: { fontSize: 11, fontWeight: '700', color: Colors.onSurface },
  statSub: { fontSize: 10, color: Colors.onSurfaceVariant },
  activeApptBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.tertiaryContainer, padding: 10, borderRadius: Radii.md },
  activeApptText: { fontSize: 12, fontWeight: '600', color: Colors.onTertiaryContainer },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.outline },
});
