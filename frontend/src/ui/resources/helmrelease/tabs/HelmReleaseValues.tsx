import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { useClusterStore } from '../../../../store/useClusterStore';
import * as yaml from 'js-yaml';
import { 
  FileJson,
  Save,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  GitCompare,
  FileText,
  Layers,
  ExternalLink
} from 'lucide-react';
import { clsx } from 'clsx';
import Editor, { DiffEditor } from '@monaco-editor/react';

interface Props {
  resource: ClusterResource;
}

type ViewMode = 'overrides' | 'all' | 'compare';

// localStorage keys
const REPO_URL_STORAGE_KEY = 'helm-repo-urls';

function getStoredRepoUrl(chartName: string): string {
  try {
    const stored = localStorage.getItem(REPO_URL_STORAGE_KEY);
    if (stored) {
      const urls = JSON.parse(stored) as Record<string, string>;
      return urls[chartName] || urls['_last'] || '';
    }
  } catch {
    // ignore
  }
  return '';
}

function storeRepoUrl(chartName: string, url: string): void {
  try {
    const stored = localStorage.getItem(REPO_URL_STORAGE_KEY);
    const urls = stored ? JSON.parse(stored) as Record<string, string> : {};
    urls[chartName] = url;
    urls['_last'] = url;
    localStorage.setItem(REPO_URL_STORAGE_KEY, JSON.stringify(urls));
  } catch {
    // ignore
  }
}

