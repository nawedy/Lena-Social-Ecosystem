import { EventEmitter } from 'events';
import { configService } from '../config/GlobalConfig';
import { errorService } from '../error/ErrorService';
import { loggingService } from '../logging/LoggingService';
import { tracingService } from '../monitoring/TracingService';
import { performanceService } from '../optimization/PerformanceService';

interface EffectConfig {
  maxEffects: number;
  maxFilters: number;
  maxTransitions: number;
  supportedFormats: string[];
  maxDuration: number;
}

interface Effect {
  id: string;
  type: 'filter' | 'transition' | 'overlay' | 'text' | 'sticker';
  name: string;
  config: Record<string, any>;
  startTime?: number;
  endTime?: number;
  position?: { x: number; y: number };
  scale?: number;
  rotation?: number;
  opacity?: number;
}

interface FilterPreset {
  id: string;
  name: string;
  settings: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    hue?: number;
    blur?: number;
    sharpen?: number;
    temperature?: number;
    vignette?: number;
  };
}

interface TransitionPreset {
  id: string;
  name: string;
  duration: number;
  type: 'fade' | 'slide' | 'zoom' | 'wipe' | 'dissolve';
  config: Record<string, any>;
}

interface EffectSession {
  id: string;
  videoId: string;
  effects: Effect[];
  filters: FilterPreset[];
  transitions: TransitionPreset[];
  status: 'editing' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  error?: string;
}

class EffectService extends EventEmitter {
  private static instance: EffectService;
  private sessions: Map<string, EffectSession> = new Map();
  private config: EffectConfig;
  private filterPresets: Map<string, FilterPreset> = new Map();
  private transitionPresets: Map<string, TransitionPreset> = new Map();
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private constructor() {
    super();
    this.setupConfig();
    this.setupPresets();
  }

  static getInstance(): EffectService {
    if (!EffectService.instance) {
      EffectService.instance = new EffectService();
    }
    return EffectService.instance;
  }

  private setupConfig() {
    this.config = {
      maxEffects: 10,
      maxFilters: 5,
      maxTransitions: 5,
      supportedFormats: ['mp4', 'webm', 'mov'],
      maxDuration: 300 // 5 minutes
    };
  }

  private setupPresets() {
    // Add default filter presets
    this.addFilterPreset({
      id: 'vintage',
      name: 'Vintage',
      settings: {
        brightness: 1.1,
        contrast: 1.2,
        saturation: 0.8,
        temperature: 0.9,
        vignette: 0.3
      }
    });

    this.addFilterPreset({
      id: 'noir',
      name: 'Noir',
      settings: {
        brightness: 0.9,
        contrast: 1.4,
        saturation: 0,
        vignette: 0.5
      }
    });

    // Add default transition presets
    this.addTransitionPreset({
      id: 'fade',
      name: 'Fade',
      duration: 1000,
      type: 'fade',
      config: {
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    });

    this.addTransitionPreset({
      id: 'slide-left',
      name: 'Slide Left',
      duration: 800,
      type: 'slide',
      config: {
        direction: 'left',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    });
  }

  async createSession(videoId: string): Promise<string> {
    return tracingService.trace('effect.create_session', async (span) => {
      try {
        const sessionId = crypto.randomUUID();
        const session: EffectSession = {
          id: sessionId,
          videoId,
          effects: [],
          filters: [],
          transitions: [],
          status: 'editing'
        };

        span.setAttributes({
          'effect.session_id': sessionId,
          'effect.video_id': videoId
        });

        this.sessions.set(sessionId, session);
        return sessionId;
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'EffectService',
          action: 'createSession',
          videoId
        });
        throw error;
      }
    });
  }

