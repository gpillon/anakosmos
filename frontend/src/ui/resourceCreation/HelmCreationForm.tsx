import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  Package, 
  Upload, 
  Play, 
  RefreshCw, 
  ExternalLink, 
  HelpCircle,
  Search,
  FileText,
  GitCompare,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { clsx } from 'clsx';
import Editor, { DiffEditor } from '@monaco-editor/react';
import type { KubeClient } from '../../api/kubeClient';
import { Combobox } from '../resources/shared/Combobox';
import { InputField } from './shared';

interface HelmCreationFormProps {
  client: KubeClient | null;
  setError: (error: string) => void;
  setStatusMessage: (message: string | null) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  namespaces: string[];
}

// localStorage keys
const HELM_REPO_STORAGE_KEY = 'helm-install-repos';

interface StoredRepoData {
  url: string;
  lastChart?: string;
}

function getStoredRepoData(): StoredRepoData | null {
  try {
    const stored = localStorage.getItem(HELM_REPO_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredRepoData;
    }
  } catch {
    // ignore
  }
  return null;
}

function storeRepoData(data: StoredRepoData): void {
  try {
    localStorage.setItem(HELM_REPO_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

type InstallMode = 'repo' | 'upload';
type ValuesViewMode = 'edit' | 'defaults' | 'compare';

export const HelmCreationForm: React.FC<HelmCreationFormProps> = ({
  client,
  setError,
  setStatusMessage,
  isSubmitting,
  setIsSubmitting,
  namespaces,
}) => {
  const [mode, setMode] = useState<InstallMode>('repo');
  
  // Common fields
  const [namespace, setNamespace] = useState('default');
  const [releaseName, setReleaseName] = useState('my-release');
  const [valuesYaml, setValuesYaml] = useState('# Your custom values\n# Copy from defaults and modify as needed\n');
  
  // Repo mode fields
  const [repoUrl, setRepoUrl] = useState('https://charts.bitnami.com/bitnami');
  const [chart, setChart] = useState('');
  const [version, setVersion] = useState('');
  const [repoCharts, setRepoCharts] = useState<Array<{ name: string; versions: string[]; latest?: string }>>([]);
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  
  // Chart defaults
  const [defaultValues, setDefaultValues] = useState('');
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  
  // Upload mode
  const [chartFile, setChartFile] = useState<File | null>(null);
  
  // View mode for values
  const [valuesViewMode, setValuesViewMode] = useState<ValuesViewMode>('defaults');
  
  // Help tooltip
  const [showHelp, setShowHelp] = useState(false);
  
  // Copy feedback
  const [copied, setCopied] = useState(false);

  // Load stored repo URL on mount
  useEffect(() => {
    const stored = getStoredRepoData();
    if (stored?.url) {
      setRepoUrl(stored.url);
    }
  }, []);

  // Chart options for combobox
  const chartOptions = useMemo(() => 
    repoCharts.map(c => c.name),
    [repoCharts]
  );

  // Version options for current chart
  const versionOptions = useMemo(() => {
    const chartData = repoCharts.find(c => c.name === chart);
    return chartData?.versions || [];
  }, [repoCharts, chart]);

  // Check if user has customizations
  const hasCustomValues = useMemo(() => {
    const trimmed = valuesYaml.trim();
    // Remove comments and check if there's actual content
    const withoutComments = trimmed.split('\n').filter(line => !line.trim().startsWith('#')).join('\n').trim();
    return withoutComments.length > 0;
  }, [valuesYaml]);

  const fetchRepoIndex = useCallback(async () => {
    if (!client || !repoUrl.trim()) return;
    setLoadingRepo(true);
    setRepoError(null);
    try {
      const result = await client.fetchHelmRepoIndex(repoUrl.trim());
      setRepoCharts(result.charts || []);
      
      // Store for future use
      storeRepoData({ url: repoUrl.trim(), lastChart: chart });
      
      if (result.charts.length > 0) {
        // If no chart selected, select first one
        if (!chart) {
          const firstChart = result.charts[0];
          setChart(firstChart.name);
          setVersion(firstChart.versions[0] || '');
        } else {
          // Keep current chart if it exists in new repo
          const existingChart = result.charts.find(c => c.name === chart);
          if (!existingChart) {
            const firstChart = result.charts[0];
            setChart(firstChart.name);
            setVersion(firstChart.versions[0] || '');
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch repo index';
      setRepoError(message);
    } finally {
      setLoadingRepo(false);
    }
  }, [client, repoUrl, chart]);

  // Fetch chart default values when chart/version changes
  useEffect(() => {
    const fetchDefaults = async () => {
      if (!client || !repoUrl.trim() || !chart) {
        setDefaultValues('');
        return;
      }
      setLoadingDefaults(true);
      try {
        const result = await client.fetchHelmChartValues(repoUrl.trim(), chart, version || undefined);
        setDefaultValues(result.valuesYaml || '# No default values\n');
      } catch {
        setDefaultValues('# Failed to load default values\n');
      } finally {
        setLoadingDefaults(false);
      }
    };

    fetchDefaults();
  }, [client, repoUrl, chart, version]);

  // Handle chart selection
  const handleChartChange = (newChart: string) => {
    setChart(newChart);
    const chartData = repoCharts.find(c => c.name === newChart);
    if (chartData) {
      setVersion(chartData.versions[0] || '');
    }
    // Update stored data
    storeRepoData({ url: repoUrl.trim(), lastChart: newChart });
    // Reset to defaults view when changing chart
    setValuesViewMode('defaults');
  };

  const handleCopyDefaults = async () => {
    try {
      await navigator.clipboard.writeText(defaultValues);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleUseDefaults = () => {
    setValuesYaml(defaultValues);
    setValuesViewMode('edit');
  };

  const handleInstall = async () => {
    if (!client) return;
    
    if (mode === 'repo' && !chart) {
      setError('Please select a chart to install.');
      return;
    }
    if (mode === 'upload' && !chartFile) {
      setError('Please upload a chart archive (.tgz).');
      return;
    }
    if (!releaseName.trim()) {
      setError('Please provide a release name.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      if (mode === 'repo') {
        await client.installHelmFromRepo({
          namespace,
          releaseName: releaseName.trim(),
          repoUrl: repoUrl.trim(),
          chart,
          version: version || undefined,
          valuesYaml: valuesYaml || undefined,
        });
      } else {
        await client.installHelmFromUpload({
          namespace,
          releaseName: releaseName.trim(),
          chartFile: chartFile!,
          valuesYaml: valuesYaml || undefined,
        });
      }
      setStatusMessage(`Helm release "${releaseName}" installed successfully`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to install Helm chart';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCompare = defaultValues && !loadingDefaults;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Package size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Install Helm Chart</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Install a chart from a repository or upload a .tgz archive
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-1 mt-4 p-1 bg-slate-800/50 rounded-lg w-fit border border-slate-700/50">
          <button
            onClick={() => setMode('repo')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all',
              mode === 'repo'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Search size={14} />
            From Repository
          </button>
          <button
            onClick={() => setMode('upload')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all',
              mode === 'upload'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Upload size={14} />
            Upload Archive
          </button>
        </div>
      </div>

      {/* Common Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Namespace</label>
          <Combobox
            value={namespace}
            onChange={setNamespace}
            options={namespaces}
            placeholder="Select namespace..."
            allowCustom
            size="sm"
          />
        </div>
        <InputField
          label="Release Name"
          value={releaseName}
          onChange={setReleaseName}
          placeholder="my-release"
        />
      </div>

      {/* Repo Mode */}
      {mode === 'repo' && (
        <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-4 space-y-4">
          {/* Repo URL */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-xs text-slate-400">Repository URL</label>
                <div className="relative">
                  <button
                    onClick={() => setShowHelp(!showHelp)}
                    className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <HelpCircle size={12} />
                  </button>
                  {showHelp && (
                    <div className="absolute left-0 top-full mt-1 w-64 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 text-xs text-slate-300">
                      <p className="mb-2">Enter a Helm chart repository URL.</p>
                      <p className="text-slate-400">Common repos:</p>
                      <ul className="text-slate-400 mt-1 space-y-0.5">
                        <li>• Bitnami: charts.bitnami.com/bitnami</li>
                        <li>• Prometheus: prometheus-community.github.io/helm-charts</li>
                      </ul>
                      <button 
                        onClick={() => setShowHelp(false)}
                        className="absolute top-1 right-1 p-1 text-slate-500 hover:text-slate-300"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://charts.bitnami.com/bitnami"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              onClick={fetchRepoIndex}
              disabled={loadingRepo || !repoUrl.trim()}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                loadingRepo || !repoUrl.trim()
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              )}
            >
              {loadingRepo ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <ExternalLink size={14} />
              )}
              {loadingRepo ? 'Fetching...' : 'Fetch Charts'}
            </button>
          </div>
          {repoError && (
            <p className="text-xs text-red-400">{repoError}</p>
          )}

          {/* Chart & Version Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Chart</label>
              <Combobox
                value={chart}
                onChange={handleChartChange}
                options={chartOptions}
                placeholder={repoCharts.length === 0 ? 'Fetch repo first...' : 'Search charts...'}
                size="sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Version</label>
              <Combobox
                value={version}
                onChange={setVersion}
                options={versionOptions}
                placeholder={versionOptions.length === 0 ? 'Select chart first...' : 'Latest'}
                size="sm"
              />
            </div>
          </div>

          {/* Chart info badge */}
          {chart && repoCharts.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                {chart}
              </span>
              {version && (
                <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700">
                  v{version}
                </span>
              )}
              <span className="text-slate-500">
                {versionOptions.length} version{versionOptions.length !== 1 ? 's' : ''} available
              </span>
            </div>
          )}
        </div>
      )}

      {/* Upload Mode */}
      {mode === 'upload' && (
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-700 rounded-xl p-8 bg-slate-900/30 text-slate-400 cursor-pointer hover:border-slate-500 hover:bg-slate-900/50 transition-all">
          <Upload size={32} className="text-slate-500" />
          <div className="text-center">
            <span className="text-sm font-medium text-slate-300">
              {chartFile ? chartFile.name : 'Drop .tgz chart or click to upload'}
            </span>
            {!chartFile && (
              <p className="text-xs text-slate-500 mt-1">
                Supports Helm chart archives (.tgz)
              </p>
            )}
          </div>
          <input
            type="file"
            accept=".tgz"
            className="hidden"
            onChange={(e) => setChartFile(e.target.files?.[0] || null)}
          />
        </label>
      )}

      {/* Values Section - with view mode tabs */}
      <div className="flex-1 min-h-0 flex flex-col bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 px-3 py-2 bg-slate-900/50 border-b border-slate-800">
          <button
            onClick={() => setValuesViewMode('defaults')}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              valuesViewMode === 'defaults'
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <Layers size={12} />
            Chart Defaults
          </button>
          <button
            onClick={() => setValuesViewMode('edit')}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              valuesViewMode === 'edit'
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <FileText size={12} />
            Your Values
            {hasCustomValues && valuesViewMode !== 'edit' && (
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            )}
          </button>
          <button
            onClick={() => setValuesViewMode('compare')}
            disabled={!canCompare}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              valuesViewMode === 'compare'
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : canCompare
                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  : "text-slate-600 cursor-not-allowed"
            )}
            title={!canCompare ? "Select a chart to enable comparison" : ""}
          >
            <GitCompare size={12} />
            Compare
          </button>

          <div className="flex-1" />

          {/* Actions based on view mode */}
          {valuesViewMode === 'defaults' && defaultValues && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyDefaults}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleUseDefaults}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded transition-colors border border-amber-500/30"
              >
                Use as Base
              </button>
            </div>
          )}

          {loadingDefaults && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <RefreshCw size={12} className="animate-spin" />
              Loading...
            </span>
          )}
        </div>

        {/* View Mode Description */}
        <div className="px-3 py-1.5 bg-slate-900/30 border-b border-slate-800/50">
          {valuesViewMode === 'defaults' && (
            <p className="text-xs text-slate-500">
              <span className="text-amber-400">Chart Defaults</span> — All available configuration options. 
              Click "Use as Base" to copy these to your values and customize.
            </p>
          )}
          {valuesViewMode === 'edit' && (
            <p className="text-xs text-slate-500">
              <span className="text-sky-400">Your Values</span> — Your custom configuration. 
              Only include values you want to override. Empty = use chart defaults.
            </p>
          )}
          {valuesViewMode === 'compare' && (
            <p className="text-xs text-slate-500">
              <span className="text-purple-400">Compare</span> — Side-by-side: chart defaults (left) vs your values (right).
            </p>
          )}
        </div>

        {/* Editor Area */}
        <div className="flex-1 min-h-[250px]">
          {valuesViewMode === 'defaults' && (
            !chart ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Layers size={40} className="text-slate-600 mb-3" />
                <p className="text-sm text-slate-400 mb-1">No chart selected</p>
                <p className="text-xs text-slate-500">Select a chart above to view its default values</p>
              </div>
            ) : loadingDefaults ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw size={24} className="animate-spin text-slate-500" />
                <span className="ml-2 text-slate-400">Loading chart defaults...</span>
              </div>
            ) : (
              <Editor
                height="100%"
                defaultLanguage="yaml"
                value={defaultValues}
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
                  readOnly: true,
                  padding: { top: 8, bottom: 8 },
                }}
              />
            )
          )}

          {valuesViewMode === 'edit' && (
            <Editor
              height="100%"
              defaultLanguage="yaml"
              value={valuesYaml}
              onChange={(value) => setValuesYaml(value || '')}
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
                padding: { top: 8, bottom: 8 },
              }}
            />
          )}

          {valuesViewMode === 'compare' && (
            canCompare ? (
              <DiffEditor
                height="100%"
                language="yaml"
                original={defaultValues}
                modified={valuesYaml}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
                  wordWrap: 'on',
                  automaticLayout: true,
                  lineNumbers: 'on',
                  renderSideBySide: true,
                  readOnly: true,
                  originalEditable: false,
                  padding: { top: 8, bottom: 8 },
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <GitCompare size={40} className="text-slate-600 mb-3" />
                <p className="text-sm text-slate-400 mb-1">Comparison not available</p>
                <p className="text-xs text-slate-500">Select a chart to compare values</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {mode === 'repo' && chart && (
            <>
              <span>Installing: <span className="text-slate-300">{chart}</span></span>
              {version && <span className="text-slate-300">v{version}</span>}
            </>
          )}
          {mode === 'upload' && chartFile && (
            <span>File: <span className="text-slate-300">{chartFile.name}</span></span>
          )}
        </div>
        <button
          onClick={handleInstall}
          disabled={isSubmitting || (mode === 'repo' && !chart) || (mode === 'upload' && !chartFile)}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
            isSubmitting || (mode === 'repo' && !chart) || (mode === 'upload' && !chartFile)
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
          )}
        >
          <Play size={14} />
          {isSubmitting ? 'Installing...' : 'Install Chart'}
        </button>
      </div>
    </div>
  );
};
