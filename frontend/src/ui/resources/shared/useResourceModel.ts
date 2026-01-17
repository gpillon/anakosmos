import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useClusterStore } from '../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../store/useResourceDetailsStore';
import type { ClusterResource } from '../../../api/types';
import type { KubernetesObject } from '../../../api/k8s-types';
import yaml from 'js-yaml';
import { parseKubernetesError, type KubernetesError } from './ValidationErrorContext';

interface UseResourceModelOptions {
  resource: ClusterResource;
  activeTab: string;
  /** If true, the resource is read-only (no editing, no save bar) */
  isReadOnly?: boolean;
}

interface UseResourceModelResult<T extends KubernetesObject> {
  // Original data from server (for comparison)
  originalModel: T | undefined;
  
  // Editable model (what tabs should read from and write to)
  model: T | undefined;
  
  // Update function for tabs to modify the model
  updateModel: (updater: (current: T) => T) => void;
  
  // Direct setter for when you need to replace entire model
  setModel: (newModel: T) => void;
  
  // Whether there are unsaved changes
  hasChanges: boolean;
  
  // Save the current model to the server
  saveModel: () => Promise<void>;
  
  // Discard changes and reset to original
  discardChanges: () => void;
  
  // Saving state
  isSaving: boolean;
  
  // Loading state (initial fetch)
  isLoading: boolean;
  
  // Create a full ClusterResource with the current model
  fullResource: ClusterResource;
  
  // Resource key for forcing re-renders on server updates (use sparingly!)
  resourceKey: string;
  
  // YAML content for YAML tab
  yamlContent: string;
  setYamlContent: (value: string) => void;
  isYamlLoading: boolean;
  handleSaveYaml: (value: string) => Promise<void>;
  
  // Events ref
  eventsRef: React.RefObject<HTMLDivElement | null>;
  scrollToEvents: () => void;
  
  // Delete handler
  handleDelete: () => Promise<void>;
  
  // Server update notification
  /** True when server has a newer version while user has local changes */
  hasServerUpdate: boolean;
  /** New resource version from server (when hasServerUpdate is true) */
  serverResourceVersion: string | undefined;
  /** Reload model from server, discarding local changes */
  reloadFromServer: () => void;
  /** Dismiss the server update notification without reloading */
  dismissServerUpdate: () => void;
  
  // Error handling
  /** Current save error (if any) */
  saveError: KubernetesError | null;
  /** Clear the current save error */
  clearSaveError: () => void;
}

/**
 * Sanitize a Kubernetes resource by removing managedFields to reduce memory/CPU overhead.
 */
function sanitizeResource<T extends KubernetesObject>(raw: unknown): T {
  const cloned = JSON.parse(JSON.stringify(raw)) as T;
  if (cloned?.metadata && typeof cloned.metadata === 'object') {
    const meta = cloned.metadata as Record<string, unknown>;
    delete meta.managedFields;
  }
  return cloned;
}

/**
 * Hook that provides centralized model management for resource views.
 * 
 * The model is held at the parent level (e.g., DeploymentView) and child tabs
 * modify this model. Changes are tracked and a global save bar appears when
 * there are unsaved modifications.
 * 
 * This is designed to:
 * 1. Enable editing across tabs without losing changes
 * 2. Prepare for resource creation (same tabs can be used with an empty model)
 * 3. Use official Kubernetes types from @kubernetes/client-node
 */
