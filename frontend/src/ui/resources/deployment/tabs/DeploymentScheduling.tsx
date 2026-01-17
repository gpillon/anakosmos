import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Deployment } from '../../../../api/k8s-types';
import { 
  Server, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Target,
  Magnet,
  Shield,
  Grid3X3,
  Layers
} from 'lucide-react';
import { Combobox, useNodeNames, usePriorityClassNames } from '../../shared';

interface Props {
  resource: ClusterResource;
  model: V1Deployment;
  updateModel: (updater: (current: V1Deployment) => V1Deployment) => void;
}

export const DeploymentScheduling: React.FC<Props> = ({ model, updateModel }) => {
  const template = model?.spec?.template?.spec;
  const [expandedSection, setExpandedSection] = useState<string>('nodeSelector');
  
  // Get available cluster resources
  const nodeNames = useNodeNames();
  const priorityClassNames = usePriorityClassNames();

  // Helper to update template spec
  const updateTemplateSpec = (updates: Record<string, unknown>) => {
    updateModel(current => {
      const currentSpec = current.spec?.template?.spec;
      return {
        ...current,
        spec: {
          ...current.spec,
          selector: current.spec?.selector || { matchLabels: {} },
          template: {
            ...current.spec?.template,
            spec: {
              ...currentSpec,
              containers: currentSpec?.containers || [],
              ...updates
            }
          }
        }
      };
    });
  };

  const nodeSelector = (template?.nodeSelector || {}) as Record<string, string>;
  const nodeName = template?.nodeName || '';
  const affinity = template?.affinity || {};
  const tolerations = (template?.tolerations || []) as Array<{
    key?: string;
    operator?: string;
    value?: string;
    effect?: string;
    tolerationSeconds?: number;
  }>;
  const topologySpreadConstraints = template?.topologySpreadConstraints || [];
  const priorityClassName = template?.priorityClassName || '';

  return (
    <div className="space-y-6">
      {/* Node Name (Direct Assignment) */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 rounded-t-xl flex items-center gap-2">
          <Server size={16} className="text-purple-400" />
          <span className="font-semibold text-slate-200">Direct Node Assignment</span>
        </div>
        <div className="p-4">
          <div className="mb-2">
            <label className="text-xs text-slate-400 mb-1 block">Node Name</label>
            <Combobox
              value={nodeName}
              onChange={(v) => updateTemplateSpec({ nodeName: v || undefined })}
              options={nodeNames}
              placeholder="Leave empty for scheduler to decide"
              allowCustom={true}
              size="md"
              emptyMessage="No nodes available"
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Directly assign pods to a specific node by name. Usually you should use nodeSelector or affinity instead.
          </p>
        </div>
      </div>

      {/* Node Selector */}
      <CollapsibleSection
        title="Node Selector"
        subtitle="Simple label-based node selection"
        icon={<Target size={16} className="text-blue-400" />}
        isExpanded={expandedSection === 'nodeSelector'}
        onToggle={() => setExpandedSection(expandedSection === 'nodeSelector' ? '' : 'nodeSelector')}
        count={Object.keys(nodeSelector).length}
      >
        <div className="space-y-3">
          {Object.entries(nodeSelector).map(([key, value]) => (
            <div key={key} className="flex gap-2 items-center">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const newSelector = { ...nodeSelector };
                  delete newSelector[key];
                  newSelector[e.target.value] = value;
                  updateTemplateSpec({ nodeSelector: Object.keys(newSelector).length > 0 ? newSelector : undefined });
                }}
                placeholder="Key"
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
              />
              <span className="text-slate-500">=</span>
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  updateTemplateSpec({ nodeSelector: { ...nodeSelector, [key]: e.target.value } });
                }}
                placeholder="Value"
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
              />
              <button
                onClick={() => {
                  const newSelector = { ...nodeSelector };
                  delete newSelector[key];
                  updateTemplateSpec({ nodeSelector: Object.keys(newSelector).length > 0 ? newSelector : undefined });
                }}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              updateTemplateSpec({ nodeSelector: { ...nodeSelector, '': '' } });
            }}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <Plus size={14} /> Add Selector
          </button>
        </div>
      </CollapsibleSection>

      {/* Node Affinity */}
      <CollapsibleSection
        title="Node Affinity"
        subtitle="Advanced node selection with operators"
        icon={<Magnet size={16} className="text-emerald-400" />}
        isExpanded={expandedSection === 'nodeAffinity'}
        onToggle={() => setExpandedSection(expandedSection === 'nodeAffinity' ? '' : 'nodeAffinity')}
      >
        <NodeAffinityEditor
          affinity={affinity.nodeAffinity}
          onUpdate={(nodeAffinity) => {
            updateTemplateSpec({ affinity: { ...affinity, nodeAffinity: nodeAffinity || undefined } });
          }}
        />
      </CollapsibleSection>

      {/* Pod Affinity */}
      <CollapsibleSection
        title="Pod Affinity"
        subtitle="Co-locate pods with other pods"
        icon={<Layers size={16} className="text-cyan-400" />}
        isExpanded={expandedSection === 'podAffinity'}
        onToggle={() => setExpandedSection(expandedSection === 'podAffinity' ? '' : 'podAffinity')}
      >
        <PodAffinityEditor
          affinity={affinity.podAffinity}
          onUpdate={(podAffinity) => {
            updateTemplateSpec({ affinity: { ...affinity, podAffinity: podAffinity || undefined } });
          }}
        />
      </CollapsibleSection>

      {/* Pod Anti-Affinity */}
      <CollapsibleSection
        title="Pod Anti-Affinity"
        subtitle="Spread pods away from other pods"
        icon={<Grid3X3 size={16} className="text-orange-400" />}
        isExpanded={expandedSection === 'podAntiAffinity'}
        onToggle={() => setExpandedSection(expandedSection === 'podAntiAffinity' ? '' : 'podAntiAffinity')}
      >
        <PodAffinityEditor
          affinity={affinity.podAntiAffinity}
          onUpdate={(podAntiAffinity) => {
            updateTemplateSpec({ affinity: { ...affinity, podAntiAffinity: podAntiAffinity || undefined } });
          }}
        />
      </CollapsibleSection>

      {/* Tolerations */}
      <CollapsibleSection
        title="Tolerations"
        subtitle="Allow scheduling on tainted nodes"
        icon={<Shield size={16} className="text-amber-400" />}
        isExpanded={expandedSection === 'tolerations'}
        onToggle={() => setExpandedSection(expandedSection === 'tolerations' ? '' : 'tolerations')}
        count={tolerations.length}
      >
        <TolerationsEditor
          tolerations={tolerations}
          onUpdate={(t) => updateTemplateSpec({ tolerations: t.length > 0 ? t : undefined })}
        />
      </CollapsibleSection>

      {/* Topology Spread Constraints */}
      <CollapsibleSection
        title="Topology Spread Constraints"
        subtitle="Distribute pods across topology domains"
        icon={<Grid3X3 size={16} className="text-pink-400" />}
        isExpanded={expandedSection === 'topology'}
        onToggle={() => setExpandedSection(expandedSection === 'topology' ? '' : 'topology')}
        count={topologySpreadConstraints.length}
      >
        <TopologySpreadEditor
          constraints={topologySpreadConstraints}
          onUpdate={(c) => updateTemplateSpec({ topologySpreadConstraints: c.length > 0 ? c : undefined })}
        />
      </CollapsibleSection>

      {/* Priority Class */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 rounded-t-xl flex items-center gap-2">
          <Target size={16} className="text-red-400" />
          <span className="font-semibold text-slate-200">Priority Class</span>
        </div>
        <div className="p-4">
          <Combobox
            value={priorityClassName}
            onChange={(v) => updateTemplateSpec({ priorityClassName: v || undefined })}
            options={priorityClassNames}
            placeholder="Select priority class..."
            allowCustom={true}
            size="md"
            emptyMessage="No PriorityClasses available"
          />
          <p className="text-xs text-slate-500 mt-2">
            PriorityClass determines the scheduling priority and preemption behavior.
          </p>
        </div>
      </div>
    </div>
  );
};

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  count?: number;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, isExpanded, onToggle, count, children }) => (
  <div className="bg-slate-900/50 rounded-xl border border-slate-800">
    <div 
      className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 rounded-t-xl flex items-center gap-3 cursor-pointer hover:bg-slate-800/70 transition-colors"
      onClick={onToggle}
    >
      {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
      {icon}
      <div className="flex-1">
        <span className="font-semibold text-slate-200">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="ml-2 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{count}</span>
        )}
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
    {isExpanded && <div className="p-4">{children}</div>}
  </div>
);

