export class BiometricService {
  private static isAvailable(): boolean {
    return window.PublicKeyCredential !== undefined &&
           navigator.credentials !== undefined;
  }

  static async register(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Biometric authentication not available');
    }

    try {
      const publicKeyCredentialCreationOptions = {
        challenge: new Uint8Array(32),
        rp: {
          name: "Borsa Wallet",
          id: window.location.hostname
        },
        user: {
          id: new Uint8Array(16),
          name: "user@example.com",
          displayName: "Borsa User"
        },
        pubKeyCredParams: [{
          type: "public-key",
          alg: -7 // ES256
        }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          requireResidentKey: false
        },
        timeout: 60000,
        attestation: "direct"
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      return !!credential;
    } catch (error) {
      console.error('Failed to register biometrics:', error);
      return false;
    }
  }

  static async verify(message: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Biometric authentication not available');
    }

    try {
      const publicKeyCredentialRequestOptions = {
        challenge: new Uint8Array(32),
        rpId: window.location.hostname,
        userVerification: "required",
        timeout: 60000
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });

      return !!assertion;
    } catch (error) {
      console.error('Biometric verification failed:', error);
      return false;
    }
  }

  static async isSupported(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const supported = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return supported;
    } catch {
      return false;
    }
  }
} 