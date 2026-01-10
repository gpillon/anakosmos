import React from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { ALL_KINDS } from '../config/resourceKinds';
import { LayoutGrid, Layers, Network, Server, Database } from 'lucide-react';
import { clsx } from 'clsx';

// Define Filters for each Preset
const VIEW_PRESETS = [
  { 
    id: 'overview', 
    label: 'Overview', 
    icon: LayoutGrid,
    show: ALL_KINDS // Show everything
  },
  { 
    id: 'workload', 
    label: 'Workloads', 
    icon: Layers,
    show: ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Pod', 'Job', 'CronJob']
  },
  { 
    id: 'networking', 
    label: 'Networking', 
    icon: Network,
    show: ['Service', 'Ingress', 'Route', 'NetworkAttachmentDefinition', 'NodeNetworkConfigurationPolicy', 'Pod']
  },
  { 
    id: 'infrastructure', 
    label: 'Nodes', 
    icon: Server,
    show: ['Node', 'Pod'] 
  },
  { 
    id: 'storage', 
    label: 'Storage', 
    icon: Database,
    show: ['PersistentVolume', 'PersistentVolumeClaim', 'StorageClass', 'Pod']
  },
];

export const ViewSelector: React.FC = () => {
  const setHiddenResourceKinds = useSettingsStore(state => state.setHiddenResourceKinds);
  const activePreset = useSettingsStore(state => state.activePreset);
  const setActivePreset = useSettingsStore(state => state.setActivePreset);

  const applyPreset = (presetId: string, showKinds: string[]) => {
    setActivePreset(presetId);
    
    // Calculate hidden kinds: ALL_KINDS - showKinds
    const hidden = ALL_KINDS.filter(k => !showKinds.includes(k));
    setHiddenResourceKinds(hidden);
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-slate-900/90 backdrop-blur border border-slate-700/50 p-1.5 rounded-full shadow-2xl flex gap-1">
        {VIEW_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset.id, preset.show)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              activePreset === preset.id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <preset.icon size={16} />
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
};
