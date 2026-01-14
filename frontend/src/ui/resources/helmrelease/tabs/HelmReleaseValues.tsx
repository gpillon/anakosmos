import React, { useState, useEffect } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { useClusterStore } from '../../../../store/useClusterStore';
import * as yaml from 'js-yaml';
import { 
  FileJson,
  Save,
  RefreshCw,
  AlertCircle,
  Info,
  Copy,
  Check
} from 'lucide-react';
import { clsx } from 'clsx';
import Editor from '@monaco-editor/react';

interface Props {
  resource: ClusterResource;
}

export const HelmReleaseValues: React.FC<Props> = ({ resource }) => {
  const client = useClusterStore(state => state.client);
  const [values, setValues] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch values on mount
  useEffect(() => {
    const fetchValues = async () => {
      if (!client) return;
      setLoading(true);
      setError(null);
      
      try {
        const result = await client.getHelmReleaseValues(resource.namespace, resource.name);
        if (result && result._found) {
          // Remove internal keys
          const clean = { ...result };
          delete clean._found;
          delete clean._note;
          delete clean._releaseFound;
          
          setValues(yaml.dump(clean));
        } else {
          setError('Could not load values. The release may not exist or values are empty.');
        }
      } catch (e) {
        console.error('Failed to fetch Helm values:', e);
        setError('Failed to fetch Helm release values');
      } finally {
        setLoading(false);
      }
    };

    fetchValues();
  }, [client, resource.name, resource.namespace]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(values);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  const handleApplyValues = async () => {
    if (!client) return;
    setSaving(true);
    try {
      const parsed = yaml.load(values) as Record<string, unknown>;
      const success = await client.updateHelmRelease(resource.namespace, resource.name, parsed);
      
      if (success) {
        alert('Values updated successfully! The release is being upgraded.');
      } else {
        alert('Failed to update release values. Check console for details.');
      }
    } catch (e) {
      console.error('Failed to apply values:', e);
      alert('Failed to parse YAML or apply values.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={24} />
        <span className="ml-2 text-slate-400">Loading values...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-950/30 rounded-xl border border-red-800/50 p-4 flex items-start gap-3">
          <AlertCircle className="text-red-400 shrink-0" size={20} />
          <div>
            <div className="font-semibold text-red-300">Error Loading Values</div>
            <p className="text-sm text-slate-400 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Info Banner */}
      <div className="bg-sky-950/30 border-b border-sky-800/30 px-4 py-3">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-sky-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-slate-300">
              Edit values below and click "Apply Values" to upgrade the release with new configuration.
              These values will be merged with the chart's default values.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileJson size={16} className="text-slate-400" />
          <span className="text-sm text-slate-300">values.yaml</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors border border-slate-700"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleApplyValues}
            disabled={saving}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded transition-colors",
              saving && "opacity-50 cursor-not-allowed"
            )}
          >
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            Apply Values
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-50">
        <Editor
          height="50vh"
          defaultLanguage="yaml"
          value={values}
          onChange={(value) => setValues(value || '')}
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
            renderWhitespace: 'selection'
          }}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-800 text-xs text-slate-500">
        <code>helm upgrade {resource.name} &lt;chart&gt; -f values.yaml -n {resource.namespace}</code>
      </div>
    </div>
  );
};
