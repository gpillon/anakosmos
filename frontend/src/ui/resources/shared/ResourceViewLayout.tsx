import React from 'react';
import Editor from '@monaco-editor/react';
import { RefreshCw, AlertTriangle, X, RotateCcw } from 'lucide-react';
import { ResourceTopBar } from './ResourceTopBar';
import { EventsCard } from './EventsCard';
import { SaveBar } from './SaveBar';
import { ErrorBanner } from './ErrorBanner';
import { ValidationErrorProvider, type KubernetesError } from './ValidationErrorContext';

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
  
  // Centralized model save bar props
  hasChanges?: boolean;
  isSaving?: boolean;
  onSave?: () => Promise<void>;
  onDiscard?: () => void;
  
  // Server update notification props
  hasServerUpdate?: boolean;
  serverResourceVersion?: string;
  onReloadFromServer?: () => void;
  onDismissServerUpdate?: () => void;
  
  // Error handling props
  saveError?: KubernetesError | null;
  onClearError?: () => void;
  
  // Tab content
  children: React.ReactNode;
}

/**
 * Server Update Banner - shown when the server has a newer version while user has local changes
 */
const ServerUpdateBanner: React.FC<{
  resourceVersion?: string;
  onReload: () => void;
  onDismiss: () => void;
}> = ({ resourceVersion, onReload, onDismiss }) => (
  <div className="sticky top-0 z-40 bg-amber-900/90 backdrop-blur-sm border-b border-amber-700 px-4 py-2 flex items-center justify-between shadow-lg">
    <div className="flex items-center gap-3">
      <div className="p-1.5 bg-amber-800 rounded-lg">
        <AlertTriangle size={16} className="text-amber-300" />
      </div>
      <div>
        <span className="text-amber-100 font-medium text-sm">
          This resource has been updated on the server
        </span>
        {resourceVersion && (
          <span className="text-amber-300/70 text-xs ml-2">
            (version: {resourceVersion})
          </span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onReload}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-amber-100 text-xs font-semibold rounded transition-colors"
      >
        <RotateCcw size={12} />
        Reload
      </button>
      <button
        onClick={onDismiss}
        className="p-1.5 hover:bg-amber-800 text-amber-300 rounded transition-colors"
        title="Dismiss (keep your changes)"
      >
        <X size={14} />
      </button>
    </div>
  </div>
);

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
  hasChanges = false,
  isSaving = false,
  onSave,
  onDiscard,
  hasServerUpdate = false,
  serverResourceVersion,
  onReloadFromServer,
  onDismissServerUpdate,
  saveError,
  onClearError,
  children,
}) => {
  // Wrap children with ValidationErrorProvider to enable field error highlighting
  const wrappedChildren = (
    <ValidationErrorProvider 
      error={saveError ?? null} 
      onClearErrors={onClearError ?? (() => {})}
    >
      {children}
    </ValidationErrorProvider>
  );

  // YAML Tab
  if (activeTab === 'yaml') {
    return (
      <div className="h-full w-full bg-[#1e1e1e] relative flex flex-col">
        {/* Error Banner for YAML tab */}
        {saveError && onClearError && (
          <ErrorBanner error={saveError} onDismiss={onClearError} />
        )}
        
        {/* Server update banner for YAML tab */}
        {hasServerUpdate && onReloadFromServer && onDismissServerUpdate && (
          <ServerUpdateBanner
            resourceVersion={serverResourceVersion}
            onReload={onReloadFromServer}
            onDismiss={onDismissServerUpdate}
          />
        )}
        
        <div className="flex-1 relative">
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
      </div>
    );
  }

  // Regular tabs
  return (
    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
      {/* Error Banner - shown when save fails */}
      {saveError && onClearError && (
        <ErrorBanner error={saveError} onDismiss={onClearError} />
      )}
      
      {/* Server Update Banner - shown when server has newer version while user has local changes */}
      {hasServerUpdate && onReloadFromServer && onDismissServerUpdate && (
        <ServerUpdateBanner
          resourceVersion={serverResourceVersion}
          onReload={onReloadFromServer}
          onDismiss={onDismissServerUpdate}
        />
      )}
      
      {/* Global Save Bar - appears when there are unsaved changes */}
      {hasChanges && onSave && onDiscard && (
        <SaveBar
          hasChanges={hasChanges}
          isSaving={isSaving}
          onSave={onSave}
          onDiscard={onDiscard}
        />
      )}
      
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
            {/* Tab content wrapped with ValidationErrorProvider */}
            {wrappedChildren}

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
