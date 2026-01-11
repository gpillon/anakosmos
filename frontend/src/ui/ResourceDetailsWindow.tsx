import React, { useEffect, useRef } from 'react';
import { useResourceDetailsStore } from '../store/useResourceDetailsStore';
import { X, Maximize2, Minimize2, Layers, Radio } from 'lucide-react';
import { clsx } from 'clsx';
import { DeploymentView, deploymentTabs } from './resources/deployment/DeploymentView';
import { ServiceView, serviceTabs } from './resources/service/ServiceView';
import type { ClusterResource } from '../api/types';
import Editor from '@monaco-editor/react';
import { useClusterStore } from '../store/useClusterStore';

export const ResourceDetailsWindow: React.FC = () => {
  const { isOpen, resourceId, closeDetails, activeTab, setActiveTab } = useResourceDetailsStore();
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isWatching, setIsWatching] = React.useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  // Get the live resource from the main store
  const resource = useClusterStore(state => resourceId ? state.resources[resourceId] : null);
  const client = useClusterStore(state => state.client);
  const updateResourceRaw = useClusterStore(state => state.updateResourceRaw);

  // Auto-maximize when resourceId changes (new resource opened)
  useEffect(() => {
    if (resourceId) {
      setIsMinimized(false);
    }
  }, [resourceId]);

  // Start/stop single resource watch when window opens/closes
  useEffect(() => {
    if (isOpen && resource && client) {
      // Start dedicated watch for this resource
      const cleanup = client.startSingleResourceWatch(
        resource.kind,
        resource.namespace,
        resource.name,
        (event) => {
          if (event.type === 'MODIFIED' || event.type === 'ADDED') {
            // Update the resource in the store with full raw data
            updateResourceRaw(resource.id, event.resource);
          }
        }
      );
      
      cleanupRef.current = cleanup;
      setIsWatching(true);
      
      return () => {
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
        setIsWatching(false);
      };
    }
  }, [isOpen, resource?.id, resource?.kind, resource?.namespace, resource?.name, client, updateResourceRaw]);

  // Cleanup on close
  const handleClose = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setIsWatching(false);
    closeDetails();
  };

  if (!isOpen || !resource) return null;

  // Determine which component and tabs to use
  let ViewComponent: React.FC<{ resource: ClusterResource; activeTab: string }> = DefaultView;
  let tabs = defaultTabs;

  if (resource.kind === 'Deployment') {
    ViewComponent = DeploymentView;
    tabs = deploymentTabs;
  } else if (resource.kind === 'Service') {
    ViewComponent = ServiceView;
    tabs = serviceTabs;
  }

  return (
    <div className={clsx(
      "fixed z-50 bg-slate-950 border border-slate-700 shadow-2xl transition-all duration-300 flex flex-col font-mono text-sm",
      isMinimized 
        ? "bottom-0 left-0 w-96 h-12 rounded-t-lg overflow-hidden" 
        : "inset-x-20 bottom-20 top-20 rounded-lg"
    )}>
      {/* Header / Tab Bar */}
      <div className="flex items-center bg-slate-900 border-b border-slate-800 h-12 shrink-0">
        <div className="flex-1 flex overflow-x-auto h-full">
          <div 
            className={clsx(
              "flex items-center gap-2 px-4 cursor-pointer border-r border-slate-800 min-w-[150px] max-w-[200px] hover:bg-slate-800 transition-colors group h-full relative",
              "bg-slate-950 text-blue-400 border-t-2 border-t-blue-500"
            )}
          >
            <Layers size={14} />
            <span className="truncate text-xs font-medium flex-1">{resource.kind}: {resource.name}</span>
            {/* Live indicator */}
            {isWatching && (
              <Radio size={10} className="animate-pulse text-emerald-400" />
            )}
          </div>
          
          {/* Tabs (when not minimized) */}
          {!isMinimized && tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-2 px-4 border-r border-slate-800 min-w-[100px] hover:bg-slate-800 transition-colors h-full relative",
                activeTab === tab.id 
                  ? "bg-slate-950 text-blue-400 border-t-2 border-t-blue-500" 
                  : "text-slate-500 border-t-2 border-t-transparent bg-slate-900"
              )}
            >
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-1 px-2 border-l border-slate-800 bg-slate-900 h-full">
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-slate-800 text-slate-400 rounded"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={clsx("flex-1 relative overflow-hidden bg-black", isMinimized ? "hidden" : "block")}>
        <ViewComponent resource={resource} activeTab={activeTab} />
      </div>
    </div>
  );
};

// Default generic view for other resources
const defaultTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
];

const DefaultView: React.FC<{ resource: ClusterResource; activeTab: string }> = ({ resource, activeTab }) => {
    const { client } = useClusterStore();
    const [yamlContent, setYamlContent] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (activeTab === 'yaml' && client) {
            setLoading(true);
            client.getYaml(resource.namespace, resource.kind, resource.name)
                .then(setYamlContent)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [activeTab, resource, client]);

    if (activeTab === 'yaml') {
        return (
            <div className="h-full w-full bg-[#1e1e1e]">
                {loading && <div className="text-slate-400 p-4">Loading YAML...</div>}
                {!loading && (
                    <Editor
                        height="100%"
                        defaultLanguage="yaml"
                        theme="vs-dark"
                        value={yamlContent}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 12,
                            readOnly: true
                        }}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="p-6 text-slate-300">
            <h2 className="text-xl font-bold mb-4">{resource.name}</h2>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                    <h3 className="font-bold text-slate-400 mb-2">Details</h3>
                    <pre className="text-xs overflow-auto">
                        {JSON.stringify(resource, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
};
