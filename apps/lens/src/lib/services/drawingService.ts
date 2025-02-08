import { writable, derived } from 'svelte/store';
import type {
  DrawingState,
  DrawingMode,
  Layer,
  Point,
  DrawingHistory,
  DrawingMetrics,
  DrawingExport
} from '$lib/types/drawing';
import { analytics } from './analytics';

// Initial state
const initialState: DrawingState = {
  mode: 'brush',
  layers: [],
  activeLayer: 0,
  history: [],
  historyIndex: -1,
  brush: {
    size: 5,
    opacity: 1,
    color: '#ffffff',
    hardness: 0.8,
    spacing: 0.1,
    angle: 0,
    roundness: 1,
    scattering: 0
  },
  shape: {
    strokeColor: '#ffffff',
    strokeWidth: 2,
    fillColor: 'transparent',
    opacity: 1
  },
  text: {
    fontFamily: 'Arial',
    fontSize: 24,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    color: '#ffffff',
    backgroundColor: 'transparent',
    padding: 8
  },
  pressure: true,
  smoothing: true,
  grid: {
    enabled: false,
    size: 20,
    color: '#ffffff',
    opacity: 0.1
  },
  guides: {
    enabled: true,
    snapDistance: 5,
    color: '#00a8ff'
  }
};

// Metrics tracking
const initialMetrics: DrawingMetrics = {
  strokes: 0,
  points: 0,
  layers: 0,
  undoCount: 0,
  redoCount: 0,
  duration: 0,
  brushUsage: {
    brush: 0,
    pencil: 0,
    marker: 0,
    eraser: 0,
    spray: 0,
    rectangle: 0,
    circle: 0,
    line: 0,
    arrow: 0,
    polygon: 0,
    text: 0
  },
  layerOperations: {
    created: 0,
    deleted: 0,
    merged: 0,
    reordered: 0
  }
};

