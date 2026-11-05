// Web Audio API and WebRTC Voice & DataChannel Mesh Utility

class SoundEffects {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  playJoinSound() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio fallback
    }
  }

  playMuteSound(isMuted: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      if (isMuted) {
        osc.frequency.setValueAtTime(480, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(240, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.12);
      }
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio fallback
    }
  }

  playMessageSound() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio fallback
    }
  }

  playPingSound() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio fallback
    }
  }
}

export const soundEffects = new SoundEffects();

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export class VoiceManager {
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private isMuted: boolean = true;
  private isDeafened: boolean = false;
  private currentUserId: string = '';
  private onSpeakingChange: (isSpeaking: boolean, volume: number) => void;
  private onSignalNeeded: (targetUserId: string, signal: unknown) => void;
  private onDataChannelMessage?: (fromUserId: string, data: string) => void;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private userVolumes: Map<string, number> = new Map();
  private isMicAvailable: boolean = false;
  private lastSpeakingReported: boolean = false;
  private unlockGestureHandler: (() => void) | null = null;

  constructor(
    onSpeakingChange: (isSpeaking: boolean, volume: number) => void,
    onSignalNeeded: (targetUserId: string, signal: unknown) => void,
    onDataChannelMessage?: (fromUserId: string, data: string) => void
  ) {
    this.onSpeakingChange = onSpeakingChange;
    this.onSignalNeeded = onSignalNeeded;
    this.onDataChannelMessage = onDataChannelMessage;

    // Ensure browser autoplay policies unlock remote audio streams on any user interaction
    this.unlockGestureHandler = () => {
      this.resumeAllRemoteAudio();
    };
    window.addEventListener('pointerdown', this.unlockGestureHandler, { passive: true });
    window.addEventListener('keydown', this.unlockGestureHandler, { passive: true });
  }

  private resumeAllRemoteAudio() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    this.remoteAudioElements.forEach((audio) => {
      if (audio.paused && audio.srcObject) {
        audio.play().catch(() => {});
      }
    });
  }

  async initLocalMicrophone(): Promise<boolean> {
    if (this.localStream && this.isMicAvailable) {
      return true;
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.isMicAvailable = false;
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;
      this.isMicAvailable = true;

      // Apply current mute state
      const audioTrack = this.localStream.getAudioTracks()[0] || null;
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });

      // Attach or replace local audio track on all existing peer connections
      if (audioTrack) {
        for (const [peerId, pc] of this.peerConnections.entries()) {
          try {
            const transceivers = pc.getTransceivers();
            const audioTransceiver = transceivers.find(
              (t) =>
                t.sender.track?.kind === 'audio' ||
                t.receiver.track?.kind === 'audio'
            );

            if (audioTransceiver && audioTransceiver.sender) {
              if (audioTransceiver.direction === 'recvonly' || audioTransceiver.direction === 'inactive') {
                audioTransceiver.direction = 'sendrecv';
              }
              await audioTransceiver.sender.replaceTrack(audioTrack);
            } else {
              pc.addTrack(audioTrack, this.localStream);
            }

            if (pc.signalingState === 'stable') {
              const offer = await pc.createOffer({ offerToReceiveAudio: true });
              await pc.setLocalDescription(offer);
              this.onSignalNeeded(peerId, {
                type: 'offer',
                sdp: pc.localDescription,
              });
            }
          } catch {
            // Ignore renegotiation collision
          }
        }
      }

      // Setup analyser for voice volume detection
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;
      source.connect(this.analyser);

      this.startVolumeMonitoring();
      return true;
    } catch {
      this.isMicAvailable = false;
      return false;
    }
  }

  private startVolumeMonitoring() {
    if (!this.analyser) return;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    let speakingCounter = 0;

    const checkVolume = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const volume = Math.min(100, Math.round((average / 128) * 100));

      const isSpeakingNow = !this.isMuted && volume > 14;
      if (isSpeakingNow) {
        speakingCounter = 6;
      } else if (speakingCounter > 0) {
        speakingCounter--;
      }

      const activeSpeaking = speakingCounter > 0;
      if (activeSpeaking !== this.lastSpeakingReported || !this.isMuted) {
        this.lastSpeakingReported = activeSpeaking;
        this.onSpeakingChange(activeSpeaking, this.isMuted ? 0 : volume);
      }

      this.animFrameId = requestAnimationFrame(checkVolume);
    };

    this.animFrameId = requestAnimationFrame(checkVolume);
  }

  async setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!muted && !this.localStream) {
      await this.initLocalMicrophone();
    }
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    this.resumeAllRemoteAudio();
    if (muted) {
      this.lastSpeakingReported = false;
      this.onSpeakingChange(false, 0);
    }
    soundEffects.playMuteSound(muted);
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    this.remoteAudioElements.forEach((audio) => {
      audio.muted = deafened;
    });
    this.resumeAllRemoteAudio();
  }

  getDeafened(): boolean {
    return this.isDeafened;
  }

  setUserVolume(userId: string, volume: number) {
    this.userVolumes.set(userId, volume);
    const audio = this.remoteAudioElements.get(userId);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume / 100));
    }
  }

  getUserVolume(userId: string): number {
    if (this.userVolumes.has(userId)) {
      return this.userVolumes.get(userId)!;
    }
    try {
      const saved = localStorage.getItem('collab_peer_volumes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed[userId] === 'number') {
          this.userVolumes.set(userId, parsed[userId]);
          return parsed[userId];
        }
      }
    } catch {
      // Ignore storage error
    }
    return 100;
  }

  broadcastDataChannel(payload: string) {
    for (const dc of this.dataChannels.values()) {
      if (dc.readyState === 'open') {
        try {
          dc.send(payload);
        } catch {
          // Ignore send error
        }
      }
    }
  }

  syncPeers(activeUserIds: string[], currentUserId: string) {
    this.currentUserId = currentUserId;
    const activeSet = new Set(activeUserIds);
    // Remove disconnected peers
    for (const existingPeerId of this.peerConnections.keys()) {
      if (!activeSet.has(existingPeerId)) {
        this.removePeer(existingPeerId);
      }
    }
    // Connect to new peers
    for (const userId of activeUserIds) {
      if (userId !== currentUserId && !this.peerConnections.has(userId)) {
        const isInitiator = currentUserId < userId;
        this.connectToPeer(userId, isInitiator);
      }
    }
  }

  private setupDataChannel(remoteUserId: string, dc: RTCDataChannel) {
    this.dataChannels.set(remoteUserId, dc);
    dc.onmessage = (event) => {
      if (this.onDataChannelMessage && typeof event.data === 'string') {
        this.onDataChannelMessage(remoteUserId, event.data);
      }
    };
    dc.onclose = () => {
      if (this.dataChannels.get(remoteUserId) === dc) {
        this.dataChannels.delete(remoteUserId);
      }
    };
  }

  // WebRTC Peer Connection for Mesh Audio + Fast DataChannel
  async connectToPeer(remoteUserId: string, isInitiator: boolean) {
    if (this.peerConnections.has(remoteUserId)) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: DEFAULT_ICE_SERVERS,
      });

      this.peerConnections.set(remoteUserId, pc);
      if (!this.pendingCandidates.has(remoteUserId)) {
        this.pendingCandidates.set(remoteUserId, []);
      }

      // Add local audio track if available, or pre-allocate sendrecv audio transceiver
      // so audio can be attached seamlessly when the user unmutes later
      const hasLocalAudio =
        this.localStream && this.localStream.getAudioTracks().length > 0;
      if (hasLocalAudio && this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, this.localStream!);
        });
      } else {
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        } catch {
          // Fallback if browser doesn't support addTransceiver
        }
      }

      // Setup P2P DataChannel for ultra-fast drawing/cursor/presence sync
      if (isInitiator) {
        try {
          const dc = pc.createDataChannel('collabboard-sync', { ordered: false });
          this.setupDataChannel(remoteUserId, dc);
        } catch {
          // Ignore DataChannel error
        }
      } else {
        pc.ondatachannel = (event) => {
          if (event.channel) {
            this.setupDataChannel(remoteUserId, event.channel);
          }
        };
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.onSignalNeeded(remoteUserId, {
            type: 'candidate',
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          this.removePeer(remoteUserId);
        }
      };

      // Handle Remote Audio Stream
      pc.ontrack = (event) => {
        let audio = this.remoteAudioElements.get(remoteUserId);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.setAttribute('playsinline', 'true');
          audio.style.display = 'none';
          audio.muted = this.isDeafened;
          const userVol = this.getUserVolume(remoteUserId);
          audio.volume = Math.max(0, Math.min(1, userVol / 100));
          document.body.appendChild(audio);
          this.remoteAudioElements.set(remoteUserId, audio);
        }
        const stream =
          event.streams && event.streams[0]
            ? event.streams[0]
            : new MediaStream([event.track]);
        if (audio.srcObject !== stream) {
          audio.srcObject = stream;
        }
        audio.play().catch(() => {
          // Autoplay will be unlocked on next user pointerdown/keydown
        });
      };

      // Initiator creates offer
      if (isInitiator) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        await pc.setLocalDescription(offer);
        this.onSignalNeeded(remoteUserId, {
          type: 'offer',
          sdp: pc.localDescription,
        });
      }
    } catch (err) {
      console.warn('Error connecting to peer:', remoteUserId, err);
    }
  }

  private async flushPendingCandidates(peerId: string, pc: RTCPeerConnection) {
    const queue = this.pendingCandidates.get(peerId);
    if (!queue || queue.length === 0) return;
    this.pendingCandidates.set(peerId, []);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore candidate error
      }
    }
  }

  async handleSignal(
    fromUserId: string,
    signal: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
  ) {
    try {
      let pc = this.peerConnections.get(fromUserId);
      if (!pc) {
        await this.connectToPeer(fromUserId, false);
        pc = this.peerConnections.get(fromUserId);
      }
      if (!pc) return;

      const isPolite = this.currentUserId > fromUserId;

      if (signal.type === 'offer' && signal.sdp) {
        const offerCollision = pc.signalingState !== 'stable';
        if (offerCollision) {
          if (!isPolite) {
            return;
          }
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription(signal.sdp)),
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }

        // Ensure local audio track is attached if microphone is active
        if (this.localStream) {
          const audioTrack = this.localStream.getAudioTracks()[0];
          if (audioTrack) {
            const audioTransceiver = pc
              .getTransceivers()
              .find(
                (t) =>
                  t.sender.track?.kind === 'audio' ||
                  t.receiver.track?.kind === 'audio'
              );
            if (audioTransceiver) {
              audioTransceiver.direction = 'sendrecv';
              await audioTransceiver.sender.replaceTrack(audioTrack).catch(() => {});
            }
          }
        }

        await this.flushPendingCandidates(fromUserId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.onSignalNeeded(fromUserId, {
          type: 'answer',
          sdp: pc.localDescription,
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await this.flushPendingCandidates(fromUserId, pc);
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          const queue = this.pendingCandidates.get(fromUserId) || [];
          queue.push(signal.candidate);
          this.pendingCandidates.set(fromUserId, queue);
        }
      }
    } catch (err) {
      console.warn('WebRTC signaling error:', err);
    }
  }

  removePeer(remoteUserId: string) {
    const dc = this.dataChannels.get(remoteUserId);
    if (dc) {
      try {
        dc.close();
      } catch {}
      this.dataChannels.delete(remoteUserId);
    }
    const pc = this.peerConnections.get(remoteUserId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remoteUserId);
    }
    this.pendingCandidates.delete(remoteUserId);
    const audio = this.remoteAudioElements.get(remoteUserId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      this.remoteAudioElements.delete(remoteUserId);
    }
  }

  cleanup() {
    if (this.unlockGestureHandler) {
      window.removeEventListener('pointerdown', this.unlockGestureHandler);
      window.removeEventListener('keydown', this.unlockGestureHandler);
      this.unlockGestureHandler = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
    }
    this.dataChannels.forEach((dc) => {
      try {
        dc.close();
      } catch {}
    });
    this.dataChannels.clear();
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.pendingCandidates.clear();
    this.remoteAudioElements.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
    this.remoteAudioElements.clear();
  }
}
