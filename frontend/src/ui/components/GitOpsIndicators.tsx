import React from 'react';
import type { HelmReleaseInfo, ArgoAppInfo } from '../../api/types';
import { Package, GitBranch, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { useClusterStore } from '../../store/useClusterStore';
import { useResourceDetailsStore } from '../../store/useResourceDetailsStore';

interface HelmIndicatorProps {
  helmRelease: HelmReleaseInfo;
  compact?: boolean;
}

/**
 * Shows Helm release information for a resource
 */
export const HelmIndicator: React.FC<HelmIndicatorProps> = ({ helmRelease, compact = false }) => {
  if (compact) {
    return (
      <span 
        className="inline-flex items-center gap-1 text-xs bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800/50"
        title={`Helm Release: ${helmRelease.releaseName}${helmRelease.chartName ? ` (${helmRelease.chartName})` : ''}`}
      >
        <Package size={10} />
        Helm
      </span>
    );
  }

  return (
    <div className="bg-blue-950/30 rounded-lg border border-blue-800/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Package size={14} className="text-blue-400" />
        <span className="font-semibold text-blue-300 text-sm">Helm Managed</span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Release</span>
          <span className="text-slate-300 font-mono">{helmRelease.releaseName}</span>
        </div>
        {helmRelease.releaseNamespace && (
          <div className="flex justify-between">
            <span className="text-slate-500">Namespace</span>
            <span className="text-slate-300">{helmRelease.releaseNamespace}</span>
          </div>
        )}
        {helmRelease.chartName && (
          <div className="flex justify-between">
            <span className="text-slate-500">Chart</span>
            <span className="text-slate-300">{helmRelease.chartName}</span>
          </div>
        )}
        {helmRelease.chartVersion && (
          <div className="flex justify-between">
            <span className="text-slate-500">Version</span>
            <span className="text-slate-300">{helmRelease.chartVersion}</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface ArgoIndicatorProps {
  argoApp: ArgoAppInfo;
  compact?: boolean;
}

/**
 * Shows ArgoCD application information for a resource
 */
export const ArgoIndicator: React.FC<ArgoIndicatorProps> = ({ argoApp, compact = false }) => {
  const resources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);

  // Find the ArgoCD Application resource
  const findArgoApp = () => {
    return Object.values(resources).find(r => 
      r.kind === 'Application' && 
      r.name === argoApp.appName &&
      (r.namespace === argoApp.appNamespace || argoApp.appNamespace === 'argocd')
    );
  };

  const handleClick = () => {
    const app = findArgoApp();
    if (app) {
      openDetails(app.id);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className={clsx(
          "inline-flex items-center gap-1 text-xs bg-orange-900/30 text-orange-300 px-1.5 py-0.5 rounded border border-orange-800/50",
          findArgoApp() && "hover:bg-orange-900/50 cursor-pointer"
        )}
        title={`ArgoCD App: ${argoApp.appName}${argoApp.project ? ` (${argoApp.project})` : ''}`}
      >
        <GitBranch size={10} />
        ArgoCD
      </button>
    );
  }

  const app = findArgoApp();

  return (
    <div className="bg-orange-950/30 rounded-lg border border-orange-800/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-orange-400" />
          <span className="font-semibold text-orange-300 text-sm">ArgoCD Managed</span>
        </div>
        {app && (
          <button
            onClick={handleClick}
            className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
          >
            View App
            <ExternalLink size={10} />
          </button>
        )}
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Application</span>
          <span className="text-slate-300 font-mono">{argoApp.appName}</span>
        </div>
        {argoApp.appNamespace && (
          <div className="flex justify-between">
            <span className="text-slate-500">Namespace</span>
            <span className="text-slate-300">{argoApp.appNamespace}</span>
          </div>
        )}
        {argoApp.project && (
          <div className="flex justify-between">
            <span className="text-slate-500">Project</span>
            <span className="text-slate-300">{argoApp.project}</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface GitOpsIndicatorsProps {
  helmRelease?: HelmReleaseInfo;
  argoApp?: ArgoAppInfo;
  compact?: boolean;
}

/**
 * Combined component showing both Helm and ArgoCD indicators
 */
export const GitOpsIndicators: React.FC<GitOpsIndicatorsProps> = ({ 
  helmRelease, 
  argoApp, 
  compact = false 
}) => {
  if (!helmRelease && !argoApp) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {helmRelease && <HelmIndicator helmRelease={helmRelease} compact />}
        {argoApp && <ArgoIndicator argoApp={argoApp} compact />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {helmRelease && <HelmIndicator helmRelease={helmRelease} />}
      {argoApp && <ArgoIndicator argoApp={argoApp} />}
    </div>
  );
};
