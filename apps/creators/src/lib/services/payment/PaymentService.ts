import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import type { Stripe, StripeElements, PaymentIntent } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';

interface PaymentConfig {
  publicKey: string;
  currency: string;
  supportedPaymentMethods: string[];
  minimumAmount: number;
  maximumAmount: number;
  processingFee: number;
  platformFee: number;
}

interface Transaction {
  id: string;
  userId: string;
  type: 'charge' | 'refund' | 'payout' | 'transfer';
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
  stripePaymentIntentId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface PayoutSettings {
  id: string;
  userId: string;
  type: 'bank_account' | 'debit_card' | 'crypto';
  status: 'pending' | 'verified' | 'disabled';
  defaultMethod: boolean;
  details: {
    accountHolderName?: string;
    accountNumber?: string;
    routingNumber?: string;
    bankName?: string;
    country?: string;
    currency?: string;
    cryptoAddress?: string;
    cryptoNetwork?: string;
  };
  stripeConnectedAccountId?: string;
  metadata?: Record<string, any>;
}

interface Balance {
  available: number;
  pending: number;
  currency: string;
  lastUpdated: string;
}

export class PaymentService {
  private static instance: PaymentService;
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private config = writable<PaymentConfig | null>(null);
  private transactions = writable<Transaction[]>([]);
  private payoutSettings = writable<PayoutSettings[]>([]);
  private balance = writable<Balance | null>(null);
  private loading = writable(false);
  private error = writable<string | null>(null);

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  private async init() {
    try {
      this.loading.set(true);

      // Load payment configuration
      const { data: config, error: configError } = await supabase
        .from('payment_config')
        .select('*')
        .single();

      if (configError) throw configError;
      this.config.set(config);

      // Initialize Stripe
      this.stripe = await loadStripe(config.publicKey);
      
      // Load user data if authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await Promise.all([
          this.loadTransactions(user.id),
          this.loadPayoutSettings(user.id),
          this.loadBalance(user.id)
        ]);
      }

      // Setup realtime subscriptions
      this.setupRealtimeSubscriptions();
    } catch (err) {
      console.error('Payment service initialization failed:', err);
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  private setupRealtimeSubscriptions() {
    const { data: { user } } = supabase.auth.getUser();
    if (!user) return;

    return supabase
      .channel('payment_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${user.id}`
      }, this.handleTransactionChange.bind(this))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payout_settings',
        filter: `user_id=eq.${user.id}`
      }, this.handlePayoutSettingsChange.bind(this))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'balances',
        filter: `user_id=eq.${user.id}`
      }, this.handleBalanceChange.bind(this))
      .subscribe();
  }

  private async handleTransactionChange(payload: any) {
    await this.loadTransactions(payload.new.user_id);
  }

  private async handlePayoutSettingsChange(payload: any) {
    await this.loadPayoutSettings(payload.new.user_id);
  }

  private async handleBalanceChange(payload: any) {
    await this.loadBalance(payload.new.user_id);
  }

  private async loadTransactions(userId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    this.transactions.set(data);
  }

  private async loadPayoutSettings(userId: string) {
    const { data, error } = await supabase
      .from('payout_settings')
      .select('*')
      .eq('user_id', userId)
      .order('default_method', { ascending: false });

    if (error) throw error;
    this.payoutSettings.set(data);
  }

  private async loadBalance(userId: string) {
    const { data, error } = await supabase
      .from('balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    this.balance.set(data);
  }

  async createPaymentIntent(amount: number, currency: string, metadata?: Record<string, any>): Promise<PaymentIntent> {
    try {
      this.loading.set(true);
      const { data: { clientSecret }, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { amount, currency, metadata }
      });

      if (error) throw error;

      const paymentIntent = await this.stripe!.retrievePaymentIntent(clientSecret);
      if (paymentIntent.error) throw paymentIntent.error;

      return paymentIntent.paymentIntent;
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async confirmPayment(paymentIntentId: string, paymentMethodId?: string): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await this.stripe!.confirmCardPayment(paymentIntentId, {
        payment_method: paymentMethodId
      });

      if (error) throw error;
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async requestRefund(transactionId: string, amount?: number): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase.functions.invoke('create-refund', {
        body: { transactionId, amount }
      });

      if (error) throw error;
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async createPayout(amount: number, payoutSettingId: string): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase.functions.invoke('create-payout', {
        body: { amount, payoutSettingId }
      });

      if (error) throw error;
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async addPayoutMethod(type: PayoutSettings['type'], details: PayoutSettings['details']): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase.functions.invoke('add-payout-method', {
        body: { type, details }
      });

      if (error) throw error;
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updatePayoutMethod(payoutSettingId: string, updates: Partial<PayoutSettings>): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase.functions.invoke('update-payout-method', {
        body: { payoutSettingId, updates }
      });

      if (error) throw error;
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async removePayoutMethod(payoutSettingId: string): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase.functions.invoke('remove-payout-method', {
        body: { payoutSettingId }
      });

      if (error) throw error;
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  getStripe(): Stripe | null {
    return this.stripe;
  }

  getElements(): StripeElements | null {
    return this.elements;
  }

  getConfig(): PaymentConfig | null {
    let result: PaymentConfig | null = null;
    this.config.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getTransactions(): Transaction[] {
    let result: Transaction[] = [];
    this.transactions.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getPayoutSettings(): PayoutSettings[] {
    let result: PayoutSettings[] = [];
    this.payoutSettings.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getBalance(): Balance | null {
    let result: Balance | null = null;
    this.balance.subscribe(value => {
      result = value;
    })();
    return result;
  }

  isLoading(): boolean {
    let result = false;
    this.loading.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getError(): string | null {
    let result: string | null = null;
    this.error.subscribe(value => {
      result = value;
    })();
    return result;
  }

  // Derived stores
  hasPayoutMethod = derived(this.payoutSettings, $settings => $settings.length > 0);
  defaultPayoutMethod = derived(this.payoutSettings, $settings => 
    $settings.find(setting => setting.defaultMethod) || null
  );
  totalEarnings = derived(this.transactions, $transactions =>
    $transactions
      .filter(t => t.type === 'charge' && t.status === 'succeeded')
      .reduce((sum, t) => sum + t.amount, 0)
  );
  pendingBalance = derived(this.balance, $balance => $balance?.pending || 0);
  availableBalance = derived(this.balance, $balance => $balance?.available || 0);

  cleanup() {
    // Cleanup subscriptions and state
    this.config.set(null);
    this.transactions.set([]);
    this.payoutSettings.set([]);
    this.balance.set(null);
    this.error.set(null);
  }
}

export const paymentService = PaymentService.getInstance(); 