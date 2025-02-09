import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { api } from '../utils/api-client';
import { generateTestUser, cleanupTestUser, generateTestContent } from '../utils/test-helpers';
import { validateContentResponse } from '../utils/validators';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Content API', () => {
  const testUser = generateTestUser();
  let authToken: string;
  let testContent: any;

  beforeAll(async () => {
    // Setup test user and get auth token
    await cleanupTestUser(testUser.email);
    const response = await api.post('/auth/register', testUser);
    authToken = response.data.token;
  });

  afterAll(async () => {
    await cleanupTestUser(testUser.email);
  });

  describe('Content Creation', () => {
    test('should create video content with metadata', async () => {
      const content = generateTestContent('video');
      const videoFile = readFileSync(join(__dirname, '../fixtures/test-video.mp4'));
      const thumbnailFile = readFileSync(join(__dirname, '../fixtures/test-thumbnail.jpg'));

      const formData = new FormData();
      formData.append('title', content.title);
      formData.append('description', content.description);
      formData.append('video', new Blob([videoFile], { type: 'video/mp4' }));
      formData.append('thumbnail', new Blob([thumbnailFile], { type: 'image/jpeg' }));
      formData.append('metadata', JSON.stringify(content.metadata));

      const response = await api.post('/content/video', formData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      expect(response.status).toBe(201);
      expect(validateContentResponse(response.data)).toBe(true);
      testContent = response.data;
    });

    test('should handle video processing status updates', async () => {
      const processingStates = ['queued', 'processing', 'completed'];
      let currentState = '';

      // Poll processing status until completed or timeout
      for (let i = 0; i < 30; i++) {
        const response = await api.get(`/content/${testContent.id}/status`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        currentState = response.data.status;
        if (currentState === 'completed') break;
        expect(processingStates).toContain(currentState);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      expect(currentState).toBe('completed');
    });

    test('should create image content', async () => {
      const content = generateTestContent('image');
      const imageFile = readFileSync(join(__dirname, '../fixtures/test-image.jpg'));

      const formData = new FormData();
      formData.append('title', content.title);
      formData.append('description', content.description);
      formData.append('image', new Blob([imageFile], { type: 'image/jpeg' }));
      formData.append('metadata', JSON.stringify(content.metadata));

      const response = await api.post('/content/image', formData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      expect(response.status).toBe(201);
      expect(validateContentResponse(response.data)).toBe(true);
    });
  });

  describe('Content Retrieval', () => {
    test('should get content by ID', async () => {
      const response = await api.get(`/content/${testContent.id}`);
      expect(response.status).toBe(200);
      expect(validateContentResponse(response.data)).toBe(true);
    });

    test('should list user content with pagination', async () => {
      const response = await api.get('/content/user', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { page: 1, limit: 10 }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.items)).toBe(true);
      expect(response.data.total).toBeGreaterThan(0);
      expect(response.data.page).toBe(1);
    });

    test('should filter content by type', async () => {
      const response = await api.get('/content/search', {
        params: { type: 'video', page: 1, limit: 10 }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.items)).toBe(true);
      response.data.items.forEach((item: any) => {
        expect(item.type).toBe('video');
      });
    });
  });

  describe('Content Updates', () => {
    test('should update content metadata', async () => {
      const updates = {
        title: 'Updated Title',
        description: 'Updated Description',
        metadata: { tags: ['updated', 'test'] }
      };

      const response = await api.patch(`/content/${testContent.id}`, updates, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.title).toBe(updates.title);
      expect(response.data.description).toBe(updates.description);
      expect(response.data.metadata.tags).toEqual(updates.metadata.tags);
    });

    test('should update content thumbnail', async () => {
      const thumbnailFile = readFileSync(join(__dirname, '../fixtures/test-thumbnail-2.jpg'));
      const formData = new FormData();
      formData.append('thumbnail', new Blob([thumbnailFile], { type: 'image/jpeg' }));

      const response = await api.patch(`/content/${testContent.id}/thumbnail`, formData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.thumbnailUrl).not.toBe(testContent.thumbnailUrl);
    });
  });

  describe('Content Interactions', () => {
    test('should like content', async () => {
      const response = await api.post(`/content/${testContent.id}/like`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.liked).toBe(true);
      expect(response.data.likeCount).toBeGreaterThan(0);
    });

    test('should add comment', async () => {
      const comment = { text: 'Test comment' };
      const response = await api.post(`/content/${testContent.id}/comments`, comment, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(201);
      expect(response.data.text).toBe(comment.text);
      expect(response.data.user.id).toBe(testUser.id);
    });

    test('should list comments with pagination', async () => {
      const response = await api.get(`/content/${testContent.id}/comments`, {
        params: { page: 1, limit: 10 }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.items)).toBe(true);
      expect(response.data.total).toBeGreaterThan(0);
    });
  });

  describe('Content Analytics', () => {
    test('should record view', async () => {
      const viewData = {
        watchTime: 30,
        completionRate: 0.5,
        quality: '720p'
      };

      const response = await api.post(`/content/${testContent.id}/view`, viewData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.viewCount).toBeGreaterThan(0);
    });

    test('should get content analytics', async () => {
      const response = await api.get(`/content/${testContent.id}/analytics`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.views).toBeGreaterThan(0);
      expect(response.data.likes).toBeGreaterThan(0);
      expect(response.data.comments).toBeGreaterThan(0);
      expect(response.data.averageWatchTime).toBeGreaterThan(0);
    });
  });

  describe('Content Deletion', () => {
    test('should delete content', async () => {
      const response = await api.delete(`/content/${testContent.id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);

      // Verify content is deleted
      const getResponse = await api.get(`/content/${testContent.id}`).catch(err => err.response);
      expect(getResponse.status).toBe(404);
    });

    test('should handle bulk deletion', async () => {
      // Create multiple test content items
      const contentIds = [];
      for (let i = 0; i < 3; i++) {
        const content = generateTestContent('image');
        const imageFile = readFileSync(join(__dirname, '../fixtures/test-image.jpg'));

        const formData = new FormData();
        formData.append('title', content.title);
        formData.append('image', new Blob([imageFile], { type: 'image/jpeg' }));

        const response = await api.post('/content/image', formData, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data'
          }
        });

        contentIds.push(response.data.id);
      }

      // Bulk delete
      const response = await api.post('/content/bulk-delete', {
        ids: contentIds
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.deletedCount).toBe(contentIds.length);

      // Verify all content is deleted
      for (const id of contentIds) {
        const getResponse = await api.get(`/content/${id}`).catch(err => err.response);
        expect(getResponse.status).toBe(404);
      }
    });
  });
}); 