import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import type { AuthUser, AuthSession } from '../types';

export class Web3Provider {
  private provider: ethers.BrowserProvider;
  private domain: string;
  private statement: string;

  constructor(domain: string, statement: string = 'Sign in with Ethereum to Lena') {
    this.provider = new ethers.BrowserProvider(window.ethereum);
    this.domain = domain;
    this.statement = statement;
  }

  async createSiweMessage(address: string, chainId: number = 1): Promise<string> {
    const message = new SiweMessage({
      domain: this.domain,
      address,
      statement: this.statement,
      uri: window.location.origin,
      version: '1',
      chainId,
      nonce: this.generateNonce()
    });

    return message.prepareMessage();
  }

  async signIn(address: string): Promise<AuthSession> {
    try {
      const signer = await this.provider.getSigner();
      const message = await this.createSiweMessage(address);
      const signature = await signer.signMessage(message);

      // Verify the signature
      const siweMessage = new SiweMessage(message);
      const fields = await siweMessage.verify({ signature });

      if (!fields.success) {
        throw new Error('Invalid signature');
      }

      const user: AuthUser = {
        id: address,
        ethAddress: address,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // In a real implementation, you would get these from your backend
      const accessToken = this.generateToken();
      const expiresIn = 24 * 60 * 60 * 1000; // 24 hours

      return {
        user,
        accessToken,
        expiresAt: new Date(Date.now() + expiresIn)
      };
    } catch (error) {
      throw new Error(`Web3 authentication failed: ${error.message}`);
    }
  }

  async getAccounts(): Promise<string[]> {
    try {
      return await this.provider.send('eth_requestAccounts', []);
    } catch (error) {
      throw new Error(`Failed to get Ethereum accounts: ${error.message}`);
    }
  }

  async getChainId(): Promise<number> {
    try {
      const network = await this.provider.getNetwork();
      return network.chainId;
    } catch (error) {
      throw new Error(`Failed to get chain ID: ${error.message}`);
    }
  }

  private generateNonce(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }

  private generateToken(): string {
    // In a real implementation, this would be handled by your backend
    return ethers.hexlify(ethers.randomBytes(32));
  }
} 