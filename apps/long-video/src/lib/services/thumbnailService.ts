import { supabase } from '$lib/supabase';
import { generateThumbnail } from '$lib/utils/video';

interface ThumbnailAnalysis {
  score: number;
  composition: number;
  brightness: number;
  contrast: number;
  faceCount: number;
  textCount: number;
  dominantColors: string[];
  tags: string[];
}

interface ThumbnailSuggestion {
  time: number;
  thumbnail: string;
  analysis: ThumbnailAnalysis;
}

export class ThumbnailService {
  private videoId: string;
  private videoUrl: string;
  private duration: number;

  constructor(videoId: string, videoUrl: string, duration: number) {
    this.videoId = videoId;
    this.videoUrl = videoUrl;
    this.duration = duration;
  }

  /**
   * Generate and analyze thumbnails at key moments
   */
  async generateSuggestions(count: number = 10): Promise<ThumbnailSuggestion[]> {
    try {
      // Create analysis job
      const { data: job, error: jobError } = await supabase
        .from('thumbnail_jobs')
        .insert({
          video_id: this.videoId,
          status: 'pending',
          count
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Generate thumbnails at key moments
      const timestamps = this.getKeyMoments(count);
      const thumbnails = await Promise.all(
        timestamps.map(async time => {
          const thumbnail = await generateThumbnail(this.videoUrl, time);
          return { time, thumbnail };
        })
      );

      // Analyze thumbnails using AI
      const analyzed = await Promise.all(
        thumbnails.map(async ({ time, thumbnail }) => {
          const analysis = await this.analyzeThumbnail(thumbnail);
          return { time, thumbnail, analysis };
        })
      );

      // Sort by score
      return analyzed.sort((a, b) => b.analysis.score - a.analysis.score);
    } catch (error) {
      console.error('Failed to generate thumbnail suggestions:', error);
      throw error;
    }
  }

  /**
   * Get key moments in the video for thumbnail generation
   */
  private getKeyMoments(count: number): number[] {
    const moments: number[] = [];
    
    // Always include start (after intro), middle, and near end
    moments.push(
      30, // After typical intro
      this.duration / 2, // Middle
      this.duration * 0.8 // Near end, but not too close
    );

    // Add evenly spaced moments
    const interval = this.duration / (count + 1);
    for (let i = 1; i <= count - 3; i++) {
      moments.push(interval * i);
    }

    return moments
      .filter(time => time >= 0 && time <= this.duration)
      .sort((a, b) => a - b);
  }

  /**
   * Analyze thumbnail using AI
   */
  private async analyzeThumbnail(thumbnail: string): Promise<ThumbnailAnalysis> {
    try {
      // Call AI analysis endpoint
      const response = await fetch('/api/thumbnails/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ thumbnail })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze thumbnail');
      }

      const analysis = await response.json();
      return this.calculateScore(analysis);
    } catch (error) {
      console.error('Failed to analyze thumbnail:', error);
      throw error;
    }
  }

  /**
   * Calculate overall thumbnail score based on various factors
   */
  private calculateScore(analysis: ThumbnailAnalysis): ThumbnailAnalysis {
    const weights = {
      composition: 0.3,
      brightness: 0.15,
      contrast: 0.15,
      faceCount: 0.2,
      textCount: 0.1,
      colorVariety: 0.1
    };

    // Normalize values between 0 and 1
    const normalized = {
      composition: analysis.composition / 100,
      brightness: this.normalizeRange(analysis.brightness, 40, 60),
      contrast: this.normalizeRange(analysis.contrast, 50, 70),
      faceCount: Math.min(analysis.faceCount / 3, 1),
      textCount: Math.min(analysis.textCount / 2, 1),
      colorVariety: analysis.dominantColors.length / 5
    };

    // Calculate weighted score
    const score = Object.entries(weights).reduce(
      (sum, [key, weight]) => sum + normalized[key] * weight,
      0
    ) * 100;

    return {
      ...analysis,
      score: Math.round(score)
    };
  }

  /**
   * Normalize a value to a 0-1 range based on ideal range
   */
  private normalizeRange(value: number, min: number, max: number): number {
    if (value < min) return 1 - ((min - value) / min);
    if (value > max) return 1 - ((value - max) / (100 - max));
    return 1;
  }

  /**
   * Save selected thumbnail
   */
  async saveThumbnail(thumbnail: string) {
    const { error } = await supabase
      .from('videos')
      .update({
        thumbnail_url: thumbnail,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.videoId);

    if (error) throw error;
  }

  /**
   * Get thumbnail generation status
   */
  async getStatus() {
    const { data, error } = await supabase
      .from('thumbnail_jobs')
      .select('*')
      .eq('video_id', this.videoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  }
}

// Create thumbnail service instance
export function createThumbnailService(videoId: string, videoUrl: string, duration: number) {
  return new ThumbnailService(videoId, videoUrl, duration);
} 