/**
 * RuralCare WebRTC Calling Engine
 *
 * Uses native browser WebRTC APIs (RTCPeerConnection, getUserMedia).
 * Manages WebSocket signaling connection and WebRTC peer connections
 * for 1-to-1 voice/video calls between patients and doctors.
 *
 * Works in both Expo Web builds and standard browsers.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type CallType = 'video' | 'voice';
export type CallStatus =
  | 'idle'
  | 'initiating'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended';

export interface CallState {
  callId: string;
  appointmentId: string;
  callType: CallType;
  status: CallStatus;
  callerName?: string;
  callerRole?: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeaker: boolean;
  startTime?: Date;
  connectedTime?: Date;
  duration: number;
}

export interface IncomingCallInfo {
  callId: string;
  appointmentId: string;
  callType: CallType;
  callerName: string;
  callerRole: string;
}

type CallEventType =
  | 'incoming'
  | 'ringing'
  | 'accepted'
  | 'connected'
  | 'ended'
  | 'declined'
  | 'missed'
  | 'error'
  | 'remoteStream'
  | 'localStream'
  | 'modeSwitched'
  | 'wsConnected'
  | 'wsDisconnected'
  | 'stateChange';

type CallEventListener = (data: any) => void;

// ── ICE / STUN servers ───────────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ── Engine ────────────────────────────────────────────────────────────────────

export class WebRTCCallingEngine {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private wsUrl: string;
  private token: string = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<CallEventType, Set<CallEventListener>> = new Map();
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private isOfferer = false;

  currentCall: CallState | null = null;
  isWsConnected = false;

  constructor(serverBaseUrl?: string) {
    const base = (serverBaseUrl || this.resolveBaseUrl()).replace(/\/+$/, '');
    const wsProto = base.startsWith('https') ? 'wss:' : 'ws:';
    this.wsUrl = base.replace(/^https?:/, wsProto) + '/ws/call';
  }

  private resolveBaseUrl(): string {
    const envUrl = process.env.EXPO_PUBLIC_API_URL;
    if (envUrl && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.location) {
      const { hostname, protocol } = window.location;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//localhost:4000`;
      }
      return `${protocol}//${hostname}:4000`;
    }
    return 'https://ruralcare-sia2.onrender.com';
  }

  // ── Events ───────────────────────────────────────────────────────────────

  on(event: CallEventType, listener: CallEventListener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off(event: CallEventType, listener: CallEventListener) {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: CallEventType, data?: any) {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(data); } catch (e) { console.error('[CallingEngine] listener error:', e); }
    });
  }

  // ── WebSocket Connection ─────────────────────────────────────────────────

  connect(authToken: string) {
    this.token = authToken;
    this.doConnect();
  }

  disconnect() {
    this.clearReconnect();
    this.clearKeepAlive();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.isWsConnected = false;
    this.emit('wsDisconnected');
  }

  private doConnect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = `${this.wsUrl}?token=${encodeURIComponent(this.token)}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startKeepAlive();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          this.handleSignalingMessage(msg);
        } catch {}
      };

      this.ws.onclose = () => {
        this.isWsConnected = false;
        this.clearKeepAlive();
        this.emit('wsDisconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.clearReconnect();
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  private startKeepAlive() {
    this.clearKeepAlive();
    this.keepAliveTimer = setInterval(() => this.send({ type: 'ping' }), 25000);
  }

  private clearKeepAlive() {
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
  }

  private send(msg: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ── Signaling Message Handler ────────────────────────────────────────────

  private handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case 'connected':
        this.isWsConnected = true;
        this.emit('wsConnected', msg);
        break;

      case 'call:initiated':
        this.isOfferer = true;
        this.currentCall = {
          callId: msg.callId,
          appointmentId: msg.appointmentId,
          callType: msg.callType,
          status: 'initiating',
          isMuted: false,
          isCameraOff: msg.callType === 'voice',
          isSpeaker: true,
          startTime: new Date(),
          duration: 0,
        };
        this.emit('stateChange', { ...this.currentCall });
        if (!msg.calleeOnline) {
          this.emit('error', { callId: msg.callId, error: 'The other party is not online right now.' });
        }
        break;

      case 'call:ringing':
        if (this.currentCall) {
          this.currentCall.status = 'ringing';
          this.emit('ringing', { callId: msg.callId });
          this.emit('stateChange', { ...this.currentCall });
        }
        break;

      case 'call:incoming':
        this.isOfferer = false;
        this.currentCall = {
          callId: msg.callId,
          appointmentId: msg.appointmentId,
          callType: msg.callType,
          status: 'ringing',
          callerName: msg.callerName,
          callerRole: msg.callerRole,
          isMuted: false,
          isCameraOff: msg.callType === 'voice',
          isSpeaker: msg.callType === 'video',
          startTime: new Date(),
          duration: 0,
        };
        this.emit('incoming', {
          callId: msg.callId,
          appointmentId: msg.appointmentId,
          callType: msg.callType,
          callerName: msg.callerName,
          callerRole: msg.callerRole,
        } as IncomingCallInfo);
        this.emit('stateChange', { ...this.currentCall });
        break;

      case 'call:accepted':
        if (this.currentCall) {
          this.currentCall.status = 'connecting';
          this.emit('accepted', { callId: msg.callId });
          this.emit('stateChange', { ...this.currentCall });
          if (this.isOfferer) {
            this.startWebRTC();
          }
        }
        break;

      case 'call:signal':
        this.handleWebRTCSignal(msg.signal);
        break;

      case 'call:declined':
        this.cleanup();
        this.emit('declined', { callId: msg.callId });
        break;

      case 'call:missed':
        this.cleanup();
        this.emit('missed', { callId: msg.callId });
        break;

      case 'call:ended':
        this.cleanup();
        this.emit('ended', { callId: msg.callId, reason: msg.reason });
        break;

      case 'call:mode_switched':
        if (this.currentCall) {
          this.currentCall.callType = msg.callType;
          this.emit('modeSwitched', { callType: msg.callType });
          this.emit('stateChange', { ...this.currentCall });
        }
        break;

      case 'call:error':
        this.emit('error', { error: msg.error });
        break;

      case 'session_replaced':
        this.disconnect();
        this.emit('error', { error: 'Session replaced by another connection.' });
        break;

      case 'pong': break;
      default: break;
    }
  }

  // ── Call Actions ─────────────────────────────────────────────────────────

  initiateCall(appointmentId: string, callType: CallType = 'video') {
    this.send({ type: 'call:initiate', appointmentId, callType });
  }

  acceptCall(callId: string) {
    if (!this.currentCall || this.currentCall.callId !== callId) return;
    this.send({ type: 'call:accept', callId });
  }

  declineCall(callId: string) {
    this.send({ type: 'call:decline', callId });
    this.cleanup();
  }

  endCall(callId?: string) {
    const id = callId || this.currentCall?.callId;
    if (id) this.send({ type: 'call:end', callId: id });
    this.cleanup();
    this.emit('ended', { callId: id, reason: 'user_ended' });
  }

  // ── Media Controls ───────────────────────────────────────────────────────

  toggleMute(): boolean {
    if (!this.localStream || !this.currentCall) return false;
    const newMuted = !this.currentCall.isMuted;
    this.localStream.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
    this.currentCall.isMuted = newMuted;
    this.emit('stateChange', { ...this.currentCall });
    return newMuted;
  }

  toggleCamera(): boolean {
    if (!this.localStream || !this.currentCall) return false;
    const newOff = !this.currentCall.isCameraOff;
    this.localStream.getVideoTracks().forEach((t) => (t.enabled = !newOff));
    this.currentCall.isCameraOff = newOff;
    this.emit('stateChange', { ...this.currentCall });
    return newOff;
  }

  switchCallMode(callType: CallType) {
    if (!this.currentCall) return;
    this.send({ type: 'call:switch_mode', callId: this.currentCall.callId, callType });
    this.currentCall.callType = callType;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((t) => (t.enabled = callType === 'video'));
      this.currentCall.isCameraOff = callType === 'voice';
    }
    this.emit('modeSwitched', { callType });
    this.emit('stateChange', { ...this.currentCall });
  }

  getLocalStream(): MediaStream | null { return this.localStream; }
  getRemoteStream(): MediaStream | null { return this.remoteStream; }

  // ── WebRTC ───────────────────────────────────────────────────────────────

  private async startWebRTC() {
    try {
      await this.acquireMedia();
      this.createPeerConnection();

      if (this.pc) {
        if (this.localStream) {
          this.localStream.getTracks().forEach((track) => {
            this.pc!.addTrack(track, this.localStream!);
          });
        }

        const offer = await this.pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await this.pc.setLocalDescription(offer);

        this.send({
          type: 'call:signal',
          callId: this.currentCall!.callId,
          signal: { type: 'offer', sdp: offer.sdp },
        });
      } else {
        // In native Android runtime without browser RTCPeerConnection:
        // Signaling is still active over WebSocket so both parties stay connected.
        this.markConnected();
      }
    } catch (err: any) {
      console.warn('[WebRTC] Media track initialization warning:', err);
      // Fallback: keep signaling call active without ending call
      this.markConnected();
    }
  }

  private async handleWebRTCSignal(signal: any) {
    try {
      if (signal.type === 'offer') {
        await this.acquireMedia();
        this.createPeerConnection();

        if (this.pc) {
          if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
              this.pc!.addTrack(track, this.localStream!);
            });
          }

          await this.pc.setRemoteDescription(new (RTCSessionDescription as any)({ type: 'offer', sdp: signal.sdp }));

          for (const c of this.pendingIceCandidates) {
            await this.pc.addIceCandidate(new (RTCIceCandidate as any)(c));
          }
          this.pendingIceCandidates = [];

          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);

          this.send({
            type: 'call:signal',
            callId: this.currentCall!.callId,
            signal: { type: 'answer', sdp: answer.sdp },
          });
        } else {
          this.markConnected();
        }
      } else if (signal.type === 'answer') {
        if (this.pc) {
          await this.pc.setRemoteDescription(new (RTCSessionDescription as any)({ type: 'answer', sdp: signal.sdp }));
          for (const c of this.pendingIceCandidates) {
            await this.pc.addIceCandidate(new (RTCIceCandidate as any)(c));
          }
          this.pendingIceCandidates = [];
        }
      } else if (signal.candidate) {
        if (this.pc && this.pc.remoteDescription && typeof RTCIceCandidate !== 'undefined') {
          const candidate = new (RTCIceCandidate as any)(signal);
          await this.pc.addIceCandidate(candidate);
        } else {
          this.pendingIceCandidates.push(signal);
        }
      }
    } catch (err: any) {
      console.warn('[WebRTC] Signal handling notice:', err);
    }
  }

  private markConnected() {
    if (this.currentCall && this.currentCall.status !== 'connected') {
      this.currentCall.status = 'connected';
      this.currentCall.connectedTime = new Date();
      this.startDurationTimer();
      this.emit('connected', { callId: this.currentCall.callId });
      this.emit('stateChange', { ...this.currentCall });
    }
  }

  private createPeerConnection() {
    if (this.pc) return;

    const PeerConnectionClass =
      (typeof window !== 'undefined' && (window as any).RTCPeerConnection) ||
      (typeof global !== 'undefined' && (global as any).RTCPeerConnection);

    if (!PeerConnectionClass) {
      console.log('[WebRTC] RTCPeerConnection not present in native Hermes runtime; signaling-only mode.');
      return;
    }

    try {
      this.pc = new PeerConnectionClass({ iceServers: ICE_SERVERS });

      this.pc!.onicecandidate = (event: any) => {
        if (event.candidate && this.currentCall) {
          this.send({
            type: 'call:signal',
            callId: this.currentCall.callId,
            signal: typeof event.candidate.toJSON === 'function' ? event.candidate.toJSON() : event.candidate,
          });
        }
      };

      this.pc!.ontrack = (event: any) => {
        let stream = event.streams?.[0];
        if (!stream) {
          if (!this.remoteStream && typeof MediaStream !== 'undefined') {
            this.remoteStream = new MediaStream();
          }
          if (this.remoteStream) {
            this.remoteStream.addTrack(event.track);
          }
          stream = this.remoteStream;
        } else {
          this.remoteStream = stream;
        }
        if (this.remoteStream) {
          this.emit('remoteStream', this.remoteStream);
        }
        this.markConnected();
      };

      this.pc!.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === 'connected') {
          this.markConnected();
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          if (this.currentCall && this.currentCall.status === 'connected') {
            this.endCall();
          }
        }
      };

      this.pc!.oniceconnectionstatechange = () => {
        const state = this.pc?.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          this.markConnected();
        }
      };
    } catch (e) {
      console.warn('[WebRTC] PeerConnection init warning:', e);
    }
  }

  private async acquireMedia() {
    if (this.localStream) return;

    const isVideo = this.currentCall?.callType === 'video';
    const hasMedia = typeof navigator !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia;

    if (!hasMedia) {
      console.log('[WebRTC] Native device media capture not present; operating signaling stream.');
      return;
    }

    if (isVideo) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
      } catch (err1) {
        console.warn('[WebRTC] Strict video constraints failed, trying basic video:', err1);
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
        } catch (err2) {
          console.warn('[WebRTC] Camera unavailable, falling back to audio:', err2);
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            if (this.currentCall) {
              this.currentCall.isCameraOff = true;
            }
          } catch (err3) {
            console.error('[WebRTC] Audio also unavailable:', err3);
          }
        }
      }
    } else {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } catch (err) {
        console.warn('[WebRTC] Microphone unavailable:', err);
      }
    }

    if (this.localStream) {
      this.emit('localStream', this.localStream);
    }
  }

  private startDurationTimer() {
    this.stopDurationTimer();
    this.durationTimer = setInterval(() => {
      if (this.currentCall?.connectedTime) {
        this.currentCall.duration = Math.floor(
          (Date.now() - this.currentCall.connectedTime.getTime()) / 1000
        );
        this.emit('stateChange', { ...this.currentCall });
      }
    }, 1000);
  }

  private stopDurationTimer() {
    if (this.durationTimer) { clearInterval(this.durationTimer); this.durationTimer = null; }
  }

  private cleanup() {
    this.stopDurationTimer();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.remoteStream = null;
    if (this.pc) { this.pc.close(); this.pc = null; }
    this.pendingIceCandidates = [];
    this.currentCall = null;
    this.isOfferer = false;
  }

  destroy() {
    this.disconnect();
    this.cleanup();
    this.listeners.clear();
  }
}

// Singleton
let _instance: WebRTCCallingEngine | null = null;

export function getCallingEngine(): WebRTCCallingEngine {
  if (!_instance) _instance = new WebRTCCallingEngine();
  return _instance;
}

export function destroyCallingEngine() {
  if (_instance) { _instance.destroy(); _instance = null; }
}