export const HelmReleaseValues: React.FC<Props> = ({ resource }) => {
  const client = useClusterStore(state => state.client);
  
  // Values state
  const [userOverrides, setUserOverrides] = useState<string>('');
  const [allValues, setAllValues] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('overrides');
  
  // Chart source state
  const [chartSourceExpanded, setChartSourceExpanded] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [repoCharts, setRepoCharts] = useState<Array<{ name: string; versions: string[]; latest?: string }>>([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [defaultValues, setDefaultValues] = useState('');
  const [defaultLoading, setDefaultLoading] = useState(false);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const rawSpec = resource.raw?.spec || {};
  const chartName = useMemo(() => {
    if (resource.helmRelease?.chartName) return resource.helmRelease.chartName;
    const chartRef = rawSpec.chart || '';
    if (!chartRef) return '';
    if (rawSpec.version && chartRef.endsWith(`-${rawSpec.version}`)) {
      return chartRef.slice(0, -(rawSpec.version.length + 1));
    }
    const idx = chartRef.lastIndexOf('-');
    return idx > 0 ? chartRef.slice(0, idx) : chartRef;
  }, [resource.helmRelease?.chartName, rawSpec.chart, rawSpec.version]);

  const currentChartVersion = useMemo(
    () => rawSpec.version || resource.helmRelease?.chartVersion || '',
    [rawSpec.version, resource.helmRelease?.chartVersion]
  );

  const chartVersions = useMemo(() => {
    const chartEntry = repoCharts.find(entry => entry.name === chartName);
    return chartEntry?.versions || [];
  }, [repoCharts, chartName]);

  // Load stored repo URL on mount
  useEffect(() => {
    if (chartName) {
      const storedUrl = getStoredRepoUrl(chartName);
      if (storedUrl) {
        setRepoUrl(storedUrl);
      }
    }
  }, [chartName]);

  // Fetch both user overrides and all values on mount
  useEffect(() => {
    const fetchValues = async () => {
      if (!client) return;
      setLoading(true);
      setError(null);
      
      try {
        // Fetch user-only overrides
        const userResult = await client.getHelmReleaseValues(resource.namespace, resource.name, false);
        // Fetch all computed values
        const allResult = await client.getHelmReleaseValues(resource.namespace, resource.name, true);
        
        if (userResult && userResult._found) {
          const clean = { ...userResult };
          delete clean._found;
          delete clean._note;
          delete clean._releaseFound;
          setUserOverrides(yaml.dump(clean));
        } else {
          setUserOverrides('# No custom overrides\n');
        }
        
        if (allResult && allResult._found) {
          const clean = { ...allResult };
          delete clean._found;
          delete clean._note;
          delete clean._releaseFound;
          setAllValues(yaml.dump(clean));
        } else {
          setError('Could not load values. The release may not exist.');
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

  useEffect(() => {
    if (!selectedVersion && currentChartVersion) {
      setSelectedVersion(currentChartVersion);
    }
  }, [currentChartVersion, selectedVersion]);

  // Auto-fetch repo index when repo URL is set from localStorage
  useEffect(() => {
    if (repoUrl.trim() && chartName && repoCharts.length === 0 && !repoLoading) {
      fetchRepoIndex();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoUrl, chartName]);

  useEffect(() => {
    const fetchDefaultValues = async () => {
      if (!client || !repoUrl.trim() || !chartName) return;
      setDefaultLoading(true);
      setDefaultError(null);
      try {
        const result = await client.fetchHelmChartValues(repoUrl.trim(), chartName, selectedVersion || undefined);
        setDefaultValues(result.valuesYaml || '# values.yaml\n');
      } catch (e) {
        console.error('Failed to fetch chart values:', e);
        setDefaultError('Failed to load chart default values');
      } finally {
        setDefaultLoading(false);
      }
    };

    fetchDefaultValues();
  }, [client, repoUrl, chartName, selectedVersion]);

  const fetchRepoIndex = useCallback(async () => {
    if (!client || !repoUrl.trim()) return;
    setRepoLoading(true);
    setRepoError(null);
    try {
      const result = await client.fetchHelmRepoIndex(repoUrl.trim());
      setRepoCharts(result.charts || []);
      // Store the URL for future use
      if (chartName) {
        storeRepoUrl(chartName, repoUrl.trim());
      }
      const chartEntry = result.charts.find(entry => entry.name === chartName);
      if (!chartEntry) {
        setRepoError(chartName ? `Chart "${chartName}" not found in repo.` : 'Chart name not available.');
      } else {
        const nextVersion = chartEntry.versions.includes(currentChartVersion)
          ? currentChartVersion
          : chartEntry.latest || chartEntry.versions[0] || '';
        if (nextVersion) {
          setSelectedVersion(nextVersion);
        }
      }
    } catch (e) {
      console.error('Failed to fetch repo index:', e);
      setRepoError('Failed to fetch repo index');
    } finally {
      setRepoLoading(false);
    }
  }, [client, repoUrl, chartName, currentChartVersion]);

  const handleCopy = async () => {
    const textToCopy = viewMode === 'overrides' ? userOverrides : allValues;
    try {
      await navigator.clipboard.writeText(textToCopy);
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
      const parsed = yaml.load(userOverrides) as Record<string, unknown>;
      const upgradeOptions = repoUrl.trim() && chartName ? {
        repoUrl: repoUrl.trim(),
        chart: chartName,
        version: selectedVersion || undefined
      } : undefined;
      const success = await client.updateHelmRelease(resource.namespace, resource.name, parsed, upgradeOptions);
      
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

  // Check if user has any real overrides
  const hasOverrides = useMemo((): boolean => {
    try {
      const parsed = yaml.load(userOverrides);
      return !!(parsed && typeof parsed === 'object' && Object.keys(parsed as object).length > 0);
    } catch {
      return false;
    }
  }, [userOverrides]);

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

  const canCompare = defaultValues && !defaultLoading && !defaultError;

  return (
    <div className="h-full flex flex-col">
      {/* View Mode Tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 bg-slate-900/30 border-b border-slate-800">
        <button
          onClick={() => setViewMode('overrides')}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
            viewMode === 'overrides'
              ? "bg-sky-600 text-white shadow-lg shadow-sky-600/20"
              : "bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          )}
        >
          <FileText size={14} />
          Your Overrides
          {hasOverrides && viewMode !== 'overrides' && (
            <span className="w-2 h-2 rounded-full bg-sky-400" />
          )}
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
            viewMode === 'all'
              ? "bg-slate-700 text-white"
              : "bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          )}
        >
          <Layers size={14} />
          All Values
        </button>
        <button
          onClick={() => setViewMode('compare')}
          disabled={!canCompare}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
            viewMode === 'compare'
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
              : canCompare
                ? "bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                : "bg-slate-800/30 text-slate-600 cursor-not-allowed"
          )}
          title={!canCompare ? "Load chart source to enable comparison" : "Compare overrides with chart defaults"}
        >
          <GitCompare size={14} />
          Compare
        </button>
        
        <div className="flex-1" />
        
        {/* Quick stats */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Chart: <span className="text-slate-300">{chartName || 'Unknown'}</span></span>
          <span>Version: <span className="text-slate-300">{currentChartVersion || 'Unknown'}</span></span>
        </div>
      </div>

      {/* View Mode Description */}
      <div className="px-4 py-2 bg-slate-900/20 border-b border-slate-800/50">
        {viewMode === 'overrides' && (
          <p className="text-xs text-slate-400">
            <span className="text-sky-400 font-medium">Your Overrides</span> — Only the values you've customized. 
            Edit here to change your configuration. These are merged with chart defaults during deployment.
          </p>
        )}
        {viewMode === 'all' && (
          <p className="text-xs text-slate-400">
            <span className="text-slate-300 font-medium">All Values</span> — Complete computed values (defaults + your overrides merged). 
            Read-only reference to see the final configuration.
          </p>
        )}
        {viewMode === 'compare' && (
          <p className="text-xs text-slate-400">
            <span className="text-purple-400 font-medium">Compare</span> — Side-by-side diff between chart defaults (left) and your overrides (right).
            Easily spot what you've changed.
          </p>
        )}
      </div>

      {/* Collapsible Chart Source Section */}
      <div className="border-b border-slate-800">
        <button
          onClick={() => setChartSourceExpanded(!chartSourceExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 bg-slate-900/30 hover:bg-slate-900/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm text-slate-300">
            {chartSourceExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Chart Source</span>
            {repoUrl && chartVersions.length > 0 && (
              <span className="text-xs text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded">
                {chartVersions.length} versions available
              </span>
            )}
            {!repoUrl && (
              <span className="text-xs text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded">
                Not configured
              </span>
            )}
          </div>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowHelp(!showHelp); }}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
              title="Why is this needed?"
            >
              <HelpCircle size={14} />
            </button>
            {showHelp && (
              <div className="absolute right-0 top-full mt-1 w-72 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 text-left">
                <div className="text-xs text-slate-300 space-y-2">
                  <p className="font-medium text-slate-200">Why do I need to enter the repo URL?</p>
                  <p>Helm releases don't store the original repository URL. To load available versions and chart defaults, we need to fetch from the source repository.</p>
                  <p className="text-slate-400">This is remembered per chart in your browser for convenience.</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowHelp(false); }}
                  className="absolute top-1 right-1 p-1 text-slate-500 hover:text-slate-300"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </button>
        
        {chartSourceExpanded && (
          <div className="px-4 py-3 bg-slate-900/20 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[280px]">
                <label className="block text-xs text-slate-400 mb-1">Repository URL</label>
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://charts.bitnami.com/bitnami"
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                />
              </div>
              <div className="min-w-[160px]">
                <label className="block text-xs text-slate-400 mb-1">Version</label>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  disabled={chartVersions.length === 0}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 disabled:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                >
                  {chartVersions.length === 0 && <option value="">Load versions first</option>}
                  {chartVersions.map(v => (
                    <option key={v} value={v}>
                      {v}{v === currentChartVersion ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={fetchRepoIndex}
                disabled={repoLoading || !repoUrl.trim()}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded transition-colors border border-slate-700",
                  (repoLoading || !repoUrl.trim()) && "opacity-50 cursor-not-allowed"
                )}
              >
                {repoLoading ? <RefreshCw size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                {repoLoading ? 'Loading...' : 'Fetch'}
              </button>
            </div>
            {repoError && <p className="text-xs text-red-400">{repoError}</p>}
            {defaultError && <p className="text-xs text-amber-400">{defaultError}</p>}
            {defaultLoading && (
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin" />
                Loading chart defaults...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileJson size={14} className="text-slate-400" />
          <span className="text-sm text-slate-300">
            {viewMode === 'overrides' ? 'values-override.yaml' : viewMode === 'all' ? 'computed-values.yaml' : 'Diff View'}
          </span>
          {viewMode === 'all' && <span className="text-xs text-slate-500">(read-only)</span>}
        </div>
        <div className="flex items-center gap-2">
          {viewMode !== 'compare' && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors border border-slate-700"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          {viewMode === 'overrides' && (
            <button
              onClick={handleApplyValues}
              disabled={saving}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded transition-colors shadow-lg shadow-sky-600/20",
                saving && "opacity-50 cursor-not-allowed"
              )}
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              Apply Changes
            </button>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 min-h-[55vh]">
        {viewMode === 'overrides' && (
          <Editor
            height="55vh"
            defaultLanguage="yaml"
            value={userOverrides}
            onChange={(value) => setUserOverrides(value || '')}
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
              padding: { top: 12 }
            }}
          />
        )}
        {viewMode === 'all' && (
          <Editor
            height="55vh"
            defaultLanguage="yaml"
            value={allValues}
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
              readOnly: true,
              padding: { top: 12 }
            }}
          />
        )}
        {viewMode === 'compare' && (
          canCompare ? (
            <DiffEditor
              height="55vh"
              language="yaml"
              original={defaultValues}
              modified={userOverrides}
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
                padding: { top: 12 }
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <GitCompare size={48} className="text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">Comparison Not Available</h3>
              <p className="text-sm text-slate-500 max-w-md mb-4">
                To compare your overrides with chart defaults, expand "Chart Source" above and enter the repository URL.
              </p>
              <button
                onClick={() => setChartSourceExpanded(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded transition-colors border border-slate-700"
              >
                Configure Chart Source
              </button>
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-800 flex items-center justify-between">
        <code className="text-xs text-slate-500">
          helm upgrade {resource.name} {chartName || '<chart>'} -f values.yaml -n {resource.namespace}
        </code>
        {selectedVersion && selectedVersion !== currentChartVersion && repoUrl && (
          <span className="text-xs text-amber-400">
            Will upgrade to v{selectedVersion}
          </span>
        )}
      </div>
    </div>
  );
};
