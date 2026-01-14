import { useEffect, useState } from 'react';
import type { ClusterResource } from '../../../api/types';
import { useClusterStore } from '../../../store/useClusterStore';

interface SidebarResourceState {
  rawResource: any | null;
  isLoading: boolean;
}

export const useSidebarResource = (resource: ClusterResource | null): SidebarResourceState => {
  const client = useClusterStore(state => state.client);
  const [rawResource, setRawResource] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!resource) {
      setRawResource(null);
      return;
    }

    if (resource.raw) {
      setRawResource(resource.raw);
      return;
    }

    if (!client) return;

    let cancelled = false;
    setIsLoading(true);
    client
      .getResource(resource.namespace, resource.kind, resource.name)
      .then((raw) => {
        if (!cancelled) setRawResource(raw as any);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resource?.id, resource?.raw, resource?.namespace, resource?.kind, resource?.name, client]);

  return { rawResource, isLoading };
};
