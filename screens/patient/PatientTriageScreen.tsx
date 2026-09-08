/**
 * Patient Triage Screen
 * AI Chat & Voice Triage using real triageEngine
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, TouchableOpacity, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { useCarePlatform } from '../../context/CarePlatformContext';
import { AIService } from '../../services/ai/AIService';
import { DoctorMatchingService } from '../../services/ai/DoctorMatchingService';
import { TriageStateMachine } from '../../services/ai/TriageStateMachine';
import { resolveDistanceLabel } from '../../services/location/locationUtils';
import { DoctorMapCard } from '../../components/maps/DoctorMapCard';
import { apiClient } from '../../services/apiClient';

interface Props {
  onNavigate: (tab: string) => void;
  onOpenBooking: (
    doctorId: string,
    name: string,
    specialty: string,
    clinic: string,
    aiTriageSummary?: string,
    aiSymptoms?: string[]
  ) => void;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  source?: 'online_ai' | 'offline_ai' | 'rule_engine' | 'patient_manual';
  doctorCard?: {
    id: string;
    name: string;
    specialty: string;
    clinic: string;
    clinicAddress?: string;
    latitude?: number;
    longitude?: number;
    distance: string;
    aiTriageSummary?: string;
    aiSymptoms?: string[];
  };
  doctorMapCard?: {
    id: string;
    name: string;
    specialty: string;
    clinicName: string;
    clinicAddress?: string;
    latitude?: number;
    longitude?: number;
    distanceKm?: number;
  };
  pharmacyCard?: {
    id: string;
    name: string;
    address: string;
    distanceKm?: number;
    isJanAushadhi?: boolean;
    phone?: string;
    hasAllMedicines?: boolean;
    availableCount?: number;
    totalRequested?: number;
  };
  routeCard?: {
    distanceKm?: number;
    durationMinutes?: number;
    mode?: string;
    instructions?: string[];
  };
  confirmationPrompt?: {
    action: string;
    message: string;
    details?: any;
  };
}

export const PatientTriageScreen: React.FC<Props> = ({ onNavigate, onOpenBooking }) => {
  const { doctors, bookAppointment, patient, isOnline } = useCarePlatform();
  const aiMode: 'online' | 'offline' = 'online';

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Namaste ${(patient?.name || 'Patient').split(' ')[0]}! I am your RuralCare AI Triage Assistant. How are you feeling today? You can describe any symptoms in English, Hindi, or Bhojpuri.`,
      time: formatTime(),
      source: 'online_ai',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{ sender: string; text: string }[]>([]);
  const chatScrollRef = useRef<ScrollView>(null);

  // AI History state
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    TriageStateMachine.reset();
  }, []);

  useEffect(() => {
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

  const [lastRecommendedDoctor, setLastRecommendedDoctor] = useState<any>(null);

  const [quickReplies, setQuickReplies] = useState<string[]>([
    'I have a fever & cough',
    'I hurt my leg',
    'Where is the doctor?',
    'Stomach pain since yesterday',
  ]);

  const handleShowDoctorLocation = (doc: any) => {
    const docId = doc.id || doc.doctorId;
    const matchingDoc = doctors.find(d => d.id === docId || (d as any).doctorId === docId) || doc;
    const latitude = doc.latitude != null ? doc.latitude : (matchingDoc.latitude != null ? matchingDoc.latitude : 25.9856);
    const longitude = doc.longitude != null ? doc.longitude : (matchingDoc.longitude != null ? matchingDoc.longitude : 85.2281);
    const clinicName = doc.clinic || doc.clinicName || matchingDoc.clinicName || 'Clinic';
    const clinicAddress = doc.clinicAddress || doc.address || matchingDoc.clinicAddress || 'Clinic Address';

    console.log('[DOCTOR MAP DEBUG] handleShowDoctorLocation:', {
      inputDoc: doc,
      matchingDoc,
      finalCoords: { latitude, longitude }
    });

    const mapMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'ai',
      text: `Here is the clinic location and navigation for ${doc.name}:`,
      time: formatTime(),
      source: aiMode === 'online' ? 'online_ai' : 'offline_ai',
      doctorMapCard: {
        id: docId || 'doc',
        name: doc.name,
        specialty: doc.specialty,
        clinicName,
        clinicAddress,
        latitude,
        longitude,
        distanceKm: matchingDoc.distanceKm || doc.distanceKm || 2.5,
      },
    };
    setMessages(prev => [...prev, mapMsg]);
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', text, time: formatTime() };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    const history = [...conversationHistory, { sender: 'user', text }];
    setConversationHistory(history);

    // Check for explicit doctor location intent queries
    const lower = text.toLowerCase();
    const isLocationQuery =
      lower.includes('where is') ||
      lower.includes('location') ||
      lower.includes('directions') ||
      lower.includes('clinic address') ||
      lower.includes('how to reach') ||
      lower.includes('map');

    if (isLocationQuery) {
      const targetDoc = lastRecommendedDoctor || (doctors.length > 0 ? doctors[0] : null);
      if (targetDoc) {
        setTimeout(() => {
          const docId = targetDoc.id || (targetDoc as any).doctorId;
          const matchingDoc = doctors.find(d => d.id === docId || (d as any).doctorId === docId) || targetDoc;
          const latitude = targetDoc.latitude != null ? targetDoc.latitude : (matchingDoc.latitude != null ? matchingDoc.latitude : 25.9856);
          const longitude = targetDoc.longitude != null ? targetDoc.longitude : (matchingDoc.longitude != null ? matchingDoc.longitude : 85.2281);
          const clinicName = targetDoc.clinicName || targetDoc.clinic || matchingDoc.clinicName || 'Clinic';
          const clinicAddress = targetDoc.clinicAddress || (targetDoc as any).address || matchingDoc.clinicAddress || 'Clinic Address';

          const distanceLabel = resolveDistanceLabel(
            patient ? { latitude: patient.latitude, longitude: patient.longitude } : null,
            { ...targetDoc, latitude, longitude }
          );

          console.log('[DOCTOR MAP DEBUG] locationQuery:', {
            targetDoc,
            matchingDoc,
            finalCoords: { latitude, longitude }
          });

          const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: `${targetDoc.name} is stationed at ${clinicName}. Here is the clinic map and directions:`,
            time: formatTime(),
            source: aiMode === 'online' ? 'online_ai' : 'offline_ai',
            doctorMapCard: {
              id: docId || 'doc',
              name: targetDoc.name,
              specialty: targetDoc.specialty,
              clinicName,
              clinicAddress,
              latitude,
              longitude,
              ...distanceLabel,
            },
          };
          setMessages(prev => [...prev, aiMsg]);
          setConversationHistory(prev => [...prev, { sender: 'ai', text: aiMsg.text }]);
          setIsTyping(false);
        }, 300);
        return;
      }
    }

    AIService.processPatientMessage(
      text,
      history,
      aiMode,
      (patient?.latitude != null && patient?.longitude != null)
        ? { latitude: patient.latitude, longitude: patient.longitude }
        : undefined,
      conversationId || undefined
    ).then((result) => {
      // Track conversationId for continuation
      if (result.conversationId) {
        setConversationId(result.conversationId);
      }
      let doctorCard: ChatMessage['doctorCard'] | undefined;
      let pharmacyCard: ChatMessage['pharmacyCard'] | undefined;
      let routeCard: ChatMessage['routeCard'] | undefined;

      // 1. Structured Doctor Card from AI Agent or Local Triage
      if (result.doctors && result.doctors.length > 0) {
        const topDoc = result.doctors[0];
        setLastRecommendedDoctor(topDoc);
        doctorCard = {
          id: topDoc.id || (topDoc as any).doctorId,
          name: topDoc.name,
          specialty: topDoc.specialty,
          clinic: topDoc.clinic || topDoc.clinicName,
          clinicAddress: topDoc.address || topDoc.clinicAddress,
          latitude: topDoc.latitude,
          longitude: topDoc.longitude,
          distance: topDoc.distanceKm ? `${topDoc.distanceKm} km away` : 'Nearby',
          aiTriageSummary: result.formattedTriageNote || result.text,
          aiSymptoms: result.assessment?.symptoms?.length ? result.assessment.symptoms : ['General Consultation'],
        };
      } else if (!result.isEmergency && result.readyForDoctorMatch) {
        const matches = DoctorMatchingService.match(result.assessment, doctors);
        if (matches.length > 0) {
          const matchedDoc = matches[0].doctor;
          setLastRecommendedDoctor(matchedDoc);
          doctorCard = {
            id: matchedDoc.id,
            name: matchedDoc.name,
            specialty: matchedDoc.specialty,
            clinic: matchedDoc.clinicName,
            clinicAddress: matchedDoc.clinicAddress,
            latitude: matchedDoc.latitude,
            longitude: matchedDoc.longitude,
            distance: resolveDistanceLabel(
              patient ? { latitude: patient.latitude, longitude: patient.longitude } : null,
              matchedDoc
            ).text,
            aiTriageSummary: result.formattedTriageNote || result.text,
            aiSymptoms: result.assessment.symptoms?.length ? result.assessment.symptoms : ['General Consultation'],
          };
        }
      }

      // 2. Structured Pharmacy Card
      if (result.pharmacies && result.pharmacies.length > 0) {
        const topPh = result.pharmacies[0];
        pharmacyCard = {
          id: topPh.id || topPh.pharmacyId,
          name: topPh.name,
          address: topPh.address,
          distanceKm: topPh.distanceKm,
          isJanAushadhi: topPh.isJanAushadhi,
          phone: topPh.phone,
          hasAllMedicines: topPh.hasAllMedicines,
          availableCount: topPh.availableCount,
          totalRequested: topPh.totalRequested
        };
      }

      // 3. Structured Route Card
      if (result.route) {
        routeCard = {
          distanceKm: result.route.distanceKm,
          durationMinutes: result.route.durationMinutes,
          mode: result.route.mode,
          instructions: result.route.instructions
        };
      }

      if (result.suggestedQuestions && result.suggestedQuestions.length > 0) {
        setQuickReplies(result.suggestedQuestions);
      }

      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        sender: 'ai', 
        text: result.text, 
        time: formatTime(), 
        source: result.assessment?.source,
        doctorCard,
        pharmacyCard,
        routeCard,
        confirmationPrompt: result.confirmationNeeded
      };
      setMessages(prev => [...prev, aiMsg]);
      setConversationHistory(prev => [...prev, { sender: 'ai', text: result.text }]);
      setIsTyping(false);

      if (result.isEmergency) {
        Alert.alert('Emergency Alert', result.emergencyReason || 'Critical red flag detected. Please seek emergency care or tap SOS immediately.');
      }
    }).catch(err => {
      console.error('[PatientTriageScreen] Chat error:', err);
      setIsTyping(false);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'I am having trouble connecting to the medical AI service right now. Please check your connection or try again in a moment.',
        time: formatTime(),
        source: 'rule_engine',
      };
      setMessages(prev => [...prev, errorMsg]);
    });
  };

  return (
    <>
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.chatWrapper}>
        <View style={styles.chatHeader}>
          <View style={styles.headerBadge}>
            <View style={[styles.botCircle, { backgroundColor: '#0284C7' }]}>
              <MaterialIcons name="cloud" size={18} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Clinical AI Triage</Text>
              <Text style={styles.headerSub}>Online Mode • Cloud AI API</Text>
            </View>
            <TouchableOpacity
              style={styles.resetChatBtn}
              onPress={() => {
                TriageStateMachine.reset();
                setMessages([
                  {
                    id: Date.now().toString(),
                    sender: 'ai',
                    text: `Namaste ${(patient?.name || 'Patient').split(' ')[0]}! I am your RuralCare AI Triage Assistant. How are you feeling today? You can describe any symptoms in English, Hindi, or Bhojpuri.`,
                    time: formatTime(),
                    source: 'online_ai',
                  },
                ]);
                setConversationHistory([]);
                setConversationId(null);
                setQuickReplies([
                  'I have a fever & cough',
                  'I hurt my leg',
                  'Severe headache',
                  'Stomach pain since yesterday',
                ]);
              }}
              activeOpacity={0.7}
              accessibilityLabel="Reset conversation"
            >
              <MaterialIcons name="refresh" size={16} color={Colors.secondary} />
              <Text style={styles.resetChatBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resetChatBtn}
              onPress={async () => {
                setShowHistoryModal(true);
                setLoadingHistory(true);
                setHistoryError(null);
                try {
                  const list = await apiClient.getAiConversations();
                  setHistoryList(list || []);
                } catch (err: any) {
                  setHistoryError('Unable to load conversation history.');
                  setHistoryList([]);
                } finally {
                  setLoadingHistory(false);
                }
              }}
              activeOpacity={0.7}
              accessibilityLabel="Conversation history"
            >
              <MaterialIcons name="history" size={16} color={Colors.primary} />
              <Text style={[styles.resetChatBtnText, { color: Colors.primary }]}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

          <ScrollView ref={chatScrollRef} style={styles.messagesScroll} contentContainerStyle={styles.messagesContent} showsVerticalScrollIndicator={false}>
            {messages.map(msg => {
              const isUser = msg.sender === 'user';
              return (
                <View key={msg.id} style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}>
                  {!isUser && (
                    <View style={[styles.aiAvatar, msg.source === 'online_ai' && { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
                      <MaterialIcons
                        name={msg.source === 'online_ai' ? 'cloud' : 'smart-toy'}
                        size={15}
                        color={msg.source === 'online_ai' ? '#0284C7' : Colors.primary}
                      />
                    </View>
                  )}
                  <View style={[styles.bubbleContainer, isUser && styles.bubbleContainerUser]}>
                    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
                      <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextAi]}>{msg.text}</Text>
                      {msg.doctorCard && (
                        <View style={styles.doctorCard}>
                          <View style={styles.doctorCardHead}>
                            <MaterialIcons name="verified" size={16} color={Colors.primary} />
                            <Text style={styles.doctorCardTitle}>Recommended Doctor</Text>
                          </View>
                          <View style={styles.doctorRow}>
                            <View style={styles.doctorAvBox}>
                              <MaterialIcons name="person" size={20} color={Colors.secondary} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.doctorName}>{msg.doctorCard.name}</Text>
                              <Text style={styles.doctorMeta}>
                                {msg.doctorCard.specialty} • {msg.doctorCard.clinic} ({msg.doctorCard.distance})
                              </Text>
                            </View>
                          </View>
                          <View style={styles.doctorActionButtons}>
                            <TouchableOpacity
                              style={styles.viewLocBtn}
                              onPress={() => handleShowDoctorLocation(msg.doctorCard!)}
                              activeOpacity={0.8}
                              accessibilityLabel={`View location of ${msg.doctorCard.name}`}
                            >
                              <MaterialIcons name="location-on" size={15} color={Colors.primary} />
                              <Text style={styles.viewLocBtnText}>View Location</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.bookBtnSmall}
                              onPress={() => onOpenBooking(msg.doctorCard!.id, msg.doctorCard!.name, msg.doctorCard!.specialty, msg.doctorCard!.clinic, msg.doctorCard!.aiTriageSummary, msg.doctorCard!.aiSymptoms)}
                              activeOpacity={0.85}
                            >
                              <MaterialIcons name="calendar-month" size={15} color={Colors.white} />
                              <Text style={styles.bookBtnSmallText}>Book Slot</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      {msg.doctorMapCard && (
                        <View style={{ marginTop: 8 }}>
                          <DoctorMapCard
                            doctor={msg.doctorMapCard}
                            patientLocation={patient ? { latitude: patient.latitude, longitude: patient.longitude } : undefined}
                            onBookPress={(docId, name, spec, clinic) =>
                              onOpenBooking(docId, name, spec, clinic)
                            }
                          />
                        </View>
                      )}
                      {msg.pharmacyCard && (
                        <View style={[styles.doctorCard, { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' }]}>
                          <View style={styles.doctorCardHead}>
                            <MaterialIcons name="local-pharmacy" size={16} color="#059669" />
                            <Text style={[styles.doctorCardTitle, { color: '#059669' }]}>
                              {msg.pharmacyCard.isJanAushadhi ? 'Jan Aushadhi Kendra' : 'Verified Pharmacy'}
                            </Text>
                          </View>
                          <View style={styles.doctorRow}>
                            <View style={[styles.doctorAvBox, { backgroundColor: '#ECFDF5' }]}>
                              <MaterialIcons name="store" size={20} color="#059669" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.doctorName}>{msg.pharmacyCard.name}</Text>
                              <Text style={styles.doctorMeta}>
                                {msg.pharmacyCard.address} {msg.pharmacyCard.distanceKm ? `• ${msg.pharmacyCard.distanceKm} km` : ''}
                              </Text>
                              {msg.pharmacyCard.availableCount !== undefined && (
                                <Text style={{ fontSize: 11, color: msg.pharmacyCard.hasAllMedicines ? '#059669' : '#D97706', marginTop: 2, fontWeight: '600' }}>
                                  {msg.pharmacyCard.hasAllMedicines ? '✓ All prescribed medicines in stock' : `Stock: ${msg.pharmacyCard.availableCount}/${msg.pharmacyCard.totalRequested} items available`}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      )}
                      {msg.routeCard && (
                        <View style={[styles.doctorCard, { borderColor: '#93C5FD', backgroundColor: '#EFF6FF' }]}>
                          <View style={styles.doctorCardHead}>
                            <MaterialIcons name="directions" size={16} color="#2563EB" />
                            <Text style={[styles.doctorCardTitle, { color: '#2563EB' }]}>
                              Calculated Route ({msg.routeCard.mode || 'drive'})
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF', marginTop: 4 }}>
                            {msg.routeCard.distanceKm} km • ~{msg.routeCard.durationMinutes} mins travel time
                          </Text>
                          {msg.routeCard.instructions && msg.routeCard.instructions.length > 0 && (
                            <Text style={{ fontSize: 11, color: '#3B82F6', marginTop: 4 }}>
                              Directions: {msg.routeCard.instructions[0]}
                            </Text>
                          )}
                        </View>
                      )}
                      {msg.confirmationPrompt && (
                        <View style={[styles.doctorCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
                          <View style={styles.doctorCardHead}>
                            <MaterialIcons name="help-outline" size={16} color="#D97706" />
                            <Text style={[styles.doctorCardTitle, { color: '#D97706' }]}>Confirmation Required</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>
                            {msg.confirmationPrompt.message}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity
                              style={[styles.bookBtnSmall, { backgroundColor: '#D97706' }]}
                              onPress={() => handleSendMessage('Yes, please confirm and book it.')}
                            >
                              <Text style={styles.bookBtnSmallText}>Yes, Confirm</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.viewLocBtn, { borderColor: '#D97706' }]}
                              onPress={() => handleSendMessage('No, please cancel.')}
                            >
                              <Text style={[styles.viewLocBtnText, { color: '#D97706' }]}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                    <View style={[styles.metaRow, isUser && { justifyContent: 'flex-end' }]}>
                      <Text style={styles.timestamp}>{msg.time}</Text>
                      {!isUser && msg.source && (
                        <View style={[
                          styles.sourceTag,
                          msg.source === 'online_ai'
                            ? styles.sourceTagOnline
                            : msg.source === 'offline_ai'
                            ? styles.sourceTagOffline
                            : styles.sourceTagRule
                        ]}>
                          <MaterialIcons
                            name={msg.source === 'online_ai' ? 'cloud' : msg.source === 'offline_ai' ? 'offline-bolt' : 'memory'}
                            size={10}
                            color={msg.source === 'online_ai' ? '#0369A1' : msg.source === 'offline_ai' ? '#047857' : '#475569'}
                          />
                          <Text style={[
                            styles.sourceTagText,
                            { color: msg.source === 'online_ai' ? '#0369A1' : msg.source === 'offline_ai' ? '#047857' : '#475569' }
                          ]}>
                            {msg.source === 'online_ai' ? 'Online Cloud' : msg.source === 'offline_ai' ? 'Offline Triage' : 'Offline Engine'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}

            {isTyping && (
              <View style={[styles.msgRow, styles.msgRowAi]}>
                <View style={styles.aiAvatar}><MaterialIcons name="smart-toy" size={15} color={Colors.primary} /></View>
                <View style={[styles.bubble, styles.bubbleAi, styles.typingBubble]}>
                  <View style={styles.typingDot} /><View style={[styles.typingDot, { opacity: 0.7 }]} /><View style={[styles.typingDot, { opacity: 0.4 }]} />
                  <Text style={styles.typingLabel}>AI analyzing...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.quickSection}>
            <Text style={styles.quickLabel}>Suggested replies:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {quickReplies.map(q => (
                <TouchableOpacity key={q} style={styles.quickChip} onPress={() => handleSendMessage(q)} activeOpacity={0.7}>
                  <Text style={styles.quickChipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputSection}>
            <View style={styles.inputPill}>
              <TextInput
                style={styles.chatInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type your symptoms..."
                placeholderTextColor={Colors.onSurfaceVariant}
                onSubmitEditing={() => handleSendMessage()}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                onPress={() => handleSendMessage()}
                disabled={!inputText.trim()}
                activeOpacity={0.8}
              >
                <MaterialIcons name="send" size={18} color={inputText.trim() ? Colors.white : Colors.outline} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
    </KeyboardAvoidingView>

    {/* AI History Modal */}
    <Modal visible={showHistoryModal} animationType="slide" transparent onRequestClose={() => setShowHistoryModal(false)}>
      <View style={styles.historyModalOverlay}>
        <View style={styles.historyModalContainer}>
          <View style={styles.historyModalHeader}>
            <Text style={styles.historyModalTitle}>AI Conversation History</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={22} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>
          {loadingHistory ? (
            <View style={styles.historyCenter}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.historyCenterText}>Loading history...</Text>
            </View>
          ) : historyError ? (
            <View style={styles.historyCenter}>
              <MaterialIcons name="error-outline" size={36} color={Colors.outline} />
              <Text style={styles.historyCenterText}>{historyError}</Text>
            </View>
          ) : historyList.length === 0 ? (
            <View style={styles.historyCenter}>
              <MaterialIcons name="chat-bubble-outline" size={36} color={Colors.outline} />
              <Text style={styles.historyCenterText}>No previous conversations.</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, padding: 16 }}>
              {historyList.map(item => (
                <TouchableOpacity
                  key={item.conversationId}
                  style={styles.historyItem}
                  activeOpacity={0.7}
                  onPress={async () => {
                    try {
                      const conv = await apiClient.getAiConversation(item.conversationId);
                      const restoredMessages: ChatMessage[] = (conv.messages || []).map((m: any, i: number) => ({
                        id: `hist-${i}`,
                        sender: m.role === 'user' ? 'user' as const : 'ai' as const,
                        text: m.content || '',
                        time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                        source: m.role === 'assistant' ? 'online_ai' as const : undefined,
                      }));
                      setMessages(restoredMessages.length > 0 ? restoredMessages : [{
                        id: '1', sender: 'ai', text: 'Conversation loaded. Send a message to continue.',
                        time: formatTime(), source: 'online_ai'
                      }]);
                      setConversationId(item.conversationId);
                      setConversationHistory(
                        (conv.messages || []).map((m: any) => ({
                          sender: m.role === 'user' ? 'user' : 'ai',
                          text: m.content || ''
                        }))
                      );
                      setShowHistoryModal(false);
                    } catch {
                      Alert.alert('Error', 'Failed to load conversation.');
                    }
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyItemTitle} numberOfLines={1}>
                      {item.title || 'Untitled'}
                    </Text>
                    <Text style={styles.historyItemMeta}>
                      {item.messageCount || 0} messages • {item.lastActive ? new Date(item.lastActive).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={async (e) => {
                      e.stopPropagation?.();
                      Alert.alert(
                        'Delete Conversation',
                        'Are you sure you want to delete this conversation?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await apiClient.deleteAiConversation(item.conversationId);
                                setHistoryList(prev => prev.filter(h => h.conversationId !== item.conversationId));
                              } catch {
                                Alert.alert('Error', 'Failed to delete conversation.');
                              }
                            },
                          },
                        ]
                      );
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="delete-outline" size={20} color={Colors.outline} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
    </>
  );
};

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  chatWrapper: { flex: 1 },
  chatHeader: { paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.surfaceContainerLowest, borderBottomWidth: 1, borderBottomColor: Colors.outlineLight },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#0284C7', alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
  headerTitle: { fontSize: 14, fontWeight: '700', color: Colors.secondary },
  headerSub: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 1 },
  resetChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radii.full, backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineLight },
  resetChatBtnText: { fontSize: 11, fontWeight: '600', color: Colors.secondary },
  messagesScroll: { flex: 1 },
  messagesContent: { padding: Spacing.md, gap: 14, paddingBottom: 16 },
  noticeBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryFixedDim, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.md, marginBottom: 4 },
  noticeText: { fontSize: 11, color: Colors.primaryDark, flex: 1, lineHeight: 15 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: '100%' },
  msgRowAi: { justifyContent: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: 2, borderWidth: 1, borderColor: Colors.primaryFixedDim },
  bubbleContainer: { maxWidth: '82%' },
  bubbleContainerUser: { alignItems: 'flex-end' },
  bubble: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18, ...Shadows.sm },
  bubbleAi: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineLight, borderTopLeftRadius: 4 },
  bubbleUser: { backgroundColor: Colors.primary, borderTopRightRadius: 4 },
  msgText: { fontSize: 13.5, lineHeight: 20 },
  msgTextAi: { color: Colors.onSurface },
  msgTextUser: { color: Colors.white, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginLeft: 4 },
  timestamp: { fontSize: 10, color: Colors.outline },
  sourceTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.full },
  sourceTagOnline: { backgroundColor: '#E0F2FE' },
  sourceTagOffline: { backgroundColor: '#DCFCE7' },
  sourceTagRule: { backgroundColor: Colors.surfaceContainerLow },
  sourceTagText: { fontSize: 9.5, fontWeight: '700' },
  doctorCard: { backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineLight, borderRadius: Radii.md, padding: 12, marginTop: 10, gap: 6 },
  doctorCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doctorCardTitle: { fontSize: 12, fontWeight: '700', color: Colors.secondary },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, padding: 8, borderRadius: Radii.sm, borderWidth: 1, borderColor: Colors.outlineLight, marginVertical: 4 },
  doctorAvBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  doctorName: { fontSize: 12, fontWeight: '700', color: Colors.secondary },
  doctorMeta: { fontSize: 10.5, color: Colors.onSurfaceVariant },
  doctorActionButtons: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  viewLocBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: Colors.primary, paddingVertical: 8, borderRadius: Radii.sm },
  viewLocBtnText: { color: Colors.primary, fontSize: 11.5, fontWeight: '700' },
  bookBtnSmall: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.primary, paddingVertical: 8, borderRadius: Radii.sm, ...Shadows.sm },
  bookBtnSmallText: { color: Colors.white, fontSize: 11.5, fontWeight: '700' },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, paddingVertical: 9, borderRadius: Radii.sm, marginTop: 4, ...Shadows.sm },
  bookBtnText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  typingLabel: { fontSize: 11, color: Colors.onSurfaceVariant, fontStyle: 'italic', marginLeft: 4 },
  quickSection: { backgroundColor: Colors.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: Colors.outlineLight, paddingVertical: 8, paddingHorizontal: Spacing.md },
  quickLabel: { fontSize: 10.5, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  quickChip: { backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.full },
  quickChipText: { fontSize: 11.5, fontWeight: '600', color: Colors.primary },
  inputSection: { backgroundColor: Colors.surfaceContainerLowest, paddingHorizontal: Spacing.md, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.outlineLight },
  inputPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineLight, borderRadius: Radii.full, paddingLeft: 14, paddingRight: 6, paddingVertical: Platform.OS === 'ios' ? 8 : 4 },
  chatInput: { flex: 1, fontSize: 13, color: Colors.onSurface, paddingHorizontal: 8 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
  sendBtnDisabled: { backgroundColor: Colors.surfaceContainerHigh },
  // History Modal Styles
  historyModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  historyModalContainer: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', minHeight: '50%' },
  historyModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineLight },
  historyModalTitle: { fontSize: 16, fontWeight: '700', color: Colors.onSurface },
  historyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  historyCenterText: { fontSize: 13, color: Colors.onSurfaceVariant, textAlign: 'center' },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineLight, borderRadius: Radii.md, padding: 14 },
  historyItemTitle: { fontSize: 13, fontWeight: '700', color: Colors.onSurface },
  historyItemMeta: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
});
