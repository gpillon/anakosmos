/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ClusterResource, ClusterLink, HelmReleaseInfo, ArgoAppInfo, HelmRelease, HelmHistoryEntry, ClusterInitResponse, LightResource } from './types';
import type { ArgoApplication } from './k8s-types';
import yaml from 'js-yaml';

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

  async getClusterResources(onProgress?: (progress: number, message: string) => void): Promise<{ resources: Record<string, ClusterResource>, links: ClusterLink[] }> {
    if (this.mode === 'proxy' || this.mode === 'custom') {
      try {
        return await this.fetchClusterInit(onProgress);
      } catch (e) {
        console.error('API fetch failed:', e);
        throw new Error('Failed to reach server');
      }
    }

    throw new Error('Unknown mode');
  }

  /**
   * Fetch cluster resources from the optimized /api/cluster/init endpoint
   * This returns lightweight resources with pre-calculated links in a single request
   */
  private async fetchClusterInit(onProgress?: (progress: number, message: string) => void): Promise<{ resources: Record<string, ClusterResource>, links: ClusterLink[] }> {
    if (onProgress) onProgress(10, 'Connecting to cluster...');

    const cleanBase = this.baseUrl.replace(/\/+$/, '');
    const params = new URLSearchParams();
    
    if (this.mode === 'custom') {
      params.set('target', cleanBase);
      if (this.token && this.token.trim().length > 0) {
        params.set('token', this.token.trim());
      }
    }

    const url = `/api/cluster/init?${params.toString()}`;
    
    if (onProgress) onProgress(30, 'Fetching resources...');

    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 401) throw new Error('Unauthorized (401)');
      if (res.status === 403) throw new Error('Forbidden (403)');
      throw new Error(`Failed to initialize cluster (Status: ${res.status})`);
    }

    if (onProgress) onProgress(70, 'Processing data...');

    const data: ClusterInitResponse = await res.json();

    if (onProgress) onProgress(90, 'Building resource map...');

    // Transform LightResource[] to Record<string, ClusterResource>
    const resources: Record<string, ClusterResource> = {};
    
    for (const light of data.resources) {
      resources[light.id] = this.lightToClusterResource(light);
    }

    if (onProgress) onProgress(100, 'Done');

    return { resources, links: data.links };
  }

  /**
   * Convert a LightResource to ClusterResource
   * Note: raw is NOT populated - it will be loaded on-demand
   */
  private lightToClusterResource(light: LightResource): ClusterResource {
    return {
      id: light.id,
      name: light.name,
      kind: light.kind,
      namespace: light.namespace,
      status: light.status,
      health: light.health,
      labels: light.labels || {},
      ownerRefs: light.ownerRefs || [],
      creationTimestamp: light.creationTimestamp,
      nodeName: light.nodeName,
      helmRelease: light.helmRelease,
      // raw is intentionally NOT set - loaded on-demand via getResource()
    };
  }

  /**
   * Fetch a list of K8s resources (used by listResources and listArgoApplications)
   */
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
        // Special handling for HelmRelease (synthetic resource)
        if (kind === 'HelmRelease') {
            // Use backend endpoint to get Helm release data
            const cleanBase = this.baseUrl.replace(/\/+$/, '');
            const params = new URLSearchParams({
                namespace,
                name
            });
            
            if (this.mode === 'custom') {
                params.set('target', cleanBase);
                if (this.token && this.token.trim().length > 0) {
                    params.set('token', this.token.trim());
                }
            }
            
            const url = `/api/helm/release?${params.toString()}`;
            const res = await fetch(url);
            
            if (!res.ok) {
                throw new Error(`Failed to fetch Helm Release: ${res.statusText}`);
            }
            
            const data = await res.json();
            // Return in Kubernetes-like format for consistency
            return {
                apiVersion: 'helm.sh/v1',
                kind: 'HelmRelease',
                metadata: {
                    name: data.name || name,
                    namespace: data.namespace || namespace,
                    uid: `helm-${namespace}-${name}`,
                    creationTimestamp: data.updated || new Date().toISOString(),
                    labels: {
                        'helm.sh/chart': data.chart || '',
                        'helm.sh/release-name': data.name || name,
                        'helm.sh/release-namespace': data.namespace || namespace,
                    }
                },
                spec: {
                    chart: data.chart || '',
                    version: data.chartVersion || '',
                    releaseName: data.name || name
                },
                status: {
                    status: data.status || 'unknown',
                    revision: data.revision || 1,
                    lastDeployed: data.updated || ''
                },
                ...data
            };
        }

        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        let url: string;
        const headers: Record<string, string> = {
            'Accept': 'application/json'
        };

        let endpoint = '';
        const k = kind.toLowerCase();
        
        // ArgoCD Applications (CRD)
        if (k === 'application') {
            endpoint = namespace 
                ? `apis/argoproj.io/v1alpha1/namespaces/${namespace}/applications/${name}`
                : `apis/argoproj.io/v1alpha1/applications/${name}`;
        } else if (['pod', 'node', 'service', 'persistentvolumeclaim', 'configmap', 'secret', 'event'].includes(k)) {
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        } else if (['deployment', 'statefulset', 'daemonset', 'replicaset'].includes(k)) {
            endpoint = namespace ? `apis/apps/v1/namespaces/${namespace}/${k}s` : `apis/apps/v1/${k}s`;
        } else if (['ingress'].includes(k)) {
            endpoint = namespace ? `apis/networking.k8s.io/v1/namespaces/${namespace}/${k}es` : `apis/networking.k8s.io/v1/${k}es`;
        } else if (['storageclass'].includes(k)) {
            endpoint = `apis/storage.k8s.io/v1/${k}es`;
        } else if (['job', 'cronjob'].includes(k)) {
            endpoint = namespace ? `apis/batch/v1/namespaces/${namespace}/${k}s` : `apis/batch/v1/${k}s`;
        } else if (k === 'horizontalpodautoscaler') {
            endpoint = namespace ? `apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers` : `apis/autoscaling/v2/horizontalpodautoscalers`;
        } else {
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        }
        
        if (k !== 'application') {
            endpoint += `/${name}`;
        }

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

  /**
   * Generic list resources method
   */
  async listResources(group: string, resource: string): Promise<any> {
    return this.fetchK8sList(resource, group);
  }

  async getYaml(namespace: string, kind: string, name: string): Promise<string> {
    try {
        // Special handling for HelmRelease - get JSON and convert to YAML
        if (kind === 'HelmRelease') {
            const resource = await this.getResource(namespace, kind, name);
            return yaml.dump(resource);
        }

        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        let url: string;
        const headers: Record<string, string> = {
            'Accept': 'application/yaml' // Request YAML instead of JSON
        };

        // Determine API Group from kind
        let endpoint = '';
        const k = kind.toLowerCase();
        
        // ArgoCD Applications (CRD)
        if (k === 'application') {
            endpoint = namespace 
                ? `apis/argoproj.io/v1alpha1/namespaces/${namespace}/applications/${name}`
                : `apis/argoproj.io/v1alpha1/applications/${name}`;
        } else if (['pod', 'node', 'service', 'persistentvolumeclaim', 'configmap', 'secret', 'event'].includes(k)) {
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        } else if (['deployment', 'statefulset', 'daemonset', 'replicaset'].includes(k)) {
            endpoint = namespace ? `apis/apps/v1/namespaces/${namespace}/${k}s` : `apis/apps/v1/${k}s`;
        } else if (['ingress'].includes(k)) {
            endpoint = namespace ? `apis/networking.k8s.io/v1/namespaces/${namespace}/${k}es` : `apis/networking.k8s.io/v1/${k}es`;
        } else if (['storageclass'].includes(k)) {
            endpoint = `apis/storage.k8s.io/v1/${k}es`;
        } else if (['job', 'cronjob'].includes(k)) {
            endpoint = namespace ? `apis/batch/v1/namespaces/${namespace}/${k}s` : `apis/batch/v1/${k}s`;
        } else if (k === 'horizontalpodautoscaler') {
            endpoint = namespace ? `apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers` : `apis/autoscaling/v2/horizontalpodautoscalers`;
        } else {
            // Fallback (might fail)
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        }
        
        if (k !== 'application') {
            endpoint += `/${name}`;
        }

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
  
  /**
   * Check if metrics-server is available
   */
  async checkMetricsAvailable(): Promise<boolean> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      let url: string;
      const headers: Record<string, string> = {};

      if (this.mode === 'custom') {
        url = `/proxy/apis/metrics.k8s.io/v1beta1`;
        headers['X-Kube-Target'] = cleanBase;
      } else {
        url = `${cleanBase}/apis/metrics.k8s.io/v1beta1`;
      }

      if (this.token && this.token.trim().length > 0) {
        headers['Authorization'] = `Bearer ${this.token.trim()}`;
      }

      const res = await fetch(url, { headers });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get metrics for a specific pod
   */
  async getPodMetrics(namespace: string, name: string): Promise<{
    cpu: { usage: number; formatted: string };
    memory: { usage: number; formatted: string };
    containers: Array<{
      name: string;
      cpu: { usage: number; formatted: string };
      memory: { usage: number; formatted: string };
    }>;
  } | null> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      let url: string;
      const headers: Record<string, string> = {};

      const endpoint = `apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/${name}`;

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
      if (!res.ok) return null;

      const data = await res.json();
      
      // Parse metrics
      let totalCpuNanos = 0;
      let totalMemoryBytes = 0;
      const containers: Array<{
        name: string;
        cpu: { usage: number; formatted: string };
        memory: { usage: number; formatted: string };
      }> = [];

      data.containers?.forEach((container: any) => {
        const cpuStr = container.usage?.cpu || '0';
        const memStr = container.usage?.memory || '0';
        
        const cpuNanos = this.parseCpuToNanos(cpuStr);
        const memBytes = this.parseMemoryToBytes(memStr);
        
        totalCpuNanos += cpuNanos;
        totalMemoryBytes += memBytes;
        
        containers.push({
          name: container.name,
          cpu: { usage: cpuNanos, formatted: this.formatCpu(cpuNanos) },
          memory: { usage: memBytes, formatted: this.formatMemory(memBytes) }
        });
      });

      return {
        cpu: { usage: totalCpuNanos, formatted: this.formatCpu(totalCpuNanos) },
        memory: { usage: totalMemoryBytes, formatted: this.formatMemory(totalMemoryBytes) },
        containers
      };
    } catch (e) {
      console.warn('Failed to fetch pod metrics', e);
      return null;
    }
  }

  /**
   * Get metrics for a node
   */
  async getNodeMetrics(name: string): Promise<{
    cpu: { usage: number; formatted: string };
    memory: { usage: number; formatted: string };
  } | null> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      let url: string;
      const headers: Record<string, string> = {};

      const endpoint = `apis/metrics.k8s.io/v1beta1/nodes/${name}`;

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
      if (!res.ok) return null;

      const data = await res.json();
      
      const cpuNanos = this.parseCpuToNanos(data.usage?.cpu || '0');
      const memBytes = this.parseMemoryToBytes(data.usage?.memory || '0');

      return {
        cpu: { usage: cpuNanos, formatted: this.formatCpu(cpuNanos) },
        memory: { usage: memBytes, formatted: this.formatMemory(memBytes) }
      };
    } catch (e) {
      console.warn('Failed to fetch node metrics', e);
      return null;
    }
  }

  // Helper: Parse CPU string (e.g., "100m", "1", "250000n") to nanocores
  private parseCpuToNanos(cpuStr: string): number {
    if (!cpuStr) return 0;
    const str = cpuStr.toString();
    if (str.endsWith('n')) return parseInt(str.slice(0, -1), 10);
    if (str.endsWith('u')) return parseInt(str.slice(0, -1), 10) * 1000;
    if (str.endsWith('m')) return parseInt(str.slice(0, -1), 10) * 1000000;
    return parseFloat(str) * 1000000000; // Assume cores
  }

  // Helper: Parse memory string (e.g., "100Mi", "1Gi", "1000Ki") to bytes
  private parseMemoryToBytes(memStr: string): number {
    if (!memStr) return 0;
    const str = memStr.toString();
    const units: Record<string, number> = {
      'Ki': 1024,
      'Mi': 1024 ** 2,
      'Gi': 1024 ** 3,
      'Ti': 1024 ** 4,
      'K': 1000,
      'M': 1000 ** 2,
      'G': 1000 ** 3,
      'T': 1000 ** 4,
    };
    
    for (const [unit, multiplier] of Object.entries(units)) {
      if (str.endsWith(unit)) {
        return parseInt(str.slice(0, -unit.length), 10) * multiplier;
      }
    }
    return parseInt(str, 10); // Assume bytes
  }

  // Helper: Format CPU nanocores to human-readable
  private formatCpu(nanos: number): string {
    if (nanos >= 1000000000) return `${(nanos / 1000000000).toFixed(2)} cores`;
    if (nanos >= 1000000) return `${Math.round(nanos / 1000000)}m`;
    if (nanos >= 1000) return `${Math.round(nanos / 1000)}μ`;
    return `${nanos}n`;
  }

  // Helper: Format bytes to human-readable
  private formatMemory(bytes: number): string {
    if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(2)} Gi`;
    if (bytes >= 1024 ** 2) return `${(bytes / (1024 ** 2)).toFixed(0)} Mi`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} Ki`;
    return `${bytes} B`;
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
        } else if (['job', 'cronjob'].includes(k)) {
            endpoint = namespace ? `apis/batch/v1/namespaces/${namespace}/${k}s` : `apis/batch/v1/${k}s`;
        } else if (k === 'horizontalpodautoscaler') {
            endpoint = namespace ? `apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers` : `apis/autoscaling/v2/horizontalpodautoscalers`;
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

  // ==========================================
  // ArgoCD Methods
  // ==========================================

  /**
   * Check if ArgoCD is installed by looking for its CRD
   */
  async checkArgoCDInstalled(): Promise<boolean> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      let url: string;
      const headers: Record<string, string> = {};

      // Check for ArgoCD Application CRD
      const endpoint = 'apis/apiextensions.k8s.io/v1/customresourcedefinitions/applications.argoproj.io';

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
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * List ArgoCD Applications from all namespaces
   */
  async listArgoApplications(): Promise<ArgoApplication[]> {
    try {
      const data = await this.fetchK8sList('applications', 'argoproj.io/v1alpha1');
      return data.items || [];
    } catch (e) {
      console.warn('Failed to fetch ArgoCD Applications', e);
      return [];
    }
  }

  /**
   * Get a specific ArgoCD Application
   */
  async getArgoApplication(namespace: string, name: string): Promise<ArgoApplication | null> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      let url: string;
      const headers: Record<string, string> = {};

      const endpoint = `apis/argoproj.io/v1alpha1/namespaces/${namespace}/applications/${name}`;

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
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to fetch ArgoCD Application', e);
      return null;
    }
  }

  /**
   * Sync an ArgoCD Application
   */
  async syncArgoApplication(namespace: string, name: string, options?: {
    revision?: string;
    prune?: boolean;
    dryRun?: boolean;
  }): Promise<void> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      let url: string;
      const headers: Record<string, string> = {
        'Content-Type': 'application/merge-patch+json'
      };

      const endpoint = `apis/argoproj.io/v1alpha1/namespaces/${namespace}/applications/${name}`;

      if (this.mode === 'custom') {
        url = `/proxy/${endpoint}`;
        headers['X-Kube-Target'] = cleanBase;
      } else {
        url = `${cleanBase}/${endpoint}`;
      }

      if (this.token && this.token.trim().length > 0) {
        headers['Authorization'] = `Bearer ${this.token.trim()}`;
      }

      // Create sync operation
      const patchBody = {
        operation: {
          initiatedBy: { username: 'anakosmos-ui' },
          sync: {
            revision: options?.revision,
            prune: options?.prune ?? true,
            dryRun: options?.dryRun ?? false
          }
        }
      };

      const res = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patchBody)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new ApiError(`Sync failed: ${res.status}`, res.status, errText);
      }
    } catch (e) {
      console.error('ArgoCD sync failed', e);
      throw e;
    }
  }

  /**
   * Refresh an ArgoCD Application (force reconciliation)
   */
  async refreshArgoApplication(namespace: string, name: string, hard?: boolean): Promise<void> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      let url: string;
      const headers: Record<string, string> = {
        'Content-Type': 'application/merge-patch+json'
      };

      const endpoint = `apis/argoproj.io/v1alpha1/namespaces/${namespace}/applications/${name}`;

      if (this.mode === 'custom') {
        url = `/proxy/${endpoint}`;
        headers['X-Kube-Target'] = cleanBase;
      } else {
        url = `${cleanBase}/${endpoint}`;
      }

      if (this.token && this.token.trim().length > 0) {
        headers['Authorization'] = `Bearer ${this.token.trim()}`;
      }

      // Add refresh annotation to trigger reconciliation
      const patchBody = {
        metadata: {
          annotations: {
            'argocd.argoproj.io/refresh': hard ? 'hard' : 'normal'
          }
        }
      };

      const res = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patchBody)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new ApiError(`Refresh failed: ${res.status}`, res.status, errText);
      }
    } catch (e) {
      console.error('ArgoCD refresh failed', e);
      throw e;
    }
  }

  // ==========================================
  // Helm Methods
  // ==========================================

  /**
   * List Helm releases by parsing Helm secrets
   * Helm stores release info in secrets with type "helm.sh/release.v1"
   */
  async listHelmReleases(): Promise<HelmRelease[]> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      let url: string;
      const headers: Record<string, string> = {};

      // List all secrets with Helm label
      const endpoint = 'api/v1/secrets?labelSelector=owner=helm';

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
      if (!res.ok) return [];

      const data = await res.json();
      const secrets = data.items || [];

      // Group by release name and get latest revision
      const releaseMap = new Map<string, any>();

      for (const secret of secrets) {
        const releaseName = secret.metadata?.labels?.name;
        const namespace = secret.metadata?.namespace;
        const key = `${namespace}/${releaseName}`;
        
        if (!releaseName) continue;

        const existing = releaseMap.get(key);
        const version = parseInt(secret.metadata?.labels?.version || '0', 10);

        if (!existing || version > existing.version) {
          releaseMap.set(key, { secret, version });
        }
      }

      // Parse release data
      const releases: HelmRelease[] = [];
      
      for (const { secret } of releaseMap.values()) {
        try {
          // Helm stores release data base64 encoded and gzipped
          // For now, we extract basic info from labels
          const labels = secret.metadata?.labels || {};
          const annotations = secret.metadata?.annotations || {};
          
          releases.push({
            name: labels.name || 'unknown',
            namespace: secret.metadata?.namespace || 'default',
            revision: parseInt(labels.version || '1', 10),
            status: (labels.status || 'unknown') as HelmRelease['status'],
            chart: annotations['helm.sh/chart'] || labels.chart || 'unknown',
            chartVersion: this.extractChartVersion(labels.chart || ''),
            appVersion: annotations['app.kubernetes.io/version'],
            updated: secret.metadata?.creationTimestamp || ''
          });
        } catch (e) {
          console.warn('Failed to parse Helm release', e);
        }
      }

      return releases;
    } catch (e) {
      console.warn('Failed to list Helm releases', e);
      return [];
    }
  }

  /**
   * Get Helm release values via backend
   */
  async getHelmReleaseValues(namespace: string, releaseName: string): Promise<Record<string, unknown> | null> {
    try {
      // Helm API calls always go to our backend, not the K8s proxy
      // For remote clusters, pass target and token as query params
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      const params = new URLSearchParams({
        namespace,
        name: releaseName
      });
      
      if (this.mode === 'custom') {
        params.set('target', cleanBase);
        if (this.token && this.token.trim().length > 0) {
          params.set('token', this.token.trim());
        }
      }
      
      const url = `/api/helm/values?${params.toString()}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        console.warn('Backend returned error for Helm values:', res.status, res.statusText);
        return null;
      }

      const data = await res.json();
      if (!data) return null;
      
      return { 
          ...data,
          _found: true
      };
    } catch (e) {
      console.warn('Failed to get Helm release values', e);
      return null;
    }
  }

  /**
   * Get Helm release history
   */
  async getHelmHistory(namespace: string, releaseName: string): Promise<HelmHistoryEntry[]> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      const params = new URLSearchParams({
        namespace,
        name: releaseName
      });
      
      if (this.mode === 'custom') {
        params.set('target', cleanBase);
        if (this.token && this.token.trim().length > 0) {
          params.set('token', this.token.trim());
        }
      }
      
      const url = `/api/helm/history?${params.toString()}`;
      const res = await fetch(url);
      
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.warn('Failed to get Helm history', e);
      return [];
    }
  }

  /**
   * Rollback Helm release
   */
  async rollbackHelmRelease(namespace: string, releaseName: string, revision: number): Promise<boolean> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      const params = new URLSearchParams({
        namespace,
        name: releaseName
      });
      
      if (this.mode === 'custom') {
        params.set('target', cleanBase);
        if (this.token && this.token.trim().length > 0) {
          params.set('token', this.token.trim());
        }
      }
      
      const url = `/api/helm/rollback?${params.toString()}`;
      const res = await fetch(url, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision })
      });
      
      return res.ok;
    } catch (e) {
      console.error('Failed to rollback Helm release', e);
      return false;
    }
  }

  /**
   * Upgrade Helm release with new values
   */
  async updateHelmRelease(namespace: string, releaseName: string, values: Record<string, unknown>): Promise<boolean> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      const params = new URLSearchParams({
        namespace,
        name: releaseName
      });
      
      if (this.mode === 'custom') {
        params.set('target', cleanBase);
        if (this.token && this.token.trim().length > 0) {
          params.set('token', this.token.trim());
        }
      }
      
      const url = `/api/helm/upgrade?${params.toString()}`;
      const res = await fetch(url, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values)
      });
      
      return res.ok;
    } catch (e) {
      console.error('Failed to update Helm release', e);
      return false;
    }
  }

  // ==========================================
  // Resource Creation Methods
  // ==========================================

  async applyYamlBatch(yamlContent: string, defaultNamespace: string): Promise<{ applied: number; results: any[] }> {
    const params = new URLSearchParams();
    if (defaultNamespace) params.set('defaultNamespace', defaultNamespace);

    if (this.mode === 'custom') {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      params.set('target', cleanBase);
      if (this.token && this.token.trim().length > 0) {
        params.set('token', this.token.trim());
      }
    }

    const url = `/api/resources/apply-yaml?${params.toString()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: yamlContent, defaultNamespace })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new ApiError(`Apply failed: ${res.status}`, res.status, errText);
    }

    return await res.json();
  }

  async installHelmFromRepo(params: {
    namespace: string;
    releaseName: string;
    repoUrl: string;
    chart: string;
    version?: string;
    valuesYaml?: string;
  }): Promise<any> {
    const query = new URLSearchParams({
      namespace: params.namespace,
      name: params.releaseName
    });

    if (this.mode === 'custom') {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      query.set('target', cleanBase);
      if (this.token && this.token.trim().length > 0) {
        query.set('token', this.token.trim());
      }
    }

    const url = `/api/helm/install?${query.toString()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoUrl: params.repoUrl,
        chart: params.chart,
        version: params.version,
        valuesYaml: params.valuesYaml
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new ApiError(`Helm install failed: ${res.status}`, res.status, errText);
    }

    return await res.json();
  }

  async installHelmFromUpload(params: {
    namespace: string;
    releaseName: string;
    chartFile: File;
    valuesYaml?: string;
  }): Promise<any> {
    const query = new URLSearchParams({
      namespace: params.namespace,
      name: params.releaseName
    });

    if (this.mode === 'custom') {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      query.set('target', cleanBase);
      if (this.token && this.token.trim().length > 0) {
        query.set('token', this.token.trim());
      }
    }

    const url = `/api/helm/install?${query.toString()}`;
    const formData = new FormData();
    formData.append('chart', params.chartFile);
    if (params.valuesYaml) {
      formData.append('valuesYaml', params.valuesYaml);
    }

    const res = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new ApiError(`Helm install failed: ${res.status}`, res.status, errText);
    }

    return await res.json();
  }

  async fetchHelmRepoIndex(repoUrl: string): Promise<{ charts: Array<{ name: string; versions: string[]; latest: string }> }> {
    const query = new URLSearchParams({ repoUrl });
    const url = `/api/helm/repo-index?${query.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      throw new ApiError(`Failed to fetch repo index: ${res.status}`, res.status, errText);
    }
    return await res.json();
  }

  async fetchHelmChartValues(repoUrl: string, chart: string, version?: string): Promise<{ valuesYaml: string; version: string }> {
    const query = new URLSearchParams({ repoUrl, chart });
    if (version) query.set('version', version);
    const url = `/api/helm/chart-values?${query.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      throw new ApiError(`Failed to fetch chart values: ${res.status}`, res.status, errText);
    }
    return await res.json();
  }

  /**
   * Extract chart version from chart label (e.g., "nginx-1.2.3" -> "1.2.3")
   */
  private extractChartVersion(chartLabel: string): string {
    const match = chartLabel.match(/-(\d+\.\d+\.\d+.*)$/);
    return match ? match[1] : '';
  }

  /**
   * Detect Helm management info from resource labels
   */
  detectHelmInfo(labels: Record<string, string>, annotations: Record<string, string>, resourceNamespace: string): HelmReleaseInfo | undefined {
    // Check for Helm labels
    const releaseName = labels['app.kubernetes.io/instance'] || labels['helm.sh/release-name'] || annotations['helm.sh/release-name'] || annotations['meta.helm.sh/release-name'];
    
    // If no release name, definitely not Helm-managed
    if (!releaseName) {
      return undefined;
    }

    // Check if this is Helm-managed
    // Multiple indicators:
    // 1. app.kubernetes.io/managed-by=Helm (standard)
    // 2. helm.sh/chart label (Helm always adds this)
    // 3. meta.helm.sh/* labels (Helm 3+)
    // 4. helm.sh/release-name annotation (Helm 3+)
    const hasManagedByHelm = labels['app.kubernetes.io/managed-by'] === 'Helm';
    const hasHelmChart = !!labels['helm.sh/chart'];
    const hasHelmMetadata = !!(labels['helm.sh/release-name'] || annotations['helm.sh/release-name'] || labels['meta.helm.sh/release-name'] || annotations['meta.helm.sh/release-name'] || labels['meta.helm.sh/release-namespace'] || annotations['meta.helm.sh/release-namespace']);
    
    // If none of these indicators are present, it's not Helm-managed
    if (!hasManagedByHelm && !hasHelmChart && !hasHelmMetadata) {
      return undefined;
    }

    const releaseNamespace = labels['meta.helm.sh/release-namespace'] || annotations['meta.helm.sh/release-namespace'] || 
                           labels['helm.sh/release-namespace'] || annotations['helm.sh/release-namespace'] || 
                           resourceNamespace;

    const chartName = labels['helm.sh/chart'] || annotations['helm.sh/chart'] || labels['app.kubernetes.io/name'];

    return {
      releaseName,
      releaseNamespace: releaseNamespace || '',
      chartName,
      chartVersion: this.extractChartVersion(labels['helm.sh/chart'] || '')
    };
  }

  /**
   * Detect ArgoCD management info from resource labels/annotations
   */
  detectArgoInfo(labels: Record<string, string>, annotations?: Record<string, string>): ArgoAppInfo | undefined {
    // Check for ArgoCD labels
    const appName = labels['argocd.argoproj.io/instance'] || 
                    labels['app.kubernetes.io/instance'];
    const appNamespace = annotations?.['argocd.argoproj.io/tracking-id']?.split(':')[0];
    
    // Also check for standard Argo tracking annotation
    const trackingId = annotations?.['argocd.argoproj.io/tracking-id'];
    
    if (!trackingId && !labels['argocd.argoproj.io/instance']) {
      return undefined;
    }

    return {
      appName: appName || 'unknown',
      appNamespace: appNamespace || 'argocd',
      project: labels['argocd.argoproj.io/project']
    };
  }

  async deleteResource(namespace: string, kind: string, name: string): Promise<void> {
    try {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        // Determine API Group from kind
        let endpoint = '';
        const k = kind.toLowerCase();
        
        if (['pod', 'node', 'service', 'serviceaccount', 'persistentvolumeclaim', 'configmap', 'secret', 'event'].includes(k)) {
            endpoint = namespace ? `api/v1/namespaces/${namespace}/${k}s` : `api/v1/${k}s`;
        } else if (['deployment', 'statefulset', 'daemonset', 'replicaset'].includes(k)) {
            endpoint = namespace ? `apis/apps/v1/namespaces/${namespace}/${k}s` : `apis/apps/v1/${k}s`;
        } else if (['ingress'].includes(k)) {
            endpoint = namespace ? `apis/networking.k8s.io/v1/namespaces/${namespace}/${k}es` : `apis/networking.k8s.io/v1/${k}es`;
        } else if (['storageclass'].includes(k)) {
            endpoint = `apis/storage.k8s.io/v1/${k}es`;
        } else if (['priorityclass'].includes(k)) {
            endpoint = `apis/scheduling.k8s.io/v1/${k}es`;
        } else if (['job', 'cronjob'].includes(k)) {
            endpoint = namespace ? `apis/batch/v1/namespaces/${namespace}/${k}s` : `apis/batch/v1/${k}s`;
        } else if (k === 'horizontalpodautoscaler') {
            endpoint = namespace ? `apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers` : `apis/autoscaling/v2/horizontalpodautoscalers`;
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
            method: 'DELETE',
            headers
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new ApiError(`Delete failed: ${res.status} ${res.statusText}`, res.status, errText);
        }
    } catch (e) {
        console.error('Delete resource failed', e);
        throw e;
    }
  }

}
