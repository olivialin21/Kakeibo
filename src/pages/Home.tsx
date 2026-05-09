import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Receipt, ChevronRight, X, Camera, Plus, Settings2, Download, Upload, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { exportData, importData } from '../utils/dataManagement';

export default function Home() {
  const receipts = useLiveQuery(() => db.receipts.orderBy('date').reverse().toArray());
  const [, setDeletingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  
  const thisMonthReceipts = receipts?.filter(r => {
    const d = new Date(r.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentMonthPrefix;
  }) || [];

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (confirm('匯入將會覆蓋現有所有資料，確定要繼續嗎？')) {
      try {
        await importData(file);
        alert('資料還原成功！');
        window.location.reload();
      } catch (err) {
        alert('還原失敗，請檢查檔案格式。');
      }
    }
  };

  const totalJPY = thisMonthReceipts.reduce((acc, r) => acc + r.totalAmount, 0) || 0;
  const displayTWD = thisMonthReceipts.reduce((acc, r) => {
    return acc + (r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21));
  }, 0) || 0;
  const receiptCount = thisMonthReceipts.length;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('確定要刪除這筆收據嗎？')) return;
    
    setDeletingId(id);
    await db.transaction('rw', db.receipts, db.receiptItems, async () => {
      await db.receiptItems.where('receiptId').equals(id).delete();
      await db.receipts.delete(id);
    });
    setDeletingId(null);
  };

  // Group receipts by date
  const groupedReceipts: Record<string, typeof receipts> = {};
  receipts?.forEach(r => {
    const dateKey = new Date(r.date).toLocaleDateString('zh-TW', { 
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' 
    });
    if (!groupedReceipts[dateKey]) groupedReceipts[dateKey] = [];
    groupedReceipts[dateKey]!.push(r);
  });

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-6">
      {/* Header */}
      <div className="px-1 flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">日幣記帳</h1>
          <p className="text-[10px] font-semibold text-gray-400 mt-1 uppercase tracking-[0.2em] opacity-70">Travel Expense Tracker</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-full transition-all ${showSettings ? 'bg-gray-900 text-white' : 'bg-white dark:bg-gray-800 text-gray-400 shadow-sm border border-gray-100 dark:border-gray-700'}`}
          >
            <Settings2 size={18} />
          </button>
          <Link to="/add" className="bg-primary text-white p-2.5 rounded-full shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
            <Plus size={18} />
          </Link>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-50 dark:border-gray-700/50">
                <ShieldCheck size={14} className="text-primary" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">數據管理 (本地儲存)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => exportData()}
                  className="flex items-center justify-center space-x-2 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <Download size={14} className="text-blue-500" />
                  <span className="text-xs font-semibold">匯出備份</span>
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center space-x-2 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <Upload size={14} className="text-green-500" />
                  <span className="text-xs font-semibold">匯入還原</span>
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleImport}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Monthly Summary Card - Always Green Gradient */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary to-primary/80 p-7 shadow-2xl shadow-primary/20 text-white">
        {/* Abstract background shapes */}
        <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">本月支出概覽</h2>
            </div>
            <div className="flex items-center space-x-1 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
              <Receipt size={10} className="text-white/70" />
              <span className="text-[10px] font-bold text-white/90">
                {receiptCount} 筆
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">預估台幣</p>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-medium text-white/40">NT$</span>
                <span className="text-4xl font-semibold tracking-tight">{displayTWD.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-end justify-between border-t border-white/10 pt-5">
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">日幣總計</p>
                <div className="flex items-baseline space-x-1 text-white/90">
                  <span className="text-sm font-medium text-white/40">¥</span>
                  <span className="text-xl font-semibold">{totalJPY.toLocaleString()}</span>
                </div>
              </div>
              
              <Link 
                to="/add" 
                className="flex items-center space-x-2 bg-white text-gray-900 px-5 py-2.5 rounded-2xl font-semibold text-xs shadow-lg active:scale-95 transition-transform"
              >
                <Camera size={14} />
                <span>立即掃描</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt List */}
      <div className="space-y-4">
        <h3 className="font-semibold text-base ml-1 text-gray-800 dark:text-gray-100 tracking-tight">收據紀錄</h3>
        {receipts?.length === 0 ? (
          <div className="text-center py-16 bg-gray-50/30 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-100 dark:border-gray-800 flex flex-col items-center space-y-4 mx-1">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Receipt size={24} className="text-gray-300" />
            </div>
            <p className="text-xs text-gray-400 font-medium">尚未有任何記帳紀錄</p>
            <Link to="/add" className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-xs font-medium hover:opacity-90 transition-opacity shadow-sm">
              開始記帳
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedReceipts)
              .sort((a, b) => {
                const aReceipts = a[1];
                const bReceipts = b[1];
                if (!aReceipts || !bReceipts || aReceipts.length === 0 || bReceipts.length === 0) return 0;
                return new Date(bReceipts[0].date).getTime() - new Date(aReceipts[0].date).getTime();
              })
              .map(([dateLabel, dayReceipts]) => (
                <div key={dateLabel}>
                <p className="text-[10px] text-gray-400 font-semibold ml-1 mb-2 tracking-widest uppercase">{dateLabel}</p>
                <div className="space-y-2.5">
                  <AnimatePresence mode="popLayout">
                    {dayReceipts?.map(r => (
                      <motion.div 
                        key={r.id}
                        layout
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative group"
                      >
                        <Link 
                          to={`/edit/${r.id}`} 
                          className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center shadow-[0_2px_8px_rgba(0,0,0,0.02)] active:bg-gray-50 transition-all hover:border-primary/20"
                        >
                          <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center shrink-0 mr-4 border border-gray-50 dark:border-gray-700 overflow-hidden shadow-inner">
                            {r.imageBlobs && r.imageBlobs.length > 0 ? (
                              <img
                                src={URL.createObjectURL(r.imageBlobs[0])}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (r as any).imageBlob ? (
                              <img
                                src={URL.createObjectURL((r as any).imageBlob)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-gray-300">
                                <Receipt size={18} />
                                <span className="text-[6px] font-bold uppercase mt-0.5">Cash</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-[13px] truncate text-gray-800 dark:text-gray-100 leading-tight mb-1">
                              {r.shopName || '未命名收據'}
                            </h4>
                            <div className="flex items-center space-x-2">
                              {(r.tax8Amount > 0 || r.tax10Amount > 0) && (
                                <span className="text-[7px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold uppercase">
                                  Tax Included
                                </span>
                              )}
                              <span className="text-[9px] text-gray-400 font-medium tracking-tight">
                                {new Date(r.date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right ml-2 shrink-0 mr-3">
                            <div className="font-semibold text-[15px] text-gray-900 dark:text-white tracking-tighter">
                              NT$ {r.manualTwdAmount ? r.manualTwdAmount.toLocaleString() : Math.round(r.totalAmount * 0.21).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium mt-0.5 opacity-60">
                              ¥ {r.totalAmount.toLocaleString()}
                            </div>
                          </div>
                          
                          <ChevronRight size={14} className="text-gray-300 shrink-0" />
                        </Link>
                        
                        <button 
                          onClick={(e) => handleDelete(r.id, e)}
                          className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-gray-700 text-gray-400 hover:text-red-500 rounded-full shadow-sm border border-gray-100 dark:border-gray-600 transition-all z-20"
                        >
                          <X size={10} strokeWidth={3} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
