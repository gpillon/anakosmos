import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useClusterStore } from '../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../store/useResourceDetailsStore';
import type { ClusterResource } from '../../../api/types';
import yaml from 'js-yaml';

interface UseResourceViewOptions {
  resource: ClusterResource;
  activeTab: string;
}

interface UseResourceViewResult<T> {
  // Data
  rawData: T | undefined;
  fullResource: ClusterResource;
  resourceKey: string;
  
  // States
  isLoading: boolean;
  yamlContent: string;
  isYamlLoading: boolean;
  
  // Refs
  eventsRef: React.RefObject<HTMLDivElement | null>;
  
  // Actions
  handleDelete: () => Promise<void>;
  applyChanges: (updatedRaw: T) => Promise<void>;
  handleSaveYaml: (value: string) => Promise<void>;
  setYamlContent: (value: string) => void;
  scrollToEvents: () => void;
}

/**
 * Hook that provides common functionality for all resource views.
 * Handles data fetching, YAML loading, delete, apply changes, etc.
 */
export function useResourceView<T = any>({ 
  resource, 
  activeTab 
}: UseResourceViewOptions): UseResourceViewResult<T> {
  const { client } = useClusterStore();
  const closeDetails = useResourceDetailsStore(state => state.closeDetails);
  
  const [fetchedRaw, setFetchedRaw] = useState<T | null>(null);
  const [fetchingRaw, setFetchingRaw] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [isYamlLoading, setIsYamlLoading] = useState(false);
  const eventsRef = useRef<HTMLDivElement>(null);

  // Use raw from resource if available, otherwise use fetched raw
  const rawData = (resource.raw || fetchedRaw) as T | undefined;

  // Create a stable resource version key for forcing re-render of child components
  const resourceKey = useMemo(() => {
    return `${resource.id}-${resource.raw?.metadata?.resourceVersion || 'initial'}`;
  }, [resource.id, resource.raw?.metadata?.resourceVersion]);

  // Create a resource object with the raw data for passing to child components
  const fullResource: ClusterResource = useMemo(() => ({
    ...resource,
    raw: rawData
  }), [resource, rawData]);

  // Fetch raw data if not available in resource
  useEffect(() => {
    if (!resource.raw && !fetchedRaw && !fetchingRaw && client) {
      setFetchingRaw(true);
      client.getResource(resource.namespace, resource.kind, resource.name)
        .then(raw => setFetchedRaw(raw as T))
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

  // Fetch YAML when yaml tab is active
  useEffect(() => {
    if (activeTab === 'yaml' && client) {
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
    }
  }, [activeTab, resource.namespace, resource.kind, resource.name, resourceKey, client]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!client) throw new Error('No client available');
    await client.deleteResource(resource.namespace, resource.kind, resource.name);
    closeDetails();
  }, [client, resource.namespace, resource.kind, resource.name, closeDetails]);

  // Apply changes from sub-components
  const applyChanges = useCallback(async (updatedRaw: T) => {
    if (!client) throw new Error('No client available');
    const yamlStr = yaml.dump(updatedRaw);
    await client.applyYaml(resource.namespace, resource.kind, resource.name, yamlStr);
  }, [client, resource.namespace, resource.kind, resource.name]);

  // Save YAML from editor
  const handleSaveYaml = useCallback(async (value: string) => {
    if (!value || !client) return;
    await client.applyYaml(resource.namespace, resource.kind, resource.name, value);
  }, [client, resource.namespace, resource.kind, resource.name]);

  // Scroll to events section
  const scrollToEvents = useCallback(() => {
    eventsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return {
    rawData,
    fullResource,
    resourceKey,
    isLoading: !rawData,
    yamlContent,
    isYamlLoading,
    eventsRef,
    handleDelete,
    applyChanges,
    handleSaveYaml,
    setYamlContent,
    scrollToEvents,
  };
}
