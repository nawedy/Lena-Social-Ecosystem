import { EventEmitter } from 'events';
import { configService } from '../config/GlobalConfig';
import { errorService } from '../error/ErrorService';
import { loggingService } from '../logging/LoggingService';
import { tracingService } from '../monitoring/TracingService';
import { performanceService } from '../optimization/PerformanceService';

interface StreamConfig {
  maxBitrate: number;
  minBitrate: number;
  targetBitrate: number;
  resolution: {
    width: number;
    height: number;
  };
  frameRate: number;
  keyFrameInterval: number;
  audioConfig: {
    sampleRate: number;
    channelCount: number;
    bitrate: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
  };
  rtmpConfig: {
    url: string;
    key: string;
  };
  iceServers: RTCIceServer[];
  adaptiveBitrate: boolean;
  lowLatencyMode: boolean;
}

interface StreamStats {
  bitrate: number;
  packetLoss: number;
  frameRate: number;
  resolution: {
    width: number;
    height: number;
  };
  audioLevel: number;
  networkQuality: number;
  latency: number;
  viewers: number;
  uptime: number;
}

interface StreamSession {
  id: string;
  userId: string;
  title: string;
  description: string;
  startTime: number;
  status: 'initializing' | 'live' | 'paused' | 'ended' | 'error';
  stats: StreamStats;
  error?: string;
}

class LiveStreamService extends EventEmitter {
  private static instance: LiveStreamService;
  private sessions: Map<string, StreamSession> = new Map();
  private config: StreamConfig;
  private mediaRecorder: MediaRecorder | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private mediaStream: MediaStream | null = null;
  private websocket: WebSocket | null = null;
  private statsInterval: number | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  private constructor() {
    super();
    this.setupConfig();
  }

  static getInstance(): LiveStreamService {
    if (!LiveStreamService.instance) {
      LiveStreamService.instance = new LiveStreamService();
    }
    return LiveStreamService.instance;
  }

