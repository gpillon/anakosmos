import React, { useState } from 'react';
import { Tag, XCircle, Plus } from 'lucide-react';
import { Card, CardHeader, CardBody } from './Card';

interface LabelsCardProps {
  labels: Record<string, string> | undefined;
  editable?: boolean;
  onAdd?: (key: string, value: string) => Promise<void>;
  onRemove?: (key: string) => Promise<void>;
  saving?: boolean;
}

export const LabelsCard: React.FC<LabelsCardProps> = ({ 
  labels, 
  editable = false,
  onAdd,
  onRemove,
  saving 
}) => {
  const [editing, setEditing] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = async () => {
    if (!newKey.trim() || !onAdd) return;
    await onAdd(newKey, newValue);
    setNewKey('');
    setNewValue('');
  };

  const isSystemLabel = (key: string) => 
    key.includes('kubernetes.io') || key.includes('k8s.io');

  const entries = Object.entries(labels || {});

  return (
    <Card>
      <CardHeader 
        icon={<Tag size={16} />} 
        title="Labels"
        badge={
          <span className="text-xs text-slate-500 ml-2">
            ({entries.length})
          </span>
        }
        action={editable && (
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      />
      <CardBody>
        {entries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {entries.map(([key, value]) => (
              <span 
                key={key} 
                className="group flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded-lg text-xs font-mono border border-slate-700"
              >
                <span className="text-blue-400">{key}</span>
                <span className="text-slate-500">=</span>
                <span>{String(value)}</span>
                {editing && !isSystemLabel(key) && onRemove && (
                  <button
                    onClick={() => onRemove(key)}
                    disabled={saving}
                    className="ml-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    <XCircle size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-sm">No labels</div>
        )}
        
        {editing && onAdd && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={!newKey.trim() || saving}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
            >
              <Plus size={12} />
              Add
            </button>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
