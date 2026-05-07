import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ChevronLeft, Receipt, Calendar, ShoppingBag, PieChart } from 'lucide-react';

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const trip = useLiveQuery(() => id ? db.trips.get(id) : undefined, [id]);
  const receipts = useLiveQuery(() => id ? db.receipts.where('tripId').equals(id).reverse().toArray() : [], [id]);
  
  if (!trip || !receipts) return null;

  const totalJPY = receipts.reduce((s, r) => s + r.totalAmount, 0);
  const totalTWD = receipts.reduce((s, r) => s + (r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21)), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center space-x-3 px-1">
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

      {/* Summary Stats */}
      <div className="glass rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] relative overflow-hidden">
        <div className="absolute -top-4 -right-4 p-4 opacity-[0.02] pointer-events-none rotate-12">
          <PieChart size={100} />
        </div>
        <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-50 dark:border-gray-800 pb-2">旅行支出概覽</h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-1">
            <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider flex items-center">
              <ShoppingBag size={10} className="mr-1.5 text-primary opacity-70" /> 日幣總計
            </p>
            <p className="text-2xl font-semibold text-primary">¥ {totalJPY.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-200 mr-1.5" /> 台幣預估
            </p>
            <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">NT$ {totalTWD.toLocaleString()}</p>
          </div>
        </div>
        {trip.description && (
          <p className="mt-6 text-[11px] text-gray-400 italic border-t border-gray-50 dark:border-gray-800 pt-4 flex items-start">
            <span className="text-primary text-base leading-none mr-2 opacity-50">“</span>
            {trip.description}
          </p>
        )}
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
          <div className="space-y-3">
            {receipts.map(r => (
              <Link to={`/edit/${r.id}`} key={r.id} className="bg-white dark:bg-gray-800 flex items-center p-4 rounded-xl border border-gray-100 dark:border-gray-700 active:scale-[0.99] transition-transform shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
                <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center mr-4 shrink-0 border border-gray-50 dark:border-gray-700">
                  <Receipt size={18} className="text-gray-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-gray-800 dark:text-gray-100">{r.shopName}</p>
                  <p className="text-[9px] font-medium text-gray-300 mt-1 uppercase tracking-widest">{new Date(r.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm text-primary">¥ {r.totalAmount.toLocaleString()}</p>
                  <p className="text-[10px] font-medium text-gray-400 mt-0.5">NT$ {(r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21)).toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
