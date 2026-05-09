import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, ShoppingBag, CalendarDays, BarChart2, FileText, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Charts() {
  const receipts = useLiveQuery(() => db.receipts.toArray());
  const receiptItems = useLiveQuery(() => db.receiptItems.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  const [activeTab, setActiveTab] = useState<'visual' | 'report'>('visual');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  if (!receipts || !receiptItems || !categories) return <div className="p-4">載入中...</div>;

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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === selectedMonth;
  });

  const filteredReceiptIds = new Set(filteredReceipts.map(r => r.id));
  const filteredReceiptItems = receiptItems.filter(item => filteredReceiptIds.has(item.receiptId));

  const totalJPY = filteredReceipts.reduce((s, r) => s + r.totalAmount, 0);
  const totalEstTWD = filteredReceipts.reduce((s, r) => s + (r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21)), 0);
  const avgPerReceipt = filteredReceipts.length > 0 ? Math.round(totalJPY / filteredReceipts.length) : 0;

  const [y, m] = selectedMonth.split('-').map(Number);
  const prevMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  const prevReceipts = receipts.filter(r => {
    const d = new Date(r.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === prevMonth;
  });
  const prevTotal = prevReceipts.reduce((s, r) => s + (r.manualTwdAmount ?? Math.round(r.totalAmount * 0.21)), 0);
  const changePercent = prevTotal > 0 ? Math.round(((totalEstTWD - prevTotal) / prevTotal) * 100) : 0;

  const categoryTotals: Record<string, { jpy: number; twd: number; count: number }> = {};
  filteredReceiptItems.forEach(item => {
    const receipt = filteredReceipts.find(r => r.id === item.receiptId);
    if (!receipt) return;
    if (!categoryTotals[item.categoryId]) {
      categoryTotals[item.categoryId] = { jpy: 0, twd: 0, count: 0 };
    }
    const entry = categoryTotals[item.categoryId];
    entry.count++;
    entry.jpy += item.originalPrice;
    
    if (receipt.totalAmount > 0) {
      const receiptTWD = receipt.manualTwdAmount ?? Math.round(receipt.totalAmount * 0.21);
      const proportion = item.originalPrice / receipt.totalAmount;
      entry.twd += receiptTWD * proportion;
    } else {
      entry.twd += item.originalPrice * 0.21;
    }
  });

  const pieData = Object.entries(categoryTotals).map(([catId, data]) => {
    const cat = categories.find(c => c.id === catId);
    return {
      name: cat?.name || '未分類',
      value: Math.round(data.twd),
      jpy: data.jpy,
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

  const barData = Object.entries(dateTotals)
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

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header & Month Selector */}
      <div className="flex flex-col space-y-4 px-1">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100">財務分析</h2>
          <select 
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-[11px] font-bold outline-none shadow-sm text-primary"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{m.replace('-', '年')}月</option>
            ))}
          </select>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
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
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">本月預估支出 (台幣)</span>
                  </div>
                  {prevTotal > 0 && (
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
              <h3 className="font-bold text-sm tracking-tight">分類支出比例</h3>
              {pieData.length > 0 ? (
                <>
                  <div className="h-52 relative">
                    <ResponsiveContainer width="100%" height={208}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => `NT$ ${Math.round(Number(value)).toLocaleString()}`} 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <p className="text-[9px] text-gray-400 font-bold uppercase">總計</p>
                      <p className="text-sm font-bold">NT${totalPieValue.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="grid gap-2.5">
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center bg-gray-50/50 dark:bg-gray-800/40 p-3.5 rounded-2xl border border-gray-100/50 dark:border-gray-700/50">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 mr-3.5 shadow-sm" style={{ backgroundColor: d.color }} />
                        <span className="text-[11px] font-bold flex-1 truncate">{d.name}</span>
                        <div className="text-right ml-2">
                          <div className="text-[12px] font-bold">NT$ {d.value.toLocaleString()}</div>
                          <div className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter opacity-60">
                            {totalPieValue > 0 ? Math.round((d.value / totalPieValue) * 100) : 0}% · ¥{d.jpy.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-400 py-16 text-xs font-medium">尚無記帳資料</p>
              )}
            </div>
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
                  <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{selectedMonth.replace('-', ' / ')} 財務報表</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Final Settlement Report</p>
                </div>
                <div className="p-3 bg-primary/5 rounded-2xl">
                  <FileText size={24} className="text-primary" />
                </div>
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
                        <span className="font-medium text-gray-400">¥{d.jpy.toLocaleString()}</span>
                        <span className="font-bold text-gray-900 dark:text-white min-w-[70px] text-right">NT${d.value.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Daily Trend Chart (Minimized for Report) */}
            <div className="glass rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">本月每日花費趨勢</h3>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={barData}>
                    <Bar dataKey="amount" fill="var(--color-primary)" radius={[2, 2, 0, 0]} opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
