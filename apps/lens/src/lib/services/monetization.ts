import { api } from './api';
import type { 
  CreatorEarnings, 
  Transaction,
  PaymentMethod,
  PricingPlan,
  Subscription,
  PaginatedResponse, 
  ApiResponse 
} from '$lib/types';
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';

interface MonetizationState {
  earnings: Record<string, CreatorEarnings>;
  transactions: Record<string, Transaction[]>;
  paymentMethods: PaymentMethod[];
  subscriptions: Record<string, Subscription>;
  pricingPlans: PricingPlan[];
  loading: boolean;
  error: string | null;
}

function createMonetizationStore() {
  const { subscribe, set, update } = writable<MonetizationState>({
    earnings: {},
    transactions: {},
    paymentMethods: [],
    subscriptions: {},
    pricingPlans: [],
    loading: false,
    error: null
  });

  let realtimeSubscription: any = null;

  return {
    subscribe,
    set,
    update,

    /**
     * Initialize monetization and subscribe to real-time updates
     */
    initialize: async () => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        // Subscribe to real-time earnings updates
        realtimeSubscription = supabase
          .channel('monetization')
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'creator_earnings'
          }, payload => {
            const earnings = payload.new as CreatorEarnings;
            update(state => ({
              ...state,
              earnings: {
                ...state.earnings,
                [earnings.creatorId]: earnings
              }
            }));
          })
          .subscribe();

        // Get initial pricing plans
        const { data: plans } = await api.get<PricingPlan[]>('/monetization/pricing-plans');
        if (plans) {
          update(state => ({ ...state, pricingPlans: plans }));
        }

        return { error: null };
      } catch (error) {
        console.error('Failed to initialize monetization:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get creator earnings
     */
    getEarnings: async (creatorId: string, params?: {
      startDate?: string;
      endDate?: string;
    }): Promise<ApiResponse<CreatorEarnings>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: earnings, error } = await api.get<CreatorEarnings>(`/monetization/earnings/${creatorId}`, params);
        if (error) throw error;

        if (earnings) {
          update(state => ({
            ...state,
            earnings: { ...state.earnings, [creatorId]: earnings }
          }));
        }

        return { data: earnings };
      } catch (error) {
        console.error('Failed to get earnings:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get transactions with pagination
     */
    getTransactions: async (params?: {
      page?: number;
      perPage?: number;
      startDate?: string;
      endDate?: string;
      type?: string;
    }): Promise<PaginatedResponse<Transaction>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.getPaginated<Transaction>('/monetization/transactions', params);

        update(state => ({
          ...state,
          transactions: {
            ...state.transactions,
            [response.items[0]?.userId]: response.items
          }
        }));

        return response;
      } catch (error) {
        console.error('Failed to get transactions:', error);
        update(state => ({ ...state, error: error.message }));
        throw error;
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Add payment method
     */
    addPaymentMethod: async (data: {
      type: string;
      token: string;
      isDefault?: boolean;
    }): Promise<ApiResponse<PaymentMethod>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: paymentMethod, error } = await api.post<PaymentMethod>('/monetization/payment-methods', data);
        if (error) throw error;

        if (paymentMethod) {
          update(state => ({
            ...state,
            paymentMethods: [...state.paymentMethods, paymentMethod]
          }));
        }

        return { data: paymentMethod };
      } catch (error) {
        console.error('Failed to add payment method:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Remove payment method
     */
    removePaymentMethod: async (id: string): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.delete<void>(`/monetization/payment-methods/${id}`);
        if (error) throw error;

        update(state => ({
          ...state,
          paymentMethods: state.paymentMethods.filter(method => method.id !== id)
        }));

        return { error: null };
      } catch (error) {
        console.error('Failed to remove payment method:', error);
        return { error };
      }
    },

    /**
     * Set default payment method
     */
    setDefaultPaymentMethod: async (id: string): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.put<void>(`/monetization/payment-methods/${id}/default`);
        if (error) throw error;

        update(state => ({
          ...state,
          paymentMethods: state.paymentMethods.map(method => ({
            ...method,
            isDefault: method.id === id
          }))
        }));

        return { error: null };
      } catch (error) {
        console.error('Failed to set default payment method:', error);
        return { error };
      }
    },

    /**
     * Subscribe to a pricing plan
     */
    subscribe: async (planId: string, paymentMethodId?: string): Promise<ApiResponse<Subscription>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: subscription, error } = await api.post<Subscription>('/monetization/subscriptions', {
          planId,
          paymentMethodId
        });

        if (error) throw error;

        if (subscription) {
          update(state => ({
            ...state,
            subscriptions: {
              ...state.subscriptions,
              [subscription.userId]: subscription
            }
          }));
        }

        return { data: subscription };
      } catch (error) {
        console.error('Failed to subscribe:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Cancel subscription
     */
    cancelSubscription: async (subscriptionId: string): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.delete<void>(`/monetization/subscriptions/${subscriptionId}`);
        if (error) throw error;

        update(state => {
          const { [subscriptionId]: canceledSubscription, ...remainingSubscriptions } = state.subscriptions;
          return {
            ...state,
            subscriptions: remainingSubscriptions
          };
        });

        return { error: null };
      } catch (error) {
        console.error('Failed to cancel subscription:', error);
        return { error };
      }
    },

    /**
     * Update subscription
     */
    updateSubscription: async (subscriptionId: string, updates: {
      planId?: string;
      paymentMethodId?: string;
    }): Promise<ApiResponse<Subscription>> => {
      try {
        const { data: subscription, error } = await api.put<Subscription>(`/monetization/subscriptions/${subscriptionId}`, updates);
        if (error) throw error;

        if (subscription) {
          update(state => ({
            ...state,
            subscriptions: {
              ...state.subscriptions,
              [subscription.userId]: subscription
            }
          }));
        }

        return { data: subscription };
      } catch (error) {
        console.error('Failed to update subscription:', error);
        return { error };
      }
    },

    /**
     * Get pricing plans
     */
    getPricingPlans: async (): Promise<ApiResponse<PricingPlan[]>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: plans, error } = await api.get<PricingPlan[]>('/monetization/pricing-plans');
        if (error) throw error;

        if (plans) {
          update(state => ({ ...state, pricingPlans: plans }));
        }

        return { data: plans };
      } catch (error) {
        console.error('Failed to get pricing plans:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Process payment
     */
    processPayment: async (data: {
      amount: number;
      currency: string;
      paymentMethodId?: string;
      description?: string;
      metadata?: Record<string, any>;
    }): Promise<ApiResponse<Transaction>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: transaction, error } = await api.post<Transaction>('/monetization/payments', data);
        if (error) throw error;

        if (transaction) {
          update(state => ({
            ...state,
            transactions: {
              ...state.transactions,
              [transaction.userId]: [
                ...(state.transactions[transaction.userId] || []),
                transaction
              ]
            }
          }));
        }

        return { data: transaction };
      } catch (error) {
        console.error('Failed to process payment:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Request payout
     */
    requestPayout: async (data: {
      amount: number;
      currency: string;
      paymentMethodId: string;
    }): Promise<ApiResponse<Transaction>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: transaction, error } = await api.post<Transaction>('/monetization/payouts', data);
        if (error) throw error;

        if (transaction) {
          update(state => ({
            ...state,
            transactions: {
              ...state.transactions,
              [transaction.userId]: [
                ...(state.transactions[transaction.userId] || []),
                transaction
              ]
            }
          }));
        }

        return { data: transaction };
      } catch (error) {
        console.error('Failed to request payout:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Clean up subscriptions
     */
    cleanup: () => {
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
        realtimeSubscription = null;
      }
    },

    /**
     * Clear store state
     */
    clear: () => {
      set({
        earnings: {},
        transactions: {},
        paymentMethods: [],
        subscriptions: {},
        pricingPlans: [],
        loading: false,
        error: null
      });
    }
  };
}

// Create monetization store instance
export const monetization = createMonetizationStore();

// Derived stores
export const getCreatorEarnings = (creatorId: string) => derived(monetization, $monetization => 
  $monetization.earnings[creatorId]
);
export const getCreatorTransactions = (userId: string) => derived(monetization, $monetization => 
  $monetization.transactions[userId] || []
);
export const getUserSubscription = (userId: string) => derived(monetization, $monetization => 
  $monetization.subscriptions[userId]
);
export const paymentMethods = derived(monetization, $monetization => $monetization.paymentMethods);
export const pricingPlans = derived(monetization, $monetization => $monetization.pricingPlans);
export const isLoading = derived(monetization, $monetization => $monetization.loading);
export const error = derived(monetization, $monetization => $monetization.error); 