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
  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="bg-[#0f0f0f] border border-zinc-900 rounded-sm p-6 mt-6 md:mt-0 h-full flex flex-col items-center justify-center text-center px-10">
        <span className="w-10 h-10 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-600 mb-4 bg-zinc-950">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M18 20V10M12 20V4M6 20v-6"></path></svg>
        </span>
        <p className="text-zinc-500 font-serif text-sm tracking-wide">No quantitative data available for this story.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] border border-zinc-900 rounded-sm p-6 mt-6 md:mt-0 h-full flex flex-col">
      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 mb-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-amber-500 block" />
        Data Context
      </h4>
      <h3 className="text-xl font-serif text-white mb-8 leading-snug">{data.title}</h3>
      
      <div className="flex-1 min-h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip 
              cursor={{ fill: '#1a1a1a', opacity: 0.6 }}
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}
              itemStyle={{ color: '#f59e0b' }}
            />
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {data.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === data.data.length - 1 ? '#f59e0b' : '#27272a'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 pt-4 border-t border-zinc-900 flex justify-between items-center text-[9px] font-mono text-zinc-500 tracking-[0.1em] uppercase">
        <span>SOURCE:</span>
        <span className="text-zinc-500 max-w-[200px] truncate">{data.reference}</span>
      </div>
    </div>
  );
}
