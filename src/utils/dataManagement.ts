import { db } from '../db/db';
import { compressImage, base64ToBlob } from './imageUtils';

export async function exportData() {
  const categories = await db.categories.toArray();
  const rawReceipts = await db.receipts.toArray();
  const receiptItems = await db.receiptItems.toArray();
  const trips = await db.trips.toArray();

  console.log('[Export] Starting data export with image compression...');

  // Convert multiple imageBlobs to base64 for JSON compatibility + Auto-compress
  const receipts = await Promise.all(rawReceipts.map(async (r: any) => {
    if (r.imageBlobs && r.imageBlobs.length > 0) {
      // We use sequential processing or limited concurrency for stability on mobile
      const base64s: string[] = [];
      for (const blob of r.imageBlobs) {
        if (blob instanceof Blob) {
          // compressImage also converts to DataURL (Base64)
          const compressed = await compressImage(blob, 1600, 0.8);
          base64s.push(compressed);
        }
      }
      return { ...r, imageBase64s: base64s, imageBlobs: undefined };
    }
    return r;
  }));

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
            const receiptsToRestore = [];
            
            for (const r of backup.data.receipts) {
              let processed = { ...r };
              let sourceBase64s: string[] = [];

              if (r.imageBase64s && r.imageBase64s.length > 0) {
                sourceBase64s = r.imageBase64s;
              } else if (r.imageBase64) {
                sourceBase64s = [r.imageBase64];
              }

              if (sourceBase64s.length > 0) {
                const finalBlobs: Blob[] = [];
                for (const b64 of sourceBase64s) {
                  // Safety: Compress again if importing from unknown source, 
                  // or just convert to blob if we trust the backup
                  const blob = base64ToBlob(b64);
                  // Optional: Re-compress here if size is still too large
                  finalBlobs.push(blob);
                }
                const { imageBase64s, imageBase64, ...rest } = processed;
                processed = { ...rest, imageBlobs: finalBlobs };
              }

              // Final cleanups
              if (processed.imageBlobs) {
                processed.imageBlobs = processed.imageBlobs.filter((b: any) => b instanceof Blob);
                if (processed.imageBlobs.length === 0) delete processed.imageBlobs;
              }

              receiptsToRestore.push(processed);
            }
            
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
