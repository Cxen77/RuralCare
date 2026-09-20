/**
 * Edit Health Information Modal
 * Dedicated editor for RuralCare Patient Health Information & Passport Baseline
 * Supports Blood Group, Allergies, Chronic Conditions, Current Medications,
 * Previous Medical Conditions, Emergency Contact, and Important Medical Notes.
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
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { useCarePlatform } from '../context/CarePlatformContext';
import { Button } from './ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const { height: screenHeight } = Dimensions.get('window');

export const EditHealthInfoModal: React.FC<Props> = ({ visible, onClose, onSaved }) => {
  const { patient, updatePatientProfile } = useCarePlatform();

  // Health Information State
  const [bloodGroup, setBloodGroup] = useState(patient?.bloodGroup || 'B+');
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
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (visible && patient) {
      setBloodGroup(patient.bloodGroup || 'B+');
      setAllergies([...(patient.allergies || [])]);
      setChronicConditions([...(patient.chronicConditions || [])]);
      setCurrentMedications([...(patient.currentMedications || [])]);
      setPreviousConditions([...(patient.previousConditions || [])]);
      setEmergencyName(patient.emergencyContact?.name || '');
      setEmergencyPhone(patient.emergencyContact?.phone || '');
      setEmergencyRelation(patient.emergencyContact?.relation || '');
      setImportantNotes(patient.importantNotes || '');
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
    // Validation
    if (emergencyPhone.trim() && !/^[0-9+ -]{7,15}$/.test(emergencyPhone.trim())) {
      Alert.alert('Invalid Phone', 'Please enter a valid emergency contact phone number.');
      return;
    }

    setIsSaving(true);
    try {
      await updatePatientProfile({
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
      });

      Alert.alert(
        'Health Information Saved',
        'Your Health Passport details have been updated and synchronized.'
      );
      onSaved?.();
      onClose();
    } catch (e) {
      Alert.alert(
        'Could not save health information',
        e instanceof Error ? e.message : 'Please check your connection and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

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
                <Text style={styles.title}>Edit Health Information</Text>
                <Text style={styles.subtitle}>Health Passport Record</Text>
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
              {/* Blood Group */}
              <View style={styles.fieldGroup}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialIcons name="water-drop" size={18} color={Colors.secondary} />
                  <Text style={styles.sectionHeading}>Blood Group</Text>
                </View>
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

              {/* Allergies / Adverse Reactions */}
              <View style={styles.fieldGroup}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialIcons name="warning-amber" size={18} color={Colors.error} />
                  <Text style={[styles.sectionHeading, { color: Colors.error }]}>
                    Allergies & Adverse Reactions
                  </Text>
                </View>
                <View style={styles.chipsWrap}>
                  {allergies.map((item) => (
                    <View key={item} style={[styles.activeTag, { borderColor: '#FCA5A5' }]}>
                      <Text style={[styles.activeTagText, { color: Colors.error }]}>{item}</Text>
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
                    placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                    placeholderTextColor={Colors.outline}
                    onSubmitEditing={handleAddAllergy}
                  />
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: Colors.error }]}
                    onPress={handleAddAllergy}
                  >
                    <MaterialIcons name="add" size={20} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Chronic Conditions */}
              <View style={styles.fieldGroup}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialIcons name="healing" size={18} color={Colors.primary} />
                  <Text style={styles.sectionHeading}>Chronic Conditions</Text>
                </View>
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
                    placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
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
                <View style={styles.sectionHeaderRow}>
                  <MaterialIcons name="medication" size={18} color={Colors.secondary} />
                  <Text style={[styles.sectionHeading, { color: Colors.secondary }]}>
                    Current Medications
                  </Text>
                </View>
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
                    <Text style={styles.emptyNote}>No current medications added.</Text>
                  )}
                </View>
                <View style={styles.addInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newMedication}
                    onChangeText={setNewMedication}
                    placeholder="e.g. Metformin 500mg (1-0-1), Telmisartan 40mg"
                    placeholderTextColor={Colors.outline}
                    onSubmitEditing={handleAddMedication}
                  />
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: Colors.secondary }]}
                    onPress={handleAddMedication}
                  >
                    <MaterialIcons name="add" size={20} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Previous Conditions */}
              <View style={styles.fieldGroup}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialIcons name="history" size={18} color={Colors.onSurfaceVariant} />
                  <Text style={styles.sectionHeading}>Previous Medical Conditions</Text>
                </View>
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
                    placeholder="e.g. Typhoid (2023), Malaria, Appendectomy"
                    placeholderTextColor={Colors.outline}
                    onSubmitEditing={handleAddPrevCondition}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={handleAddPrevCondition}>
                    <MaterialIcons name="add" size={20} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Emergency Contact */}
              <View style={styles.fieldGroup}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialIcons name="emergency" size={18} color={Colors.error} />
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
                  <Text style={styles.label}>Emergency Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    value={emergencyPhone}
                    onChangeText={setEmergencyPhone}
                    placeholder="+91 98765 11111"
                    keyboardType="phone-pad"
                    placeholderTextColor={Colors.outline}
                  />
                </View>
              </View>

              {/* Important Medical Notes */}
              <View style={styles.fieldGroup}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialIcons name="note-alt" size={18} color={Colors.primary} />
                  <Text style={styles.sectionHeading}>Important Medical Notes</Text>
                </View>
                <TextInput
                  style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                  value={importantNotes}
                  onChangeText={setImportantNotes}
                  placeholder="e.g. Patient has mild renal impairment. Sensitive to NSAIDs. Avoid aspirin."
                  placeholderTextColor={Colors.outline}
                  multiline
                />
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.footer}>
              <View style={{ flex: 1 }}>
                <Button
                  label={isSaving ? 'Saving...' : 'Save Health Info'}
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
    gap: 14,
    paddingBottom: 36,
    flexGrow: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
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
  bloodGroupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
