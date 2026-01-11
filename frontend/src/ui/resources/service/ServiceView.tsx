import React, { useEffect, useState, useMemo } from 'react';
import type { ClusterResource } from '../../../api/types';
import Editor from '@monaco-editor/react';
import { useClusterStore } from '../../../store/useClusterStore';
import { ServiceOverview } from './ServiceOverview';
import { RefreshCw } from 'lucide-react';

interface ServiceViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const serviceTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'yaml', label: 'YAML' },
];

export const ServiceView: React.FC<ServiceViewProps> = ({ resource, activeTab }) => {
  const { client } = useClusterStore();
  const [yamlContent, setYamlContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchedRaw, setFetchedRaw] = useState<any>(null);
  const [fetchingRaw, setFetchingRaw] = useState(false);

  // Use raw from resource if available, otherwise use fetched raw
  const rawData = resource.raw || fetchedRaw;

  // Create a stable resource version key for forcing re-render of child components
  const resourceKey = useMemo(() => {
    return `${resource.id}-${resource.raw?.metadata?.resourceVersion || 'initial'}`;
  }, [resource.id, resource.raw?.metadata?.resourceVersion]);

  // Fetch raw data if not available in resource
  useEffect(() => {
    if (!resource.raw && !fetchedRaw && !fetchingRaw && client) {
      setFetchingRaw(true);
      client.getResource(resource.namespace, resource.kind, resource.name)
        .then(raw => {
          setFetchedRaw(raw);
        })
        .catch(console.error)
        .finally(() => setFetchingRaw(false));
    }
  }, [resource.raw, resource.namespace, resource.kind, resource.name, fetchedRaw, fetchingRaw, client]);

  // Reset fetchedRaw when resource changes (new version from watcher)
  useEffect(() => {
    if (resource.raw) {
      setFetchedRaw(null);
    }
  }, [resource.raw]);

  // Fetch YAML when tab is active
  useEffect(() => {
    if (activeTab === 'yaml' && client) {
      setLoading(true);
      client.getYaml(resource.namespace, resource.kind, resource.name)
        .then(setYamlContent)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [activeTab, resource.namespace, resource.kind, resource.name, resourceKey, client]);

  const handleSaveYaml = async (value: string | undefined) => {
    if (!value || !client) return;
    try {
      await client.applyYaml(resource.namespace, resource.kind, resource.name, value);
      // Watcher will update the store automatically
    } catch (e) {
      console.error(e);
    }
  };

  // Create a resource object with the raw data for passing to child components
  const fullResource: ClusterResource = useMemo(() => ({
    ...resource,
    raw: rawData
  }), [resource, rawData]);

  if (activeTab === 'yaml') {
    return (
      <div className="h-full w-full bg-[#1e1e1e] relative">
        {loading && <div className="text-slate-400 p-4">Loading YAML...</div>}
        {!loading && (
          <Editor
            height="100%"
            defaultLanguage="yaml"
            theme="vs-dark"
            value={yamlContent}
            onChange={(value) => setYamlContent(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              scrollBeyondLastLine: false,
            }}
          />
        )}
        <div className="absolute bottom-4 right-4 z-10">
          <button 
            onClick={() => handleSaveYaml(yamlContent)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded shadow-lg font-medium text-sm transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </div>
    );
  }

  const isLoading = !rawData;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Live indicator */}
        <div className="flex justify-end mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-900/30 rounded border border-emerald-800/50">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Live Updates
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-slate-400">
              <RefreshCw size={16} className="animate-spin" />
              Loading service details...
            </div>
          </div>
        ) : (
          <ServiceOverview key={resourceKey} resource={fullResource} />
        )}
      </div>
    </div>
  );
};
