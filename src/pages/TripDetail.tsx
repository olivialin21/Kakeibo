import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ChevronLeft, Receipt, Calendar, ShoppingBag, PieChart as PieChartIcon, X, TrendingUp, BarChart2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const trip = useLiveQuery(() => id ? db.trips.get(id) : undefined, [id]);
  const receipts = useLiveQuery(() => id ? db.receipts.where('tripId').equals(id).reverse().toArray() : [], [id]);
  
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Hooks must be at the top level
  const categories = useLiveQuery(() => db.categories.toArray());
  const receiptItems = useLiveQuery(() => db.receiptItems.toArray());

  if (!trip || !receipts) return null;

  const totalJPY = receipts.reduce((s, r) => s + r.totalAmount, 0);
  const totalTWD = receipts.reduce((s, r) => s + (r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21)), 0);
  
  // Trip Analysis Data
  // Calculate category distribution for this trip
  const categoryData = categories && receipts && receiptItems ? categories.map(cat => {
    const tripReceiptIds = new Set(receipts.map(r => r.id));
    const catItems = receiptItems.filter(item => item.categoryId === cat.id && tripReceiptIds.has(item.receiptId));
    const total = catItems.reduce((s, i) => s + i.originalPrice, 0);
    return { name: cat.name, value: total, color: cat.color };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value) : [];

  // Calculate daily spending
  const dailyData: Record<string, number> = {};
  receipts?.forEach(r => {
    const d = new Date(r.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    dailyData[d] = (dailyData[d] || 0) + r.totalAmount;
  });
  const barData = Object.entries(dailyData).map(([date, amount]) => ({ date, amount }));

  // Report Stats
  const daysCount = Math.max(1, Math.ceil((new Date().getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)));
  const dailyAvg = Math.round(totalJPY / daysCount);
  const maxExpense = receipts.length > 0 ? Math.max(...receipts.map(r => r.totalAmount)) : 0;

  // Group receipts by date for consistent UI with Home page
  const groupedReceipts: Record<string, typeof receipts> = {};
  receipts?.forEach(r => {
    const dateKey = new Date(r.date).toLocaleDateString('zh-TW', { 
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' 
    });
    if (!groupedReceipts[dateKey]) groupedReceipts[dateKey] = [];
    groupedReceipts[dateKey]!.push(r);
  });

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
      // Unlink receipts instead of deleting them
      await db.receipts.where('tripId').equals(id).modify({ tripId: undefined });
      await db.trips.delete(id);
    });
    
    navigate('/trips');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-3">
          <Link to="/trips" className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform">
            <ChevronLeft size={18} className="text-gray-500 dark:text-gray-400" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">{trip.name}</h2>
            <p className="text-[9px] font-medium text-gray-400 flex items-center uppercase tracking-widest mt-0.5">
              <Calendar size={10} className="mr-1.5 opacity-50" />
              始於 {new Date(trip.startDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleDeleteTrip}
          className="p-2 text-gray-300 hover:text-red-500 active:scale-90 transition-all"
        >
          <Trash2 size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Settlement Report Card */}
      <div className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-gray-800 p-7 border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">旅行結算報表</h3>
          <div className="px-3 py-1 bg-primary/5 text-primary rounded-full text-[9px] font-bold">
            {receipts.length} 筆消費
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

      {/* Visual Analytics Section (The new part) */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center">
            <PieChartIcon size={12} className="mr-2" /> 支出分布 (類別)
          </h4>
          <div className="h-40 flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-2 max-h-32 overflow-y-auto">
              {categoryData.map((cat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-[10px] font-medium text-gray-500 truncate">{cat.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200 ml-2">¥{cat.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center">
            <BarChart2 size={12} className="mr-2" /> 每日消費趨勢
          </h4>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={barData}>
                <XAxis dataKey="date" tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px', fontWeight: 'bold' }}
                  cursor={{fill: 'rgba(0,0,0,0.02)'}}
                  formatter={(val: any) => [`¥${val.toLocaleString()}`, '金額']}
                />
                <Bar dataKey="amount" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Receipt List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-medium text-base text-gray-800 dark:text-gray-100 tracking-tight">旅行明細 ({receipts.length})</h3>
          <Link to={`/add?tripId=${id}`} className="text-[9px] font-semibold text-primary uppercase tracking-widest bg-primary/5 px-3 py-1.5 rounded-full">
            + 繼續記帳
          </Link>
        </div>
        
        {receipts.length === 0 ? (
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
                    {dayReceipts.sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`).getTime() - new Date(`${a.date}T${a.time || '00:00'}`).getTime()).map(r => (
                    <div key={r.id} className="relative group">
                      <Link to={`/edit/${r.id}`} className="bg-white dark:bg-gray-800 flex items-center p-4 rounded-2xl border border-gray-100 dark:border-gray-700 active:bg-gray-50 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-primary/20">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center mr-4 shrink-0 border border-gray-50 dark:border-gray-700 overflow-hidden shadow-inner">
                          {r.imageBlobs && r.imageBlobs.length > 0 ? (
                            <img
                              src={URL.createObjectURL(r.imageBlobs[0])}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : r.imageBlob ? (
                            <img
                              src={URL.createObjectURL(r.imageBlob)}
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
                          <div className="flex items-center space-x-2">
                            {(r.tax8Amount > 0 || r.tax10Amount > 0) && (
                              <span className="text-[7px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold uppercase tracking-tighter">
                                Tax Included
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right ml-2 shrink-0 mr-3">
                          <div className="font-semibold text-[15px] text-gray-900 dark:text-white tracking-tighter">
                            NT$ {(r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21)).toLocaleString()}
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
          </div>
        )}
      </div>
    </div>
  );
}
