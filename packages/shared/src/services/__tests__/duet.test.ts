import { duetService } from '../video/DuetService';
import { performanceService } from '../optimization/PerformanceService';

describe('Duet Service', () => {
  beforeEach(() => {
    duetService.cleanup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    duetService.cleanup();
  });

  describe('Session Management', () => {
    it('should create new duet sessions', async () => {
      const mockStream = new MediaStream();
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

      const sessionId = await duetService.startDuet('original-video-123');
      const session = duetService.getDuetSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.originalVideoId).toBe('original-video-123');
      expect(session?.status).toBe('recording');
      expect(session?.layout).toBe('side-by-side');
    });

    it('should support different layouts', async () => {
      const mockStream = new MediaStream();
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

      const sessionId = await duetService.startDuet('original-video-123', {
        layout: 'picture-in-picture'
      });
      const session = duetService.getDuetSession(sessionId);

      expect(session?.layout).toBe('picture-in-picture');
    });

    it('should handle media stream errors', async () => {
      const error = new Error('Permission denied');
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(error);

      await expect(duetService.startDuet('original-video-123')).rejects.toThrow(error);
    });
  });

  describe('Recording Management', () => {
    let mockMediaRecorder: any;
    let mockStream: MediaStream;

    beforeEach(() => {
      mockStream = new MediaStream();
      mockMediaRecorder = {
        start: jest.fn(),
        stop: jest.fn(),
        state: 'inactive',
        ondataavailable: null,
        onstop: null
      };

      global.MediaRecorder = jest.fn().mockImplementation(() => mockMediaRecorder);
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);
    });

    it('should start and stop recording', async () => {
      const sessionId = await duetService.startDuet('original-video-123');
      expect(mockMediaRecorder.start).toHaveBeenCalledWith(1000);

      await duetService.stopDuet(sessionId);
      expect(mockMediaRecorder.stop).toHaveBeenCalled();
    });

    it('should handle recording data', async () => {
      const sessionId = await duetService.startDuet('original-video-123');
      
      // Simulate recording data
      const blob = new Blob(['test-data'], { type: 'video/webm' });
      mockMediaRecorder.ondataavailable({ data: blob });

      // Mock performance service compression
      jest.spyOn(performanceService, 'compress').mockResolvedValue(new Uint8Array([1, 2, 3]));

      // Trigger recording stop
      mockMediaRecorder.onstop();

      const session = duetService.getDuetSession(sessionId);
      expect(session?.status).toBe('completed');
      expect(session?.outputUrl).toBeDefined();
    });

    it('should handle recording errors', async () => {
      const sessionId = await duetService.startDuet('original-video-123');
      
      // Mock compression error
      const error = new Error('Compression failed');
      jest.spyOn(performanceService, 'compress').mockRejectedValue(error);

      // Simulate recording data and stop
      const blob = new Blob(['test-data'], { type: 'video/webm' });
      mockMediaRecorder.ondataavailable({ data: blob });
      mockMediaRecorder.onstop();

      const session = duetService.getDuetSession(sessionId);
      expect(session?.status).toBe('failed');
      expect(session?.error).toBe(error.message);
    });
  });

  describe('Reaction Management', () => {
    let mockStream: MediaStream;

    beforeEach(() => {
      mockStream = new MediaStream();
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);
    });

    it('should create reaction sessions', async () => {
      const sessionId = await duetService.startDuet('original-video-123', {
        isReaction: true
      });
      const session = duetService.getDuetSession(sessionId) as any;

      expect(session.reactionType).toBe('video');
      expect(session.reactions).toEqual([]);
    });

    it('should add reactions to sessions', async () => {
      const sessionId = await duetService.startDuet('original-video-123', {
        isReaction: true
      });

      await duetService.addReaction(sessionId, {
        type: 'emoji',
        value: '👍'
      });

      const session = duetService.getDuetSession(sessionId) as any;
      expect(session.reactions.length).toBe(1);
      expect(session.reactions[0].type).toBe('emoji');
      expect(session.reactions[0].value).toBe('👍');
    });

    it('should enforce maximum reactions limit', async () => {
      const sessionId = await duetService.startDuet('original-video-123', {
        isReaction: true
      });

      // Update config to set low max reactions
      duetService.updateConfig({ maxReactions: 2 });

      await duetService.addReaction(sessionId, { type: 'emoji', value: '👍' });
      await duetService.addReaction(sessionId, { type: 'emoji', value: '❤️' });

      await expect(
        duetService.addReaction(sessionId, { type: 'emoji', value: '😊' })
      ).rejects.toThrow('Maximum number of reactions reached');
    });

    it('should validate reaction session type', async () => {
      const sessionId = await duetService.startDuet('original-video-123', {
        isReaction: false
      });

      await expect(
        duetService.addReaction(sessionId, { type: 'emoji', value: '👍' })
      ).rejects.toThrow('Invalid reaction session');
    });
  });

  describe('Event Emission', () => {
    let mockStream: MediaStream;
    let mockMediaRecorder: any;

    beforeEach(() => {
      mockStream = new MediaStream();
      mockMediaRecorder = {
        start: jest.fn(),
        stop: jest.fn(),
        state: 'inactive',
        ondataavailable: null,
        onstop: null
      };

      global.MediaRecorder = jest.fn().mockImplementation(() => mockMediaRecorder);
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);
    });

    it('should emit completion events', async () => {
      const completionHandler = jest.fn();
      duetService.on('duet_completed', completionHandler);

      const sessionId = await duetService.startDuet('original-video-123');
      
      // Mock successful processing
      jest.spyOn(performanceService, 'compress').mockResolvedValue(new Uint8Array([1, 2, 3]));
      
      // Simulate recording completion
      const blob = new Blob(['test-data'], { type: 'video/webm' });
      mockMediaRecorder.ondataavailable({ data: blob });
      mockMediaRecorder.onstop();

      expect(completionHandler).toHaveBeenCalledWith(expect.objectContaining({
        sessionId,
        outputUrl: expect.any(String),
        duration: expect.any(Number)
      }));
    });

    it('should emit failure events', async () => {
      const failureHandler = jest.fn();
      duetService.on('duet_failed', failureHandler);

      const sessionId = await duetService.startDuet('original-video-123');
      
      // Mock processing error
      const error = new Error('Processing failed');
      jest.spyOn(performanceService, 'compress').mockRejectedValue(error);
      
      // Simulate recording completion
      const blob = new Blob(['test-data'], { type: 'video/webm' });
      mockMediaRecorder.ondataavailable({ data: blob });
      mockMediaRecorder.onstop();

      expect(failureHandler).toHaveBeenCalledWith(expect.objectContaining({
        sessionId,
        error: error.message
      }));
    });
  });

  describe('Configuration Management', () => {
    it('should update service configuration', () => {
      const newConfig = {
        maxDuration: 30,
        defaultLayout: 'picture-in-picture' as const,
        maxReactions: 25
      };

      duetService.updateConfig(newConfig);

      // Start a new session and verify config is applied
      const mockStream = new MediaStream();
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

      return duetService.startDuet('original-video-123').then(sessionId => {
        const session = duetService.getDuetSession(sessionId);
        expect(session?.layout).toBe(newConfig.defaultLayout);
      });
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources', async () => {
      const mockStream = new MediaStream();
      const mockTrack = { stop: jest.fn() };
      mockStream.getTracks = () => [mockTrack];

      const mockMediaRecorder = {
        start: jest.fn(),
        stop: jest.fn(),
        state: 'recording',
        stream: mockStream,
        ondataavailable: null,
        onstop: null
      };

      global.MediaRecorder = jest.fn().mockImplementation(() => mockMediaRecorder);
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream);

      await duetService.startDuet('original-video-123');
      duetService.cleanup();

      expect(mockMediaRecorder.stop).toHaveBeenCalled();
      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });
}); 