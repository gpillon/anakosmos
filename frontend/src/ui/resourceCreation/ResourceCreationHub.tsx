import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Minimize2, Maximize2, Layers, Package, FileText, Radio } from 'lucide-react';
import { clsx } from 'clsx';
import { useResourceCreationStore } from '../../store/useResourceCreationStore';
import { useClusterStore } from '../../store/useClusterStore';
import { ErrorModal } from '../components/ErrorModal';

// Import refactored form components
import { YamlCreationForm } from './YamlCreationForm';
import { HelmCreationForm } from './HelmCreationForm';
import { ApplicationCreationTab } from './application';

const TAB_CONFIG = [
  { id: 'yaml', label: 'YAML', icon: FileText },
  { id: 'helm', label: 'Helm', icon: Package },
  { id: 'app', label: 'Application', icon: Layers },
] as const;

export const ResourceCreationHub: React.FC = () => {
  const {
    isOpen,
    isMinimized,
    setMinimized,
    activeTab,
    setActiveTab,
    closeHub,
    setCreationMode,
  } = useResourceCreationStore();
  const client = useClusterStore((state) => state.client);
  const resources = useClusterStore((state) => state.resources);

  // Get namespace list from cluster resources
  const namespaces = useMemo(() => {
    const ns = new Set<string>();
    Object.values(resources).forEach((r) => {
      if (r.namespace) ns.add(r.namespace);
    });
    return Array.from(ns).sort();
  }, [resources]);

  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCreationMode(isOpen && activeTab === 'app');
  }, [isOpen, activeTab, setCreationMode]);

  if (!isOpen) return null;

  const handleClose = () => {
    closeHub();
    setStatusMessage(null);
    setError(null);
  };

  // Match ResourceDetailsWindow structure and styling
  return (
    <>
      <div
        className={clsx(
          'fixed z-[200] bg-slate-950 border border-slate-700 shadow-2xl transition-all duration-300 flex flex-col font-mono text-sm',
          isMinimized
            ? 'bottom-0 right-0 w-96 h-12 rounded-t-lg overflow-hidden'
            : 'inset-x-20 bottom-20 top-20 rounded-lg'
        )}
      >
        {/* Header / Tab Bar - matches ResourceDetailsWindow */}
        <div className="flex items-center bg-slate-900 border-b border-slate-800 h-12 shrink-0">
          <div className="flex-1 flex overflow-x-auto h-full">
            {/* Resource identifier tab */}
            <div className="flex items-center gap-2 px-4 cursor-default border-r border-slate-800 min-w-[150px] max-w-[200px] h-full relative bg-slate-950 text-blue-400 border-t-2 border-t-blue-500">
              <Plus size={14} />
              <span className="truncate text-xs font-medium flex-1">Create Resources</span>
              {isSubmitting && <Radio size={10} className="animate-pulse text-emerald-400" />}
            </div>

            {/* Tabs */}
            {!isMinimized &&
              TAB_CONFIG.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-4 border-r border-slate-800 min-w-[100px] hover:bg-slate-800 transition-colors h-full relative',
                    activeTab === tab.id
                      ? 'bg-slate-950 text-blue-400 border-t-2 border-t-blue-500'
                      : 'text-slate-500 border-t-2 border-t-transparent bg-slate-900'
                  )}
                >
                  <tab.icon size={14} />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              ))}

            {/* Status message */}
            {statusMessage && !isMinimized && (
              <div className="flex items-center px-4 text-xs text-emerald-400">
                {statusMessage}
              </div>
            )}
          </div>

          {/* Window controls */}
          <div className="flex items-center gap-1 px-2 border-l border-slate-800 bg-slate-900 h-full">
            <button onClick={() => setMinimized(!isMinimized)} className="p-2 hover:bg-slate-800 text-slate-400 rounded">
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button onClick={handleClose} className="p-2 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content - matches ResourceDetailsWindow bg-black */}
        <div className={clsx('flex-1 relative overflow-hidden bg-black', isMinimized ? 'hidden' : 'block')}>
          <div className="absolute inset-0 overflow-y-auto p-6">
            {activeTab === 'yaml' && (
              <YamlCreationForm
                client={client}
                setError={setError}
                setStatusMessage={setStatusMessage}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
                namespaces={namespaces}
              />
            )}
            {activeTab === 'helm' && (
              <HelmCreationForm
                client={client}
                setError={setError}
                setStatusMessage={setStatusMessage}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
                namespaces={namespaces}
              />
            )}
            {activeTab === 'app' && (
              <ApplicationCreationTab
                client={client}
                setError={setError}
                setStatusMessage={setStatusMessage}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
                namespaces={namespaces}
              />
            )}
          </div>
        </div>
      </div>

      {error && <ErrorModal isOpen={true} title="Error" error={error} onClose={() => setError(null)} />}
    </>
  );
};
