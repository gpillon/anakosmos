import React, { useState } from 'react';
import { FileCode, ChevronDown, ChevronRight, Key, Lock } from 'lucide-react';
import type { V1EnvVar, V1EnvFromSource } from '../../../api/k8s-types';
import { clsx } from 'clsx';

interface EnvVarsDisplayProps {
  env: V1EnvVar[] | undefined;
  envFrom: V1EnvFromSource[] | undefined;
  compact?: boolean;
}

export const EnvVarsDisplay: React.FC<EnvVarsDisplayProps> = ({ env, envFrom, compact }) => {
  const [expanded, setExpanded] = useState(false);
  
  const envCount = (env?.length || 0) + (envFrom?.length || 0);
  if (envCount === 0) return null;

  const getEnvValueDisplay = (envVar: V1EnvVar): React.ReactNode => {
    if (envVar.value !== undefined) {
      return <span className="text-slate-300 font-mono">{envVar.value}</span>;
    }
    
    if (envVar.valueFrom) {
      if (envVar.valueFrom.configMapKeyRef) {
        return (
          <span className="text-amber-400 text-xs">
            ConfigMap: {envVar.valueFrom.configMapKeyRef.name}/{envVar.valueFrom.configMapKeyRef.key}
          </span>
        );
      }
      if (envVar.valueFrom.secretKeyRef) {
        return (
          <span className="text-red-400 text-xs flex items-center gap-1">
            <Lock size={10} />
            Secret: {envVar.valueFrom.secretKeyRef.name}/{envVar.valueFrom.secretKeyRef.key}
          </span>
        );
      }
      if (envVar.valueFrom.fieldRef) {
        return (
          <span className="text-blue-400 text-xs">
            Field: {envVar.valueFrom.fieldRef.fieldPath}
          </span>
        );
      }
      if (envVar.valueFrom.resourceFieldRef) {
        return (
          <span className="text-purple-400 text-xs">
            Resource: {envVar.valueFrom.resourceFieldRef.resource}
          </span>
        );
      }
    }
    
    return <span className="text-slate-500">-</span>;
  };

  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300"
      >
        <FileCode size={12} />
        <span>{envCount} env var{envCount !== 1 ? 's' : ''}</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileCode size={14} className="text-emerald-400" />
          <span className="text-sm font-medium text-emerald-400">Environment Variables</span>
          <span className="text-xs text-slate-500">({envCount})</span>
        </div>
        {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      
      {expanded && (
        <div className="border-t border-slate-700 p-3 space-y-2">
          {/* EnvFrom sources */}
          {envFrom && envFrom.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-slate-500 uppercase font-bold">From Sources</div>
              {envFrom.map((source, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {source.configMapRef ? (
                    <>
                      <Key size={10} className="text-amber-400" />
                      <span className="text-amber-400">ConfigMap:</span>
                      <span className="text-slate-300 font-mono">{source.configMapRef.name}</span>
                    </>
                  ) : source.secretRef ? (
                    <>
                      <Lock size={10} className="text-red-400" />
                      <span className="text-red-400">Secret:</span>
                      <span className="text-slate-300 font-mono">{source.secretRef.name}</span>
                    </>
                  ) : null}
                  {source.prefix && (
                    <span className="text-slate-500">(prefix: {source.prefix})</span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Individual env vars */}
          {env && env.length > 0 && (
            <div className="space-y-1">
              {envFrom && envFrom.length > 0 && (
                <div className="text-xs text-slate-500 uppercase font-bold mt-2">Variables</div>
              )}
              {env.map((envVar, i) => (
                <div key={i} className={clsx(
                  "flex items-center gap-2 text-xs py-1",
                  i < env.length - 1 && "border-b border-slate-700/50"
                )}>
                  <span className="text-blue-400 font-mono min-w-[120px]">{envVar.name}</span>
                  <span className="text-slate-600">=</span>
                  <div className="flex-1 truncate">{getEnvValueDisplay(envVar)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
