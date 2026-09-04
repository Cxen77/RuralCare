/**
 * Edit Patient Profile Modal
 * Comprehensive profile editor for rural healthcare patients
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
import { useCarePlatform } from '../context/CarePlatformContext';
import { Button, Chip } from './ui';
import type { Patient } from '../types/schema';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const EditPatientProfileModal: React.FC<Props> = ({ visible, onClose }) => {
  const { patient, updatePatientProfile } = useCarePlatform();

  // Form State
  const [name, setName] = useState(patient?.name || '');
  const [age, setAge] = useState((patient?.age ?? 28).toString());
  const [gender, setGender] = useState<Patient['gender']>(patient?.gender || 'female');
  const [phone, setPhone] = useState(patient?.phone || '');
  const [village, setVillage] = useState(patient?.village || '');
  const [district, setDistrict] = useState(patient?.district || '');
  const [state, setState] = useState(patient?.state || '');
  const [address, setAddress] = useState(patient?.address || '');
  const [primaryPHC, setPrimaryPHC] = useState(patient?.primaryPHC || '');
  const [ashaName, setAshaName] = useState(patient?.ashaWorker?.name || '');
  const [ashaPhone, setAshaPhone] = useState(patient?.ashaWorker?.phone || '');
  const [bloodGroup, setBloodGroup] = useState(patient?.bloodGroup || 'B+');
  const [allergies, setAllergies] = useState<string[]>(patient?.allergies || []);
  const [newAllergy, setNewAllergy] = useState('');
  const [chronicConditions, setChronicConditions] = useState<string[]>(patient?.chronicConditions || []);
  const [newCondition, setNewCondition] = useState('');
  const [ayushmanEligible, setAyushmanEligible] = useState(patient?.ayushmanEligible ?? false);

  // Sync state when modal opens
  useEffect(() => {
    if (visible && patient) {
      setName(patient.name || '');
      setAge((patient.age ?? 28).toString());
      setGender(patient.gender || 'female');
      setPhone(patient.phone || '');
      setVillage(patient.village || '');
      setDistrict(patient.district || '');
      setState(patient.state || '');
      setAddress(patient.address || '');
      setPrimaryPHC(patient.primaryPHC || '');
      setAshaName(patient.ashaWorker?.name || '');
      setAshaPhone(patient.ashaWorker?.phone || '');
      setBloodGroup(patient.bloodGroup || 'B+');
      setAllergies([...(patient.allergies || [])]);
      setChronicConditions([...(patient.chronicConditions || [])]);
      setAyushmanEligible(patient.ayushmanEligible ?? false);
    }
  }, [visible, patient]);

  const handleAddAllergy = () => {
    const trimmed = newAllergy.trim();
    if (!trimmed) return;
    if (allergies.includes(trimmed)) return;
    setAllergies(prev => [...prev, trimmed]);
    setNewAllergy('');
  };

  const handleRemoveAllergy = (item: string) => {
    setAllergies(prev => prev.filter(a => a !== item));
  };

  const handleAddCondition = () => {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    if (chronicConditions.includes(trimmed)) return;
    setChronicConditions(prev => [...prev, trimmed]);
    setNewCondition('');
  };

  const handleRemoveCondition = (item: string) => {
    setChronicConditions(prev => prev.filter(c => c !== item));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter your full name.');
      return;
    }

    const parsedAge = parseInt(age) || patient.age;

    try {
      await updatePatientProfile({
        name: name.trim(),
        age: parsedAge,
        gender,
        phone: phone.trim(),
        village: village.trim(),
        district: district.trim(),
        state: state.trim(),
        address: address.trim(),
        primaryPHC: primaryPHC.trim(),
        ashaWorker: {
          name: ashaName.trim(),
          phone: ashaPhone.trim(),
        },
        bloodGroup,
        allergies,
        chronicConditions,
        ayushmanEligible,
      });

      Alert.alert('Profile Updated', 'Your health profile and details have been saved successfully.');
      onClose();
    } catch (e) {
      Alert.alert('Could not update profile', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
  const genderOptions: Patient['gender'][] = ['Male', 'Female', 'Other'];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Edit Patient Profile</Text>
              <Text style={styles.subtitle}>ABHA: {patient.abhaId}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Personal Details */}
            <Text style={styles.sectionHeading}>Personal & Demographics</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Rajesh Kumar"
                placeholderTextColor={Colors.outline}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Age (Years)</Text>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="42"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.outline}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 2 }]}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.genderRow}>
                  {genderOptions.map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderChip, gender === g && styles.genderChipActive]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91-9431-XXXXXX"
                placeholderTextColor={Colors.outline}
              />
            </View>

            {/* Location & Village */}
            <Text style={styles.sectionHeading}>Location & Address</Text>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Village</Text>
                <TextInput
                  style={styles.input}
                  value={village}
                  onChangeText={setVillage}
                  placeholder="Ramnagar"
                  placeholderTextColor={Colors.outline}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>District</Text>
                <TextInput
                  style={styles.input}
                  value={district}
                  onChangeText={setDistrict}
                  placeholder="Vaishali"
                  placeholderTextColor={Colors.outline}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>State & Address</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Ward 3, Near Shiva Temple"
                placeholderTextColor={Colors.outline}
              />
            </View>

            {/* Clinical & Health Details */}
            <Text style={styles.sectionHeading}>Clinical & Health Details</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Blood Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bloodGroupRow}>
                {bloodGroups.map(bg => (
                  <TouchableOpacity
                    key={bg}
                    style={[styles.bloodChip, bloodGroup === bg && styles.bloodChipActive]}
                    onPress={() => setBloodGroup(bg)}
                  >
                    <Text style={[styles.bloodText, bloodGroup === bg && styles.bloodTextActive]}>{bg}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Chronic Conditions */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Chronic Conditions</Text>
              <View style={styles.chipsWrap}>
                {chronicConditions.map((cond, idx) => (
                  <View key={idx} style={styles.activeTag}>
                    <Text style={styles.activeTagText}>{cond}</Text>
                    <TouchableOpacity onPress={() => handleRemoveCondition(cond)}>
                      <MaterialIcons name="cancel" size={16} color={Colors.onSurfaceVariant} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.addInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={newCondition}
                  onChangeText={setNewCondition}
                  placeholder="Add condition (e.g. Hypertension)"
                  placeholderTextColor={Colors.outline}
                  onSubmitEditing={handleAddCondition}
                />
                <TouchableOpacity style={styles.addBtn} onPress={handleAddCondition}>
                  <MaterialIcons name="add" size={20} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Known Allergies */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Known Drug / Food Allergies</Text>
              <View style={styles.chipsWrap}>
                {allergies.map((alg, idx) => (
                  <View key={idx} style={[styles.activeTag, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                    <Text style={[styles.activeTagText, { color: Colors.error }]}>{alg}</Text>
                    <TouchableOpacity onPress={() => handleRemoveAllergy(alg)}>
                      <MaterialIcons name="cancel" size={16} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.addInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={newAllergy}
                  onChangeText={setNewAllergy}
                  placeholder="Add allergy (e.g. Penicillin)"
                  placeholderTextColor={Colors.outline}
                  onSubmitEditing={handleAddAllergy}
                />
                <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.error }]} onPress={handleAddAllergy}>
                  <MaterialIcons name="add" size={20} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Healthcare Network */}
            <Text style={styles.sectionHeading}>Primary Healthcare & ASHA Worker</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Primary PHC / CHC</Text>
              <TextInput
                style={styles.input}
                value={primaryPHC}
                onChangeText={setPrimaryPHC}
                placeholder="Ramnagar PHC"
                placeholderTextColor={Colors.outline}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>ASHA Worker Name</Text>
                <TextInput
                  style={styles.input}
                  value={ashaName}
                  onChangeText={setAshaName}
                  placeholder="Sunita Devi"
                  placeholderTextColor={Colors.outline}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>ASHA Phone</Text>
                <TextInput
                  style={styles.input}
                  value={ashaPhone}
                  onChangeText={setAshaPhone}
                  placeholder="+91-7091-XXXXXX"
                  placeholderTextColor={Colors.outline}
                />
              </View>
            </View>

            {/* Ayushman PM-JAY Status */}
            <TouchableOpacity
              style={styles.ayushmanToggleRow}
              onPress={() => setAyushmanEligible(!ayushmanEligible)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkCircle, ayushmanEligible && styles.checkCircleActive]}>
                {ayushmanEligible && <MaterialIcons name="check" size={16} color={Colors.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ayushmanTitle}>Ayushman Bharat PM-JAY Card Holder</Text>
                <Text style={styles.ayushmanSub}>Eligible for cashless secondary & tertiary hospital treatment up to ₹5 Lakh/year</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* Action Buttons */}
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
  genderRow: {
    flexDirection: 'row',
    gap: 6,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  genderChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  genderTextActive: {
    color: Colors.white,
  },
  bloodGroupRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  bloodChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  bloodChipActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  bloodText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  bloodTextActive: {
    color: Colors.white,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
  },
  activeTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayushmanToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    marginTop: 4,
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
  ayushmanTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  ayushmanSub: {
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
