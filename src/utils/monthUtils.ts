export function getCurrentMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthRange(monthPrefix: string) {
  const [year, month] = monthPrefix.split('-').map(Number);
  const startOfMonth = new Date(year, month - 1, 1).getTime();
  const startOfNextMonth = new Date(year, month, 1).getTime();
  return { startOfMonth, startOfNextMonth };
}

export function formatMonthLabel(monthPrefix: string): string {
  return monthPrefix.replace('-', '年') + '月';
}

export function getReceiptMonthPrefix(date: number): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getAvailableMonthsFromDates(dates: number[], ensureMonth?: string): string[] {
  const months = new Set(dates.map(getReceiptMonthPrefix));
  if (ensureMonth) months.add(ensureMonth);
  return Array.from(months).sort().reverse();
}

export function getDefaultMonthForReceipts(dates: number[]): string {
  const calendarMonth = getCurrentMonthPrefix();
  const prefixes = dates.map(getReceiptMonthPrefix);
  if (prefixes.includes(calendarMonth)) return calendarMonth;
  if (dates.length > 0) {
    const latest = Math.max(...dates);
    return getReceiptMonthPrefix(latest);
  }
  return calendarMonth;
}

export function isDateInMonth(date: number, monthPrefix: string): boolean {
  const { startOfMonth, startOfNextMonth } = getMonthRange(monthPrefix);
  return date >= startOfMonth && date < startOfNextMonth;
}