  private setupConfig() {
    this.config = {
      maxBitrate: 6000000, // 6 Mbps
      minBitrate: 500000,  // 500 Kbps
      targetBitrate: 2500000, // 2.5 Mbps
      resolution: {
        width: 1920,
        height: 1080
      },
      frameRate: 30,
      keyFrameInterval: 2, // seconds
      audioConfig: {
        sampleRate: 48000,
        channelCount: 2,
        bitrate: 128000, // 128 Kbps
        echoCancellation: true,
        noiseSuppression: true
      },
      rtmpConfig: {
        url: 'rtmp://streaming.example.com/live',
        key: ''
      },
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:turn.example.com:3478',
          username: 'username',
          credential: 'password'
        }
      ],
      adaptiveBitrate: true,
      lowLatencyMode: true
    };
  }

  async startStream(options: {
    userId: string;
    title: string;
    description: string;
    rtmpKey?: string;
  }): Promise<string> {
    return tracingService.trace('stream.start', async (span) => {
      try {
        const sessionId = crypto.randomUUID();
        const session: StreamSession = {
          id: sessionId,
          userId: options.userId,
          title: options.title,
          description: options.description,
          startTime: Date.now(),
          status: 'initializing',
          stats: {
            bitrate: 0,
            packetLoss: 0,
            frameRate: 0,
            resolution: { width: 0, height: 0 },
            audioLevel: 0,
            networkQuality: 0,
            latency: 0,
            viewers: 0,
            uptime: 0
          }
        };

        span.setAttributes({
          'stream.session_id': sessionId,
          'stream.user_id': options.userId
        });

        // Update RTMP key if provided
        if (options.rtmpKey) {
          this.config.rtmpConfig.key = options.rtmpKey;
        }

        // Initialize WebRTC
        await this.initializeWebRTC(sessionId);

        // Initialize RTMP connection
        await this.initializeRTMP(sessionId);

        // Start stats monitoring
        this.startStatsMonitoring(sessionId);

        session.status = 'live';
        this.sessions.set(sessionId, session);

        this.emit('stream_started', {
          sessionId,
          userId: options.userId,
          title: options.title
        });

        return sessionId;
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'LiveStreamService',
          action: 'startStream',
          userId: options.userId
        });
        throw error;
      }
    });
  }

  private async initializeWebRTC(sessionId: string): Promise<void> {
    return tracingService.trace('stream.init_webrtc', async (span) => {
      try {
        // Get media stream
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: this.config.resolution.width },
            height: { ideal: this.config.resolution.height },
            frameRate: { ideal: this.config.frameRate }
          },
          audio: {
            sampleRate: this.config.audioConfig.sampleRate,
            channelCount: this.config.audioConfig.channelCount,
            echoCancellation: this.config.audioConfig.echoCancellation,
            noiseSuppression: this.config.audioConfig.noiseSuppression
          }
        });

        // Create peer connection
        this.peerConnection = new RTCPeerConnection({
          iceServers: this.config.iceServers
        });

        // Add tracks to peer connection
        this.mediaStream.getTracks().forEach(track => {
          this.peerConnection?.addTrack(track, this.mediaStream!);
        });

        // Set up event handlers
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            // Send candidate to signaling server
            this.websocket?.send(JSON.stringify({
              type: 'candidate',
              candidate: event.candidate
            }));
          }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
          const state = this.peerConnection?.iceConnectionState;
          loggingService.info('ICE connection state changed', { state });

          if (state === 'failed' || state === 'disconnected') {
            this.handleConnectionFailure(sessionId);
          }
        };

        // Create and set local description
        const offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false
        });

        await this.peerConnection.setLocalDescription(offer);

        // Configure encodings for simulcast
        const sender = this.peerConnection.getSenders()[0];
        const params = sender.getParameters();
        params.encodings = [
          { maxBitrate: this.config.maxBitrate, priority: 'high' },
          { maxBitrate: this.config.targetBitrate, priority: 'medium', scaleResolutionDownBy: 1.5 },
          { maxBitrate: this.config.minBitrate, priority: 'low', scaleResolutionDownBy: 2 }
        ];
        await sender.setParameters(params);

        span.setAttributes({
          'webrtc.ice_servers': this.config.iceServers.length,
          'webrtc.resolution': `${this.config.resolution.width}x${this.config.resolution.height}`,
          'webrtc.framerate': this.config.frameRate
        });

      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'LiveStreamService',
          action: 'initializeWebRTC',
          sessionId
        });
        throw error;
      }
    });
  }

  private async initializeRTMP(sessionId: string): Promise<void> {
    return tracingService.trace('stream.init_rtmp', async (span) => {
      try {
        // Initialize WebSocket connection to RTMP server
        this.websocket = new WebSocket(this.config.rtmpConfig.url);

        this.websocket.onopen = () => {
          // Send stream key and metadata
          this.websocket?.send(JSON.stringify({
            type: 'auth',
            key: this.config.rtmpConfig.key,
            sessionId
          }));
        };

        this.websocket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'ready':
              // Start sending media data
              this.startMediaTransmission(sessionId);
              break;
            case 'viewer_count':
              this.updateViewerCount(sessionId, data.count);
              break;
            case 'error':
              this.handleStreamError(sessionId, data.error);
              break;
          }
        };

        this.websocket.onerror = (error) => {
          this.handleStreamError(sessionId, 'WebSocket connection error');
        };

        this.websocket.onclose = () => {
          this.handleConnectionFailure(sessionId);
        };

        span.setAttributes({
          'rtmp.url': this.config.rtmpConfig.url,
          'rtmp.has_key': !!this.config.rtmpConfig.key
        });

      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'LiveStreamService',
          action: 'initializeRTMP',
          sessionId
        });
        throw error;
      }
    });
  }

  private startMediaTransmission(sessionId: string) {
    if (!this.mediaStream) return;

    // Create MediaRecorder for RTMP streaming
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: this.config.targetBitrate
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(event.data);
      }
    };

    this.mediaRecorder.onerror = (error) => {
      this.handleStreamError(sessionId, 'MediaRecorder error');
    };

    // Start recording with small timeslice for low latency
    this.mediaRecorder.start(100);
  }

  private startStatsMonitoring(sessionId: string) {
    this.statsInterval = window.setInterval(async () => {
      if (!this.peerConnection) return;

      const stats = await this.peerConnection.getStats();
      let currentStats: StreamStats = {
        bitrate: 0,
        packetLoss: 0,
        frameRate: 0,
        resolution: { width: 0, height: 0 },
        audioLevel: 0,
        networkQuality: 0,
        latency: 0,
        viewers: 0,
        uptime: 0
      };

      stats.forEach(report => {
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          currentStats.bitrate = report.bitrate || 0;
          currentStats.frameRate = report.framesPerSecond || 0;
          currentStats.packetLoss = report.packetsLost || 0;
        } else if (report.type === 'track' && report.kind === 'video') {
          currentStats.resolution = {
            width: report.frameWidth || 0,
            height: report.frameHeight || 0
          };
        } else if (report.type === 'media-source' && report.kind === 'audio') {
          currentStats.audioLevel = report.audioLevel || 0;
        }
      });

      // Calculate network quality (0-5)
      currentStats.networkQuality = this.calculateNetworkQuality(currentStats);

      // Update session stats
      const session = this.sessions.get(sessionId);
      if (session) {
        session.stats = {
          ...currentStats,
          uptime: (Date.now() - session.startTime) / 1000
        };
        this.sessions.set(sessionId, session);

        // Emit stats update
        this.emit('stats_updated', {
          sessionId,
          stats: session.stats
        });

        // Adjust bitrate if adaptive bitrate is enabled
        if (this.config.adaptiveBitrate) {
          this.adjustBitrate(sessionId, currentStats);
        }
      }
    }, 1000);
  }

  private calculateNetworkQuality(stats: StreamStats): number {
    const bitrateScore = Math.min(stats.bitrate / this.config.targetBitrate, 1) * 2;
    const packetLossScore = Math.max(0, 1 - (stats.packetLoss / 100)) * 2;
    const frameRateScore = Math.min(stats.frameRate / this.config.frameRate, 1);
    return Math.round((bitrateScore + packetLossScore + frameRateScore) * 5 / 5);
  }

  private async adjustBitrate(sessionId: string, stats: StreamStats) {
    if (!this.peerConnection) return;

    const sender = this.peerConnection.getSenders()[0];
    const params = sender.getParameters();

    if (!params.encodings) return;

    // Adjust bitrate based on network conditions
    if (stats.networkQuality <= 2) {
      // Poor network conditions - reduce bitrate
      params.encodings[0].maxBitrate = Math.max(
        this.config.minBitrate,
        params.encodings[0].maxBitrate! * 0.8
      );
    } else if (stats.networkQuality >= 4) {
      // Good network conditions - increase bitrate
      params.encodings[0].maxBitrate = Math.min(
        this.config.maxBitrate,
        params.encodings[0].maxBitrate! * 1.2
      );
    }

    await sender.setParameters(params);
  }

  private updateViewerCount(sessionId: string, count: number) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.stats.viewers = count;
      this.sessions.set(sessionId, session);
    }
  }

  private async handleConnectionFailure(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'ended') return;

    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      loggingService.warn('Connection failed, attempting reconnect', {
        sessionId,
        attempt: this.reconnectAttempts
      });

      try {
        // Clean up existing connections
        this.cleanup();

        // Reinitialize connections
        await this.initializeWebRTC(sessionId);
        await this.initializeRTMP(sessionId);

        this.reconnectAttempts = 0;
      } catch (error) {
        this.handleStreamError(sessionId, 'Reconnection failed');
      }
    } else {
      this.handleStreamError(sessionId, 'Maximum reconnection attempts reached');
    }
  }

  private handleStreamError(sessionId: string, errorMessage: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'error';
      session.error = errorMessage;
      this.sessions.set(sessionId, session);

      this.emit('stream_error', {
        sessionId,
        error: errorMessage
      });

      errorService.handleError(new Error(errorMessage), {
        component: 'LiveStreamService',
        action: 'handleStreamError',
        sessionId
      });
    }
  }

  async stopStream(sessionId: string): Promise<void> {
    return tracingService.trace('stream.stop', async (span) => {
      try {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        span.setAttributes({
          'stream.session_id': sessionId,
          'stream.duration': (Date.now() - session.startTime) / 1000
        });

        // Stop media transmission
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }

        // Clean up connections
        this.cleanup();

        session.status = 'ended';
        this.sessions.set(sessionId, session);

        this.emit('stream_ended', {
          sessionId,
          duration: (Date.now() - session.startTime) / 1000
        });

      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'LiveStreamService',
          action: 'stopStream',
          sessionId
        });
        throw error;
      }
    });
  }

  getSession(sessionId: string): StreamSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateConfig(config: Partial<StreamConfig>) {
    this.config = {
      ...this.config,
      ...config
    };
  }

  private cleanup() {
    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop media tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    // Close WebSocket connection
    if (this.websocket) {
      this.websocket.close();
    }

    // Clear intervals
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Reset properties
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.peerConnection = null;
    this.websocket = null;
    this.statsInterval = null;
    this.reconnectAttempts = 0;
  }
}

// Export singleton instance
export const liveStreamService = LiveStreamService.getInstance(); 