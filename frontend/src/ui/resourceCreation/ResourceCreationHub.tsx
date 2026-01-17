import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Minimize2, Maximize2, Layers, Package, FileText, Sparkles, Upload, Server, Database, Shield, Network, ChevronDown, ChevronRight, Trash2, Radio, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { useResourceCreationStore } from '../../store/useResourceCreationStore';
import type { AppDraft, DeploymentItem, ServiceItem, IngressItem, StorageItem, ConfigMapItem, SecretItem, GenericResourceItem } from '../../store/useResourceCreationStore';
import { useClusterStore } from '../../store/useClusterStore';
import type { KubeClient } from '../../api/kubeClient';
import { ErrorModal } from '../components/ErrorModal';
import { buildAppYaml } from './appYaml';
import { Combobox } from '../resources/shared/Combobox';
import { Card, CardHeader, CardBody } from '../resources/shared/Card';
import { OTHER_RESOURCE_TYPES, type ResourceTypeConfig } from './resourceTypes';

const TAB_CONFIG = [
  { id: 'yaml', label: 'YAML', icon: FileText },
  { id: 'helm', label: 'Helm', icon: Package },
  { id: 'app', label: 'Application', icon: Layers },
] as const;

const TEMPLATE_PRESETS = [
  {
    id: 'web',
    label: 'Web App',
    description: 'Frontend + Service + optional Ingress',
    icon: Network,
    apply: (updateDraft: (partial: Partial<AppDraft>) => void) => {
      updateDraft({
        name: 'web-app',
        labels: { app: 'web-app', tier: 'frontend' },
        deployment: {
          enabled: true,
          data: [
            {
              name: 'web-app',
              image: 'nginx:latest',
              replicas: 2,
              containerPort: 80,
              env: [],
              labels: {},
              annotations: {},
            },
          ],
        },
        service: {
          enabled: true,
          data: [
            {
              name: 'web-app-svc',
              type: 'ClusterIP',
              port: 80,
              targetPort: 80,
              selectorLabels: { app: 'web-app' },
              labels: {},
              annotations: {},
            },
          ],
        },
        ingress: {
          enabled: true,
          data: [
            {
              name: 'web-app-ingress',
              host: 'web.local',
              path: '/',
              serviceName: 'web-app-svc',
              labels: {},
              annotations: {},
            },
          ],
        },
        storage: { enabled: false, data: [] },
        configMap: { enabled: false, data: [] },
        secret: { enabled: false, data: [] },
      });
    },
  },
  {
    id: 'api',
    label: 'API Service',
    description: 'Backend API with config + secret',
    icon: Server,
    apply: (updateDraft: (partial: Partial<AppDraft>) => void) => {
      updateDraft({
        name: 'api-service',
        labels: { app: 'api-service', tier: 'backend' },
        deployment: {
          enabled: true,
          data: [
            {
              name: 'api-service',
              image: 'ghcr.io/org/api:latest',
              replicas: 2,
              containerPort: 8080,
              env: [],
              labels: {},
              annotations: {},
            },
          ],
        },
        service: {
          enabled: true,
          data: [
            {
              name: 'api-service-svc',
              type: 'ClusterIP',
              port: 8080,
              targetPort: 8080,
              selectorLabels: { app: 'api-service' },
              labels: {},
              annotations: {},
            },
          ],
        },
        configMap: {
          enabled: true,
          data: [
            {
              name: 'api-config',
              entries: [{ key: 'LOG_LEVEL', value: 'info' }],
              labels: {},
              annotations: {},
            },
          ],
        },
        secret: {
          enabled: true,
          data: [
            {
              name: 'api-secret',
              entries: [{ key: 'API_KEY', value: 'change-me' }],
              labels: {},
              annotations: {},
            },
          ],
        },
        ingress: { enabled: false, data: [] },
        storage: { enabled: false, data: [] },
      });
    },
  },
  {
    id: 'stateful',
    label: 'Stateful App',
    description: 'Storage + PVC + service',
    icon: Database,
    apply: (updateDraft: (partial: Partial<AppDraft>) => void) => {
      updateDraft({
        name: 'stateful-app',
        labels: { app: 'stateful-app' },
        deployment: {
          enabled: true,
          data: [
            {
              name: 'stateful-app',
              image: 'postgres:16',
              replicas: 1,
              containerPort: 5432,
              env: [],
              labels: {},
              annotations: {},
            },
          ],
        },
        storage: {
          enabled: true,
          data: [
            {
              name: 'stateful-data',
              size: '10Gi',
              mountPath: '/var/lib/data',
              labels: {},
              annotations: {},
            },
          ],
        },
        service: {
          enabled: true,
          data: [
            {
              name: 'stateful-app-svc',
              type: 'ClusterIP',
              port: 5432,
              targetPort: 5432,
              selectorLabels: { app: 'stateful-app' },
              labels: {},
              annotations: {},
            },
          ],
        },
        ingress: { enabled: false, data: [] },
        configMap: { enabled: false, data: [] },
        secret: { enabled: false, data: [] },
      });
    },
  },
  {
    id: 'secure',
    label: 'Secure App',
    description: 'Secrets + config and ingress',
    icon: Shield,
    apply: (updateDraft: (partial: Partial<AppDraft>) => void) => {
      updateDraft({
        name: 'secure-app',
        labels: { app: 'secure-app', tier: 'secure' },
        deployment: {
          enabled: true,
          data: [
            {
              name: 'secure-app',
              image: 'ghcr.io/org/secure:latest',
              replicas: 1,
              containerPort: 8443,
              env: [],
              labels: {},
              annotations: {},
            },
          ],
        },
        configMap: {
          enabled: true,
          data: [
            {
              name: 'secure-config',
              entries: [{ key: 'FEATURE_FLAG', value: 'true' }],
              labels: {},
              annotations: {},
            },
          ],
        },
        secret: {
          enabled: true,
          data: [
            {
              name: 'secure-secret',
              entries: [{ key: 'TOKEN', value: 'change-me' }],
              labels: {},
              annotations: {},
            },
          ],
        },
        ingress: {
          enabled: true,
          data: [
            {
              name: 'secure-app-ingress',
              host: 'secure.local',
              path: '/',
              serviceName: 'secure-app-svc',
              labels: {},
              annotations: {},
            },
          ],
        },
        service: {
          enabled: true,
          data: [
            {
              name: 'secure-app-svc',
              type: 'ClusterIP',
              port: 8443,
              targetPort: 8443,
              selectorLabels: { app: 'secure-app' },
              labels: {},
              annotations: {},
            },
          ],
        },
        storage: { enabled: false, data: [] },
      });
    },
  },
];

