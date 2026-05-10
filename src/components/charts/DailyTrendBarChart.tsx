import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export type BarChartData = {
  date: string;
  amount: number;
  jpy?: number;
};

interface DailyTrendBarChartProps {
  data: BarChartData[];
  height?: number;
  valuePrefix?: string;
  barColor?: string;
  fontSize?: number;
  showTooltip?: boolean;
}

export default function DailyTrendBarChart({
  data,
  height = 160,
  valuePrefix = 'NT$',
  barColor = 'var(--color-primary)',
  fontSize = 9,
  showTooltip = true
}: DailyTrendBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400">
        <p className="text-xs font-medium">尚無趨勢資料</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} minWidth={0} debounce={100}>
        <BarChart data={data}>
          <XAxis 
            dataKey="date" 
            tick={{fontSize, fill: '#9ca3af'}} 
            axisLine={false} 
            tickLine={false} 
            dy={10}
          />
          {showTooltip && (
            <Tooltip 
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)', 
                fontSize: '11px', 
                fontWeight: 'bold',
                padding: '8px 12px'
              }}
              cursor={{fill: 'rgba(0,0,0,0.02)'}}
              formatter={(val: any) => [`${valuePrefix} ${Number(val).toLocaleString()}`, '金額']}
            />
          )}
          <Bar 
            dataKey="amount" 
            fill={barColor} 
            radius={[6, 6, 0, 0]} 
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
