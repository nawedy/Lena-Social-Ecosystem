import { supabase } from '$lib/supabase';
import type { Caption } from '$lib/types';

interface TranscriptionResult {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

interface CaptionSegment {
  text: string;
  startTime: number;
  endTime: number;
}

export class CaptionService {
  private videoId: string;
  private ipfsHash: string;

  constructor(videoId: string, ipfsHash: string) {
    this.videoId = videoId;
    this.ipfsHash = ipfsHash;
  }

  /**
   * Start automatic caption generation for multiple languages
   */
  async generateCaptions(languages: string[] = ['en']) {
    try {
      // Create caption generation job
      const { data: job, error: jobError } = await supabase
        .from('caption_jobs')
        .insert({
          video_id: this.videoId,
          languages,
          status: 'pending'
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Call serverless function to start processing
      const response = await fetch('/api/captions/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId: job.id,
          videoId: this.videoId,
          ipfsHash: this.ipfsHash,
          languages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start caption generation');
      }

      return job;
    } catch (error) {
      console.error('Failed to generate captions:', error);
      throw error;
    }
  }

  /**
   * Get caption generation status
   */
  async getCaptionStatus() {
    const { data, error } = await supabase
      .from('caption_jobs')
      .select('*')
      .eq('video_id', this.videoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get captions for a specific language
   */
  async getCaptions(language: string): Promise<Caption[]> {
    const { data, error } = await supabase
      .from('captions')
      .select('*')
      .eq('video_id', this.videoId)
      .eq('language', language)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Update caption text
   */
  async updateCaption(captionId: string, text: string) {
    const { data, error } = await supabase
      .from('captions')
      .update({ text })
      .eq('id', captionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Import captions from SRT file
   */
  async importCaptions(file: File, language: string) {
    try {
      const text = await file.text();
      const segments = this.parseSRT(text);

      // Create captions in batches
      const batchSize = 100;
      for (let i = 0; i < segments.length; i += batchSize) {
        const batch = segments.slice(i, i + batchSize).map(segment => ({
          video_id: this.videoId,
          language,
          text: segment.text,
          start_time: segment.startTime,
          end_time: segment.endTime,
          is_auto_generated: false
        }));

        const { error } = await supabase
          .from('captions')
          .insert(batch);

        if (error) throw error;
      }

      return segments.length;
    } catch (error) {
      console.error('Failed to import captions:', error);
      throw error;
    }
  }

  /**
   * Export captions to SRT format
   */
  async exportCaptions(language: string): Promise<string> {
    const captions = await this.getCaptions(language);
    return this.generateSRT(captions);
  }

  /**
   * Parse SRT file content
   */
  private parseSRT(content: string): CaptionSegment[] {
    const segments: CaptionSegment[] = [];
    const blocks = content.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 3) continue;

      const times = lines[1].split(' --> ');
      if (times.length !== 2) continue;

      const startTime = this.timeToSeconds(times[0]);
      const endTime = this.timeToSeconds(times[1]);
      const text = lines.slice(2).join('\n');

      segments.push({ text, startTime, endTime });
    }

    return segments;
  }

  /**
   * Generate SRT content from captions
   */
  private generateSRT(captions: Caption[]): string {
    return captions.map((caption, index) => {
      const number = index + 1;
      const timeRange = `${this.secondsToTime(caption.startTime)} --> ${this.secondsToTime(caption.endTime)}`;
      return `${number}\n${timeRange}\n${caption.text}\n`;
    }).join('\n');
  }

  /**
   * Convert SRT timestamp to seconds
   */
  private timeToSeconds(timeStr: string): number {
    const [time, ms] = timeStr.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds + Number(ms) / 1000;
  }

  /**
   * Convert seconds to SRT timestamp
   */
  private secondsToTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(secs)},${this.padZero(ms, 3)}`;
  }

  /**
   * Pad number with leading zeros
   */
  private padZero(num: number, length: number = 2): string {
    return num.toString().padStart(length, '0');
  }
}

// Create caption service instance
export function createCaptionService(videoId: string, ipfsHash: string) {
  return new CaptionService(videoId, ipfsHash);
} 