function createDrawingStore() {
  const { subscribe, set, update } = writable<DrawingState>(initialState);
  const metrics = writable<DrawingMetrics>(initialMetrics);
  const startTime = Date.now();

  // Path smoothing
  let smoothedPoints: Point[] = [];
  const smoothingFactor = 0.5;

  return {
    subscribe,
    set,
    update,

    /**
     * Initialize drawing state
     */
    initialize(width: number, height: number) {
      const layer: Layer = {
        id: crypto.randomUUID(),
        name: 'Background',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        locked: false,
        data: new ImageData(width, height)
      };

      update(state => ({
        ...state,
        layers: [layer],
        activeLayer: 0
      }));

      metrics.update(m => ({
        ...m,
        layers: 1,
        layerOperations: {
          ...m.layerOperations,
          created: 1
        }
      }));

      // Track initialization
      analytics.trackEvent({
        type: 'drawing_initialized',
        data: { width, height }
      });
    },

    /**
     * Add a new point to the current stroke
     */
    addPoint(point: Point) {
      if (smoothedPoints.length === 0) {
        smoothedPoints = [point];
        return point;
      }

      const lastPoint = smoothedPoints[smoothedPoints.length - 1];
      const smoothedPoint: Point = {
        x: lastPoint.x + (point.x - lastPoint.x) * smoothingFactor,
        y: lastPoint.y + (point.y - lastPoint.y) * smoothingFactor,
        pressure: point.pressure,
        tilt: point.tilt
      };

      smoothedPoints.push(smoothedPoint);

      metrics.update(m => ({
        ...m,
        points: m.points + 1
      }));

      return smoothedPoint;
    },

    /**
     * Complete the current stroke
     */
    endStroke(layer: string) {
      update(state => {
        const history: DrawingHistory = {
          timestamp: Date.now(),
          type: 'draw',
          mode: state.mode,
          data: state.layers[state.activeLayer].data,
          layer
        };

        return {
          ...state,
          history: [
            ...state.history.slice(0, state.historyIndex + 1),
            history
          ],
          historyIndex: state.historyIndex + 1
        };
      });

      // Reset smoothing
      smoothedPoints = [];

      metrics.update(m => ({
        ...m,
        strokes: m.strokes + 1,
        brushUsage: {
          ...m.brushUsage,
          [initialState.mode]: m.brushUsage[initialState.mode] + 1
        }
      }));
    },

    /**
     * Create a new layer
     */
    createLayer(width: number, height: number, options: Partial<Layer> = {}) {
      const layer: Layer = {
        id: crypto.randomUUID(),
        name: `Layer ${initialState.layers.length + 1}`,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        locked: false,
        data: new ImageData(width, height),
        ...options
      };

      update(state => ({
        ...state,
        layers: [...state.layers, layer],
        activeLayer: state.layers.length
      }));

      metrics.update(m => ({
        ...m,
        layers: m.layers + 1,
        layerOperations: {
          ...m.layerOperations,
          created: m.layerOperations.created + 1
        }
      }));

      return layer;
    },

    /**
     * Delete a layer
     */
    deleteLayer(id: string) {
      update(state => {
        const index = state.layers.findIndex(l => l.id === id);
        if (index === -1) return state;

        const layers = state.layers.filter(l => l.id !== id);
        return {
          ...state,
          layers,
          activeLayer: Math.min(state.activeLayer, layers.length - 1)
        };
      });

      metrics.update(m => ({
        ...m,
        layers: m.layers - 1,
        layerOperations: {
          ...m.layerOperations,
          deleted: m.layerOperations.deleted + 1
        }
      }));
    },

    /**
     * Merge layers
     */
    mergeLayers(ids: string[]) {
      update(state => {
        const layers = state.layers.filter(l => ids.includes(l.id));
        if (layers.length < 2) return state;

        const mergedData = new ImageData(
          layers[0].data.width,
          layers[0].data.height
        );

        // Merge layer data
        layers.forEach(layer => {
          if (!layer.visible) return;
          // Apply blend mode and opacity...
        });

        const mergedLayer: Layer = {
          id: crypto.randomUUID(),
          name: 'Merged Layer',
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          locked: false,
          data: mergedData
        };

        const remainingLayers = state.layers.filter(l => !ids.includes(l.id));
        return {
          ...state,
          layers: [...remainingLayers, mergedLayer],
          activeLayer: remainingLayers.length
        };
      });

      metrics.update(m => ({
        ...m,
        layers: m.layers - ids.length + 1,
        layerOperations: {
          ...m.layerOperations,
          merged: m.layerOperations.merged + 1
        }
      }));
    },

    /**
     * Undo last action
     */
    undo() {
      update(state => {
        if (state.historyIndex < 0) return state;

        const previousState = state.history[state.historyIndex];
        const layerIndex = state.layers.findIndex(l => l.id === previousState.layer);
        if (layerIndex === -1) return state;

        return {
          ...state,
          layers: state.layers.map((layer, i) =>
            i === layerIndex ? { ...layer, data: previousState.data } : layer
          ),
          historyIndex: state.historyIndex - 1
        };
      });

      metrics.update(m => ({
        ...m,
        undoCount: m.undoCount + 1
      }));
    },

    /**
     * Redo last undone action
     */
    redo() {
      update(state => {
        if (state.historyIndex >= state.history.length - 1) return state;

        const nextState = state.history[state.historyIndex + 1];
        const layerIndex = state.layers.findIndex(l => l.id === nextState.layer);
        if (layerIndex === -1) return state;

        return {
          ...state,
          layers: state.layers.map((layer, i) =>
            i === layerIndex ? { ...layer, data: nextState.data } : layer
          ),
          historyIndex: state.historyIndex + 1
        };
      });

      metrics.update(m => ({
        ...m,
        redoCount: m.redoCount + 1
      }));
    },

    /**
     * Export drawing state and metrics
     */
    async export(): Promise<DrawingExport> {
      const state = get(this);
      const currentMetrics = get(metrics);

      // Convert layer data to URLs
      const layerUrls = await Promise.all(
        state.layers.map(async layer => {
          const canvas = document.createElement('canvas');
          canvas.width = layer.data.width;
          canvas.height = layer.data.height;
          const ctx = canvas.getContext('2d')!;
          ctx.putImageData(layer.data, 0, 0);
          return new Promise<string>((resolve) => {
            canvas.toBlob(blob => {
              resolve(URL.createObjectURL(blob!));
            }, 'image/png');
          });
        })
      );

      return {
        width: state.layers[0].data.width,
        height: state.layers[0].data.height,
        layers: state.layers.map((layer, i) => ({
          name: layer.name,
          visible: layer.visible,
          opacity: layer.opacity,
          blendMode: layer.blendMode,
          url: layerUrls[i]
        })),
        state,
        metrics: {
          ...currentMetrics,
          duration: Date.now() - startTime
        },
        metadata: {
          createdAt: new Date(startTime).toISOString(),
          modifiedAt: new Date().toISOString(),
          software: {
            name: 'Lens Drawing Tool',
            version: '1.0.0'
          },
          hardware: {
            pressureSensitive: 'pressure' in PointerEvent.prototype,
            pointerType: navigator.pointerEnabled ? 'pointer' : 'mouse'
          }
        }
      };
    }
  };
}

// Create drawing store instance
export const drawing = createDrawingStore();

// Derived stores
export const activeLayer = derived(drawing, $drawing => 
  $drawing.layers[$drawing.activeLayer]
);

export const canUndo = derived(drawing, $drawing => 
  $drawing.historyIndex >= 0
);

export const canRedo = derived(drawing, $drawing => 
  $drawing.historyIndex < $drawing.history.length - 1
); 