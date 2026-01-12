import React, { useEffect, useState, useRef } from 'react';
import { Cpu, HardDrive, Activity, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface MetricPoint {
  timestamp: number;
  value: number;
}

interface MetricsChartProps {
  label: string;
  icon: 'cpu' | 'memory';
  currentValue: number;
  formattedValue: string;
  color?: string;
  maxDataPoints?: number;
}

const MetricsChart: React.FC<MetricsChartProps> = ({
  label,
  icon,
  currentValue,
  formattedValue,
  color = '#60a5fa',
  maxDataPoints = 30
}) => {
  const [history, setHistory] = useState<MetricPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Update history when value changes
  useEffect(() => {
    setHistory(prev => {
      const newPoint = { timestamp: Date.now(), value: currentValue };
      const updated = [...prev, newPoint].slice(-maxDataPoints);
      return updated;
    });
  }, [currentValue, maxDataPoints]);

  // Draw chart
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
    const height = rect.height;
    const padding = 4;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Find min/max for scaling
    const values = history.map(p => p.value);
    const maxVal = Math.max(...values) * 1.1 || 1;
    const minVal = 0;

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${color}40`);
    gradient.addColorStop(1, `${color}00`);

    ctx.beginPath();
    ctx.moveTo(padding, height - padding);

    history.forEach((point, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point.value - minVal) / (maxVal - minVal)) * (height - padding * 2);
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo(width - padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    history.forEach((point, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point.value - minVal) / (maxVal - minVal)) * (height - padding * 2);
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
      const y = height - padding - ((lastPoint.value - minVal) / (maxVal - minVal)) * (height - padding * 2);
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [history, color]);

  const Icon = icon === 'cpu' ? Cpu : HardDrive;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700/30">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <Icon size={14} style={{ color }} />
          {label}
        </div>
        <div className="text-lg font-mono font-bold" style={{ color }}>
          {formattedValue}
        </div>
      </div>
      
      {/* Chart */}
      <div className="p-2 h-20">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
};

interface PodMetricsDisplayProps {
  namespace: string;
  podName: string;
  client: any;
}

export const PodMetricsDisplay: React.FC<PodMetricsDisplayProps> = ({
  namespace,
  podName,
  client
}) => {
  const [metricsAvailable, setMetricsAvailable] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<{
    cpu: { usage: number; formatted: string };
    memory: { usage: number; formatted: string };
    containers: Array<{
      name: string;
      cpu: { usage: number; formatted: string };
      memory: { usage: number; formatted: string };
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if metrics-server is available
  useEffect(() => {
    const checkMetrics = async () => {
      if (!client) return;
      try {
        const available = await client.checkMetricsAvailable();
        setMetricsAvailable(available);
        if (!available) {
          setError('metrics-server not available');
        }
      } catch {
        setMetricsAvailable(false);
        setError('Failed to check metrics availability');
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
          setError(null);
        }
      } catch (e: any) {
        console.warn('Metrics fetch error:', e);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, [client, namespace, podName, metricsAvailable]);

  // Not available state
  if (metricsAvailable === false) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <AlertTriangle size={16} className="text-yellow-500/70" />
          <span>Metrics unavailable</span>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Install metrics-server to view CPU & memory usage
        </p>
      </div>
    );
  }

  // Loading state
  if (metricsAvailable === null || !metrics) {
    return (
      <div className="space-y-3">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-4 animate-pulse">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-slate-500" />
            <span className="text-slate-500 text-sm">Loading metrics...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Total Pod Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricsChart
          label="CPU"
          icon="cpu"
          currentValue={metrics.cpu.usage}
          formattedValue={metrics.cpu.formatted}
          color="#60a5fa"
        />
        <MetricsChart
          label="Memory"
          icon="memory"
          currentValue={metrics.memory.usage}
          formattedValue={metrics.memory.formatted}
          color="#34d399"
        />
      </div>

      {/* Per-container metrics (if multiple containers) */}
      {metrics.containers.length > 1 && (
        <div className="mt-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            Per Container
          </h4>
          <div className="space-y-2">
            {metrics.containers.map(container => (
              <div
                key={container.name}
                className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-3"
              >
                <div className="text-xs font-mono text-slate-400 mb-2 truncate">
                  {container.name}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Cpu size={12} className="text-blue-400" />
                    <span className="text-slate-300 font-mono">{container.cpu.formatted}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HardDrive size={12} className="text-emerald-400" />
                    <span className="text-slate-300 font-mono">{container.memory.formatted}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface NodeMetricsDisplayProps {
  nodeName: string;
  client: any;
}

export const NodeMetricsDisplay: React.FC<NodeMetricsDisplayProps> = ({
  nodeName,
  client
}) => {
  const [metricsAvailable, setMetricsAvailable] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<{
    cpu: { usage: number; formatted: string };
    memory: { usage: number; formatted: string };
  } | null>(null);

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
        const data = await client.getNodeMetrics(nodeName);
        if (data) setMetrics(data);
      } catch (e: any) {
        console.warn('Node metrics fetch error:', e);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);

    return () => clearInterval(interval);
  }, [client, nodeName, metricsAvailable]);

  if (metricsAvailable === false) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <AlertTriangle size={16} className="text-yellow-500/70" />
          <span>Metrics unavailable</span>
        </div>
      </div>
    );
  }

  if (metricsAvailable === null || !metrics) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-4 animate-pulse">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-slate-500" />
          <span className="text-slate-500 text-sm">Loading metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricsChart
        label="CPU"
        icon="cpu"
        currentValue={metrics.cpu.usage}
        formattedValue={metrics.cpu.formatted}
        color="#f59e0b"
      />
      <MetricsChart
        label="Memory"
        icon="memory"
        currentValue={metrics.memory.usage}
        formattedValue={metrics.memory.formatted}
        color="#8b5cf6"
      />
    </div>
  );
};

export default MetricsChart;
