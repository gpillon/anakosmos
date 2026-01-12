import React, { useState } from 'react';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { EventsIndicator } from './EventsCard';

interface ResourceTopBarProps {
  // Resource info
  namespace: string;
  resourceId: string;
  resourceName: string;
  resourceKind: string;
  
  // Display options
  isReadOnly?: boolean;
  showLiveUpdates?: boolean;
  
  // Actions
  onDelete?: () => Promise<void>;
  onScrollToEvents?: () => void;
  
  // Custom left-side actions (e.g., shell/logs buttons for pods)
  leftActions?: React.ReactNode;
}

export const ResourceTopBar: React.FC<ResourceTopBarProps> = ({
  namespace,
  resourceId,
  resourceName,
  resourceKind,
  isReadOnly = false,
  showLiveUpdates = true,
  onDelete,
  onScrollToEvents,
  leftActions,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      await onDelete();
      // The window will close automatically when the resource is deleted
    } catch (e: any) {
      setDeleteError(e?.message || 'Failed to delete resource');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        {/* Left side - Custom actions */}
        <div className="flex items-center gap-2">
          {leftActions}
        </div>

        {/* Right side - Status indicators and delete */}
        <div className="flex items-center gap-2">
          {/* Events indicator */}
          <EventsIndicator
            namespace={namespace}
            resourceId={resourceId}
            onClick={onScrollToEvents}
          />
          
          {/* Read Only indicator */}
          {isReadOnly && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-900/30 rounded border border-amber-800/50">
              Read Only
            </div>
          )}
          
          {/* Live Updates indicator */}
          {showLiveUpdates && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-900/30 rounded border border-emerald-800/50">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Live Updates
            </div>
          )}
          
          {/* Delete button */}
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-900/20 hover:bg-red-900/40 rounded border border-red-800/50 transition-colors"
              title={`Delete ${resourceKind}`}
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
              <div className="p-2 bg-red-900/30 rounded-full">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete {resourceKind}?</h3>
            </div>
            
            <div className="p-6">
              <p className="text-slate-300 mb-4">
                Are you sure you want to delete <span className="font-mono text-white">{resourceName}</span>?
              </p>
              <p className="text-sm text-slate-500 mb-4">
                This action cannot be undone. The {resourceKind.toLowerCase()} and all its associated resources will be permanently removed from the cluster.
              </p>
              
              {deleteError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-300">
                  {deleteError}
                </div>
              )}
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteError(null);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors",
                    isDeleting
                      ? "bg-red-800 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-500"
                  )}
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
