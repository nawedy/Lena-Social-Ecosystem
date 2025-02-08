export type DrawingMode = 
  | 'brush'
  | 'pencil'
  | 'marker'
  | 'eraser'
  | 'spray'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'polygon'
  | 'text';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: string;
  locked: boolean;
  data: ImageData;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  backgroundColor: string;
  padding: number;
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

export interface DrawingHistory {
  timestamp: number;
  type: 'draw' | 'erase' | 'text' | 'shape';
  mode: DrawingMode;
  data: ImageData;
  layer: string;
}

export interface ShapeStyle {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
  dashPattern?: number[];
  cornerRadius?: number;
  arrowStyle?: 'simple' | 'filled' | 'double';
}

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  tilt?: {
    x: number;
    y: number;
  };
}

export interface BrushStyle {
  size: number;
  opacity: number;
  color: string;
  hardness?: number;
  spacing?: number;
  angle?: number;
  roundness?: number;
  scattering?: number;
  texture?: {
    url: string;
    scale: number;
    rotation: number;
  };
}

export interface DrawingState {
  mode: DrawingMode;
  layers: Layer[];
  activeLayer: number;
  history: DrawingHistory[];
  historyIndex: number;
  brush: BrushStyle;
  shape: ShapeStyle;
  text: TextStyle;
  pressure: boolean;
  smoothing: boolean;
  grid: {
    enabled: boolean;
    size: number;
    color: string;
    opacity: number;
  };
  guides: {
    enabled: boolean;
    snapDistance: number;
    color: string;
  };
}

export interface DrawingMetrics {
  strokes: number;
  points: number;
  layers: number;
  undoCount: number;
  redoCount: number;
  duration: number;
  brushUsage: Record<DrawingMode, number>;
  layerOperations: {
    created: number;
    deleted: number;
    merged: number;
    reordered: number;
  };
}

export interface DrawingExport {
  width: number;
  height: number;
  layers: Array<{
    name: string;
    visible: boolean;
    opacity: number;
    blendMode: string;
    url: string;
  }>;
  state: DrawingState;
  metrics: DrawingMetrics;
  metadata: {
    createdAt: string;
    modifiedAt: string;
    software: {
      name: string;
      version: string;
    };
    hardware?: {
      pressureSensitive: boolean;
      pointerType: string;
    };
  };
} 