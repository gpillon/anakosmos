/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ClusterResource, ClusterLink } from './types';

export class KubeClient {
  public mode: 'mock' | 'proxy' | 'custom' = 'mock';
  public baseUrl: string;
  public token?: string;

  constructor(mode: 'mock' | 'proxy' | 'custom' = 'mock', baseUrl: string = '/api', token?: string) {
    this.mode = mode;
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async checkConnection(): Promise<boolean> {
    if (this.mode === 'mock') return true;

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
    if (this.mode === 'mock') {
      return this.fetchFromMock();
    }

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

  private async fetchFromMock(): Promise<{ resources: Record<string, ClusterResource>, links: ClusterLink[] }> {
    try {
      const [pods, nodes, services, deployments] = await Promise.all([
        fetch('/mock/pods.json').then(r => r.json()),
        fetch('/mock/nodes.json').then(r => r.json()),
        fetch('/mock/services.json').then(r => r.json()),
        fetch('/mock/deployments.json').then(r => r.json())
      ]);
      return this.transformK8sData({
          nodes, 
          pods, 
          services, 
          deployments,
          statefulsets: { items: [] },
          daemonsets: { items: [] },
          replicasets: { items: [] },
          ingresses: { items: [] },
          pvcs: { items: [] },
          configmaps: { items: [] },
          secrets: { items: [] },
          storageclasses: { items: [] }
      });
    } catch (e) {
      console.error('Failed to fetch from mock', e);
      return { resources: {}, links: [] };
    }
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
    if (this.mode === 'mock') {
        // Return some mock events for demo
        return [
            {
                type: 'Normal',
                reason: 'MockEvent',
                message: 'This is a mock event because you are in mock mode',
                lastTimestamp: new Date().toISOString(),
                count: 1
            }
        ];
    }

    try {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        let url: string;
        const headers: Record<string, string> = {};
        
        // Build query
        const query = `?fieldSelector=involvedObject.uid=${uid}`;
        const endpoint = namespace 
            ? `api/v1/namespaces/${namespace}/events`
            : `api/v1/events`; // Fallback to all events or default namespace? 
            // Ideally involvedObject.uid is unique enough. 
            // But usually we need --all-namespaces if we don't know the namespace.
            // Let's assume if namespace is missing (e.g. Node), we query /api/v1/events (which is usually default namespace)
            // or we might need to query all namespaces if we have permission.
        
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

  async getYaml(namespace: string, kind: string, name: string): Promise<string> {
    if (this.mode === 'mock') {
        return `apiVersion: v1
kind: ${kind}
metadata:
  name: ${name}
  namespace: ${namespace}
  creationTimestamp: ${new Date().toISOString()}
status:
  phase: Running
  conditions:
  - type: Ready
    status: "True"
`;
    }

    try {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        let url: string;
        const headers: Record<string, string> = {
            'Accept': 'application/yaml' // Request YAML instead of JSON
        };

        // Determine API Group from kind
        // This is a simplification. Ideally we should look up the resource mapping.
        // Common mappings:
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
        
        // If we get JSON back despite asking for YAML (some APIs ignore Accept),
        // we might need to convert it using js-yaml if we were running in Node,
        // but here we just hope for text/yaml or convert JSON on client.
        // Actually browsers don't do content negotiation well. 
        // K8s API returns JSON by default. We probably need to fetch JSON and convert to YAML on client side using js-yaml.
        // Let's assume we fetch JSON and convert it.
        
        if (res.headers.get('Content-Type')?.includes('json')) {
            const json = await res.json();
            // We need a YAML dumper. We'll let the UI component handle the conversion
            // or we can import js-yaml here. 
            // Let's just return the JSON object and let the caller stringify it?
            // No, the signature returns string.
            // Since we don't want to add heavyweight dependency here if possible...
            // But we installed js-yaml.
            // Let's assume the caller will handle JSON->YAML if it receives a JSON string?
            // Or better: Let's fetch JSON (safest) and convert it in the UI component using js-yaml.
            return JSON.stringify(json);
        }

        return await res.text();
    } catch (e) {
        console.warn('Failed to fetch YAML', e);
        return '';
    }
  }
  async startWatch(onEvent: (event: any) => void): Promise<() => void> {
    if (this.mode === 'mock') return () => {};

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
  
  async applyYaml(namespace: string, kind: string, name: string, yamlContent: string): Promise<void> {
    if (this.mode === 'mock') {
        console.log('Mock apply:', yamlContent);
        return;
    }

    try {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        const headers: Record<string, string> = {
            'Content-Type': 'application/yaml' // Some K8s APIs accept this for PUT
        };

        // Determine API Group from kind (reuse logic from getYaml or better refactor)
        // For simplicity, reusing logic
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

        // Using PUT to replace the resource. 
        // Note: For PUT to work, the YAML must include the resourceVersion, 
        // otherwise we get a conflict. Since we fetched the YAML, it should have it unless managedFields was removed and resourceVersion lost?
        // Actually we stripped managedFields but kept metadata.resourceVersion in the view.
        // If the user modified it, hopefully they didn't touch resourceVersion.
        
        // If we wanted to be safer, we could use PATCH with application/merge-patch+json 
        // but that requires converting YAML to JSON.
        // Let's try PUT with YAML first. If K8s complains about JSON, we convert.
        // Most K8s setups expect JSON body.
        
        // Let's convert to JSON to be safe, as fetch body handling for YAML might be tricky 
        // and K8s API is definitely JSON-first.
        // We need a YAML parser here if we want to send JSON. 
        // But we are in KubeClient, we don't want to import 'js-yaml' here if possible to keep it light?
        // The Sidebar imports 'js-yaml'.
        // Let's assume the caller passes the string.
        
        // Actually, we can just send the body as string with Content-Type: application/yaml.
        // Kubernetes API supports it.
        
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: yamlContent
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Apply failed: ${res.status} ${res.statusText} - ${err}`);
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
        creationTimestamp: item.metadata.creationTimestamp
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
