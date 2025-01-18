import { device, element, by, expect } from 'detox';

describe('Post Creation Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
    // Login before running tests
    await element(by.id('username-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('Test123!@#');
    await element(by.id('login-button')).tap();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should open compose screen', async () => {
    await element(by.id('compose-tab')).tap();
    await expect(element(by.id('compose-screen'))).toBeVisible();
    await expect(element(by.id('compose-title'))).toHaveText('Create Post');
  });

  it('should show media picker options', async () => {
    await element(by.id('compose-tab')).tap();
    await element(by.id('add-media-button')).tap();
    await expect(element(by.id('media-picker-modal'))).toBeVisible();
    await expect(element(by.id('take-photo-button'))).toBeVisible();
    await expect(element(by.id('take-video-button'))).toBeVisible();
    await expect(element(by.id('choose-from-library-button'))).toBeVisible();
  });

  it('should handle image selection from library', async () => {
    await element(by.id('compose-tab')).tap();
    await element(by.id('add-media-button')).tap();
    await element(by.id('choose-from-library-button')).tap();
    // Simulate image selection
    await device.selectImage('test-image.jpg');
    await expect(element(by.id('selected-media-preview'))).toBeVisible();
  });

  it('should handle multiple image selection', async () => {
    await element(by.id('compose-tab')).tap();
    await element(by.id('add-media-button')).tap();
    await element(by.id('choose-from-library-button')).tap();
    // Simulate multiple image selection
    await device.selectImages(['image1.jpg', 'image2.jpg', 'image3.jpg']);
    await expect(element(by.id('media-preview-count'))).toHaveText('3');
  });

  it('should show image editing options', async () => {
    await element(by.id('compose-tab')).tap();
    await element(by.id('add-media-button')).tap();
    await element(by.id('choose-from-library-button')).tap();
    await device.selectImage('test-image.jpg');
    await element(by.id('edit-media-button')).tap();
    await expect(element(by.id('edit-media-modal'))).toBeVisible();
    await expect(element(by.id('crop-button'))).toBeVisible();
    await expect(element(by.id('filter-button'))).toBeVisible();
    await expect(element(by.id('adjust-button'))).toBeVisible();
  });

  it('should validate post content', async () => {
    await element(by.id('compose-tab')).tap();
    await element(by.id('post-button')).tap();
    await expect(element(by.text('Post content is required'))).toBeVisible();
  });

  it('should create post with text only', async () => {
    await element(by.id('compose-tab')).tap();
    await element(by.id('post-content-input')).typeText('Hello, world!');
    await element(by.id('post-button')).tap();
    await expect(element(by.id('post-success-message'))).toBeVisible();
    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  it('should create post with media', async () => {
    await element(by.id('compose-tab')).tap();
    await element(by.id('add-media-button')).tap();
    await element(by.id('choose-from-library-button')).tap();
    await device.selectImage('test-image.jpg');
    await element(by.id('post-content-input')).typeText('Post with image');
    await element(by.id('post-button')).tap();
    await expect(element(by.id('post-success-message'))).toBeVisible();
    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  it('should handle post creation errors', async () => {
    await element(by.id('compose-tab')).tap();
    await element(by.id('post-content-input')).typeText('A'.repeat(301)); // Exceed character limit
    await element(by.id('post-button')).tap();
    await expect(element(by.text('Post content too long'))).toBeVisible();
  });

  it('should show upload progress for media', async () => {
    await element(by.id('compose-tab')).tap();
    await element(by.id('add-media-button')).tap();
    await element(by.id('choose-from-library-button')).tap();
    await device.selectImage('large-image.jpg');
    await element(by.id('post-content-input')).typeText(
      'Post with large image'
    );
    await element(by.id('post-button')).tap();
    await expect(element(by.id('upload-progress'))).toBeVisible();
    await expect(element(by.id('upload-progress'))).toHaveText('100%');
  });

  it('should handle offline post creation', async () => {
    await device.setOffline(true);
    await element(by.id('compose-tab')).tap();
    await element(by.id('post-content-input')).typeText('Offline post');
    await element(by.id('post-button')).tap();
    await expect(
      element(by.text('Post will be uploaded when online'))
    ).toBeVisible();
    await device.setOffline(false);
  });

  it('should show draft saving options', async () => {
    await element(by.id('compose-tab')).tap();
    await element(by.id('post-content-input')).typeText('Draft post');
    await element(by.id('back-button')).tap();
    await expect(element(by.id('save-draft-modal'))).toBeVisible();
    await element(by.id('save-draft-button')).tap();
    await expect(element(by.text('Draft saved'))).toBeVisible();
  });
});
