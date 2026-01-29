/**
 * DraftResourceEditor - Rich editor for draft resources
 * 
 * This component reuses the existing tabs from /ui/resources to provide
 * a rich editing experience for draft resources. It creates an adapter
 * that makes draft resources work with the existing tab components.
 * 
 * Supported resource types get rich UI, others fall back to YAML.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { X, Save, AlertCircle, FileJson, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import Editor from '@monaco-editor/react';
import yaml from 'js-yaml';
import type { DraftResource } from '../../../store/useApplicationDraftStore';
import type { ClusterResource } from '../../../api/types';
import type { 
  V1Deployment, 
  V1Service, 
  V1Ingress, 
  V1ConfigMap, 
  V1Secret,
  V1Job,
  V1CronJob,
  V2HorizontalPodAutoscaler,
  V1PersistentVolumeClaim,
  V1StorageClass,
} from '../../../api/k8s-types';
import { KIND_CONFIG, KIND_COLOR_MAP, DEFAULT_COLOR } from '../../../config/resourceKinds';

// Import existing tabs for rich editing - Deployment
import { DeploymentOverview } from '../../resources/deployment/tabs/DeploymentOverview';
import { DeploymentContainers } from '../../resources/deployment/tabs/DeploymentContainers';
import { DeploymentVolumes } from '../../resources/deployment/tabs/DeploymentVolumes';

// Service
import { ServiceOverview } from '../../resources/service/tabs/ServiceOverview';
import { ServicePorts } from '../../resources/service/tabs/ServicePorts';

// Ingress
import { IngressOverview } from '../../resources/ingress/tabs/IngressOverview';
import { IngressRules } from '../../resources/ingress/tabs/IngressRules';
import { IngressTLS } from '../../resources/ingress/tabs/IngressTLS';

// ConfigMap
import { ConfigMapOverview } from '../../resources/configmap/tabs/ConfigMapOverview';
import { ConfigMapData } from '../../resources/configmap/tabs/ConfigMapData';

// Secret
import { SecretOverview } from '../../resources/secret/tabs/SecretOverview';
import { SecretData } from '../../resources/secret/tabs/SecretData';

// Job
import { JobOverview } from '../../resources/job/tabs/JobOverview';
import { JobPodTemplate } from '../../resources/job/tabs/JobPodTemplate';

// CronJob
import { CronJobOverview } from '../../resources/cronjob/tabs/CronJobOverview';
import { CronJobJobTemplate } from '../../resources/cronjob/tabs/CronJobJobTemplate';

// HPA
import { HPAOverview } from '../../resources/hpa/tabs/HPAOverview';
import { HPAMetrics } from '../../resources/hpa/tabs/HPAMetrics';
import { HPABehavior } from '../../resources/hpa/tabs/HPABehavior';

// PVC
import { PVCOverview } from '../../resources/persistentvolumeclaim/tabs/PVCOverview';

// StorageClass
import { StorageClassOverview } from '../../resources/storageclass/tabs/StorageClassOverview';
import { StorageClassParameters } from '../../resources/storageclass/tabs/StorageClassParameters';

// Tab configuration for each supported resource type
interface TabConfig {
  id: string;
  label: string;
}

const RESOURCE_TABS: Record<string, TabConfig[]> = {
  Deployment: [
    { id: 'overview', label: 'Overview' },
    { id: 'containers', label: 'Containers' },
    { id: 'volumes', label: 'Volumes' },
    { id: 'yaml', label: 'YAML' },
  ],
  Service: [
    { id: 'overview', label: 'Overview' },
    { id: 'ports', label: 'Ports' },
    { id: 'yaml', label: 'YAML' },
  ],
  Ingress: [
    { id: 'overview', label: 'Overview' },
    { id: 'rules', label: 'Rules' },
    { id: 'tls', label: 'TLS' },
    { id: 'yaml', label: 'YAML' },
  ],
  ConfigMap: [
    { id: 'overview', label: 'Overview' },
    { id: 'data', label: 'Data' },
    { id: 'yaml', label: 'YAML' },
  ],
  Secret: [
    { id: 'overview', label: 'Overview' },
    { id: 'data', label: 'Data' },
    { id: 'yaml', label: 'YAML' },
  ],
  Job: [
    { id: 'overview', label: 'Overview' },
    { id: 'template', label: 'Pod Template' },
    { id: 'yaml', label: 'YAML' },
  ],
  CronJob: [
    { id: 'overview', label: 'Overview' },
    { id: 'template', label: 'Job Template' },
    { id: 'yaml', label: 'YAML' },
  ],
  HorizontalPodAutoscaler: [
    { id: 'overview', label: 'Overview' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'behavior', label: 'Behavior' },
    { id: 'yaml', label: 'YAML' },
  ],
  PersistentVolumeClaim: [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
  ],
  StorageClass: [
    { id: 'overview', label: 'Overview' },
    { id: 'parameters', label: 'Parameters' },
    { id: 'yaml', label: 'YAML' },
  ],
};

interface DraftResourceEditorProps {
  resource: DraftResource;
  onSave: (updatedSpec: Record<string, unknown>) => void;
  onClose: () => void;
}

export const DraftResourceEditor: React.FC<DraftResourceEditorProps> = ({
  resource,
  onSave,
  onClose,
}) => {
  // Get initial YAML
  const initialYaml = useMemo(() => {
    try {
      return yaml.dump(resource.spec, { noRefs: true, lineWidth: 120 });
    } catch {
      return '# Failed to serialize resource\n';
    }
  }, [resource.spec]);
  
  // State
  const [model, setModel] = useState<Record<string, unknown>>(
    JSON.parse(JSON.stringify(resource.spec))
  );
  const [yamlContent, setYamlContent] = useState(initialYaml);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);
  
  // Track changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(model) !== JSON.stringify(resource.spec);
  }, [model, resource.spec]);
  
  // Get available tabs for this resource type
  const tabs = RESOURCE_TABS[resource.kind] || [{ id: 'yaml', label: 'YAML' }];
  const hasRichEditor = resource.kind in RESOURCE_TABS;
  
  // Kind config
  const kindConfig = KIND_CONFIG.find(k => k.kind === resource.kind);
  const Icon = kindConfig?.icon;
  const color = KIND_COLOR_MAP[resource.kind] || DEFAULT_COLOR;
  
  // Create a mock ClusterResource for the tabs
  const mockClusterResource: ClusterResource = useMemo(() => {
    const metadata = model.metadata as Record<string, unknown> || {};
    return {
      id: resource.id,
      kind: resource.kind,
      name: String(metadata.name || 'unnamed'),
      namespace: String(metadata.namespace || 'default'),
      status: 'Pending',
      labels: (metadata.labels as Record<string, string>) || {},
      ownerRefs: [],
      creationTimestamp: new Date().toISOString(),
      raw: model,
    };
  }, [resource.id, resource.kind, model]);
  
  // Update model (used by tabs)
  const updateModel = useCallback(<T extends Record<string, unknown>>(
    updater: (current: T) => T
  ) => {
    setModel(current => {
      const updated = updater(current as T);
      // Also update YAML when model changes from rich editor
      try {
        setYamlContent(yaml.dump(updated, { noRefs: true, lineWidth: 120 }));
      } catch {
        // Ignore YAML serialization errors
      }
      return updated;
    });
    setError(null);
  }, []);
  
  // Handle YAML change
  const handleYamlChange = useCallback((value: string | undefined) => {
    setYamlContent(value || '');
    setError(null);
    
    // Try to parse and update model
    try {
      const parsed = yaml.load(value || '') as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        setModel(parsed);
      }
    } catch {
      // Don't update model if YAML is invalid - user may still be typing
    }
  }, []);
  
  // Reset to original
  const handleReset = useCallback(() => {
    const original = JSON.parse(JSON.stringify(resource.spec));
    setModel(original);
    setYamlContent(initialYaml);
    setError(null);
  }, [resource.spec, initialYaml]);
  
  // Save changes
  const handleSave = useCallback(() => {
    // If on YAML tab, parse it first
    if (activeTab === 'yaml') {
      try {
        const parsed = yaml.load(yamlContent) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object') {
          setError('Invalid YAML: must be an object');
          return;
        }
        onSave(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse YAML');
        return;
      }
    } else {
      onSave(model);
    }
  }, [activeTab, yamlContent, model, onSave]);
  
  // Handle escape key
  React.useEffect(() => {
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
  
  const metadata = model.metadata as Record<string, unknown> || {};
  const resourceName = String(metadata.name || 'Unnamed');
  
  // YAML editor component (reused in multiple places)
  const YamlEditor = (
    <div className="h-full">
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
  );
  
  // Render tab content
  const renderTabContent = () => {
    if (activeTab === 'yaml') {
      return YamlEditor;
    }
    
    // Rich editor tabs by resource kind
    switch (resource.kind) {
      case 'Deployment':
        switch (activeTab) {
          case 'overview':
            return (
              <DeploymentOverview
                resource={mockClusterResource}
                model={model as V1Deployment}
                updateModel={updateModel as (updater: (current: V1Deployment) => V1Deployment) => void}
              />
            );
          case 'containers':
            return (
              <DeploymentContainers
                resource={mockClusterResource}
                model={model as V1Deployment}
                updateModel={updateModel as (updater: (current: V1Deployment) => V1Deployment) => void}
              />
            );
          case 'volumes':
            return (
              <DeploymentVolumes
                resource={mockClusterResource}
                model={model as V1Deployment}
                updateModel={updateModel as (updater: (current: V1Deployment) => V1Deployment) => void}
              />
            );
        }
        break;
        
      case 'Service':
        switch (activeTab) {
          case 'overview':
            return (
              <ServiceOverview
                resource={mockClusterResource}
                model={model as V1Service}
                updateModel={updateModel as (updater: (current: V1Service) => V1Service) => void}
              />
            );
          case 'ports':
            return (
              <ServicePorts
                model={model as V1Service}
                updateModel={updateModel as (updater: (current: V1Service) => V1Service) => void}
              />
            );
        }
        break;
        
      case 'Ingress':
        switch (activeTab) {
          case 'overview':
            return (
              <IngressOverview
                resource={mockClusterResource}
                model={model as V1Ingress}
                updateModel={updateModel as (updater: (current: V1Ingress) => V1Ingress) => void}
              />
            );
          case 'rules':
            return (
              <IngressRules
                model={model as V1Ingress}
                updateModel={updateModel as (updater: (current: V1Ingress) => V1Ingress) => void}
              />
            );
          case 'tls':
            return (
              <IngressTLS
                model={model as V1Ingress}
                updateModel={updateModel as (updater: (current: V1Ingress) => V1Ingress) => void}
              />
            );
        }
        break;
        
      case 'ConfigMap':
        switch (activeTab) {
          case 'overview':
            return (
              <ConfigMapOverview
                resource={mockClusterResource}
                model={model as V1ConfigMap}
                updateModel={updateModel as (updater: (current: V1ConfigMap) => V1ConfigMap) => void}
              />
            );
          case 'data':
            return (
              <ConfigMapData
                model={model as V1ConfigMap}
                updateModel={updateModel as (updater: (current: V1ConfigMap) => V1ConfigMap) => void}
              />
            );
        }
        break;
        
      case 'Secret':
        switch (activeTab) {
          case 'overview':
            return (
              <SecretOverview
                resource={mockClusterResource}
                model={model as V1Secret}
                updateModel={updateModel as (updater: (current: V1Secret) => V1Secret) => void}
              />
            );
          case 'data':
            return (
              <SecretData
                model={model as V1Secret}
                updateModel={updateModel as (updater: (current: V1Secret) => V1Secret) => void}
              />
            );
        }
        break;
        
      case 'Job':
        switch (activeTab) {
          case 'overview':
            return (
              <JobOverview
                resource={mockClusterResource}
                model={model as V1Job}
                updateModel={updateModel as (updater: (current: V1Job) => V1Job) => void}
              />
            );
          case 'template':
            return (
              <JobPodTemplate
                model={model as V1Job}
              />
            );
        }
        break;
        
      case 'CronJob':
        switch (activeTab) {
          case 'overview':
            return (
              <CronJobOverview
                resource={mockClusterResource}
                model={model as V1CronJob}
                updateModel={updateModel as (updater: (current: V1CronJob) => V1CronJob) => void}
              />
            );
          case 'template':
            return (
              <CronJobJobTemplate
                model={model as V1CronJob}
              />
            );
        }
        break;
        
      case 'HorizontalPodAutoscaler':
        switch (activeTab) {
          case 'overview':
            return (
              <HPAOverview
                resource={mockClusterResource}
                model={model as V2HorizontalPodAutoscaler}
                updateModel={updateModel as (updater: (current: V2HorizontalPodAutoscaler) => V2HorizontalPodAutoscaler) => void}
              />
            );
          case 'metrics':
            return (
              <HPAMetrics
                model={model as V2HorizontalPodAutoscaler}
                updateModel={updateModel as (updater: (current: V2HorizontalPodAutoscaler) => V2HorizontalPodAutoscaler) => void}
              />
            );
          case 'behavior':
            return (
              <HPABehavior
                model={model as V2HorizontalPodAutoscaler}
                updateModel={updateModel as (updater: (current: V2HorizontalPodAutoscaler) => V2HorizontalPodAutoscaler) => void}
              />
            );
        }
        break;
        
      case 'PersistentVolumeClaim':
        switch (activeTab) {
          case 'overview':
            return (
              <PVCOverview
                model={model as V1PersistentVolumeClaim}
                updateModel={updateModel as (updater: (current: V1PersistentVolumeClaim) => V1PersistentVolumeClaim) => void}
                isCreateMode={true}
              />
            );
        }
        break;
        
      case 'StorageClass':
        switch (activeTab) {
          case 'overview':
            return (
              <StorageClassOverview
                model={model as unknown as V1StorageClass}
                updateModel={updateModel as unknown as (updater: (current: V1StorageClass) => V1StorageClass) => void}
                isCreateMode={true}
              />
            );
          case 'parameters':
            return (
              <StorageClassParameters
                model={model as unknown as V1StorageClass}
                updateModel={updateModel as unknown as (updater: (current: V1StorageClass) => V1StorageClass) => void}
              />
            );
        }
        break;
    }
    
    // Fallback to YAML for any unhandled case
    return YamlEditor;
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-5xl h-[85vh] mx-4 flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/80 shrink-0">
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
            
            {/* Rich editor indicator */}
            {hasRichEditor && (
              <span className="ml-2 px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded-full">
                Rich Editor
              </span>
            )}
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
              disabled={!hasChanges}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-all',
                hasChanges
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
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs shrink-0">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
        
        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              {tab.id === 'yaml' && <FileJson size={12} />}
              {tab.label}
            </button>
          ))}
          
          <div className="flex-1" />
          
          <span className="text-xs text-slate-500">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">⌘S</kbd> to save
          </span>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto bg-black">
          <div className="h-full p-4">
            {renderTabContent()}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-900/80 text-xs text-slate-500 shrink-0">
          <span>
            {hasRichEditor 
              ? 'Use tabs to edit different aspects of your resource'
              : 'Edit the YAML directly - this resource type uses YAML editor'
            }
          </span>
          <span className={clsx(hasChanges ? 'text-amber-400' : 'text-slate-500')}>
            {hasChanges ? '● Unsaved changes' : 'No changes'}
          </span>
        </div>
      </div>
    </div>
  );
};
