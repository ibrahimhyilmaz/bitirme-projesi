// Web Audio API and WebRTC Voice Mesh Utility

class SoundEffects {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
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

export class VoiceManager {
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private isMuted: boolean = true;
  private isDeafened: boolean = false;
  private onSpeakingChange: (isSpeaking: boolean, volume: number) => void;
  private onSignalNeeded: (targetUserId: string, signal: unknown) => void;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private userVolumes: Map<string, number> = new Map();
  private isMicAvailable: boolean = false;

  constructor(
    onSpeakingChange: (isSpeaking: boolean, volume: number) => void,
    onSignalNeeded: (targetUserId: string, signal: unknown) => void
  ) {
    this.onSpeakingChange = onSpeakingChange;
    this.onSignalNeeded = onSignalNeeded;
  }

  async initLocalMicrophone(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Microphone access is not supported in this browser.');
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

      // Start muted by default for privacy
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });

      // Setup analyser for voice volume detection
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;
      source.connect(this.analyser);

      this.startVolumeMonitoring();
      return true;
    } catch (err) {
      console.warn('Microphone permission denied or not available:', err);
      this.isMicAvailable = false;
      return false;
    }
  }

  private startVolumeMonitoring() {
    if (!this.analyser) return;
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
      // Normalise 0..100
      const volume = Math.min(100, Math.round((average / 128) * 100));

      const isSpeakingNow = !this.isMuted && volume > 16;
      if (isSpeakingNow) {
        speakingCounter = 4;
      } else if (speakingCounter > 0) {
        speakingCounter--;
      }

      this.onSpeakingChange(speakingCounter > 0, volume);
      this.animFrameId = requestAnimationFrame(checkVolume);
    };

    this.animFrameId = requestAnimationFrame(checkVolume);
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
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
    return this.userVolumes.get(userId) ?? 100;
  }

  // WebRTC Peer Connection for Mesh Audio
  async connectToPeer(remoteUserId: string, isInitiator: boolean) {
    if (this.peerConnections.has(remoteUserId)) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      this.peerConnections.set(remoteUserId, pc);

      // Add local audio track if available
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, this.localStream!);
        });
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.onSignalNeeded(remoteUserId, {
            type: 'candidate',
            candidate: event.candidate,
          });
        }
      };

      // Handle Remote Audio Stream
      pc.ontrack = (event) => {
        let audio = this.remoteAudioElements.get(remoteUserId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audio.muted = this.isDeafened;
          const userVol = this.getUserVolume(remoteUserId);
          audio.volume = userVol / 100;
          this.remoteAudioElements.set(remoteUserId, audio);
        }
        audio.srcObject = event.streams[0];
        audio.play().catch(() => {
          // Autoplay policy fallback
        });
      };

      // Initiator creates offer
      if (isInitiator) {
        const offer = await pc.createOffer();
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

  async handleSignal(fromUserId: string, signal: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) {
    try {
      let pc = this.peerConnections.get(fromUserId);
      if (!pc) {
        await this.connectToPeer(fromUserId, false);
        pc = this.peerConnections.get(fromUserId);
      }
      if (!pc) return;

      if (signal.type === 'offer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.onSignalNeeded(fromUserId, {
          type: 'answer',
          sdp: pc.localDescription,
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'candidate' && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.warn('WebRTC signaling error:', err);
    }
  }

  removePeer(remoteUserId: string) {
    const pc = this.peerConnections.get(remoteUserId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remoteUserId);
    }
    const audio = this.remoteAudioElements.get(remoteUserId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      this.remoteAudioElements.delete(remoteUserId);
    }
    this.userVolumes.delete(remoteUserId);
  }

  cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.remoteAudioElements.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
    this.remoteAudioElements.clear();
  }
}