export function useResourceModel<T extends KubernetesObject>({ 
  resource, 
  activeTab,
  isReadOnly = false
}: UseResourceModelOptions): UseResourceModelResult<T> {
  const { client } = useClusterStore();
  const closeDetails = useResourceDetailsStore(state => state.closeDetails);
  
  // Refs for tracking state without causing re-renders
  const hasChangesRef = useRef(false);
  const lastResourceVersionRef = useRef<string | undefined>(undefined);
  const initializedRef = useRef(false);
  
  // Original model from server (for comparison and reset)
  const [originalModel, setOriginalModel] = useState<T | undefined>(undefined);
  
  // Editable model (what tabs modify)
  const [model, setModelState] = useState<T | undefined>(undefined);
  
  // Fetching states
  const [fetchingRaw, setFetchingRaw] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // YAML tab state
  const [yamlContent, setYamlContent] = useState('');
  const [isYamlLoading, setIsYamlLoading] = useState(false);
  
  // Server update notification state
  const [hasServerUpdate, setHasServerUpdate] = useState(false);
  const [serverResourceVersion, setServerResourceVersion] = useState<string | undefined>(undefined);
  // Store the latest server data for reload
  const latestServerDataRef = useRef<T | undefined>(undefined);
  
  // Error state
  const [saveError, setSaveError] = useState<KubernetesError | null>(null);
  
  // Events ref
  const eventsRef = useRef<HTMLDivElement>(null);

  // Extract resourceVersion for stable comparison
  const currentResourceVersion = resource.raw?.metadata?.resourceVersion;

  // Initialize model from resource.raw or fetch it - runs ONCE per resource identity
  useEffect(() => {
    // If already initialized for this resource, skip
    if (initializedRef.current) return;
    
    if (resource.raw) {
      const cloned = sanitizeResource<T>(resource.raw);
      initializedRef.current = true;
      lastResourceVersionRef.current = currentResourceVersion;
      latestServerDataRef.current = cloned;
      setOriginalModel(cloned);
      setModelState(JSON.parse(JSON.stringify(cloned)));
    } else if (!fetchingRaw && client) {
      setFetchingRaw(true);
      client.getResource(resource.namespace, resource.kind, resource.name)
        .then(raw => {
          const cloned = sanitizeResource<T>(raw);
          initializedRef.current = true;
          lastResourceVersionRef.current = raw?.metadata?.resourceVersion;
          latestServerDataRef.current = cloned;
          setOriginalModel(cloned);
          setModelState(JSON.parse(JSON.stringify(cloned)));
        })
        .catch(console.error)
        .finally(() => setFetchingRaw(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id]); // Only run when resource identity changes, not on every raw update

  // Handle server updates (from WebSocket)
  useEffect(() => {
    // Skip if not initialized or no raw data
    if (!initializedRef.current || !resource.raw) return;
    
    // Skip if resourceVersion hasn't changed
    if (currentResourceVersion === lastResourceVersionRef.current) return;
    
    // Store the latest server data
    const cloned = sanitizeResource<T>(resource.raw);
    latestServerDataRef.current = cloned;
    
    // If user has local changes, notify them instead of overwriting
    if (hasChangesRef.current) {
      setHasServerUpdate(true);
      setServerResourceVersion(currentResourceVersion);
      // Update the original model so we know what the "base" is
      setOriginalModel(cloned);
    } else {
      // No local changes - apply update immediately
      lastResourceVersionRef.current = currentResourceVersion;
      setOriginalModel(cloned);
      setModelState(JSON.parse(JSON.stringify(cloned)));
      // Clear any existing notification
      setHasServerUpdate(false);
      setServerResourceVersion(undefined);
    }
  }, [currentResourceVersion, resource.raw]);

  // Reset initialization when resource identity changes
  useEffect(() => {
    return () => {
      initializedRef.current = false;
      lastResourceVersionRef.current = undefined;
      hasChangesRef.current = false;
      latestServerDataRef.current = undefined;
    };
  }, [resource.id]);

  // Clear errors when resource changes
  useEffect(() => {
    setSaveError(null);
  }, [resource.id]);

  // Create stable resource key for forcing re-render (use sparingly!)
  const resourceKey = useMemo(() => {
    return `${resource.id}-${currentResourceVersion || 'initial'}`;
  }, [resource.id, currentResourceVersion]);

  // Check if there are unsaved changes - use a stable comparison
  const hasChanges = useMemo(() => {
    if (isReadOnly || !model || !originalModel) return false;
    // Stringify once and compare
    const modelStr = JSON.stringify(model);
    const originalStr = JSON.stringify(originalModel);
    const changed = modelStr !== originalStr;
    // Update ref synchronously within useMemo is safe
    hasChangesRef.current = changed;
    return changed;
  }, [model, originalModel, isReadOnly]);

  // Update function for tabs - allows functional updates
  const updateModel = useCallback((updater: (current: T) => T) => {
    setModelState(current => {
      if (!current) return current;
      const updated = updater(current);
      return updated;
    });
    // Clear errors when user makes changes
    setSaveError(null);
  }, []);

  // Direct setter when needed
  const setModel = useCallback((newModel: T) => {
    setModelState(newModel);
    // Clear errors when model changes
    setSaveError(null);
  }, []);

  // Save model to server
  const saveModel = useCallback(async () => {
    if (!client || !model || isReadOnly) {
      throw new Error('Cannot save: no client, no model, or read-only');
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const yamlStr = yaml.dump(model);
      await client.applyYaml(resource.namespace, resource.kind, resource.name, yamlStr);
      // After successful save, update original to match current
      const saved = JSON.parse(JSON.stringify(model));
      setOriginalModel(saved);
      hasChangesRef.current = false;
      // Clear server update notification since we just saved
      setHasServerUpdate(false);
      setServerResourceVersion(undefined);
    } catch (error) {
      // Parse and store the error
      const parsedError = parseKubernetesError(error);
      if (parsedError) {
        setSaveError(parsedError);
      } else {
        // Fallback for unknown errors
        setSaveError({
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          causes: [],
        });
      }
      // Re-throw so callers can handle if needed
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [client, model, resource.namespace, resource.kind, resource.name, isReadOnly]);

  // Clear save error
  const clearSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  // Discard changes and reset to original
  const discardChanges = useCallback(() => {
    if (originalModel) {
      setModelState(JSON.parse(JSON.stringify(originalModel)));
      hasChangesRef.current = false;
      // Clear any errors
      setSaveError(null);
      // If there was a server update, applying discard effectively syncs us
      if (hasServerUpdate) {
        setHasServerUpdate(false);
        setServerResourceVersion(undefined);
        lastResourceVersionRef.current = currentResourceVersion;
      }
    }
  }, [originalModel, hasServerUpdate, currentResourceVersion]);

  // Reload from server - loads the latest server version
  const reloadFromServer = useCallback(() => {
    if (latestServerDataRef.current) {
      const cloned = JSON.parse(JSON.stringify(latestServerDataRef.current));
      setOriginalModel(cloned);
      setModelState(cloned);
      hasChangesRef.current = false;
      lastResourceVersionRef.current = currentResourceVersion;
      setHasServerUpdate(false);
      setServerResourceVersion(undefined);
      // Clear any errors
      setSaveError(null);
    }
  }, [currentResourceVersion]);

  // Dismiss server update notification without reloading
  const dismissServerUpdate = useCallback(() => {
    setHasServerUpdate(false);
    // Don't clear serverResourceVersion - keep it for reference
  }, []);

  // Create full resource object with current model - use ref for stability
  const fullResource: ClusterResource = useMemo(() => ({
    ...resource,
    raw: model
  }), [resource, model]);

  // Fetch YAML when yaml tab is active
  useEffect(() => {
    if (activeTab !== 'yaml' || !client) return;
    
    setIsYamlLoading(true);
    client.getYaml(resource.namespace, resource.kind, resource.name)
      .then((content) => {
        try {
          const doc = yaml.load(content) as Record<string, unknown>;
          if (doc?.metadata && typeof doc.metadata === 'object' && 'managedFields' in doc.metadata) {
            delete (doc.metadata as Record<string, unknown>).managedFields;
          }
          setYamlContent(yaml.dump(doc));
        } catch {
          setYamlContent(content);
        }
      })
      .catch(console.error)
      .finally(() => setIsYamlLoading(false));
  // Only refetch when tab changes to yaml or resource identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, resource.id, client]);

  // Handle YAML save
  const handleSaveYaml = useCallback(async (value: string) => {
    if (!value || !client || isReadOnly) return;
    
    setSaveError(null);
    try {
      await client.applyYaml(resource.namespace, resource.kind, resource.name, value);
    } catch (error) {
      const parsedError = parseKubernetesError(error);
      if (parsedError) {
        setSaveError(parsedError);
      } else {
        setSaveError({
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          causes: [],
        });
      }
      throw error;
    }
  }, [client, resource.namespace, resource.kind, resource.name, isReadOnly]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!client) throw new Error('No client available');
    await client.deleteResource(resource.namespace, resource.kind, resource.name);
    closeDetails();
  }, [client, resource.namespace, resource.kind, resource.name, closeDetails]);

  // Scroll to events
  const scrollToEvents = useCallback(() => {
    eventsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return {
    originalModel,
    model,
    updateModel,
    setModel,
    hasChanges,
    saveModel,
    discardChanges,
    isSaving,
    isLoading: !model,
    fullResource,
    resourceKey,
    yamlContent,
    setYamlContent,
    isYamlLoading,
    handleSaveYaml,
    eventsRef,
    scrollToEvents,
    handleDelete,
    hasServerUpdate,
    serverResourceVersion,
    reloadFromServer,
    dismissServerUpdate,
    saveError,
    clearSaveError,
  };
}
