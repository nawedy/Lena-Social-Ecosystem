import { device, element, by, expect } from 'detox';

describe('Authentication Flow', () => {
  beforeEach(async () => {
    await device.launchApp();
  });

  it('should show login screen by default', async () => {
    await expect(element(by.id('login-screen'))).toBeVisible();
    await expect(element(by.id('login-title'))).toHaveText('Welcome Back');
  });

  it('should show validation errors when submitting empty form', async () => {
    await element(by.id('login-button')).tap();
    await expect(element(by.text('Username is required'))).toBeVisible();
    await expect(element(by.text('Password is required'))).toBeVisible();
  });

  it('should show error message for invalid credentials', async () => {
    await element(by.id('username-input')).typeText('invalid@example.com');
    await element(by.id('password-input')).typeText('wrongpassword');
    await element(by.id('login-button')).tap();
    await expect(element(by.text('Invalid credentials'))).toBeVisible();
  });

  it('should navigate to register screen', async () => {
    await element(by.id('register-link')).tap();
    await expect(element(by.id('register-screen'))).toBeVisible();
    await expect(element(by.id('register-title'))).toHaveText('Create Account');
  });

  it('should register new user successfully', async () => {
    await element(by.id('register-link')).tap();
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('username-input')).typeText('testuser');
    await element(by.id('password-input')).typeText('Test123!@#');
    await element(by.id('confirm-password-input')).typeText('Test123!@#');
    await element(by.id('register-button')).tap();
    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  it('should login successfully with registered user', async () => {
    await element(by.id('username-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('Test123!@#');
    await element(by.id('login-button')).tap();
    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  it('should toggle password visibility', async () => {
    await element(by.id('password-input')).typeText('Test123!@#');
    await expect(element(by.id('password-input'))).toHaveProps({ secureTextEntry: true });
    await element(by.id('show-password-button')).tap();
    await expect(element(by.id('password-input'))).toHaveProps({ secureTextEntry: false });
    await element(by.id('show-password-button')).tap();
    await expect(element(by.id('password-input'))).toHaveProps({ secureTextEntry: true });
  });

  it('should handle forgot password flow', async () => {
    await element(by.id('forgot-password-link')).tap();
    await expect(element(by.id('forgot-password-screen'))).toBeVisible();
    await expect(element(by.id('forgot-password-title'))).toHaveText(
      'Reset Password'
    );
  });

  it('should send password reset email', async () => {
    await element(by.id('forgot-password-link')).tap();
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('reset-password-button')).tap();
    await expect(element(by.text('Password reset email sent'))).toBeVisible();
  });

  it('should logout successfully', async () => {
    await element(by.id('username-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('Test123!@#');
    await element(by.id('login-button')).tap();
    await expect(element(by.id('home-screen'))).toBeVisible();
    await element(by.id('profile-tab')).tap();
    await element(by.id('logout-button')).tap();
    await expect(element(by.id('login-screen'))).toBeVisible();
  });
});
