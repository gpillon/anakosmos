import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Play, 
  RefreshCw,
  Eye,
  Trash2
} from 'lucide-react';
import { clsx } from 'clsx';
import yaml from 'js-yaml';
import type { KubeClient } from '../../../api/kubeClient';
import { useApplicationDraftStore, type DraftResource } from '../../../store/useApplicationDraftStore';
import { Combobox } from '../../resources/shared/Combobox';
import { KIND_CONFIG } from '../../../config/resourceKinds';
import { BlueprintSelector } from './BlueprintSelector';
import { ApplicationResourceCard, EmptyResourceState } from './ApplicationResourceCard';
import { DraftResourceEditor } from './DraftResourceEditor';
import { AddResourceDialog } from './AddResourceDialog';
import type { Blueprint } from '../../../store/useApplicationDraftStore';

interface ApplicationCreationTabProps {
  client: KubeClient | null;
  namespaces: string[];
  setError: (error: string) => void;
  setStatusMessage: (message: string | null) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
}

export const ApplicationCreationTab: React.FC<ApplicationCreationTabProps> = ({
  client,
  namespaces,
  setError,
  setStatusMessage,
  isSubmitting,
  setIsSubmitting,
}) => {
  // Draft store
  const {
    appName,
    namespace,
    resources,
    selectedBlueprintId,
    setAppName,
    setNamespace,
    applyBlueprint,
    addResource,
    updateResource,
    removeResource,
    reset,
  } = useApplicationDraftStore();
  
  // Track original blueprint snapshot for customization detection
  const blueprintSnapshotRef = useRef<string | null>(null);
  
  // Update snapshot when blueprint changes
  useEffect(() => {
    if (selectedBlueprintId && resources.length > 0) {
      // Only set snapshot once when blueprint is first applied
      if (blueprintSnapshotRef.current === null) {
        blueprintSnapshotRef.current = JSON.stringify(
          resources.map(r => ({ kind: r.kind, name: (r.spec.metadata as Record<string, unknown>)?.name }))
        );
      }
    } else if (!selectedBlueprintId) {
      blueprintSnapshotRef.current = null;
    }
  }, [selectedBlueprintId, resources]);
  
  // Check if resources are customized from original blueprint
  const isCustomized = useMemo(() => {
    if (!selectedBlueprintId || !blueprintSnapshotRef.current) return false;
    const currentSnapshot = JSON.stringify(
      resources.map(r => ({ kind: r.kind, name: (r.spec.metadata as Record<string, unknown>)?.name }))
    );
    return currentSnapshot !== blueprintSnapshotRef.current;
  }, [selectedBlueprintId, resources]);
  
  // Compute resource count by kind (stable useMemo to avoid infinite loops)
  const resourceCountByKind = useMemo(() => {
    return resources.reduce((acc, r) => {
      acc[r.kind] = (acc[r.kind] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [resources]);
  
  // Local UI state
  const [editingResource, setEditingResource] = useState<DraftResource | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showYamlPreview, setShowYamlPreview] = useState(false);
  
  // Generate YAML preview
  const yamlPreview = useMemo(() => {
    if (resources.length === 0) return '';
    const specs = resources.map(r => ({
      ...r.spec,
      metadata: {
        ...(r.spec.metadata as Record<string, unknown> || {}),
        namespace: (r.spec.metadata as Record<string, unknown>)?.namespace || namespace,
      },
    }));
    return specs.map(spec => yaml.dump(spec, { noRefs: true, lineWidth: 120 })).join('\n---\n');
  }, [resources, namespace]);
  
  // Group resources by kind for display
  const resourcesByKind = useMemo(() => {
    const grouped: Record<string, DraftResource[]> = {};
    for (const resource of resources) {
      if (!grouped[resource.kind]) {
        grouped[resource.kind] = [];
      }
      grouped[resource.kind].push(resource);
    }
    return grouped;
  }, [resources]);
  
  // Handle blueprint selection
  const handleSelectBlueprint = useCallback((blueprint: Blueprint) => {
    blueprintSnapshotRef.current = null; // Reset snapshot before applying
    applyBlueprint(blueprint);
  }, [applyBlueprint]);
  
  // Handle adding a resource (marks as customized)
  const handleAddResource = useCallback((kind: string, spec: Record<string, unknown>) => {
    const specWithNs = {
      ...spec,
      metadata: {
        ...(spec.metadata as Record<string, unknown> || {}),
        namespace,
      },
    };
    addResource(kind, specWithNs);
  }, [addResource, namespace]);
  
  // Handle saving edited resource
  const handleSaveResource = useCallback((updatedSpec: Record<string, unknown>) => {
    if (editingResource) {
      updateResource(editingResource.id, updatedSpec);
      setEditingResource(null);
    }
  }, [editingResource, updateResource]);
  
  // Handle creating all resources
  const handleCreate = useCallback(async () => {
    if (!client || resources.length === 0) return;
    
    setIsSubmitting(true);
    setStatusMessage(null);
    
    try {
      const yamlContent = yamlPreview;
      await client.applyYamlBatch(yamlContent, namespace);
      
      setStatusMessage(`Successfully created ${resources.length} resource(s) for "${appName}"`);
      blueprintSnapshotRef.current = null;
      reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create resources';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [client, resources, yamlPreview, appName, setIsSubmitting, setStatusMessage, setError, reset]);
  
  // Summary stats
  const totalResources = resources.length;
  const kindCount = Object.keys(resourcesByKind).length;
  
  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header - compact */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Create Application</h3>
              <p className="text-xs text-slate-500">
                Build a multi-resource application
              </p>
            </div>
          </div>
          
          {totalResources > 0 && (
            <button
              onClick={() => {
                blueprintSnapshotRef.current = null;
                reset();
              }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 size={12} />
              Clear
            </button>
          )}
        </div>
        
        {/* App metadata - inline */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">App Name</label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="my-app"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
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
        </div>
      </div>
      
      {/* Blueprint Selector - collapsible */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-3 shrink-0">
        <BlueprintSelector 
          selectedId={selectedBlueprintId}
          isCustomized={isCustomized}
          onSelect={handleSelectBlueprint}
        />
      </div>
      
      {/* Resources Section - takes remaining space with good min height */}
      <div className="flex-1 min-h-[350px] flex flex-col bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
        {/* Section Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-200">Resources</span>
            {totalResources > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                  {totalResources}
                </span>
                <span className="text-xs text-slate-500">
                  ({kindCount} type{kindCount !== 1 ? 's' : ''})
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {totalResources > 0 && (
              <button
                onClick={() => setShowYamlPreview(!showYamlPreview)}
                className={clsx(
                  'flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg transition-colors',
                  showYamlPreview
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                )}
              >
                <Eye size={12} />
                {showYamlPreview ? 'Cards' : 'YAML'}
              </button>
            )}
            <button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg transition-colors"
            >
              <Plus size={12} />
              Add
            </button>
          </div>
        </div>
        
        {/* Resource List or Empty State */}
        <div className="flex-1 overflow-y-auto p-3">
          {showYamlPreview ? (
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 h-full overflow-auto">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                {yamlPreview || '# No resources configured'}
              </pre>
            </div>
          ) : totalResources === 0 ? (
            <EmptyResourceState onSelectBlueprint={() => {}} />
          ) : (
            <div className="space-y-4">
              {Object.entries(resourcesByKind).map(([kind, kindResources]) => {
                const kindConfig = KIND_CONFIG.find(k => k.kind === kind);
                const Icon = kindConfig?.icon;
                
                return (
                  <div key={kind}>
                    {/* Kind header */}
                    <div className="flex items-center gap-2 mb-2">
                      {Icon && <Icon size={12} className="text-slate-500" />}
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                        {kindConfig?.label || kind}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        ({kindResources.length})
                      </span>
                    </div>
                    
                    {/* Resources of this kind */}
                    <div className="space-y-1.5">
                      {kindResources.map((resource) => (
                        <ApplicationResourceCard
                          key={resource.id}
                          resource={resource}
                          onEdit={() => setEditingResource(resource)}
                          onDelete={() => removeResource(resource.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer / Actions */}
      <div className="flex items-center justify-between py-1 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {totalResources > 0 && (
            <span>
              {Object.entries(resourceCountByKind).map(([k, v]) => `${v} ${k}`).join(', ')}
            </span>
          )}
        </div>
        
        <button
          onClick={handleCreate}
          disabled={isSubmitting || totalResources === 0}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            isSubmitting || totalResources === 0
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
          )}
        >
          {isSubmitting ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Play size={14} />
              Create Application
            </>
          )}
        </button>
      </div>
      
      {/* Modals */}
      {editingResource && (
        <DraftResourceEditor
          resource={editingResource}
          onSave={handleSaveResource}
          onClose={() => setEditingResource(null)}
        />
      )}
      
      {showAddDialog && (
        <AddResourceDialog
          onAdd={handleAddResource}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
};
