import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ChevronLeft, Receipt, Calendar, ShoppingBag, PieChart as PieChartIcon, X, TrendingUp, BarChart2, Trash2, Loader2, Pencil, Check, Undo2 } from 'lucide-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import CategoryPieChart from '../components/charts/CategoryPieChart';
import type { PieChartData } from '../components/charts/CategoryPieChart';
import DailyTrendBarChart from '../components/charts/DailyTrendBarChart';
import type { BarChartData } from '../components/charts/DailyTrendBarChart';
import { formatToTwd, groupReceiptsByDate } from '../utils/formatters';

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [limit, setLimit] = useState(20);
  const observerRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const trip = useLiveQuery(() => id ? db.trips.get(id) : undefined, [id]);
  
  useEffect(() => {
    if (trip) {
      setEditName(trip.name);
      setEditStartDate(new Date(trip.startDate).toISOString().split('T')[0]);
      setEditEndDate(trip.endDate ? new Date(trip.endDate).toISOString().split('T')[0] : '');
    }
  }, [trip]);

  const handleUpdateTrip = async () => {
    if (!id || !editName.trim()) return;
    await db.trips.update(id, {
      name: editName.trim(),
      startDate: new Date(editStartDate).getTime(),
      endDate: editEndDate ? new Date(editEndDate).getTime() : undefined
    });
    setIsEditing(false);
  };
  
  // Get ALL receipts for this trip (necessary for full stats and consistent sorting)
  const allReceipts = useLiveQuery(
    () => id ? db.receipts.where('tripId').equals(id).toArray() : [],
    [id]
  );
  
  // Sorted receipts (latest first)
  const sortedReceipts = useMemo(() => {
    if (!allReceipts) return [];
    return [...allReceipts].sort((a, b) => b.date - a.date);
  }, [allReceipts]);

  // Paginated receipts for display
  const paginatedReceipts = useMemo(() => {
    return sortedReceipts.slice(0, limit);
  }, [sortedReceipts, limit]);

  const totalReceiptsCount = allReceipts?.length || 0;
  const hasMore = paginatedReceipts.length < totalReceiptsCount;
  
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const categories = useLiveQuery(() => db.categories.toArray());
  const receiptItems = useLiveQuery(() => db.receiptItems.toArray());

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries;
    if (target.isIntersecting && hasMore) {
      setLimit(prev => prev + 20);
    }
  }, [hasMore]);

  useEffect(() => {
    const element = observerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(element);
    return () => observer.unobserve(element);
  }, [handleObserver]);

  // Group current batch of receipts by date - MOVED UP to follow Rules of Hooks
  const groupedReceipts = useMemo(() => {
    return groupReceiptsByDate(paginatedReceipts);
  }, [paginatedReceipts]);

  const handleDeleteReceipt = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('確定要刪除這筆收據嗎？')) return;
    
    setIsDeleting(id);
    await db.transaction('rw', db.receipts, db.receiptItems, async () => {
      await db.receiptItems.where('receiptId').equals(id).delete();
      await db.receipts.delete(id);
    });
    setIsDeleting(null);
  };

  const handleDeleteTrip = async () => {
    if (!id || !trip) return;
    if (!confirm(`確定要刪除「${trip.name}」這趟旅行嗎？\n(收據將會保留但不再關聯此旅行)`)) return;

    await db.transaction('rw', db.trips, db.receipts, async () => {
      await db.receipts.where('tripId').equals(id).modify({ tripId: undefined });
      await db.trips.delete(id);
    });
    
    navigate('/trips');
  };

  // Stats calculation based on all receipts
  const totalJPY = useMemo(() => allReceipts ? allReceipts.reduce((s, r) => s + r.totalAmount, 0) : 0, [allReceipts]);
  const totalTWD = useMemo(() => allReceipts ? allReceipts.reduce((s, r) => s + formatToTwd(r.totalAmount, r.manualTwdAmount), 0) : 0, [allReceipts]);
  
  const categoryData: PieChartData[] = useMemo(() => {
    if (!categories || !allReceipts || !receiptItems) return [];
    
    return categories.map(cat => {
      const tripReceiptIds = new Set(allReceipts.map(r => r.id));
      const catItems = receiptItems.filter(item => item.categoryId === cat.id && tripReceiptIds.has(item.receiptId));
      
      const jpyTotal = catItems.reduce((s, i) => s + i.originalPrice, 0);
      const twdTotal = catItems.reduce((s, item) => {
        const receipt = allReceipts.find(r => r.id === item.receiptId);
        if (!receipt) return s;
        const receiptTwd = formatToTwd(receipt.totalAmount, receipt.manualTwdAmount);
        const proportion = receipt.totalAmount > 0 ? item.originalPrice / receipt.totalAmount : 0;
        return s + (receiptTwd * proportion);
      }, 0);

      return { 
        name: cat.name, 
        value: jpyTotal, 
        displayValue: Math.round(twdTotal),
        color: cat.color 
      };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [categories, allReceipts, receiptItems]);

  const barData: BarChartData[] = useMemo(() => {
    if (!allReceipts) return [];
    
    const dailyData: Record<string, number> = {};
    allReceipts.forEach(r => {
      const d = new Date(r.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
      dailyData[d] = (dailyData[d] || 0) + r.totalAmount;
    });
    
    return Object.entries(dailyData)
      .sort((a, b) => {
        const [m1, d1] = a[0].split('/').map(Number);
        const [m2, d2] = b[0].split('/').map(Number);
        return m1 !== m2 ? m1 - m2 : d1 - d2;
      })
      .map(([date, amount]) => ({ date, amount }));
  }, [allReceipts]);

  const daysCount = useMemo(() => {
    if (!trip) return 1;
    return Math.max(1, Math.ceil((new Date().getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)));
  }, [trip]);

  const dailyAvg = useMemo(() => Math.round(totalJPY / daysCount), [totalJPY, daysCount]);
  const maxExpense = useMemo(() => allReceipts && allReceipts.length > 0 ? Math.max(...allReceipts.map(r => r.totalAmount)) : 0, [allReceipts]);

  // EARLY RETURN - must be after all Hooks
  if (!trip || !allReceipts) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-3 w-full">
          <Link to="/trips" className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform">
            <ChevronLeft size={18} className="text-gray-500 dark:text-gray-400" />
          </Link>
          
          {isEditing ? (
            <div className="glass p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4 mb-2 shadow-sm">
              <h3 className="text-[10px] font-bold text-primary flex items-center space-x-2 uppercase tracking-widest">
                <Pencil size={12} />
                <span>編輯旅行資訊</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] text-gray-400 font-medium uppercase mb-1 tracking-widest">旅行名稱</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-gray-400 font-medium uppercase mb-1 tracking-widest">出發日期</label>
                    <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-xs font-medium" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-400 font-medium uppercase mb-1 tracking-widest">結束日期</label>
                    <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-xs font-medium" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleUpdateTrip} className="flex-[2] bg-primary text-white py-2.5 rounded-xl font-medium text-xs shadow-sm active:scale-95 transition-transform">儲存變更</button>
                  <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-50 dark:bg-gray-800 text-gray-400 py-2.5 rounded-xl text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all">取消</button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">{trip.name}</h2>
              <p className="text-[9px] font-medium text-gray-400 flex items-center uppercase tracking-widest mt-0.5">
                <Calendar size={10} className="mr-1.5 opacity-50" />
                {new Date(trip.startDate).toLocaleDateString()} ~ {trip.endDate ? new Date(trip.endDate).toLocaleDateString() : '未設定'}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <button onClick={handleUpdateTrip} className="p-2 text-green-600 hover:text-green-700 active:scale-90 transition-all"><Check size={18} /></button>
              <button onClick={() => setIsEditing(false)} className="p-2 text-gray-400 hover:text-gray-600 active:scale-90 transition-all"><Undo2 size={18} /></button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-primary active:scale-90 transition-all"><Pencil size={18} /></button>
              <button onClick={handleDeleteTrip} className="p-2 text-gray-300 hover:text-red-500 active:scale-90 transition-all"><Trash2 size={18} /></button>
            </>
          )}
        </div>
      </div>

      {/* Settlement Report Card */}
      <div className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-gray-800 p-7 border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">旅行結算報表</h3>
          <div className="px-3 py-1 bg-primary/5 text-primary rounded-full text-[9px] font-bold">
            {totalReceiptsCount} 筆消費
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-8 gap-x-12">
          <div className="space-y-1">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider flex items-center">
              <ShoppingBag size={10} className="mr-1.5 text-primary" /> 日幣總金額
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">¥{totalJPY.toLocaleString()}</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5" /> 台幣預估
            </p>
            <p className="text-xl font-bold text-gray-700 dark:text-gray-200">NT${totalTWD.toLocaleString()}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider flex items-center">
              <TrendingUp size={10} className="mr-1.5 text-orange-400" /> 每日平均
            </p>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">¥{dailyAvg.toLocaleString()}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">最高單筆</p>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">¥{maxExpense.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Visual Analytics Section */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center">
            <PieChartIcon size={12} className="mr-2" /> 支出分布 (類別)
          </h4>
          <CategoryPieChart 
            data={categoryData.map(d => ({
              ...d,
              value: d.displayValue as number, // Swap values to show TWD as primary
              displayValue: d.value // Show JPY as secondary
            }))}
            totalLabel="旅行總計"
            totalValue={`NT$${totalTWD.toLocaleString()}`}
            height={200}
            valuePrefix="NT$"
            displayValuePrefix="¥"
          />
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center">
            <BarChart2 size={12} className="mr-2" /> 每日消費趨勢
          </h4>
          <DailyTrendBarChart 
            data={barData.map(d => ({
              ...d,
              amount: allReceipts.filter(r => new Date(r.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) === d.date)
                .reduce((s, r) => s + formatToTwd(r.totalAmount, r.manualTwdAmount), 0)
            }))}
            height={160}
            valuePrefix="NT$"
            fontSize={9}
          />
        </div>
      </div>

      {/* Receipt List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-medium text-base text-gray-800 dark:text-gray-100 tracking-tight">旅行明細 ({totalReceiptsCount})</h3>
          <Link to={`/add?tripId=${id}`} className="text-[9px] font-semibold text-primary uppercase tracking-widest bg-primary/5 px-3 py-1.5 rounded-full">
            + 繼續記帳
          </Link>
        </div>
        
        {totalReceiptsCount === 0 ? (
          <div className="text-center py-12 bg-gray-50/20 dark:bg-gray-800/10 rounded-3xl border border-dashed border-gray-100 dark:border-gray-800 text-gray-400 text-xs font-medium">
            這趟旅行尚未有任何關聯的收據
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedReceipts)
              .sort((a, b) => new Date(b[1][0].date).getTime() - new Date(a[1][0].date).getTime())
              .map(([dateLabel, dayReceipts]) => (
                <div key={dateLabel}>
                  <p className="text-[10px] text-gray-400 font-semibold ml-1 mb-2 tracking-widest uppercase">{dateLabel}</p>
                  <div className="space-y-2.5">
                    {dayReceipts.map(r => (
                    <div key={r.id} className="relative group">
                      <Link 
                        to={`/edit/${r.id}`} 
                        state={{ from: `/trips/${id}` }}
                        className="bg-white dark:bg-gray-800 flex items-center p-4 rounded-2xl border border-gray-100 dark:border-gray-700 active:bg-gray-50 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-primary/20"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center mr-4 shrink-0 border border-gray-50 dark:border-gray-700 overflow-hidden shadow-inner">
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
                            <Receipt size={18} className="text-gray-400 opacity-60" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-[13px] truncate text-gray-800 dark:text-gray-100 leading-tight mb-1">
                            {r.shopName || '未命名收據'}
                          </h4>
                        </div>
                        
                        <div className="text-right ml-2 shrink-0 mr-3">
                          <div className="font-semibold text-[15px] text-gray-900 dark:text-white tracking-tighter">
                            NT$ {formatToTwd(r.totalAmount, r.manualTwdAmount).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium mt-0.5 opacity-60">
                            ¥ {r.totalAmount.toLocaleString()}
                          </div>
                        </div>
                      </Link>
                      
                      <button 
                        onClick={(e) => handleDeleteReceipt(r.id, e)}
                        disabled={isDeleting === r.id}
                        className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-gray-700 text-gray-400 hover:text-red-500 rounded-full shadow-md border border-gray-100 dark:border-gray-600 transition-all z-20 opacity-100"
                      >
                        <X size={10} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
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
              ) : totalReceiptsCount > 0 ? (
                <p className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.2em] text-center">已載入所有收據</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
