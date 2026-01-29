import React, { useEffect, useRef, useMemo } from 'react';
import { useResourceDetailsStore } from '../store/useResourceDetailsStore';
import { X, Maximize2, Minimize2, Layers, Radio } from 'lucide-react';
import { clsx } from 'clsx';
import { DeploymentView, deploymentTabs } from './resources/deployment/DeploymentView';
import { ServiceView, serviceTabs } from './resources/service/ServiceView';
import { PodView, podTabs } from './resources/pod/PodView';
import { IngressView, ingressTabs } from './resources/ingress/IngressView';
import { ConfigMapView, configMapTabs } from './resources/configmap/ConfigMapView';
import { SecretView, secretTabs } from './resources/secret/SecretView';
import { JobView, jobTabs } from './resources/job/JobView';
import { CronJobView, cronJobTabs } from './resources/cronjob/CronJobView';
import { HPAView, hpaTabs } from './resources/hpa/HPAView';
import { ApplicationView, applicationTabs } from './resources/application/ApplicationView';
import { HelmReleaseView, helmReleaseTabs } from './resources/helmrelease/HelmReleaseView';
import { PVCView, pvcTabs } from './resources/persistentvolumeclaim/PVCView';
import { StorageClassView, storageClassTabs } from './resources/storageclass/StorageClassView';
import { GenericView, genericTabs } from './resources/generic/GenericView';
import type { ClusterResource } from '../api/types';
import { useClusterStore } from '../store/useClusterStore';

// Map resource kinds to their specific views (defined outside component to avoid recreation)
const viewMap: Record<string, { view: React.FC<{ resource: ClusterResource; activeTab: string }>; tabs: Array<{ id: string; label: string }> }> = {
  'Deployment': { view: DeploymentView, tabs: deploymentTabs },
  'Service': { view: ServiceView, tabs: serviceTabs },
  'Pod': { view: PodView, tabs: podTabs },
  'Ingress': { view: IngressView, tabs: ingressTabs },
  'ConfigMap': { view: ConfigMapView, tabs: configMapTabs },
  'Secret': { view: SecretView, tabs: secretTabs },
  'Job': { view: JobView, tabs: jobTabs },
  'CronJob': { view: CronJobView, tabs: cronJobTabs },
  'HorizontalPodAutoscaler': { view: HPAView, tabs: hpaTabs },
  'Application': { view: ApplicationView, tabs: applicationTabs },
  'HelmRelease': { view: HelmReleaseView, tabs: helmReleaseTabs },
  'PersistentVolumeClaim': { view: PVCView, tabs: pvcTabs },
  'StorageClass': { view: StorageClassView, tabs: storageClassTabs },
};

export const ResourceDetailsWindow: React.FC = () => {
  const { isOpen, resourceId, closeDetails, activeTab, setActiveTab } = useResourceDetailsStore();
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isWatching, setIsWatching] = React.useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  // Track the current watch target to avoid restarting unnecessarily
  const watchTargetRef = useRef<string | null>(null);
  
  // Get the live resource from the main store
  const resource = useClusterStore(state => resourceId ? state.resources[resourceId] : null);
  const client = useClusterStore(state => state.client);
  const updateResourceRaw = useClusterStore(state => state.updateResourceRaw);

  // Create a stable watch key that only changes when the actual resource identity changes
  // NOT when the resource data (raw) changes
  const watchKey = useMemo(() => {
    if (!resource) return null;
    return `${resource.kind}/${resource.namespace}/${resource.name}`;
  }, [resource?.kind, resource?.namespace, resource?.name]);

  // Auto-maximize when resourceId changes (new resource opened)
  useEffect(() => {
    if (resourceId) {
      setIsMinimized(false);
    }
  }, [resourceId]);

  // Start/stop single resource watch when window opens/closes
  // CRITICAL: Only restart watch when the IDENTITY changes, not the data
  useEffect(() => {
    // Skip if not open or no resource
    if (!isOpen || !resource || !client || !watchKey) {
      // Cleanup existing watch if conditions are no longer met
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
        watchTargetRef.current = null;
      }
      setIsWatching(false);
      return;
    }

    // Skip if we're already watching this exact resource
    if (watchTargetRef.current === watchKey) {
      return;
    }

    // Cleanup any existing watch before starting a new one
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    // Start dedicated watch for this resource
    const resourceIdCaptured = resource.id; // Capture for callback
    const cleanup = client.startSingleResourceWatch(
      resource.kind,
      resource.namespace,
      resource.name,
      (event) => {
        if (event.type === 'MODIFIED' || event.type === 'ADDED') {
          // Update the resource in the store with full raw data
          updateResourceRaw(resourceIdCaptured, event.resource);
        }
      }
    );
    
    cleanupRef.current = cleanup;
    watchTargetRef.current = watchKey;
    setIsWatching(true);
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      watchTargetRef.current = null;
      setIsWatching(false);
    };
  }, [isOpen, watchKey, client, updateResourceRaw, resource?.id, resource?.kind, resource?.namespace, resource?.name]);

  // Cleanup on close
  const handleClose = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    watchTargetRef.current = null;
    setIsWatching(false);
    closeDetails();
  };

  if (!isOpen || !resource) return null;

  // Determine which component and tabs to use
  const viewConfig = viewMap[resource.kind] || { view: GenericView, tabs: genericTabs };
  const ViewComponent = viewConfig.view;
  const tabs = viewConfig.tabs;

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
