import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, ShoppingBag, CalendarDays } from 'lucide-react';

export default function Charts() {
  const receipts = useLiveQuery(() => db.receipts.toArray());
  const receiptItems = useLiveQuery(() => db.receiptItems.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

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
  const maxReceiptJPY = filteredReceipts.length > 0 ? Math.max(...filteredReceipts.map(r => r.totalAmount)) : 0;

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

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold tracking-tight">支出統計</h2>
        <select 
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium outline-none shadow-sm"
        >
          {availableMonths.map(m => (
            <option key={m} value={m}>{m.replace('-', '年')}月</option>
          ))}
        </select>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4 shadow-sm col-span-2 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-1.5">
              <ShoppingBag size={14} className="text-primary opacity-70" />
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">本月預估台幣</span>
            </div>
            {prevTotal > 0 && (
              <div className={`flex items-center space-x-1 text-[10px] font-bold ${changePercent > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {changePercent > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>{changePercent > 0 ? '+' : ''}{changePercent}%</span>
              </div>
            )}
          </div>
          <div className="text-2xl font-semibold">NT$ {totalEstTWD.toLocaleString()}</div>
        </div>
        
        <div className="glass rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-1.5 mb-1">
            <CalendarDays size={14} className="text-primary opacity-70" />
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">收據筆數</span>
          </div>
          <div className="text-lg font-semibold">{filteredReceipts.length} 筆</div>
          <div className="text-[9px] text-gray-400 mt-1 font-medium">
            平均 ¥{avgPerReceipt.toLocaleString()}
          </div>
        </div>
        
        <div className="glass rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="text-[10px] text-gray-400 font-medium mb-1 uppercase tracking-wider">日圓總額</div>
          <div className="text-lg font-semibold truncate">¥ {totalJPY.toLocaleString()}</div>
          <div className="text-[9px] text-gray-400 mt-1 truncate font-medium">
            單筆最高 ¥{maxReceiptJPY.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Category Pie Chart */}
      <div className="glass rounded-2xl p-5 shadow-sm space-y-4 border border-gray-100 dark:border-gray-800">
        <h3 className="font-semibold text-sm tracking-tight">分類支出佔比</h3>
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
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px', background: 'rgba(255,255,255,0.95)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Category detail list */}
            <div className="grid gap-2">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center bg-gray-50/50 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-100/50 dark:border-gray-700/50">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 mr-3" style={{ backgroundColor: d.color }} />
                  <span className="text-xs font-medium flex-1 truncate">{d.name}</span>
                  <div className="text-right ml-2">
                    <div className="text-xs font-semibold">NT$ {d.value.toLocaleString()}</div>
                    <div className="text-[9px] text-gray-400 font-medium uppercase tracking-tighter">
                      {totalPieValue > 0 ? Math.round((d.value / totalPieValue) * 100) : 0}% · {d.count}品
                      {d.jpy > 0 && ` · ¥${d.jpy.toLocaleString()}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-center text-gray-400 py-10 text-xs font-medium">此月份無記帳資料</p>
        )}
      </div>

      {/* Daily Bar Chart */}
      <div className="glass rounded-2xl p-5 shadow-sm space-y-4 border border-gray-100 dark:border-gray-800">
        <h3 className="font-semibold text-sm tracking-tight">每日花費趨勢</h3>
        {barData.length > 0 ? (
          <div className="h-52 relative">
            <ResponsiveContainer width="100%" height={208}>
              <BarChart data={barData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(120,113,108,0.1)" />
                <XAxis dataKey="date" tick={{fontSize: 9, fill: '#a8a29e'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 9, fill: '#a8a29e'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: 'rgba(120,113,108,0.05)'}} 
                  formatter={(value: any, name: string) => {
                    if (name === 'amount') return [`NT$ ${Number(value).toLocaleString()}`, '預估台幣'];
                    return [value, name];
                  }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px', background: 'rgba(255,255,255,0.95)' }}
                />
                <Bar dataKey="amount" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-center text-gray-400 py-10 text-xs font-medium">此月份無記帳資料</p>
        )}
      </div>
    </div>
  );
}
