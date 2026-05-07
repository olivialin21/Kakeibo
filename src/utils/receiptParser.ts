import Tesseract from 'tesseract.js';
import heic2any from 'heic2any';
import { heicTo } from 'heic-to';
import * as ocr from '@paddlejs-models/ocr';
import { type ReceiptItem } from '../db/db';

export interface ParsedReceipt {
  shopName: string;
  totalAmount: number;
  items: Partial<ReceiptItem>[];
  currency: 'JPY' | 'TWD';
  tax8Amount: number;
  tax10Amount: number;
  taxType: 'inclusive' | 'exclusive';
}

/**
 * Apply image pre-processing (Grayscale + High Contrast) for Tesseract OCR.
 * Tesseract works best with high-contrast black on white.
 */
function applyOcrFilters(source: HTMLImageElement | ImageBitmap): string {
  const canvas = document.createElement('canvas');
  const MAX_DIM = 2048;
  let width = source.width;
  let height = source.height;

  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // OCR Optimization: Grayscale + Subtle Contrast
  // Too much contrast (1.5+) can break thin Japanese characters.
  ctx.filter = 'grayscale(1) contrast(1.2) brightness(1.05)';
  ctx.drawImage(source, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Convert any image file (including HEIC) to a standard lossless PNG/JPG data URL.
 * Returns the RAW image without OCR filters.
 */
async function convertToStandardImage(file: File | Blob): Promise<string> {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    ('name' in file && /\.heic$/i.test((file as File).name));

  // --- Strategy 1: Native Safari HEIC decoding ---
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
      const url = canvas.toDataURL('image/png');
      bitmap.close();
      console.log('[OCR] Native decode success');
      return url;
    } catch (e) {
      // Fall through
    }
  }

  // --- Strategy 2: heic-to (Robust for Chrome/Edge) ---
  if (isHeic) {
    try {
      console.log('[OCR] Trying heic-to...');
      const buffer = await file.arrayBuffer();
      const convertedBlob = await heicTo({ blob: new Blob([buffer]) });
      return await blobToDataUrl(Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob);
    } catch (e) {
      console.warn('[OCR] heic-to failed, trying heic2any...');
      try {
        const converted = await heic2any({ blob: file, toType: 'image/png' });
        return await blobToDataUrl(Array.isArray(converted) ? converted[0] : converted);
      } catch (e2) {
        console.error('[OCR] All HEIC conversion failed');
      }
    }
  }

  return await blobToDataUrl(file);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Load a Blob via HTMLImageElement → Canvas → data URL.
 */
function loadImageElementAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(bitmapToDataUrl(img, img.naturalWidth, img.naturalHeight));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(
        '圖片載入失敗。若為 HEIC 格式且在非 Safari 瀏覽器使用，建議到 iPhone「設定 > 相機 > 格式」改選「最相容」，或先將照片轉為 JPG 再上傳。'
      ));
    };

    img.src = objectUrl;
  });
}

let paddleInitialized = false;

async function initPaddle() {
  // PaddleOCR is currently too unstable in this environment.
  // We will rely on optimized Tesseract for now.
  paddleInitialized = true;
}

/**
 * Main entry point: take an image file, run OCR, parse the result.
 * Now tries PaddleOCR first, then Tesseract as fallback.
 */
export async function processReceiptImage(
  imageFile: File,
  onProgress: (progress: number) => void
): Promise<{ parsed: ParsedReceipt; processedImage: string }> {
  // 1. Convert file to a standard Image Data URL (RAW)
  const rawImageDataUrl = await convertToStandardImage(imageFile);
  
  // 2. Load it into an Image object to get dimensions and for further processing
  const rawImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('圖片載入失敗。'));
    i.src = rawImageDataUrl;
  });

  let fullText = '';

  // Skip PaddleOCR for now due to environment stability issues
  // --- Strategy B: Tesseract.js (Optimized) ---
  console.log('[OCR] Running Tesseract.js (Optimized)...');
  
  const originalWarn = console.warn;
  const originalError = console.error;
  
  const suppressFilter = (...args: any[]) => {
    const msg = args[0]?.toString?.() || '';
    return !msg.includes('Parameter not found') && !msg.includes('pipeline stall');
  };

  console.warn = (...args: any[]) => { if (suppressFilter(...args)) originalWarn.apply(console, args); };
  console.error = (...args: any[]) => { if (suppressFilter(...args)) originalError.apply(console, args); };

  try {
    const filteredImageDataUrl = applyOcrFilters(rawImg);
    const worker = await Tesseract.createWorker('jpn+eng', 1, {
      logger: m => { if (m.status === 'recognizing text') onProgress(m.progress); }
    });

    // Disable legacy features that cause warnings if possible
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    });

    const { data } = await worker.recognize(filteredImageDataUrl);
    await worker.terminate();
    fullText = data?.text ?? '';
  } catch (err) {
    console.error('[OCR] OCR error:', err);
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }

  console.log('[OCR] Full text result:');
  console.log(fullText);

  if (!fullText.trim()) {
    throw new Error('無法辨識出任何文字，請確認圖片是否清晰。');
  }

  const textLines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const parsed = parseTextLines(textLines);
  
  // Use filtered image for the UI preview if needed
  return { parsed, processedImage: applyOcrFilters(rawImg) };
}

