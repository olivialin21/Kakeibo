import { type ParsedReceipt } from './receiptParser';
import { type Category } from '../db/db';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Fallback models in order of preference
const MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

export async function analyzeReceiptWithAI(
  base64DataArray: string[], 
  categories: Category[] = []
): Promise<ParsedReceipt[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('請先在 .env 設定 VITE_GEMINI_API_KEY');
  }

  let lastError: any = null;

  for (const modelName of MODELS) {
    try {
      console.log(`[AI] Attempting recognition with model: ${modelName} (${base64DataArray.length} images)`);
      const result = await callGeminiAPI(modelName, base64DataArray, categories);
      console.log(`[AI] Success with model: ${modelName}`);
      return result;
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message?.toLowerCase() || '';
      if (
        errorMsg.includes('429') || 
        errorMsg.includes('503') || 
        errorMsg.includes('quota') || 
        errorMsg.includes('high demand') ||
        errorMsg.includes('not found')
      ) {
        console.warn(`[AI] Model ${modelName} failed, trying next...`, error.message);
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('所有 AI 模型皆無法使用，請檢查網路或 API Key 額度。');
}

async function callGeminiAPI(
  modelName: string, 
  base64DataArray: string[],
  categories: Category[]
): Promise<ParsedReceipt[]> {
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
  
  const categoriesContext = categories.map(c => `${c.name} (ID: ${c.id})`).join(', ');

  const prompt = `
    你是一個精通日文收據辨識與分類的專家。請分析這些收據照片，並將其轉換為以下 JSON 陣列格式。
    
    重點任務：
    1. 跨圖合併或獨立切割：
       - 如果是一張長收據拍成多張照片，請合併為【一筆】完整的帳目。
       - 如果是 Suica、PASMO、Apple Pay 等「交通卡歷史紀錄截圖」，畫面中通常包含多個日期的獨立扣款。請將「每一趟獨立的車程扣款」視為一筆【獨立的收據】，分別列在陣列中！(例如：12/01 去東京、12/02 去新宿，應成為兩筆 Receipt，而非一筆)。
       - ⚠️【極度重要】如果是交通卡截圖，請「僅擷取」搭乘交通工具（電車、公車、進出站）的扣款紀錄！若紀錄顯示為「物販」、「販賣機」、「便利商店」等在店面的實體消費，請直接忽略，【絕對不要】列入陣列中！
    2. 處理折扣與多件商品 (重要)：
       - 日本收據常出現「★割引」、「值引」或「-100」等行。這些代表「上方商品」的折扣，請填入 discount 欄位。
       - ⚠️【極度重要】不論是否有多件商品 (quantity > 1)，品項中的價格欄位皆必須填寫【單件單價】！
       - 例如：若收據上有「商品 A @98 x 4 = 392」，且下方有該商品的折扣「割引 -40」，則：
         * quantity 填 4
         * originalPrice 填 98 (即單價，不可填 392)
         * discount 填 10 (即總折扣 40 除以數量 4，平均單件折扣)
         * finalPrice 填 88 (即單件實付單價 98 - 10 = 88，不可填總價)
    3. 名稱處理：name 欄位保留「日文原名」，交通紀錄可將車站名(例如：新宿 → 涉谷)填入 name。
    4. 精確翻譯：translatedName 欄位提供繁體中文翻譯。
    5. 日期時間：精確辨識每筆交易的日期 (YYYY-MM-DD) 與時間 (HH:mm)。如果是交通紀錄，請根據截圖中的日期推算。
    6. 自動分類：根據內容，從以下分類清單中選擇最合適的 ID：[${categoriesContext}]。如果是交通紀錄，請優先選擇「交通」類別。
    7. 稅金處理：只辨識「明確列出」的稅金金額，若無則填 0。
    
    JSON 格式要求 (必須回傳 Array)：
    [
      {
        "shopName": "商店名稱 (例如：JR東日本、某某超市)",
        "date": "YYYY-MM-DD",
        "time": "HH:mm",
        "totalAmount": 數字 (單張收據的總金額),
        "tax8Amount": 數字,
        "tax10Amount": 數字,
        "items": [
          {
            "name": "日文原名 (如果是車資，可寫：起站->迄站)",
            "translatedName": "繁體中文翻譯",
            "originalPrice": 數字 (單件商品的原價/單價，若數量多件，請填單件價格。絕對不可填總額！),
            "discount": 數字 (單件商品的折扣，若數量多件，請填平均單件折扣，無折扣填 0),
            "finalPrice": 數字 (單件商品的最終單價，即 originalPrice - discount),
            "quantity": 數字,
            "categoryId": "來自清單的對應 ID"
          }
        ]
      }
    ]
  `;

  const imageParts = base64DataArray.map(data => ({
    inline_data: { 
      mime_type: 'image/jpeg', 
      data: data.split(',')[1] 
    }
  }));

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          ...imageParts
        ]
      }],
      generationConfig: { response_mime_type: "application/json" }
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`AI 辨識失敗 (${response.status}): ${error.error?.message || '未知錯誤'}`);
  }

  const result = await response.json();
  const parsedText = result.candidates[0].content.parts[0].text;
  
  let parsedArray;
  try {
    parsedArray = JSON.parse(parsedText);
    if (!Array.isArray(parsedArray)) {
      parsedArray = [parsedArray];
    }
  } catch (e) {
    throw new Error('解析 AI 回傳的 JSON 失敗');
  }

  return parsedArray.map((parsedData: any) => ({
    shopName: parsedData.shopName || '',
    totalAmount: Number(parsedData.totalAmount) || 0,
    items: (() => {
      const items = (parsedData.items || []).map((item: any) => {
        const originalPrice = Number(item.originalPrice) || 0;
        const discount = Math.abs(Number(item.discount)) || 0;
        const finalPrice = Number(item.finalPrice) || (originalPrice - discount);
        
        return {
          id: crypto.randomUUID(),
          name: item.name || '',
          translatedName: item.translatedName || '',
          originalPrice: originalPrice,
          discount: discount,
          finalPrice: finalPrice,
          quantity: Number(item.quantity) || 1,
          categoryId: item.categoryId || ''
        };
      });

      // 啟發式防護邏輯：檢查 AI 是否錯誤地回傳了總原價/總折扣，而非單價/平均折扣
      if (items.length > 0 && Number(parsedData.totalAmount) > 0) {
        const totalAmount = Number(parsedData.totalAmount);
        const sumWithQty = items.reduce((acc: number, item: any) => acc + item.finalPrice * item.quantity, 0);
        const sumNoQty = items.reduce((acc: number, item: any) => acc + item.finalPrice, 0);
        
        // 如果乘以數量的總和遠大於總金額，但如果不乘以數量卻非常接近總金額，
        // 代表 AI 很大機率將「總原價/總折扣」填入了原價與折扣欄位。
        const diffWithQty = Math.abs(sumWithQty - totalAmount);
        const diffNoQty = Math.abs(sumNoQty - totalAmount);
        
        if (diffWithQty > diffNoQty && sumWithQty > totalAmount * 1.2) {
          items.forEach((item: any) => {
            if (item.quantity > 1) {
              item.originalPrice = Math.round((item.originalPrice / item.quantity) * 100) / 100;
              item.discount = Math.round((item.discount / item.quantity) * 100) / 100;
              item.finalPrice = Math.round((item.finalPrice / item.quantity) * 100) / 100;
            }
          });
        }
      }
      return items;
    })(),
    currency: 'JPY',
    tax8Amount: Number(parsedData.tax8Amount) || 0,
    tax10Amount: Number(parsedData.tax10Amount) || 0,
    taxType: 'inclusive',
    date: parsedData.date || new Date().toISOString().split('T')[0],
    time: parsedData.time || new Date().toTimeString().split(' ')[0].substring(0, 5)
  }));
}

