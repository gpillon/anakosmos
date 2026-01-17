import React, { useState, useMemo } from 'react';
import type { V1Ingress, V1HTTPIngressPath, V1IngressRule } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { 
  Route, 
  Globe, 
  Server, 
  ChevronRight, 
  Plus, 
  Trash2, 
  ArrowRight,
  Lock,
  Edit2,
  Check,
  X
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  Combobox,
} from '../../shared';
import { clsx } from 'clsx';

interface Props {
  model: V1Ingress;
  updateModel: (updater: (current: V1Ingress) => V1Ingress) => void;
}

export const IngressRules: React.FC<Props> = ({ model, updateModel }) => {
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set([0]));
  const [editingPath, setEditingPath] = useState<{ ruleIndex: number; pathIndex: number } | null>(null);
  const [addingRule, setAddingRule] = useState(false);
  const [addingPath, setAddingPath] = useState<number | null>(null);
  
  const allResources = useClusterStore(state => state.resources);
  const spec = model.spec;
  const rules = spec?.rules || [];
  const tlsHosts = spec?.tls?.flatMap(t => t.hosts || []) || [];
  const namespace = model.metadata?.namespace || 'default';

  // Get available services in the same namespace
  const availableServices = useMemo(() => {
    return Object.values(allResources)
      .filter(r => r.kind === 'Service' && r.namespace === namespace)
      .map(r => r.name)
      .sort();
  }, [allResources, namespace]);

  // New rule form state
  const [newRule, setNewRule] = useState({ 
    host: '', 
    path: '/', 
    pathType: 'Prefix' as 'Prefix' | 'Exact' | 'ImplementationSpecific',
    serviceName: '', 
    servicePort: '' 
  });
  
  // New path form state
  const [newPath, setNewPath] = useState({
    path: '/',
    pathType: 'Prefix' as 'Prefix' | 'Exact' | 'ImplementationSpecific',
    serviceName: '',
    servicePort: ''
  });

  // Edit path form state
  const [editPath, setEditPath] = useState({
    path: '',
    pathType: 'Prefix' as 'Prefix' | 'Exact' | 'ImplementationSpecific',
    serviceName: '',
    servicePort: ''
  });

  const toggleRule = (index: number) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRules(newExpanded);
  };

  // Add a new rule
  const handleAddRule = () => {
    if (!newRule.serviceName.trim()) return;
    
    const portValue = parseInt(newRule.servicePort);
    const isPortNumber = !isNaN(portValue);

    const newRuleObj: V1IngressRule = {
      host: newRule.host.trim() || undefined,
      http: { 
        paths: [{
          path: newRule.path.trim(),
          pathType: newRule.pathType,
          backend: {
            service: {
              name: newRule.serviceName.trim(),
              port: isPortNumber 
                ? { number: portValue }
                : { name: newRule.servicePort.trim() }
            }
          }
        }]
      }
    };

    updateModel(current => {
      const newRules = [...(current.spec?.rules || []), newRuleObj];
      return {
        ...current,
        spec: {
          ...current.spec,
          rules: newRules
        }
      };
    });
    
    setNewRule({ 
      host: '', 
      path: '/', 
      pathType: 'Prefix',
      serviceName: '', 
      servicePort: '' 
    });
    setAddingRule(false);
    // Expand the new rule
    setExpandedRules(new Set([...expandedRules, rules.length]));
  };

  // Delete a rule
  const handleDeleteRule = (ruleIndex: number) => {
    if (!confirm(`Delete rule for host "${rules[ruleIndex]?.host || '*'}"?`)) return;
    
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec,
        rules: current.spec?.rules?.filter((_, i) => i !== ruleIndex)
      }
    }));
  };

  // Add a path to a rule
  const handleAddPath = (ruleIndex: number) => {
    if (!newPath.path.trim() || !newPath.serviceName.trim()) return;
    
    const portValue = parseInt(newPath.servicePort);
    const isPortNumber = !isNaN(portValue);
    
    const newPathObj: V1HTTPIngressPath = {
      path: newPath.path.trim(),
      pathType: newPath.pathType,
      backend: {
        service: {
          name: newPath.serviceName.trim(),
          port: isPortNumber 
            ? { number: portValue }
            : { name: newPath.servicePort.trim() }
        }
      }
    };

    updateModel(current => {
      const newRules = [...(current.spec?.rules || [])];
      if (newRules[ruleIndex]) {
        if (!newRules[ruleIndex].http) {
          newRules[ruleIndex] = { ...newRules[ruleIndex], http: { paths: [] } };
        }
        newRules[ruleIndex] = {
          ...newRules[ruleIndex],
          http: {
            ...newRules[ruleIndex].http,
            paths: [...(newRules[ruleIndex].http?.paths || []), newPathObj]
          }
        };
      }
      return {
        ...current,
        spec: {
          ...current.spec,
          rules: newRules
        }
      };
    });
    
    setNewPath({ path: '/', pathType: 'Prefix', serviceName: '', servicePort: '' });
    setAddingPath(null);
  };

  // Delete a path
  const handleDeletePath = (ruleIndex: number, pathIndex: number) => {
    const path = rules[ruleIndex]?.http?.paths?.[pathIndex];
    if (!confirm(`Delete path "${path?.path || '/'}"?`)) return;
    
    updateModel(current => {
      const newRules = [...(current.spec?.rules || [])];
      if (newRules[ruleIndex]?.http?.paths) {
        newRules[ruleIndex] = {
          ...newRules[ruleIndex],
          http: {
            ...newRules[ruleIndex].http,
            paths: newRules[ruleIndex].http!.paths.filter((_, i) => i !== pathIndex)
          }
        };
      }
      return {
        ...current,
        spec: {
          ...current.spec,
          rules: newRules
        }
      };
    });
  };

  // Start editing a path
  const startEditPath = (ruleIndex: number, pathIndex: number) => {
    const path = rules[ruleIndex]?.http?.paths?.[pathIndex];
    if (!path) return;
    
    setEditPath({
      path: path.path || '/',
      pathType: (path.pathType as 'Prefix' | 'Exact' | 'ImplementationSpecific') || 'Prefix',
      serviceName: path.backend?.service?.name || '',
      servicePort: String(path.backend?.service?.port?.number || path.backend?.service?.port?.name || '')
    });
    setEditingPath({ ruleIndex, pathIndex });
  };

  // Save edited path
  const handleSaveEditPath = () => {
    if (!editingPath || !editPath.path.trim() || !editPath.serviceName.trim()) return;
    
    const portValue = parseInt(editPath.servicePort);
    const isPortNumber = !isNaN(portValue);
    
    updateModel(current => {
      const newRules = [...(current.spec?.rules || [])];
      if (newRules[editingPath.ruleIndex]?.http?.paths?.[editingPath.pathIndex]) {
        const newPaths = [...(newRules[editingPath.ruleIndex].http?.paths || [])];
        newPaths[editingPath.pathIndex] = {
          path: editPath.path.trim(),
          pathType: editPath.pathType,
          backend: {
            service: {
              name: editPath.serviceName.trim(),
              port: isPortNumber 
                ? { number: portValue }
                : { name: editPath.servicePort.trim() }
            }
          }
        };
        newRules[editingPath.ruleIndex] = {
          ...newRules[editingPath.ruleIndex],
          http: {
            ...newRules[editingPath.ruleIndex].http,
            paths: newPaths
          }
        };
      }
      return {
        ...current,
        spec: {
          ...current.spec,
          rules: newRules
        }
      };
    });
    
    setEditingPath(null);
  };

  // Get path type badge color
  const getPathTypeColor = (pathType: string) => {
    switch (pathType) {
      case 'Exact': return 'bg-purple-900/30 text-purple-400 border-purple-800/50';
      case 'Prefix': return 'bg-blue-900/30 text-blue-400 border-blue-800/50';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Default Backend */}
      {spec?.defaultBackend && (
        <Card>
          <CardHeader icon={<Server size={16} />} title="Default Backend" />
          <CardBody>
            <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded border border-slate-700">
              <Globe size={16} className="text-slate-500" />
              <span className="text-slate-400">Any unmatched request</span>
              <ArrowRight size={14} className="text-slate-600" />
              <Server size={16} className="text-blue-400" />
              <span className="font-mono text-blue-300">
                {spec.defaultBackend.service?.name}
                {spec.defaultBackend.service?.port?.number && 
                  <span className="text-slate-500">:{spec.defaultBackend.service.port.number}</span>
                }
                {spec.defaultBackend.service?.port?.name && 
                  <span className="text-slate-500">:{spec.defaultBackend.service.port.name}</span>
                }
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Rules */}
      <Card>
        <CardHeader 
          icon={<Route size={16} />} 
          title="Routing Rules"
          badge={<span className="text-xs text-slate-500 ml-2">({rules.length})</span>}
          action={
            <button
              onClick={() => setAddingRule(true)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Plus size={12} />
              Add Rule
            </button>
          }
        />
        <CardBody className="space-y-4">
          {/* Add Rule Form */}
          {addingRule && (
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium text-blue-400">New Routing Rule</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Host (optional)</label>
                  <input
                    type="text"
                    value={newRule.host}
                    onChange={(e) => setNewRule(r => ({ ...r, host: e.target.value }))}
                    placeholder="e.g., example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="text-[10px] text-slate-500">Leave empty for catch-all (all hosts)</div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Path</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRule.path}
                      onChange={(e) => setNewRule(r => ({ ...r, path: e.target.value }))}
                      placeholder="/api"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <select
                        value={newRule.pathType}
                        onChange={(e) => setNewRule(r => ({ ...r, pathType: e.target.value as any }))}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="Prefix">Prefix</option>
                        <option value="Exact">Exact</option>
                        <option value="ImplementationSpecific">ImplSpec</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Target Service</label>
                  <Combobox
                    value={newRule.serviceName}
                    onChange={(v) => setNewRule(r => ({ ...r, serviceName: v }))}
                    options={availableServices}
                    placeholder="Select Service"
                    icon={<Server size={12} />}
                    allowCustom
                    size="md"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Target Port</label>
                  <input
                    type="text"
                    value={newRule.servicePort}
                    onChange={(e) => setNewRule(r => ({ ...r, servicePort: e.target.value }))}
                    placeholder="80 or http"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setAddingRule(false)}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRule}
                  disabled={!newRule.serviceName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors flex items-center gap-2"
                >
                  Add Rule
                </button>
              </div>
            </div>
          )}

          {/* Rules List */}
          {rules.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Route size={32} className="mx-auto mb-3 opacity-50" />
              <div className="text-sm">No routing rules defined</div>
              <div className="text-xs mt-1">Add a rule to start routing traffic</div>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, ruleIndex) => {
                const isExpanded = expandedRules.has(ruleIndex);
                const isTls = rule.host && tlsHosts.includes(rule.host);
                const paths = rule.http?.paths || [];
                
                return (
                  <div 
                    key={ruleIndex}
                    className={clsx(
                      "rounded-lg border transition-colors",
                      isTls 
                        ? "bg-emerald-900/10 border-emerald-800/30" 
                        : "bg-slate-800/30 border-slate-700/50"
                    )}
                  >
                    {/* Rule Header */}
                    <div 
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-800/50 rounded-t-lg"
                      onClick={() => toggleRule(ruleIndex)}
                    >
                      <ChevronRight 
                        size={16} 
                        className={clsx(
                          "text-slate-500 transition-transform",
                          isExpanded && "rotate-90"
                        )} 
                      />
                      {isTls && <Lock size={14} className="text-emerald-400" />}
                      <Globe size={16} className="text-slate-400" />
                      <span className="font-mono text-white flex-1">
                        {rule.host || <span className="text-slate-500 italic">* (all hosts)</span>}
                      </span>
                      <span className="text-xs text-slate-500">
                        {paths.length} path{paths.length !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteRule(ruleIndex); }}
                        className="p-1 hover:bg-red-900/50 text-slate-500 hover:text-red-400 rounded transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Rule Paths */}
                    {isExpanded && (
                      <div className="border-t border-slate-700/50 p-3 space-y-2">
                        {/* Add Path Form */}
                        {addingPath === ruleIndex ? (
                          <div className="bg-slate-800/50 rounded-lg p-3 space-y-3 border border-slate-700">
                            <div className="text-xs font-medium text-slate-400">New Path</div>
                            <div className="grid grid-cols-4 gap-2">
                              <input
                                type="text"
                                value={newPath.path}
                                onChange={(e) => setNewPath(p => ({ ...p, path: e.target.value }))}
                                placeholder="Path (e.g., /api)"
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                              />
                              <select
                                value={newPath.pathType}
                                onChange={(e) => setNewPath(p => ({ ...p, pathType: e.target.value as any }))}
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                              >
                                <option value="Prefix">Prefix</option>
                                <option value="Exact">Exact</option>
                                <option value="ImplementationSpecific">ImplementationSpecific</option>
                              </select>
                              <Combobox
                                value={newPath.serviceName}
                                onChange={(v) => setNewPath(p => ({ ...p, serviceName: v }))}
                                options={availableServices}
                                placeholder="Service"
                                icon={<Server size={12} />}
                                allowCustom
                                label={`${availableServices.length} services in ${namespace}`}
                              />
                              <input
                                type="text"
                                value={newPath.servicePort}
                                onChange={(e) => setNewPath(p => ({ ...p, servicePort: e.target.value }))}
                                placeholder="Port"
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddPath(ruleIndex)}
                                disabled={!newPath.serviceName.trim()}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors flex items-center gap-2"
                              >
                                Add Path
                              </button>
                              <button
                                onClick={() => setAddingPath(null)}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingPath(ruleIndex)}
                            className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-blue-400 hover:border-blue-700 transition-colors text-xs flex items-center justify-center gap-2"
                          >
                            <Plus size={12} />
                            Add Path
                          </button>
                        )}

                        {/* Paths List */}
                        {paths.map((path, pathIndex) => {
                          const isEditing = editingPath?.ruleIndex === ruleIndex && editingPath?.pathIndex === pathIndex;
                          
                          if (isEditing) {
                            return (
                              <div key={pathIndex} className="bg-blue-900/20 rounded-lg p-3 border border-blue-800/50 space-y-3">
                                <div className="grid grid-cols-4 gap-2">
                                  <input
                                    type="text"
                                    value={editPath.path}
                                    onChange={(e) => setEditPath(p => ({ ...p, path: e.target.value }))}
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                  />
                                  <select
                                    value={editPath.pathType}
                                    onChange={(e) => setEditPath(p => ({ ...p, pathType: e.target.value as any }))}
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                  >
                                    <option value="Prefix">Prefix</option>
                                    <option value="Exact">Exact</option>
                                    <option value="ImplementationSpecific">ImplementationSpecific</option>
                                  </select>
                                  <Combobox
                                    value={editPath.serviceName}
                                    onChange={(v) => setEditPath(p => ({ ...p, serviceName: v }))}
                                    options={availableServices}
                                    placeholder="Service"
                                    icon={<Server size={12} />}
                                    allowCustom
                                  />
                                  <input
                                    type="text"
                                    value={editPath.servicePort}
                                    onChange={(e) => setEditPath(p => ({ ...p, servicePort: e.target.value }))}
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSaveEditPath}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors flex items-center gap-2"
                                  >
                                    <Check size={10} />
                                    Apply
                                  </button>
                                  <button
                                    onClick={() => setEditingPath(null)}
                                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors flex items-center gap-1"
                                  >
                                    <X size={10} />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          
                          return (
                            <div 
                              key={pathIndex}
                              className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors group"
                            >
                              {/* Path */}
                              <div className="flex items-center gap-2 min-w-[140px]">
                                <Route size={14} className="text-cyan-400" />
                                <span className="font-mono text-cyan-300">{path.path || '/'}</span>
                              </div>
                              
                              {/* Path Type Badge */}
                              <span className={clsx(
                                "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                                getPathTypeColor(path.pathType || 'Prefix')
                              )}>
                                {path.pathType || 'Prefix'}
                              </span>
                              
                              {/* Arrow */}
                              <ArrowRight size={14} className="text-slate-600" />
                              
                              {/* Backend Service */}
                              <div className="flex items-center gap-2 flex-1">
                                <Server size={14} className="text-blue-400" />
                                <span className="font-mono text-blue-300">
                                  {path.backend?.service?.name}
                                  {path.backend?.service?.port?.number && 
                                    <span className="text-slate-500">:{path.backend.service.port.number}</span>
                                  }
                                  {path.backend?.service?.port?.name && 
                                    <span className="text-slate-500">:{path.backend.service.port.name}</span>
                                  }
                                </span>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => startEditPath(ruleIndex, pathIndex)}
                                  className="p-1 hover:bg-slate-700 text-slate-500 hover:text-blue-400 rounded transition-colors"
                                  title="Edit path"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeletePath(ruleIndex, pathIndex)}
                                  className="p-1 hover:bg-red-900/50 text-slate-500 hover:text-red-400 rounded transition-colors"
                                  title="Delete path"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {paths.length === 0 && !addingPath && (
                          <div className="text-center py-4 text-slate-500 text-xs">
                            No paths defined for this host
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
