export interface ImageGalleryImage {
  id: string;
  url: string;
  thumbnail?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface ImageGalleryProps {
  images: ImageGalleryImage[];
  columns?: number;
  gap?: number;
  lightbox?: boolean;
} 