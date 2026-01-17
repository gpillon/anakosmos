import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, X, Copy, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ValidationError, KubernetesError } from './ValidationErrorContext';

interface ErrorBannerProps {
  error: KubernetesError;
  onDismiss: () => void;
}

/**
 * Banner that displays Kubernetes API errors with detailed causes
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyFieldPath = (field: string) => {
    navigator.clipboard.writeText(field);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const hasCauses = error.causes.length > 0;

  return (
    <div className="sticky top-0 z-50 bg-red-950/95 backdrop-blur-sm border-b border-red-800 shadow-lg">
      {/* Main error message */}
      <div className="px-4 py-3 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-1.5 bg-red-900 rounded-lg shrink-0 mt-0.5">
            <AlertCircle size={16} className="text-red-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-red-100 font-semibold text-sm">
                Save Failed
              </span>
              {error.reason && (
                <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-800">
                  {error.reason}
                </span>
              )}
              {error.code && (
                <span className="text-xs text-red-400">
                  (HTTP {error.code})
                </span>
              )}
            </div>
            <p className="text-red-200/90 text-sm mt-1 break-words">
              {error.message}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasCauses && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-300 hover:text-red-200 hover:bg-red-900/50 rounded transition-colors"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {error.causes.length} field{error.causes.length !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="p-1.5 hover:bg-red-900 text-red-400 hover:text-red-200 rounded transition-colors"
            title="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Detailed causes */}
      {hasCauses && isExpanded && (
        <div className="px-4 pb-3 pt-0">
          <div className="bg-red-900/30 rounded-lg border border-red-800/50 divide-y divide-red-800/50">
            {error.causes.map((cause, index) => (
              <FieldErrorRow 
                key={index} 
                cause={cause} 
                onCopyField={copyFieldPath}
                isCopied={copiedField === cause.field}
              />
            ))}
          </div>
          <p className="text-xs text-red-400/70 mt-2 px-1">
            💡 Tip: The highlighted fields indicate where the errors occurred. Fix them and try saving again.
          </p>
        </div>
      )}
    </div>
  );
};

interface FieldErrorRowProps {
  cause: ValidationError;
  onCopyField: (field: string) => void;
  isCopied: boolean;
}

const FieldErrorRow: React.FC<FieldErrorRowProps> = ({ cause, onCopyField, isCopied }) => {
  // Parse the field path to make it more readable
  const formattedField = formatFieldPath(cause.field);

  return (
    <div className="px-3 py-2 flex items-start gap-3 group hover:bg-red-900/20 transition-colors">
      <div className="shrink-0 mt-1">
        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs font-mono text-red-300 bg-red-900/50 px-1.5 py-0.5 rounded break-all">
            {formattedField}
          </code>
          <button
            onClick={() => onCopyField(cause.field)}
            className={clsx(
              "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded",
              isCopied ? "text-emerald-400" : "text-red-400 hover:text-red-200 hover:bg-red-900/50"
            )}
            title={isCopied ? "Copied!" : "Copy field path"}
          >
            {isCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
          </button>
        </div>
        <p className="text-sm text-red-200/80 mt-1">
          {cause.message}
        </p>
        {cause.reason && cause.reason !== 'FieldValueNotFound' && cause.reason !== 'FieldValueInvalid' && (
          <span className="text-xs text-red-400 mt-1 inline-block">
            Reason: {cause.reason}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Format a Kubernetes field path to be more human-readable
 * e.g., "spec.template.spec.containers[0].volumeMounts[1].name" 
 * becomes "spec → template → spec → containers[0] → volumeMounts[1] → name"
 */
function formatFieldPath(field: string): string {
  // Replace dots with arrows, but keep array brackets
  return field
    .replace(/\./g, ' → ')
    .replace(/\[/g, '[')
    .replace(/\]/g, ']');
}

/**
 * Compact error indicator for inline use
 */
export const FieldErrorIndicator: React.FC<{ message?: string | null }> = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="flex items-center gap-1 text-red-400 text-xs mt-1">
      <AlertCircle size={12} />
      <span>{message}</span>
    </div>
  );
};

/**
 * HOC-style wrapper that adds error styling to a field
 */
export const withFieldError = (hasError: boolean, className?: string) => {
  return clsx(
    className,
    hasError && "ring-2 ring-red-500 ring-offset-1 ring-offset-slate-900"
  );
};
