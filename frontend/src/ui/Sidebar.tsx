import React, { useState } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useClusterStore } from '../store/useClusterStore';
import { 
  X, Activity, Cpu, HardDrive, 
  FileText, Terminal, Clock,
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';

type Tab = 'overview' | 'metadata' | 'events' | 'yaml';

export const Sidebar: React.FC = () => {
  const selectedResourceId = useSettingsStore(state => state.selectedResourceId);
  const setSelectedResourceId = useSettingsStore(state => state.setSelectedResourceId);
  const resources = useClusterStore(state => state.resources);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const resource = selectedResourceId ? resources[selectedResourceId] : null;

  if (!resource) return null;

  const isUnhealthy = resource.status !== 'Running' && resource.status !== 'Ready' && resource.status !== 'Active' && resource.status !== 'Available';

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 text-slate-100 shadow-2xl flex flex-col z-20 transition-transform duration-300">
      
      {/* Header */}
      <div className="p-6 border-b border-slate-700/50 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
            {resource.kind}
            {resource.namespace && <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400">{resource.namespace}</span>}
          </div>
          <button 
            onClick={() => setSelectedResourceId(null)}
            className="p-1 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        
        <h2 className="text-2xl font-bold break-all leading-tight">{resource.name}</h2>
        
        <div className={clsx(
          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold w-fit",
          isUnhealthy ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
        )}>
          <Activity size={16} />
          {resource.status}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/50 px-2">
        <TabButton id="overview" label="Overview" active={activeTab} onClick={setActiveTab} />
        <TabButton id="metadata" label="Metadata" active={activeTab} onClick={setActiveTab} />
        <TabButton id="events" label="Events" active={activeTab} onClick={setActiveTab} />
        <TabButton id="yaml" label="YAML" active={activeTab} onClick={setActiveTab} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Metrics */}
            {(resource.cpu || resource.memory) && (
              <div className="grid grid-cols-2 gap-3">
                <MetricCard icon={Cpu} label="CPU Usage" value={resource.cpu} />
                <MetricCard icon={HardDrive} label="Memory" value={resource.memory} />
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <ActionButton icon={Terminal} label="Exec Shell" />
                <ActionButton icon={FileText} label="View Logs" />
              </div>
            </div>

            {/* Relations */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Relations</h3>
              <div className="space-y-2">
                 {resource.ownerRefs.length > 0 ? (
                   resource.ownerRefs.map(ref => (
                     <div key={ref} className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 text-sm">
                       <ChevronRight size={14} className="text-slate-500" />
                       <span className="text-slate-400">Owned by</span>
                       <span className="font-mono text-xs bg-slate-800 px-1 py-0.5 rounded">{ref.substring(0, 8)}...</span>
                     </div>
                   ))
                 ) : (
                   <div className="text-slate-500 text-sm italic">No owner references</div>
                 )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Labels</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(resource.labels).map(([k, v]) => (
                  <div key={k} className="flex text-xs border border-slate-700 rounded overflow-hidden">
                    <span className="bg-slate-800 px-2 py-1 text-slate-400 border-r border-slate-700">{k}</span>
                    <span className="bg-slate-900 px-2 py-1 text-slate-300">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <dt className="text-slate-500">Created</dt>
                  <dd className="font-mono">{new Date(resource.creationTimestamp).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <dt className="text-slate-500">UID</dt>
                  <dd className="font-mono text-xs">{resource.id}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-4">
             {/* Mock Events */}
             <EventItem type="Normal" reason="Scheduled" message="Successfully assigned to node-worker-1" time="2m ago" />
             <EventItem type="Normal" reason="Pulling" message="Pulling image 'nginx:latest'" time="1m ago" />
             <EventItem type="Normal" reason="Created" message="Created container app" time="45s ago" />
             <EventItem type="Normal" reason="Started" message="Started container app" time="44s ago" />
             {isUnhealthy && (
                <EventItem type="Warning" reason="BackOff" message="Back-off restarting failed container" time="Now" />
             )}
          </div>
        )}

        {activeTab === 'yaml' && (
          <div className="font-mono text-xs text-slate-400 whitespace-pre-wrap bg-slate-950 p-4 rounded-lg border border-slate-800">
            {`apiVersion: v1
kind: ${resource.kind}
metadata:
  name: ${resource.name}
  namespace: ${resource.namespace}
  uid: ${resource.id}
  creationTimestamp: ${resource.creationTimestamp}
status:
  phase: ${resource.status}`}
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ id, label, active, onClick }: { id: Tab, label: string, active: Tab, onClick: (t: Tab) => void }) => (
  <button
    onClick={() => onClick(id)}
    className={clsx(
      "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
      active === id 
        ? "border-blue-500 text-blue-400" 
        : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700"
    )}
  >
    {label}
  </button>
);

const MetricCard = ({ icon: Icon, label, value }: { icon: any, label: string, value?: string }) => (
  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-2">
    <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
      <Icon size={14} /> {label}
    </div>
    <div className="text-2xl font-mono text-white">{value || '-'}</div>
  </div>
);

const ActionButton = ({ icon: Icon, label }: { icon: any, label: string }) => (
  <button className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-all border border-slate-700 hover:border-slate-600 hover:shadow-lg active:scale-95">
    <Icon size={16} className="text-blue-400" />
    {label}
  </button>
);

const EventItem = ({ type, reason, message, time }: { type: 'Normal' | 'Warning', reason: string, message: string, time: string }) => (
  <div className="flex gap-3 text-sm relative pl-4 border-l-2 border-slate-800 pb-4 last:pb-0">
    <div className={clsx(
      "absolute -left-[5px] top-0 w-2 h-2 rounded-full ring-4 ring-slate-900",
      type === 'Normal' ? "bg-slate-500" : "bg-red-500"
    )} />
    <div className="flex-1 space-y-1">
      <div className="flex justify-between items-center">
        <span className={clsx("font-semibold text-xs", type === 'Normal' ? "text-slate-300" : "text-red-400")}>
          {reason}
        </span>
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Clock size={10} /> {time}
        </span>
      </div>
      <p className="text-slate-400 text-xs leading-relaxed">{message}</p>
    </div>
  </div>
);
