/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(amount);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `${amount} ${currency}`;
  }
}

/**
 * Format a number as a percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Convert between currencies using exchange rates
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  // TODO: Integrate with exchange rate API
  return amount;
}

/**
 * Format crypto amounts with appropriate precision
 */
export function formatCryptoAmount(amount: number, currency: string): string {
  const precision = getCryptoPrecision(currency);
  return amount.toFixed(precision);
}

/**
 * Get the appropriate decimal precision for a cryptocurrency
 */
function getCryptoPrecision(currency: string): number {
  const precisionMap: Record<string, number> = {
    BTC: 8,
    ETH: 6,
    USDT: 2,
    USDC: 2,
    // Add more currencies as needed
  };
  return precisionMap[currency] || 8;
}

/**
 * Format large numbers with K/M/B suffixes
 */
export function formatCompactNumber(value: number): string {
  const formatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return formatter.format(value);
}

/**
 * Parse a currency string into a number
 */
export function parseCurrencyString(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, ''));
} 