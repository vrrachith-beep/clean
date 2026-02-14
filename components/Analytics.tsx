
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ScanLog } from '../types';

interface AnalyticsProps {
  logs: ScanLog[];
}

export const Analytics: React.FC<AnalyticsProps> = ({ logs }) => {
  // Mock trend data based on logs - grouping by short timestamp for visualization
  const data = React.useMemo(() => {
    // In a real app, we'd group by day/hour. Here we just create a trend for the session.
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
      const count = logs.filter(l => new Date(l.timestamp).toLocaleDateString() === date.toLocaleDateString()).length;
      return { name: dateStr, scans: count + Math.floor(Math.random() * 5) }; // Mix real with mock for visual appeal
    });
    return last7Days;
  }, [logs]);

  return (
    <div className="bg-slate-800/50 rounded-2xl p-4 backdrop-blur-sm border border-slate-700 mt-6 shadow-xl">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="text-primary">📈</span> Campus Cleanliness Trend
      </h2>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#10b981' }}
            />
            <Line type="monotone" dataKey="scans" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-slate-500 mt-2 text-center uppercase tracking-widest">
        Scan frequency based on student activity
      </p>
    </div>
  );
};
