import React, { useState } from 'react';
import { Layers, XCircle, Plus } from 'lucide-react';
import { Card, CardHeader, CardBody } from './Card';

interface AnnotationsCardProps {
  annotations: Record<string, string> | undefined;
  editable?: boolean;
  onAdd?: (key: string, value: string) => Promise<void>;
  onRemove?: (key: string) => Promise<void>;
  saving?: boolean;
}

export const AnnotationsCard: React.FC<AnnotationsCardProps> = ({ 
  annotations, 
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

  const isSystemAnnotation = (key: string) => 
    key.includes('kubernetes.io') || key.includes('kubectl') || key.includes('k8s.io');

  const entries = Object.entries(annotations || {});

  return (
    <Card>
      <CardHeader 
        icon={<Layers size={16} />} 
        title="Annotations"
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
          <div className="space-y-2">
            {entries.map(([key, value]) => (
              <div 
                key={key} 
                className="group flex items-start gap-2 bg-slate-800/50 p-2 rounded border border-slate-700"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-blue-400 font-mono truncate">{key}</div>
                  <div className="text-xs text-slate-300 font-mono mt-1 break-all">
                    {String(value)}
                  </div>
                </div>
                {editing && !isSystemAnnotation(key) && onRemove && (
                  <button
                    onClick={() => onRemove(key)}
                    disabled={saving}
                    className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 disabled:opacity-50"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-sm">No annotations</div>
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
