/**
 * Edit Doctor Profile Modal
 * Comprehensive profile and clinic details editor for Doctors
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { Button, Chip } from './ui';

export interface DoctorProfileData {
  name: string;
  degrees: string;
  specialty?: string;
  facility: string;
  clinicAddress?: string;
  hprId: string;
  phone?: string;
  languages: string[];
  consultationFee?: number;
  maxPatientsPerDay?: number;
  ayushmanPaneled?: boolean;
  teleconsultation?: boolean;
}

interface Props {
  visible: boolean;
  doctor: DoctorProfileData;
  onClose: () => void;
  onSave: (updated: DoctorProfileData) => void;
}

export const EditDoctorProfileModal: React.FC<Props> = ({
  visible,
  doctor,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(doctor.name);
  const [degrees, setDegrees] = useState(doctor.degrees);
  const [specialty, setSpecialty] = useState(doctor.specialty || 'General Medicine');
  const [facility, setFacility] = useState(doctor.facility);
  const [clinicAddress, setClinicAddress] = useState(doctor.clinicAddress || 'Main Road, Ramnagar, Vaishali, Bihar');
  const [hprId, setHprId] = useState(doctor.hprId);
  const [phone, setPhone] = useState(doctor.phone || '+91-9431-XXXXXX');
  const [languages, setLanguages] = useState<string[]>(doctor.languages);
  const [fee, setFee] = useState((doctor.consultationFee ?? 0).toString());
  const [maxPatients, setMaxPatients] = useState((doctor.maxPatientsPerDay ?? 40).toString());
  const [ayushmanPaneled, setAyushmanPaneled] = useState(doctor.ayushmanPaneled ?? true);
  const [teleconsultation, setTeleconsultation] = useState(doctor.teleconsultation ?? true);

  useEffect(() => {
    if (visible) {
      setName(doctor.name);
      setDegrees(doctor.degrees);
      setSpecialty(doctor.specialty || 'General Medicine');
      setFacility(doctor.facility);
      setClinicAddress(doctor.clinicAddress || 'Main Road, Ramnagar, Vaishali, Bihar');
      setHprId(doctor.hprId);
      setPhone(doctor.phone || '+91-9431-XXXXXX');
      setLanguages([...doctor.languages]);
      setFee((doctor.consultationFee ?? 0).toString());
      setMaxPatients((doctor.maxPatientsPerDay ?? 40).toString());
      setAyushmanPaneled(doctor.ayushmanPaneled ?? true);
      setTeleconsultation(doctor.teleconsultation ?? true);
    }
  }, [visible, doctor]);

  const allLanguages = ['English', 'Hindi', 'Bhojpuri', 'Bengali', 'Maithili', 'Urdu'];
  const specialtyOptions = [
    'General Medicine',
    'Pediatrics',
    'Cardiology',
    'Orthopedics',
    'Obstetrics & Gynecology',
    'Dermatology',
    'Ophthalmology',
    'ENT',
  ];

  const handleToggleLang = (lang: string) => {
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter your full name.');
      return;
    }

    onSave({
      name: name.trim(),
      degrees: degrees.trim(),
      specialty: specialty.trim(),
      facility: facility.trim(),
      clinicAddress: clinicAddress.trim(),
      hprId: hprId.trim(),
      phone: phone.trim(),
      languages: languages.length > 0 ? languages : ['Hindi', 'English'],
      consultationFee: parseInt(fee) || 0,
      maxPatientsPerDay: parseInt(maxPatients) || 40,
      ayushmanPaneled,
      teleconsultation,
    });

    Alert.alert('Profile Updated', 'Doctor credentials and clinic details have been saved.');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Edit Doctor Profile</Text>
              <Text style={styles.subtitle}>Healthcare Professional Registry (HPR)</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Doctor Credentials */}
            <Text style={styles.sectionHeading}>Professional Credentials</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Dr. Anita Sharma"
                placeholderTextColor={Colors.outline}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Qualifications / Degrees</Text>
              <TextInput
                style={styles.input}
                value={degrees}
                onChangeText={setDegrees}
                placeholder="MBBS, MD (General Medicine)"
                placeholderTextColor={Colors.outline}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Primary Specialization</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {specialtyOptions.map(sp => (
                  <TouchableOpacity
                    key={sp}
                    style={[styles.spChip, specialty === sp && styles.spChipActive]}
                    onPress={() => setSpecialty(sp)}
                  >
                    <Text style={[styles.spChipText, specialty === sp && styles.spChipTextActive]}>{sp}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>HPR / MCI Reg Number</Text>
                <TextInput
                  style={styles.input}
                  value={hprId}
                  onChangeText={setHprId}
                  placeholder="78-4512-9032-8871"
                  placeholderTextColor={Colors.outline}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Contact Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+91-9431-XXXXXX"
                  placeholderTextColor={Colors.outline}
                />
              </View>
            </View>

            {/* Clinic & Facility */}
            <Text style={styles.sectionHeading}>Facility & Clinic Details</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Affiliated Health Facility / PHC</Text>
              <TextInput
                style={styles.input}
                value={facility}
                onChangeText={setFacility}
                placeholder="Ramnagar PHC"
                placeholderTextColor={Colors.outline}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Clinic Address</Text>
              <TextInput
                style={styles.input}
                value={clinicAddress}
                onChangeText={setClinicAddress}
                placeholder="Main Road, Ramnagar, Vaishali, Bihar"
                placeholderTextColor={Colors.outline}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Consultation Fee (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={fee}
                  onChangeText={setFee}
                  placeholder="0 (Free under Ayushman)"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.outline}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Max Patients / Day</Text>
                <TextInput
                  style={styles.input}
                  value={maxPatients}
                  onChangeText={setMaxPatients}
                  placeholder="40"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.outline}
                />
              </View>
            </View>

            {/* Consultation Languages */}
            <Text style={styles.sectionHeading}>Consultation Languages</Text>
            <View style={styles.langGrid}>
              {allLanguages.map(lang => (
                <Chip
                  key={lang}
                  label={lang}
                  selected={languages.includes(lang)}
                  onPress={() => handleToggleLang(lang)}
                />
              ))}
            </View>

            {/* Scheme & Teleconsultation Toggles */}
            <Text style={styles.sectionHeading}>Panels & Teleconsultation</Text>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setAyushmanPaneled(!ayushmanPaneled)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkCircle, ayushmanPaneled && styles.checkCircleActive]}>
                {ayushmanPaneled && <MaterialIcons name="check" size={16} color={Colors.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Ayushman Bharat PM-JAY Paneled</Text>
                <Text style={styles.toggleSub}>Provide ₹0 cashless consultations to Ayushman cardholders</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setTeleconsultation(!teleconsultation)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkCircle, teleconsultation && styles.checkCircleActive]}>
                {teleconsultation && <MaterialIcons name="check" size={16} color={Colors.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Enable Teleconsultations (Video/Audio)</Text>
                <Text style={styles.toggleSub}>Accept remote patient triage calls from sub-centers</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Button label="Save Changes" icon="save" block onPress={handleSave} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="outline" block onPress={onClose} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 28, 36, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '90%',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.secondary,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: 14,
    paddingBottom: 24,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    backgroundColor: Colors.surfaceContainerLow,
    color: Colors.onSurface,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  spChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  spChipActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  spChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  spChipTextActive: {
    color: Colors.white,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: Colors.tertiary,
    borderColor: Colors.tertiary,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  toggleSub: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    lineHeight: 15,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineLight,
    backgroundColor: Colors.surfaceContainerLowest,
  },
});
