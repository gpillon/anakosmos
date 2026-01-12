import React from 'react';
import Editor from '@monaco-editor/react';
import { RefreshCw } from 'lucide-react';
import { ResourceTopBar } from './ResourceTopBar';
import { EventsCard } from './EventsCard';

interface ResourceViewLayoutProps {
  // Resource info
  namespace: string;
  resourceId: string;
  resourceName: string;
  resourceKind: string;
  
  // States
  isLoading: boolean;
  loadingMessage?: string;
  
  // YAML tab props (if applicable)
  activeTab: string;
  yamlContent?: string;
  isYamlLoading?: boolean;
  isYamlReadOnly?: boolean;
  onYamlChange?: (value: string) => void;
  onYamlSave?: (value: string) => Promise<void>;
  
  // Actions
  onDelete?: () => Promise<void>;
  onScrollToEvents?: () => void;
  eventsRef?: React.RefObject<HTMLDivElement | null>;
  
  // Display options
  isReadOnly?: boolean;
  showLiveUpdates?: boolean;
  
  // Custom left-side actions (e.g., shell/logs buttons for pods)
  leftActions?: React.ReactNode;
  
  // Tab content
  children: React.ReactNode;
}

/**
 * Shared layout component for all resource views.
 * Handles the common structure: top bar, loading state, events card, and YAML editor.
 */
export const ResourceViewLayout: React.FC<ResourceViewLayoutProps> = ({
  namespace,
  resourceId,
  resourceName,
  resourceKind,
  isLoading,
  loadingMessage = `Loading ${resourceKind.toLowerCase()} details...`,
  activeTab,
  yamlContent = '',
  isYamlLoading = false,
  isYamlReadOnly = false,
  onYamlChange,
  onYamlSave,
  onDelete,
  onScrollToEvents,
  eventsRef,
  isReadOnly = false,
  showLiveUpdates = true,
  leftActions,
  children,
}) => {
  // YAML Tab
  if (activeTab === 'yaml') {
    return (
      <div className="h-full w-full bg-[#1e1e1e] relative">
        {isYamlLoading && <div className="text-slate-400 p-4">Loading YAML...</div>}
        {!isYamlLoading && (
          <Editor
            height="100%"
            defaultLanguage="yaml"
            theme="vs-dark"
            value={yamlContent}
            onChange={(value) => onYamlChange?.(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              scrollBeyondLastLine: false,
              readOnly: isYamlReadOnly,
            }}
          />
        )}
        
        {/* Top right indicator for readonly */}
        {isYamlReadOnly && (
          <div className="absolute top-4 right-4 z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-900/30 rounded border border-amber-800/50">
              Read Only
            </div>
          </div>
        )}
        
        {/* Apply button for editable YAML */}
        {!isYamlReadOnly && onYamlSave && (
          <div className="absolute bottom-4 right-4 z-10">
            <button
              onClick={() => onYamlSave(yamlContent)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded shadow-lg font-medium text-sm transition-colors"
            >
              Apply Changes
            </button>
          </div>
        )}
      </div>
    );
  }

  // Regular tabs
  return (
    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Top bar with indicators and delete button */}
        <ResourceTopBar
          namespace={namespace}
          resourceId={resourceId}
          resourceName={resourceName}
          resourceKind={resourceKind}
          isReadOnly={isReadOnly}
          showLiveUpdates={showLiveUpdates}
          onDelete={onDelete}
          onScrollToEvents={onScrollToEvents}
          leftActions={leftActions}
        />

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-slate-400">
              <RefreshCw size={16} className="animate-spin" />
              {loadingMessage}
            </div>
          </div>
        ) : (
          <>
            {/* Tab content */}
            {children}

            {/* Events section */}
            <div ref={eventsRef} className="mt-6">
              <EventsCard namespace={namespace} resourceId={resourceId} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
