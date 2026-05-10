/**
 * Centralized formatting and calculation utilities
 */

// Current estimated JPY to TWD exchange rate
export const DEFAULT_EXCHANGE_RATE = 0.21;

/**
 * Formats a JPY amount to TWD based on manual amount or default rate
 */
export function formatToTwd(jpyAmount: number, manualTwdAmount?: number): number {
  return manualTwdAmount ?? Math.round(jpyAmount * DEFAULT_EXCHANGE_RATE);
}

/**
 * Groups an array of objects by a date key formatted as a localized string
 */
export function groupReceiptsByDate<T extends { date: number }>(receipts: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  
  receipts.forEach(r => {
    const dateKey = new Date(r.date).toLocaleDateString('zh-TW', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(r);
  });
  
  return grouped;
}

/**
 * Standard date-time formatter for receipt items
 */
export function formatReceiptTime(date: number): string {
  return new Date(date).toLocaleTimeString('zh-TW', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}
