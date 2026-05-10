import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export interface PieChartData {
  name: string;
  value: number; // Primary value for pie slice (usually TWD or JPY)
  displayValue?: number; // Secondary value for display in legend/tooltip (usually JPY if value is TWD)
  color: string;
  count?: number;
}

interface CategoryPieChartProps {
  data: PieChartData[];
  layout?: 'vertical' | 'horizontal';
  height?: number;
  totalLabel?: string;
  totalValue?: string;
  valuePrefix?: string;
  displayValuePrefix?: string;
}

export default function CategoryPieChart({
  data,
  layout = 'vertical',
  height = 200,
  totalLabel,
  totalValue,
  valuePrefix = 'NT$',
  displayValuePrefix = '¥'
}: CategoryPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <p className="text-xs font-medium">尚無記帳資料</p>
      </div>
    );
  }

  const isHorizontal = layout === 'horizontal';
  const totalValueNum = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className={`flex ${isHorizontal ? 'flex-row items-center' : 'flex-col space-y-6'}`}>
      {/* Chart Area */}
      <div className={`relative ${isHorizontal ? 'w-1/2' : 'w-full'} flex justify-center`} style={{ height }}>
        <ResponsiveContainer width="100%" height={height} minWidth={0} debounce={100}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={height * 0.25}
              outerRadius={height * 0.35}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name: any, props: any) => {
                const item = props.payload;
                const secondaryStr = item.displayValue !== undefined 
                  ? ` (${displayValuePrefix} ${item.displayValue.toLocaleString()})` 
                  : '';
                return [`${valuePrefix} ${Math.round(Number(value)).toLocaleString()}${secondaryStr}`, name];
              }}
              contentStyle={{
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '8px 12px'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {(totalLabel || totalValue) && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            {totalLabel && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">{totalLabel}</p>}
            {totalValue && <p className="text-sm font-bold tracking-tighter">{totalValue}</p>}
          </div>
        )}
      </div>

      {/* Legend Area */}
      <div className={`${isHorizontal ? 'w-1/2 space-y-3 max-h-48 overflow-y-auto pr-1' : 'grid gap-3'}`}>
        {data.map((d, i) => {
          const percent = totalValueNum > 0 ? Math.round((d.value / totalValueNum) * 100) : 0;
          
          return (
            <div 
              key={i} 
              className={`${isHorizontal ? '' : 'bg-gray-50/50 dark:bg-gray-800/40 p-3.5 rounded-2xl border border-gray-100/50 dark:border-gray-700/50 transition-colors hover:bg-gray-100/50 dark:hover:bg-gray-800/60'}`}
            >
              <div className={`grid ${isHorizontal ? 'grid-cols-1 gap-1' : 'grid-cols-[1fr_48px_100px] items-center gap-4'}`}>
                {/* 1. Category Name & Dot */}
                <div className="flex items-center min-w-0">
                  <span 
                    className="w-2 h-2 rounded-full shrink-0 mr-2.5 shadow-sm" 
                    style={{ backgroundColor: d.color }} 
                  />
                  <span className={`font-bold text-gray-600 dark:text-gray-300 truncate ${isHorizontal ? 'text-[10px]' : 'text-[11px]'}`}>
                    {d.name}
                  </span>
                  {isHorizontal && (
                    <span className="ml-auto text-[10px] font-black text-gray-400 dark:text-gray-500">
                      {percent}%
                    </span>
                  )}
                </div>

                {/* 2. Percentage (Vertical only) */}
                {!isHorizontal && (
                  <div className="text-[12px] font-black text-gray-400 dark:text-gray-500 text-center">
                    {percent}%
                  </div>
                )}

                {/* 3. Values */}
                <div className={`${isHorizontal ? 'flex justify-between items-center ml-4' : 'text-right'}`}>
                  <div className={`${isHorizontal ? 'text-[8px] font-medium text-gray-400' : 'text-[13px] font-bold text-gray-900 dark:text-white leading-tight'}`}>
                    {isHorizontal ? `${displayValuePrefix}${d.displayValue?.toLocaleString()}` : `${valuePrefix} ${d.value.toLocaleString()}`}
                  </div>
                  {d.displayValue !== undefined && (
                    <div className={`${isHorizontal ? 'text-[9px] font-bold text-gray-900 dark:text-white' : 'text-[9px] text-primary dark:text-primary-light font-bold uppercase tracking-tighter opacity-70 mt-0.5'}`}>
                      {isHorizontal ? `${valuePrefix}${d.value.toLocaleString()}` : `${displayValuePrefix} ${d.displayValue.toLocaleString()}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
