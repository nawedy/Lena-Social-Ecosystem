import { writable, type Writable } from 'svelte/store';
import type { Transaction } from './types';

class WalletService {
  private _transactionHistory: Writable<Transaction[]>;

  constructor() {
    this._transactionHistory = writable([]);
    this.loadTransactionHistory();
  }

  get transactionHistory() {
    return {
      subscribe: this._transactionHistory.subscribe
    };
  }

  private async loadTransactionHistory() {
    // TODO: Replace with actual API call
    const mockTransactions: Transaction[] = [
      {
        id: '1',
        type: 'receive',
        status: 'completed',
        amount: 0.5,
        currency: 'ETH',
        timestamp: new Date().getTime() - 1000 * 60 * 5, // 5 minutes ago
        fee: 0.001
      },
      {
        id: '2',
        type: 'send',
        status: 'pending',
        amount: 100,
        currency: 'USD',
        timestamp: new Date().getTime() - 1000 * 60 * 30, // 30 minutes ago
        fee: 1
      },
      {
        id: '3',
        type: 'exchange',
        status: 'completed',
        amount: 1000,
        currency: 'USDC',
        timestamp: new Date().getTime() - 1000 * 60 * 60, // 1 hour ago
        fee: 2.5
      },
      {
        id: '4',
        type: 'stake',
        status: 'completed',
        amount: 32,
        currency: 'ETH',
        timestamp: new Date().getTime() - 1000 * 60 * 60 * 24, // 1 day ago
        fee: 0
      },
      {
        id: '5',
        type: 'reward',
        status: 'completed',
        amount: 0.01,
        currency: 'ETH',
        timestamp: new Date().getTime() - 1000 * 60 * 60 * 48, // 2 days ago
        fee: 0
      }
    ];

    this._transactionHistory.set(mockTransactions);
  }

  // Add more wallet-related methods here
}

export const walletService = new WalletService(); 