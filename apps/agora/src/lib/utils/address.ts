/**
 * Truncates an Ethereum address to a shorter format
 * @param address The full Ethereum address
 * @param startLength Number of characters to show at start (default: 6)
 * @param endLength Number of characters to show at end (default: 4)
 * @returns Truncated address string
 */
export function truncateAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4
): string {
  if (!address) return '';
  if (address.length <= startLength + endLength) return address;
  
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/**
 * Validates an Ethereum address
 * @param address The address to validate
 * @returns boolean indicating if the address is valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Ensures an address starts with 0x
 * @param address The address to normalize
 * @returns Normalized address
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  return address.startsWith('0x') ? address : `0x${address}`;
}

/**
 * Compares two addresses for equality (case-insensitive)
 * @param address1 First address
 * @param address2 Second address
 * @returns boolean indicating if addresses are equal
 */
export function compareAddresses(address1: string, address2: string): boolean {
  return address1?.toLowerCase() === address2?.toLowerCase();
} 