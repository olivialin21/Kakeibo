import { useState, useRef, useEffect } from 'react';
import { db, type ReceiptItem } from '../db/db';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { ChevronLeft, Save, Camera, Sparkles, Loader2, Plus, X, Plane } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import './AddReceipt.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { convertToStandardImage } from '../utils/receiptParser';
import { translateItemName } from '../utils/itemClassifier';
import { analyzeReceiptWithAI } from '../utils/gemini';


export default function AddReceipt() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialTripId = searchParams.get('tripId');
  
  // Get return path from state
  const fromPath = location.state?.from;

  const categories = useLiveQuery(() => db.categories.toArray());
  const trips = useLiveQuery(() => db.trips.toArray());

  const [shopName, setShopName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));
  const [totalAmount, setTotalAmount] = useState('');
  const [manualTwdAmount, setManualTwdAmount] = useState('');
  const [tax8Amount, setTax8Amount] = useState('');
  const [tax10Amount, setTax10Amount] = useState('');
  const [tripId, setTripId] = useState(initialTripId || '');

  const [items, setItems] = useState<(Partial<ReceiptItem> & { translatedName?: string })[]>([
    { id: crypto.randomUUID(), name: '', originalPrice: 0, categoryId: '', quantity: 1 }
  ]);

  const [isScanning, setIsScanning] = useState(false);
  const [imageBlobs, setImageBlobs] = useState<Blob[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [showLightbox, setShowLightbox] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      const loadReceipt = async () => {
        const receipt = await db.receipts.get(id);
        if (receipt) {
          const receiptDate = new Date(receipt.date);
          setShopName(receipt.shopName);
          setDate(receiptDate.toISOString().split('T')[0]);
          setTime(receiptDate.toTimeString().split(' ')[0].substring(0, 5));
          setTotalAmount(receipt.totalAmount.toString());
          setTax8Amount(receipt.tax8Amount?.toString() || '');
          setTax10Amount(receipt.tax10Amount?.toString() || '');
          setDate(new Date(receipt.date).toISOString().split('T')[0]);
          setTime(new Date(receipt.date).toTimeString().split(' ')[0].substring(0, 5));
          setTripId(receipt.tripId || '');
          setManualTwdAmount(receipt.manualTwdAmount?.toString() || '');

          if (receipt.imageBlobs && receipt.imageBlobs.length > 0) {
            const validBlobs = receipt.imageBlobs.filter(b => b instanceof Blob);
            setImageBlobs(validBlobs);
            const urls = validBlobs.map(blob => URL.createObjectURL(blob));
            setImagePreviews(urls);
          } else if ((receipt as any).imageBlob && (receipt as any).imageBlob instanceof Blob) {
            const blob = (receipt as any).imageBlob;
            setImageBlobs([blob]);
            setImagePreviews([URL.createObjectURL(blob)]);
          }

          const dbItems = await db.receiptItems.where('receiptId').equals(id).toArray();
          if (dbItems.length > 0) setItems(dbItems);
        }
      };
      loadReceipt();
    }
  }, [id]);

  const handleAIImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsScanning(true);
    try {
      const newBlobs: Blob[] = [];
      const newPreviews: string[] = [];
      const base64Array: string[] = [];

      for (const file of files) {
        const dataUrl = await convertToStandardImage(file);

        // convert string Data URL to a real Blob
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        newBlobs.push(blob);
        newPreviews.push(URL.createObjectURL(blob));

        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        base64Array.push(base64);
      }

      setImageBlobs(prev => [...prev, ...newBlobs]);
      setImagePreviews(prev => [...prev, ...newPreviews]);

      const result = await analyzeReceiptWithAI(base64Array, categories || []);

      setShopName(result.shopName || shopName);
      setTotalAmount(result.totalAmount?.toString() || totalAmount);
      setTax8Amount(result.tax8Amount?.toString() || tax8Amount);
      setTax10Amount(result.tax10Amount?.toString() || tax10Amount);
      if (result.date) setDate(result.date);
      if (result.time) setTime(result.time);
      if (result.items && result.items.length > 0) setItems(result.items);
    } catch (error: any) {
      console.error('AI Recognition failed', error);
      alert(error instanceof Error ? error.message : 'AI 辨識失敗，請重試');
    } finally {
      setIsScanning(false);
      if (aiFileInputRef.current) aiFileInputRef.current.value = '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newBlobs: Blob[] = [];
    const newPreviews: string[] = [];

    for (const file of files) {
      const dataUrl = await convertToStandardImage(file);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      newBlobs.push(blob);
      newPreviews.push(URL.createObjectURL(blob));
    }

    setImageBlobs(prev => [...prev, ...newBlobs]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const handleAddItem = () => {
    setItems([...items, { id: crypto.randomUUID(), name: '', originalPrice: 0, categoryId: '', quantity: 1 }]);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const handleItemChange = (itemId: string, field: keyof ReceiptItem | 'discount', value: any) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const newItem = { ...item, [field]: value };

        // Calculate finalPrice
        const orig = field === 'originalPrice' ? Number(value) : (Number(item.originalPrice) || 0);
        const disc = field === 'discount' ? Number(value) : (Number(item.discount) || 0);
        newItem.finalPrice = orig - disc;

        return newItem;
      }
      return item;
    }));
  };

  const handleSave = async () => {
    // Basic validation: must have shop name and at least one type of total amount
    if (!shopName || (!totalAmount && !manualTwdAmount) || items.some(i => !i.name || !i.categoryId)) {
      alert('請填寫完整資訊 (商店名稱、金額、品項內容)');
      return;
    }

    // Determine final JPY amount (Reverse calculate if empty)
    let finalJpyAmount = Number(totalAmount) || 0;
    const finalTwdAmount = manualTwdAmount ? Number(manualTwdAmount) : undefined;

    if (finalJpyAmount === 0 && finalTwdAmount) {
      finalJpyAmount = Math.round(finalTwdAmount / 0.21);
      setTotalAmount(finalJpyAmount.toString());
    }

    const receiptId = id || crypto.randomUUID();
    const combinedDateTime = new Date(`${date}T${time}:00`).getTime();

    await db.transaction('rw', db.receipts, db.receiptItems, async () => {
      await db.receipts.put({
        id: receiptId,
        date: combinedDateTime,
        shopName,
        totalAmount: finalJpyAmount,
        currency: 'JPY',
        exchangeRate: 0.21,
        tax8Amount: Number(tax8Amount) || 0,
        tax10Amount: Number(tax10Amount) || 0,
        manualTwdAmount: finalTwdAmount,
        tripId: tripId || undefined,
        imageBlobs: imageBlobs
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
        categoryId: item.categoryId || '',
        quantity: Number(item.quantity) || 1
      }));

      await db.receiptItems.bulkAdd(itemsToSave);
    });

    handleBack();
  };

  const handleBack = () => {
    if (fromPath) {
      navigate(fromPath);
    } else if (tripId) {
      navigate(`/trips/${tripId}`);
    } else {
      navigate('/');
    }
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
    <>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
        <div className="flex flex-col space-y-4 px-1">
          <div className="flex justify-between items-center">
            <button 
              onClick={handleBack}
              className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform"
            >
              <ChevronLeft size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
            <h2 className="text-xl font-semibold tracking-tight">{id ? '編輯收據' : '新增收據'}</h2>
          </div>

          <div className="flex gap-2">
            {/* AI Button */}
            <input
              type="file"
              ref={aiFileInputRef}
              className="hidden"
              accept="image/*"
              multiple
              onChange={handleAIImageUpload}
            />
            <button
              onClick={() => aiFileInputRef.current?.click()}
              disabled={isScanning}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-3 bg-gradient-to-r from-primary to-primary-dark text-white rounded-2xl text-xs font-bold hover:opacity-90 transition-all shadow-md disabled:opacity-50 active:scale-95 border border-white/10"
            >
              {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>{isScanning ? 'AI 辨識中...' : 'AI 智慧辨識'}</span>
            </button>

            {/* Local/Manual Button */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleImageUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-2xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-md disabled:opacity-50 active:scale-95 border border-gray-100 dark:border-gray-700"
            >
              <Camera size={16} />
              <span>本地辨識</span>
            </button>
          </div>
        </div>

        {imagePreviews.length > 0 && (
          <div className="relative mx-1 group">
            <Swiper
              modules={[Pagination]}
              pagination={{ clickable: true }}
              spaceBetween={0}
              slidesPerView={1}
              className="rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              {imagePreviews.map((preview, index) => (
                <SwiperSlide key={index}>
                  <div className="relative w-full h-56 sm:h-64 grayscale-[0.1]">
                    <img
                      src={preview}
                      alt={`收據照片 ${index + 1}`}
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => {
                        setImagePreview(preview);
                        setShowLightbox(true);
                      }}
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

                    <button
                      onClick={() => {
                        const newPreviews = [...imagePreviews];
                        const newBlobs = [...imageBlobs];
                        newPreviews.splice(index, 1);
                        newBlobs.splice(index, 1);
                        setImagePreviews(newPreviews);
                        setImageBlobs(newBlobs);
                      }}
                      className="absolute top-3 right-3 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors z-10 shadow-md backdrop-blur-sm"
                    >
                      <X size={14} />
                    </button>

                    <div className="absolute bottom-10 right-4 px-2 py-1 bg-black/30 backdrop-blur-md rounded-lg text-[9px] text-white/90 font-bold tracking-widest shadow-sm pointer-events-none z-10">
                      {index + 1} / {imagePreviews.length}
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        )}
      </div>

      {/* Full-screen Overlays */}
      <AnimatePresence>
        {showLightbox && imagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLightbox(false)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 touch-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-full max-h-full"
            >
              <img
                src={imagePreview}
                alt="收據放大圖"
                className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
              />
              <button
                onClick={(e) => { e.stopPropagation(); setShowLightbox(false); }}
                className="absolute -top-12 right-0 p-3 text-white/60 hover:text-white"
              >
                <X size={32} strokeWidth={1.5} />
              </button>
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/40 text-[10px] font-medium tracking-widest uppercase">
                點擊背景關閉
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-white/60 dark:bg-gray-950/60 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="relative">
              <div className="w-20 h-20 border-4 border-primary/20 rounded-full animate-spin border-t-primary" />
              <div className="absolute inset-0 flex items-center justify-center text-primary">
                <Sparkles size={24} className="animate-pulse" />
              </div>
            </div>
            <div className="mt-8 text-center">
              <p className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Gemini AI 辨識中...</p>
              <p className="text-[10px] text-gray-400 mt-2 font-medium tracking-widest uppercase">正在解析收據細節與折扣</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 space-y-5 mb-8">
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] font-medium text-gray-400 mb-1 tracking-widest uppercase">商店名稱</label>
            <input
              type="text"
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
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
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-[9px] font-medium text-gray-400 mb-1 tracking-widest uppercase">時間</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
              />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-medium text-gray-400 mb-1 tracking-widest uppercase">旅行群組</label>
            <div className="relative">
              <Plane size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <select
                value={tripId}
                onChange={e => setTripId(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium appearance-none"
              >
                <option value="">無關聯旅行</option>
                {trips?.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-[9px] font-medium text-gray-400 mb-1 tracking-widest uppercase">日幣總計</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-gray-300 text-xs">¥</span>
              <input
                type="number"
                value={totalAmount}
                onChange={e => {
                  const val = e.target.value;
                  setTotalAmount(val);
                  // Auto-convert to TWD ONLY if TWD is empty
                  if (val && !manualTwdAmount) {
                    // We only auto-fill if empty. Currently just logic placeholder
                  }
                }}
                className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all font-semibold text-sm text-primary text-left"
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
                onChange={e => {
                  const val = e.target.value;
                  setManualTwdAmount(val);
                  // Auto-convert to JPY ONLY if JPY is empty
                  if (val && !totalAmount) {
                    const jpy = Math.round(Number(val) / 0.21);
                    setTotalAmount(jpy.toString());
                  }
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all font-semibold text-sm text-left"
                placeholder={totalAmount ? Math.round(Number(totalAmount) * 0.21).toString() : "0"}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div>
            <label className="block text-[8px] font-medium text-gray-400 mb-1 tracking-widest uppercase">8% 稅額</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]">¥</span>
              <input
                type="number"
                value={tax8Amount}
                onChange={e => setTax8Amount(e.target.value)}
                className="w-full pl-6 pr-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
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
                className="w-full pl-6 pr-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
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
              {/* Row 1: Category & Name */}
              <div className="grid grid-cols-[1fr_1fr] gap-2 items-start">
                <div>
                  <label className="block text-[8px] font-bold text-gray-400 mb-0.5 uppercase ml-1">分類</label>
                  <select
                    value={item.categoryId}
                    onChange={e => handleItemChange(item.id!, 'categoryId', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium appearance-none"
                  >
                    <option value="" disabled>分類...</option>
                    {categories?.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-gray-400 mb-0.5 uppercase ml-1">品項名稱 (日文)</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => handleItemChange(item.id!, 'name', e.target.value)}
                    placeholder="品項名稱"
                    className="w-full block px-3 py-2.5 rounded-xl border border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
                  />
                  {(item.translatedName || translation) && (
                    <p className="text-[10px] text-primary font-medium mt-1 ml-1 opacity-80 animate-in fade-in slide-in-from-top-1 duration-300">
                      譯：{item.translatedName || translation}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Quantity, Original Price, Discount */}
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
                <div>
                  <label className="block text-[8px] font-bold text-gray-400 mb-0.5 uppercase ml-1">數量</label>
                  <input
                    type="number"
                    value={item.quantity || 1}
                    onChange={e => handleItemChange(item.id!, 'quantity', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium text-left"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-bold text-gray-400 mb-0.5 uppercase ml-1">原價</label>
                  <div className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-300 text-[8px]">¥</span>
                    <input
                      type="number"
                      value={item.originalPrice || ''}
                      onChange={e => handleItemChange(item.id!, 'originalPrice', e.target.value)}
                      placeholder="0"
                      className="w-full pl-4 pr-2 py-2.5 rounded-xl border border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-semibold text-left"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[8px] font-bold text-red-400/80 mb-0.5 uppercase ml-1">特價扣除</label>
                  <div className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-red-300 text-[8px]">-</span>
                    <input
                      type="number"
                      value={item.discount || ''}
                      onChange={e => handleItemChange(item.id!, 'discount', e.target.value)}
                      placeholder="0"
                      className="w-full pl-4 pr-2 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-semibold text-left text-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Subtotal in Bottom Right */}
              <div className="flex justify-end items-center space-x-1.5 pt-1">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">品項小計</span>
                <span className="text-sm font-bold">
                  ¥{((Number(item.originalPrice) || 0) - (Number(item.discount) || 0)) * (Number(item.quantity) || 1)}
                </span>
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

      {/* Fixed Save Button */}
      {!isScanning && (
        <button
          onClick={handleSave}
          className="fixed right-6 bottom-24 z-[40] w-14 h-14 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center active:scale-90 transition-all animate-in zoom-in duration-500"
        >
          <Save size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* Full-screen Overlays */}
      <AnimatePresence>
        {showLightbox && imagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLightbox(false)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 touch-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-full max-h-full"
            >
              <img
                src={imagePreview}
                alt="收據放大圖"
                className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
              />
              <button
                onClick={(e) => { e.stopPropagation(); setShowLightbox(false); }}
                className="absolute -top-12 right-0 p-3 text-white/60 hover:text-white"
              >
                <X size={32} strokeWidth={1.5} />
              </button>
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/40 text-[10px] font-medium tracking-widest uppercase">
                點擊背景關閉
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-white/60 dark:bg-gray-950/60 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="relative">
              <div className="w-20 h-20 border-4 border-primary/20 rounded-full animate-spin border-t-primary" />
              <div className="absolute inset-0 flex items-center justify-center text-primary">
                <Sparkles size={24} className="animate-pulse" />
              </div>
            </div>
            <div className="mt-8 text-center">
              <p className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Gemini AI 辨識中...</p>
              <p className="text-[10px] text-gray-400 mt-2 font-medium tracking-widest uppercase">正在解析收據細節與折扣</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
