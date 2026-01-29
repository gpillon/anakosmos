import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardHeader, CardBody } from '../resources/shared/Card';

/* -------------------------------------------------------------------------- */
/*                              Input Field                                   */
/* -------------------------------------------------------------------------- */

export const InputField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ label, value, onChange, placeholder, className }) => (
  <div className={className}>
    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
    />
  </div>
);

/* -------------------------------------------------------------------------- */
/*                            Label Row                                       */
/* -------------------------------------------------------------------------- */

export const LabelRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-2">
    <div className="text-xs font-bold text-slate-500 uppercase">{label}</div>
    {children}
  </div>
);

/* -------------------------------------------------------------------------- */
/*                         Key-Value Editor                                   */
/* -------------------------------------------------------------------------- */

export const KeyValueEditor: React.FC<{
  entries: Array<{ key: string; value: string }>;
  onChange: (entries: Array<{ key: string; value: string }>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}> = ({ entries, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }) => {
  const handleUpdate = (idx: number, field: 'key' | 'value', value: string) => {
    const next = entries.map((entry, index) => (index === idx ? { ...entry, [field]: value } : entry));
    onChange(next);
  };

  const handleAdd = () => onChange([...entries, { key: '', value: '' }]);
  const handleRemove = (idx: number) => onChange(entries.filter((_, index) => index !== idx));

  return (
    <div className="space-y-2">
      {entries.map((entry, idx) => (
        <div key={`${entry.key}-${idx}`} className="flex gap-2 items-center">
          <input
            value={entry.key}
            onChange={(e) => handleUpdate(idx, 'key', e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            placeholder={keyPlaceholder}
          />
          <input
            value={entry.value}
            onChange={(e) => handleUpdate(idx, 'value', e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            placeholder={valuePlaceholder}
          />
          <button onClick={() => handleRemove(idx)} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button onClick={handleAdd} className="text-xs text-blue-400 hover:text-blue-300">
        + Add entry
      </button>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                           Section Card                                     */
/* -------------------------------------------------------------------------- */

export const SectionCard: React.FC<{
  title: string;
  description: string;
  icon: React.FC<{ size?: number }>;
  enabled: boolean;
  onToggle: () => void;
  forced?: boolean;
  children: React.ReactNode;
}> = ({ title, description, icon: Icon, enabled, onToggle, forced, children }) => (
  <Card>
    <CardHeader 
      icon={<Icon size={16} />}
      title={title}
      badge={<span className="text-xs text-slate-500 ml-1">{description}</span>}
      action={!forced && (
        <button
          onClick={onToggle}
          className={clsx(
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            enabled
              ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          )}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </button>
      )}
    />
    {enabled && <CardBody className="space-y-4">{children}</CardBody>}
  </Card>
);

/* -------------------------------------------------------------------------- */
/*                        Resource Item Card                                  */
/* -------------------------------------------------------------------------- */

export const ResourceItemCard: React.FC<{
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}> = ({ title, onRemove, children, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-slate-950/50 border border-slate-700/50 rounded-lg overflow-hidden mb-4">
      <div
        className="px-4 py-2.5 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
          <span className="text-sm font-semibold text-slate-200">{title}</span>
        </div>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded hover:bg-red-900/20"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {expanded && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                           Utility Functions                                */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line react-refresh/only-export-components
export const mapToEntries = (map: Record<string, string>): Array<{ key: string; value: string }> =>
  Object.entries(map).map(([key, value]) => ({ key, value }));

// eslint-disable-next-line react-refresh/only-export-components
export const entriesToMap = (entries: Array<{ key: string; value: string }>): Record<string, string> =>
  entries.reduce<Record<string, string>>((acc, entry) => {
    if (entry.key) acc[entry.key] = entry.value;
    return acc;
  }, {});