  async addEffect(sessionId: string, effect: Omit<Effect, 'id'>): Promise<string> {
    return tracingService.trace('effect.add', async (span) => {
      try {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        if (session.effects.length >= this.config.maxEffects) {
          throw new Error(`Maximum number of effects (${this.config.maxEffects}) reached`);
        }

        const effectId = crypto.randomUUID();
        const newEffect: Effect = {
          ...effect,
          id: effectId
        };

        span.setAttributes({
          'effect.session_id': sessionId,
          'effect.id': effectId,
          'effect.type': effect.type
        });

        session.effects.push(newEffect);
        this.sessions.set(sessionId, session);

        return effectId;
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'EffectService',
          action: 'addEffect',
          sessionId
        });
        throw error;
      }
    });
  }

  async updateEffect(sessionId: string, effectId: string, updates: Partial<Effect>): Promise<void> {
    return tracingService.trace('effect.update', async (span) => {
      try {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        const effectIndex = session.effects.findIndex(e => e.id === effectId);
        if (effectIndex === -1) {
          throw new Error(`Effect ${effectId} not found`);
        }

        span.setAttributes({
          'effect.session_id': sessionId,
          'effect.id': effectId
        });

        session.effects[effectIndex] = {
          ...session.effects[effectIndex],
          ...updates
        };

        this.sessions.set(sessionId, session);
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'EffectService',
          action: 'updateEffect',
          sessionId,
          effectId
        });
        throw error;
      }
    });
  }

  async removeEffect(sessionId: string, effectId: string): Promise<void> {
    return tracingService.trace('effect.remove', async (span) => {
      try {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        span.setAttributes({
          'effect.session_id': sessionId,
          'effect.id': effectId
        });

        session.effects = session.effects.filter(e => e.id !== effectId);
        this.sessions.set(sessionId, session);
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'EffectService',
          action: 'removeEffect',
          sessionId,
          effectId
        });
        throw error;
      }
    });
  }

  async applyFilter(sessionId: string, filterId: string): Promise<void> {
    return tracingService.trace('effect.apply_filter', async (span) => {
      try {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        const filter = this.filterPresets.get(filterId);
        if (!filter) {
          throw new Error(`Filter ${filterId} not found`);
        }

        if (session.filters.length >= this.config.maxFilters) {
          throw new Error(`Maximum number of filters (${this.config.maxFilters}) reached`);
        }

        span.setAttributes({
          'effect.session_id': sessionId,
          'filter.id': filterId
        });

        session.filters.push(filter);
        this.sessions.set(sessionId, session);
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'EffectService',
          action: 'applyFilter',
          sessionId,
          filterId
        });
        throw error;
      }
    });
  }

  async addTransition(sessionId: string, transitionId: string): Promise<void> {
    return tracingService.trace('effect.add_transition', async (span) => {
      try {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        const transition = this.transitionPresets.get(transitionId);
        if (!transition) {
          throw new Error(`Transition ${transitionId} not found`);
        }

        if (session.transitions.length >= this.config.maxTransitions) {
          throw new Error(`Maximum number of transitions (${this.config.maxTransitions}) reached`);
        }

        span.setAttributes({
          'effect.session_id': sessionId,
          'transition.id': transitionId
        });

        session.transitions.push(transition);
        this.sessions.set(sessionId, session);
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'EffectService',
          action: 'addTransition',
          sessionId,
          transitionId
        });
        throw error;
      }
    });
  }

  async processVideo(sessionId: string): Promise<string> {
    return tracingService.trace('effect.process', async (span) => {
      try {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        span.setAttributes({
          'effect.session_id': sessionId,
          'effect.count': session.effects.length,
          'filter.count': session.filters.length,
          'transition.count': session.transitions.length
        });

        session.status = 'processing';
        this.sessions.set(sessionId, session);

        // Process video with effects
        // This would typically use WebGL or a video processing library
        // For now, we'll simulate processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Generate output URL
        session.outputUrl = URL.createObjectURL(new Blob([], { type: 'video/mp4' }));
        session.status = 'completed';
        this.sessions.set(sessionId, session);

        this.emit('processing_completed', {
          sessionId,
          outputUrl: session.outputUrl
        });

        return session.outputUrl;
      } catch (error) {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.status = 'failed';
          session.error = error.message;
          this.sessions.set(sessionId, session);
        }

        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'EffectService',
          action: 'processVideo',
          sessionId
        });

        this.emit('processing_failed', {
          sessionId,
          error: error.message
        });

        throw error;
      }
    });
  }

  getSession(sessionId: string): EffectSession | undefined {
    return this.sessions.get(sessionId);
  }

  addFilterPreset(preset: FilterPreset) {
    this.filterPresets.set(preset.id, preset);
  }

  addTransitionPreset(preset: TransitionPreset) {
    this.transitionPresets.set(preset.id, preset);
  }

  getFilterPresets(): FilterPreset[] {
    return Array.from(this.filterPresets.values());
  }

  getTransitionPresets(): TransitionPreset[] {
    return Array.from(this.transitionPresets.values());
  }

  updateConfig(config: Partial<EffectConfig>) {
    this.config = {
      ...this.config,
      ...config
    };
  }

  // Cleanup
  cleanup() {
    this.sessions.clear();
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
      this.canvas = null;
      this.ctx = null;
    }
  }
}

// Export singleton instance
export const effectService = EffectService.getInstance(); 