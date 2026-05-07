import { db } from '../db/db';

/**
 * Japanese → Chinese translation dictionary for common grocery/receipt items.
 * Completely local, no API tokens needed.
 */
const JA_TO_ZH: Record<string, string> = {
  // 食品 - 米飯/穀物
  'ごはん': '白飯', 'コシヒカリ': '越光米', 'お米': '米', '米': '米',
  'パン': '麵包', '食パン': '吐司', 'そば': '蕎麥麵', 'うどん': '烏龍麵',
  'ラーメン': '拉麵', 'パスタ': '義大利麵', 'おにぎり': '飯糰',
  
  // 食品 - 肉/魚
  'まぐろ': '鮪魚', 'サーモン': '鮭魚', 'あじ': '竹莢魚', '鯖': '鯖魚',
  'えび': '蝦', 'いか': '花枝', '牛肉': '牛肉', '豚肉': '豬肉',
  '鶏肉': '雞肉', 'ハム': '火腿', 'ベーコン': '培根',
  '明太子': '明太子', '辛子明太子': '辣明太子',
  
  // 食品 - 野菜/果物
  '野菜': '蔬菜', 'トマト': '番茄', 'きゅうり': '小黃瓜',
  'キャベツ': '高麗菜', 'レタス': '生菜', 'にんじん': '紅蘿蔔',
  'たまねぎ': '洋蔥', 'オニオン': '洋蔥', 'じゃがいも': '馬鈴薯',
  'りんご': '蘋果', 'バナナ': '香蕉', 'みかん': '橘子',
  
  // 飲料
  'ミルク': '牛奶', '牛乳': '牛奶', 'お茶': '茶', '緑茶': '綠茶',
  'コーヒー': '咖啡', 'ジュース': '果汁', 'ビール': '啤酒',
  '水': '水', '甘酒': '甜酒', 'ワイン': '葡萄酒', 'サワー': '沙瓦',
  
  // 調味料
  '醤油': '醬油', 'みそ': '味噌', '味噌': '味噌', '塩': '鹽',
  '砂糖': '糖', '酢': '醋', 'ドレッシング': '沙拉醬',
  'マヨネーズ': '美乃滋', 'ケチャップ': '番茄醬', '昆布': '昆布',
  
  // 日用品
  'シャンプー': '洗髮精', 'ティッシュ': '面紙', 'トイレットペーパー': '衛生紙',
  '洗剤': '洗潔精', '石鹸': '肥皂', '歯ブラシ': '牙刷', '歯磨き': '牙膏',
  
  // 其他
  '弁当': '便當', 'サラダ': '沙拉', 'スープ': '湯',
  'お菓子': '零食', 'チョコ': '巧克力', 'アイス': '冰淇淋',
  '豆腐': '豆腐', '納豆': '納豆', 'たまご': '雞蛋', '卵': '雞蛋',
  'チーズ': '起司', 'バター': '奶油', 'ヨーグルト': '優格',
};

/**
 * Keyword → category mapping for auto-classification.
 * Keys are Japanese keywords, values are category names to match against DB.
 */
const KEYWORD_TO_CATEGORY: Record<string, string> = {
  // 食品
  'ごはん': '食品', '米': '食品', 'パン': '食品', 'そば': '食品', 'うどん': '食品',
  'ラーメン': '食品', 'パスタ': '食品', 'おにぎり': '食品', '弁当': '食品',
  'まぐろ': '食品', 'サーモン': '食品', 'あじ': '食品', 'えび': '食品',
  '牛肉': '食品', '豚肉': '食品', '鶏肉': '食品', 'ハム': '食品',
  '明太子': '食品', '野菜': '食品', 'トマト': '食品', 'きゅうり': '食品',
  'キャベツ': '食品', 'レタス': '食品', 'にんじん': '食品',
  'たまねぎ': '食品', 'オニオン': '食品', 'じゃがいも': '食品',
  'りんご': '食品', 'バナナ': '食品', 'みかん': '食品',
  'ミルク': '食品', '牛乳': '食品', 'お茶': '食品', '緑茶': '食品',
  'コーヒー': '食品', 'ジュース': '食品', 'ビール': '食品',
  '甘酒': '食品', 'ワイン': '食品', '水': '食品',
  '醤油': '食品', 'みそ': '食品', '味噌': '食品', '塩': '食品',
  '砂糖': '食品', '酢': '食品', 'ドレッシング': '食品',
  '昆布': '食品', '豆腐': '食品', '納豆': '食品', 'たまご': '食品', '卵': '食品',
  'チーズ': '食品', 'バター': '食品', 'ヨーグルト': '食品',
  'サラダ': '食品', 'スープ': '食品', 'お菓子': '食品',
  'チョコ': '食品', 'アイス': '食品',
  
  // 日用品
  'シャンプー': '日用品', 'ティッシュ': '日用品', 'トイレットペーパー': '日用品',
  '洗剤': '日用品', '石鹸': '日用品', '歯ブラシ': '日用品', '歯磨き': '日用品',
  'ラップ': '日用品', 'アルミホイル': '日用品', 'ゴミ袋': '日用品',
  
  // 交通
  '切符': '交通', 'チャージ': '交通', 'Suica': '交通', 'PASMO': '交通',
  'きっぷ': '交通', '定期': '交通', 'タクシー': '交通',
  
  // 娛樂
  '映画': '娛樂', 'ゲーム': '娛樂', '本': '娛樂', '雑誌': '娛樂',
};

/**
 * Translate a Japanese item name to Chinese using the local dictionary.
 * Falls back to the original name if no translation found.
 */
export function translateItemName(jaName: string): string {
  // Try exact match first
  if (JA_TO_ZH[jaName]) return JA_TO_ZH[jaName];
  
  // Try partial match: find the longest matching keyword
  let bestMatch = '';
  let bestTranslation = '';
  
  for (const [keyword, translation] of Object.entries(JA_TO_ZH)) {
    if (jaName.includes(keyword) && keyword.length > bestMatch.length) {
      bestMatch = keyword;
      bestTranslation = translation;
    }
  }
  
  if (bestTranslation) {
    // If partial match, append the translation in parentheses
    return `${jaName}（${bestTranslation}）`;
  }
  
  return jaName;
}

/**
 * Auto-classify an item name into a category ID based on keyword matching.
 * Returns the category ID if found, empty string otherwise.
 */
export async function autoClassifyItem(jaName: string): Promise<string> {
  const categories = await db.categories.toArray();
  
  for (const [keyword, categoryName] of Object.entries(KEYWORD_TO_CATEGORY)) {
    if (jaName.includes(keyword)) {
      const matched = categories.find(c => c.name === categoryName);
      if (matched) return matched.id;
    }
  }
  
  // Default: if the item has food-related characters, classify as food
  if (/肉|魚|菜|飯|麺|麺|パン|ミルク|牛乳/.test(jaName)) {
    const food = categories.find(c => c.name === '食品');
    if (food) return food.id;
  }
  
  return '';
}
