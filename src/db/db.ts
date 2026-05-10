import Dexie, { type EntityTable } from 'dexie';

export interface Trip {
  id: string;
  name: string;
  startDate: number;
  endDate?: number;
  description?: string;
}

export interface Receipt {
  id: string;
  date: number;
  shopName: string;
  totalAmount: number;
  currency: string;
  exchangeRate: number;
  tax8Amount: number;
  tax10Amount: number;
  taxType?: 'inclusive' | 'exclusive';
  imageBlobs?: Blob[];
  manualTwdAmount?: number;
  tripId?: string;
}

export interface ReceiptItem {
  id: string;
  receiptId: string;
  name: string;
  originalPrice: number;
  finalPrice: number;
  taxRate: number;
  categoryId: string;
  quantity: number;
  discount?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

const db = new Dexie('ReceiptDatabase') as Dexie & {
  receipts: EntityTable<Receipt, 'id'>;
  receiptItems: EntityTable<ReceiptItem, 'id'>;
  categories: EntityTable<Category, 'id'>;
  trips: EntityTable<Trip, 'id'>;
};

// Schema declaration
db.version(1).stores({
  receipts: 'id, date, shopName',
  receiptItems: 'id, receiptId, categoryId',
  categories: 'id, name'
});

db.version(2).stores({
  receipts: 'id, date, shopName',
  receiptItems: 'id, receiptId, categoryId',
  categories: 'id, name'
});

// V3: add trips support and tripId index
db.version(3).stores({
  receipts: 'id, date, shopName, tripId',
  receiptItems: 'id, receiptId, categoryId',
  categories: 'id, name',
  trips: 'id, name'
});

// Pre-populate some default categories with your Theme colors
db.on('populate', async () => {
  await db.categories.bulkAdd([
    { id: crypto.randomUUID(), name: '食品', color: '#5b7a6f', icon: 'utensils' }, // primary
    { id: crypto.randomUUID(), name: '交通', color: '#7da093', icon: 'train' }, // primary-light
    { id: crypto.randomUUID(), name: '藥妝', color: '#c4956a', icon: 'pill' }, // accent
    { id: crypto.randomUUID(), name: '日用品', color: '#a3b5ad', icon: 'shopping-bag' }, // muted
    { id: crypto.randomUUID(), name: '娛樂', color: '#4a6b5e', icon: 'gamepad-2' }, // primary-dark
    { id: crypto.randomUUID(), name: '衣物', color: '#78716c', icon: 'shirt' }, // gray
  ]);
});

export { db };
