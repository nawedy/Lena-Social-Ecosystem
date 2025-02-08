import { supabase } from '$lib/supabase';
import type { Chapter } from '$lib/types';
import { generateThumbnail } from '$lib/utils/video';

interface ChapterAnalysis {
  time: number;
  confidence: number;
  type: 'scene_change' | 'speech' | 'action' | 'title' | 'transition';
  description: string;
  tags: string[];
}

export class ChapterService {
  private videoId: string;
  private videoUrl: string;
  private duration: number;

  constructor(videoId: string, videoUrl: string, duration: number) {
    this.videoId = videoId;
    this.videoUrl = videoUrl;
    this.duration = duration;
  }

  /**
   * Generate AI-powered chapter suggestions
   */
  async generateSuggestions(): Promise<Chapter[]> {
    try {
      // Create analysis job
      const { data: job, error: jobError } = await supabase
        .from('chapter_analysis_jobs')
        .insert({
          video_id: this.videoId,
          status: 'pending'
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Call AI analysis endpoint
      const response = await fetch('/api/chapters/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId: job.id,
          videoUrl: this.videoUrl,
          duration: this.duration
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze video');
      }

      const analysis: ChapterAnalysis[] = await response.json();

      // Convert analysis to chapters
      const chapters = await this.analysisToChapters(analysis);

      // Update job status
      await supabase
        .from('chapter_analysis_jobs')
        .update({ status: 'completed' })
        .eq('id', job.id);

      return chapters;
    } catch (error) {
      console.error('Failed to generate chapter suggestions:', error);
      throw error;
    }
  }

  /**
   * Convert analysis results to chapters
   */
  private async analysisToChapters(analysis: ChapterAnalysis[]): Promise<Chapter[]> {
    // Filter out low confidence results and sort by time
    const significantChanges = analysis
      .filter(a => a.confidence > 0.7)
      .sort((a, b) => a.time - b.time);

    // Group nearby changes
    const mergedChanges = this.mergeNearbyChanges(significantChanges);

    // Generate chapters with thumbnails
    const chapters = await Promise.all(
      mergedChanges.map(async change => {
        const thumbnail = await generateThumbnail(this.videoUrl, change.time);
        return {
          id: crypto.randomUUID(),
          title: this.generateTitle(change),
          startTime: change.time,
          thumbnailUrl: thumbnail,
          metadata: {
            type: change.type,
            tags: change.tags,
            confidence: change.confidence
          }
        };
      })
    );

    return chapters;
  }

  /**
   * Merge changes that occur close together
   */
  private mergeNearbyChanges(changes: ChapterAnalysis[]): ChapterAnalysis[] {
    const merged: ChapterAnalysis[] = [];
    const minGap = 5; // Minimum seconds between chapters

    for (const change of changes) {
      const lastMerged = merged[merged.length - 1];
      if (!lastMerged || change.time - lastMerged.time >= minGap) {
        merged.push(change);
      } else if (change.confidence > lastMerged.confidence) {
        merged[merged.length - 1] = change;
      }
    }

    return merged;
  }

  /**
   * Generate a descriptive title based on the analysis
   */
  private generateTitle(analysis: ChapterAnalysis): string {
    const typeLabels = {
      scene_change: 'Scene:',
      speech: 'Speech:',
      action: 'Action:',
      title: 'Title:',
      transition: 'Transition:'
    };

    return `${typeLabels[analysis.type]} ${analysis.description}`;
  }

  /**
   * Get analysis status
   */
  async getStatus() {
    const { data, error } = await supabase
      .from('chapter_analysis_jobs')
      .select('*')
      .eq('video_id', this.videoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  }
}

// Create chapter service instance
export function createChapterService(videoId: string, videoUrl: string, duration: number) {
  return new ChapterService(videoId, videoUrl, duration);
} 