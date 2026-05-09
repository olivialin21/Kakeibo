import { type ReceiptItem } from '../db/db';

export interface SavedReceipt {
  id: string;
  shopName: string;
  date: string;
  totalAmount: number;
  tax8Amount: number;
  tax10Amount: number;
  items: ReceiptItem[];
  tripId?: string;
  createdAt: string;
}

const STORAGE_KEY = 'kakeibo_receipts';

export const receiptStore = {
  // 取得所有收據
  getAll(): SavedReceipt[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  // 儲存收據
  save(receipt: Omit<SavedReceipt, 'id' | 'createdAt'>): SavedReceipt {
    const receipts = this.getAll();
    const newReceipt: SavedReceipt = {
      ...receipt,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    receipts.unshift(newReceipt); // 新的在前面
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
    return newReceipt;
  },

  // 刪除收據
  delete(id: string) {
    const receipts = this.getAll().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  },

  // 更新收據
  update(id: string, updates: Partial<SavedReceipt>) {
    const receipts = this.getAll().map(r =>
      r.id === id ? { ...r, ...updates } : r
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  },

  // 取得本月總支出
  getMonthTotal(): number {
    const receipts = this.getAll();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return receipts
      .filter(r => r.date.startsWith(currentMonth))
      .reduce((sum, r) => sum + r.totalAmount, 0);
  }
};
