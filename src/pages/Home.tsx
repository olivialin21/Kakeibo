import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Receipt, ChevronRight, ImageIcon, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function Home() {
  const receipts = useLiveQuery(() => db.receipts.orderBy('date').reverse().toArray());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  
  const thisMonthReceipts = receipts?.filter(r => {
    const d = new Date(r.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentMonthPrefix;
  }) || [];

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
      {/* Monthly Summary Card */}
      <div className="glass rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">本月支出概覽</h2>
          <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-full font-medium">
            {receiptCount} 筆紀錄
          </span>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-0.5">
            <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider">預估台幣</p>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white flex items-baseline">
              <span className="text-[10px] font-medium mr-1 opacity-40">NT$</span>
              {displayTWD.toLocaleString()}
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider">日幣總計</p>
            <div className="text-2xl font-semibold text-primary flex items-baseline">
              <span className="text-[10px] font-medium mr-1 opacity-60">¥</span>
              {totalJPY.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Receipt List */}
      <div className="space-y-4">
        <h3 className="font-medium text-base ml-1 text-gray-800 dark:text-gray-100 tracking-tight">收據紀錄</h3>
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
            {Object.entries(groupedReceipts).map(([dateLabel, dayReceipts]) => (
              <div key={dateLabel}>
                <p className="text-[10px] text-gray-400 font-medium ml-1 mb-2 tracking-widest uppercase">{dateLabel}</p>
                <div className="space-y-2.5">
                  <AnimatePresence mode="popLayout">
                    {dayReceipts?.map(r => (
                      <motion.div 
                        key={r.id}
                        layout
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="relative group"
                      >
                        <Link 
                          to={`/edit/${r.id}`} 
                          className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center shadow-[0_1px_4px_rgba(0,0,0,0.02)] active:bg-gray-50 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center shrink-0 mr-3.5 border border-gray-50 dark:border-gray-700 overflow-hidden">
                            {r.imageBlob ? (
                              <img
                                src={URL.createObjectURL(r.imageBlob)}
                                alt=""
                                className="w-full h-full object-cover grayscale-[0.2]"
                              />
                            ) : (
                              <Receipt size={18} className="text-gray-400 opacity-40" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate text-gray-800 dark:text-gray-100">{r.shopName || '未命名收據'}</h4>
                            <div className="flex items-center space-x-2 mt-1">
                              {r.imageBlob && <ImageIcon size={10} className="text-gray-300" />}
                              {(r.tax8Amount > 0 || r.tax10Amount > 0) && (
                                <span className="text-[8px] bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded font-medium uppercase tracking-tighter">
                                  含稅
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right ml-2 shrink-0 mr-1">
                            <div className="font-semibold text-sm text-gray-900 dark:text-white">
                              NT$ {r.manualTwdAmount ? r.manualTwdAmount.toLocaleString() : Math.round(r.totalAmount * 0.21).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                              ¥ {r.totalAmount.toLocaleString()}
                            </div>
                          </div>
                          
                          <ChevronRight size={14} className="text-gray-200 shrink-0" />
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
