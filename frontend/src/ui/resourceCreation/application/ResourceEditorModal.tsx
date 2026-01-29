import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Save, AlertCircle, FileJson, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import Editor from '@monaco-editor/react';
import yaml from 'js-yaml';
import type { DraftResource } from '../../../store/useApplicationDraftStore';
import { KIND_CONFIG, KIND_COLOR_MAP, DEFAULT_COLOR } from '../../../config/resourceKinds';

interface ResourceEditorModalProps {
  resource: DraftResource;
  onSave: (updatedSpec: Record<string, unknown>) => void;
  onClose: () => void;
}

export const ResourceEditorModal: React.FC<ResourceEditorModalProps> = ({
  resource,
  onSave,
  onClose,
}) => {
  // Convert spec to YAML initially (memoized to avoid effect)
  const initialYaml = useMemo(() => {
    try {
      return yaml.dump(resource.spec, { noRefs: true, lineWidth: 120 });
    } catch {
      return '# Failed to serialize resource\n';
    }
  }, [resource.spec]);
  
  const [yamlContent, setYamlContent] = useState(initialYaml);
  const [error, setError] = useState<string | null>(null);
  
  // Track if content differs from initial
  const hasChanges = yamlContent !== initialYaml;
  
  const kindConfig = KIND_CONFIG.find(k => k.kind === resource.kind);
  const Icon = kindConfig?.icon;
  const color = KIND_COLOR_MAP[resource.kind] || DEFAULT_COLOR;
  
  const handleYamlChange = useCallback((value: string | undefined) => {
    setYamlContent(value || '');
    setError(null);
  }, []);
  
  const handleReset = useCallback(() => {
    setYamlContent(initialYaml);
    setError(null);
  }, [initialYaml]);
  
  const handleSave = useCallback(() => {
    try {
      const parsed = yaml.load(yamlContent) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') {
        setError('Invalid YAML: must be an object');
        return;
      }
      onSave(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse YAML');
    }
  }, [yamlContent, onSave]);
  
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleSave]);
  
  const metadata = resource.spec.metadata as Record<string, unknown> || {};
  const resourceName = String(metadata.name || 'Unnamed');
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl h-[80vh] mx-4 flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${color}20` }}
            >
              {Icon && (
                <span style={{ color }}>
                  <Icon size={18} />
                </span>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Edit {resource.kind}
              </h2>
              <p className="text-xs text-slate-400">
                {resourceName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges || !!error}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-all',
                hasChanges && !error
                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              )}
            >
              <Save size={14} />
              Save Changes
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
        
        {/* Editor info bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-800 text-xs text-slate-500">
          <FileJson size={12} />
          <span>Edit the YAML directly. Press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-400">Cmd+S</kbd> to save.</span>
        </div>
        
        {/* Editor */}
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            defaultLanguage="yaml"
            value={yamlContent}
            onChange={handleYamlChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
              wordWrap: 'on',
              automaticLayout: true,
              lineNumbers: 'on',
              tabSize: 2,
              renderWhitespace: 'selection',
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/80 text-xs text-slate-500">
          <span>
            Tip: You can edit any field in the Kubernetes resource spec
          </span>
          <span className={clsx(hasChanges ? 'text-amber-400' : 'text-slate-500')}>
            {hasChanges ? '● Unsaved changes' : 'No changes'}
          </span>
        </div>
      </div>
    </div>
  );
};
