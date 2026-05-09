import { db } from '../db/db';

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

export async function exportData() {
  const categories = await db.categories.toArray();
  const rawReceipts = await db.receipts.toArray();
  const receiptItems = await db.receiptItems.toArray();
  const trips = await db.trips.toArray();

  // Convert multiple imageBlobs to base64 for JSON compatibility
  const receipts = await Promise.all(rawReceipts.map(async (r: any) => {
    if (r.imageBlobs && r.imageBlobs.length > 0) {
      const base64s = await Promise.all(r.imageBlobs.map((blob: Blob) => blobToBase64(blob)));
      return { ...r, imageBase64s: base64s, imageBlobs: undefined };
    }
    return r;
  }));

  const backup = {
    version: 3, // Increment version
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
            const receiptsToRestore = backup.data.receipts.map((r: any) => {
              let processed = { ...r };
              if (r.imageBase64s && r.imageBase64s.length > 0) {
                const { imageBase64s, ...rest } = r;
                processed = { ...rest, imageBlobs: imageBase64s.map((b: string) => base64ToBlob(b)) };
              } else if (r.imageBase64) {
                // Fallback for old single image format
                const { imageBase64, ...rest } = r;
                processed = { ...rest, imageBlobs: [base64ToBlob(imageBase64)] };
              }

              // Ensure imageBlobs contains only valid Blobs, otherwise set to undefined
              if (processed.imageBlobs) {
                processed.imageBlobs = processed.imageBlobs.filter((b: any) => b instanceof Blob);
                if (processed.imageBlobs.length === 0) delete processed.imageBlobs;
              }
              // Also clean up legacy single imageBlob if it's not a Blob
              if (processed.imageBlob && !(processed.imageBlob instanceof Blob)) {
                delete processed.imageBlob;
              }

              return processed;
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
