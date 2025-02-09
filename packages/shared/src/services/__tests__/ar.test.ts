import { arFilterService } from '../ar/ARFilterService';
import * as THREE from 'three';

describe('AR Filter Service', () => {
  beforeEach(() => {
    arFilterService.cleanup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    arFilterService.cleanup();
  });

  describe('Session Management', () => {
    it('should create new AR filter sessions', async () => {
      const filter = {
        id: 'test-filter-1',
        name: 'Test Filter',
        description: 'A test filter',
        category: 'fun',
        assets: [],
        settings: {
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
          opacity: 1,
          blendMode: 'normal'
        }
      };

      const sessionId = await arFilterService.startSession(filter);
      const session = arFilterService.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.filter).toEqual(filter);
      expect(session?.status).toBe('active');
    });

    it('should handle multiple concurrent sessions', async () => {
      const filters = [
        {
          id: 'filter-1',
          name: 'Filter 1',
          description: 'First test filter',
          category: 'fun',
          assets: [],
          settings: {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            scale: new THREE.Vector3(1, 1, 1),
            opacity: 1,
            blendMode: 'normal'
          }
        },
        {
          id: 'filter-2',
          name: 'Filter 2',
          description: 'Second test filter',
          category: 'effects',
          assets: [],
          settings: {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            scale: new THREE.Vector3(1, 1, 1),
            opacity: 1,
            blendMode: 'normal'
          }
        }
      ];

      const sessionIds = await Promise.all(filters.map(filter => 
        arFilterService.startSession(filter)
      ));

      sessionIds.forEach((sessionId, index) => {
        const session = arFilterService.getSession(sessionId);
        expect(session?.filter).toEqual(filters[index]);
        expect(session?.status).toBe('active');
      });
    });

    it('should handle session cleanup correctly', async () => {
      const filter = {
        id: 'test-filter',
        name: 'Test Filter',
        description: 'A test filter',
        category: 'fun',
        assets: [],
        settings: {
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
          opacity: 1,
          blendMode: 'normal'
        }
      };

      const sessionId = await arFilterService.startSession(filter);
      await arFilterService.stopSession(sessionId);

      const session = arFilterService.getSession(sessionId);
      expect(session).toBeUndefined();
    });
  });

  describe('Asset Management', () => {
    it('should load filter assets', async () => {
      const mockGLTFLoader = {
        loadAsync: jest.fn().mockResolvedValue({ scene: new THREE.Scene() })
      };
      const mockTextureLoader = {
        loadAsync: jest.fn().mockResolvedValue(new THREE.Texture())
      };

      global.THREE.GLTFLoader = jest.fn().mockImplementation(() => mockGLTFLoader);
      global.THREE.TextureLoader = jest.fn().mockImplementation(() => mockTextureLoader);

      const filter = {
        id: 'asset-test-filter',
        name: 'Asset Test Filter',
        description: 'Filter with assets',
        category: 'effects',
        assets: [
          {
            id: 'model-1',
            type: '3d_model',
            url: 'https://example.com/model.glb',
            preload: true
          },
          {
            id: 'texture-1',
            type: 'texture',
            url: 'https://example.com/texture.png',
            preload: true
          }
        ],
        settings: {
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
          opacity: 1,
          blendMode: 'normal'
        }
      };

      const sessionId = await arFilterService.startSession(filter);
      expect(mockGLTFLoader.loadAsync).toHaveBeenCalledWith(filter.assets[0].url);
      expect(mockTextureLoader.loadAsync).toHaveBeenCalledWith(filter.assets[1].url);
    });

    it('should handle asset loading errors', async () => {
      const mockGLTFLoader = {
        loadAsync: jest.fn().mockRejectedValue(new Error('Failed to load model'))
      };

      global.THREE.GLTFLoader = jest.fn().mockImplementation(() => mockGLTFLoader);

      const filter = {
        id: 'error-test-filter',
        name: 'Error Test Filter',
        description: 'Filter with failing asset',
        category: 'effects',
        assets: [
          {
            id: 'model-1',
            type: '3d_model',
            url: 'https://example.com/model.glb',
            preload: true
          }
        ],
        settings: {
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
          opacity: 1,
          blendMode: 'normal'
        }
      };

      await expect(arFilterService.startSession(filter)).rejects.toThrow('Failed to load model');
    });
  });

  describe('Face Tracking', () => {
    it('should initialize face tracking with correct configuration', () => {
      const mockFaceMesh = {
        setOptions: jest.fn(),
        onResults: jest.fn(),
        close: jest.fn()
      };

      global.FaceMesh = jest.fn().mockImplementation(() => mockFaceMesh);

      arFilterService.updateConfig({
        maxFaces: 2,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });

      expect(mockFaceMesh.setOptions).toHaveBeenCalledWith(expect.objectContaining({
        maxNumFaces: 2,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      }));
    });

    it('should process face detection results correctly', async () => {
      const mockResults = {
        multiFaceLandmarks: [
          [
            { x: 0, y: 0, z: 0 },
            { x: 0.1, y: 0.1, z: 0.1 }
          ]
        ]
      };

      const filter = {
        id: 'face-test-filter',
        name: 'Face Test Filter',
        description: 'Filter for face tracking test',
        category: 'effects',
        assets: [],
        settings: {
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
          opacity: 1,
          blendMode: 'normal'
        },
        landmarks: [0, 1]
      };

      const sessionId = await arFilterService.startSession(filter);
      const session = arFilterService.getSession(sessionId);

      expect(session?.stats.fps).toBe(0);
      
      // Simulate face detection result
      await (arFilterService as any).onFaceDetected(mockResults);
      
      const updatedSession = arFilterService.getSession(sessionId);
      expect(updatedSession?.stats.fps).toBeGreaterThan(0);
    });
  });

  describe('Filter Updates', () => {
    it('should update filter settings', async () => {
      const filter = {
        id: 'update-test-filter',
        name: 'Update Test Filter',
        description: 'Filter for update testing',
        category: 'effects',
        assets: [],
        settings: {
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
          opacity: 1,
          blendMode: 'normal'
        }
      };

      const sessionId = await arFilterService.startSession(filter);

      const updates = {
        settings: {
          position: new THREE.Vector3(1, 1, 1),
          opacity: 0.5
        }
      };

      await arFilterService.updateFilter(sessionId, updates);
      const session = arFilterService.getSession(sessionId);

      expect(session?.filter.settings.position).toEqual(updates.settings.position);
      expect(session?.filter.settings.opacity).toBe(updates.settings.opacity);
    });

    it('should handle invalid session updates', async () => {
      await expect(
        arFilterService.updateFilter('invalid-session', {})
      ).rejects.toThrow('Session invalid-session not found');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', async () => {
      const mockExtension = {
        UNMASKED_RENDERER_WEBGL: 37446
      };

      const mockGL = {
        getExtension: jest.fn().mockReturnValue(mockExtension),
        getParameter: jest.fn().mockReturnValue('Test GPU')
      };

      const mockRenderer = {
        getContext: jest.fn().mockReturnValue(mockGL),
        render: jest.fn(),
        dispose: jest.fn()
      };

      global.THREE.WebGLRenderer = jest.fn().mockImplementation(() => mockRenderer);

      const filter = {
        id: 'perf-test-filter',
        name: 'Performance Test Filter',
        description: 'Filter for performance testing',
        category: 'effects',
        assets: [],
        settings: {
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
          opacity: 1,
          blendMode: 'normal'
        }
      };

      const sessionId = await arFilterService.startSession(filter);
      const session = arFilterService.getSession(sessionId);

      expect(session?.stats).toBeDefined();
      expect(session?.stats.fps).toBeDefined();
      expect(session?.stats.latency).toBeDefined();
      expect(session?.stats.gpuMemory).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      const mockError = new Error('Failed to initialize WebGL');
      global.THREE.WebGLRenderer = jest.fn().mockImplementation(() => {
        throw mockError;
      });

      await expect(
        arFilterService.startSession({
          id: 'error-filter',
          name: 'Error Filter',
          description: 'Filter for error testing',
          category: 'effects',
          assets: [],
          settings: {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            scale: new THREE.Vector3(1, 1, 1),
            opacity: 1,
            blendMode: 'normal'
          }
        })
      ).rejects.toThrow('Failed to initialize WebGL');
    });

    it('should handle runtime errors gracefully', async () => {
      const filter = {
        id: 'runtime-error-filter',
        name: 'Runtime Error Filter',
        description: 'Filter for runtime error testing',
        category: 'effects',
        assets: [],
        settings: {
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
          opacity: 1,
          blendMode: 'normal'
        }
      };

      const sessionId = await arFilterService.startSession(filter);
      const session = arFilterService.getSession(sessionId);

      // Simulate runtime error
      const mockResults = {
        multiFaceLandmarks: null
      };

      await (arFilterService as any).onFaceDetected(mockResults);
      
      expect(session?.status).not.toBe('error');
    });
  });
}); 