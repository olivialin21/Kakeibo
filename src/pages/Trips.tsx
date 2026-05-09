import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Calendar, MapPin, ChevronRight, Plane, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Trips() {
  const trips = useLiveQuery(() => db.trips.toArray());
  const receipts = useLiveQuery(() => db.receipts.toArray());
  
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const handleAddTrip = async () => {
    if (!name.trim()) return;
    await db.trips.add({
      id: crypto.randomUUID(),
      name: name.trim(),
      startDate: new Date(startDate).getTime(),
      description: description.trim()
    });
    setIsAdding(false);
    setName('');
    setDescription('');
  };

  const handleDeleteTrip = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('確定要刪除這趟旅行嗎？收據紀錄將保留，但會解除關聯。')) return;
    await db.transaction('rw', db.trips, db.receipts, async () => {
      await db.receipts.where('tripId').equals(id).modify({ tripId: undefined });
      await db.trips.delete(id);
    });
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">旅行群組</h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="p-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full shadow-md transition-transform active:scale-90"
        >
          <Plus size={18} />
        </button>
      </div>

      {isAdding && (
        <div className="glass p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4 mb-2 shadow-sm">
          <h3 className="text-[10px] font-semibold text-primary flex items-center space-x-2 uppercase tracking-widest">
            <Plane size={12} />
            <span>開啟新旅程</span>
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[9px] text-gray-400 font-medium uppercase mb-1 tracking-widest">旅行名稱</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
                placeholder="例如：2024 東京賞櫻"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-gray-400 font-medium uppercase mb-1 tracking-widest">出發日期</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-xs font-medium"
                />
              </div>
              <div className="flex items-end">
                <button 
                  onClick={handleAddTrip}
                  className="w-full bg-primary text-white py-2.5 rounded-xl font-medium text-xs shadow-sm active:scale-95 transition-transform"
                >
                  儲存旅行
                </button>
              </div>
            </div>
          </div>
            <button
              onClick={() => setIsAdding(false)}
              className="w-full px-6 bg-gray-50 dark:bg-gray-800 text-gray-400 py-2.5 rounded-xl text-[10px] font-medium hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              取消
            </button>
        </div>
      )}

      <div className="space-y-4">
        {trips?.length === 0 ? (
          <div className="text-center py-20 bg-gray-50/20 dark:bg-gray-800/10 rounded-3xl border border-dashed border-gray-100 dark:border-gray-800 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
              <MapPin size={24} className="text-gray-200" />
            </div>
            <p className="text-xs text-gray-400 font-medium">尚未建立任何旅行群組</p>
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {trips?.map(trip => {
                const tripReceipts = receipts?.filter(r => r.tripId === trip.id) || [];
                const jpyTotal = tripReceipts.reduce((s, r) => s + r.totalAmount, 0);
                const twdTotal = tripReceipts.reduce((s, r) => s + (r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21)), 0);

                return (
                  <motion.div 
                    key={trip.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative group"
                  >
                    <Link 
                      to={`/trips/${trip.id}`} 
                      className="glass block p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] active:scale-[0.99] transition-transform"
                    >
                      <div className="flex justify-between items-start mb-5">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 tracking-tight">{trip.name}</h3>
                          <div className="flex items-center text-[9px] font-medium text-gray-400 mt-1 uppercase tracking-widest">
                            <Calendar size={10} className="mr-1.5 opacity-50" />
                            始於 {new Date(trip.startDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-full">
                          <ChevronRight size={14} className="text-gray-300" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100/50 dark:border-gray-700/50">
                        <div className="space-y-1">
                          <p className="text-[8px] text-gray-400 font-medium uppercase tracking-widest">日幣支出</p>
                          <p className="font-semibold text-lg text-primary">¥ {jpyTotal.toLocaleString()}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] text-gray-400 font-medium uppercase tracking-widest">預估台幣</p>
                          <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">NT$ {twdTotal.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex justify-between items-center px-1">
                        <span className="text-[9px] text-gray-400 font-medium">
                          {tripReceipts.length} 筆收據
                        </span>
                        {trip.description && (
                          <span className="text-[9px] text-gray-300 italic truncate max-w-[150px]">
                            {trip.description}
                          </span>
                        )}
                      </div>
                    </Link>

                    <button 
                      onClick={(e) => handleDeleteTrip(trip.id, e)}
                      className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-gray-700 text-gray-400 hover:text-red-500 rounded-full shadow-sm border border-gray-100 dark:border-gray-600 transition-all z-20"
                    >
                      <X size={10} strokeWidth={3} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
