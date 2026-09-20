import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { apiClient, API_BASE_URL } from '../../services/apiClient';

import * as ImagePicker from 'expo-image-picker';

interface Props {
  visible: boolean;
  onClose: () => void;
  onReportCreated: (report: any) => void;
  initialCoords?: { latitude: number; longitude: number } | null;
}

const EMERGENCY_TYPES = [
  { id: 'road_accident', label: 'Road Accident', icon: 'car-crash' },
  { id: 'medical_emergency', label: 'Medical Emergency', icon: 'medical-services' },
  { id: 'fire', label: 'Fire Hazard', icon: 'local-fire-department' },
  { id: 'natural_hazard', label: 'Natural Hazard', icon: 'warning' },
  { id: 'other', label: 'Other Incident', icon: 'emergency' },
];

const SEVERITIES = [
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' },
  { id: 'moderate', label: 'Moderate' },
];

export const ReportEmergencyModal: React.FC<Props> = ({
  visible,
  onClose,
  onReportCreated,
  initialCoords,
}) => {
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [emergencyType, setEmergencyType] = useState('road_accident');
  const [severity, setSeverity] = useState('critical');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // GPS state
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialCoords || null
  );
  const [address, setAddress] = useState<string>('Detecting location...');
  const [locating, setLocating] = useState(false);

  // Web Camera Viewfinder states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize location & camera on modal open
  useEffect(() => {
    if (visible) {
      fetchCurrentLocation();
      if (Platform.OS === 'web') {
        startWebCamera();
      }
    } else {
      stopWebCamera();
      resetForm();
    }
    return () => {
      stopWebCamera();
    };
  }, [visible]);

  const resetForm = () => {
    setPhotoBlob(null);
    setPhotoUri(null);
    setPhotoPreview(null);
    setDescription('');
    setEmergencyType('road_accident');
    setSeverity('critical');
    setCameraError(null);
  };

  const fetchCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAddress('Location permission not granted. Tap to retry.');
        setLocating(false);
        return;
      }
      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      });
      const newCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCoords(newCoords);

      const [place] = await ExpoLocation.reverseGeocodeAsync({
        latitude: newCoords.latitude,
        longitude: newCoords.longitude,
      });
      if (place) {
        const parts = [
          place.streetNumber,
          place.street,
          place.subregion || place.district,
          place.city,
        ].filter(Boolean);
        setAddress(parts.join(', ') || `${newCoords.latitude.toFixed(4)}, ${newCoords.longitude.toFixed(4)}`);
      } else {
        setAddress(`GPS: ${newCoords.latitude.toFixed(4)}, ${newCoords.longitude.toFixed(4)}`);
      }
    } catch {
      if (initialCoords) {
        setCoords(initialCoords);
        setAddress(`Near current map center (${initialCoords.latitude.toFixed(4)}, ${initialCoords.longitude.toFixed(4)})`);
      } else {
        setAddress('GPS locked at regional hub.');
      }
    } finally {
      setLocating(false);
    }
  };

  const startWebCamera = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API not available. Use direct camera capture button.');
      return;
    }
    try {
      setCameraError(null);
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('[Camera] Viewfinder error:', err);
      setCameraActive(false);
      setCameraError('Camera access required. Please enable permissions or click "Open Camera".');
    }
  };

  const stopWebCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) {
          setPhotoBlob(blob);
          const previewUrl = URL.createObjectURL(blob);
          setPhotoPreview(previewUrl);
          stopWebCamera();
        }
      }, 'image/jpeg', 0.85);
    } catch (err) {
      console.error('[Camera] Snapshot error:', err);
    }
  };

  const handleNativeCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission', 'Camera permission is required to photograph the incident.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        setPhotoPreview(asset.uri);
      }
    } catch (err: any) {
      console.error('[Camera] Native camera error:', err);
      Alert.alert('Camera Error', err.message || 'Unable to open camera.');
    }
  };

  const handleNativeGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Gallery Permission', 'Storage permission is required to select photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        setPhotoPreview(asset.uri);
      }
    } catch (err: any) {
      console.error('[Gallery] Selection error:', err);
    }
  };

  const handleFallbackFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoBlob(file);
      setPhotoPreview(URL.createObjectURL(file));
      stopWebCamera();
    }
  };

  const handleRetake = () => {
    setPhotoBlob(null);
    setPhotoUri(null);
    setPhotoPreview(null);
    if (Platform.OS === 'web') {
      startWebCamera();
    } else {
      handleNativeCamera();
    }
  };

  const handleSubmit = async () => {
    if (!photoBlob && !photoUri && !photoPreview) {
      Alert.alert('Photo Required', 'Please capture a live photo of the incident using the camera.');
      return;
    }

    const lat = coords?.latitude || 26.7606;
    const lng = coords?.longitude || 83.3732;

    setSubmitting(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web' && photoBlob) {
        formData.append('photo', photoBlob, 'emergency_live_capture.jpg');
      } else {
        const uriToUse = photoUri || photoPreview!;
        const filename = uriToUse.split('/').pop() || 'emergency_live_capture.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('photo', {
          uri: Platform.OS === 'android' ? uriToUse : uriToUse.replace('file://', ''),
          name: filename,
          type,
        } as any);
      }
      formData.append('emergencyType', emergencyType);
      formData.append('severity', severity);
      formData.append('description', description.trim());
      formData.append('latitude', lat.toString());
      formData.append('longitude', lng.toString());
      formData.append('address', address);

      const API_URL = API_BASE_URL || 'https://ruralcare-sia2.onrender.com';
      const token = apiClient.getToken ? apiClient.getToken() : null;

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/emergencies`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to submit emergency report.');
      }

      Alert.alert(
        'Emergency Broadcast Sent',
        'Your incident report is now live on the Care Map and dispatched to emergency teams.',
        [{ text: 'View on Care Map', onPress: () => {} }]
      );

      onReportCreated(json.data);
      onClose();
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Network request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header - Clean Default Theme */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconWrap}>
                <MaterialIcons name="medical-services" size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Live Incident Report</Text>
                <Text style={styles.headerSub}>Citizen Emergency Assistance</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={22} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Camera Viewfinder / Preview Section */}
            <View style={styles.cameraSection}>
              {photoPreview ? (
                <View style={styles.previewContainer}>
                  {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                  {/* @ts-ignore */}
                  <Image source={{ uri: photoPreview }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} activeOpacity={0.8}>
                    <MaterialIcons name="refresh" size={15} color="#FFFFFF" />
                    <Text style={styles.retakeBtnText}>Retake</Text>
                  </TouchableOpacity>
                  <View style={styles.liveTag}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveTagText}>PHOTO ATTACHED</Text>
                  </View>
                </View>
              ) : Platform.OS === 'web' && cameraActive ? (
                <View style={styles.viewfinderWrap}>
                  <video
                    ref={(el) => {
                      videoRef.current = el;
                      if (el && streamRef.current && el.srcObject !== streamRef.current) {
                        el.srcObject = streamRef.current;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: Radii.md,
                    }}
                  />
                  {/* Viewfinder crosshairs - Professional subtle white/frost */}
                  <View style={styles.viewfinderCrosshair}>
                    <View style={styles.crosshairCornerTL} />
                    <View style={styles.crosshairCornerTR} />
                    <View style={styles.crosshairCornerBL} />
                    <View style={styles.crosshairCornerBR} />
                  </View>

                  {/* Red Shutter Click Button - User specification: keep red for click button */}
                  <TouchableOpacity
                    style={styles.captureShutterBtn}
                    onPress={handleCaptureSnapshot}
                    activeOpacity={0.85}
                  >
                    <View style={styles.shutterInner} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cameraFallbackCard}>
                  <View style={styles.cameraFallbackIconWrap}>
                    <MaterialIcons name="photo-camera" size={32} color={Colors.primary} />
                  </View>
                  <Text style={styles.fallbackTitle}>Take Incident Photo</Text>
                  <Text style={styles.fallbackSub}>
                    Live camera capture verifies real-time emergency authenticity.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[styles.launchCameraBtn, { flex: 1 }]}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          if (fileInputRef.current) {
                            fileInputRef.current.click();
                          } else {
                            startWebCamera();
                          }
                        } else {
                          handleNativeCamera();
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <MaterialIcons name="photo-camera" size={17} color="#FFFFFF" />
                      <Text style={styles.launchCameraBtnText}>Open Camera</Text>
                    </TouchableOpacity>

                    {Platform.OS !== 'web' && (
                      <TouchableOpacity
                        style={[styles.launchCameraBtn, { flex: 1, backgroundColor: '#475569' }]}
                        onPress={handleNativeGallery}
                        activeOpacity={0.85}
                      >
                        <MaterialIcons name="photo-library" size={17} color="#FFFFFF" />
                        <Text style={styles.launchCameraBtnText}>Gallery</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {Platform.OS === 'web' && (
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      // @ts-ignore
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={handleFallbackFileInput}
                    />
                  )}
                  {cameraError && <Text style={styles.errorText}>{cameraError}</Text>}
                </View>
              )}
            </View>

            {/* GPS Location Pill - Clean Default Theme */}
            <View style={styles.locationCard}>
              <View style={styles.locIconWrap}>
                <MaterialIcons name="my-location" size={17} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locLabel}>Incident Location (GPS Locked)</Text>
                <Text style={styles.locAddress} numberOfLines={2}>
                  {address}
                </Text>
              </View>
              <TouchableOpacity onPress={fetchCurrentLocation} disabled={locating} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons
                  name="refresh"
                  size={18}
                  color={locating ? Colors.outline : Colors.primary}
                />
              </TouchableOpacity>
            </View>

            {/* Emergency Type Selector - Clean Default Theme */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Incident Type</Text>
              <View style={styles.typeGrid}>
                {EMERGENCY_TYPES.map((t) => {
                  const isSelected = emergencyType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.typeChip,
                        isSelected && styles.typeChipActive,
                      ]}
                      onPress={() => setEmergencyType(t.id)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={t.icon as any}
                        size={15}
                        color={isSelected ? Colors.primaryDark : '#475569'}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          isSelected && styles.typeChipTextActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Severity Selector - Clean Default Theme */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Severity Level</Text>
              <View style={styles.severityRow}>
                {SEVERITIES.map((s) => {
                  const isSelected = severity === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.severityChip,
                        isSelected && styles.severityChipActive,
                      ]}
                      onPress={() => setSeverity(s.id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.severityChipText,
                          isSelected && styles.severityChipTextActive,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Description (max 150 chars) */}
            <View style={styles.section}>
              <View style={styles.descHead}>
                <Text style={styles.sectionLabel}>Incident Note (Optional)</Text>
                <Text style={styles.charCount}>{description.length}/150</Text>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Describe details (e.g. 2 vehicles involved, urgent medical team needed)..."
                placeholderTextColor="#94A3B8"
                maxLength={150}
                multiline
                numberOfLines={2}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </ScrollView>

          {/* Footer Action - Clean High-Contrast Professional Theme */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.broadcastBtn,
                (!photoBlob || submitting) && styles.broadcastBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!photoBlob || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.broadcastBtnText}>Broadcast Incident to Care Map</Text>
                </>
              )}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radii.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.onSurface,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.onSurfaceVariant,
  },
  scroll: {
    maxHeight: 500,
  },
  scrollContent: {
    padding: 16,
    gap: 13,
  },
  cameraSection: {
    width: '100%',
    height: 195,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewfinderWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderCrosshair: {
    position: 'absolute',
    top: 20,
    bottom: 20,
    left: 20,
    right: 20,
    pointerEvents: 'none',
  },
  crosshairCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 18,
    height: 18,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  crosshairCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  crosshairCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  crosshairCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  captureShutterBtn: {
    position: 'absolute',
    bottom: 12,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
    ...Shadows.sm,
  },
  shutterInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DC2626', // Red click button as requested
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  retakeBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  retakeBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  liveTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveTagText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cameraFallbackCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#0F172A',
    gap: 6,
  },
  cameraFallbackIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fallbackSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 15,
  },
  launchCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.sm,
    marginTop: 4,
  },
  launchCameraBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: '#F87171',
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.md,
    padding: 10,
  },
  locIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  locAddress: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  typeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  typeChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  typeChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  severityChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  severityChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  descHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.sm,
    padding: 9,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 48,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  broadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radii.md,
    ...Shadows.sm,
  },
  broadcastBtnDisabled: {
    backgroundColor: '#CBD5E1',
    opacity: 0.7,
  },
  broadcastBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
