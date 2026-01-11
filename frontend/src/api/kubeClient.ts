/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ClusterResource, ClusterLink } from './types';

export class ApiError extends Error {
  public status: number;
  public details: any; // Contains the raw JSON body if available

  constructor(message: string, status: number, details: string) {
    super(message);
    this.status = status;
    try {
        this.details = JSON.parse(details);
        // Try to update message if details has a message
        if (this.details.message) {
            this.message = this.details.message;
        }
    } catch {
        this.details = details;
    }
  }
}

export class KubeClient {
  public mode: 'proxy' | 'custom' = 'proxy';
  public baseUrl: string;
  public token?: string;

  constructor(mode: 'proxy' | 'custom' = 'proxy', baseUrl: string = '/api', token?: string) {
    this.mode = mode;
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async checkConnection(): Promise<boolean> {
    try {
      let url: string;
    const headers: Record<string, string> = {};

      if (this.mode === 'custom') {
         const cleanBase = this.baseUrl.replace(/\/+$/, '');
         url = `/proxy/api`;
         headers['X-Kube-Target'] = cleanBase;
      } else {
         const cleanBase = this.baseUrl.replace(/\/+$/, '');
         url = `${cleanBase}/api`;
      }
      
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers
        });
        return res.status < 500;
      } catch (e) {
        console.warn('Standard fetch failed', e);
        return false;
      }
    } catch (e) {
      console.error('Connection check failed', e);
      return false;
    }
  }

  async getClusterResources(): Promise<{ resources: Record<string, ClusterResource>, links: ClusterLink[] }> {
    if (this.mode === 'proxy' || this.mode === 'custom') {
      try {
        return await this.fetchFromApi();
      } catch (e) {
        console.error('API fetch failed:', e);
        throw new Error('Failed to reach server');
      }
    }

    throw new Error('Unknown mode');
  }

  private async fetchFromApi(): Promise<{ resources: Record<string, ClusterResource>, links: ClusterLink[] }> {
    try {
      // Helper to fetch list safely (return empty list on failure instead of throwing)
      const fetchList = async (resource: string, group: string) => {
          try {
              return await this.fetchK8sList(resource, group);
          } catch (e) {
              console.warn(`Failed to fetch ${resource}:`, e);
              return { items: [] };
          }
      };

      const [
          nodes, 
          pods, 
          services, 
          deployments,
          statefulsets,
          daemonsets,
          replicasets,
          ingresses,
          pvcs,
          configmaps,
          secrets,
          storageclasses
      ] = await Promise.all([
        fetchList('nodes', 'v1'),
        fetchList('pods', 'v1'),
        fetchList('services', 'v1'),
        fetchList('deployments', 'apps/v1'),
        fetchList('statefulsets', 'apps/v1'),
        fetchList('daemonsets', 'apps/v1'),
        fetchList('replicasets', 'apps/v1'),
        fetchList('ingresses', 'networking.k8s.io/v1'),
        fetchList('persistentvolumeclaims', 'v1'),
        fetchList('configmaps', 'v1'),
        fetchList('secrets', 'v1'),
        fetchList('storageclasses', 'storage.k8s.io/v1')
      ]);

      return this.transformK8sData({
          nodes, 
          pods, 
          services, 
          deployments,
          statefulsets,
          daemonsets,
          replicasets,
          ingresses,
          pvcs,
          configmaps,
          secrets,
          storageclasses
      });
    } catch (e) {
      console.error('Failed to fetch from API', e);
      throw e;
    }
  }

  private async fetchK8sList(resource: string, apiGroup: string = 'v1') {
    const prefix = apiGroup === 'v1' ? 'api/v1' : `apis/${apiGroup}`;
    const cleanBase = this.baseUrl.replace(/\/+$/, '');

    let url: string;
    const headers: Record<string, string> = {};

    if (this.mode === 'custom') {
        url = `/proxy/${prefix}/${resource}`;
        headers['X-Kube-Target'] = cleanBase;
    } else {
        url = `${cleanBase}/${prefix}/${resource}`;
    }
    
    if (this.token && this.token.trim().length > 0) {
      headers['Authorization'] = `Bearer ${this.token.trim()}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
        if (res.status === 401) throw new Error(`Unauthorized (401) fetching ${resource}`);
        if (res.status === 403) throw new Error(`Forbidden (403) fetching ${resource}`);
        throw new Error(`Failed to fetch ${resource} (Status: ${res.status})`);
    }
    return res.json();
  }

  async getEvents(namespace: string, uid: string): Promise<any[]> {
    try {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        let url: string;
        const headers: Record<string, string> = {};
        
        // Build query
        const query = `?fieldSelector=involvedObject.uid=${uid}`;
        const endpoint = namespace 
            ? `api/v1/namespaces/${namespace}/events`
            : `api/v1/events`; 
        
        if (this.mode === 'custom') {
            url = `/proxy/${endpoint}${query}`;
            headers['X-Kube-Target'] = cleanBase;
        } else {
            url = `${cleanBase}/${endpoint}${query}`;
        }

        if (this.token && this.token.trim().length > 0) {
            headers['Authorization'] = `Bearer ${this.token.trim()}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) return [];
        
        const data = await res.json();
        return data.items || [];
    } catch (e) {
        console.warn('Failed to fetch events', e);
        return [];
    }
  }

  async getResource(namespace: string, kind: string, name: string): Promise<any> {
    try {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        let url: string;
        const headers: Record<string, string> = {
            'Accept': 'application/json'
        };

        let endpoint = '';
        const k = kind.toLowerCase();
        
        if (['pod', 'node', 'service', 'persistentvolumeclaim', 'configmap', 'secret', 'event'].includes(k)) {
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        } else if (['deployment', 'statefulset', 'daemonset', 'replicaset'].includes(k)) {
            endpoint = namespace ? `apis/apps/v1/namespaces/${namespace}/${k}s` : `apis/apps/v1/${k}s`;
        } else if (['ingress'].includes(k)) {
            endpoint = namespace ? `apis/networking.k8s.io/v1/namespaces/${namespace}/${k}es` : `apis/networking.k8s.io/v1/${k}es`;
        } else if (['storageclass'].includes(k)) {
            endpoint = `apis/storage.k8s.io/v1/${k}es`;
        } else {
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        }
        
        endpoint += `/${name}`;

        if (this.mode === 'custom') {
            url = `/proxy/${endpoint}`;
            headers['X-Kube-Target'] = cleanBase;
        } else {
            url = `${cleanBase}/${endpoint}`;
        }

        if (this.token && this.token.trim().length > 0) {
            headers['Authorization'] = `Bearer ${this.token.trim()}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Failed to fetch Resource: ${res.statusText}`);
        
        return await res.json();
    } catch (e) {
        console.warn('Failed to fetch Resource', e);
        throw e;
    }
  }

  async getYaml(namespace: string, kind: string, name: string): Promise<string> {
    try {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        let url: string;
        const headers: Record<string, string> = {
            'Accept': 'application/yaml' // Request YAML instead of JSON
        };

        // Determine API Group from kind
        let endpoint = '';
        const k = kind.toLowerCase();
        
        if (['pod', 'node', 'service', 'persistentvolumeclaim', 'configmap', 'secret', 'event'].includes(k)) {
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        } else if (['deployment', 'statefulset', 'daemonset', 'replicaset'].includes(k)) {
            endpoint = namespace ? `apis/apps/v1/namespaces/${namespace}/${k}s` : `apis/apps/v1/${k}s`;
        } else if (['ingress'].includes(k)) {
            endpoint = namespace ? `apis/networking.k8s.io/v1/namespaces/${namespace}/${k}es` : `apis/networking.k8s.io/v1/${k}es`;
        } else if (['storageclass'].includes(k)) {
            endpoint = `apis/storage.k8s.io/v1/${k}es`;
        } else {
            // Fallback (might fail)
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        }
        
        // Append name
        endpoint += `/${name}`;

        if (this.mode === 'custom') {
            url = `/proxy/${endpoint}`;
            headers['X-Kube-Target'] = cleanBase;
        } else {
            url = `${cleanBase}/${endpoint}`;
        }

        if (this.token && this.token.trim().length > 0) {
            headers['Authorization'] = `Bearer ${this.token.trim()}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Failed to fetch YAML: ${res.statusText}`);
        
        if (res.headers.get('Content-Type')?.includes('json')) {
            const json = await res.json();
            return JSON.stringify(json);
        }

        return await res.text();
    } catch (e) {
        console.warn('Failed to fetch YAML', e);
        return '';
    }
  }
  async startWatch(onEvent: (event: any) => void): Promise<() => void> {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const params = new URLSearchParams();

    if (this.mode === 'custom' || this.mode === 'proxy') {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        if (cleanBase) params.append('target', cleanBase);
        if (this.token) params.append('token', this.token);
    }
    
    const url = `${protocol}//${host}/api/sock/watch?${params.toString()}`;
    
    // Connect to WebSocket
    let ws: WebSocket | null = new WebSocket(url);
    
    ws.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);
            onEvent(data);
        } catch (e) {
            console.error('Failed to parse watch event', e);
        }
    };
    
    ws.onclose = () => {
        console.log('Watch connection closed');
        ws = null;
    };
    
    ws.onerror = (e) => {
        console.error('Watch socket error', e);
    };

    // Return cleanup function
    return () => {
        if (ws) {
            ws.close();
            ws = null;
        }
    };
  }

  /**
   * Start watching a single resource with full object data
   * Used for detailed views that need complete, live updates
   */
  startSingleResourceWatch(
    kind: string, 
    namespace: string, 
    name: string, 
    onEvent: (event: { type: string; resource: any }) => void
  ): () => void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const params = new URLSearchParams();

    params.append('kind', kind);
    params.append('namespace', namespace || '');
    params.append('name', name);

    if (this.mode === 'custom' || this.mode === 'proxy') {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        if (cleanBase) params.append('target', cleanBase);
        if (this.token) params.append('token', this.token);
    }
    
    const url = `${protocol}//${host}/api/sock/watch/resource?${params.toString()}`;
    
    console.log(`Starting single resource watch: ${kind}/${namespace}/${name}`);
    
    let ws: WebSocket | null = new WebSocket(url);
    
    ws.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);
            onEvent(data);
        } catch (e) {
            console.error('Failed to parse single watch event', e);
        }
    };
    
    ws.onopen = () => {
        console.log(`Single resource watch connected: ${kind}/${namespace}/${name}`);
    };
    
    ws.onclose = () => {
        console.log(`Single resource watch closed: ${kind}/${namespace}/${name}`);
        ws = null;
    };
    
    ws.onerror = (e) => {
        console.error('Single resource watch error', e);
    };

    // Return cleanup function
    return () => {
        if (ws) {
            console.log(`Closing single resource watch: ${kind}/${namespace}/${name}`);
            ws.close();
            ws = null;
        }
    };
  }
  
  async applyYaml(namespace: string, kind: string, name: string, yamlContent: string): Promise<void> {
    try {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        const headers: Record<string, string> = {
            'Content-Type': 'application/yaml' // Some K8s APIs accept this for PUT
        };

        // Determine API Group from kind
        let endpoint = '';
        const k = kind.toLowerCase();
        
        if (['pod', 'node', 'service', 'persistentvolumeclaim', 'configmap', 'secret', 'event'].includes(k)) {
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        } else if (['deployment', 'statefulset', 'daemonset', 'replicaset'].includes(k)) {
            endpoint = namespace ? `apis/apps/v1/namespaces/${namespace}/${k}s` : `apis/apps/v1/${k}s`;
        } else if (['ingress'].includes(k)) {
            endpoint = namespace ? `apis/networking.k8s.io/v1/namespaces/${namespace}/${k}es` : `apis/networking.k8s.io/v1/${k}es`;
        } else if (['storageclass'].includes(k)) {
            endpoint = `apis/storage.k8s.io/v1/${k}es`;
        } else {
            // Fallback
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        }
        
        // Append name
        endpoint += `/${name}`;

        let url: string;
        if (this.mode === 'custom') {
            url = `/proxy/${endpoint}`;
            headers['X-Kube-Target'] = cleanBase;
        } else {
            url = `${cleanBase}/${endpoint}`;
        }

        if (this.token && this.token.trim().length > 0) {
            headers['Authorization'] = `Bearer ${this.token.trim()}`;
        }

        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: yamlContent
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new ApiError(`Apply failed: ${res.status} ${res.statusText}`, res.status, errText);
        }
    } catch (e) {
        console.error('Apply YAML failed', e);
        throw e;
    }
  }

  private transformK8sData(data: {
      nodes: any, 
      pods: any, 
      services: any, 
      deployments: any,
      statefulsets: any,
      daemonsets: any,
      replicasets: any,
      ingresses: any,
      pvcs: any,
      configmaps: any,
      secrets: any,
      storageclasses: any
  }) {
    const resources: Record<string, ClusterResource> = {};
    const links: ClusterLink[] = [];

    const addRes = (item: any, kind: string, status?: string) => {
      const id = item.metadata.uid;
      
      // Determine Status if not explicitly provided
      let finalStatus = status;
      if (!finalStatus) {
          if (item.status?.phase) finalStatus = item.status.phase;
          else if (item.status?.conditions) {
              const ready = item.status.conditions.find((c: any) => c.type === 'Ready');
              finalStatus = ready?.status === 'True' ? 'Ready' : 'NotReady';
          } else {
              finalStatus = 'Active';
          }
      }
      
      // Safety check to ensure it's a string
      finalStatus = finalStatus || 'Unknown';

      resources[id] = {
        id,
        name: item.metadata.name,
        kind: kind,
        namespace: item.metadata.namespace || '',
        status: finalStatus,
        labels: item.metadata.labels || {},
        ownerRefs: (item.metadata.ownerReferences || []).map((ref: any) => ref.uid),
        creationTimestamp: item.metadata.creationTimestamp,
        raw: item // Store raw object for details view
      };
      
      (item.metadata.ownerReferences || []).forEach((ref: any) => {
         links.push({ source: id, target: ref.uid, type: 'owner' });
      });

      return id;
    };

    // Nodes
    data.nodes.items.forEach((item: any) => {
        const readyCondition = item.status.conditions?.find((c: any) => c.type === 'Ready');
        const status = readyCondition?.status === 'True' ? 'Ready' : 'NotReady';
        addRes(item, 'Node', status);
    });

    // Pods
    data.pods.items.forEach((item: any) => {
      const podId = addRes(item, 'Pod', item.status.phase);
      if (item.spec.nodeName) {
        const node = data.nodes.items.find((n: any) => n.metadata.name === item.spec.nodeName);
        if (node) {
          links.push({ source: podId, target: node.metadata.uid, type: 'owner' });
        }
      }
    });

    // Workloads
    data.deployments.items.forEach((item: any) => {
        const available = item.status?.availableReplicas === item.status?.replicas;
        addRes(item, 'Deployment', available ? 'Available' : 'Progressing');
    });
    data.statefulsets.items.forEach((item: any) => {
        const ready = item.status?.readyReplicas === item.status?.replicas;
        const stsId = addRes(item, 'StatefulSet', ready ? 'Ready' : 'Progressing');
        
        // Link Pods to StatefulSet (OwnerRef logic handles this if K8s sets it, 
        // but often Pods are owned by ControllerRevision or just matching labels)
        // We'll fallback to label matching for robustness
        if (item.spec.selector) {
            data.pods.items.forEach((pod: any) => {
                const match = Object.entries(item.spec.selector.matchLabels || {}).every(([k, v]) => pod.metadata.labels?.[k] === v);
                if (match) {
                    // Check if link already exists (from OwnerRef) to avoid duplicates
                    const exists = links.some(l => l.source === pod.metadata.uid && l.target === stsId);
                    if (!exists) links.push({ source: pod.metadata.uid, target: stsId, type: 'owner' });
                }
            });
        }
    });
    data.daemonsets.items.forEach((item: any) => {
        const ready = item.status?.numberReady === item.status?.desiredNumberScheduled;
        const dsId = addRes(item, 'DaemonSet', ready ? 'Ready' : 'Progressing');
        
        // Link Pods to DaemonSet (Label matching fallback)
        if (item.spec.selector) {
            data.pods.items.forEach((pod: any) => {
                const match = Object.entries(item.spec.selector.matchLabels || {}).every(([k, v]) => pod.metadata.labels?.[k] === v);
                if (match) {
                    const exists = links.some(l => l.source === pod.metadata.uid && l.target === dsId);
                    if (!exists) links.push({ source: pod.metadata.uid, target: dsId, type: 'owner' });
                }
            });
        }
    });
    data.replicasets.items.forEach((item: any) => addRes(item, 'ReplicaSet'));

    // Networking
    data.services.items.forEach((item: any) => {
      const svcId = addRes(item, 'Service');
      if (item.spec.selector) {
        data.pods.items.forEach((pod: any) => {
          const match = Object.entries(item.spec.selector).every(([k, v]) => pod.metadata.labels?.[k] === v);
          if (match) {
            links.push({ source: svcId, target: pod.metadata.uid, type: 'network' });
          }
        });
      }
    });

    data.ingresses.items.forEach((item: any) => {
        const ingId = addRes(item, 'Ingress');
        // Simple Ingress Linking (assuming backend service name matches)
        item.spec.rules?.forEach((rule: any) => {
            rule.http?.paths?.forEach((path: any) => {
                const svcName = path.backend?.service?.name;
                if (svcName) {
                     const svc = data.services.items.find((s: any) => s.metadata.name === svcName && s.metadata.namespace === item.metadata.namespace);
                     if (svc) {
                         links.push({ source: ingId, target: svc.metadata.uid, type: 'network' });
                     }
                }
            });
        });
    });

    // Config & Storage
    data.pvcs.items.forEach((item: any) => {
        const pvcId = addRes(item, 'PersistentVolumeClaim', item.status.phase);
        // Link PVC to StorageClass
        if (item.spec.storageClassName) {
            const sc = data.storageclasses.items.find((s: any) => s.metadata.name === item.spec.storageClassName);
            if (sc) {
                links.push({ source: pvcId, target: sc.metadata.uid, type: 'storage' });
            }
        }
    });
    data.storageclasses.items.forEach((item: any) => addRes(item, 'StorageClass'));
    data.configmaps.items.forEach((item: any) => addRes(item, 'ConfigMap'));
    data.secrets.items.forEach((item: any) => addRes(item, 'Secret'));

    // Link PVCs, ConfigMaps, Secrets to Pods
    data.pods.items.forEach((pod: any) => {
        // 1. Link via Volumes
        pod.spec.volumes?.forEach((vol: any) => {
            if (vol.persistentVolumeClaim) {
                const claimName = vol.persistentVolumeClaim.claimName;
                const pvc = data.pvcs.items.find((p: any) => p.metadata.name === claimName && p.metadata.namespace === pod.metadata.namespace);
                if (pvc) {
                    links.push({ source: pod.metadata.uid, target: pvc.metadata.uid, type: 'storage' });
                }
            }
            if (vol.configMap) {
                 const cmName = vol.configMap.name;
                 const cm = data.configmaps.items.find((c: any) => c.metadata.name === cmName && c.metadata.namespace === pod.metadata.namespace);
                 if (cm) {
                    links.push({ source: pod.metadata.uid, target: cm.metadata.uid, type: 'config' });
                 }
            }
            if (vol.secret) {
                 const secName = vol.secret.secretName;
                 const sec = data.secrets.items.find((s: any) => s.metadata.name === secName && s.metadata.namespace === pod.metadata.namespace);
                 if (sec) {
                    links.push({ source: pod.metadata.uid, target: sec.metadata.uid, type: 'config' });
                 }
            }
        });

        // 2. Link via Environment Variables (env & envFrom)
        pod.spec.containers?.forEach((container: any) => {
            // envFrom
            container.envFrom?.forEach((envFrom: any) => {
                if (envFrom.configMapRef) {
                    const cmName = envFrom.configMapRef.name;
                    const cm = data.configmaps.items.find((c: any) => c.metadata.name === cmName && c.metadata.namespace === pod.metadata.namespace);
                    if (cm) links.push({ source: pod.metadata.uid, target: cm.metadata.uid, type: 'config' });
                }
                if (envFrom.secretRef) {
                    const secName = envFrom.secretRef.name;
                    const sec = data.secrets.items.find((s: any) => s.metadata.name === secName && s.metadata.namespace === pod.metadata.namespace);
                    if (sec) links.push({ source: pod.metadata.uid, target: sec.metadata.uid, type: 'config' });
                }
            });

            // env
            container.env?.forEach((env: any) => {
                if (env.valueFrom?.configMapKeyRef) {
                    const cmName = env.valueFrom.configMapKeyRef.name;
                    const cm = data.configmaps.items.find((c: any) => c.metadata.name === cmName && c.metadata.namespace === pod.metadata.namespace);
                    if (cm) links.push({ source: pod.metadata.uid, target: cm.metadata.uid, type: 'config' });
                }
                if (env.valueFrom?.secretKeyRef) {
                    const secName = env.valueFrom.secretKeyRef.name;
                    const sec = data.secrets.items.find((s: any) => s.metadata.name === secName && s.metadata.namespace === pod.metadata.namespace);
                    if (sec) links.push({ source: pod.metadata.uid, target: sec.metadata.uid, type: 'config' });
                }
            });
        });
    });

    return { resources, links };
  }
}
