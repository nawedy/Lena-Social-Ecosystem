import { describe, it, expect, beforeEach, vi } from 'vitest';
import { moderationService } from './moderation';
import { mockSupabase } from '../../test/utils';

// Mock Supabase client
vi.mock('$lib/supabaseClient', () => ({
  supabase: mockSupabase
}));

// Mock fetch for AI moderation service
global.fetch = vi.fn();

describe('Moderation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('content analysis', () => {
    const mockAnalysis = {
      toxicity: 0.1,
      spam: 0.2,
      hate: 0.1,
      adult: 0.0,
      violence: 0.1,
      sentiment: 0.8,
      language: 'en',
      topics: ['technology'],
      entities: ['AI'],
      confidence: 0.95
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAnalysis)
      });
    });

    it('should analyze content and approve safe content', async () => {
      const content = 'This is safe content';
      const result = await moderationService.moderateContent(content, 'post', 'user-123');

      expect(result.approved).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('ai_content_analysis');
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });

    it('should reject toxic content', async () => {
      const toxicAnalysis = { ...mockAnalysis, toxicity: 0.9, confidence: 0.95 };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(toxicAnalysis)
      });

      const content = 'This is toxic content';
      const result = await moderationService.moderateContent(content, 'post', 'user-123');

      expect(result.approved).toBe(false);
      expect(result.reason).toBe('Content violates community guidelines');
      expect(mockSupabase.from).toHaveBeenCalledWith('moderation_queue');
    });

    it('should flag content for review when uncertain', async () => {
      const uncertainAnalysis = { ...mockAnalysis, toxicity: 0.7, confidence: 0.6 };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(uncertainAnalysis)
      });

      const content = 'This content needs review';
      const result = await moderationService.moderateContent(content, 'post', 'user-123');

      expect(result.approved).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('moderation_queue');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        content_type: 'post',
        status: 'pending'
      });
    });

    it('should handle analysis service errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Service unavailable'));

      const content = 'Test content';
      await expect(
        moderationService.moderateContent(content, 'post', 'user-123')
      ).rejects.toThrow('Failed to moderate content');
    });
  });

  describe('moderation actions', () => {
    it('should submit moderation action', async () => {
      const action = {
        contentId: 'content-123',
        contentType: 'post' as const,
        action: 'reject' as const,
        reason: 'Violates guidelines',
        moderatorId: 'mod-123'
      };

      await moderationService.submitAction(action);

      expect(mockSupabase.from).toHaveBeenCalledWith('moderation_actions');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        content_id: action.contentId,
        content_type: action.contentType,
        action: action.action,
        reason: action.reason,
        moderator_id: action.moderatorId
      });
    });

    it('should update content status on rejection', async () => {
      const action = {
        contentId: 'content-123',
        contentType: 'post' as const,
        action: 'reject' as const,
        reason: 'Violates guidelines',
        moderatorId: 'mod-123'
      };

      await moderationService.submitAction(action);

      expect(mockSupabase.from).toHaveBeenCalledWith('posts');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({ is_sensitive: true });
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('id', action.contentId);
    });

    it('should handle action submission errors', async () => {
      mockSupabase.from().insert.mockRejectedValueOnce(new Error('Database error'));

      const action = {
        contentId: 'content-123',
        contentType: 'post' as const,
        action: 'reject' as const,
        reason: 'Violates guidelines',
        moderatorId: 'mod-123'
      };

      await expect(moderationService.submitAction(action)).rejects.toThrow(
        'Failed to submit moderation action'
      );
    });
  });

  describe('moderation queue', () => {
    it('should get moderation queue', async () => {
      const mockQueue = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'approved' }
      ];
      mockSupabase.from().select.mockResolvedValueOnce({ data: mockQueue, error: null });

      const queue = await moderationService.getQueue();

      expect(queue).toEqual(mockQueue);
      expect(mockSupabase.from).toHaveBeenCalledWith('moderation_queue');
      expect(mockSupabase.from().order).toHaveBeenCalledWith('created_at', {
        ascending: false
      });
    });

    it('should filter queue by status', async () => {
      const mockQueue = [{ id: 1, status: 'pending' }];
      mockSupabase.from().select.mockResolvedValueOnce({ data: mockQueue, error: null });

      const queue = await moderationService.getQueue('pending');

      expect(queue).toEqual(mockQueue);
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('should handle queue retrieval errors', async () => {
      mockSupabase.from().select.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error')
      });

      await expect(moderationService.getQueue()).rejects.toThrow(
        'Failed to get moderation queue'
      );
    });
  });

  describe('moderation settings', () => {
    const mockSettings = {
      autoModeration: true,
      thresholds: {
        toxicity: 0.8,
        spam: 0.8,
        hate: 0.7,
        adult: 0.8,
        violence: 0.8
      },
      aiConfidenceThreshold: 0.9,
      requireMultipleModerators: true,
      minimumModeratorCount: 2
    };

    it('should update moderation settings', async () => {
      await moderationService.updateSettings(mockSettings);

      expect(mockSupabase.from).toHaveBeenCalledWith('moderation_settings');
      expect(mockSupabase.from().update).toHaveBeenCalledWith(mockSettings);
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('id', 1);
    });

    it('should get moderation settings', async () => {
      mockSupabase.from().select.mockResolvedValueOnce({
        data: mockSettings,
        error: null
      });

      const settings = await moderationService.getSettings();

      expect(settings).toEqual(mockSettings);
      expect(mockSupabase.from).toHaveBeenCalledWith('moderation_settings');
    });

    it('should return default settings if none exist', async () => {
      mockSupabase.from().select.mockResolvedValueOnce({ data: null, error: null });

      const settings = await moderationService.getSettings();

      expect(settings).toEqual(expect.objectContaining({
        autoModeration: true,
        thresholds: expect.any(Object),
        aiConfidenceThreshold: expect.any(Number)
      }));
    });
  });
}); 