import Joi from 'joi';

// Base schemas for common fields
const userSchema = Joi.object({
  id: Joi.string().required(),
  username: Joi.string().required(),
  email: Joi.string().email().required(),
  createdAt: Joi.date().iso().required(),
  updatedAt: Joi.date().iso().required()
});

const metadataSchema = Joi.object({
  tags: Joi.array().items(Joi.string()).required(),
  category: Joi.string().required(),
  language: Joi.string().required(),
  visibility: Joi.string().valid('public', 'private', 'unlisted').required(),
  location: Joi.string().optional(),
  createdAt: Joi.date().iso().required(),
  [Joi.string()]: Joi.any() // Allow additional metadata fields
}).unknown(true);

// Content response schema
const contentSchema = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  type: Joi.string().valid('video', 'image').required(),
  url: Joi.string().uri().required(),
  thumbnailUrl: Joi.string().uri().when('type', {
    is: 'video',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  metadata: metadataSchema.required(),
  user: userSchema.required(),
  status: Joi.string().valid('queued', 'processing', 'completed', 'failed').required(),
  stats: Joi.object({
    views: Joi.number().min(0).required(),
    likes: Joi.number().min(0).required(),
    comments: Joi.number().min(0).required()
  }).required(),
  createdAt: Joi.date().iso().required(),
  updatedAt: Joi.date().iso().required()
});

// Paginated response schema
const paginatedSchema = Joi.object({
  items: Joi.array().required(),
  total: Joi.number().min(0).required(),
  page: Joi.number().min(1).required(),
  limit: Joi.number().min(1).required(),
  hasMore: Joi.boolean().required()
});

// Comment schema
const commentSchema = Joi.object({
  id: Joi.string().required(),
  text: Joi.string().required(),
  user: userSchema.required(),
  createdAt: Joi.date().iso().required(),
  updatedAt: Joi.date().iso().required()
});

// Analytics schema
const analyticsSchema = Joi.object({
  views: Joi.number().min(0).required(),
  likes: Joi.number().min(0).required(),
  comments: Joi.number().min(0).required(),
  averageWatchTime: Joi.number().min(0).required(),
  completionRate: Joi.number().min(0).max(1).required(),
  viewsByCountry: Joi.object().pattern(
    Joi.string(),
    Joi.number().min(0)
  ).required(),
  viewsByDevice: Joi.object().pattern(
    Joi.string(),
    Joi.number().min(0)
  ).required(),
  viewsByQuality: Joi.object().pattern(
    Joi.string(),
    Joi.number().min(0)
  ).required(),
  timeRange: Joi.object({
    start: Joi.date().iso().required(),
    end: Joi.date().iso().required()
  }).required()
});

/**
 * Validates a content response object
 */
export function validateContentResponse(data: any): boolean {
  const { error } = contentSchema.validate(data);
  if (error) {
    console.error('Content validation error:', error.details);
    return false;
  }
  return true;
}

/**
 * Validates a paginated response
 */
export function validatePaginatedResponse(data: any, itemSchema: Joi.Schema): boolean {
  const schema = paginatedSchema.keys({
    items: Joi.array().items(itemSchema).required()
  });

  const { error } = schema.validate(data);
  if (error) {
    console.error('Pagination validation error:', error.details);
    return false;
  }
  return true;
}

/**
 * Validates a comment response
 */
export function validateCommentResponse(data: any): boolean {
  const { error } = commentSchema.validate(data);
  if (error) {
    console.error('Comment validation error:', error.details);
    return false;
  }
  return true;
}

/**
 * Validates an analytics response
 */
export function validateAnalyticsResponse(data: any): boolean {
  const { error } = analyticsSchema.validate(data);
  if (error) {
    console.error('Analytics validation error:', error.details);
    return false;
  }
  return true;
}

/**
 * Validates a user response
 */
export function validateUserResponse(data: any): boolean {
  const { error } = userSchema.validate(data);
  if (error) {
    console.error('User validation error:', error.details);
    return false;
  }
  return true;
}

/**
 * Validates metadata
 */
export function validateMetadata(data: any): boolean {
  const { error } = metadataSchema.validate(data);
  if (error) {
    console.error('Metadata validation error:', error.details);
    return false;
  }
  return true;
} 