export const ResourceCreationHub: React.FC = () => {
  const {
    isOpen,
    isMinimized,
    setMinimized,
    activeTab,
    setActiveTab,
    closeHub,
    setCreationMode,
    appDraft,
    updateAppDraft,
    resetAppDraft,
    addAdditionalResource,
    removeAdditionalResourceType,
    updateAdditionalResource,
    addAdditionalResourceItem,
    removeAdditionalResourceItem,
  } = useResourceCreationStore();
  const client = useClusterStore((state) => state.client);
  const resources = useClusterStore((state) => state.resources);

  // Get namespace list from cluster resources
  const namespaces = useMemo(() => {
    const ns = new Set<string>();
    Object.values(resources).forEach((r) => {
      if (r.namespace) ns.add(r.namespace);
    });
    return Array.from(ns).sort();
  }, [resources]);

  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCreationMode(isOpen && activeTab === 'app');
  }, [isOpen, activeTab, setCreationMode]);

  if (!isOpen) return null;

  const handleClose = () => {
    closeHub();
    setStatusMessage(null);
    setError(null);
  };

  // Match ResourceDetailsWindow structure and styling
  return (
    <>
      <div
        className={clsx(
          'fixed z-[200] bg-slate-950 border border-slate-700 shadow-2xl transition-all duration-300 flex flex-col font-mono text-sm',
          isMinimized
            ? 'bottom-0 right-0 w-96 h-12 rounded-t-lg overflow-hidden'
            : 'inset-x-20 bottom-20 top-20 rounded-lg'
        )}
      >
        {/* Header / Tab Bar - matches ResourceDetailsWindow */}
        <div className="flex items-center bg-slate-900 border-b border-slate-800 h-12 shrink-0">
          <div className="flex-1 flex overflow-x-auto h-full">
            {/* Resource identifier tab */}
            <div className="flex items-center gap-2 px-4 cursor-default border-r border-slate-800 min-w-[150px] max-w-[200px] h-full relative bg-slate-950 text-blue-400 border-t-2 border-t-blue-500">
              <Plus size={14} />
              <span className="truncate text-xs font-medium flex-1">Create Resources</span>
              {isSubmitting && <Radio size={10} className="animate-pulse text-emerald-400" />}
            </div>

            {/* Tabs */}
            {!isMinimized &&
              TAB_CONFIG.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-4 border-r border-slate-800 min-w-[100px] hover:bg-slate-800 transition-colors h-full relative',
                    activeTab === tab.id
                      ? 'bg-slate-950 text-blue-400 border-t-2 border-t-blue-500'
                      : 'text-slate-500 border-t-2 border-t-transparent bg-slate-900'
                  )}
                >
                  <tab.icon size={14} />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              ))}

            {/* Status message */}
            {statusMessage && !isMinimized && (
              <div className="flex items-center px-4 text-xs text-emerald-400">
                {statusMessage}
              </div>
            )}
          </div>

          {/* Window controls */}
          <div className="flex items-center gap-1 px-2 border-l border-slate-800 bg-slate-900 h-full">
            <button onClick={() => setMinimized(!isMinimized)} className="p-2 hover:bg-slate-800 text-slate-400 rounded">
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button onClick={handleClose} className="p-2 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content - matches ResourceDetailsWindow bg-black */}
        <div className={clsx('flex-1 relative overflow-hidden bg-black', isMinimized ? 'hidden' : 'block')}>
          <div className="absolute inset-0 overflow-y-auto p-6">
            {activeTab === 'yaml' && (
              <YamlCreationForm
                client={client}
                setError={setError}
                setStatusMessage={setStatusMessage}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
                namespaces={namespaces}
              />
            )}
            {activeTab === 'helm' && (
              <HelmCreationForm
                client={client}
                setError={setError}
                setStatusMessage={setStatusMessage}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
                namespaces={namespaces}
              />
            )}
            {activeTab === 'app' && (
              <AppCreationForm
                draft={appDraft}
                updateDraft={updateAppDraft}
                resetDraft={resetAppDraft}
                client={client}
                setError={setError}
                setStatusMessage={setStatusMessage}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
                namespaces={namespaces}
                addAdditionalResource={addAdditionalResource}
                removeAdditionalResourceType={removeAdditionalResourceType}
                updateAdditionalResource={updateAdditionalResource}
                addAdditionalResourceItem={addAdditionalResourceItem}
                removeAdditionalResourceItem={removeAdditionalResourceItem}
              />
            )}
          </div>
        </div>
      </div>

      {error && <ErrorModal isOpen={true} title="Error" error={error} onClose={() => setError(null)} />}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*                            YAML Creation Form                              */
/* -------------------------------------------------------------------------- */