// Node Affinity types
interface NodeSelectorTerm {
  matchExpressions?: Array<{ key: string; operator: string; values?: string[] }>;
}

interface NodeAffinitySpec {
  requiredDuringSchedulingIgnoredDuringExecution?: { nodeSelectorTerms?: NodeSelectorTerm[] };
  preferredDuringSchedulingIgnoredDuringExecution?: Array<{ weight: number; preference: NodeSelectorTerm }>;
}

// Node Affinity Editor
const NodeAffinityEditor: React.FC<{
  affinity?: NodeAffinitySpec;
  onUpdate: (affinity: NodeAffinitySpec) => void;
}> = ({ affinity = {}, onUpdate }) => {
  const required = affinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms || [];
  const preferred = affinity?.preferredDuringSchedulingIgnoredDuringExecution || [];

  const addRequiredTerm = () => {
    const newTerms = [...required, { matchExpressions: [{ key: '', operator: 'In', values: [] }] }];
    onUpdate({
      ...affinity,
      requiredDuringSchedulingIgnoredDuringExecution: { nodeSelectorTerms: newTerms }
    });
  };

  const addPreferredTerm = () => {
    const newPreferred = [...preferred, { weight: 1, preference: { matchExpressions: [{ key: '', operator: 'In', values: [] }] } }];
    onUpdate({
      ...affinity,
      preferredDuringSchedulingIgnoredDuringExecution: newPreferred
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-300">Required (Hard)</h4>
            <p className="text-xs text-slate-500">Pod won't schedule if requirements aren't met</p>
          </div>
          <button onClick={addRequiredTerm} className="text-xs text-blue-400 hover:text-blue-300">
            <Plus size={12} className="inline mr-1" /> Add Term
          </button>
        </div>
        {required.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No required terms</div>
        ) : (
          <div className="space-y-3">
            {required.map((term, i) => (
              <NodeSelectorTermEditor
                key={i}
                term={term}
                onUpdate={(t) => {
                  const newTerms = [...required];
                  newTerms[i] = t;
                  onUpdate({
                    ...affinity,
                    requiredDuringSchedulingIgnoredDuringExecution: { nodeSelectorTerms: newTerms }
                  });
                }}
                onRemove={() => {
                  const newTerms = required.filter((_, idx) => idx !== i);
                  onUpdate({
                    ...affinity,
                    requiredDuringSchedulingIgnoredDuringExecution: newTerms.length > 0 ? { nodeSelectorTerms: newTerms } : undefined
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-300">Preferred (Soft)</h4>
            <p className="text-xs text-slate-500">Scheduler will try to honor, but not required</p>
          </div>
          <button onClick={addPreferredTerm} className="text-xs text-emerald-400 hover:text-emerald-300">
            <Plus size={12} className="inline mr-1" /> Add Preference
          </button>
        </div>
        {preferred.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No preferred terms</div>
        ) : (
          <div className="space-y-3">
            {preferred.map((pref, i) => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <label className="text-xs text-slate-400">Weight:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={pref.weight}
                    onChange={(e) => {
                      const newPreferred = [...preferred];
                      newPreferred[i] = { ...pref, weight: parseInt(e.target.value) || 1 };
                      onUpdate({
                        ...affinity,
                        preferredDuringSchedulingIgnoredDuringExecution: newPreferred
                      });
                    }}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  />
                  <button
                    onClick={() => {
                      const newPreferred = preferred.filter((_, idx) => idx !== i);
                      onUpdate({
                        ...affinity,
                        preferredDuringSchedulingIgnoredDuringExecution: newPreferred.length > 0 ? newPreferred : undefined
                      });
                    }}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <NodeSelectorTermEditor
                  term={pref.preference}
                  onUpdate={(t) => {
                    const newPreferred = [...preferred];
                    newPreferred[i] = { ...pref, preference: t };
                    onUpdate({
                      ...affinity,
                      preferredDuringSchedulingIgnoredDuringExecution: newPreferred
                    });
                  }}
                  onRemove={() => {}}
                  hideRemove
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Node Selector Term Editor
const NodeSelectorTermEditor: React.FC<{
  term: { matchExpressions?: Array<{ key: string; operator: string; values?: string[] }> };
  onUpdate: (term: { matchExpressions?: Array<{ key: string; operator: string; values?: string[] }> }) => void;
  onRemove: () => void;
  hideRemove?: boolean;
}> = ({ term, onUpdate, onRemove, hideRemove }) => {
  const expressions = term.matchExpressions || [];

  return (
    <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase">Match Expressions</span>
        {!hideRemove && (
          <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">Remove Term</button>
        )}
      </div>
      
      {expressions.map((expr, i) => (
        <div key={i} className="flex gap-2 items-center mb-2">
          <input
            type="text"
            value={expr.key}
            onChange={(e) => {
              const newExpr = [...expressions];
              newExpr[i] = { ...expr, key: e.target.value };
              onUpdate({ ...term, matchExpressions: newExpr });
            }}
            placeholder="Key"
            className="w-1/4 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
          />
          <select
            value={expr.operator}
            onChange={(e) => {
              const newExpr = [...expressions];
              newExpr[i] = { ...expr, operator: e.target.value };
              onUpdate({ ...term, matchExpressions: newExpr });
            }}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
          >
            <option value="In">In</option>
            <option value="NotIn">NotIn</option>
            <option value="Exists">Exists</option>
            <option value="DoesNotExist">DoesNotExist</option>
            <option value="Gt">Gt</option>
            <option value="Lt">Lt</option>
          </select>
          {!['Exists', 'DoesNotExist'].includes(expr.operator) && (
            <input
              type="text"
              value={expr.values?.join(', ') || ''}
              onChange={(e) => {
                const newExpr = [...expressions];
                newExpr[i] = { ...expr, values: e.target.value.split(',').map((v: string) => v.trim()).filter(Boolean) };
                onUpdate({ ...term, matchExpressions: newExpr });
              }}
              placeholder="Values (comma separated)"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
            />
          )}
          <button
            onClick={() => {
              const newExpr = expressions.filter((_, idx) => idx !== i);
              onUpdate({ ...term, matchExpressions: newExpr.length > 0 ? newExpr : undefined });
            }}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => {
          onUpdate({ ...term, matchExpressions: [...expressions, { key: '', operator: 'In', values: [] }] });
        }}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        <Plus size={12} className="inline mr-1" /> Add Expression
      </button>
    </div>
  );
};

// Pod Affinity Editor (simplified)
interface PodAffinityTermSpec {
  labelSelector?: { matchLabels?: Record<string, string> };
  topologyKey?: string;
}

interface PodAffinitySpec {
  requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTermSpec[];
  preferredDuringSchedulingIgnoredDuringExecution?: Array<{ weight: number; podAffinityTerm: PodAffinityTermSpec }>;
}

const PodAffinityEditor: React.FC<{
  affinity?: PodAffinitySpec;
  onUpdate: (affinity: PodAffinitySpec) => void;
}> = ({ affinity = {}, onUpdate }) => {
  const required = affinity?.requiredDuringSchedulingIgnoredDuringExecution || [];
  const preferred = affinity?.preferredDuringSchedulingIgnoredDuringExecution || [];

  const addRequired = () => {
    onUpdate({
      ...affinity,
      requiredDuringSchedulingIgnoredDuringExecution: [
        ...required,
        { labelSelector: { matchLabels: {} }, topologyKey: 'kubernetes.io/hostname' }
      ]
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-300">Required (Hard)</h4>
          <button onClick={addRequired} className="text-xs text-blue-400 hover:text-blue-300">
            <Plus size={12} className="inline mr-1" /> Add Rule
          </button>
        </div>
        {required.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No required rules</div>
        ) : (
          <div className="space-y-3">
            {required.map((term, i) => (
              <div key={i} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400">Topology Key</label>
                  <button 
                    onClick={() => {
                      const newTerms = required.filter((_, idx) => idx !== i);
                      onUpdate({
                        ...affinity,
                        requiredDuringSchedulingIgnoredDuringExecution: newTerms.length > 0 ? newTerms : undefined
                      });
                    }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={term.topologyKey || ''}
                  onChange={(e) => {
                    const newTerms = [...required];
                    newTerms[i] = { ...term, topologyKey: e.target.value };
                    onUpdate({ ...affinity, requiredDuringSchedulingIgnoredDuringExecution: newTerms });
                  }}
                  placeholder="kubernetes.io/hostname"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
                />
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="text-xs text-slate-500">
        Preferred rules: {preferred.length} configured
      </div>
    </div>
  );
};

// Tolerations Editor
const TolerationsEditor: React.FC<{
  tolerations: Array<{ key?: string; operator?: string; value?: string; effect?: string; tolerationSeconds?: number }>;
  onUpdate: (tolerations: Array<{ key?: string; operator?: string; value?: string; effect?: string; tolerationSeconds?: number }>) => void;
}> = ({ tolerations, onUpdate }) => {
  const addToleration = () => {
    onUpdate([...tolerations, { key: '', operator: 'Equal', value: '', effect: 'NoSchedule' }]);
  };

  return (
    <div className="space-y-3">
      {tolerations.length === 0 ? (
        <div className="text-center py-4 text-slate-500">
          <Shield size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No tolerations defined</p>
        </div>
      ) : (
        tolerations.map((tol, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <input
              type="text"
              value={tol.key || ''}
              onChange={(e) => {
                const newTol = [...tolerations];
                newTol[i] = { ...tol, key: e.target.value };
                onUpdate(newTol);
              }}
              placeholder="Key"
              className="w-32 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
            />
            <select
              value={tol.operator || 'Equal'}
              onChange={(e) => {
                const newTol = [...tolerations];
                newTol[i] = { ...tol, operator: e.target.value };
                onUpdate(newTol);
              }}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value="Equal">Equal</option>
              <option value="Exists">Exists</option>
            </select>
            {tol.operator !== 'Exists' && (
              <input
                type="text"
                value={tol.value || ''}
                onChange={(e) => {
                  const newTol = [...tolerations];
                  newTol[i] = { ...tol, value: e.target.value };
                  onUpdate(newTol);
                }}
                placeholder="Value"
                className="w-32 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
              />
            )}
            <select
              value={tol.effect || ''}
              onChange={(e) => {
                const newTol = [...tolerations];
                newTol[i] = { ...tol, effect: e.target.value || undefined };
                onUpdate(newTol);
              }}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value="">All Effects</option>
              <option value="NoSchedule">NoSchedule</option>
              <option value="PreferNoSchedule">PreferNoSchedule</option>
              <option value="NoExecute">NoExecute</option>
            </select>
            <button
              onClick={() => onUpdate(tolerations.filter((_, idx) => idx !== i))}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
      <button
        onClick={addToleration}
        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
      >
        <Plus size={14} /> Add Toleration
      </button>
    </div>
  );
};

// Topology Spread Editor
const TopologySpreadEditor: React.FC<{
  constraints: Array<{ maxSkew?: number; topologyKey?: string; whenUnsatisfiable?: string; labelSelector?: unknown }>;
  onUpdate: (constraints: Array<{ maxSkew?: number; topologyKey?: string; whenUnsatisfiable?: string; labelSelector?: unknown }>) => void;
}> = ({ constraints, onUpdate }) => {
  const addConstraint = () => {
    onUpdate([...constraints, {
      maxSkew: 1,
      topologyKey: 'kubernetes.io/hostname',
      whenUnsatisfiable: 'DoNotSchedule',
      labelSelector: { matchLabels: {} }
    }]);
  };

  return (
    <div className="space-y-3">
      {constraints.length === 0 ? (
        <div className="text-center py-4 text-slate-500">
          <Grid3X3 size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No topology spread constraints</p>
        </div>
      ) : (
        constraints.map((constraint, i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Constraint {i + 1}</span>
              <button
                onClick={() => onUpdate(constraints.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Topology Key</label>
                <input
                  type="text"
                  value={constraint.topologyKey || ''}
                  onChange={(e) => {
                    const newC = [...constraints];
                    newC[i] = { ...constraint, topologyKey: e.target.value };
                    onUpdate(newC);
                  }}
                  placeholder="kubernetes.io/hostname"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Max Skew</label>
                <input
                  type="number"
                  min="1"
                  value={constraint.maxSkew || 1}
                  onChange={(e) => {
                    const newC = [...constraints];
                    newC[i] = { ...constraint, maxSkew: parseInt(e.target.value) || 1 };
                    onUpdate(newC);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">When Unsatisfiable</label>
              <select
                value={constraint.whenUnsatisfiable || 'DoNotSchedule'}
                onChange={(e) => {
                  const newC = [...constraints];
                  newC[i] = { ...constraint, whenUnsatisfiable: e.target.value };
                  onUpdate(newC);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="DoNotSchedule">DoNotSchedule</option>
                <option value="ScheduleAnyway">ScheduleAnyway</option>
              </select>
            </div>
          </div>
        ))
      )}
      <button
        onClick={addConstraint}
        className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300"
      >
        <Plus size={14} /> Add Constraint
      </button>
    </div>
  );
};
