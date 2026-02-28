import { useEffect, useState } from 'react';
import type { ClusterResource } from '../../../api/types';
import { useClusterStore } from '../../../store/useClusterStore';

interface SidebarResourceState {
  rawResource: Record<string, unknown> | null;
  isLoading: boolean;
}

export const useSidebarResource = (resource: ClusterResource | null): SidebarResourceState => {
  const client = useClusterStore(state => state.client);
  const [rawResource, setRawResource] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!resource) {
      setRawResource(null);
      return;
    }

    if (resource.raw) {
      setRawResource(resource.raw as Record<string, unknown>);
      return;
    }

    if (!client) return;

    let cancelled = false;
    setIsLoading(true);
    client
      .getResource(resource.namespace, resource.kind, resource.name)
      .then((raw) => {
        if (!cancelled) setRawResource(raw as Record<string, unknown>);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resource identity only
  }, [resource?.id, resource?.raw, resource?.namespace, resource?.kind, resource?.name, client]);

  return { rawResource, isLoading };
};