const YamlCreationForm: React.FC<{
  client: KubeClient | null;
  setError: (error: string) => void;
  setStatusMessage: (message: string | null) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  namespaces: string[];
}> = ({ client, setError, setStatusMessage, isSubmitting, setIsSubmitting, namespaces }) => {
  const [yamlContent, setYamlContent] = useState('');
  const [namespace, setNamespace] = useState('default');

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
      setStatusMessage(`Applied ${res.applied} resources`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to apply YAML';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Apply YAML</h3>
            <p className="text-xs text-slate-500">Paste one or multiple YAML documents separated by ---</p>
          </div>
          <div className="text-xs text-slate-600">Supports multi-resource apply</div>
        </div>
        <div className="mb-4">
          <label className="text-xs text-slate-400 mb-1 block">Default Namespace</label>
          <div className="w-64">
            <Combobox
              value={namespace}
              onChange={setNamespace}
              options={namespaces}
              placeholder="Select namespace..."
              allowCustom
              size="sm"
            />
          </div>
        </div>
        <textarea
          value={yamlContent}
          onChange={(e) => setYamlContent(e.target.value)}
          className="w-full h-72 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
          placeholder="apiVersion: v1&#10;kind: ConfigMap&#10;metadata:&#10;  name: my-config&#10;data:&#10;  key: value"
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleApply}
          disabled={isSubmitting}
          className={clsx(
            'px-4 py-2 rounded text-sm font-medium transition-colors',
            isSubmitting
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          {isSubmitting ? 'Applying...' : 'Apply YAML'}
        </button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                            Helm Creation Form                              */
/* -------------------------------------------------------------------------- */

const HelmCreationForm: React.FC<{
  client: KubeClient | null;
  setError: (error: string) => void;
  setStatusMessage: (message: string | null) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  namespaces: string[];
}> = ({ client, setError, setStatusMessage, isSubmitting, setIsSubmitting, namespaces }) => {
  const [mode, setMode] = useState<'repo' | 'upload'>('repo');
  const [namespace, setNamespace] = useState('default');
  const [releaseName, setReleaseName] = useState('my-release');
  const [repoUrl, setRepoUrl] = useState('https://charts.bitnami.com/bitnami');
  const [chart, setChart] = useState('');
  const [version, setVersion] = useState('');
  const [valuesYaml, setValuesYaml] = useState('# values.yaml\n');
  const [chartFile, setChartFile] = useState<File | null>(null);

  // Repo index state
  const [repoCharts, setRepoCharts] = useState<Array<{ name: string; versions: string[] }>>([]);
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [loadingValues, setLoadingValues] = useState(false);

  const fetchRepoIndex = async () => {
    if (!client || !repoUrl.trim()) return;
    setLoadingRepo(true);
    setRepoError(null);
    try {
      const result = await client.fetchHelmRepoIndex(repoUrl);
      setRepoCharts(result.charts);
      if (result.charts.length > 0) {
        const nextChart = chart || result.charts[0].name;
        setChart(nextChart);
        const selectedChart = result.charts.find((c) => c.name === nextChart);
        const latestVersion = selectedChart?.versions[0] || '';
        if (!version || nextChart !== chart) {
          setVersion(latestVersion);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch repo index';
      setRepoError(message);
    } finally {
      setLoadingRepo(false);
    }
  };

  const fetchChartValues = async (chartName: string, chartVersion: string) => {
    if (!client || !repoUrl.trim() || !chartName) return;
    setLoadingValues(true);
    try {
      const result = await client.fetchHelmChartValues(repoUrl, chartName, chartVersion || undefined);
      setValuesYaml(result.valuesYaml || '# values.yaml\n');
    } catch {
      // ignore, keep existing values
    } finally {
      setLoadingValues(false);
    }
  };

  useEffect(() => {
    if (chart) {
      const selectedChart = repoCharts.find((c) => c.name === chart);
      const latestVersion = selectedChart?.versions[0] || '';
      fetchChartValues(chart, version || latestVersion);
    }
  }, [chart, version]);

  const handleInstall = async () => {
    if (!client) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      if (mode === 'repo') {
        await client.installHelmFromRepo({
          namespace,
          releaseName,
          repoUrl,
          chart,
          version: version || undefined,
          valuesYaml: valuesYaml || undefined,
        });
      } else {
        if (!chartFile) {
          setError('Please upload a chart archive (.tgz).');
          return;
        }
        await client.installHelmFromUpload({
          namespace,
          releaseName,
          chartFile,
          valuesYaml: valuesYaml || undefined,
        });
      }
      setStatusMessage(`Helm release ${releaseName} installed`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to install Helm chart';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="flex gap-1 bg-slate-900 p-1 rounded-lg w-fit border border-slate-800">
        <button
          onClick={() => setMode('repo')}
          className={clsx(
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            mode === 'repo' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          Repo Chart
        </button>
        <button
          onClick={() => setMode('upload')}
          className={clsx(
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            mode === 'upload' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          Upload Chart
        </button>
      </div>

      {/* Common fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Namespace</label>
          <Combobox
            value={namespace}
            onChange={setNamespace}
            options={namespaces}
            placeholder="Select namespace..."
            allowCustom
            size="sm"
          />
        </div>
        <InputField label="Release Name" value={releaseName} onChange={setReleaseName} placeholder="my-release" />
      </div>

      {mode === 'repo' ? (
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <InputField label="Repository URL" value={repoUrl} onChange={setRepoUrl} placeholder="https://charts.bitnami.com/bitnami" />
            </div>
            <button
              onClick={fetchRepoIndex}
              disabled={loadingRepo}
              className={clsx(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors h-[34px]',
                loadingRepo ? 'bg-slate-700 text-slate-400' : 'bg-slate-700 text-white hover:bg-slate-600'
              )}
            >
              {loadingRepo ? 'Loading...' : 'Fetch'}
            </button>
          </div>
          {repoError && <div className="text-xs text-red-400">{repoError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Chart</label>
              <select
                value={chart}
                onChange={(e) => {
                  const nextChart = e.target.value;
                  setChart(nextChart);
                  const selectedChart = repoCharts.find((c) => c.name === nextChart);
                  const latestVersion = selectedChart?.versions[0] || '';
                  setVersion(latestVersion);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select chart...</option>
                {repoCharts.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Version</label>
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Latest</option>
                {(repoCharts.find((c) => c.name === chart)?.versions || []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-slate-700 rounded-lg p-6 bg-slate-900/30 text-slate-400 cursor-pointer hover:border-slate-600">
          <Upload size={20} />
          <span className="text-sm">{chartFile ? chartFile.name : 'Drop .tgz chart or click to upload'}</span>
          <input type="file" accept=".tgz" className="hidden" onChange={(e) => setChartFile(e.target.files?.[0] || null)} />
        </label>
      )}

      {/* Values */}
      <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-200">Values</div>
          {loadingValues && <span className="text-xs text-slate-500">Loading values...</span>}
        </div>
        <textarea
          value={valuesYaml}
          onChange={(e) => setValuesYaml(e.target.value)}
          className="w-full h-48 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleInstall}
          disabled={isSubmitting}
          className={clsx(
            'px-4 py-2 rounded text-sm font-medium transition-colors',
            isSubmitting
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          {isSubmitting ? 'Installing...' : 'Install Helm'}
        </button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                           App Creation Form                                */
/* -------------------------------------------------------------------------- */

const AppCreationForm: React.FC<{
  draft: AppDraft;
  updateDraft: (partial: Partial<AppDraft>) => void;
  resetDraft: () => void;
  client: KubeClient | null;
  setError: (error: string) => void;
  setStatusMessage: (message: string | null) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  namespaces: string[];
  addAdditionalResource: (resourceTypeId: string, defaultItem: GenericResourceItem) => void;
  removeAdditionalResourceType: (resourceTypeId: string) => void;
  updateAdditionalResource: (resourceTypeId: string, index: number, updates: Partial<GenericResourceItem>) => void;
  addAdditionalResourceItem: (resourceTypeId: string, defaultItem: GenericResourceItem) => void;
  removeAdditionalResourceItem: (resourceTypeId: string, index: number) => void;
}> = ({ 
  draft, 
  updateDraft, 
  resetDraft, 
  client, 
  setError, 
  setStatusMessage, 
  isSubmitting, 
  setIsSubmitting, 
  namespaces,
  addAdditionalResource,
  removeAdditionalResourceType,
  updateAdditionalResource,
  addAdditionalResourceItem,
  removeAdditionalResourceItem,
}) => {
  const [showYaml, setShowYaml] = useState(false);
  const [showBlueprints, setShowBlueprints] = useState(false);
  const [pendingBlueprint, setPendingBlueprint] = useState<typeof TEMPLATE_PRESETS[number] | null>(null);

  const yamlPreview = useMemo(() => buildAppYaml(draft), [draft]);

  const toggleSection = (key: 'deployment' | 'service' | 'ingress' | 'storage' | 'configMap' | 'secret') => {
    const section = draft[key];
    updateDraft({ [key]: { ...section, enabled: !section.enabled } });
  };

  const updateItemList = <K extends 'deployment' | 'service' | 'ingress' | 'storage' | 'configMap' | 'secret'>(
    key: K,
    updater: (items: AppDraft[K]['data']) => AppDraft[K]['data']
  ) => {
    const section = draft[key];
    updateDraft({ [key]: { ...section, data: updater(section.data) } });
  };

  const createDeploymentItem = (): DeploymentItem => ({
    name: `${draft.name}-deployment`,
    image: 'nginx:latest',
    replicas: 1,
    containerPort: 80,
    env: [],
    labels: {},
    annotations: {},
  });

  const createServiceItem = (): ServiceItem => ({
    name: `${draft.name}-svc`,
    type: 'ClusterIP',
    port: 80,
    targetPort: 80,
    selectorLabels: { app: draft.name },
    labels: {},
    annotations: {},
  });

  const createIngressItem = (): IngressItem => ({
    name: `${draft.name}-ingress`,
    host: 'app.local',
    path: '/',
    serviceName: `${draft.name}-svc`,
    labels: {},
    annotations: {},
  });

  const createStorageItem = (): StorageItem => ({
    name: `${draft.name}-storage`,
    size: '1Gi',
    mountPath: '/data',
    labels: {},
    annotations: {},
  });

  const createConfigMapItem = (): ConfigMapItem => ({
    name: `${draft.name}-config`,
    entries: [{ key: 'APP_MODE', value: 'production' }],
    labels: {},
    annotations: {},
  });

  const createSecretItem = (): SecretItem => ({
    name: `${draft.name}-secret`,
    entries: [{ key: 'PASSWORD', value: 'change-me' }],
    labels: {},
    annotations: {},
  });

  const QUICK_PRESETS: Record<
    string,
    { label: string; enabled: Record<'deployment' | 'service' | 'ingress' | 'storage' | 'configMap' | 'secret', boolean> }
  > = {
    app: {
      label: 'Full application',
      enabled: { deployment: true, service: true, ingress: false, storage: false, configMap: false, secret: false },
    },
    deployment: {
      label: 'Deployment only',
      enabled: { deployment: true, service: false, ingress: false, storage: false, configMap: false, secret: false },
    },
    service: {
      label: 'Service only',
      enabled: { deployment: false, service: true, ingress: false, storage: false, configMap: false, secret: false },
    },
    ingress: {
      label: 'Ingress only',
      enabled: { deployment: false, service: false, ingress: true, storage: false, configMap: false, secret: false },
    },
    storage: {
      label: 'PVC only',
      enabled: { deployment: false, service: false, ingress: false, storage: true, configMap: false, secret: false },
    },
    configmap: {
      label: 'ConfigMap only',
      enabled: { deployment: false, service: false, ingress: false, storage: false, configMap: true, secret: false },
    },
    secret: {
      label: 'Secret only',
      enabled: { deployment: false, service: false, ingress: false, storage: false, configMap: false, secret: true },
    },
  };

  const enabledState = {
    deployment: draft.deployment.enabled,
    service: draft.service.enabled,
    ingress: draft.ingress.enabled,
    storage: draft.storage.enabled,
    configMap: draft.configMap.enabled,
    secret: draft.secret.enabled,
  };

  const quickCreateValue = useMemo(() => {
    const match = Object.entries(QUICK_PRESETS).find(([, preset]) =>
      Object.entries(preset.enabled).every(([key, value]) => enabledState[key as keyof typeof enabledState] === value)
    );
    return match ? match[0] : 'custom';
  }, [enabledState]);

  const applyQuickCreate = (presetKey: string) => {
    const preset = QUICK_PRESETS[presetKey];
    if (!preset) return;
    updateDraft({
      deployment: { ...draft.deployment, enabled: preset.enabled.deployment },
      service: { ...draft.service, enabled: preset.enabled.service },
      ingress: { ...draft.ingress, enabled: preset.enabled.ingress },
      storage: { ...draft.storage, enabled: preset.enabled.storage },
      configMap: { ...draft.configMap, enabled: preset.enabled.configMap },
      secret: { ...draft.secret, enabled: preset.enabled.secret },
    });
  };

  const mapToEntries = (map: Record<string, string>) =>
    Object.entries(map).map(([key, value]) => ({ key, value }));

  const entriesToMap = (entries: Array<{ key: string; value: string }>) =>
    entries.reduce<Record<string, string>>((acc, entry) => {
      if (entry.key) acc[entry.key] = entry.value;
      return acc;
    }, {});

  const updateDeploymentItem = (index: number, updater: (item: DeploymentItem) => DeploymentItem) => {
    updateItemList('deployment', (items) => items.map((item, idx) => (idx === index ? updater(item as DeploymentItem) : item)) as DeploymentItem[]);
  };

  const updateServiceItem = (index: number, updater: (item: ServiceItem) => ServiceItem) => {
    updateItemList('service', (items) => items.map((item, idx) => (idx === index ? updater(item as ServiceItem) : item)) as ServiceItem[]);
  };

  const updateIngressItem = (index: number, updater: (item: IngressItem) => IngressItem) => {
    updateItemList('ingress', (items) => items.map((item, idx) => (idx === index ? updater(item as IngressItem) : item)) as IngressItem[]);
  };

  const updateStorageItem = (index: number, updater: (item: StorageItem) => StorageItem) => {
    updateItemList('storage', (items) => items.map((item, idx) => (idx === index ? updater(item as StorageItem) : item)) as StorageItem[]);
  };

  const updateConfigMapItem = (index: number, updater: (item: ConfigMapItem) => ConfigMapItem) => {
    updateItemList('configMap', (items) => items.map((item, idx) => (idx === index ? updater(item as ConfigMapItem) : item)) as ConfigMapItem[]);
  };

  const updateSecretItem = (index: number, updater: (item: SecretItem) => SecretItem) => {
    updateItemList('secret', (items) => items.map((item, idx) => (idx === index ? updater(item as SecretItem) : item)) as SecretItem[]);
  };

  const handleApply = async () => {
    if (!client) return;
    if (!yamlPreview.trim()) {
      setError('No resources selected for creation.');
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await client.applyYamlBatch(yamlPreview, draft.namespace);
      setStatusMessage(`Applied ${res.applied} resources`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create application';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Blueprint Confirmation Modal */}
      {pendingBlueprint && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
              <h3 className="text-base font-semibold text-slate-200">Apply Blueprint?</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-400 mb-4">
                This will reset all your current values to the blueprint defaults. Are you sure you want to continue?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setPendingBlueprint(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    pendingBlueprint.apply(updateDraft);
                    setPendingBlueprint(null);
                    setShowBlueprints(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                >
                  Apply Blueprint
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blueprints Modal */}
      {showBlueprints && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-200">Choose Blueprint</h3>
              <button
                onClick={() => setShowBlueprints(false)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEMPLATE_PRESETS.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setPendingBlueprint(template)}
                  className="group border border-slate-800 rounded-xl p-4 text-left hover:border-slate-600 hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-slate-700">
                      <template.icon size={16} />
                    </div>
                    <div className="text-sm font-semibold text-slate-200">{template.label}</div>
                  </div>
                  <p className="text-xs text-slate-500">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top controls */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Application Blueprint</h3>
              <p className="text-xs text-slate-500">Pick a template or fine-tune each component.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBlueprints(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
              >
                Choose Blueprint
              </button>
              <button
                onClick={resetDraft}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="mb-2">
            <h4 className="text-sm font-semibold text-slate-200">Quick Create</h4>
            <p className="text-xs text-slate-500">Enable the components you need.</p>
          </div>
          <select
            value={quickCreateValue}
            onChange={(e) => applyQuickCreate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {Object.entries(QUICK_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.label}
              </option>
            ))}
            <option value="custom" disabled>
              Custom
            </option>
          </select>
        </div>
      </div>

      {/* Core Metadata */}
      <SectionCard
        title="Core Metadata"
        description="Name, namespace, and labels."
        icon={Sparkles}
        enabled={true}
        onToggle={() => undefined}
        forced
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label="Application Name"
            value={draft.name}
            onChange={(v) => updateDraft({ name: v, labels: { ...draft.labels, app: v } })}
            placeholder="my-app"
          />
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Default Namespace</label>
            <Combobox
              value={draft.namespace}
              onChange={(v) => updateDraft({ namespace: v })}
              options={namespaces}
              placeholder="Select namespace..."
              allowCustom
              size="sm"
            />
          </div>
          <InputField
            label="Tier Label"
            value={draft.labels.tier || ''}
            onChange={(v) => updateDraft({ labels: { ...draft.labels, tier: v } })}
            placeholder="frontend"
          />
        </div>
      </SectionCard>

      {/* Deployments */}
      <SectionCard
        title="Deployment"
        description="Workload definition and container settings."
        icon={Layers}
        enabled={draft.deployment.enabled}
        onToggle={() => toggleSection('deployment')}
      >
        {(draft.deployment.data as DeploymentItem[]).map((item, index) => (
          <ResourceItemCard
            key={`${item.name}-${index}`}
            title={`Deployment ${index + 1}`}
            onRemove={draft.deployment.data.length > 1 ? () => updateItemList('deployment', (items) => items.filter((_, idx) => idx !== index)) : undefined}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Name" value={item.name} onChange={(v) => updateDeploymentItem(index, (prev) => ({ ...prev, name: v }))} placeholder="my-deployment" />
              <InputField label="Image" value={item.image} onChange={(v) => updateDeploymentItem(index, (prev) => ({ ...prev, image: v }))} placeholder="nginx:latest" />
              <InputField label="Replicas" value={String(item.replicas)} onChange={(v) => updateDeploymentItem(index, (prev) => ({ ...prev, replicas: Number(v) || 1 }))} placeholder="1" />
              <InputField label="Container Port" value={String(item.containerPort)} onChange={(v) => updateDeploymentItem(index, (prev) => ({ ...prev, containerPort: Number(v) || 80 }))} placeholder="80" />
            </div>
            <LabelRow label="Environment Variables">
              <KeyValueEditor
                entries={item.env}
                onChange={(env) => updateDeploymentItem(index, (prev) => ({ ...prev, env }))}
              />
            </LabelRow>
            <LabelRow label="Labels">
              <KeyValueEditor
                entries={mapToEntries(item.labels)}
                onChange={(entries) => updateDeploymentItem(index, (prev) => ({ ...prev, labels: entriesToMap(entries) }))}
              />
            </LabelRow>
            <LabelRow label="Annotations">
              <KeyValueEditor
                entries={mapToEntries(item.annotations)}
                onChange={(entries) => updateDeploymentItem(index, (prev) => ({ ...prev, annotations: entriesToMap(entries) }))}
              />
            </LabelRow>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Namespace Override</label>
              <Combobox
                value={item.namespace || ''}
                onChange={(v) => updateDeploymentItem(index, (prev) => ({ ...prev, namespace: v || undefined }))}
                options={namespaces}
                placeholder="Leave empty to use default"
                allowCustom
                size="sm"
              />
            </div>
          </ResourceItemCard>
        ))}
        <button
          onClick={() => updateItemList('deployment', (items) => [...items, createDeploymentItem()])}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          + Add Deployment
        </button>
      </SectionCard>

      {/* Services */}
      <SectionCard
        title="Service"
        description="Expose your workload internally or externally."
        icon={Network}
        enabled={draft.service.enabled}
        onToggle={() => toggleSection('service')}
      >
        {(draft.service.data as ServiceItem[]).map((item, index) => (
          <ResourceItemCard
            key={`${item.name}-${index}`}
            title={`Service ${index + 1}`}
            onRemove={draft.service.data.length > 1 ? () => updateItemList('service', (items) => items.filter((_, idx) => idx !== index)) : undefined}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Name" value={item.name} onChange={(v) => updateServiceItem(index, (prev) => ({ ...prev, name: v }))} placeholder="my-service" />
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Type</label>
                <select
                  value={item.type}
                  onChange={(e) => updateServiceItem(index, (prev) => ({ ...prev, type: e.target.value as ServiceItem['type'] }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ClusterIP">ClusterIP</option>
                  <option value="NodePort">NodePort</option>
                  <option value="LoadBalancer">LoadBalancer</option>
                </select>
              </div>
              <InputField label="Port" value={String(item.port)} onChange={(v) => updateServiceItem(index, (prev) => ({ ...prev, port: Number(v) || 80 }))} placeholder="80" />
              <InputField label="Target Port" value={String(item.targetPort)} onChange={(v) => updateServiceItem(index, (prev) => ({ ...prev, targetPort: Number(v) || 80 }))} placeholder="80" />
            </div>
            <LabelRow label="Selector Labels">
              <KeyValueEditor
                entries={mapToEntries(item.selectorLabels)}
                onChange={(entries) => updateServiceItem(index, (prev) => ({ ...prev, selectorLabels: entriesToMap(entries) }))}
              />
            </LabelRow>
            <LabelRow label="Labels">
              <KeyValueEditor
                entries={mapToEntries(item.labels)}
                onChange={(entries) => updateServiceItem(index, (prev) => ({ ...prev, labels: entriesToMap(entries) }))}
              />
            </LabelRow>
            <LabelRow label="Annotations">
              <KeyValueEditor
                entries={mapToEntries(item.annotations)}
                onChange={(entries) => updateServiceItem(index, (prev) => ({ ...prev, annotations: entriesToMap(entries) }))}
              />
            </LabelRow>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Namespace Override</label>
              <Combobox
                value={item.namespace || ''}
                onChange={(v) => updateServiceItem(index, (prev) => ({ ...prev, namespace: v || undefined }))}
                options={namespaces}
                placeholder="Leave empty to use default"
                allowCustom
                size="sm"
              />
            </div>
          </ResourceItemCard>
        ))}
        <button
          onClick={() => updateItemList('service', (items) => [...items, createServiceItem()])}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          + Add Service
        </button>
      </SectionCard>

      {/* Ingress */}
      <SectionCard
        title="Ingress"
        description="Expose your service with a hostname."
        icon={Network}
        enabled={draft.ingress.enabled}
        onToggle={() => toggleSection('ingress')}
      >
        {(draft.ingress.data as IngressItem[]).map((item, index) => (
          <ResourceItemCard
            key={`${item.name}-${index}`}
            title={`Ingress ${index + 1}`}
            onRemove={draft.ingress.data.length > 1 ? () => updateItemList('ingress', (items) => items.filter((_, idx) => idx !== index)) : undefined}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Name" value={item.name} onChange={(v) => updateIngressItem(index, (prev) => ({ ...prev, name: v }))} placeholder="my-ingress" />
              <InputField label="Service Name" value={item.serviceName} onChange={(v) => updateIngressItem(index, (prev) => ({ ...prev, serviceName: v }))} placeholder="my-service" />
              <InputField label="Host" value={item.host} onChange={(v) => updateIngressItem(index, (prev) => ({ ...prev, host: v }))} placeholder="app.local" />
              <InputField label="Path" value={item.path} onChange={(v) => updateIngressItem(index, (prev) => ({ ...prev, path: v }))} placeholder="/" />
            </div>
            <LabelRow label="Labels">
              <KeyValueEditor
                entries={mapToEntries(item.labels)}
                onChange={(entries) => updateIngressItem(index, (prev) => ({ ...prev, labels: entriesToMap(entries) }))}
              />
            </LabelRow>
            <LabelRow label="Annotations">
              <KeyValueEditor
                entries={mapToEntries(item.annotations)}
                onChange={(entries) => updateIngressItem(index, (prev) => ({ ...prev, annotations: entriesToMap(entries) }))}
              />
            </LabelRow>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Namespace Override</label>
              <Combobox
                value={item.namespace || ''}
                onChange={(v) => updateIngressItem(index, (prev) => ({ ...prev, namespace: v || undefined }))}
                options={namespaces}
                placeholder="Leave empty to use default"
                allowCustom
                size="sm"
              />
            </div>
          </ResourceItemCard>
        ))}
        <button
          onClick={() => updateItemList('ingress', (items) => [...items, createIngressItem()])}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          + Add Ingress
        </button>
      </SectionCard>

      {/* Storage */}
      <SectionCard
        title="Storage"
        description="Attach persistent storage to your workload."
        icon={Database}
        enabled={draft.storage.enabled}
        onToggle={() => toggleSection('storage')}
      >
        {(draft.storage.data as StorageItem[]).map((item, index) => (
          <ResourceItemCard
            key={`${item.name}-${index}`}
            title={`PVC ${index + 1}`}
            onRemove={draft.storage.data.length > 1 ? () => updateItemList('storage', (items) => items.filter((_, idx) => idx !== index)) : undefined}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField label="PVC Name" value={item.name} onChange={(v) => updateStorageItem(index, (prev) => ({ ...prev, name: v }))} placeholder="my-pvc" />
              <InputField label="Size" value={item.size} onChange={(v) => updateStorageItem(index, (prev) => ({ ...prev, size: v }))} placeholder="1Gi" />
              <InputField label="Mount Path" value={item.mountPath} onChange={(v) => updateStorageItem(index, (prev) => ({ ...prev, mountPath: v }))} placeholder="/data" />
            </div>
            <LabelRow label="Labels">
              <KeyValueEditor
                entries={mapToEntries(item.labels)}
                onChange={(entries) => updateStorageItem(index, (prev) => ({ ...prev, labels: entriesToMap(entries) }))}
              />
            </LabelRow>
            <LabelRow label="Annotations">
              <KeyValueEditor
                entries={mapToEntries(item.annotations)}
                onChange={(entries) => updateStorageItem(index, (prev) => ({ ...prev, annotations: entriesToMap(entries) }))}
              />
            </LabelRow>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Namespace Override</label>
              <Combobox
                value={item.namespace || ''}
                onChange={(v) => updateStorageItem(index, (prev) => ({ ...prev, namespace: v || undefined }))}
                options={namespaces}
                placeholder="Leave empty to use default"
                allowCustom
                size="sm"
              />
            </div>
          </ResourceItemCard>
        ))}
        <button
          onClick={() => updateItemList('storage', (items) => [...items, createStorageItem()])}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          + Add PVC
        </button>
      </SectionCard>

      {/* ConfigMap */}
      <SectionCard
        title="ConfigMap"
        description="Non-secret configuration injected into pods."
        icon={FileText}
        enabled={draft.configMap.enabled}
        onToggle={() => toggleSection('configMap')}
      >
        {(draft.configMap.data as ConfigMapItem[]).map((item, index) => (
          <ResourceItemCard
            key={`${item.name}-${index}`}
            title={`ConfigMap ${index + 1}`}
            onRemove={draft.configMap.data.length > 1 ? () => updateItemList('configMap', (items) => items.filter((_, idx) => idx !== index)) : undefined}
          >
            <InputField label="Name" value={item.name} onChange={(v) => updateConfigMapItem(index, (prev) => ({ ...prev, name: v }))} placeholder="my-configmap" />
            <LabelRow label="Data Entries">
              <KeyValueEditor
                entries={item.entries}
                onChange={(entries) => updateConfigMapItem(index, (prev) => ({ ...prev, entries }))}
              />
            </LabelRow>
            <LabelRow label="Labels">
              <KeyValueEditor
                entries={mapToEntries(item.labels)}
                onChange={(entries) => updateConfigMapItem(index, (prev) => ({ ...prev, labels: entriesToMap(entries) }))}
              />
            </LabelRow>
            <LabelRow label="Annotations">
              <KeyValueEditor
                entries={mapToEntries(item.annotations)}
                onChange={(entries) => updateConfigMapItem(index, (prev) => ({ ...prev, annotations: entriesToMap(entries) }))}
              />
            </LabelRow>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Namespace Override</label>
              <Combobox
                value={item.namespace || ''}
                onChange={(v) => updateConfigMapItem(index, (prev) => ({ ...prev, namespace: v || undefined }))}
                options={namespaces}
                placeholder="Leave empty to use default"
                allowCustom
                size="sm"
              />
            </div>
          </ResourceItemCard>
        ))}
        <button
          onClick={() => updateItemList('configMap', (items) => [...items, createConfigMapItem()])}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          + Add ConfigMap
        </button>
      </SectionCard>

      {/* Secret */}
      <SectionCard
        title="Secret"
        description="Sensitive data stored securely."
        icon={Shield}
        enabled={draft.secret.enabled}
        onToggle={() => toggleSection('secret')}
      >
        {(draft.secret.data as SecretItem[]).map((item, index) => (
          <ResourceItemCard
            key={`${item.name}-${index}`}
            title={`Secret ${index + 1}`}
            onRemove={draft.secret.data.length > 1 ? () => updateItemList('secret', (items) => items.filter((_, idx) => idx !== index)) : undefined}
          >
            <InputField label="Name" value={item.name} onChange={(v) => updateSecretItem(index, (prev) => ({ ...prev, name: v }))} placeholder="my-secret" />
            <LabelRow label="Data Entries">
              <KeyValueEditor
                entries={item.entries}
                onChange={(entries) => updateSecretItem(index, (prev) => ({ ...prev, entries }))}
              />
            </LabelRow>
            <LabelRow label="Labels">
              <KeyValueEditor
                entries={mapToEntries(item.labels)}
                onChange={(entries) => updateSecretItem(index, (prev) => ({ ...prev, labels: entriesToMap(entries) }))}
              />
            </LabelRow>
            <LabelRow label="Annotations">
              <KeyValueEditor
                entries={mapToEntries(item.annotations)}
                onChange={(entries) => updateSecretItem(index, (prev) => ({ ...prev, annotations: entriesToMap(entries) }))}
              />
            </LabelRow>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Namespace Override</label>
              <Combobox
                value={item.namespace || ''}
                onChange={(v) => updateSecretItem(index, (prev) => ({ ...prev, namespace: v || undefined }))}
                options={namespaces}
                placeholder="Leave empty to use default"
                allowCustom
                size="sm"
              />
            </div>
          </ResourceItemCard>
        ))}
        <button
          onClick={() => updateItemList('secret', (items) => [...items, createSecretItem()])}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          + Add Secret
        </button>
      </SectionCard>

      {/* Other Resources */}
      <OtherResourcesSection
        draft={draft}
        namespaces={namespaces}
        addAdditionalResource={addAdditionalResource}
        removeAdditionalResourceType={removeAdditionalResourceType}
        updateAdditionalResource={updateAdditionalResource}
        addAdditionalResourceItem={addAdditionalResourceItem}
        removeAdditionalResourceItem={removeAdditionalResourceItem}
      />

      {/* Generated YAML Preview */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Generated YAML</h4>
            <p className="text-xs text-slate-500">Preview the manifest before applying.</p>
          </div>
          <button
            onClick={() => setShowYaml((prev) => !prev)}
            className={clsx(
              'px-3 py-1.5 rounded text-xs font-medium transition-colors',
              showYaml ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
          >
            {showYaml ? 'Hide' : 'Show'} YAML
          </button>
        </div>
        {showYaml && (
          <textarea
            value={yamlPreview}
            readOnly
            className="mt-3 w-full h-48 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
          />
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={handleApply}
          disabled={isSubmitting}
          className={clsx(
            'px-4 py-2 rounded text-sm font-medium transition-colors',
            isSubmitting
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          {isSubmitting ? 'Creating...' : 'Create Resources'}
        </button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                        Other Resources Section                             */
/* -------------------------------------------------------------------------- */

const OtherResourcesSection: React.FC<{
  draft: AppDraft;
  namespaces: string[];
  addAdditionalResource: (resourceTypeId: string, defaultItem: GenericResourceItem) => void;
  removeAdditionalResourceType: (resourceTypeId: string) => void;
  updateAdditionalResource: (resourceTypeId: string, index: number, updates: Partial<GenericResourceItem>) => void;
  addAdditionalResourceItem: (resourceTypeId: string, defaultItem: GenericResourceItem) => void;
  removeAdditionalResourceItem: (resourceTypeId: string, index: number) => void;
}> = ({
  draft,
  namespaces,
  addAdditionalResource,
  removeAdditionalResourceType,
  updateAdditionalResource,
  addAdditionalResourceItem,
  removeAdditionalResourceItem,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Get resource types that are not yet added
  const availableTypes = OTHER_RESOURCE_TYPES.filter(
    (rt) => !draft.additionalResources[rt.id]
  );

  const handleAddResourceType = (resourceType: ResourceTypeConfig) => {
    const defaultItem = resourceType.defaultItem() as GenericResourceItem;
    defaultItem.labels = {};
    defaultItem.annotations = {};
    addAdditionalResource(resourceType.id, defaultItem);
    setShowAddMenu(false);
  };

  const activeAdditionalTypes = Object.keys(draft.additionalResources)
    .map((id) => OTHER_RESOURCE_TYPES.find((rt) => rt.id === id))
    .filter((rt): rt is ResourceTypeConfig => rt !== undefined);

  if (activeAdditionalTypes.length === 0 && availableTypes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Render active additional resources */}
      {activeAdditionalTypes.map((resourceType) => {
        const section = draft.additionalResources[resourceType.id];
        if (!section) return null;

        return (
          <div key={resourceType.id} className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800">
                  <resourceType.icon size={16} className="text-slate-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">{resourceType.label}</h4>
                  <p className="text-xs text-slate-500">{resourceType.description}</p>
                </div>
              </div>
              <button
                onClick={() => removeAdditionalResourceType(resourceType.id)}
                className="px-3 py-1.5 rounded text-xs font-medium bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-900/50 transition-colors"
              >
                Remove
              </button>
            </div>
            <div className="p-4 space-y-4">
              {section.data.map((item, index) => (
                <DynamicResourceItemCard
                  key={`${item.name}-${index}`}
                  resourceType={resourceType}
                  item={item}
                  index={index}
                  namespaces={namespaces}
                  onUpdate={(updates) => updateAdditionalResource(resourceType.id, index, updates)}
                  onRemove={section.data.length > 1 ? () => removeAdditionalResourceItem(resourceType.id, index) : undefined}
                />
              ))}
              <button
                onClick={() => {
                  const defaultItem = resourceType.defaultItem() as GenericResourceItem;
                  defaultItem.labels = {};
                  defaultItem.annotations = {};
                  addAdditionalResourceItem(resourceType.id, defaultItem);
                }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add {resourceType.label}
              </button>
            </div>
          </div>
        );
      })}

      {/* Add Other Resource button */}
      {availableTypes.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors w-full"
          >
            <MoreHorizontal size={16} />
            <span>Add Other Resource</span>
            <ChevronDown size={14} className={clsx('ml-auto transition-transform', showAddMenu && 'rotate-180')} />
          </button>
          
          {showAddMenu && (
            <div className="absolute z-[300] top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
              <div className="p-2 max-h-64 overflow-y-auto">
                {availableTypes.map((rt) => (
                  <button
                    key={rt.id}
                    onClick={() => handleAddResourceType(rt)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700/50 rounded transition-colors text-left"
                  >
                    <div className="p-1.5 rounded bg-slate-700">
                      <rt.icon size={14} className="text-slate-400" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-200">{rt.label}</div>
                      <div className="text-xs text-slate-500">{rt.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                    Dynamic Resource Item Card                              */
/* -------------------------------------------------------------------------- */

const DynamicResourceItemCard: React.FC<{
  resourceType: ResourceTypeConfig;
  item: GenericResourceItem;
  index: number;
  namespaces: string[];
  onUpdate: (updates: Partial<GenericResourceItem>) => void;
  onRemove?: () => void;
}> = ({ resourceType, item, index, namespaces, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(true);

  const mapToEntries = (map: Record<string, string>) =>
    Object.entries(map).map(([key, value]) => ({ key, value }));

  const entriesToMap = (entries: Array<{ key: string; value: string }>) =>
    entries.reduce<Record<string, string>>((acc, entry) => {
      if (entry.key) acc[entry.key] = entry.value;
      return acc;
    }, {});

  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden mb-4">
      <div
        className="px-4 py-2 bg-slate-900 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
          <span className="text-sm font-medium text-slate-300">{resourceType.label} {index + 1}</span>
        </div>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Render fields based on resourceType.fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resourceType.fields.map((field) => {
              if (field.type === 'keyvalue') {
                return (
                  <div key={field.key} className={clsx('space-y-2', field.colSpan === 2 && 'md:col-span-2', field.colSpan === 3 && 'md:col-span-3')}>
                    <div className="text-xs font-bold text-slate-500 uppercase">{field.label}</div>
                    <KeyValueEditor
                      entries={Array.isArray(item[field.key]) ? (item[field.key] as Array<{ key: string; value: string }>) : mapToEntries((item[field.key] as Record<string, string>) || {})}
                      onChange={(entries) => onUpdate({ [field.key]: field.key === 'data' || field.key === 'env' ? entries : entriesToMap(entries) })}
                    />
                  </div>
                );
              }
              if (field.type === 'select') {
                return (
                  <div key={field.key} className={clsx(field.colSpan === 2 && 'md:col-span-2')}>
                    <label className="text-xs text-slate-400 mb-1 block">{field.label}</label>
                    <select
                      value={String(item[field.key] || '')}
                      onChange={(e) => onUpdate({ [field.key]: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              return (
                <div key={field.key} className={clsx(field.colSpan === 2 && 'md:col-span-2')}>
                  <label className="text-xs text-slate-400 mb-1 block">{field.label}</label>
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={String(item[field.key] || '')}
                    onChange={(e) => onUpdate({ [field.key]: field.type === 'number' ? Number(e.target.value) || 0 : e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              );
            })}
          </div>

          {/* Labels and Annotations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 uppercase">Labels</div>
              <KeyValueEditor
                entries={mapToEntries(item.labels || {})}
                onChange={(entries) => onUpdate({ labels: entriesToMap(entries) })}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 uppercase">Annotations</div>
              <KeyValueEditor
                entries={mapToEntries(item.annotations || {})}
                onChange={(entries) => onUpdate({ annotations: entriesToMap(entries) })}
              />
            </div>
          </div>

          {/* Namespace Override */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Namespace Override</label>
            <Combobox
              value={(item.namespace as string) || ''}
              onChange={(v) => onUpdate({ namespace: v || undefined })}
              options={namespaces}
              placeholder="Leave empty to use default"
              allowCustom
              size="sm"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                           Shared Components                                */
/* -------------------------------------------------------------------------- */

const SectionCard: React.FC<{
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

const ResourceItemCard: React.FC<{
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
}> = ({ title, onRemove, children }) => {
  const [expanded, setExpanded] = useState(true);

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

const InputField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
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

const LabelRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-2">
    <div className="text-xs font-bold text-slate-500 uppercase">{label}</div>
    {children}
  </div>
);

const KeyValueEditor: React.FC<{
  entries: Array<{ key: string; value: string }>;
  onChange: (entries: Array<{ key: string; value: string }>) => void;
}> = ({ entries, onChange }) => {
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
            placeholder="Key"
          />
          <input
            value={entry.value}
            onChange={(e) => handleUpdate(idx, 'value', e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            placeholder="Value"
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
