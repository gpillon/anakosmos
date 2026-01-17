import React from 'react';
import { Save, X, RefreshCw, AlertCircle } from 'lucide-react';

interface SaveBarProps {
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Whether currently saving */
  isSaving: boolean;
  /** Save handler */
  onSave: () => Promise<void>;
  /** Discard changes handler */
  onDiscard: () => void;
  /** Custom message (optional) */
  message?: string;
}

/**
 * Global save bar that appears when there are unsaved changes.
 * Displayed at the top of the resource view, sticky positioned.
 */
export const SaveBar: React.FC<SaveBarProps> = ({
  hasChanges,
  isSaving,
  onSave,
  onDiscard,
  message = 'You have unsaved changes'
}) => {
  if (!hasChanges) return null;

  const handleSave = async () => {
    try {
      await onSave();
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  return (
    <div className="sticky top-0 z-20 mx-6 mb-4">
      <div className="bg-gradient-to-r from-amber-900/90 to-amber-800/90 backdrop-blur-md border border-amber-600/50 rounded-xl p-3 shadow-lg shadow-amber-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertCircle size={18} className="text-amber-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-amber-100">{message}</span>
              <p className="text-xs text-amber-300/70 mt-0.5">
                Save your changes or discard them to continue
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onDiscard}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-200 hover:text-white hover:bg-amber-700/50 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={14} />
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-sm font-bold rounded-lg transition-colors shadow-md"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
