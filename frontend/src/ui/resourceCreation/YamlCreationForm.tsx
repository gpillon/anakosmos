import React, { useMemo, useState } from 'react';
import { FileText, Play, FileUp, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import Editor from '@monaco-editor/react';
import type { KubeClient } from '../../api/kubeClient';
import { Combobox } from '../resources/shared/Combobox';

interface YamlCreationFormProps {
  client: KubeClient | null;
  setError: (error: string) => void;
  setStatusMessage: (message: string | null) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  namespaces: string[];
}

const EXAMPLE_YAML = `# Paste your YAML here, or use the examples below
# Multiple documents can be separated by ---

apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
data:
  APP_ENV: production
  LOG_LEVEL: info
`;

export const YamlCreationForm: React.FC<YamlCreationFormProps> = ({
  client,
  setError,
  setStatusMessage,
  isSubmitting,
  setIsSubmitting,
  namespaces,
}) => {
  const [yamlContent, setYamlContent] = useState(EXAMPLE_YAML);
  const [namespace, setNamespace] = useState('default');

  // Count documents in YAML
  const documentCount = useMemo(() => {
    if (!yamlContent.trim()) return 0;
    // Split by --- and count non-empty documents
    const docs = yamlContent.split(/^---$/m).filter(doc => doc.trim().length > 0);
    return docs.length;
  }, [yamlContent]);

  const handleApply = async () => {
    if (!client) return;
    if (!yamlContent.trim()) {
      setError('Please provide YAML content.');
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await client.applyYamlBatch(yamlContent, namespace);
      setStatusMessage(`Applied ${res.applied} resource${res.applied !== 1 ? 's' : ''}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to apply YAML';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setYamlContent(content);
    };
    reader.readAsText(file);
    // Reset input so same file can be uploaded again
    event.target.value = '';
  };

  const handleClear = () => {
    setYamlContent('');
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header Section */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Apply YAML</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste or upload Kubernetes manifests. Supports multiple documents separated by <code className="bg-slate-800 px-1 rounded">---</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {documentCount > 0 && (
              <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-xs text-slate-300 border border-slate-700">
                {documentCount} document{documentCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-end gap-4 mt-4 pt-4 border-t border-slate-800/50">
          <div className="w-56">
            <label className="text-xs text-slate-400 mb-1.5 block">Default Namespace</label>
            <Combobox
              value={namespace}
              onChange={setNamespace}
              options={namespaces}
              placeholder="Select namespace..."
              allowCustom
              size="sm"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer border border-slate-700">
              <FileUp size={14} />
              Upload File
              <input
                type="file"
                accept=".yaml,.yml"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700"
              title="Clear editor"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          value={yamlContent}
          onChange={(value) => setYamlContent(value || '')}
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
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      {/* Footer / Actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Resources will be created in the specified namespace unless overridden in the manifest.
        </p>
        <button
          onClick={handleApply}
          disabled={isSubmitting || !yamlContent.trim()}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
            isSubmitting || !yamlContent.trim()
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
          )}
        >
          <Play size={14} />
          {isSubmitting ? 'Applying...' : 'Apply YAML'}
        </button>
      </div>
    </div>
  );
};
