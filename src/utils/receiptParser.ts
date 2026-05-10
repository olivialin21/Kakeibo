import Tesseract from 'tesseract.js';
import heic2any from 'heic2any';
import { heicTo } from 'heic-to';
import { type ReceiptItem } from '../db/db';

export interface ParsedReceipt {
  shopName: string;
  totalAmount: number;
  items: Partial<ReceiptItem>[];
  currency: 'JPY' | 'TWD';
  tax8Amount: number;
  tax10Amount: number;
  taxType: 'inclusive' | 'exclusive';
  date: string;
  time?: string;
}

/**
 * Apply image pre-processing for Tesseract OCR.
 */
function applyOcrFilters(source: HTMLImageElement | HTMLCanvasElement | ImageBitmap): string {
  const canvas = document.createElement('canvas');
  let width = source.width;
  let height = source.height;

  const MAX_DIM = 2400;
  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = 'grayscale(1) contrast(1.4) brightness(1.02) sharpness(1.2)';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

import { compressImage } from './imageUtils';

/**
 * Image conversion and compression.
 * Reduces image size to save IndexedDB space and improve backup performance.
 */
export async function convertToStandardImage(file: File | Blob): Promise<string> {
  return await compressImage(file, 1600, 0.8);
}

export async function processReceiptImage(
  imageFile: File,
  onProgress: (progress: number) => void
): Promise<{ parsed: ParsedReceipt; processedImage: string }> {
  const rawImageDataUrl = await convertToStandardImage(imageFile);
  const rawImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('圖片載入失敗。'));
    i.src = rawImageDataUrl;
  });

  const filteredImageDataUrl = applyOcrFilters(rawImg);
  const worker = await Tesseract.createWorker('jpn+eng', 1, {
    logger: m => { if (m.status === 'recognizing text') onProgress(m.progress); }
  });

  await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK });
  const { data } = await worker.recognize(filteredImageDataUrl);
  await worker.terminate();

  const fullText = data?.text ?? '';
  console.log('[OCR] Full text result:');
  console.log(fullText);

  if (!fullText.trim()) throw new Error('無法辨識出任何文字。');

  const textLines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const parsed = parseTextLines(textLines);
  
  return { parsed, processedImage: filteredImageDataUrl };
}

export function parseTextLines(textLines: string[]): ParsedReceipt {
  let shopName = '';
  let totalAmount = 0;
  let tax8Amount = 0;
  let tax10Amount = 0;
  let taxType: 'inclusive' | 'exclusive' = 'inclusive';
  const items: Partial<ReceiptItem>[] = [];
  let dateStr = '';
  let reachedTotals = false;

  const storeMap: Record<string, string> = {
    'まいばすけっと': 'まいばすけっと', 'イオン': 'AEON', 'セブン': 'セブン-イレブン',
    'ローソン': 'LAWSON', 'ファミリーマート': 'ファミリーマート'
  };

  const extractEndPrice = (str: string) => {
    const match = str.match(/[¥\\]?\s*(\d{1,3}(?:[.,]\d{3})*)\s*[xX*※%]?\s*$/);
    if (!match) return 0;
    return parseInt(match[1].replace(/[^0-9]/g, ''), 10);
  };

  for (let i = 0; i < textLines.length; i++) {
    const raw = textLines[i];
    const compactRaw = raw.replace(/\s+/g, '');
    const text = raw.replace(/\s+/g, ' ').trim();

    const isMetadata = /小計|税込|税抜|おつり|レジ|店番|TEL|FAX|No\.|樣|様|客戶|會員|卡|VISA|CASH|現金|取引|控え|合計|取\d+|登録|番[号號]|承認|伝票|件數|點數|商品數|再發行|再発行|課税|対象|印紙|AID|APL|ATC|TC|SEQ|本人確認/i.test(compactRaw);
    
    if (!shopName && i < 5) {
      for (const [key, val] of Object.entries(storeMap)) {
        if (compactRaw.includes(key)) { shopName = val; break; }
      }
      if (!shopName && compactRaw.length > 3 && !/[0-9]/.test(compactRaw)) {
        shopName = compactRaw.replace(/[^\u3040-\u30ff\u4e00-\u9faf]/g, '');
      }
    }

    if (!dateStr) {
      const dateMatch = compactRaw.match(/(202[4-9])[年/-]\s?(\d{1,2})[月/-]\s?(\d{1,2})日?/);
      if (dateMatch) dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }

    if (isMetadata && /小計|合計|金額/.test(compactRaw)) reachedTotals = true;

    // 4. Discount Detection (Value-added feature!)
    if (compactRaw.includes('割引') || compactRaw.includes('値引') || compactRaw.includes('割弓')) {
      const discount = extractEndPrice(compactRaw);
      if (discount > 0 && items.length > 0) {
        const lastItem = items[items.length - 1];
        lastItem.originalPrice = Math.max(0, (lastItem.originalPrice || 0) - discount);
        if (!lastItem.name?.includes('(含折扣)')) {
          lastItem.name = `${lastItem.name} (含折扣)`;
        }
        console.log(`[Parser] Applied discount -¥${discount} to ${lastItem.name}`);
        continue;
      }
    }

    const isTaxLine = /税.*(\d+)/.test(compactRaw) || /消費税|外税/.test(compactRaw);
    if (isTaxLine) {
      const amount = extractEndPrice(compactRaw);
      if (amount > 0) {
        if (/8%/.test(compactRaw)) tax8Amount = amount;
        else if (/10|1%/.test(compactRaw)) tax10Amount = amount;
      }
      continue;
    }

    const isTotalAmountLine = /合.?計|金.?額|領.?收|TOTAL|金額|支払/.test(compactRaw);
    if (isTotalAmountLine) {
      const amount = extractEndPrice(compactRaw);
      if (amount > totalAmount) totalAmount = amount;
      reachedTotals = true;
      continue;
    }

    const quantityMatch = compactRaw.match(/[(\（]?(\d+)\s*[個xX點点]/);
    if (quantityMatch && items.length > 0) {
      const q = parseInt(quantityMatch[1], 10);
      if (q > 1 && q < 100) {
        items[items.length - 1].quantity = q;
        continue;
      }
    }

    if (!reachedTotals && !isMetadata) {
      if (/\d{1,2}:\d{2}$/.test(compactRaw) || /\d{4}\/\d{1,2}\/\d{1,2}/.test(compactRaw)) continue;

      const itemMatch = text.match(/^(.*?)\s*[¥\\]?\s*(\d{1,3}(?:[.,]\d{3})*)\s*[xX*※%]?\s*$/);
      if (itemMatch) {
        const name = itemMatch[1].replace(/[¥\\].*$/, '').replace(/\s*[\(（].*$/, '').replace(/[※\*]/g, '').replace(/[0-9]{2,13}/, '').trim();
        const price = parseInt(itemMatch[2].replace(/[^0-9]/g, ''), 10);
        
        if (name.length >= 2 && price > 5 && !/^[0-9\s]+$/.test(name)) {
          items.push({ id: crypto.randomUUID(), name, originalPrice: price, categoryId: '', quantity: 1 });
        }
      }
    }
  }

  if (totalAmount === 0 && items.length > 0) totalAmount = items.reduce((s, i) => s + (i.originalPrice || 0), 0);

  return { shopName, totalAmount, items: items as Partial<ReceiptItem>[], date: dateStr, currency: 'JPY', tax8Amount, tax10Amount, taxType };
}
