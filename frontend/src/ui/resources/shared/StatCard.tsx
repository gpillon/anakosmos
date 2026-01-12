import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => (
  <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-slate-800">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  </div>
);
