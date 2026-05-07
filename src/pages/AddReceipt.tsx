import { useState, useRef, useEffect } from 'react';
import { db, type ReceiptItem } from '../db/db';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Save, Camera, Loader2, Plane, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { processReceiptImage } from '../utils/receiptParser';
import { translateItemName, autoClassifyItem } from '../utils/itemClassifier';

export default function AddReceipt() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialTripId = searchParams.get('tripId');
  
  const categories = useLiveQuery(() => db.categories.toArray());
  const trips = useLiveQuery(() => db.trips.toArray());
  
  const [shopName, setShopName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState('');
  const [manualTwdAmount, setManualTwdAmount] = useState('');
  const [tax8Amount, setTax8Amount] = useState('');
  const [tax10Amount, setTax10Amount] = useState('');
  const [tripId, setTripId] = useState(initialTripId || '');
  
  const [items, setItems] = useState<Partial<ReceiptItem>[]>([
    { id: crypto.randomUUID(), name: '', originalPrice: 0, categoryId: '' }
  ]);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      const loadReceipt = async () => {
        const receipt = await db.receipts.get(id);
        if (receipt) {
          setShopName(receipt.shopName);
          setDate(new Date(receipt.date).toISOString().split('T')[0]);
          setTotalAmount(receipt.totalAmount.toString());
          setManualTwdAmount(receipt.manualTwdAmount?.toString() || '');
          setTax8Amount(receipt.tax8Amount?.toString() || '');
          setTax10Amount(receipt.tax10Amount?.toString() || '');
          setTripId(receipt.tripId || '');
          
          if (receipt.imageBlob) {
            setImageBlob(receipt.imageBlob);
            setImagePreview(URL.createObjectURL(receipt.imageBlob));
          }
          
          const dbItems = await db.receiptItems.where('receiptId').equals(id).toArray();
          if (dbItems.length > 0) {
            setItems(dbItems);
          }
        }
      };
      loadReceipt();
    }
  }, [id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanProgress(0);

    const isHeic = file.type.includes('heic') || file.name.toLowerCase().endsWith('.heic');
    const originalPreviewUrl = URL.createObjectURL(file);
    
    // If it's NOT HEIC, show original color immediately
    // If it IS HEIC, Edge can't show it, so we'll wait for the converted version
    if (!isHeic) {
      setImagePreview(originalPreviewUrl);
    }
    
    try {
      const { parsed, processedImage } = await processReceiptImage(file, (progress) => {
        setScanProgress(Math.round(progress * 100));
      });

      // If it WAS HEIC, we now have a JPEG version for preview
      if (isHeic) {
        setImagePreview(processedImage);
      }
      
      // Save the processed JPEG to DB
      const res = await fetch(processedImage);
      const blob = await res.blob();
      setImageBlob(blob);

      if (parsed.shopName) setShopName(parsed.shopName);
      if (parsed.date) setDate(parsed.date);
      if (parsed.totalAmount) setTotalAmount(parsed.totalAmount.toString());
      if (parsed.tax8Amount) setTax8Amount(parsed.tax8Amount.toString());
      if (parsed.tax10Amount) setTax10Amount(parsed.tax10Amount.toString());
      if (parsed.items.length > 0) {
        const enrichedItems = await Promise.all(
          parsed.items.map(async (item) => {
            const translatedName = translateItemName(item.name || '');
            const categoryId = await autoClassifyItem(item.name || '');
            return {
              ...item,
              name: item.name, // Keep original Japanese
              categoryId: categoryId || item.categoryId || ''
            };
          })
        );
        setItems(enrichedItems);
      }
    } catch (error) {
      console.error(error);
      alert('辨識失敗，請重試或確認圖片清晰度。');
    } finally {
      setIsScanning(false);
      setScanProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddItem = () => {
    setItems([...items, { id: crypto.randomUUID(), name: '', originalPrice: 0, categoryId: '' }]);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const handleItemChange = (itemId: string, field: keyof ReceiptItem, value: any) => {
    setItems(items.map(item => item.id === itemId ? { ...item, [field]: value } : item));
  };

  const handleSave = async () => {
    if (!shopName || !totalAmount || items.some(i => !i.name || !i.categoryId)) {
      alert('請填寫完整資訊');
      return;
    }

    const receiptId = id || crypto.randomUUID();
    
    await db.transaction('rw', db.receipts, db.receiptItems, async () => {
      await db.receipts.put({
        id: receiptId,
        date: new Date(date).getTime(),
        shopName,
        totalAmount: Number(totalAmount),
        currency: 'JPY',
        exchangeRate: 0.21,
        tax8Amount: Number(tax8Amount) || 0,
        tax10Amount: Number(tax10Amount) || 0,
        manualTwdAmount: manualTwdAmount ? Number(manualTwdAmount) : undefined,
        tripId: tripId || undefined,
        ...(imageBlob ? { imageBlob } : {})
      });

      if (id) {
        await db.receiptItems.where('receiptId').equals(id).delete();
      }

      const itemsToSave = items.map(item => ({
        id: item.id || crypto.randomUUID(),
        receiptId,
        name: item.name || '',
        originalPrice: Number(item.originalPrice) || 0,
        finalPrice: Number(item.originalPrice) || 0,
        taxRate: 0,
        categoryId: item.categoryId || ''
      }));

      await db.receiptItems.bulkAdd(itemsToSave);
    });

    navigate('/');
  };

  const getTranslationHint = (name: string) => {
    if (!name) return null;
    const translated = translateItemName(name);
    // Only return if it actually translated something (contains parentheses in our current implementation)
    if (translated.includes('（')) {
      const match = translated.match(/（(.*)）/);
      return match ? match[1] : null;
    }
    // Check for exact match in JA_TO_ZH logic
    if (translated !== name) return translated;
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-semibold tracking-tight">{id ? '編輯收據' : '新增收據'}</h2>
        <div className="flex space-x-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="flex items-center space-x-1 px-3.5 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-[10px] font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50 uppercase"
          >
            {isScanning ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            <span>{isScanning ? `掃描中` : '掃描'}</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={handleImageUpload}
          />
          <button 
            onClick={handleSave}
            disabled={isScanning}
            className="flex items-center space-x-1 px-3.5 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-[10px] font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 uppercase"
          >
            <Save size={12} />
            <span>儲存</span>
          </button>
        </div>
      </div>

      {imagePreview && (
        <div className="relative rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 mx-1 grayscale-[0.2]">
          <img src={imagePreview} alt="收據照片" className="w-full max-h-48 object-cover" />
          <button
            onClick={() => { setImageBlob(null); setImagePreview(null); }}
            className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      <div className="glass rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 space-y-5">
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] font-medium text-gray-400 mb-1 tracking-widest uppercase">商店名稱</label>
            <input 
              type="text" 
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
              placeholder="例如：AEON, 7-11"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-medium text-gray-400 mb-1 tracking-widest uppercase">日期</label>
              <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-[9px] font-medium text-gray-400 mb-1 tracking-widest uppercase">旅行群組</label>
              <div className="relative">
                <Plane size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <select 
                  value={tripId}
                  onChange={e => setTripId(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium appearance-none"
                >
                  <option value="">無關聯旅行</option>
                  {trips?.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-[9px] font-medium text-gray-400 mb-1 tracking-widest uppercase">日幣總計 <span className="text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-gray-300 text-xs">¥</span>
              <input 
                type="number" 
                value={totalAmount}
                onChange={e => setTotalAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all font-semibold text-sm text-primary"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-medium text-gray-400 mb-1 tracking-widest uppercase">台幣實付</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-gray-300 text-[10px]">NT$</span>
              <input 
                type="number" 
                value={manualTwdAmount}
                onChange={e => setManualTwdAmount(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all font-semibold text-sm"
                placeholder={totalAmount ? Math.round(Number(totalAmount) * 0.21).toString() : "0"}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-gray-800">
          <div>
            <label className="block text-[8px] font-medium text-gray-400 mb-1 tracking-widest uppercase">8% 稅額</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]">¥</span>
              <input 
                type="number" 
                value={tax8Amount}
                onChange={e => setTax8Amount(e.target.value)}
                className="w-full pl-6 pr-2 py-2 rounded-lg border border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-[8px] font-medium text-gray-400 mb-1 tracking-widest uppercase">10% 稅額</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]">¥</span>
              <input 
                type="number" 
                value={tax10Amount}
                onChange={e => setTax10Amount(e.target.value)}
                className="w-full pl-6 pr-2 py-2 rounded-lg border border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-1">
        <h3 className="font-medium text-base text-gray-800 dark:text-gray-100 tracking-tight">消費品項明細</h3>
        
        {items.map((item) => {
          const translation = getTranslationHint(item.name || '');
          return (
            <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.02)] border border-gray-100 dark:border-gray-700 space-y-3 relative group transition-all">
              <div>
                <input 
                  type="text" 
                  value={item.name}
                  onChange={e => handleItemChange(item.id!, 'name', e.target.value)}
                  placeholder="品項名稱 (中文或日文)"
                  className="w-full block px-3 py-2 rounded-xl border border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
                />
                {translation && (
                  <p className="text-[10px] text-primary font-medium mt-1 ml-1 opacity-80 animate-in fade-in slide-in-from-top-1 duration-300">
                    譯：{translation}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <select 
                  value={item.categoryId}
                  onChange={e => handleItemChange(item.id!, 'categoryId', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium appearance-none"
                >
                  <option value="" disabled>選擇分類...</option>
                  {categories?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]">¥</span>
                  <input 
                    type="number" 
                    value={item.originalPrice || ''}
                    onChange={e => handleItemChange(item.id!, 'originalPrice', e.target.value)}
                    placeholder="金額"
                    className="w-full pl-6 pr-3 py-2 rounded-xl border border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-semibold text-right"
                  />
                </div>
              </div>

              {/* Delete button in top-right */}
              {items.length > 1 && (
                <button 
                  onClick={() => handleRemoveItem(item.id!)}
                  className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-gray-700 text-gray-300 hover:text-red-500 rounded-full shadow-sm border border-gray-50 dark:border-gray-600 transition-all z-20"
                >
                  <X size={8} strokeWidth={3} />
                </button>
              )}
            </div>
          );
        })}
        
        <button 
          onClick={handleAddItem}
          className="w-full py-4 flex items-center justify-center space-x-2 border border-dashed border-gray-100 dark:border-gray-800 rounded-2xl text-gray-400 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.99]"
        >
          <Plus size={16} />
          <span className="font-medium text-xs">新增一筆品項</span>
        </button>
      </div>
    </div>
  );
}
