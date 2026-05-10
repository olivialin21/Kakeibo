import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Edit2, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80',
  '#34d399', '#2dd4bf', '#c4956a', '#9ca3af'
];

export default function Categories() {
  const categories = useLiveQuery(() => db.categories.toArray());
  const location = useLocation();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);

  // Handle FAB trigger from App.tsx
  useEffect(() => {
    if (location.state?.openAddModal) {
      setIsAdding(true);
    }
  }, [location.state]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await db.categories.add({
      id: crypto.randomUUID(),
      name: newName.trim(),
      color: newColor,
      icon: 'tag'
    });
    setIsAdding(false);
    setNewName('');
    setNewColor(COLORS[0]);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await db.categories.update(id, {
      name: editName.trim(),
      color: editColor
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('確定要刪除此分類嗎？（已使用此分類的紀錄不會被刪除，但會顯示為未分類）')) {
      await db.categories.delete(id);
    }
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">分類管理</h2>
      </div>

      {isAdding && (
        <div className="glass p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4 mb-2 shadow-sm">
          <h3 className="text-[10px] font-semibold text-primary uppercase tracking-widest">新增類別</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[9px] text-gray-400 font-medium uppercase mb-1 tracking-widest">分類名稱</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
                placeholder="例如：服飾、水電費..."
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-medium uppercase mb-2 tracking-widest">代表顏色</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-5 h-5 rounded-full transition-all ${newColor === c ? 'scale-125 ring-1 ring-offset-2 ring-primary dark:ring-offset-gray-900' : 'opacity-40 hover:opacity-100'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex space-x-2 pt-2">
            <button
              onClick={handleAdd}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl font-medium text-xs shadow-sm active:scale-95 transition-transform"
            >
              儲存分類
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-6 bg-gray-50 dark:bg-gray-800 text-gray-400 py-2.5 rounded-xl text-[10px] font-medium hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-2.5">
        <AnimatePresence mode="popLayout">
          {categories?.map(c => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative group"
            >
              {editingId === c.id ? (
                <div className="glass p-4 rounded-xl border border-primary/20 shadow-sm space-y-4">
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-medium"
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                          className={`w-4 h-4 rounded-full transition-all ${editColor === color ? 'scale-125 ring-1 ring-offset-1 ring-primary' : 'opacity-30'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 text-[10px] font-medium">取消</button>
                    <button onClick={() => handleSaveEdit(c.id)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-[10px] font-medium">儲存</button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: c.color }}>
                      <span className="text-[10px] font-bold">{c.name[0]}</span>
                    </div>
                    <span className="font-medium text-sm text-gray-800 dark:text-gray-100">{c.name}</span>
                  </div>
                  <button onClick={() => startEdit(c)} className="p-2 text-gray-200 hover:text-primary transition-colors">
                    <Edit2 size={14} />
                  </button>
                </div>
              )}

              {/* Delete button in top-right */}
              {!editingId && (
                <button
                  onClick={(e) => handleDelete(c.id, e)}
                  className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-gray-700 text-gray-400 hover:text-red-500 rounded-full shadow-sm border border-gray-100 dark:border-gray-600 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-20"
                >
                  <X size={10} strokeWidth={3} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
