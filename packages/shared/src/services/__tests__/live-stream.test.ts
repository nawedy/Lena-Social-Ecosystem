import { liveStreamService } from '../streaming/LiveStreamService';
import { performanceService } from '../optimization/PerformanceService';

describe('Live Stream Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  afterEach(() => {
    liveStreamService.cleanup();
  });

  // Mock setup
  function setupMocks() {
    // Mock MediaStream
    const mockTrack = { stop: jest.fn() };
    const mockMediaStream = {
      getTracks: jest.fn().mockReturnValue([mockTrack]),
      getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
      getAudioTracks: jest.fn().mockReturnValue([mockTrack])
    };

    // Mock MediaRecorder
    const mockMediaRecorder = {
      start: jest.fn(),
      stop: jest.fn(),
      state: 'inactive',
      ondataavailable: null,
      onerror: null
    };

    // Mock RTCPeerConnection
    const mockSender = {
      getParameters: jest.fn().mockReturnValue({
        encodings: [
          { maxBitrate: 6000000 }
        ]
      }),
      setParameters: jest.fn()
    };

    const mockPeerConnection = {
      addTrack: jest.fn(),
      createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'test' }),
      setLocalDescription: jest.fn(),
      close: jest.fn(),
      getSenders: jest.fn().mockReturnValue([mockSender]),
      getStats: jest.fn().mockResolvedValue(new Map([
        ['outbound-rtp', {
          type: 'outbound-rtp',
          kind: 'video',
          bitrate: 2000000,
          framesPerSecond: 30,
          packetsLost: 0
        }],
        ['track', {
          type: 'track',
          kind: 'video',
          frameWidth: 1920,
          frameHeight: 1080
        }],
        ['media-source', {
          type: 'media-source',
          kind: 'audio',
          audioLevel: 0.5
        }]
      ])),
      onicecandidate: null,
      oniceconnectionstatechange: null,
      iceConnectionState: 'connected'
    };

    // Mock WebSocket
    const mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    };

    // Set up global mocks
    global.MediaStream = jest.fn().mockImplementation(() => mockMediaStream);
    global.MediaRecorder = jest.fn().mockImplementation(() => mockMediaRecorder);
    global.RTCPeerConnection = jest.fn().mockImplementation(() => mockPeerConnection);
    global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

    // Mock getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockMediaStream)
    };

    // Mock crypto.randomUUID
    global.crypto.randomUUID = jest.fn().mockReturnValue('test-session-id');
  }

  describe('Session Management', () => {
    it('should create new streaming sessions', async () => {
      const sessionId = await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const session = liveStreamService.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.userId).toBe('test-user');
      expect(session?.title).toBe('Test Stream');
      expect(session?.status).toBe('live');
    });

    it('should handle custom RTMP keys', async () => {
      const rtmpKey = 'custom-key';
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description',
        rtmpKey
      });

      const mockWebSocket = (global.WebSocket as jest.Mock).mock.results[0].value;
      expect(mockWebSocket.onopen).toBeDefined();

      // Simulate WebSocket open and verify RTMP key is sent
      mockWebSocket.onopen();
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining(rtmpKey)
      );
    });

    it('should handle media stream errors', async () => {
      const error = new Error('Permission denied');
      global.navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(error);

      await expect(
        liveStreamService.startStream({
          userId: 'test-user',
          title: 'Test Stream',
          description: 'Test Description'
        })
      ).rejects.toThrow(error);
    });
  });

  describe('WebRTC Management', () => {
    it('should initialize WebRTC with correct configuration', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockPeerConnection = (global.RTCPeerConnection as jest.Mock).mock.results[0].value;
      
      // Verify media stream was requested with correct constraints
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            width: expect.any(Object),
            height: expect.any(Object),
            frameRate: expect.any(Object)
          }),
          audio: expect.objectContaining({
            sampleRate: expect.any(Number),
            channelCount: expect.any(Number)
          })
        })
      );

      // Verify peer connection setup
      expect(mockPeerConnection.createOffer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalled();
    });

    it('should handle ICE candidates', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockPeerConnection = (global.RTCPeerConnection as jest.Mock).mock.results[0].value;
      const mockWebSocket = (global.WebSocket as jest.Mock).mock.results[0].value;

      // Simulate ICE candidate
      const candidate = { candidate: 'test', sdpMid: 'test', sdpMLineIndex: 0 };
      mockPeerConnection.onicecandidate({ candidate });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('candidate')
      );
    });

    it('should handle connection state changes', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockPeerConnection = (global.RTCPeerConnection as jest.Mock).mock.results[0].value;

      // Simulate connection failure
      mockPeerConnection.iceConnectionState = 'failed';
      mockPeerConnection.oniceconnectionstatechange();

      const session = liveStreamService.getSession('test-session-id');
      expect(session?.status).toBe('error');
    });
  });

  describe('RTMP Management', () => {
    it('should initialize RTMP connection', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockWebSocket = (global.WebSocket as jest.Mock).mock.results[0].value;
      expect(mockWebSocket.onopen).toBeDefined();
      expect(mockWebSocket.onmessage).toBeDefined();
      expect(mockWebSocket.onerror).toBeDefined();
      expect(mockWebSocket.onclose).toBeDefined();
    });

    it('should handle RTMP server messages', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockWebSocket = (global.WebSocket as jest.Mock).mock.results[0].value;
      const mockMediaRecorder = (global.MediaRecorder as jest.Mock).mock.results[0].value;

      // Simulate ready message
      mockWebSocket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
      expect(mockMediaRecorder.start).toHaveBeenCalled();

      // Simulate viewer count update
      mockWebSocket.onmessage({ data: JSON.stringify({ type: 'viewer_count', count: 100 }) });
      const session = liveStreamService.getSession('test-session-id');
      expect(session?.stats.viewers).toBe(100);
    });

    it('should handle RTMP errors', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockWebSocket = (global.WebSocket as jest.Mock).mock.results[0].value;

      // Simulate error message
      mockWebSocket.onmessage({ data: JSON.stringify({ type: 'error', error: 'RTMP error' }) });
      const session = liveStreamService.getSession('test-session-id');
      expect(session?.status).toBe('error');
      expect(session?.error).toBe('RTMP error');
    });
  });

  describe('Media Transmission', () => {
    it('should start media transmission', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockMediaRecorder = (global.MediaRecorder as jest.Mock).mock.results[0].value;
      const mockWebSocket = (global.WebSocket as jest.Mock).mock.results[0].value;

      // Simulate media data
      const blob = new Blob(['test'], { type: 'video/webm' });
      mockMediaRecorder.ondataavailable({ data: blob });

      expect(mockWebSocket.send).toHaveBeenCalledWith(blob);
    });

    it('should handle media recorder errors', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockMediaRecorder = (global.MediaRecorder as jest.Mock).mock.results[0].value;

      // Simulate error
      mockMediaRecorder.onerror(new Error('MediaRecorder error'));
      const session = liveStreamService.getSession('test-session-id');
      expect(session?.status).toBe('error');
      expect(session?.error).toBe('MediaRecorder error');
    });
  });

  describe('Stats Monitoring', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should monitor stream stats', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      // Fast-forward 1 second
      jest.advanceTimersByTime(1000);

      const session = liveStreamService.getSession('test-session-id');
      expect(session?.stats.bitrate).toBe(2000000);
      expect(session?.stats.frameRate).toBe(30);
      expect(session?.stats.resolution).toEqual({ width: 1920, height: 1080 });
      expect(session?.stats.audioLevel).toBe(0.5);
    });

    it('should adjust bitrate based on network quality', async () => {
      // Mock poor network conditions
      const mockPeerConnection = (global.RTCPeerConnection as jest.Mock).mock.results[0].value;
      mockPeerConnection.getStats = jest.fn().mockResolvedValue(new Map([
        ['outbound-rtp', {
          type: 'outbound-rtp',
          kind: 'video',
          bitrate: 500000,
          framesPerSecond: 15,
          packetsLost: 50
        }]
      ]));

      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      // Fast-forward 1 second
      jest.advanceTimersByTime(1000);

      const mockSender = mockPeerConnection.getSenders()[0];
      expect(mockSender.setParameters).toHaveBeenCalled();
      expect(mockSender.setParameters.mock.calls[0][0].encodings[0].maxBitrate)
        .toBeLessThan(6000000);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should attempt reconnection on failure', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockPeerConnection = (global.RTCPeerConnection as jest.Mock).mock.results[0].value;

      // Simulate connection failure
      mockPeerConnection.iceConnectionState = 'failed';
      mockPeerConnection.oniceconnectionstatechange();

      // Verify reconnection attempt
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
      expect(global.RTCPeerConnection).toHaveBeenCalledTimes(2);
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });

    it('should stop after maximum reconnection attempts', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockPeerConnection = (global.RTCPeerConnection as jest.Mock).mock.results[0].value;

      // Simulate multiple failures
      for (let i = 0; i < 6; i++) {
        mockPeerConnection.iceConnectionState = 'failed';
        mockPeerConnection.oniceconnectionstatechange();
      }

      const session = liveStreamService.getSession('test-session-id');
      expect(session?.status).toBe('error');
      expect(session?.error).toBe('Maximum reconnection attempts reached');
    });
  });

  describe('Stream Cleanup', () => {
    it('should clean up resources on stop', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockMediaStream = (global.MediaStream as jest.Mock).mock.results[0].value;
      const mockPeerConnection = (global.RTCPeerConnection as jest.Mock).mock.results[0].value;
      const mockWebSocket = (global.WebSocket as jest.Mock).mock.results[0].value;

      await liveStreamService.stopStream('test-session-id');

      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
      expect(mockPeerConnection.close).toHaveBeenCalled();
      expect(mockWebSocket.close).toHaveBeenCalled();

      const session = liveStreamService.getSession('test-session-id');
      expect(session?.status).toBe('ended');
    });

    it('should handle cleanup errors gracefully', async () => {
      await liveStreamService.startStream({
        userId: 'test-user',
        title: 'Test Stream',
        description: 'Test Description'
      });

      const mockMediaStream = (global.MediaStream as jest.Mock).mock.results[0].value;
      mockMediaStream.getTracks()[0].stop.mockImplementation(() => {
        throw new Error('Failed to stop track');
      });

      await liveStreamService.stopStream('test-session-id');
      const session = liveStreamService.getSession('test-session-id');
      expect(session?.status).toBe('ended');
    });
  });
}); 