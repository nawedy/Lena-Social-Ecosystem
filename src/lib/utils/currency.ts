// Currency formatting utilities
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  BTC: '₿',
  ETH: 'Ξ',
  // Add more currency symbols as needed
};

const CRYPTO_DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 18,
  // Add more crypto decimals as needed
};

/**
 * Format a currency amount with the appropriate symbol and decimals
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const decimals = CRYPTO_DECIMALS[currency] || 2;
  
  // Format the number with appropriate decimals
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);

  return `${symbol}${formattedAmount}`;
}

/**
 * Format a number in a compact way (e.g. 1.2K, 1.2M)
 */
export function formatCompactNumber(number: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(number);
}

/**
 * Parse a currency string into a number
 */
export function parseCurrency(value: string, currency: string): number {
  // Remove currency symbol and any non-numeric characters except decimal point
  const cleanValue = value.replace(CURRENCY_SYMBOLS[currency] || currency, '')
    .replace(/[^\d.-]/g, '');
  
  return Number(cleanValue);
}

/**
 * Get the appropriate number of decimal places for a currency
 */
export function getCurrencyDecimals(currency: string): number {
  return CRYPTO_DECIMALS[currency] || 2;
}

/**
 * Format a percentage change
 */
export function formatPercentageChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

/**
 * Convert between currencies using exchange rates
 * Note: This is a placeholder - in production, you'd want to use real exchange rates
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return amount;
  
  const rate = exchangeRates[`${fromCurrency}/${toCurrency}`];
  if (!rate) throw new Error(`No exchange rate found for ${fromCurrency}/${toCurrency}`);
  
  return amount * rate;
} 