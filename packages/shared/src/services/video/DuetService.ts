import { EventEmitter } from 'events';
import { configService } from '../config/GlobalConfig';
import { errorService } from '../error/ErrorService';
import { loggingService } from '../logging/LoggingService';
import { tracingService } from '../monitoring/TracingService';
import { performanceService } from '../optimization/PerformanceService';

interface DuetConfig {
  maxDuration: number;
  allowedLayouts: ('side-by-side' | 'picture-in-picture' | 'vertical-split')[];
  defaultLayout: 'side-by-side' | 'picture-in-picture' | 'vertical-split';
  maxReactions: number;
  reactionDuration: number;
}

interface DuetSession {
  id: string;
  originalVideoId: string;
  layout: 'side-by-side' | 'picture-in-picture' | 'vertical-split';
  status: 'recording' | 'processing' | 'completed' | 'failed';
  startTime: number;
  duration: number;
  outputUrl?: string;
  error?: string;
}

interface ReactionSession extends DuetSession {
  reactionType: 'video' | 'audio' | 'emoji';
  reactions: {
    timestamp: number;
    type: string;
    value: string;
  }[];
}

class DuetService extends EventEmitter {
  private static instance: DuetService;
  private sessions: Map<string, DuetSession | ReactionSession> = new Map();
  private config: DuetConfig;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private constructor() {
    super();
    this.setupConfig();
  }

  static getInstance(): DuetService {
    if (!DuetService.instance) {
      DuetService.instance = new DuetService();
    }
    return DuetService.instance;
  }

  private setupConfig() {
    this.config = {
      maxDuration: 60, // 60 seconds
      allowedLayouts: ['side-by-side', 'picture-in-picture', 'vertical-split'],
      defaultLayout: 'side-by-side',
      maxReactions: 50,
      reactionDuration: 15 // 15 seconds
    };
  }

  async startDuet(
    originalVideoId: string,
    options: {
      layout?: 'side-by-side' | 'picture-in-picture' | 'vertical-split';
      isReaction?: boolean;
    } = {}
  ): Promise<string> {
    return tracingService.trace('duet.start', async (span) => {
      try {
        const sessionId = crypto.randomUUID();
        const session: DuetSession | ReactionSession = {
          id: sessionId,
          originalVideoId,
          layout: options.layout || this.config.defaultLayout,
          status: 'recording',
          startTime: Date.now(),
          duration: 0,
          ...(options.isReaction && {
            reactionType: 'video',
            reactions: []
          })
        };

        span.setAttributes({
          'duet.session_id': sessionId,
          'duet.original_video': originalVideoId,
          'duet.layout': session.layout
        });

        this.sessions.set(sessionId, session);
        
        // Set up media recording
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9,opus'
        });

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          this.processDuet(sessionId);
        };

        this.mediaRecorder.start(1000); // Collect data every second

        return sessionId;
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'DuetService',
          action: 'startDuet',
          originalVideoId
        });
        throw error;
      }
    });
  }

  async stopDuet(sessionId: string): Promise<void> {
    return tracingService.trace('duet.stop', async (span) => {
      try {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        span.setAttributes({
          'duet.session_id': sessionId,
          'duet.duration': Date.now() - session.startTime
        });

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
          this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }

        session.status = 'processing';
        session.duration = (Date.now() - session.startTime) / 1000;
        this.sessions.set(sessionId, session);

      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'DuetService',
          action: 'stopDuet',
          sessionId
        });
        throw error;
      }
    });
  }

  async addReaction(
    sessionId: string,
    reaction: {
      type: string;
      value: string;
    }
  ): Promise<void> {
    return tracingService.trace('duet.react', async (span) => {
      try {
        const session = this.sessions.get(sessionId) as ReactionSession;
        if (!session || !('reactions' in session)) {
          throw new Error(`Invalid reaction session ${sessionId}`);
        }

        if (session.reactions.length >= this.config.maxReactions) {
          throw new Error('Maximum number of reactions reached');
        }

        span.setAttributes({
          'duet.session_id': sessionId,
          'reaction.type': reaction.type,
          'reaction.timestamp': Date.now() - session.startTime
        });

        session.reactions.push({
          timestamp: Date.now() - session.startTime,
          type: reaction.type,
          value: reaction.value
        });

        this.sessions.set(sessionId, session);

      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'DuetService',
          action: 'addReaction',
          sessionId
        });
        throw error;
      }
    });
  }

  private async processDuet(sessionId: string): Promise<void> {
    return tracingService.trace('duet.process', async (span) => {
      try {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        span.setAttributes({
          'duet.session_id': sessionId,
          'duet.layout': session.layout
        });

        // Create final video blob
        const finalBlob = new Blob(this.recordedChunks, {
          type: 'video/webm'
        });

        // Compress video using performance service
        const compressedData = await performanceService.compress(finalBlob);

        // Generate temporary URL for the processed video
        session.outputUrl = URL.createObjectURL(new Blob([compressedData]));
        session.status = 'completed';
        this.sessions.set(sessionId, session);

        this.emit('duet_completed', {
          sessionId,
          outputUrl: session.outputUrl,
          duration: session.duration
        });

        // Clear recorded chunks
        this.recordedChunks = [];

      } catch (error) {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.status = 'failed';
          session.error = error.message;
          this.sessions.set(sessionId, session);
        }

        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'DuetService',
          action: 'processDuet',
          sessionId
        });

        this.emit('duet_failed', {
          sessionId,
          error: error.message
        });
      }
    });
  }

  getDuetSession(sessionId: string): DuetSession | ReactionSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateConfig(config: Partial<DuetConfig>) {
    this.config = {
      ...this.config,
      ...config
    };
  }

  // Cleanup
  cleanup() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    this.sessions.clear();
    this.recordedChunks = [];
  }
}

// Export singleton instance
export const duetService = DuetService.getInstance(); 