/**
 * AppointmentChatModal (Doctor App)
 * Real-time chat between Doctor and Patient for a specific appointment.
 * Messages are persisted in MongoDB and polled every 2.5 seconds.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';

interface AppointmentChatModalProps {
  visible: boolean;
  onClose: () => void;
  appointmentId: string;
  participantName: string;
  appointmentDate?: string;
  appointmentTime?: string;
  mode?: string;
  api: {
    getAppointmentMessages: (id: string) => Promise<any[]>;
    sendAppointmentMessage: (id: string, text: string) => Promise<any>;
  };
  currentUserId: string;
}

interface ChatMsg {
  id: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export const AppointmentChatModal: React.FC<AppointmentChatModalProps> = ({
  visible, onClose, appointmentId, participantName,
  appointmentDate, appointmentTime, mode,
  api, currentUserId,
}) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pollRef = useRef<any>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const msgs = await api.getAppointmentMessages(appointmentId);
      setMessages(msgs || []);
      setError(null);
    } catch (err: any) {
      setError('Unable to load messages.');
    } finally {
      setLoading(false);
    }
  }, [appointmentId, api]);

  useEffect(() => {
    if (!visible || !appointmentId) return;
    setLoading(true);
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [visible, appointmentId, fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    setInputText('');
    try {
      await api.sendAppointmentMessage(appointmentId, text);
      await fetchMessages();
    } catch {
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Chat with {participantName}</Text>
              <Text style={styles.headerSub}>
                {appointmentDate && appointmentTime ? `${appointmentDate} at ${appointmentTime}` : 'Appointment Chat'}
                {mode ? ` • ${mode}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={22} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.centerText}>Loading messages...</Text>
            </View>
          ) : error && messages.length === 0 ? (
            <View style={styles.center}>
              <MaterialIcons name="error-outline" size={36} color={Colors.outline} />
              <Text style={styles.centerText}>{error}</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.center}>
              <MaterialIcons name="chat-bubble-outline" size={36} color={Colors.outline} />
              <Text style={styles.centerText}>No messages yet.{'\n'}Send a message to begin consultation chat.</Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.messagesList}
              contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {messages.map(msg => {
                const isMe = msg.senderId === currentUserId;
                return (
                  <View key={msg.id} style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
                    {!isMe && (
                      <View style={styles.avatarCircle}>
                        <MaterialIcons
                          name={msg.senderRole === 'PATIENT' ? 'person' : 'medical-services'}
                          size={14}
                          color={Colors.primary}
                        />
                      </View>
                    )}
                    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                      {!isMe && <Text style={styles.senderLabel}>{msg.senderName}</Text>}
                      <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{msg.text}</Text>
                      <Text style={[styles.timestamp, isMe && styles.timestampMe]}>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.inputSection}>
            <View style={styles.inputPill}>
              <TextInput
                style={styles.chatInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                placeholderTextColor={Colors.onSurfaceVariant}
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <MaterialIcons name="send" size={18} color={inputText.trim() ? Colors.white : Colors.outline} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', minHeight: '60%', flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineLight, gap: 12 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Colors.onSurface },
  headerSub: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerText: { fontSize: 13, color: Colors.onSurfaceVariant, textAlign: 'center' },
  messagesList: { flex: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  avatarCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, ...Shadows.sm },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineLight, borderBottomLeftRadius: 4 },
  senderLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  msgText: { fontSize: 13, lineHeight: 19, color: Colors.onSurface },
  msgTextMe: { color: Colors.white },
  timestamp: { fontSize: 9.5, color: Colors.outline, marginTop: 4, alignSelf: 'flex-end' },
  timestampMe: { color: 'rgba(255,255,255,0.7)' },
  inputSection: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.outlineLight, backgroundColor: Colors.surfaceContainerLowest },
  inputPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineLight, borderRadius: Radii.full, paddingLeft: 14, paddingRight: 6, paddingVertical: Platform.OS === 'ios' ? 8 : 4 },
  chatInput: { flex: 1, fontSize: 13, color: Colors.onSurface, paddingHorizontal: 8 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.surfaceContainerHigh },
});
