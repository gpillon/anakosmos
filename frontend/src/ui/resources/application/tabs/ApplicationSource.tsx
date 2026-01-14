import React from 'react';
import type { ClusterResource } from '../../../../api/types';
import { 
  GitBranch, 
  Package,
  FileCode,
  Settings,
  ExternalLink,
  Folder
} from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
}

export const ApplicationSource: React.FC<Props> = ({ resource }) => {
  const raw = resource.raw;
  const spec = raw?.spec || {};
  
  // Support both single source and multiple sources
  const sources = spec.sources || (spec.source ? [spec.source] : []);

  if (sources.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        No source configuration found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sources.map((source: any, index: number) => (
        <SourceCard key={index} source={source} index={index} total={sources.length} />
      ))}
    </div>
  );
};

const SourceCard: React.FC<{ source: any; index: number; total: number }> = ({ 
  source, index, total 
}) => {
  const isHelm = !!source.chart || !!source.helm;
  const isKustomize = !!source.kustomize;
  const isDirectory = !!source.directory;
  const isPlugin = !!source.plugin;

  const sourceType = isHelm ? 'Helm' : 
                     isKustomize ? 'Kustomize' : 
                     isDirectory ? 'Directory' : 
                     isPlugin ? 'Plugin' : 'Git';

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isHelm ? <Package size={16} className="text-blue-400" /> :
           isKustomize ? <FileCode size={16} className="text-purple-400" /> :
           <GitBranch size={16} className="text-orange-400" />}
          <span className="font-semibold text-slate-200">
            {total > 1 ? `Source ${index + 1}` : 'Source Configuration'}
          </span>
          <span className={clsx(
            "text-xs px-2 py-0.5 rounded",
            isHelm ? "bg-blue-900/50 text-blue-300" :
            isKustomize ? "bg-purple-900/50 text-purple-300" :
            "bg-orange-900/50 text-orange-300"
          )}>
            {sourceType}
          </span>
        </div>
        {source.repoURL && (
          <a
            href={source.repoURL.replace('.git', '')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-blue-400 transition-colors"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* Repository Info */}
      <div className="p-4 space-y-4">
        <div className="space-y-3">
          <SectionTitle icon={<GitBranch size={14} />} title="Repository" />
          <div className="space-y-2 text-sm">
            <MetaRow label="URL" value={source.repoURL} mono />
            {source.path && <MetaRow label="Path" value={source.path} />}
            <MetaRow label="Target Revision" value={source.targetRevision || 'HEAD'} />
            {source.ref && <MetaRow label="Ref" value={source.ref} />}
          </div>
        </div>

        {/* Helm Configuration */}
        {(source.chart || source.helm) && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <SectionTitle icon={<Package size={14} />} title="Helm Configuration" />
            <div className="space-y-2 text-sm">
              {source.chart && <MetaRow label="Chart" value={source.chart} />}
              {source.helm?.releaseName && (
                <MetaRow label="Release Name" value={source.helm.releaseName} />
              )}
              {source.helm?.version && (
                <MetaRow label="Helm Version" value={source.helm.version} />
              )}
              
              {/* Value Files */}
              {source.helm?.valueFiles && source.helm.valueFiles.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-slate-500 uppercase mb-2">Value Files</div>
                  <div className="flex flex-wrap gap-2">
                    {source.helm.valueFiles.map((file: string, i: number) => (
                      <span 
                        key={i}
                        className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700 font-mono"
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Parameters */}
              {source.helm?.parameters && source.helm.parameters.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-slate-500 uppercase mb-2">Parameters</div>
                  <div className="space-y-1">
                    {source.helm.parameters.map((param: any, i: number) => (
                      <div 
                        key={i}
                        className="flex items-center gap-2 text-xs bg-slate-800/50 px-2 py-1.5 rounded border border-slate-700"
                      >
                        <span className="text-blue-400 font-mono">{param.name}</span>
                        <span className="text-slate-600">=</span>
                        <span className="text-slate-300 font-mono truncate">{param.value}</span>
                        {param.forceString && (
                          <span className="text-[10px] bg-slate-700 text-slate-400 px-1 rounded">string</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inline Values */}
              {source.helm?.values && (
                <div className="mt-3">
                  <div className="text-xs text-slate-500 uppercase mb-2">Inline Values</div>
                  <pre className="text-xs bg-slate-950 text-slate-300 p-3 rounded border border-slate-800 overflow-x-auto max-h-60 custom-scrollbar">
                    {source.helm.values}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Kustomize Configuration */}
        {source.kustomize && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <SectionTitle icon={<FileCode size={14} />} title="Kustomize Configuration" />
            <div className="space-y-2 text-sm">
              {source.kustomize.namePrefix && (
                <MetaRow label="Name Prefix" value={source.kustomize.namePrefix} />
              )}
              {source.kustomize.nameSuffix && (
                <MetaRow label="Name Suffix" value={source.kustomize.nameSuffix} />
              )}
              {source.kustomize.version && (
                <MetaRow label="Version" value={source.kustomize.version} />
              )}
              
              {/* Images */}
              {source.kustomize.images && source.kustomize.images.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-slate-500 uppercase mb-2">Image Overrides</div>
                  <div className="flex flex-wrap gap-2">
                    {source.kustomize.images.map((img: string, i: number) => (
                      <span 
                        key={i}
                        className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700 font-mono"
                      >
                        {img}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Directory Configuration */}
        {source.directory && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <SectionTitle icon={<Folder size={14} />} title="Directory Configuration" />
            <div className="space-y-2 text-sm">
              <MetaRow label="Recurse" value={source.directory.recurse ? 'Yes' : 'No'} />
              {source.directory.include && (
                <MetaRow label="Include" value={source.directory.include} />
              )}
              {source.directory.exclude && (
                <MetaRow label="Exclude" value={source.directory.exclude} />
              )}
            </div>
          </div>
        )}

        {/* Plugin Configuration */}
        {source.plugin && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <SectionTitle icon={<Settings size={14} />} title="Plugin Configuration" />
            <div className="space-y-2 text-sm">
              {source.plugin.name && (
                <MetaRow label="Plugin Name" value={source.plugin.name} />
              )}
              
              {/* Plugin Env */}
              {source.plugin.env && source.plugin.env.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-slate-500 uppercase mb-2">Environment</div>
                  <div className="space-y-1">
                    {source.plugin.env.map((env: any, i: number) => (
                      <div 
                        key={i}
                        className="flex items-center gap-2 text-xs bg-slate-800/50 px-2 py-1.5 rounded border border-slate-700"
                      >
                        <span className="text-blue-400 font-mono">{env.name}</span>
                        <span className="text-slate-600">=</span>
                        <span className="text-slate-300 font-mono truncate">{env.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-bold">
    {icon}
    {title}
  </div>
);

const MetaRow: React.FC<{ label: string; value: any; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between items-center gap-4">
    <span className="text-slate-500 shrink-0">{label}</span>
    <span className={clsx(
      "text-slate-200 truncate max-w-[300px]", 
      mono && "font-mono text-xs"
    )} title={String(value)}>
      {value || '-'}
    </span>
  </div>
);
