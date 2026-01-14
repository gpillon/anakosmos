import React from 'react';
import { clsx } from 'clsx';

export type SidebarTab = 'overview' | 'events' | 'yaml';

interface SidebarTabsProps {
  active: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  tabs?: { id: SidebarTab; label: string }[];
}

const defaultTabs: { id: SidebarTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'events', label: 'Events' },
  { id: 'yaml', label: 'YAML' },
];

export const SidebarTabs: React.FC<SidebarTabsProps> = ({ active, onChange, tabs = defaultTabs }) => (
  <div className="flex border-b border-slate-700/50 px-2">
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={clsx(
          'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
          active === tab.id
            ? 'border-blue-500 text-blue-400'
            : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
        )}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
