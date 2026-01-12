import React, { useEffect, useState, useRef } from 'react';
import type { V1Pod } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { 
  Cpu, 
  HardDrive, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  Gauge,
  BarChart3,
  Box,
  RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../shared';

interface MetricPoint {
  timestamp: number;
  value: number;
}

interface ContainerMetrics {
  name: string;
  cpu: { usage: number; formatted: string };
  memory: { usage: number; formatted: string };
}

interface PodMetricsData {
  cpu: { usage: number; formatted: string };
  memory: { usage: number; formatted: string };
  containers: ContainerMetrics[];
}

interface Props {
  pod: V1Pod;
}

// Mini chart component for metrics history
const MiniChart: React.FC<{
  history: MetricPoint[];
  color: string;
  height?: number;
}> = ({ history, color, height = 60 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const chartHeight = rect.height;
    const padding = 4;

    ctx.clearRect(0, 0, width, chartHeight);

    const values = history.map(p => p.value);
    const maxVal = Math.max(...values) * 1.1 || 1;
    const minVal = 0;

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, chartHeight);
    gradient.addColorStop(0, `${color}40`);
    gradient.addColorStop(1, `${color}00`);

    ctx.beginPath();
    ctx.moveTo(padding, chartHeight - padding);

    history.forEach((point, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2);
      const y = chartHeight - padding - ((point.value - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2);
      ctx.lineTo(x, y);
    });

    ctx.lineTo(width - padding, chartHeight - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    history.forEach((point, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2);
      const y = chartHeight - padding - ((point.value - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw current point
    if (history.length > 0) {
      const lastPoint = history[history.length - 1];
      const x = width - padding;
      const y = chartHeight - padding - ((lastPoint.value - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2);
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [history, color]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ display: 'block', height }}
    />
  );
};

// Progress bar for resource usage vs limits
const ResourceBar: React.FC<{
  label: string;
  current: number;
  request?: number;
  limit?: number;
  formatted: string;
  requestFormatted?: string;
  limitFormatted?: string;
  icon: React.ReactNode;
  color: string;
}> = ({ label, current, request, limit, formatted, requestFormatted, limitFormatted, icon, color }) => {
  // Calculate percentages based on limit if available, otherwise use request
  const maxValue = limit || request || current * 2;
  const percentage = Math.min((current / maxValue) * 100, 100);
  const requestPercentage = request ? Math.min((request / maxValue) * 100, 100) : null;

  // Determine color based on usage
  const usageColor = percentage > 90 ? '#ef4444' : percentage > 70 ? '#f59e0b' : color;

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          {icon}
          <span>{label}</span>
        </div>
        <div className="text-lg font-mono font-bold" style={{ color: usageColor }}>
          {formatted}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 bg-slate-900 rounded-full overflow-hidden">
        {/* Request marker */}
        {requestPercentage !== null && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400/70 z-10"
            style={{ left: `${requestPercentage}%` }}
          />
        )}
        
        {/* Usage bar */}
        <div 
          className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-500"
          style={{ 
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${usageColor}80, ${usageColor})`
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          {requestFormatted && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-amber-400/70 rounded-sm" />
              <span>Request: {requestFormatted}</span>
            </div>
          )}
          {limitFormatted && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-slate-500 rounded-sm" />
              <span>Limit: {limitFormatted}</span>
            </div>
          )}
        </div>
        <span>{percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
};

// Main metrics panel
const MetricsPanel: React.FC<{
  title: string;
  icon: React.ReactNode;
  currentValue: string;
  history: MetricPoint[];
  color: string;
  trend?: 'up' | 'down' | 'stable';
  request?: string;
  limit?: string;
}> = ({ title, icon, currentValue, history, color, trend, request, limit }) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
  const trendColor = trend === 'up' ? 'text-amber-400' : trend === 'down' ? 'text-emerald-400' : '';

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/30">
        <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold uppercase tracking-wider">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-2">
          {TrendIcon && <TrendIcon size={14} className={trendColor} />}
          <span className="text-2xl font-mono font-bold" style={{ color }}>
            {currentValue}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <MiniChart history={history} color={color} height={80} />
      </div>

      {/* Resource info */}
      {(request || limit) && (
        <div className="px-4 pb-4 flex items-center gap-4 text-xs text-slate-500">
          {request && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-amber-400/70 rounded-sm" />
              <span>Request: {request}</span>
            </div>
          )}
          {limit && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-400/70 rounded-sm" />
              <span>Limit: {limit}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const PodMetrics: React.FC<Props> = ({ pod }) => {
  const { client } = useClusterStore();
  const [metricsAvailable, setMetricsAvailable] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<PodMetricsData | null>(null);
  const [cpuHistory, setCpuHistory] = useState<MetricPoint[]>([]);
  const [memHistory, setMemHistory] = useState<MetricPoint[]>([]);
  const [containerHistories, setContainerHistories] = useState<Record<string, { cpu: MetricPoint[]; mem: MetricPoint[] }>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const namespace = pod.metadata?.namespace || 'default';
  const podName = pod.metadata?.name || '';

  // Parse resource requirements
  const getResourceRequirements = (containerName: string) => {
    const container = pod.spec?.containers?.find(c => c.name === containerName);
    const resources = container?.resources;
    
    return {
      cpuRequest: resources?.requests?.cpu,
      cpuLimit: resources?.limits?.cpu,
      memRequest: resources?.requests?.memory,
      memLimit: resources?.limits?.memory
    };
  };

  // Check if metrics-server is available
  useEffect(() => {
    const checkMetrics = async () => {
      if (!client) return;
      try {
        const available = await client.checkMetricsAvailable();
        setMetricsAvailable(available);
      } catch {
        setMetricsAvailable(false);
      }
    };
    checkMetrics();
  }, [client]);

  // Poll metrics
  useEffect(() => {
    if (!client || metricsAvailable !== true) return;

    const fetchMetrics = async () => {
      try {
        const data = await client.getPodMetrics(namespace, podName);
        if (data) {
          setMetrics(data);
          setLastUpdate(new Date());

          // Update histories
          const now = Date.now();
          setCpuHistory(prev => [...prev.slice(-59), { timestamp: now, value: data.cpu.usage }]);
          setMemHistory(prev => [...prev.slice(-59), { timestamp: now, value: data.memory.usage }]);

          // Update container histories
          setContainerHistories(prev => {
            const updated = { ...prev };
            data.containers.forEach(c => {
              if (!updated[c.name]) {
                updated[c.name] = { cpu: [], mem: [] };
              }
              updated[c.name].cpu = [...updated[c.name].cpu.slice(-59), { timestamp: now, value: c.cpu.usage }];
              updated[c.name].mem = [...updated[c.name].mem.slice(-59), { timestamp: now, value: c.memory.usage }];
            });
            return updated;
          });
        }
      } catch (e) {
        console.warn('Metrics fetch error:', e);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, [client, namespace, podName, metricsAvailable]);

  // Calculate trend
  const getTrend = (history: MetricPoint[]): 'up' | 'down' | 'stable' => {
    if (history.length < 3) return 'stable';
    const recent = history.slice(-3);
    const avgRecent = recent.reduce((a, b) => a + b.value, 0) / recent.length;
    const older = history.slice(-6, -3);
    if (older.length === 0) return 'stable';
    const avgOlder = older.reduce((a, b) => a + b.value, 0) / older.length;
    
    const change = ((avgRecent - avgOlder) / avgOlder) * 100;
    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  };

  // Not available state
  if (metricsAvailable === false) {
    return (
      <div className="space-y-6">
        <Card>
          <CardBody>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle size={48} className="text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                Metrics Server Not Available
              </h3>
              <p className="text-sm text-slate-400 max-w-md mb-6">
                The Kubernetes metrics-server is not installed or not accessible in this cluster.
                Install metrics-server to view real-time CPU and memory usage.
              </p>
              <div className="bg-slate-800/50 rounded-lg p-4 text-left">
                <p className="text-xs text-slate-500 mb-2">Install metrics-server:</p>
                <code className="text-xs text-emerald-400 font-mono">
                  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
                </code>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Loading state
  if (metricsAvailable === null || !metrics) {
    return (
      <div className="space-y-6">
        <Card>
          <CardBody>
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={24} className="text-slate-400 animate-spin mr-3" />
              <span className="text-slate-400">Loading metrics...</span>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Get aggregated resource requirements
  const totalCpuRequest = pod.spec?.containers?.reduce((sum, c) => {
    const req = c.resources?.requests?.cpu;
    return sum + (req ? parseCpuToMillicores(req) : 0);
  }, 0) || 0;

  const totalCpuLimit = pod.spec?.containers?.reduce((sum, c) => {
    const lim = c.resources?.limits?.cpu;
    return sum + (lim ? parseCpuToMillicores(lim) : 0);
  }, 0) || 0;

  const totalMemRequest = pod.spec?.containers?.reduce((sum, c) => {
    const req = c.resources?.requests?.memory;
    return sum + (req ? parseMemoryToBytes(req) : 0);
  }, 0) || 0;

  const totalMemLimit = pod.spec?.containers?.reduce((sum, c) => {
    const lim = c.resources?.limits?.memory;
    return sum + (lim ? parseMemoryToBytes(lim) : 0);
  }, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Last update info */}
      <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
        <Clock size={12} />
        <span>
          Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
        </span>
        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricsPanel
          title="CPU Usage"
          icon={<Cpu size={16} className="text-blue-400" />}
          currentValue={metrics.cpu.formatted}
          history={cpuHistory}
          color="#60a5fa"
          trend={getTrend(cpuHistory)}
          request={totalCpuRequest ? formatCpu(totalCpuRequest * 1e6) : undefined}
          limit={totalCpuLimit ? formatCpu(totalCpuLimit * 1e6) : undefined}
        />
        <MetricsPanel
          title="Memory Usage"
          icon={<HardDrive size={16} className="text-emerald-400" />}
          currentValue={metrics.memory.formatted}
          history={memHistory}
          color="#34d399"
          trend={getTrend(memHistory)}
          request={totalMemRequest ? formatMemory(totalMemRequest) : undefined}
          limit={totalMemLimit ? formatMemory(totalMemLimit) : undefined}
        />
      </div>

      {/* Resource utilization bars */}
      <Card>
        <CardHeader icon={<Gauge size={16} />} title="Resource Utilization" />
        <CardBody className="space-y-4">
          <ResourceBar
            label="CPU"
            current={metrics.cpu.usage}
            request={totalCpuRequest ? totalCpuRequest * 1e6 : undefined}
            limit={totalCpuLimit ? totalCpuLimit * 1e6 : undefined}
            formatted={metrics.cpu.formatted}
            requestFormatted={totalCpuRequest ? formatCpu(totalCpuRequest * 1e6) : undefined}
            limitFormatted={totalCpuLimit ? formatCpu(totalCpuLimit * 1e6) : undefined}
            icon={<Cpu size={14} className="text-blue-400" />}
            color="#60a5fa"
          />
          <ResourceBar
            label="Memory"
            current={metrics.memory.usage}
            request={totalMemRequest || undefined}
            limit={totalMemLimit || undefined}
            formatted={metrics.memory.formatted}
            requestFormatted={totalMemRequest ? formatMemory(totalMemRequest) : undefined}
            limitFormatted={totalMemLimit ? formatMemory(totalMemLimit) : undefined}
            icon={<HardDrive size={14} className="text-emerald-400" />}
            color="#34d399"
          />
        </CardBody>
      </Card>

      {/* Per-container metrics */}
      {metrics.containers.length > 0 && (
        <Card>
          <CardHeader icon={<Box size={16} />} title="Container Metrics" />
          <CardBody className="space-y-4">
            {metrics.containers.map(container => {
              const requirements = getResourceRequirements(container.name);
              const containerHist = containerHistories[container.name];

              return (
                <div 
                  key={container.name}
                  className="bg-slate-900/50 rounded-lg border border-slate-700/30 overflow-hidden"
                >
                  <div className="px-4 py-3 bg-slate-800/30 border-b border-slate-700/30">
                    <span className="text-sm font-mono text-slate-300">{container.name}</span>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    {/* CPU & Memory side by side */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Cpu size={12} className="text-blue-400" />
                            <span>CPU</span>
                          </div>
                          <span className="text-sm font-mono text-blue-400">
                            {container.cpu.formatted}
                          </span>
                        </div>
                        {containerHist && containerHist.cpu.length > 1 && (
                          <MiniChart history={containerHist.cpu} color="#60a5fa" height={40} />
                        )}
                        {requirements.cpuRequest && (
                          <div className="mt-2 text-xs text-slate-500">
                            Request: {requirements.cpuRequest}
                            {requirements.cpuLimit && ` / Limit: ${requirements.cpuLimit}`}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <HardDrive size={12} className="text-emerald-400" />
                            <span>Memory</span>
                          </div>
                          <span className="text-sm font-mono text-emerald-400">
                            {container.memory.formatted}
                          </span>
                        </div>
                        {containerHist && containerHist.mem.length > 1 && (
                          <MiniChart history={containerHist.mem} color="#34d399" height={40} />
                        )}
                        {requirements.memRequest && (
                          <div className="mt-2 text-xs text-slate-500">
                            Request: {requirements.memRequest}
                            {requirements.memLimit && ` / Limit: ${requirements.memLimit}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      {/* Metrics info */}
      <Card>
        <CardHeader icon={<BarChart3 size={16} />} title="About Metrics" />
        <CardBody>
          <div className="text-sm text-slate-400 space-y-2">
            <p>
              Metrics are collected from the Kubernetes <strong className="text-slate-300">metrics-server</strong> API 
              (<code className="text-emerald-400 text-xs">metrics.k8s.io/v1beta1</code>).
            </p>
            <p>
              The metrics-server collects resource metrics from Kubelets and exposes them through the 
              Kubernetes API server. Data is updated approximately every 15 seconds by the metrics-server.
            </p>
            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-500 mb-2">Other metrics sources (not currently integrated):</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• <strong className="text-slate-400">Prometheus</strong> - Full metrics with long-term storage</li>
                <li>• <strong className="text-slate-400">Custom Metrics API</strong> - Application-specific metrics</li>
                <li>• <strong className="text-slate-400">External Metrics API</strong> - Metrics from external systems</li>
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

// Utility functions for parsing resource values
function parseCpuToMillicores(cpu: string): number {
  if (cpu.endsWith('m')) {
    return parseInt(cpu.slice(0, -1), 10);
  }
  if (cpu.endsWith('n')) {
    return parseInt(cpu.slice(0, -1), 10) / 1e6;
  }
  return parseFloat(cpu) * 1000;
}

function parseMemoryToBytes(mem: string): number {
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
    if (mem.endsWith(unit)) {
      return parseFloat(mem.slice(0, -unit.length)) * multiplier;
    }
  }
  return parseFloat(mem);
}

function formatCpu(nanos: number): string {
  const millicores = nanos / 1e6;
  if (millicores < 1) {
    return `${(nanos / 1e3).toFixed(0)}µ`;
  }
  if (millicores < 1000) {
    return `${millicores.toFixed(0)}m`;
  }
  return `${(millicores / 1000).toFixed(2)} cores`;
}

function formatMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)}Ki`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)}Mi`;
  return `${(bytes / 1024 ** 3).toFixed(2)}Gi`;
}
