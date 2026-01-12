import React from 'react';
import type { V2HorizontalPodAutoscaler, V2MetricSpec, V2MetricStatus } from '../../../../api/k8s-types';
import { Card, CardHeader, CardBody } from '../../shared';
import { BarChart3, Cpu, HardDrive, Box, Globe, Server } from 'lucide-react';
import { clsx } from 'clsx';

interface HPAMetricsProps {
  hpa: V2HorizontalPodAutoscaler;
  onApply: (hpa: V2HorizontalPodAutoscaler) => Promise<void>;
}

const getMetricIcon = (type: string) => {
  switch (type) {
    case 'Resource': return Cpu;
    case 'Pods': return Box;
    case 'Object': return Server;
    case 'External': return Globe;
    case 'ContainerResource': return HardDrive;
    default: return BarChart3;
  }
};

const MetricCard: React.FC<{ spec: V2MetricSpec; status?: V2MetricStatus }> = ({ spec, status }) => {
  const type = spec.type;
  const Icon = getMetricIcon(type || '');

  let name = '';
  let targetType = '';
  let targetValue = '';
  let currentValue = '';

  if (type === 'Resource' && spec.resource) {
    name = spec.resource.name || '';
    const target = spec.resource.target;
    targetType = target?.type || '';
    if (target?.averageUtilization !== undefined) {
      targetValue = `${target.averageUtilization}%`;
    } else if (target?.averageValue) {
      targetValue = target.averageValue;
    } else if (target?.value) {
      targetValue = target.value;
    }
    
    // Current value from status
    if (status?.resource) {
      if (status.resource.current?.averageUtilization !== undefined) {
        currentValue = `${status.resource.current.averageUtilization}%`;
      } else if (status.resource.current?.averageValue) {
        currentValue = status.resource.current.averageValue;
      }
    }
  } else if (type === 'Pods' && spec.pods) {
    name = spec.pods.metric?.name || '';
    const target = spec.pods.target;
    targetType = target?.type || '';
    if (target?.averageValue) targetValue = target.averageValue;
    
    if (status?.pods) {
      if (status.pods.current?.averageValue) {
        currentValue = status.pods.current.averageValue;
      }
    }
  } else if (type === 'Object' && spec.object) {
    name = spec.object.metric?.name || '';
    const target = spec.object.target;
    targetType = target?.type || '';
    if (target?.value) targetValue = target.value;
    else if (target?.averageValue) targetValue = target.averageValue;
    
    if (status?.object) {
      if (status.object.current?.value) {
        currentValue = status.object.current.value;
      } else if (status.object.current?.averageValue) {
        currentValue = status.object.current.averageValue;
      }
    }
  } else if (type === 'External' && spec.external) {
    name = spec.external.metric?.name || '';
    const target = spec.external.target;
    targetType = target?.type || '';
    if (target?.value) targetValue = target.value;
    else if (target?.averageValue) targetValue = target.averageValue;
    
    if (status?.external) {
      if (status.external.current?.value) {
        currentValue = status.external.current.value;
      } else if (status.external.current?.averageValue) {
        currentValue = status.external.current.averageValue;
      }
    }
  } else if (type === 'ContainerResource' && spec.containerResource) {
    name = `${spec.containerResource.container}/${spec.containerResource.name}`;
    const target = spec.containerResource.target;
    targetType = target?.type || '';
    if (target?.averageUtilization !== undefined) {
      targetValue = `${target.averageUtilization}%`;
    } else if (target?.averageValue) {
      targetValue = target.averageValue;
    }
    
    if (status?.containerResource) {
      if (status.containerResource.current?.averageUtilization !== undefined) {
        currentValue = `${status.containerResource.current.averageUtilization}%`;
      } else if (status.containerResource.current?.averageValue) {
        currentValue = status.containerResource.current.averageValue;
      }
    }
  }

  // Calculate progress for utilization metrics
  let progress = 0;
  if (targetType === 'Utilization' && currentValue && targetValue) {
    const current = parseFloat(currentValue);
    const target = parseFloat(targetValue);
    if (!isNaN(current) && !isNaN(target) && target > 0) {
      progress = (current / target) * 100;
    }
  }

  const isOverTarget = progress > 100;

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
      <div className="flex items-start gap-3 mb-4">
        <div className={clsx(
          "p-2 rounded-lg",
          type === 'Resource' ? "bg-blue-900/30 text-blue-400" :
          type === 'Pods' ? "bg-purple-900/30 text-purple-400" :
          type === 'Object' ? "bg-emerald-900/30 text-emerald-400" :
          type === 'External' ? "bg-amber-900/30 text-amber-400" :
          "bg-slate-700 text-slate-400"
        )}>
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-200">{name}</div>
          <div className="text-xs text-slate-500">{type} Metric • {targetType}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-xs text-slate-500 mb-1">Current</div>
          <div className={clsx(
            "text-lg font-bold",
            isOverTarget ? "text-amber-400" : "text-emerald-400"
          )}>
            {currentValue || '-'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Target</div>
          <div className="text-lg font-bold text-blue-400">{targetValue || '-'}</div>
        </div>
      </div>

      {targetType === 'Utilization' && (
        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
          <div 
            className={clsx(
              "h-full rounded-full transition-all",
              isOverTarget ? "bg-amber-500" : "bg-emerald-500"
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const HPAMetrics: React.FC<HPAMetricsProps> = ({ hpa }) => {
  const spec = hpa.spec;
  const status = hpa.status;

  const metrics = spec?.metrics || [];
  const currentMetrics = status?.currentMetrics || [];

  if (metrics.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        <BarChart3 size={32} className="mx-auto mb-3 opacity-50" />
        <p>No metrics configured</p>
        <p className="text-xs mt-1">Add metrics to enable autoscaling</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={`Metrics (${metrics.length})`} icon={<BarChart3 size={16} />} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.map((metric, idx) => {
              // Try to find matching status
              const matchingStatus = currentMetrics.find(cm => {
                if (metric.type === 'Resource' && cm.type === 'Resource') {
                  return cm.resource?.name === metric.resource?.name;
                }
                if (metric.type === 'Pods' && cm.type === 'Pods') {
                  return cm.pods?.metric?.name === metric.pods?.metric?.name;
                }
                if (metric.type === 'Object' && cm.type === 'Object') {
                  return cm.object?.metric?.name === metric.object?.metric?.name;
                }
                if (metric.type === 'External' && cm.type === 'External') {
                  return cm.external?.metric?.name === metric.external?.metric?.name;
                }
                if (metric.type === 'ContainerResource' && cm.type === 'ContainerResource') {
                  return cm.containerResource?.name === metric.containerResource?.name &&
                         cm.containerResource?.container === metric.containerResource?.container;
                }
                return false;
              });

              return (
                <MetricCard 
                  key={idx} 
                  spec={metric} 
                  status={matchingStatus} 
                />
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Quick Reference */}
      <Card>
        <CardHeader title="Metric Types Reference" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex items-start gap-2">
              <Cpu size={14} className="text-blue-400 mt-0.5" />
              <div>
                <span className="font-medium text-slate-300">Resource</span>
                <p className="text-slate-500">CPU/Memory utilization of pods</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Box size={14} className="text-purple-400 mt-0.5" />
              <div>
                <span className="font-medium text-slate-300">Pods</span>
                <p className="text-slate-500">Custom metrics from pods</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Server size={14} className="text-emerald-400 mt-0.5" />
              <div>
                <span className="font-medium text-slate-300">Object</span>
                <p className="text-slate-500">Metrics from K8s objects</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Globe size={14} className="text-amber-400 mt-0.5" />
              <div>
                <span className="font-medium text-slate-300">External</span>
                <p className="text-slate-500">Metrics from external sources</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
