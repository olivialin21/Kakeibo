import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sun, Download, Upload, ShieldCheck, Camera, RefreshCcw } from 'lucide-react';
import { exportData, importData } from '../utils/dataManagement';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  needRefresh: boolean;
  updateServiceWorker: () => void;
}

export default function Sidebar({ isOpen, onClose, isDark, setIsDark, needRefresh, updateServiceWorker }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-[280px] bg-white dark:bg-gray-900 z-[70] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-6 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">家計簿</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Settings Group */}
              <div className="space-y-2">
                <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">個人化設定</p>

                <button
                  onClick={() => setIsDark(!isDark)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-200">
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    <span className="text-sm font-medium">{isDark ? '淺色模式' : '深色模式'}</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${isDark ? 'bg-primary' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isDark ? 'left-6' : 'left-1'}`} />
                  </div>
                </button>

                <button
                  onClick={needRefresh ? updateServiceWorker : () => {
                    // Check logic - usually browsers check automatically, 
                    // but we can show a toast or just alert "Already latest"
                    if (!needRefresh) alert('目前已是最新版本！');
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${needRefresh ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-200">
                    <RefreshCcw size={18} className={needRefresh ? 'text-primary animate-spin-slow' : ''} />
                    <span className="text-sm font-medium">{needRefresh ? '有新版本可用' : '檢查更新'}</span>
                  </div>
                  {needRefresh && <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />}
                </button>
              </div>

              {/* Data Group */}
              <div className="space-y-2">
                <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-1">
                  <ShieldCheck size={10} />
                  <span>數據管理 (本地儲存)</span>
                </p>

                <div className="grid grid-cols-1 gap-1">
                  <button
                    onClick={() => exportData()}
                    className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200"
                  >
                    <Download size={18} className="text-blue-500" />
                    <span className="text-sm font-medium">匯出備份</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200"
                  >
                    <Upload size={18} className="text-green-500" />
                    <span className="text-sm font-medium">匯入還原</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".json"
                    onChange={handleImport}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
                <span>版本 1.0.0</span>
                <a
                  href="https://www.instagram.com/yushan_333_/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 hover:text-pink-500 transition-colors"
                >
                  <Camera size={12} />
                  <span>Instagram</span>
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
