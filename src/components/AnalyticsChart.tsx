import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AnalyticsChartProps {
  data: {
    title: string;
    type: string;
    data: { name: string; value: number }[];
    reference: string;
  };
}

export default function AnalyticsChart({ data }: AnalyticsChartProps) {
  if (!data || !data.data || data.data.length === 0) return null;

  return (
    <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-6 mt-6 md:mt-0 h-full flex flex-col">
      <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-1 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Data Context
      </h4>
      <h3 className="text-lg font-medium text-white mb-6 leading-snug">{data.title}</h3>
      
      <div className="flex-1 min-h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              cursor={{ fill: '#27272a', opacity: 0.4 }}
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
              itemStyle={{ color: '#10b981' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === data.data.length - 1 ? '#10b981' : '#3f3f46'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center text-[10px] font-mono text-zinc-500 tracking-wider">
        <span>SOURCE REFERENCE:</span>
        <span className="text-zinc-400 max-w-[200px] truncate">{data.reference}</span>
      </div>
    </div>
  );
}
