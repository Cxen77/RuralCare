/**
 * Edit Patient Profile Modal
 * Comprehensive profile and demographics editor for RuralCare patients
 * Fixed for both Web and Android production builds (prevents Yoga height collapse)
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
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { useCarePlatform } from '../context/CarePlatformContext';
import { Button } from './ui';
import type { Patient } from '../types/schema';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const { height: screenHeight } = Dimensions.get('window');

export const EditPatientProfileModal: React.FC<Props> = ({ visible, onClose }) => {
  const { patient, updatePatientProfile } = useCarePlatform();

  // Form State
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Patient['gender']>('Female');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [address, setAddress] = useState('');
  const [primaryPHC, setPrimaryPHC] = useState('');
  const [ashaName, setAshaName] = useState('');
  const [ashaPhone, setAshaPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergy, setNewAllergy] = useState('');
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [newCondition, setNewCondition] = useState('');
  const [currentMedications, setCurrentMedications] = useState<string[]>([]);
  const [newMedication, setNewMedication] = useState('');
  const [previousConditions, setPreviousConditions] = useState<string[]>([]);
  const [newPrevCondition, setNewPrevCondition] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [importantNotes, setImportantNotes] = useState('');
  const [ayushmanEligible, setAyushmanEligible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (visible && patient) {
      setName(patient.name || '');
      setAge((patient.age ?? 28).toString());
      setDateOfBirth(patient.dateOfBirth || '');
      setGender(patient.gender || 'Female');
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
      setCurrentMedications([...(patient.currentMedications || [])]);
      setPreviousConditions([...(patient.previousConditions || [])]);
      setEmergencyName(patient.emergencyContact?.name || '');
      setEmergencyPhone(patient.emergencyContact?.phone || '');
      setEmergencyRelation(patient.emergencyContact?.relation || '');
      setImportantNotes(patient.importantNotes || '');
      setAyushmanEligible(patient.ayushmanEligible ?? false);
    }
  }, [visible, patient]);

  const handleAddAllergy = () => {
    const trimmed = newAllergy.trim();
    if (!trimmed) return;
    if (allergies.includes(trimmed)) return;
    setAllergies((prev) => [...prev, trimmed]);
    setNewAllergy('');
  };

  const handleRemoveAllergy = (item: string) => {
    setAllergies((prev) => prev.filter((a) => a !== item));
  };

  const handleAddCondition = () => {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    if (chronicConditions.includes(trimmed)) return;
    setChronicConditions((prev) => [...prev, trimmed]);
    setNewCondition('');
  };

  const handleRemoveCondition = (item: string) => {
    setChronicConditions((prev) => prev.filter((c) => c !== item));
  };

  const handleAddMedication = () => {
    const trimmed = newMedication.trim();
    if (!trimmed) return;
    if (currentMedications.includes(trimmed)) return;
    setCurrentMedications((prev) => [...prev, trimmed]);
    setNewMedication('');
  };

  const handleRemoveMedication = (item: string) => {
    setCurrentMedications((prev) => prev.filter((m) => m !== item));
  };

  const handleAddPrevCondition = () => {
    const trimmed = newPrevCondition.trim();
    if (!trimmed) return;
    if (previousConditions.includes(trimmed)) return;
    setPreviousConditions((prev) => [...prev, trimmed]);
    setNewPrevCondition('');
  };

  const handleRemovePrevCondition = (item: string) => {
    setPreviousConditions((prev) => prev.filter((c) => c !== item));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter your full name.');
      return;
    }

    const parsedAge = parseInt(age, 10) || patient?.age || 28;

    setIsSaving(true);
    try {
      await updatePatientProfile({
        name: name.trim(),
        age: parsedAge,
        dateOfBirth: dateOfBirth.trim() || undefined,
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
        currentMedications,
        previousConditions,
        emergencyContact: {
          name: emergencyName.trim(),
          phone: emergencyPhone.trim(),
          relation: emergencyRelation.trim(),
        },
        importantNotes: importantNotes.trim(),
        ayushmanEligible,
      });

      Alert.alert('Profile Updated', 'Your profile and health details have been saved successfully.');
      onClose();
    } catch (e) {
      Alert.alert('Could not update profile', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
  const genderOptions: Patient['gender'][] = ['Male', 'Female', 'Other'];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Edit Profile & Health Details</Text>
                <Text style={styles.subtitle}>
                  ABHA: {patient?.abhaId || 'ABHA Identity Card'}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {/* Personal Details */}
              <View style={styles.sectionHeaderRow}>
                <MaterialIcons name="person" size={18} color={Colors.primary} />
                <Text style={styles.sectionHeading}>Personal & Demographics</Text>
              </View>

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
                <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                  <Text style={styles.label}>Date of Birth</Text>
                  <TextInput
                    style={styles.input}
                    value={dateOfBirth}
                    onChangeText={setDateOfBirth}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={Colors.outline}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.genderRow}>
                  {genderOptions.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderChip, gender === g && styles.genderChipActive]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+91 98765 43210"
                  keyboardType="phone-pad"
                  placeholderTextColor={Colors.outline}
                />
              </View>

              {/* Location Details */}
              <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
                <MaterialIcons name="place" size={18} color={Colors.primary} />
                <Text style={styles.sectionHeading}>Location & Address</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Address / Street</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="House No, Ward or Mohalla"
                  placeholderTextColor={Colors.outline}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Village / Town</Text>
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
                <Text style={styles.label}>State</Text>
                <TextInput
                  style={styles.input}
                  value={state}
                  onChangeText={setState}
                  placeholder="Bihar"
                  placeholderTextColor={Colors.outline}
                />
              </View>

              {/* Healthcare Provider Details */}
              <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
                <MaterialIcons name="local-hospital" size={18} color={Colors.primary} />
                <Text style={styles.sectionHeading}>Primary Healthcare & ASHA</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Primary PHC / Health Centre</Text>
                <TextInput
                  style={styles.input}
                  value={primaryPHC}
                  onChangeText={setPrimaryPHC}
                  placeholder="e.g. Ramnagar Primary Health Centre"
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
                    placeholder="+91 98765 00000"
                    keyboardType="phone-pad"
                    placeholderTextColor={Colors.outline}
                  />
                </View>
              </View>

              {/* Health Passport & Baseline Information */}
              <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
                <MaterialIcons name="medical-services" size={18} color={Colors.secondary} />
                <Text style={[styles.sectionHeading, { color: Colors.secondary }]}>
                  Health Passport Baseline
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Blood Group</Text>
                <View style={styles.bloodGroupRow}>
                  {bloodGroups.map((bg) => (
                    <TouchableOpacity
                      key={bg}
                      style={[styles.bloodChip, bloodGroup === bg && styles.bloodChipActive]}
                      onPress={() => setBloodGroup(bg)}
                    >
                      <Text style={[styles.bloodText, bloodGroup === bg && styles.bloodTextActive]}>
                        {bg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Allergies */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Allergies / Adverse Reactions</Text>
                <View style={styles.chipsWrap}>
                  {allergies.map((item) => (
                    <View key={item} style={styles.activeTag}>
                      <Text style={styles.activeTagText}>{item}</Text>
                      <TouchableOpacity onPress={() => handleRemoveAllergy(item)}>
                        <MaterialIcons name="close" size={14} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {allergies.length === 0 && (
                    <Text style={styles.emptyNote}>No allergies recorded yet.</Text>
                  )}
                </View>
                <View style={styles.addInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newAllergy}
                    onChangeText={setNewAllergy}
                    placeholder="e.g. Penicillin, Sulfa, Dust"
                    placeholderTextColor={Colors.outline}
                    onSubmitEditing={handleAddAllergy}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={handleAddAllergy}>
                    <MaterialIcons name="add" size={20} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Chronic Conditions */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Chronic Conditions</Text>
                <View style={styles.chipsWrap}>
                  {chronicConditions.map((item) => (
                    <View key={item} style={styles.activeTag}>
                      <Text style={styles.activeTagText}>{item}</Text>
                      <TouchableOpacity onPress={() => handleRemoveCondition(item)}>
                        <MaterialIcons name="close" size={14} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {chronicConditions.length === 0 && (
                    <Text style={styles.emptyNote}>No chronic conditions recorded.</Text>
                  )}
                </View>
                <View style={styles.addInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newCondition}
                    onChangeText={setNewCondition}
                    placeholder="e.g. Hypertension, Diabetes Type 2"
                    placeholderTextColor={Colors.outline}
                    onSubmitEditing={handleAddCondition}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={handleAddCondition}>
                    <MaterialIcons name="add" size={20} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Current Medications */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Current Medications</Text>
                <View style={styles.chipsWrap}>
                  {currentMedications.map((item) => (
                    <View key={item} style={[styles.activeTag, { borderColor: Colors.secondary }]}>
                      <Text style={[styles.activeTagText, { color: Colors.secondary }]}>{item}</Text>
                      <TouchableOpacity onPress={() => handleRemoveMedication(item)}>
                        <MaterialIcons name="close" size={14} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {currentMedications.length === 0 && (
                    <Text style={styles.emptyNote}>No current medications recorded.</Text>
                  )}
                </View>
                <View style={styles.addInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newMedication}
                    onChangeText={setNewMedication}
                    placeholder="e.g. Metformin 500mg (1-0-1), Amlodipine 5mg"
                    placeholderTextColor={Colors.outline}
                    onSubmitEditing={handleAddMedication}
                  />
                  <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.secondary }]} onPress={handleAddMedication}>
                    <MaterialIcons name="add" size={20} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Previous Conditions */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Previous Medical Conditions</Text>
                <View style={styles.chipsWrap}>
                  {previousConditions.map((item) => (
                    <View key={item} style={styles.activeTag}>
                      <Text style={styles.activeTagText}>{item}</Text>
                      <TouchableOpacity onPress={() => handleRemovePrevCondition(item)}>
                        <MaterialIcons name="close" size={14} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {previousConditions.length === 0 && (
                    <Text style={styles.emptyNote}>No previous medical conditions recorded.</Text>
                  )}
                </View>
                <View style={styles.addInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newPrevCondition}
                    onChangeText={setNewPrevCondition}
                    placeholder="e.g. Typhoid (2023), Jaundice"
                    placeholderTextColor={Colors.outline}
                    onSubmitEditing={handleAddPrevCondition}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={handleAddPrevCondition}>
                    <MaterialIcons name="add" size={20} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Emergency Contact */}
              <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
                <MaterialIcons name="contact-phone" size={18} color={Colors.error} />
                <Text style={[styles.sectionHeading, { color: Colors.error }]}>
                  Emergency Contact
                </Text>
              </View>

              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Contact Name</Text>
                  <TextInput
                    style={styles.input}
                    value={emergencyName}
                    onChangeText={setEmergencyName}
                    placeholder="e.g. Ramesh Kumar"
                    placeholderTextColor={Colors.outline}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Relationship</Text>
                  <TextInput
                    style={styles.input}
                    value={emergencyRelation}
                    onChangeText={setEmergencyRelation}
                    placeholder="e.g. Spouse / Brother"
                    placeholderTextColor={Colors.outline}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Emergency Phone</Text>
                <TextInput
                  style={styles.input}
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  placeholder="+91 98765 11111"
                  keyboardType="phone-pad"
                  placeholderTextColor={Colors.outline}
                />
              </View>

              {/* Important Medical Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Important Medical Notes</Text>
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                  value={importantNotes}
                  onChangeText={setImportantNotes}
                  placeholder="e.g. Pacemaker implanted in 2021, prone to low blood sugar, vegetarian diet."
                  placeholderTextColor={Colors.outline}
                  multiline
                />
              </View>

              {/* Ayushman Bharat PM-JAY Eligibility */}
              <TouchableOpacity
                style={styles.ayushmanToggleRow}
                onPress={() => setAyushmanEligible((prev) => !prev)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkCircle, ayushmanEligible && styles.checkCircleActive]}>
                  {ayushmanEligible && <MaterialIcons name="check" size={16} color={Colors.white} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ayushmanTitle}>Ayushman Bharat PM-JAY Eligible</Text>
                  <Text style={styles.ayushmanSub}>
                    Enables cashless treatment up to ₹5 Lakh at empaneled hospitals.
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.footer}>
              <View style={{ flex: 1 }}>
                <Button
                  label={isSaving ? 'Saving...' : 'Save Changes'}
                  icon="save"
                  block
                  disabled={isSaving}
                  onPress={handleSave}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Cancel"
                  variant="outline"
                  block
                  disabled={isSaving}
                  onPress={onClose}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 28, 36, 0.65)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    // Explicit height on native prevents Yoga flex 0 collapse; auto on web
    height: Platform.OS === 'web' ? 'auto' : Math.min(screenHeight * 0.88, 750),
    maxHeight: Platform.OS === 'web' ? '92%' : undefined,
    width: '100%',
    ...Shadows.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
    backgroundColor: Colors.white,
  },
  title: {
    fontSize: 16.5,
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
    gap: 12,
    paddingBottom: 36,
    flexGrow: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  emptyNote: {
    fontSize: 11.5,
    color: Colors.outline,
    fontStyle: 'italic',
    paddingVertical: 2,
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
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 2,
  },
  bloodChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
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
    marginTop: 6,
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
