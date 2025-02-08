import { supabase } from '$lib/supabaseClient';
import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import { Magic } from 'magic-sdk';
import type { Profile } from '$lib/types';

interface VerificationConfig {
  siwe: {
    domain: string;
    origin: string;
    statement: string;
  };
  magic: {
    apiKey: string;
    network: 'mainnet' | 'testnet';
  };
  oauth: {
    providers: string[];
    redirectUri: string;
  };
}

interface VerificationStatus {
  isVerified: boolean;
  methods: string[];
  lastVerified: Date | null;
  score: number;
}

interface VerificationProof {
  type: string;
  timestamp: Date;
  proof: string;
  metadata: Record<string, any>;
}

class UserVerificationService {
  private magic: Magic;
  private config: VerificationConfig;

  constructor() {
    this.config = {
      siwe: {
        domain: window.location.host,
        origin: window.location.origin,
        statement: 'Sign in with Ethereum to verify your account on Echo'
      },
      magic: {
        apiKey: import.meta.env.VITE_MAGIC_API_KEY,
        network: import.meta.env.VITE_MAGIC_NETWORK || 'mainnet'
      },
      oauth: {
        providers: ['github', 'twitter', 'google'],
        redirectUri: `${window.location.origin}/auth/callback`
      }
    };

    this.magic = new Magic(this.config.magic.apiKey, {
      network: this.config.magic.network
    });
  }

  async verifyWithEthereum(address: string): Promise<VerificationProof> {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Create SIWE message
      const message = new SiweMessage({
        domain: this.config.siwe.domain,
        address,
        statement: this.config.siwe.statement,
        uri: this.config.siwe.origin,
        version: '1',
        chainId: 1,
        nonce: this.generateNonce()
      });

      // Sign the message
      const signature = await signer.signMessage(message.prepareMessage());

      const proof: VerificationProof = {
        type: 'ethereum',
        timestamp: new Date(),
        proof: signature,
        metadata: {
          address,
          message: message.prepareMessage()
        }
      };

      await this.storeVerificationProof(address, proof);
      return proof;
    } catch (error) {
      console.error('Error verifying with Ethereum:', error);
      throw error;
    }
  }

  async verifyWithMagicLink(email: string): Promise<VerificationProof> {
    try {
      // Send magic link
      const didToken = await this.magic.auth.loginWithMagicLink({
        email
      });

      const proof: VerificationProof = {
        type: 'magic_link',
        timestamp: new Date(),
        proof: didToken,
        metadata: {
          email
        }
      };

      await this.storeVerificationProof(email, proof);
      return proof;
    } catch (error) {
      console.error('Error verifying with Magic Link:', error);
      throw error;
    }
  }

  async verifyWithOAuth(
    provider: string,
    code: string
  ): Promise<VerificationProof> {
    try {
      if (!this.config.oauth.providers.includes(provider)) {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
      }

      // Exchange code for tokens
      const response = await fetch('/api/auth/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider,
          code
        })
      });

      if (!response.ok) {
        throw new Error('OAuth verification failed');
      }

      const { tokens, profile } = await response.json();

      const proof: VerificationProof = {
        type: `oauth_${provider}`,
        timestamp: new Date(),
        proof: tokens.access_token,
        metadata: {
          provider,
          profile
        }
      };

      await this.storeVerificationProof(profile.id, proof);
      return proof;
    } catch (error) {
      console.error('Error verifying with OAuth:', error);
      throw error;
    }
  }

  async verifyWithMFA(
    userId: string,
    code: string,
    method: 'totp' | 'sms'
  ): Promise<VerificationProof> {
    try {
      // Verify MFA code
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          code,
          method
        })
      });

      if (!response.ok) {
        throw new Error('MFA verification failed');
      }

      const proof: VerificationProof = {
        type: `mfa_${method}`,
        timestamp: new Date(),
        proof: code,
        metadata: {
          method
        }
      };

      await this.storeVerificationProof(userId, proof);
      return proof;
    } catch (error) {
      console.error('Error verifying with MFA:', error);
      throw error;
    }
  }

  async getVerificationStatus(userId: string): Promise<VerificationStatus> {
    try {
      const { data: proofs, error } = await supabase
        .from('verification_proofs')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const status: VerificationStatus = {
        isVerified: false,
        methods: [],
        lastVerified: null,
        score: 0
      };

      if (proofs && proofs.length > 0) {
        status.methods = [...new Set(proofs.map(p => p.type))];
        status.lastVerified = new Date(
          Math.max(...proofs.map(p => new Date(p.timestamp).getTime()))
        );
        status.score = this.calculateVerificationScore(proofs);
        status.isVerified = status.score >= 0.7; // 70% threshold
      }

      return status;
    } catch (error) {
      console.error('Error getting verification status:', error);
      throw error;
    }
  }

  private async storeVerificationProof(
    userId: string,
    proof: VerificationProof
  ): Promise<void> {
    try {
      await supabase
        .from('verification_proofs')
        .insert({
          user_id: userId,
          type: proof.type,
          timestamp: proof.timestamp.toISOString(),
          proof: proof.proof,
          metadata: proof.metadata
        });
    } catch (error) {
      console.error('Error storing verification proof:', error);
      throw error;
    }
  }

  private calculateVerificationScore(proofs: VerificationProof[]): number {
    const weights = {
      ethereum: 0.4,
      magic_link: 0.3,
      oauth_github: 0.2,
      oauth_twitter: 0.2,
      oauth_google: 0.2,
      mfa_totp: 0.3,
      mfa_sms: 0.2
    };

    let score = 0;
    const methods = new Set(proofs.map(p => p.type));

    for (const method of methods) {
      score += weights[method] || 0;
    }

    return Math.min(score, 1); // Cap at 1.0
  }

  private generateNonce(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async updateVerificationBadge(userId: string): Promise<void> {
    try {
      const status = await this.getVerificationStatus(userId);

      if (status.isVerified) {
        await supabase
          .from('profiles')
          .update({
            is_verified: true,
            verification_score: status.score,
            verification_methods: status.methods,
            last_verified: status.lastVerified?.toISOString()
          })
          .eq('id', userId);
      }
    } catch (error) {
      console.error('Error updating verification badge:', error);
      throw error;
    }
  }

  async revokeVerification(
    userId: string,
    method?: string
  ): Promise<void> {
    try {
      const query = supabase
        .from('verification_proofs')
        .delete()
        .eq('user_id', userId);

      if (method) {
        query.eq('type', method);
      }

      await query;
      await this.updateVerificationBadge(userId);
    } catch (error) {
      console.error('Error revoking verification:', error);
      throw error;
    }
  }
}

export const userVerification = new UserVerificationService(); 