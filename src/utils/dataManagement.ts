import { db } from '../db/db';

export async function exportData() {
  const categories = await db.categories.toArray();
  const rawReceipts = await db.receipts.toArray();
  const receiptItems = await db.receiptItems.toArray();
  const trips = await db.trips.toArray();

  console.log('[Export] Starting data export (excluding images)...');

  // 匯出時排除所有圖片欄位，以大幅縮減檔案體積
  const receipts = rawReceipts.map((r: any) => {
    const { imageBlobs, imageBase64s, imageBase64, imageBlob, ...rest } = r;
    return rest;
  });

  const backup = {
    version: 3,
    timestamp: Date.now(),
    data: {
      categories,
      receipts,
      receiptItems,
      trips
    }
  };

  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kakeibo_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('[Export] Backup file created and downloaded.');
}

export async function importData(file: File): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content);

        if (!backup.data) {
          throw new Error('無效的備份檔案格式');
        }

        await db.transaction('rw', [db.categories, db.receipts, db.receiptItems, db.trips], async () => {
          await db.categories.clear();
          await db.receipts.clear();
          await db.receiptItems.clear();
          await db.trips.clear();

          if (backup.data.categories) await db.categories.bulkAdd(backup.data.categories);

          if (backup.data.receipts) {
            // 匯入時忽略並清除所有圖片資料
            const receiptsToRestore = backup.data.receipts.map((r: any) => {
              const { imageBlobs, imageBase64s, imageBase64, imageBlob, ...rest } = r;
              return rest;
            });
            
            await db.receipts.bulkAdd(receiptsToRestore);
          }

          if (backup.data.receiptItems) await db.receiptItems.bulkAdd(backup.data.receiptItems);
          if (backup.data.trips) await db.trips.bulkAdd(backup.data.trips);
        });

        resolve(true);
      } catch (err) {
        console.error('Import failed', err);
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
