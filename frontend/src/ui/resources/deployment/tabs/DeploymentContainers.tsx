import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Deployment, V1Container } from '../../../../api/k8s-types';
import { 
  Box, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  Play, 
  Shield,
  Cpu,
  HardDrive,
  FileCode,
  Terminal,
  Activity,
  Heart,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { clsx } from 'clsx';
import { Combobox, useConfigMapNames, useSecretNames } from '../../shared';

interface Props {
  resource: ClusterResource;
  model: V1Deployment;
  updateModel: (updater: (current: V1Deployment) => V1Deployment) => void;
}

interface ContainerSecurityContext {
  runAsUser?: number;
  runAsGroup?: number;
  runAsNonRoot?: boolean;
  readOnlyRootFilesystem?: boolean;
  privileged?: boolean;
  allowPrivilegeEscalation?: boolean;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
}

export const DeploymentContainers: React.FC<Props> = ({ resource, model, updateModel }) => {
  const namespace = resource.namespace;
  const template = model?.spec?.template?.spec;
  const containers = template?.containers || [];
  const initContainers = template?.initContainers || [];
  const [expandedContainers, setExpandedContainers] = useState<Set<string>>(new Set([containers[0]?.name]));

  const toggleExpanded = (name: string) => {
    const next = new Set(expandedContainers);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setExpandedContainers(next);
  };

  const updateContainers = (newContainers: V1Container[], isInit: boolean = false) => {
    updateModel(current => {
      const currentSpec = current.spec?.template?.spec;
      const updatedSpec = {
        ...currentSpec,
        containers: currentSpec?.containers || [],
        ...(isInit 
          ? { initContainers: newContainers.length > 0 ? newContainers : undefined }
          : { containers: newContainers }
        )
      };
      return {
        ...current,
        spec: {
          ...current.spec,
          selector: current.spec?.selector || { matchLabels: {} },
          template: {
            ...current.spec?.template,
            spec: updatedSpec
          }
        }
      };
    });
  };

  const updateContainer = (index: number, updates: Partial<V1Container>, isInit: boolean = false) => {
    const targetList = isInit ? initContainers : containers;
    const newContainers = [...targetList];
    newContainers[index] = { ...newContainers[index], ...updates };
    updateContainers(newContainers, isInit);
  };

  const addContainer = (isInit: boolean = false) => {
    const newContainer: V1Container = {
      name: `container-${Date.now()}`,
      image: 'nginx:latest',
      resources: {
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '200m', memory: '256Mi' }
      }
    };
    const targetList = isInit ? initContainers : containers;
    updateContainers([...targetList, newContainer], isInit);
    setExpandedContainers(new Set([...expandedContainers, newContainer.name]));
  };

  const removeContainer = (index: number, isInit: boolean = false) => {
    const targetList = isInit ? initContainers : containers;
    if (!isInit && targetList.length <= 1) return; // Must have at least one container
    updateContainers(targetList.filter((_: V1Container, i: number) => i !== index), isInit);
  };

  return (
    <div className="space-y-6">
      {/* Main Containers Section */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box size={16} className="text-blue-400" />
            <span className="font-semibold text-slate-200">Containers</span>
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{containers.length}</span>
          </div>
          <button
            onClick={() => addContainer(false)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus size={14} /> Add Container
          </button>
        </div>

        <div className="divide-y divide-slate-800">
          {containers.map((container, idx) => (
            <ContainerEditor
              key={container.name}
              container={container}
              index={idx}
              isExpanded={expandedContainers.has(container.name)}
              onToggle={() => toggleExpanded(container.name)}
              onUpdate={(updates) => updateContainer(idx, updates)}
              onRemove={containers.length > 1 ? () => removeContainer(idx) : undefined}
              volumes={template?.volumes || []}
              namespace={namespace}
            />
          ))}
        </div>
      </div>

      {/* Init Containers Section */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play size={16} className="text-purple-400" />
            <span className="font-semibold text-slate-200">Init Containers</span>
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{initContainers.length}</span>
          </div>
          <button
            onClick={() => addContainer(true)}
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Plus size={14} /> Add Init Container
          </button>
        </div>

        {initContainers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Play size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No init containers defined</p>
            <p className="text-xs mt-1">Init containers run before the main containers start</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {initContainers.map((container, idx) => (
              <ContainerEditor
                key={container.name}
                container={container}
                index={idx}
                isExpanded={expandedContainers.has(container.name)}
                onToggle={() => toggleExpanded(container.name)}
                onUpdate={(updates) => updateContainer(idx, updates, true)}
                onRemove={() => removeContainer(idx, true)}
                volumes={template?.volumes || []}
                namespace={namespace}
                isInit
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Container Editor Component
interface ContainerEditorProps {
  container: V1Container;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<V1Container>) => void;
  onRemove?: () => void;
  volumes: Array<{ name?: string }>;
  namespace: string;
  isInit?: boolean;
}

const ContainerEditor: React.FC<ContainerEditorProps> = ({
  container,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
  volumes,
  namespace,
  isInit
}) => {
  const [activeSection, setActiveSection] = useState('basic');

  return (
    <div className="bg-slate-900/30">
      {/* Header */}
      <div 
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={onToggle}
      >
        {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
        <div className={clsx("w-3 h-3 rounded-full", isInit ? "bg-purple-500" : "bg-blue-500")} />
        <div className="flex-1">
          <span className="font-mono font-medium text-slate-200">{container.name}</span>
          <span className="ml-3 text-xs text-slate-500">{container.image}</span>
        </div>
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Section Tabs */}
          <div className="flex gap-1 mb-4 bg-slate-800/50 p-1 rounded-lg">
            {[
              { id: 'basic', label: 'Basic', icon: <FileCode size={12} /> },
              { id: 'env', label: 'Environment', icon: <Terminal size={12} /> },
              { id: 'resources', label: 'Resources', icon: <Cpu size={12} /> },
              { id: 'probes', label: 'Probes', icon: <Heart size={12} /> },
              { id: 'mounts', label: 'Mounts', icon: <HardDrive size={12} /> },
              { id: 'security', label: 'Security', icon: <Shield size={12} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  activeSection === tab.id 
                    ? "bg-slate-700 text-white" 
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Section Content */}
          {activeSection === 'basic' && (
            <BasicSection container={container} onUpdate={onUpdate} />
          )}
          {activeSection === 'env' && (
            <EnvironmentSection container={container} onUpdate={onUpdate} namespace={namespace} />
          )}
          {activeSection === 'resources' && (
            <ResourcesSection container={container} onUpdate={onUpdate} />
          )}
          {activeSection === 'probes' && (
            <ProbesSection container={container} onUpdate={onUpdate} />
          )}
          {activeSection === 'mounts' && (
            <MountsSection container={container} onUpdate={onUpdate} volumes={volumes} />
          )}
          {activeSection === 'security' && (
            <SecuritySection container={container} onUpdate={onUpdate} />
          )}
        </div>
      )}
    </div>
  );
};

// Basic Section
const BasicSection: React.FC<{ container: V1Container; onUpdate: (u: Partial<V1Container>) => void }> = ({ container, onUpdate }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <InputField 
        label="Name" 
        value={container.name || ''} 
        onChange={(v) => onUpdate({ name: v })} 
      />
      <InputField 
        label="Image" 
        value={container.image || ''} 
        onChange={(v) => onUpdate({ image: v })} 
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <SelectField
        label="Image Pull Policy"
        value={container.imagePullPolicy || 'IfNotPresent'}
        options={['Always', 'IfNotPresent', 'Never']}
        onChange={(v) => onUpdate({ imagePullPolicy: v })}
      />
      <InputField 
        label="Working Directory" 
        value={container.workingDir || ''} 
        onChange={(v) => onUpdate({ workingDir: v || undefined })} 
        placeholder="/app"
      />
    </div>
    <InputField 
      label="Command" 
      value={container.command?.join(' ') || ''} 
      onChange={(v) => onUpdate({ command: v ? v.split(' ') : undefined })} 
      placeholder="/bin/sh -c"
    />
    <InputField 
      label="Arguments" 
      value={container.args?.join(' ') || ''} 
      onChange={(v) => onUpdate({ args: v ? v.split(' ') : undefined })} 
      placeholder="arg1 arg2"
    />
    
    {/* Ports */}
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-slate-500 uppercase">Ports</label>
        <button
          onClick={() => onUpdate({ 
            ports: [...(container.ports || []), { containerPort: 8080, protocol: 'TCP' }] 
          })}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          <Plus size={12} className="inline mr-1" /> Add Port
        </button>
      </div>
      {(container.ports || []).length === 0 ? (
        <div className="text-xs text-slate-500 py-2">No ports defined</div>
      ) : (
        <div className="space-y-2">
          {container.ports?.map((port, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Name"
                value={port.name || ''}
                onChange={(e) => {
                  const newPorts = [...(container.ports || [])];
                  newPorts[i] = { ...newPorts[i], name: e.target.value || undefined };
                  onUpdate({ ports: newPorts });
                }}
                className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
              <input
                type="number"
                placeholder="Container Port"
                value={port.containerPort}
                onChange={(e) => {
                  const newPorts = [...(container.ports || [])];
                  newPorts[i] = { ...newPorts[i], containerPort: parseInt(e.target.value) || 0 };
                  onUpdate({ ports: newPorts });
                }}
                className="w-28 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
              <select
                value={port.protocol || 'TCP'}
                onChange={(e) => {
                  const newPorts = [...(container.ports || [])];
                  newPorts[i] = { ...newPorts[i], protocol: e.target.value };
                  onUpdate({ ports: newPorts });
                }}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              >
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="SCTP">SCTP</option>
              </select>
              <button
                onClick={() => {
                  const newPorts = container.ports?.filter((_, idx) => idx !== i);
                  onUpdate({ ports: newPorts?.length ? newPorts : undefined });
                }}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// Environment Section
const EnvironmentSection: React.FC<{ container: V1Container; onUpdate: (u: Partial<V1Container>) => void; namespace: string }> = ({ container, onUpdate, namespace }) => {
  const configMapNames = useConfigMapNames(namespace);
  const secretNames = useSecretNames(namespace);
  
  return (
    <div className="space-y-4">
      {/* Direct Env Vars */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Environment Variables</label>
          <button
            onClick={() => onUpdate({ 
              env: [...(container.env || []), { name: '', value: '' }] 
            })}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            <Plus size={12} className="inline mr-1" /> Add Variable
          </button>
        </div>
        {(container.env || []).length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No environment variables defined</div>
        ) : (
          <div className="space-y-2">
            {container.env?.map((env, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  type="text"
                  placeholder="Name"
                  value={env.name}
                  onChange={(e) => {
                    const newEnv = [...(container.env || [])];
                    newEnv[i] = { ...newEnv[i], name: e.target.value };
                    onUpdate({ env: newEnv });
                  }}
                  className="w-1/4 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
                />
                {env.valueFrom ? (
                  <div className="flex-1 flex gap-2 items-center">
                    <select
                      value={env.valueFrom.configMapKeyRef ? 'configMap' : env.valueFrom.secretKeyRef ? 'secret' : 'fieldRef'}
                      onChange={(e) => {
                        const newEnv = [...(container.env || [])];
                        const type = e.target.value;
                        if (type === 'configMap') {
                          newEnv[i] = { ...newEnv[i], valueFrom: { configMapKeyRef: { name: '', key: '' } } };
                        } else if (type === 'secret') {
                          newEnv[i] = { ...newEnv[i], valueFrom: { secretKeyRef: { name: '', key: '' } } };
                        } else {
                          newEnv[i] = { ...newEnv[i], valueFrom: { fieldRef: { fieldPath: '' } } };
                        }
                        onUpdate({ env: newEnv });
                      }}
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                    >
                      <option value="configMap">ConfigMap</option>
                      <option value="secret">Secret</option>
                      <option value="fieldRef">Field Ref</option>
                    </select>
                    {env.valueFrom.configMapKeyRef && (
                      <>
                        <div className="flex-1">
                          <Combobox
                            value={env.valueFrom.configMapKeyRef.name || ''}
                            onChange={(v) => {
                              const newEnv = [...(container.env || [])];
                              newEnv[i] = { ...newEnv[i], valueFrom: { configMapKeyRef: { ...env.valueFrom!.configMapKeyRef!, name: v } } };
                              onUpdate({ env: newEnv });
                            }}
                            options={configMapNames}
                            placeholder="ConfigMap..."
                            allowCustom={true}
                            size="sm"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Key"
                          value={env.valueFrom.configMapKeyRef.key || ''}
                          onChange={(e) => {
                            const newEnv = [...(container.env || [])];
                            newEnv[i] = { ...newEnv[i], valueFrom: { configMapKeyRef: { ...env.valueFrom!.configMapKeyRef!, key: e.target.value } } };
                            onUpdate({ env: newEnv });
                          }}
                          className="w-1/4 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                        />
                      </>
                    )}
                    {env.valueFrom.secretKeyRef && (
                      <>
                        <div className="flex-1">
                          <Combobox
                            value={env.valueFrom.secretKeyRef.name || ''}
                            onChange={(v) => {
                              const newEnv = [...(container.env || [])];
                              newEnv[i] = { ...newEnv[i], valueFrom: { secretKeyRef: { ...env.valueFrom!.secretKeyRef!, name: v } } };
                              onUpdate({ env: newEnv });
                            }}
                            options={secretNames}
                            placeholder="Secret..."
                            allowCustom={true}
                            size="sm"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Key"
                          value={env.valueFrom.secretKeyRef.key || ''}
                          onChange={(e) => {
                            const newEnv = [...(container.env || [])];
                            newEnv[i] = { ...newEnv[i], valueFrom: { secretKeyRef: { ...env.valueFrom!.secretKeyRef!, key: e.target.value } } };
                            onUpdate({ env: newEnv });
                          }}
                          className="w-1/4 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                        />
                      </>
                    )}
                    {env.valueFrom.fieldRef && (
                      <input
                        type="text"
                        placeholder="Field Path"
                        value={env.valueFrom.fieldRef.fieldPath || ''}
                        onChange={(e) => {
                          const newEnv = [...(container.env || [])];
                          newEnv[i] = { ...newEnv[i], valueFrom: { fieldRef: { fieldPath: e.target.value } } };
                          onUpdate({ env: newEnv });
                        }}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Value"
                    value={env.value || ''}
                    onChange={(e) => {
                      const newEnv = [...(container.env || [])];
                      newEnv[i] = { ...newEnv[i], value: e.target.value };
                      onUpdate({ env: newEnv });
                    }}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
                  />
                )}
                <button
                  onClick={() => {
                    const newEnv = [...(container.env || [])];
                    if (newEnv[i].valueFrom) {
                      newEnv[i] = { name: newEnv[i].name, value: '' };
                    } else {
                      newEnv[i] = { name: newEnv[i].name, valueFrom: { configMapKeyRef: { name: '', key: '' } } };
                    }
                    onUpdate({ env: newEnv });
                  }}
                  className="text-slate-400 hover:text-slate-200 px-1"
                  title="Toggle value type"
                >
                  <Zap size={14} />
                </button>
                <button
                  onClick={() => {
                    const newEnv = container.env?.filter((_, idx) => idx !== i);
                    onUpdate({ env: newEnv?.length ? newEnv : undefined });
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EnvFrom */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Env From (ConfigMaps/Secrets)</label>
          <button
            onClick={() => onUpdate({ 
              envFrom: [...(container.envFrom || []), { configMapRef: { name: '' } }] 
            })}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            <Plus size={12} className="inline mr-1" /> Add Source
          </button>
        </div>
        {(container.envFrom || []).length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No env sources defined</div>
        ) : (
          <div className="space-y-2">
            {container.envFrom?.map((envFrom, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={envFrom.configMapRef ? 'configMap' : 'secret'}
                  onChange={(e) => {
                    const newEnvFrom = [...(container.envFrom || [])];
                    if (e.target.value === 'configMap') {
                      newEnvFrom[i] = { configMapRef: { name: '' }, prefix: envFrom.prefix };
                    } else {
                      newEnvFrom[i] = { secretRef: { name: '' }, prefix: envFrom.prefix };
                    }
                    onUpdate({ envFrom: newEnvFrom });
                  }}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                >
                  <option value="configMap">ConfigMap</option>
                  <option value="secret">Secret</option>
                </select>
                <div className="flex-1">
                  {envFrom.configMapRef ? (
                    <Combobox
                      value={envFrom.configMapRef.name || ''}
                      onChange={(v) => {
                        const newEnvFrom = [...(container.envFrom || [])];
                        newEnvFrom[i] = { ...newEnvFrom[i], configMapRef: { name: v } };
                        onUpdate({ envFrom: newEnvFrom });
                      }}
                      options={configMapNames}
                      placeholder="Select ConfigMap..."
                      allowCustom={true}
                      size="sm"
                    />
                  ) : (
                    <Combobox
                      value={envFrom.secretRef?.name || ''}
                      onChange={(v) => {
                        const newEnvFrom = [...(container.envFrom || [])];
                        newEnvFrom[i] = { ...newEnvFrom[i], secretRef: { name: v } };
                        onUpdate({ envFrom: newEnvFrom });
                      }}
                      options={secretNames}
                      placeholder="Select Secret..."
                      allowCustom={true}
                      size="sm"
                    />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Prefix"
                  value={envFrom.prefix || ''}
                  onChange={(e) => {
                    const newEnvFrom = [...(container.envFrom || [])];
                    newEnvFrom[i] = { ...newEnvFrom[i], prefix: e.target.value || undefined };
                    onUpdate({ envFrom: newEnvFrom });
                  }}
                  className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                />
                <button
                  onClick={() => {
                    const newEnvFrom = container.envFrom?.filter((_, idx) => idx !== i);
                    onUpdate({ envFrom: newEnvFrom?.length ? newEnvFrom : undefined });
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Resources Section
const ResourcesSection: React.FC<{ container: V1Container; onUpdate: (u: Partial<V1Container>) => void }> = ({ container, onUpdate }) => {
  const resources = container.resources || {};

  const updateResources = (type: 'requests' | 'limits', field: 'cpu' | 'memory', value: string) => {
    const newResources = { ...resources } as { requests?: Record<string, string>; limits?: Record<string, string> };
    if (!newResources[type]) newResources[type] = {};
    if (value) {
      newResources[type]![field] = value;
    } else {
      delete newResources[type]![field];
    }
    
    // Clean up empty objects
    if (!newResources.requests?.cpu && !newResources.requests?.memory) {
      delete newResources.requests;
    }
    if (!newResources.limits?.cpu && !newResources.limits?.memory) {
      delete newResources.limits;
    }
    
    onUpdate({ resources: Object.keys(newResources).length > 0 ? newResources : undefined });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-6">
        {/* Requests */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Cpu size={16} className="text-emerald-400" />
            <span className="font-semibold text-slate-200">Requests</span>
          </div>
          <div className="space-y-3">
            <InputField
              label="CPU"
              value={resources.requests?.cpu || ''}
              onChange={(v) => updateResources('requests', 'cpu', v)}
              placeholder="100m"
            />
            <InputField
              label="Memory"
              value={resources.requests?.memory || ''}
              onChange={(v) => updateResources('requests', 'memory', v)}
              placeholder="128Mi"
            />
          </div>
        </div>

        {/* Limits */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-red-400" />
            <span className="font-semibold text-slate-200">Limits</span>
          </div>
          <div className="space-y-3">
            <InputField
              label="CPU"
              value={resources.limits?.cpu || ''}
              onChange={(v) => updateResources('limits', 'cpu', v)}
              placeholder="200m"
            />
            <InputField
              label="Memory"
              value={resources.limits?.memory || ''}
              onChange={(v) => updateResources('limits', 'memory', v)}
              placeholder="256Mi"
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-500 bg-slate-800/30 rounded p-3 border border-slate-700/50">
        <strong>Units:</strong> CPU in millicores (m) or cores (e.g., 100m, 0.1, 1). 
        Memory in bytes (e.g., 128Mi, 1Gi, 500M).
      </div>
    </div>
  );
};

// Probes Section
const ProbesSection: React.FC<{ container: V1Container; onUpdate: (u: Partial<V1Container>) => void }> = ({ container, onUpdate }) => {
  return (
    <div className="space-y-4">
      <ProbeEditor
        label="Liveness Probe"
        description="Determines if the container is running. If it fails, the container is restarted."
        icon={<Heart className="text-red-400" size={16} />}
        probe={container.livenessProbe}
        onUpdate={(probe) => onUpdate({ livenessProbe: probe })}
      />
      <ProbeEditor
        label="Readiness Probe"
        description="Determines if the container is ready to accept traffic."
        icon={<CheckCircle2 className="text-emerald-400" size={16} />}
        probe={container.readinessProbe}
        onUpdate={(probe) => onUpdate({ readinessProbe: probe })}
      />
      <ProbeEditor
        label="Startup Probe"
        description="Determines if the container has started. Disables liveness/readiness until it succeeds."
        icon={<Zap className="text-amber-400" size={16} />}
        probe={container.startupProbe}
        onUpdate={(probe) => onUpdate({ startupProbe: probe })}
      />
    </div>
  );
};

interface ProbeSpec {
  httpGet?: { path?: string; port: number | string; scheme?: string };
  tcpSocket?: { port: number | string };
  exec?: { command?: string[] };
  grpc?: { port: number; service?: string };
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  successThreshold?: number;
  failureThreshold?: number;
}

const ProbeEditor: React.FC<{
  label: string;
  description: string;
  icon: React.ReactNode;
  probe?: ProbeSpec;
  onUpdate: (probe?: ProbeSpec) => void;
}> = ({ label, description, icon, probe, onUpdate }) => {
  const [probeType, setProbeType] = useState<'httpGet' | 'tcpSocket' | 'exec' | 'grpc'>(
    probe?.httpGet ? 'httpGet' : probe?.tcpSocket ? 'tcpSocket' : probe?.exec ? 'exec' : probe?.grpc ? 'grpc' : 'httpGet'
  );

  const enableProbe = () => {
    onUpdate({
      httpGet: { path: '/', port: 8080 },
      initialDelaySeconds: 10,
      periodSeconds: 10,
      timeoutSeconds: 1,
      successThreshold: 1,
      failureThreshold: 3
    });
  };

  if (!probe) {
    return (
      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <span className="font-semibold text-slate-300">{label}</span>
              <p className="text-xs text-slate-500 mt-1">{description}</p>
            </div>
          </div>
          <button
            onClick={enableProbe}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded transition-colors"
          >
            Enable
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-slate-300">{label}</span>
        </div>
        <button
          onClick={() => onUpdate(undefined)}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Disable
        </button>
      </div>

      <div className="space-y-4">
        {/* Probe Type Selector */}
        <div className="flex gap-2 bg-slate-900/50 p-1 rounded">
          {(['httpGet', 'tcpSocket', 'exec', 'grpc'] as const).map(type => (
            <button
              key={type}
              onClick={() => {
                setProbeType(type);
                const base = {
                  initialDelaySeconds: probe.initialDelaySeconds,
                  periodSeconds: probe.periodSeconds,
                  timeoutSeconds: probe.timeoutSeconds,
                  successThreshold: probe.successThreshold,
                  failureThreshold: probe.failureThreshold
                };
                if (type === 'httpGet') {
                  onUpdate({ ...base, httpGet: { path: '/', port: 8080 } });
                } else if (type === 'tcpSocket') {
                  onUpdate({ ...base, tcpSocket: { port: 8080 } });
                } else if (type === 'exec') {
                  onUpdate({ ...base, exec: { command: ['/bin/sh', '-c', 'exit 0'] } });
                } else if (type === 'grpc') {
                  onUpdate({ ...base, grpc: { port: 50051 } });
                }
              }}
              className={clsx(
                "flex-1 py-1.5 text-xs font-medium rounded transition-colors",
                probeType === type ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {type === 'httpGet' ? 'HTTP' : type === 'tcpSocket' ? 'TCP' : type === 'exec' ? 'Exec' : 'gRPC'}
            </button>
          ))}
        </div>

        {/* Type-specific fields */}
        {probeType === 'httpGet' && probe.httpGet && (
          <div className="grid grid-cols-3 gap-3">
            <InputField
              label="Path"
              value={probe.httpGet.path || ''}
              onChange={(v) => onUpdate({ ...probe, httpGet: { ...probe.httpGet!, path: v } })}
            />
            <InputField
              label="Port"
              value={String(probe.httpGet.port)}
              onChange={(v) => onUpdate({ ...probe, httpGet: { ...probe.httpGet!, port: parseInt(v) || 8080 } })}
            />
            <SelectField
              label="Scheme"
              value={probe.httpGet.scheme || 'HTTP'}
              options={['HTTP', 'HTTPS']}
              onChange={(v) => onUpdate({ ...probe, httpGet: { ...probe.httpGet!, scheme: v } })}
            />
          </div>
        )}
        {probeType === 'tcpSocket' && probe.tcpSocket && (
          <InputField
            label="Port"
            value={String(probe.tcpSocket.port)}
            onChange={(v) => onUpdate({ ...probe, tcpSocket: { port: parseInt(v) || 8080 } })}
          />
        )}
        {probeType === 'exec' && probe.exec && (
          <InputField
            label="Command"
            value={probe.exec.command?.join(' ') || ''}
            onChange={(v) => onUpdate({ ...probe, exec: { command: v.split(' ') } })}
          />
        )}
        {probeType === 'grpc' && probe.grpc && (
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Port"
              value={String(probe.grpc.port)}
              onChange={(v) => onUpdate({ ...probe, grpc: { ...probe.grpc!, port: parseInt(v) || 50051 } })}
            />
            <InputField
              label="Service"
              value={probe.grpc.service || ''}
              onChange={(v) => onUpdate({ ...probe, grpc: { ...probe.grpc!, service: v || undefined } })}
            />
          </div>
        )}

        {/* Timing fields */}
        <div className="grid grid-cols-5 gap-2">
          <InputField
            label="Initial Delay"
            value={String(probe.initialDelaySeconds || 0)}
            onChange={(v) => onUpdate({ ...probe, initialDelaySeconds: parseInt(v) || 0 })}
          />
          <InputField
            label="Period"
            value={String(probe.periodSeconds || 10)}
            onChange={(v) => onUpdate({ ...probe, periodSeconds: parseInt(v) || 10 })}
          />
          <InputField
            label="Timeout"
            value={String(probe.timeoutSeconds || 1)}
            onChange={(v) => onUpdate({ ...probe, timeoutSeconds: parseInt(v) || 1 })}
          />
          <InputField
            label="Success"
            value={String(probe.successThreshold || 1)}
            onChange={(v) => onUpdate({ ...probe, successThreshold: parseInt(v) || 1 })}
          />
          <InputField
            label="Failure"
            value={String(probe.failureThreshold || 3)}
            onChange={(v) => onUpdate({ ...probe, failureThreshold: parseInt(v) || 3 })}
          />
        </div>
      </div>
    </div>
  );
};

// Mounts Section
const MountsSection: React.FC<{ container: V1Container; onUpdate: (u: Partial<V1Container>) => void; volumes: Array<{ name?: string }> }> = ({ container, onUpdate, volumes }) => {
  const mounts = container.volumeMounts || [];
  const volumeNames = volumes.map((v) => v.name || '').filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-500 uppercase">Volume Mounts</label>
        <button
          onClick={() => onUpdate({ 
            volumeMounts: [...mounts, { name: volumes[0]?.name || 'volume', mountPath: '/mnt' }] 
          })}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          <Plus size={12} className="inline mr-1" /> Add Mount
        </button>
      </div>

      {mounts.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <HardDrive size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No volume mounts defined</p>
          <p className="text-xs mt-1">Add mounts to use volumes defined in the pod spec</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mounts.map((mount, i) => (
            <div key={i} className="flex gap-2 items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="w-40">
                <Combobox
                  value={mount.name}
                  onChange={(v) => {
                    const newMounts = [...mounts];
                    newMounts[i] = { ...newMounts[i], name: v };
                    onUpdate({ volumeMounts: newMounts });
                  }}
                  options={volumeNames}
                  placeholder="Select volume..."
                  allowCustom={true}
                  size="sm"
                  emptyMessage="No volumes defined"
                />
              </div>
              <input
                type="text"
                placeholder="Mount Path"
                value={mount.mountPath}
                onChange={(e) => {
                  const newMounts = [...mounts];
                  newMounts[i] = { ...newMounts[i], mountPath: e.target.value };
                  onUpdate({ volumeMounts: newMounts });
                }}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
              />
              <input
                type="text"
                placeholder="Sub Path"
                value={mount.subPath || ''}
                onChange={(e) => {
                  const newMounts = [...mounts];
                  newMounts[i] = { ...newMounts[i], subPath: e.target.value || undefined };
                  onUpdate({ volumeMounts: newMounts });
                }}
                className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
              <label className="flex items-center gap-1 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={mount.readOnly || false}
                  onChange={(e) => {
                    const newMounts = [...mounts];
                    newMounts[i] = { ...newMounts[i], readOnly: e.target.checked || undefined };
                    onUpdate({ volumeMounts: newMounts });
                  }}
                  className="rounded border-slate-600"
                />
                RO
              </label>
              <button
                onClick={() => {
                  const newMounts = mounts.filter((_, idx) => idx !== i);
                  onUpdate({ volumeMounts: newMounts.length ? newMounts : undefined });
                }}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-slate-500 bg-slate-800/30 rounded p-3 border border-slate-700/50">
        <strong>Note:</strong> Volume mounts connect volumes defined in the pod spec to paths inside this container. 
        Go to the Volumes tab to add new volumes.
      </div>
    </div>
  );
};

// Security Section
const SecuritySection: React.FC<{ container: V1Container; onUpdate: (u: Partial<V1Container>) => void }> = ({ container, onUpdate }) => {
  const sec = (container.securityContext || {}) as ContainerSecurityContext;

  const updateSecurity = (updates: Partial<ContainerSecurityContext>) => {
    const newSec = { ...sec, ...updates };
    // Clean up
    Object.keys(newSec).forEach(k => {
      if ((newSec as Record<string, unknown>)[k] === undefined || (newSec as Record<string, unknown>)[k] === false) {
        delete (newSec as Record<string, unknown>)[k];
      }
    });
    onUpdate({ securityContext: Object.keys(newSec).length > 0 ? newSec : undefined });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-6">
        {/* User/Group */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase">User & Group</h4>
          <InputField
            label="Run As User"
            value={sec.runAsUser !== undefined ? String(sec.runAsUser) : ''}
            onChange={(v) => updateSecurity({ runAsUser: v ? parseInt(v) : undefined })}
            placeholder="1000"
          />
          <InputField
            label="Run As Group"
            value={sec.runAsGroup !== undefined ? String(sec.runAsGroup) : ''}
            onChange={(v) => updateSecurity({ runAsGroup: v ? parseInt(v) : undefined })}
            placeholder="1000"
          />
        </div>

        {/* Flags */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase">Security Flags</h4>
          <CheckboxField
            label="Run as Non-Root"
            checked={sec.runAsNonRoot || false}
            onChange={(v) => updateSecurity({ runAsNonRoot: v || undefined })}
          />
          <CheckboxField
            label="Read-Only Root Filesystem"
            checked={sec.readOnlyRootFilesystem || false}
            onChange={(v) => updateSecurity({ readOnlyRootFilesystem: v || undefined })}
          />
          <CheckboxField
            label="Privileged"
            checked={sec.privileged || false}
            onChange={(v) => updateSecurity({ privileged: v || undefined })}
          />
          <CheckboxField
            label="Allow Privilege Escalation"
            checked={sec.allowPrivilegeEscalation !== false}
            onChange={(v) => updateSecurity({ allowPrivilegeEscalation: v ? undefined : false })}
          />
        </div>
      </div>

      {/* Capabilities */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Capabilities</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Add</label>
            <input
              type="text"
              value={sec.capabilities?.add?.join(', ') || ''}
              onChange={(e) => {
                const caps = e.target.value.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
                updateSecurity({
                  capabilities: {
                    ...sec.capabilities,
                    add: caps.length > 0 ? caps : undefined
                  }
                });
              }}
              placeholder="NET_ADMIN, SYS_TIME"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Drop</label>
            <input
              type="text"
              value={sec.capabilities?.drop?.join(', ') || ''}
              onChange={(e) => {
                const caps = e.target.value.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
                updateSecurity({
                  capabilities: {
                    ...sec.capabilities,
                    drop: caps.length > 0 ? caps : undefined
                  }
                });
              }}
              placeholder="ALL"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Shared Form Components
const InputField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}> = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div>
    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

const CheckboxField: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
    />
    <span className="text-sm text-slate-300">{label}</span>
  </label>
);
