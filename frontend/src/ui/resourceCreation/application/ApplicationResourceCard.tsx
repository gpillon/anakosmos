import React from 'react';
import { 
  Pencil, 
  Trash2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import type { DraftResource } from '../../../store/useApplicationDraftStore';
import { KIND_CONFIG, KIND_COLOR_MAP, DEFAULT_COLOR } from '../../../config/resourceKinds';

interface ApplicationResourceCardProps {
  resource: DraftResource;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Extracts key information from a resource spec for the macro display.
 */
function extractMacroInfo(resource: DraftResource): { label: string; value: string }[] {
  const spec = resource.spec as Record<string, unknown>;
  const metadata = spec.metadata as Record<string, unknown> || {};
  const innerSpec = spec.spec as Record<string, unknown> || {};
  const items: { label: string; value: string }[] = [];
  
  // Always show name
  if (metadata.name) {
    items.push({ label: 'Name', value: String(metadata.name) });
  }
  
  // Kind-specific info
  switch (resource.kind) {
    case 'Deployment': {
      const replicas = innerSpec.replicas;
      if (replicas !== undefined) {
        items.push({ label: 'Replicas', value: String(replicas) });
      }
      const containers = (innerSpec.template as Record<string, unknown>)?.spec as Record<string, unknown>;
      const containerList = containers?.containers as Array<Record<string, unknown>>;
      if (containerList?.[0]?.image) {
        items.push({ label: 'Image', value: String(containerList[0].image) });
      }
      break;
    }
    case 'Service': {
      const serviceType = innerSpec.type;
      if (serviceType) {
        items.push({ label: 'Type', value: String(serviceType) });
      }
      const ports = innerSpec.ports as Array<Record<string, unknown>>;
      if (ports?.[0]?.port) {
        items.push({ label: 'Port', value: String(ports[0].port) });
      }
      break;
    }
    case 'Ingress': {
      const rules = innerSpec.rules as Array<Record<string, unknown>>;
      if (rules?.[0]?.host) {
        items.push({ label: 'Host', value: String(rules[0].host) });
      }
      break;
    }
    case 'ConfigMap': {
      const data = spec.data as Record<string, unknown>;
      if (data) {
        items.push({ label: 'Keys', value: Object.keys(data).join(', ') || 'none' });
      }
      break;
    }
    case 'Secret': {
      const stringData = spec.stringData as Record<string, unknown>;
      const secretData = spec.data as Record<string, unknown>;
      const keys = Object.keys(stringData || secretData || {});
      items.push({ label: 'Keys', value: keys.length > 0 ? keys.join(', ') : 'none' });
      break;
    }
    case 'PersistentVolumeClaim': {
      const resources = innerSpec.resources as Record<string, unknown>;
      const requests = resources?.requests as Record<string, unknown>;
      if (requests?.storage) {
        items.push({ label: 'Size', value: String(requests.storage) });
      }
      break;
    }
    case 'Job': {
      const completions = innerSpec.completions;
      if (completions !== undefined) {
        items.push({ label: 'Completions', value: String(completions) });
      }
      break;
    }
    case 'CronJob': {
      const schedule = innerSpec.schedule;
      if (schedule) {
        items.push({ label: 'Schedule', value: String(schedule) });
      }
      break;
    }
    case 'HorizontalPodAutoscaler': {
      const targetRef = innerSpec.scaleTargetRef as Record<string, unknown>;
      if (targetRef?.name) {
        items.push({ label: 'Target', value: String(targetRef.name) });
      }
      const minReplicas = innerSpec.minReplicas;
      const maxReplicas = innerSpec.maxReplicas;
      if (minReplicas !== undefined && maxReplicas !== undefined) {
        items.push({ label: 'Scale', value: `${minReplicas} - ${maxReplicas}` });
      }
      break;
    }
  }
  
  return items;
}

export const ApplicationResourceCard: React.FC<ApplicationResourceCardProps> = ({
  resource,
  onEdit,
  onDelete,
}) => {
  const kindConfig = KIND_CONFIG.find(k => k.kind === resource.kind);
  const Icon = kindConfig?.icon;
  const color = KIND_COLOR_MAP[resource.kind] || DEFAULT_COLOR;
  const macroInfo = extractMacroInfo(resource);
  
  return (
    <div 
      className={clsx(
        'group relative flex items-start gap-4 p-4 rounded-xl',
        'bg-slate-900/60 border border-slate-800',
        'hover:border-slate-700 hover:bg-slate-900/80 transition-all'
      )}
    >
      {/* Color bar */}
      <div 
        className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
        style={{ backgroundColor: color }}
      />
      
      {/* Icon */}
      <div 
        className="p-2.5 rounded-lg shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        {Icon && (
          <span style={{ color }}>
            <Icon size={18} />
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span 
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {resource.kind}
          </span>
          {resource.fromBlueprint && (
            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              from blueprint
            </span>
          )}
        </div>
        
        {/* Macro info */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {macroInfo.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs overflow-hidden">
              <span className="text-slate-500 shrink-0">{item.label}:</span>
              <span className="text-slate-300 truncate">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-2 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
          title="Edit resource"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Remove resource"
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      {/* Click to edit indicator */}
      <button
        onClick={onEdit}
        className="absolute inset-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        aria-label="Edit resource"
      >
        <span className="sr-only">Click to edit</span>
      </button>
      
      {/* Visual edit hint */}
      <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>Click to edit</span>
          <ChevronRight size={14} />
        </div>
      </div>
    </div>
  );
};

/**
 * Empty state when no resources
 */
export const EmptyResourceState: React.FC<{ onSelectBlueprint: () => void }> = ({ onSelectBlueprint }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="p-4 rounded-full bg-slate-800/50 mb-4">
      <ExternalLink size={24} className="text-slate-500" />
    </div>
    <h4 className="text-sm font-medium text-slate-300 mb-2">
      No resources yet
    </h4>
    <p className="text-xs text-slate-500 max-w-sm mb-4">
      Select a blueprint above to get started with pre-configured resources,
      or add individual resources manually.
    </p>
    <button
      onClick={onSelectBlueprint}
      className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
    >
      Choose a blueprint →
    </button>
  </div>
);
