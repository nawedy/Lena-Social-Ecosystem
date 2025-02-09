import { writable, derived } from 'svelte/stores';
import { ethers } from 'ethers';
import { supabase } from '$lib/supabaseClient';
import type { ApiResponse } from '@tiktok-toe/shared';
import { EncryptionService } from '../security/EncryptionService';
import { BiometricService } from '../security/BiometricService';
import { kycService } from '../compliance/KYCService';

interface WalletBalance {
  currency: string;
  amount: number;
  usdValue: number;
  address?: string;
  network?: string;
}

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'exchange' | 'stake' | 'unstake' | 'reward';
  status: 'pending' | 'completed' | 'failed';
  fromAddress: string;
  toAddress: string;
  amount: number;
  currency: string;
  fee: number;
  timestamp: string;
  hash?: string;
  metadata?: Record<string, any>;
}

interface WalletSettings {
  coldStorage: {
    enabled: boolean;
    threshold: number;
    addresses: string[];
  };
  security: {
    requireBiometrics: boolean;
    multiSigEnabled: boolean;
    requiredSignatures: number;
    whitelistedAddresses: string[];
  };
  notifications: {
    largeTransactions: boolean;
    priceAlerts: boolean;
    securityAlerts: boolean;
  };
  autoConvert: {
    enabled: boolean;
    toCurrency: string;
    threshold: number;
  };
}

interface TransferRequest {
  to: string;
  amount: number;
  currency: string;
  type: 'crypto' | 'fiat';
  metadata?: Record<string, any>;
}

export class WalletService {
  private static instance: WalletService;
  private provider: ethers.providers.Provider;
  private wallets = writable<Record<string, ethers.Wallet>>({});
  private balances = writable<Record<string, WalletBalance>>({});
  private transactions = writable<Transaction[]>([]);
  private settings = writable<WalletSettings | null>(null);
  private loading = writable(false);
  private error = writable<string | null>(null);

  private constructor() {
    this.initializeProvider();
    if (browser) {
      this.init();
    }
  }

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  private async init() {
    try {
      await this.loadWallets();
      await this.loadSettings();
      this.setupRealtimeSubscription();
      this.startBalanceUpdates();
    } catch (err) {
      console.error('Failed to initialize wallet service:', err);
      this.error.set('Failed to initialize wallet service');
    }
  }

  private async initializeProvider() {
    // Initialize provider based on network configuration
    const network = import.meta.env.VITE_ETHEREUM_NETWORK || 'mainnet';
    this.provider = ethers.getDefaultProvider(network, {
      infura: import.meta.env.VITE_INFURA_PROJECT_ID,
      alchemy: import.meta.env.VITE_ALCHEMY_API_KEY,
    });
  }

  async createWallet(currency: string): Promise<ApiResponse<string>> {
    this.loading.set(true);
    try {
      const wallet = ethers.Wallet.createRandom().connect(this.provider);
      const encrypted = await EncryptionService.encryptPrivateKey(wallet.privateKey);
      
      const { data, error } = await supabase
        .from('wallets')
        .insert({
          user_id: supabase.auth.user()?.id,
          currency,
          address: wallet.address,
          encrypted_key: encrypted,
        });

      if (error) throw error;

      this.wallets.update(w => ({ ...w, [currency]: wallet }));
      return { data: wallet.address };
    } catch (err) {
      console.error('Failed to create wallet:', err);
      return { error: 'Failed to create wallet' };
    } finally {
      this.loading.set(false);
    }
  }

  async sendTransaction(params: {
    to: string;
    amount: number;
    currency: string;
    metadata?: Record<string, any>;
  }): Promise<ApiResponse<Transaction>> {
    this.loading.set(true);
    try {
      const wallet = await this.getWallet(params.currency);
      if (!wallet) throw new Error('Wallet not found');

      // Verify transaction with security service
      await this.verifyTransaction(params);

      const tx = await wallet.sendTransaction({
        to: params.to,
        value: ethers.utils.parseEther(params.amount.toString()),
      });

      const transaction: Transaction = {
        id: tx.hash,
        type: 'send',
        status: 'pending',
        fromAddress: wallet.address,
        toAddress: params.to,
        amount: params.amount,
        currency: params.currency,
        fee: 0, // Will be updated when tx is mined
        timestamp: new Date().toISOString(),
        hash: tx.hash,
        metadata: params.metadata,
      };

      await this.saveTransaction(transaction);
      return { data: transaction };
    } catch (err) {
      console.error('Failed to send transaction:', err);
      return { error: 'Failed to send transaction' };
    } finally {
      this.loading.set(false);
    }
  }

