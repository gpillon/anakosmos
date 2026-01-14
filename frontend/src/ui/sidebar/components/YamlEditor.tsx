import React from 'react';
import Editor from '@monaco-editor/react';
import { clsx } from 'clsx';
import { Check, AlertCircle, Download, Save } from 'lucide-react';

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  isLoading: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
}

export const YamlEditor: React.FC<YamlEditorProps> = ({ value, onChange, onApply, isLoading, feedback }) => (
  <div className="flex-1 flex flex-col h-full bg-[#1e1e1e]">
    <div className="flex items-center justify-between p-2 bg-[#252526] border-b border-[#3e3e42]">
      <div className="flex items-center gap-2 px-2 overflow-hidden flex-1">
        {feedback ? (
          <div className={clsx(
            'flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-left-2',
            feedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'
          )}>
            {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            <span className="truncate" title={feedback.message}>{feedback.message}</span>
          </div>
        ) : (
          <div className="text-xs text-slate-400">
            {isLoading ? 'Processing...' : 'YAML Editor'}
          </div>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded"
          title="Download YAML"
        >
          <Download size={14} />
        </button>
        <button
          onClick={onApply}
          disabled={isLoading}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
          title="Apply Changes"
        >
          <Save size={14} />
          {isLoading ? 'Applying...' : 'Apply'}
        </button>
      </div>
    </div>

    <div className="flex-1 relative">
      <Editor
        height="100%"
        defaultLanguage="yaml"
        value={value}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          wordWrap: 'on',
          automaticLayout: true,
          readOnly: false,
        }}
        onChange={(val) => onChange(val || '')}
      />
    </div>
  </div>
);
