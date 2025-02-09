import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import type { Stripe } from '@stripe/stripe-js';

interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  limits: {
    storageGB: number;
    uploadsPerMonth: number;
    analyticsRetention: number;
    maxQuality: string;
    supportLevel: string;
  };
  stripePriceId: string;
  isPopular?: boolean;
  isCustom?: boolean;
}

interface Subscription {
  id: string;
  userId: string;
  tierId: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  metadata?: Record<string, any>;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'sepa' | 'bank_account';
  brand?: string;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

interface Invoice {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  createdAt: string;
  paidAt?: string;
  pdfUrl?: string;
}

export class SubscriptionService {
  private static instance: SubscriptionService;
  private stripe: Stripe | null = null;
  private subscription = writable<Subscription | null>(null);
  private tiers = writable<SubscriptionTier[]>([]);
  private paymentMethods = writable<PaymentMethod[]>([]);
  private invoices = writable<Invoice[]>([]);
  private loading = writable(false);
  private error = writable<string | null>(null);

  private constructor() {
    this.init();
  }

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  private async init() {
    try {
      this.loading.set(true);
      
      // Initialize Stripe
      const { data: { publicKey } } = await supabase
        .from('stripe_config')
        .select('public_key')
        .single();
      
      this.stripe = await loadStripe(publicKey);

      // Load subscription tiers
      await this.loadSubscriptionTiers();

      // Load user's subscription if authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await this.loadUserSubscription(user.id);
        await this.loadPaymentMethods(user.id);
        await this.loadInvoices(user.id);
      }

      this.setupRealtimeSubscription();
    } catch (err) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSubscriptionTiers() {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .order('price');

    if (error) throw error;
    this.tiers.set(data);
  }

  private async loadUserSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    this.subscription.set(data);
  }

  private async loadPaymentMethods(userId: string) {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });

    if (error) throw error;
    this.paymentMethods.set(data);
  }

  private async loadInvoices(userId: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    this.invoices.set(data);
  }

  private setupRealtimeSubscription() {
    const subscription = supabase
      .channel('subscription_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscriptions'
      }, this.handleSubscriptionChange.bind(this))
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  private async handleSubscriptionChange(payload: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && payload.new.user_id === user.id) {
      this.subscription.set(payload.new);
      await this.loadInvoices(user.id);
    }
  }

  async subscribe(tierId: string, paymentMethodId?: string): Promise<void> {
    try {
      this.loading.set(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create or update subscription
      const { data: { clientSecret }, error } = await supabase.functions.invoke('create-subscription', {
        body: { tierId, paymentMethodId }
      });

      if (error) throw error;

      // Confirm payment if needed
      if (clientSecret) {
        const { error: confirmError } = await this.stripe!.confirmCardPayment(clientSecret);
        if (confirmError) throw confirmError;
      }

      await this.loadUserSubscription(user.id);
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateSubscription(tierId: string): Promise<void> {
    try {
      this.loading.set(true);
      const subscription = this.getSubscription();
      if (!subscription) throw new Error('No active subscription');

      const { error } = await supabase.functions.invoke('update-subscription', {
        body: { subscriptionId: subscription.id, tierId }
      });

      if (error) throw error;
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async cancelSubscription(immediate: boolean = false): Promise<void> {
    try {
      this.loading.set(true);
      const subscription = this.getSubscription();
      if (!subscription) throw new Error('No active subscription');

      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: { subscriptionId: subscription.id, immediate }
      });

      if (error) throw error;
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async addPaymentMethod(paymentMethodId: string, setDefault: boolean = false): Promise<void> {
    try {
      this.loading.set(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.functions.invoke('add-payment-method', {
        body: { paymentMethodId, setDefault }
      });

      if (error) throw error;
      await this.loadPaymentMethods(user.id);
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      this.loading.set(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.functions.invoke('remove-payment-method', {
        body: { paymentMethodId }
      });

      if (error) throw error;
      await this.loadPaymentMethods(user.id);
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      this.loading.set(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.functions.invoke('set-default-payment-method', {
        body: { paymentMethodId }
      });

      if (error) throw error;
      await this.loadPaymentMethods(user.id);
    } catch (err) {
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  getSubscription(): Subscription | null {
    let result: Subscription | null = null;
    this.subscription.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getTiers(): SubscriptionTier[] {
    let result: SubscriptionTier[] = [];
    this.tiers.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getPaymentMethods(): PaymentMethod[] {
    let result: PaymentMethod[] = [];
    this.paymentMethods.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getInvoices(): Invoice[] {
    let result: Invoice[] = [];
    this.invoices.subscribe(value => {
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
  isSubscribed = derived(this.subscription, $sub => !!$sub && $sub.status === 'active');
  currentTier = derived([this.subscription, this.tiers], ([$sub, $tiers]) => {
    if (!$sub) return null;
    return $tiers.find(tier => tier.id === $sub.tierId) || null;
  });
  hasPaymentMethod = derived(this.paymentMethods, $methods => $methods.length > 0);
  defaultPaymentMethod = derived(this.paymentMethods, $methods => 
    $methods.find(method => method.isDefault) || null
  );

  cleanup() {
    // Cleanup subscriptions and listeners
    this.subscription.set(null);
    this.tiers.set([]);
    this.paymentMethods.set([]);
    this.invoices.set([]);
    this.error.set(null);
  }
}

export const subscriptionService = SubscriptionService.getInstance(); 