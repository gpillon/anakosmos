import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useClusterStore } from '../store/useClusterStore';
import { useTerminalStore } from '../store/useTerminalStore';
import { 
  X, Activity, Cpu, HardDrive, 
  FileText, Terminal, Clock,
  ChevronRight, Save, Download, Check, AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import Editor from '@monaco-editor/react';
import yaml from 'js-yaml';

type Tab = 'overview' | 'metadata' | 'events' | 'yaml';

export const Sidebar: React.FC = () => {
  const selectedResourceId = useSettingsStore(state => state.selectedResourceId);
  const setSelectedResourceId = useSettingsStore(state => state.setSelectedResourceId);
  const resources = useClusterStore(state => state.resources);
  const client = useClusterStore(state => state.client);
  const { openTerminal } = useTerminalStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [events, setEvents] = useState<any[]>([]);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [isYamlLoading, setIsYamlLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const resource = selectedResourceId ? resources[selectedResourceId] : null;

  // Clear feedback on tab change or resource change
  useEffect(() => {
      setFeedback(null);
  }, [activeTab, resource]);

  // Poll for events when tab is active
  useEffect(() => {
    if (!resource || activeTab !== 'events' || !client) return;

    const fetchEvents = async () => {
        const evts = await client.getEvents(resource.namespace, resource.id);
        // Sort by timestamp descending
        evts.sort((a, b) => {
            const tA = new Date(a.lastTimestamp || a.eventTime || a.metadata.creationTimestamp).getTime();
            const tB = new Date(b.lastTimestamp || b.eventTime || b.metadata.creationTimestamp).getTime();
            return tB - tA;
        });
        setEvents(evts);
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 3000); // Poll every 3s

    return () => clearInterval(interval);
  }, [resource, activeTab, client]);

  // Fetch YAML when tab is active
  useEffect(() => {
    if (!resource || activeTab !== 'yaml' || !client) return;
    
    const fetchYaml = async () => {
        setIsYamlLoading(true);
        try {
            const rawContent = await client.getYaml(resource.namespace, resource.kind, resource.name);
            try {
                // Parse and clean up YAML
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const doc = yaml.load(rawContent) as any;
                if (doc?.metadata?.managedFields) {
                    delete doc.metadata.managedFields;
                }
                setYamlContent(yaml.dump(doc));
            } catch (e) {
                console.error('YAML parse error', e);
                setYamlContent(rawContent);
            }
        } finally {
            setIsYamlLoading(false);
        }
    };
    
    fetchYaml();
  }, [resource, activeTab, client]);

    const handleApply = async () => {
        if (!client || !resource) return;
        setIsYamlLoading(true);
        setFeedback(null);
        try {
            await client.applyYaml(resource.namespace, resource.kind, resource.name, yamlContent);
            setFeedback({ type: 'success', message: 'Resource updated' });
            
            // Auto hide success after 3s
            setTimeout(() => setFeedback(null), 3000);
        } catch (e: any) {
            setFeedback({ type: 'error', message: e.message || 'Update failed' });
        } finally {
            setIsYamlLoading(false);
        }
    };

    if (!resource) return null;

  const isUnhealthy = resource.health ? (resource.health === 'error' || resource.health === 'warning') : (resource.status !== 'Running' && resource.status !== 'Ready' && resource.status !== 'Active' && resource.status !== 'Available');

  return (
    <div className={clsx(
        "absolute top-0 right-0 h-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 text-slate-100 shadow-2xl flex flex-col z-20 transition-all duration-300",
        activeTab === 'yaml' ? "w-[800px]" : "w-96"
    )}>
      
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
        
        <div className="flex gap-2 items-center">
            <div className={clsx(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold w-fit",
            isUnhealthy ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
            )}>
            <Activity size={16} />
            {resource.status}
            </div>
            
            {resource.health && resource.health !== 'ok' && (
                <div className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold w-fit",
                    resource.health === 'error' ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                )}>
                    {resource.health === 'error' ? <AlertCircle size={16} /> : <Activity size={16} />}
                    {resource.health.toUpperCase()}
                </div>
            )}
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
      <div className={clsx(
          "flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent",
          activeTab === 'yaml' ? "p-0 flex flex-col" : "p-6" 
      )}>
        
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
            {resource.kind === 'Pod' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <ActionButton 
                    icon={Terminal} 
                    label="Exec Shell" 
                    onClick={() => openTerminal(resource.id, resource.name, resource.namespace || 'default', 'shell')}
                  />
                  <ActionButton 
                    icon={FileText} 
                    label="View Logs" 
                    onClick={() => openTerminal(resource.id, resource.name, resource.namespace || 'default', 'logs')}
                  />
                </div>
              </div>
            )}

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
             {events.length === 0 ? (
                <div className="text-slate-500 text-sm italic text-center py-4">No events found</div>
             ) : (
                events.map((evt, i) => {
                    // Calculate time ago
                    const time = evt.lastTimestamp || evt.eventTime || evt.metadata.creationTimestamp;
                    const date = new Date(time);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    
                    let timeStr = `${diffMins}m ago`;
                    if (diffMins < 1) timeStr = 'Just now';
                    else if (diffMins > 60) timeStr = `${Math.floor(diffMins/60)}h ago`;

                    return (
                        <EventItem 
                            key={evt.metadata.uid || i}
                            type={evt.type === 'Warning' ? 'Warning' : 'Normal'}
                            reason={evt.reason}
                            message={evt.message}
                            time={timeStr}
                        />
                    );
                })
             )}
          </div>
        )}

        {activeTab === 'yaml' && (
          <div className="flex-1 flex flex-col h-full bg-[#1e1e1e]">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 bg-[#252526] border-b border-[#3e3e42]">
                <div className="flex items-center gap-2 px-2 overflow-hidden flex-1">
                    {feedback ? (
                        <div className={clsx(
                            "flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-left-2",
                            feedback.type === 'success' ? "text-emerald-400" : "text-red-400"
                        )}>
                            {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                            <span className="truncate" title={feedback.message}>{feedback.message}</span>
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400">
                            {isYamlLoading ? 'Processing...' : 'YAML Editor'}
                        </div>
                    )}
                </div>
                <div className="flex gap-2 shrink-0">
                    <button 
                        className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded"
                        title="Download YAML"
                    >
                        <Download size={14} />
                    </button>
                    <button 
                        onClick={handleApply}
                        disabled={isYamlLoading}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors",
                            isYamlLoading && "opacity-50 cursor-not-allowed"
                        )}
                        title="Apply Changes"
                    >
                        <Save size={14} />
                        {isYamlLoading ? 'Applying...' : 'Apply'}
                    </button>
                </div>
            </div>
            
            {/* Editor */}
            <div className="flex-1 relative">
                <Editor
                    height="100%"
                    defaultLanguage="yaml"
                    value={yamlContent}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 12,
                        wordWrap: 'on',
                        automaticLayout: true,
                        readOnly: false // Allow editing
                    }}
                    onChange={(value) => setYamlContent(value || '')}
                />
            </div>
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

const ActionButton = ({ icon: Icon, label, onClick }: { icon: any, label: string, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-all border border-slate-700 hover:border-slate-600 hover:shadow-lg active:scale-95"
  >
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
