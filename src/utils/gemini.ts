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
): Promise<ParsedReceipt> {
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
): Promise<ParsedReceipt> {
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
  
  const categoriesContext = categories.map(c => `${c.name} (ID: ${c.id})`).join(', ');

  const prompt = `
    你是一個精通日文收據辨識與分類的專家。請分析這些收據照片（可能是一張長收據拍成多張，或多張小收據），並將其轉換為以下 JSON 格式。
    
    重點任務：
    1. 跨圖合併：如果收據被拍成多張照片，請將它們合併為一筆完整的帳目。
    2. 處理折扣 (非常重要)：日本收據常在商品下方出現「★割引」、「值引」或「-100」等行。
       - 這些行代表的是「上方商品」的折扣。
       - 請將該折扣正值填入 discount 欄位。
       - originalPrice 應填入折扣前的原價 (例如 @98 x 4 = 392)。
       - finalPrice 應為扣除後的最終金額 (originalPrice - discount)。
       - 例如：品項 A 392 元，下一行是 ★割引 -30，則該品項應為 originalPrice: 392, discount: 30, finalPrice: 362。
    3. 名稱處理：name 欄位請務必保留「日文原名」。
    4. 精確翻譯：translatedName 欄位請提供該品項最道地、易懂的「繁體中文翻譯」。
    5. 日期時間：請精確辨識收據上的日期 (YYYY-MM-DD) 與時間 (HH:mm)。
    6. 自動分類：根據品項內容，從以下分類清單中選擇最合適的一個，並填入對應的 categoryId：
       分類清單：[${categoriesContext}]
    7. 稅金處理：請只辨識收據上「明確列出」的稅金金額 (如 8% 額、10% 額)。如果收據上沒有寫出稅金金額，請填 0。絕對不可將總金額填入稅金欄位。
    
    JSON 格式要求：
    {
      "shopName": "商店名稱 (繁體中文)",
      "date": "YYYY-MM-DD",
      "time": "HH:mm",
      "totalAmount": 數字,
      "tax8Amount": 數字,
      "tax10Amount": 數字,
      "items": [
        {
          "name": "日文原名",
          "translatedName": "繁體中文翻譯",
          "originalPrice": 數字,
          "discount": 數字 (特價扣除的金額，如無則填 0),
          "finalPrice": 數字 (originalPrice - discount),
          "quantity": 數字,
          "categoryId": "來自清單的對應 ID"
        }
      ]
    }
  `;

  // Create image parts for each base64 string
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
  const parsedData = JSON.parse(result.candidates[0].content.parts[0].text);

  return {
    shopName: parsedData.shopName || '',
    totalAmount: Number(parsedData.totalAmount) || 0,
    items: (parsedData.items || []).map((item: any) => {
      const originalPrice = Number(item.originalPrice) || 0;
      const discount = Math.abs(Number(item.discount)) || 0;
      const finalPrice = Number(item.finalPrice) || (originalPrice - discount);
      
      return {
        id: crypto.randomUUID(),
        name: item.name, // 日文原名
        translatedName: item.translatedName, // 輔助翻譯
        originalPrice: originalPrice,
        discount: discount,
        finalPrice: finalPrice,
        quantity: Number(item.quantity) || 1,
        categoryId: item.categoryId || ''
      };
    }),
    currency: 'JPY',
    tax8Amount: Number(parsedData.tax8Amount) || 0,
    tax10Amount: Number(parsedData.tax10Amount) || 0,
    taxType: 'inclusive',
    date: parsedData.date || new Date().toISOString().split('T')[0],
    time: parsedData.time || new Date().toTimeString().split(' ')[0].substring(0, 5)
  };
}
