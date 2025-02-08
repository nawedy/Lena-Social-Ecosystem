import { writable, derived } from 'svelte/store';
import type { VoiceRecording, VoiceTranscriptionResult } from '$lib/types/messaging';
import { api } from '$lib/services/api';
import { supabase } from '$lib/supabase';

interface VoiceState {
  recordings: Record<string, VoiceRecording>;
  activeRecording: string | null;
  isRecording: boolean;
  error: string | null;
}

class VoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private chunks: Blob[] = [];
  private waveformData: number[] = [];
  private animationFrame: number | null = null;

  private store = writable<VoiceState>({
    recordings: {},
    activeRecording: null,
    isRecording: false,
    error: null
  });

  constructor() {
    // Initialize audio context
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  /**
   * Start recording voice message
   */
  async startRecording(): Promise<void> {
    try {
      if (!navigator.mediaDevices) {
        throw new Error('Media devices not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio processing
      if (this.audioContext) {
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
      }

      // Create media recorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start(100);
      this.startWaveformAnalysis();

      const recordingId = crypto.randomUUID();
      this.store.update(state => ({
        ...state,
        activeRecording: recordingId,
        isRecording: true,
        error: null
      }));
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.store.update(state => ({
        ...state,
        error: error instanceof Error ? error.message : 'Failed to start recording'
      }));
    }
  }

  /**
   * Stop recording and process voice message
   */
  async stopRecording(): Promise<VoiceRecording | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.store.activeRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          // Create audio blob
          const audioBlob = new Blob(this.chunks, { type: 'audio/webm;codecs=opus' });
          
          // Upload to storage
          const { data: upload, error: uploadError } = await supabase.storage
            .from('voice-messages')
            .upload(`${this.store.activeRecording}.webm`, audioBlob);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('voice-messages')
            .getPublicUrl(upload.path);

          // Create recording object
          const recording: VoiceRecording = {
            id: this.store.activeRecording!,
            url: publicUrl,
            duration: this.getDuration(audioBlob),
            waveform: this.waveformData,
            status: 'processing'
          };

          // Start transcription
          this.transcribeRecording(recording);

          // Update store
          this.store.update(state => ({
            ...state,
            recordings: {
              ...state.recordings,
              [recording.id]: recording
            },
            activeRecording: null,
            isRecording: false
          }));

          resolve(recording);
        } catch (error) {
          console.error('Failed to process recording:', error);
          this.store.update(state => ({
            ...state,
            activeRecording: null,
            isRecording: false,
            error: error instanceof Error ? error.message : 'Failed to process recording'
          }));
          resolve(null);
        } finally {
          // Clean up
          this.chunks = [];
          this.waveformData = [];
          this.stopWaveformAnalysis();
          this.mediaRecorder = null;
        }
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel current recording
   */
  cancelRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.chunks = [];
      this.waveformData = [];
      this.stopWaveformAnalysis();
      this.mediaRecorder = null;
    }

    this.store.update(state => ({
      ...state,
      activeRecording: null,
      isRecording: false
    }));
  }

  /**
   * Transcribe voice recording
   */
  private async transcribeRecording(recording: VoiceRecording): Promise<void> {
    try {
      const response = await api.post<VoiceTranscriptionResult>(
        '/voice/transcribe',
        { url: recording.url }
      );

      if (!response.data) throw new Error('Transcription failed');

      this.store.update(state => ({
        ...state,
        recordings: {
          ...state.recordings,
          [recording.id]: {
            ...recording,
            transcription: response.data.text,
            status: 'ready'
          }
        }
      }));
    } catch (error) {
      console.error('Transcription failed:', error);
      this.store.update(state => ({
        ...state,
        recordings: {
          ...state.recordings,
          [recording.id]: {
            ...recording,
            status: 'failed'
          }
        }
      }));
    }
  }

  /**
   * Start waveform analysis
   */
  private startWaveformAnalysis(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const analyze = () => {
      this.analyser!.getByteFrequencyData(dataArray);
      
      // Calculate average amplitude
      const amplitude = Array.from(dataArray)
        .reduce((sum, value) => sum + value, 0) / dataArray.length;
      
      this.waveformData.push(amplitude);
      
      this.animationFrame = requestAnimationFrame(analyze);
    };

    this.animationFrame = requestAnimationFrame(analyze);
  }

  /**
   * Stop waveform analysis
   */
  private stopWaveformAnalysis(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Get audio duration
   */
  private getDuration(blob: Blob): number {
    return blob.size / 16000; // Approximate duration based on file size
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancelRecording();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  // Store subscriptions
  subscribe = this.store.subscribe;
  recordings = derived(this.store, $store => $store.recordings);
  activeRecording = derived(this.store, $store => $store.activeRecording);
  isRecording = derived(this.store, $store => $store.isRecording);
  error = derived(this.store, $store => $store.error);
}

// Create voice service instance
export const voice = new VoiceService(); 