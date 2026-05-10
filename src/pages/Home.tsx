import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Receipt, ChevronRight, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { formatToTwd, groupReceiptsByDate, formatReceiptTime } from '../utils/formatters';

export default function Home() {
  const [limit, setLimit] = useState(20);
  const observerRef = useRef<HTMLDivElement>(null);

  const receipts = useLiveQuery(
    () => db.receipts.orderBy('date').reverse().limit(limit).toArray(),
    [limit]
  );

  const totalCount = useLiveQuery(() => db.receipts.count());

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);

  // For the summary card, we still want the monthly total
  const thisMonthStats = useLiveQuery(async () => {
    const allThisMonth = await db.receipts
      .where('date')
      .between(
        new Date(`${currentMonthPrefix}-01`).getTime(),
        new Date(`${currentMonthPrefix}-31`).getTime() + 86400000
      )
      .toArray();

    const jpy = allThisMonth.reduce((acc, r) => acc + r.totalAmount, 0);
    const twd = allThisMonth.reduce((acc, r) => acc + formatToTwd(r.totalAmount, r.manualTwdAmount), 0);
    return { jpy, twd, count: allThisMonth.length };
  }, []);

  const hasMore = (receipts?.length || 0) < (totalCount || 0);

  // 用 ref 追蹤載入狀態，避免多次觸發
  const isLoadingRef = useRef(false);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries;
    if (target.isIntersecting && hasMore && !isLoadingRef.current) {
      isLoadingRef.current = true;
      setLimit(prev => prev + 20);
      
      // 給予一點時間讓資料載入，之後重置鎖定
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 500);
    }
  }, [hasMore]);

  useEffect(() => {
    const element = observerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, { 
      threshold: 0.1,
      rootMargin: '200px' // 提早 200px 載入，減少卡頓感
    });
    observer.observe(element);
    return () => observer.unobserve(element);
  }, [handleObserver]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('確定要刪除這筆收據嗎？')) return;

    await db.transaction('rw', db.receipts, db.receiptItems, async () => {
      await db.receiptItems.where('receiptId').equals(id).delete();
      await db.receipts.delete(id);
    });
  };

  // Group receipts by date using shared utility
  const groupedReceipts = useMemo(() => {
    return receipts ? groupReceiptsByDate(receipts) : {};
  }, [receipts]);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-6">
      {/* Premium Monthly Summary Card */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary to-primary/80 p-7 shadow-2xl shadow-primary/20 text-white">
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
                {thisMonthStats?.count || 0} 筆
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">預估台幣</p>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-medium text-white/40">NT$</span>
                <span className="text-4xl font-semibold tracking-tight">{(thisMonthStats?.twd || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-end justify-between border-t border-white/10 pt-5">
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">日幣總計</p>
                <div className="flex items-baseline space-x-1 text-white/90">
                  <span className="text-sm font-medium text-white/40">¥</span>
                  <span className="text-xl font-semibold">{(thisMonthStats?.jpy || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt List */}
      <div className="space-y-4">
        <h3 className="font-semibold text-base ml-1 text-gray-800 dark:text-gray-100 tracking-tight">收據紀錄</h3>
        {receipts === undefined ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-primary opacity-50" size={24} />
          </div>
        ) : receipts.length === 0 ? (
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
                            state={{ from: '/' }}
                            className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center shadow-[0_2px_8px_rgba(0,0,0,0.02)] active:bg-gray-50 transition-all hover:border-primary/20"
                          >
                            <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center shrink-0 mr-4 border border-gray-50 dark:border-gray-700 overflow-hidden shadow-inner">
                              {r.imageBlobs && r.imageBlobs.length > 0 && r.imageBlobs[0] instanceof Blob ? (
                                <img
                                  src={URL.createObjectURL(r.imageBlobs[0])}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (r as any).imageBlob && (r as any).imageBlob instanceof Blob ? (
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
                                <span className="text-[9px] text-gray-400 font-medium tracking-tight">
                                  {formatReceiptTime(r.date)}
                                </span>
                              </div>
                            </div>

                            <div className="text-right ml-2 shrink-0 mr-3">
                              <div className="font-semibold text-[15px] text-gray-900 dark:text-white tracking-tighter">
                                NT$ {formatToTwd(r.totalAmount, r.manualTwdAmount).toLocaleString()}
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

            {/* Infinite Scroll Sentinel */}
            <div ref={observerRef} className="py-6 flex justify-center">
              {hasMore ? (
                <div className="flex items-center space-x-2 text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">載入中...</span>
                </div>
              ) : receipts && receipts.length > 0 ? (
                <p className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.2em] text-center">已載入所有資料</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