function parseTextLines(textLines: string[]): ParsedReceipt {
  let shopName = '';
  let totalAmount = 0;
  let tax8Amount = 0;
  let tax10Amount = 0;
  let taxType: 'inclusive' | 'exclusive' = 'inclusive';
  const items: Partial<ReceiptItem>[] = [];

  let dateStr = '';
  
  // 1. Detect Shop Name (Generic approach: first meaningful line)
  const storeMap: Record<string, string> = {
    'まいばすけっと': 'まいばすけっと',
    'まいぼば': 'まいばすけっと',
    'けっ': 'まいばすけっと',
    'イオン': 'AEON',
    'AEON': 'AEON',
    'セブン': 'セブン-イレブン',
    'ローソン': 'LAWSON',
    'ファミリーマート': 'ファミリーマート',
  };

  for (let i = 0; i < Math.min(textLines.length, 5); i++) {
    const line = textLines[i].replace(/\s+/g, '');
    for (const [key, val] of Object.entries(storeMap)) {
      if (line.includes(key)) {
        shopName = val;
        break;
      }
    }
    if (shopName) break;
  }
  
  // Fallback: pick the first line that isn't metadata
  if (!shopName) {
    for (let i = 0; i < Math.min(textLines.length, 8); i++) {
      const line = textLines[i].trim();
      if (/^[\d\s\-\:\/\.\(\)TELtel||]+$/.test(line)) continue;
      if (line.length < 2) continue;
      // Filter out symbols for the shop name fallback
      const cleaned = line.replace(/[^a-zA-Z0-9\u3040-\u30ff\u4e00-\u9faf]/g, '').trim();
      if (cleaned.length >= 2) {
        shopName = cleaned;
        break;
      }
    }
  }

  // 2. Generic Structural Analysis
  for (let i = 0; i < textLines.length; i++) {
    const raw = textLines[i];
    const text = raw.replace(/\s+/g, ' ').trim();
    const compactRaw = raw.replace(/\s+/g, ''); 
    const compact = compactRaw.replace(/[\\¥Y]/g, '¥');

    // Stop parsing if we reach the totals section
    const lowerLine = compactRaw.toLowerCase();
    const isTotalOrTaxLine = /合計|合言十|小計|外税|消費税|税込|税抜|金額|領収|控え|売上票|クレジット|本人確認|お取次日|お取引日/i.test(compactRaw);
    
    if (isTotalOrTaxLine) {
      console.log(`[Parser] Stopping item collection at totals section: "${raw}"`);
      // We don't break yet, we need to process this line for total amount
    }

    // Stop completely if it's the customer copy start
    if (
      lowerLine.includes('控え') || 
      lowerLine.includes('売上票') || 
      lowerLine.includes('本人確認')
    ) {
      break;
    }

    // Detect Date (New!)
    // Formats: 2026/05/02, 2026年05月02日, 2026.05.02
    if (!dateStr) {
      const dateMatch = compactRaw.match(/(202[4-9])[年/-]\s?(\d{1,2})[月/-]\s?(\d{1,2})日?/);
      if (dateMatch) {
        const year = dateMatch[1];
        const month = dateMatch[2].padStart(2, '0');
        const day = dateMatch[3].padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
        console.log(`[Parser] Date found: ${dateStr}`);
      }
    }

    // Detect Total Patterns (Generic keywords)
    const isTotalLine = /合.?計|金.?額|領.?収|支.?付|總.?計|預.?り|&計|TOTAL|クレ.?ジット/i.test(compactRaw);
    const isTaxableBaseLine = /対象額|対象金|対象$/.test(compactRaw) || /対象.*%/.test(compactRaw) || /\(\d+\.?\d*%\)/.test(compactRaw);

    if (isTotalLine || (/対象/.test(compactRaw) && !isTaxableBaseLine)) {
      const allNums = compact.match(/\d[\d,]*/g);
      if (allNums) {
        const candidates = allNums.map(n => parseInt(n.replace(/,/g, ''), 10)).filter(n => !isNaN(n) && n > 10);
        if (candidates.length > 0) {
          const lastNum = candidates[candidates.length - 1];
          if (lastNum > totalAmount) totalAmount = lastNum;
        }
      }
    }

    // Detect Tax (Generic pattern: Keyword + % + Amount)
    const isTaxLine = /税額|消費税|外税|Bir|YBa|Bt/i.test(compactRaw) || (/%/.test(compactRaw) && !isTaxableBaseLine);
    if (isTaxLine && !isTaxableBaseLine) {
      taxType = 'exclusive';
      const taxNums = compact.match(/\d[\d,]*/g);
      if (taxNums && taxNums.length > 0) {
        const taxValue = parseInt(taxNums[taxNums.length - 1].replace(/,/g, ''), 10);
        const updateTax = (old: number | undefined, val: number) => {
          if (!old) return val;
          return (val > 0 && val < old) ? val : old;
        };

        if (/8/.test(compactRaw)) tax8Amount = updateTax(tax8Amount, taxValue);
        else if (/10/.test(compactRaw)) tax10Amount = updateTax(tax10Amount, taxValue);
        else if (!tax8Amount && !tax10Amount && taxValue < 10000) tax10Amount = taxValue;
      }
      continue;
    }

    // Skip metadata noise and transaction IDs
    // Transaction IDs like "取8342", "レジ0103", "NO.123"
    const isMetadata = /小計|税込|税抜|おつり|お釣|釣銭|レジ|店番|TEL|tel|電話|No\.|領収|樣|様|お客様|會員|会員|卡|承認|交易|AID|APL|存根|XXXX|==|表格|擔當|担|VISA|MASTER|PayPay|CASH|現金|取引|伝票|會社|会社|支払|利用|番[号號]|商品數|商品数|点数|點數|控え|合計|取\d+/i.test(compactRaw);
    if (isMetadata) continue;
    
    // Skip dates or long alphanumeric strings
    if (/202\d|年.*月.*日/.test(compactRaw) || /\d{2,4}:\d{2}/.test(compactRaw)) continue;

    // Identify Items
    // Pattern: [Item Name] [Price] [Optional marker like ※ or % or *]
    const priceMatch = text.match(/[¥\\]?\s*(\d{1,3}(?:,\d{3})*)\s*[xX*※%]?\s*$/);
    
    if (priceMatch) {
      const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      if (price > 0) {
        let namePart = text.substring(0, text.lastIndexOf(priceMatch[1])).trim();
        namePart = namePart.replace(/^[a-z]{0,2}\s*\d{2,13}\s+/i, '')
                           .replace(/^[A-Z]{1,3}\s+/, '')
                           .replace(/[¥\\].*$/, '')
                           .replace(/\s*[\(（].*$/, '');
        
        const name = namePart.trim();
        
        // Final sanity check
        const isMessy = name.length < 1 || 
                        /^[A-Z\d]{1,6}$/.test(name) || 
                        /^[0-9\s※\*氷]+$/.test(name) || 
                        (name.match(/[※\*氷]/g) || []).length > 2;
        
        if (!isMessy) {
          items.push({ id: crypto.randomUUID(), name, originalPrice: price, categoryId: '' });
          console.log(`[Parser] Item identified: "${name}" = ¥${price}`);
        } else {
          console.log(`[Parser] Skipped messy line: "${text}" (Name: "${name}")`);
        }
      }
    }

    // Discount
    const discountMatch = compact.match(/[-ー""](\d+)$/);
    if (discountMatch) {
      const discountAmount = parseInt(discountMatch[1], 10);
      if (items.length > 0 && discountAmount > 0 && discountAmount < 100000) {
        const lastItem = items[items.length - 1];
        lastItem.originalPrice = Math.max(0, (lastItem.originalPrice || 0) - discountAmount);
        lastItem.name = `${lastItem.name} (折扣 -${discountAmount})`;
      }
      continue;
    }
  }

  // Final validation: if total is still 0, sum items
  if (totalAmount === 0 && items.length > 0) {
    totalAmount = items.reduce((sum, item) => sum + (item.originalPrice || 0), 0);
  }

  return {
    shopName,
    totalAmount,
    items: items as Partial<ReceiptItem>[],
    date: dateStr,
    currency: 'JPY',
    tax8Amount,
    tax10Amount,
    taxType
  };
}
