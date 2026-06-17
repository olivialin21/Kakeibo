import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TrendingUp, TrendingDown, ShoppingBag, CalendarDays, BarChart2, FileText, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CategoryPieChart from '../components/charts/CategoryPieChart';
import type { PieChartData } from '../components/charts/CategoryPieChart';
import DailyTrendBarChart from '../components/charts/DailyTrendBarChart';
import type { BarChartData } from '../components/charts/DailyTrendBarChart';
import { Link } from 'react-router-dom';
import { Search, X, Download } from 'lucide-react';

export default function Charts() {
  const receipts = useLiveQuery(() => db.receipts.toArray()) || [];
  const receiptItems = useLiveQuery(() => db.receiptItems.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const [activeTab, setActiveTab] = useState<'visual' | 'report'>('visual');
  const [filterType, setFilterType] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const availableMonths = Array.from(new Set(
    receipts.map(r => {
      const d = new Date(r.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })
  )).sort().reverse();

  if (availableMonths.length === 0) {
    availableMonths.push(selectedMonth);
  } else if (!availableMonths.includes(selectedMonth) && receipts.length > 0) {
    setSelectedMonth(availableMonths[0]);
  }

  const filteredReceipts = receipts.filter(r => {
    const d = new Date(r.date);
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    if (filterType === 'month') {
      return dStr.startsWith(selectedMonth);
    } else {
      if (startDate && dStr < startDate) return false;
      if (endDate && dStr > endDate) return false;
      return true;
    }
  });

  const filteredReceiptIds = new Set(filteredReceipts.map(r => r.id));
  const filteredReceiptItems = receiptItems.filter(item => filteredReceiptIds.has(item.receiptId));

  const totalJPY = filteredReceipts.reduce((s, r) => s + r.totalAmount, 0);
  const totalEstTWD = filteredReceipts.reduce((s, r) => s + (r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21)), 0);
  const avgPerReceipt = filteredReceipts.length > 0 ? Math.round(totalJPY / filteredReceipts.length) : 0;

  let prevTotal = 0;
  let changePercent = 0;
  if (filterType === 'month') {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
    const prevReceipts = receipts.filter(r => {
      const d = new Date(r.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === prevMonth;
    });
    prevTotal = prevReceipts.reduce((s, r) => s + (r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21)), 0);
    changePercent = prevTotal > 0 ? Math.round(((totalEstTWD - prevTotal) / prevTotal) * 100) : 0;
  }

  const categoryTotals: Record<string, { jpy: number; twd: number; count: number }> = {};
  filteredReceiptItems.forEach(item => {
    const receipt = filteredReceipts.find(r => r.id === item.receiptId);
    if (!receipt) return;
    if (!categoryTotals[item.categoryId]) {
      categoryTotals[item.categoryId] = { jpy: 0, twd: 0, count: 0 };
    }
    const entry = categoryTotals[item.categoryId];
    const itemTotal = (item.finalPrice ?? item.originalPrice) * item.quantity;
    entry.count += item.quantity;
    entry.jpy += itemTotal;

    if (receipt.totalAmount > 0) {
      const receiptTWD = receipt.manualTwdAmount ?? Math.round(receipt.totalAmount * 0.21);
      const proportion = itemTotal / receipt.totalAmount;
      entry.twd += receiptTWD * proportion;
    } else {
      entry.twd += itemTotal * 0.21;
    }
  });

  const pieData: PieChartData[] = Object.entries(categoryTotals).map(([catId, data]) => {
    const cat = categories.find(c => c.id === catId);
    return {
      name: cat?.name || '未分類',
      value: Math.round(data.twd),
      displayValue: data.jpy,
      count: data.count,
      color: cat?.color || '#a8a29e'
    };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const totalPieValue = pieData.reduce((s, d) => s + d.value, 0);

  const dateTotals: Record<string, { jpy: number; twd: number }> = {};
  filteredReceipts.forEach(r => {
    const d = new Date(r.date);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    if (!dateTotals[dateStr]) dateTotals[dateStr] = { jpy: 0, twd: 0 };

    dateTotals[dateStr].jpy += r.totalAmount;
    dateTotals[dateStr].twd += r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21);
  });

  const barData: BarChartData[] = Object.entries(dateTotals)
    .sort((a, b) => {
      const [m1, d1] = a[0].split('/').map(Number);
      const [m2, d2] = b[0].split('/').map(Number);
      return m1 !== m2 ? m1 - m2 : d1 - d2;
    })
    .map(([date, data]) => ({
      date,
      amount: Math.round(data.twd),
      jpy: data.jpy
    }));

  // Report Specific Calculations
  const totalTax8 = filteredReceipts.reduce((s, r) => s + (r.tax8Amount || 0), 0);
  const totalTax10 = filteredReceipts.reduce((s, r) => s + (r.tax10Amount || 0), 0);
  const avgExchangeRate = totalEstTWD / (totalJPY || 1);

  // Filter receipts for the selected category list
  const categoryReceipts = useMemo(() => {
    if (!selectedCategory) return [];
    const cat = categories.find(c => c.name === selectedCategory);
    if (!cat) return [];
    
    // Get all receipt items in the filtered time range that match this category
    const itemsInCat = filteredReceiptItems.filter(item => item.categoryId === cat.id);
    const receiptIdsInCat = new Set(itemsInCat.map(i => i.receiptId));
    
    return filteredReceipts.filter(r => receiptIdsInCat.has(r.id)).sort((a, b) => b.date - a.date);
  }, [selectedCategory, categories, filteredReceiptItems, filteredReceipts]);

  const exportToCSV = () => {
    let csvContent = "\uFEFF"; // BOM for Excel UTF-8 compatibility
    const headers = ["日期", "商店名稱", "分類", "項目名稱", "單價(日圓)", "數量", "項目總額(日圓)", "整筆收據總額(日圓)", "預估台幣(整筆)"];
    csvContent += headers.join(",") + "\n";

    filteredReceipts.forEach(receipt => {
      const d = new Date(receipt.date);
      const dateStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      const shopName = `"${(receipt.shopName || '').replace(/"/g, '""')}"`;
      const receiptTWD = receipt.manualTwdAmount ?? Math.round(receipt.totalAmount * 0.21);
      
      const items = filteredReceiptItems.filter(i => i.receiptId === receipt.id);
      
      if (items.length === 0) {
        csvContent += `${dateStr},${shopName},未分類,無項目,0,0,0,${receipt.totalAmount},${receiptTWD}\n`;
      } else {
        items.forEach(item => {
          const cat = categories.find(c => c.id === item.categoryId);
          const catName = `"${(cat?.name || '未分類').replace(/"/g, '""')}"`;
          const itemName = `"${(item.name || '').replace(/"/g, '""')}"`;
          const actualPrice = item.finalPrice ?? item.originalPrice;
          const itemTotal = actualPrice * item.quantity;
          
          csvContent += `${dateStr},${shopName},${catName},${itemName},${actualPrice},${item.quantity},${itemTotal},${receipt.totalAmount},${receiptTWD}\n`;
        });
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = filterType === 'month' ? `財務報表_${selectedMonth}.csv` : `財務報表_${startDate || 'start'}至${endDate || 'end'}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 relative">
      {/* Header & Filter Settings */}
      <div className="flex flex-col space-y-4 px-1">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100">財務分析</h2>
          <div className="flex space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-full">
            <button 
              onClick={() => setFilterType('month')}
              className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${filterType === 'month' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500'}`}
            >
              月份
            </button>
            <button 
              onClick={() => setFilterType('custom')}
              className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${filterType === 'custom' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500'}`}
            >
              自訂區間
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <AnimatePresence mode="wait">
          {filterType === 'month' ? (
            <motion.div 
              key="month-filter"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center space-x-2"
            >
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2.5 rounded-[1rem] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm font-bold outline-none shadow-sm text-primary focus:ring-2 focus:ring-primary/20"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m.replace('-', '年')}月</option>
                ))}
              </select>
            </motion.div>
          ) : (
            <motion.div 
              key="custom-filter"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center space-x-2"
            >
              <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[1rem] p-1 flex items-center shadow-sm">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-transparent border-none text-[11px] font-bold text-gray-700 dark:text-gray-300 outline-none px-2"
                />
                <span className="text-gray-300 mx-1">-</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-transparent border-none text-[11px] font-bold text-gray-700 dark:text-gray-300 outline-none px-2"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl mt-2">
          <button
            onClick={() => setActiveTab('visual')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'visual' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-400'}`}
          >
            <BarChart2 size={14} />
            <span>趨勢分析</span>
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'report' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-400'}`}
          >
            <FileText size={14} />
            <span>總結報表</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'visual' ? (
          <motion.div
            key="visual"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-2xl p-5 shadow-sm col-span-2 border border-gray-100 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <ShoppingBag size={14} className="text-primary opacity-70" />
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">區間預估支出 (台幣)</span>
                  </div>
                  {filterType === 'month' && prevTotal > 0 && (
                    <div className={`flex items-center space-x-1 text-[10px] font-bold ${changePercent > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {changePercent > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      <span>{Math.abs(changePercent)}%</span>
                    </div>
                  )}
                </div>
                <div className="text-3xl font-bold tracking-tight">NT$ {totalEstTWD.toLocaleString()}</div>
              </div>

              <div className="glass rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                <div className="flex items-center space-x-1.5 mb-2">
                  <CalendarDays size={14} className="text-primary opacity-70" />
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">收據筆數</span>
                </div>
                <div className="text-xl font-bold">{filteredReceipts.length} <span className="text-xs font-medium text-gray-400 ml-1">張</span></div>
              </div>

              <div className="glass rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                <div className="text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-widest">日圓總額</div>
                <div className="text-xl font-bold truncate">¥{totalJPY.toLocaleString()}</div>
              </div>
            </div>

            {/* Category Pie Chart */}
            <div className="glass rounded-[2rem] p-6 shadow-sm space-y-6 border border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-sm tracking-tight flex justify-between items-center">
                <span>分類支出比例</span>
                {selectedCategory && (
                  <span className="text-[9px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center">
                    已選擇：{selectedCategory}
                    <X size={10} className="ml-1 cursor-pointer" onClick={() => setSelectedCategory(null)} />
                  </span>
                )}
              </h3>
              <CategoryPieChart 
                data={pieData}
                totalLabel="總計"
                totalValue={`NT$${totalPieValue.toLocaleString()}`}
                height={200}
                selectedCategory={selectedCategory || undefined}
                onCategoryClick={(cat) => setSelectedCategory(prev => prev === cat ? null : cat)}
              />
            </div>

            {/* Daily Trend Chart */}
            <div className="glass rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-sm tracking-tight mb-6">區間每日消費趨勢</h3>
              <DailyTrendBarChart 
                data={barData}
                height={160}
              />
            </div>

            {/* Category Receipts Drill-down List */}
            <AnimatePresence>
              {selectedCategory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-4 pb-8"
                >
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-bold text-sm tracking-tight text-gray-800 dark:text-gray-200 flex items-center">
                      <Search size={14} className="mr-2 text-primary" /> {selectedCategory} 分類明細
                    </h3>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">{categoryReceipts.length} 筆</span>
                  </div>
                  
                  <div className="space-y-3">
                    {categoryReceipts.length === 0 ? (
                      <p className="text-center text-xs text-gray-400 py-4">無相關消費紀錄</p>
                    ) : (
                      categoryReceipts.map(r => (
                        <Link 
                          key={r.id} 
                          to={`/add?id=${r.id}`}
                          className="block bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-400 font-bold mb-0.5">{new Date(r.date).toLocaleDateString()}</span>
                              <span className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{r.shopName || '未命名收據'}</span>
                            </div>
                            <div className="text-right">
                              <span className="block font-black text-gray-900 dark:text-white">¥{r.totalAmount.toLocaleString()}</span>
                              <span className="block text-[9px] text-gray-400 font-bold mt-0.5 tracking-tight">NT$ {r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21).toLocaleString()}</span>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="report"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-4"
          >
            {/* General Report Card */}
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-7 border border-gray-200 dark:border-gray-800 shadow-xl shadow-gray-100/20 dark:shadow-none space-y-8">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                    {filterType === 'month' ? selectedMonth.replace('-', ' / ') : '自訂區間'} 財務報表
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Final Settlement Report</p>
                </div>
                <button 
                  onClick={exportToCSV}
                  className="flex flex-col items-center justify-center p-2.5 bg-primary/5 hover:bg-primary/10 transition-colors rounded-2xl group"
                >
                  <Download size={20} className="text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] text-primary font-bold mt-1">CSV</span>
                </button>
              </div>

              {/* Major Totals Grid */}
              <div className="grid grid-cols-2 gap-x-10 gap-y-8">
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">總支出 (日幣)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">¥{totalJPY.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">總支出 (台幣)</p>
                  <p className="text-2xl font-bold text-primary tracking-tight">NT${totalEstTWD.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest flex items-center">
                    <Info size={10} className="mr-1 opacity-50" /> 平均匯率
                  </p>
                  <p className="text-lg font-bold text-gray-700 dark:text-gray-300 tracking-tight">{avgExchangeRate.toFixed(4)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">每筆平均</p>
                  <p className="text-lg font-bold text-gray-700 dark:text-gray-300 tracking-tight">¥{avgPerReceipt.toLocaleString()}</p>
                </div>
              </div>

              {/* Tax Information Section */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 space-y-4">
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 pb-2">稅額統計 (Tax Summary)</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">8% 消費稅總額</span>
                  <span className="text-xs font-black text-gray-900 dark:text-white">¥{totalTax8.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">10% 消費稅總額</span>
                  <span className="text-xs font-black text-gray-900 dark:text-white">¥{totalTax10.toLocaleString()}</span>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div className="space-y-4">
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 pb-2">類別小計 (Category Breakdown)</p>
                <div className="space-y-3">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <div className="flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full mr-2" style={{ backgroundColor: d.color }} />
                        <span className="font-bold text-gray-700 dark:text-gray-300">{d.name}</span>
                      </div>
                      <div className="flex space-x-4">
                        <span className="font-medium text-gray-400">¥{d.displayValue?.toLocaleString()}</span>
                        <span className="font-bold text-gray-900 dark:text-white min-w-[70px] text-right">NT${d.value.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Daily Trend Chart (Minimized for Report) */}
            <div className="glass rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">區間每日花費趨勢</h3>
              <DailyTrendBarChart 
                data={barData}
                height={128}
                fontSize={8}
                showTooltip={false}
                barColor="var(--color-primary-light)"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
