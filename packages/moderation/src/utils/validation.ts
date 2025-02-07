import type { ContentType } from '../types';

const MAX_TEXT_LENGTH = 50000; // 50K characters
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav'];

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateContent(
  content: string | File,
  type: ContentType,
  options: {
    maxTextLength?: number;
    maxFileSize?: number;
    allowedTypes?: string[];
  } = {}
): ValidationResult {
  const errors: string[] = [];
  const {
    maxTextLength = MAX_TEXT_LENGTH,
    maxFileSize = MAX_FILE_SIZE,
    allowedTypes
  } = options;

  if (typeof content === 'string' && type === 'text') {
    // Validate text content
    if (content.length === 0) {
      errors.push('Content cannot be empty');
    }
    if (content.length > maxTextLength) {
      errors.push(`Content exceeds maximum length of ${maxTextLength} characters`);
    }
  } else if (content instanceof File) {
    // Validate file content
    if (content.size === 0) {
      errors.push('File cannot be empty');
    }
    if (content.size > maxFileSize) {
      errors.push(`File exceeds maximum size of ${maxFileSize / 1024 / 1024}MB`);
    }

    // Validate file type
    const validTypes = allowedTypes || getDefaultAllowedTypes(type);
    if (!validTypes.includes(content.type)) {
      errors.push(`File type ${content.type} is not allowed. Allowed types: ${validTypes.join(', ')}`);
    }
  } else {
    errors.push('Invalid content type');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function getDefaultAllowedTypes(type: ContentType): string[] {
  switch (type) {
    case 'image':
      return ALLOWED_IMAGE_TYPES;
    case 'video':
      return ALLOWED_VIDEO_TYPES;
    case 'audio':
      return ALLOWED_AUDIO_TYPES;
    default:
      return [];
  }
}

export function validateAppeal(reason: string, evidence?: string): ValidationResult {
  const errors: string[] = [];

  if (reason.length < 10) {
    errors.push('Appeal reason must be at least 10 characters long');
  }
  if (reason.length > 1000) {
    errors.push('Appeal reason cannot exceed 1000 characters');
  }
  if (evidence && evidence.length > 2000) {
    errors.push('Evidence cannot exceed 2000 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateCommunityFlag(reason: string, description?: string): ValidationResult {
  const errors: string[] = [];

  if (reason.length < 5) {
    errors.push('Flag reason must be at least 5 characters long');
  }
  if (description && description.length > 1000) {
    errors.push('Description cannot exceed 1000 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
} 