  private async verifyTransaction(params: any): Promise<void> {
    const settings = await this.getSettings();
    
    if (settings.security.requireBiometrics) {
      await BiometricService.verify('Confirm transaction');
    }

    if (settings.security.multiSigEnabled) {
      await this.collectMultiSignatures(params);
    }
  }

  async transfer(params: TransferRequest): Promise<ApiResponse<Transaction>> {
    this.loading.set(true);
    try {
      // Check KYC compliance
      const { data: isCompliant, error: complianceError } = await kycService.checkTransactionCompliance({
        amount: params.amount,
        currency: params.currency,
        type: params.type
      });

      if (complianceError) throw new Error(complianceError);
      if (!isCompliant) throw new Error('Transaction exceeds KYC limits');

      if (params.type === 'crypto') {
        return this.sendTransaction(params);
      } else {
        return this.sendFiatTransfer(params);
      }
    } catch (err) {
      console.error('Transfer failed:', err);
      return { error: 'Transfer failed' };
    } finally {
      this.loading.set(false);
    }
  }

  private async sendFiatTransfer(params: TransferRequest): Promise<ApiResponse<Transaction>> {
    try {
      // Verify bank account exists and is verified
      const { data: bankAccount } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('account_number', params.to)
        .single();

      if (!bankAccount || !bankAccount.is_verified) {
        throw new Error('Invalid or unverified bank account');
      }

      // Create transfer record
      const { data: transfer, error } = await supabase
        .from('transactions')
        .insert({
          wallet_id: (await this.getWallet(params.currency)).id,
          type: 'send',
          status: 'pending',
          from_address: bankAccount.account_number,
          to_address: params.to,
          amount: params.amount,
          currency: params.currency,
          fee: 0,
          metadata: {
            ...params.metadata,
            bank_name: bankAccount.bank_name,
            account_name: bankAccount.account_name
          }
        })
        .single();

      if (error) throw error;

      // Initiate bank transfer through payment processor
      await this.processFiatTransfer(transfer);

      return { data: transfer };
    } catch (err) {
      console.error('Fiat transfer failed:', err);
      return { error: 'Fiat transfer failed' };
    }
  }

  private async processFiatTransfer(transfer: Transaction): Promise<void> {
    // Integrate with payment processor (e.g., Stripe, Circle)
    // Handle webhooks for transfer status updates
    // Update transaction status based on processor response
  }

  async getTransferLimits(currency: string, type: 'crypto' | 'fiat'): Promise<ApiResponse<{
    daily: { limit: number; used: number };
    monthly: { limit: number; used: number };
    annual: { limit: number; used: number };
  }>> {
    try {
      const { data: limits, error } = await supabase
        .from('transfer_limits')
        .select('*')
        .eq('user_id', supabase.auth.user()?.id)
        .eq('currency', currency)
        .eq('type', type)
        .single();

      if (error) throw error;

      return {
        data: {
          daily: { limit: limits.daily_limit, used: limits.daily_used },
          monthly: { limit: limits.monthly_limit, used: limits.monthly_used },
          annual: { limit: limits.annual_limit, used: limits.annual_used }
        }
      };
    } catch (err) {
      console.error('Failed to get transfer limits:', err);
      return { error: 'Failed to get transfer limits' };
    }
  }

  // Derived stores
  totalBalance = derived(this.balances, $balances => 
    Object.values($balances).reduce((sum, b) => sum + b.usdValue, 0)
  );

  transactionHistory = derived(this.transactions, $transactions => 
    $transactions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  );

  pendingTransactions = derived(this.transactions, $transactions =>
    $transactions.filter(t => t.status === 'pending')
  );

  // Public methods
  getWallets() {
    return this.wallets;
  }

  getBalances() {
    return this.balances;
  }

  getSettings() {
    return this.settings;
  }

  isLoading() {
    return this.loading;
  }

  getError() {
    return this.error;
  }

  cleanup() {
    // Cleanup subscriptions and intervals
  }
}

export const walletService = WalletService.getInstance(); 