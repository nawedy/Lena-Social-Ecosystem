export interface FileSelectEvent {
  detail: {
    files: File[];
  };
}

export interface FileErrorEvent {
  detail: {
    message: string;
  };
}

export interface ProgressEvent {
  progress: number;
} 