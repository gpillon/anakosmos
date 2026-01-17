import React, { useState } from 'react';
import { 
  Key, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  X,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Card, CardHeader, CardBody } from './Card';
import { clsx } from 'clsx';

interface KeyValueDataCardProps {
  /** The data object (key-value pairs) */
  data: Record<string, string> | undefined;
  /** Title for the card */
  title?: string;
  /** Whether values are base64 encoded (for Secrets) */
  isBase64?: boolean;
  /** Whether to mask values by default (for Secrets) */
  maskValues?: boolean;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Callback when data changes */
  onUpdate?: (data: Record<string, string>) => void | Promise<void>;
  /** Empty state message */
  emptyMessage?: string;
}

export const KeyValueDataCard: React.FC<KeyValueDataCardProps> = ({
  data,
  title = 'Data',
  isBase64 = false,
  maskValues = false,
  editable = false,
  onUpdate,
  emptyMessage = 'No data'
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const entries = Object.entries(data || {});

  const toggleExpand = (key: string) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedKeys(newExpanded);
  };

  const toggleReveal = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRevealed = new Set(revealedKeys);
    if (newRevealed.has(key)) {
      newRevealed.delete(key);
    } else {
      newRevealed.add(key);
    }
    setRevealedKeys(newRevealed);
  };

  const decodeValue = (value: string): string => {
    if (!isBase64) return value;
    try {
      return atob(value);
    } catch {
      return value; // Return as-is if decode fails
    }
  };

  const encodeValue = (value: string): string => {
    if (!isBase64) return value;
    try {
      return btoa(value);
    } catch {
      return value;
    }
  };

  const copyToClipboard = async (key: string, value: string) => {
    const decodedValue = decodeValue(value);
    await navigator.clipboard.writeText(decodedValue);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getDisplayValue = (key: string, value: string): string => {
    const decoded = decodeValue(value);
    if (maskValues && !revealedKeys.has(key)) {
      return '•'.repeat(Math.min(decoded.length, 20));
    }
    return decoded;
  };

  const isMultiline = (value: string): boolean => {
    const decoded = decodeValue(value);
    return decoded.includes('\n') || decoded.length > 100;
  };

  // Edit handlers
  const startEdit = (key: string, value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(key);
    setEditValue(decodeValue(value));
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editing || !onUpdate || !data) return;
    setSaving(true);
    try {
      const newData = { ...data };
      newData[editing] = encodeValue(editValue);
      await onUpdate(newData);
      setEditing(null);
      setEditValue('');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !onUpdate) return;
    setSaving(true);
    try {
      const newData = { ...(data || {}) };
      newData[newKey.trim()] = encodeValue(newValue);
      await onUpdate(newData);
      setAdding(false);
      setNewKey('');
      setNewValue('');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete key "${key}"?`) || !onUpdate || !data) return;
    setSaving(true);
    try {
      const newData = { ...data };
      delete newData[key];
      await onUpdate(newData);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader 
        icon={<Key size={16} />} 
        title={title}
        badge={<span className="text-xs text-slate-500 ml-2">({entries.length} keys)</span>}
        action={editable && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <Plus size={12} />
            Add Key
          </button>
        )}
      />
      <CardBody className="space-y-2">
        {/* Add Key Form */}
        {adding && (
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 space-y-3 mb-4">
            <div className="text-xs font-medium text-blue-400">New Key</div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Key name"
                className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value"
                className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setAdding(false); setNewKey(''); setNewValue(''); }}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !newKey.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center gap-2"
              >
                {saving && <RefreshCw className="animate-spin" size={10} />}
                Add
              </button>
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <FileText size={32} className="mx-auto mb-3 opacity-50" />
            <div className="text-sm">{emptyMessage}</div>
          </div>
        ) : (
          <div className="space-y-1">
            {entries.map(([key, value]) => {
              const isExpanded = expandedKeys.has(key);
              const isRevealed = revealedKeys.has(key);
              const multiline = isMultiline(value);
              const displayValue = getDisplayValue(key, value);
              const isEditing = editing === key;

              return (
                <div 
                  key={key}
                  className={clsx(
                    "rounded-lg border transition-colors",
                    isEditing 
                      ? "bg-blue-900/20 border-blue-800/50" 
                      : "bg-slate-800/30 border-slate-700/50 hover:border-slate-600"
                  )}
                >
                  {/* Key Header */}
                  <div 
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                    onClick={() => multiline && toggleExpand(key)}
                  >
                    {multiline && (
                      isExpanded 
                        ? <ChevronDown size={14} className="text-slate-500 shrink-0" />
                        : <ChevronRight size={14} className="text-slate-500 shrink-0" />
                    )}
                    <Key size={12} className="text-amber-400 shrink-0" />
                    <span className="font-mono text-sm text-amber-300 truncate">{key}</span>
                    
                    <div className="flex-1" />

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {maskValues && (
                        <button
                          onClick={(e) => toggleReveal(key, e)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300"
                          title={isRevealed ? "Hide value" : "Show value"}
                        >
                          {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(key, value); }}
                        className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300"
                        title="Copy value"
                      >
                        {copiedKey === key ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                      {editable && !isEditing && (
                        <>
                          <button
                            onClick={(e) => startEdit(key, value, e)}
                            className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-blue-400"
                            title="Edit"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(key); }}
                            className="p-1 hover:bg-red-900/50 rounded text-slate-500 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Value */}
                  {isEditing ? (
                    <div className="px-3 pb-3 space-y-2">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500 min-h-[100px]"
                        rows={5}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded flex items-center gap-1"
                        >
                          <X size={10} />
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center gap-2"
                        >
                          {saving ? <RefreshCw className="animate-spin" size={10} /> : <Check size={10} />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : multiline && isExpanded ? (
                    <div className="px-3 pb-3">
                      <pre className="bg-slate-900/50 rounded p-3 text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto custom-scrollbar">
                        {displayValue}
                      </pre>
                    </div>
                  ) : !multiline ? (
                    <div className="px-3 pb-2 pl-8">
                      <span className={clsx(
                        "text-xs font-mono",
                        maskValues && !isRevealed ? "text-slate-600" : "text-slate-400"
                      )}>
                        {displayValue.substring(0, 100)}{displayValue.length > 100 && '...'}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
