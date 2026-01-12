import React, { useState } from 'react';
import { Card, CardHeader, CardBody } from '../../shared';
import { FileJson, Database, ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

interface GenericSpecProps {
  rawData: any;
}

// Recursive JSON tree renderer
const JsonTree: React.FC<{ data: any; depth?: number; path?: string }> = ({ data, depth = 0, path = '' }) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, keyPath: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(keyPath);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  if (data === null) {
    return <span className="text-slate-500 italic">null</span>;
  }

  if (data === undefined) {
    return <span className="text-slate-500 italic">undefined</span>;
  }

  if (typeof data === 'boolean') {
    return <span className={data ? "text-emerald-400" : "text-red-400"}>{String(data)}</span>;
  }

  if (typeof data === 'number') {
    return <span className="text-amber-400">{data}</span>;
  }

  if (typeof data === 'string') {
    // Check if it's a long string
    if (data.length > 100) {
      return (
        <span className="text-emerald-300 break-all">
          "{data.substring(0, 100)}..."
          <button
            onClick={() => copyToClipboard(data, path)}
            className="ml-2 text-slate-500 hover:text-slate-300"
            title="Copy full value"
          >
            {copiedPath === path ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </span>
      );
    }
    return <span className="text-emerald-300">"{data}"</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-slate-500">[]</span>;
    }

    const keyPath = path || 'root-array';
    const isExpanded = depth < 1 || expandedKeys.has(keyPath);

    return (
      <div className="pl-2">
        <button
          onClick={() => toggleExpand(keyPath)}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="text-blue-400">[{data.length}]</span>
        </button>
        {isExpanded && (
          <div className="pl-4 border-l border-slate-700/50 ml-1">
            {data.map((item, idx) => (
              <div key={idx} className="py-0.5">
                <span className="text-slate-500 mr-2">{idx}:</span>
                <JsonTree data={item} depth={depth + 1} path={`${path}[${idx}]`} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return <span className="text-slate-500">{'{}'}</span>;
    }

    const keyPath = path || 'root-object';
    const isExpanded = depth < 1 || expandedKeys.has(keyPath);

    return (
      <div className="pl-2">
        <button
          onClick={() => toggleExpand(keyPath)}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="text-purple-400">{'{'}...{'}'}</span>
          <span className="text-slate-500 text-xs ml-1">({keys.length} keys)</span>
        </button>
        {isExpanded && (
          <div className="pl-4 border-l border-slate-700/50 ml-1">
            {keys.map((key) => (
              <div key={key} className="py-0.5">
                <span className="text-cyan-400">{key}</span>
                <span className="text-slate-500">: </span>
                <JsonTree data={data[key]} depth={depth + 1} path={`${path}.${key}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-slate-400">{String(data)}</span>;
};

export const GenericSpec: React.FC<GenericSpecProps> = ({ rawData }) => {
  const spec = rawData?.spec;
  const status = rawData?.status;

  // Filter out managed fields and other noise from status
  const cleanStatus = status ? { ...status } : null;
  if (cleanStatus?.conditions) {
    // Keep conditions but they're already shown in overview
    delete cleanStatus.conditions;
  }

  return (
    <div className="space-y-6">
      {/* Spec */}
      {spec && Object.keys(spec).length > 0 && (
        <Card>
          <CardHeader title="Spec" icon={<FileJson size={16} />} />
          <CardBody>
            <div className="font-mono text-xs overflow-x-auto">
              <JsonTree data={spec} />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Status */}
      {cleanStatus && Object.keys(cleanStatus).length > 0 && (
        <Card>
          <CardHeader title="Status" icon={<Database size={16} />} />
          <CardBody>
            <div className="font-mono text-xs overflow-x-auto">
              <JsonTree data={cleanStatus} />
            </div>
          </CardBody>
        </Card>
      )}

      {/* If neither spec nor status, show full raw */}
      {!spec && !status && (
        <Card>
          <CardHeader title="Resource Data" icon={<FileJson size={16} />} />
          <CardBody>
            <div className="font-mono text-xs overflow-x-auto">
              <JsonTree data={rawData} />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
