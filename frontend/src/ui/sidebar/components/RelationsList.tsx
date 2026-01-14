import React from 'react';
import { ChevronRight } from 'lucide-react';

interface RelationsListProps {
  ownerRefs: string[];
}

const shortId = (id: string) => `${id.substring(0, 8)}…`;

export const RelationsList: React.FC<RelationsListProps> = ({ ownerRefs }) => {
  if (ownerRefs.length === 0) {
    return <div className="text-slate-500 text-sm italic">No owner references</div>;
  }

  return (
    <div className="space-y-2">
      {ownerRefs.map(ref => (
        <div key={ref} className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 text-sm">
          <ChevronRight size={14} className="text-slate-500" />
          <span className="text-slate-400">Owned by</span>
          <span className="font-mono text-xs bg-slate-800 px-1 py-0.5 rounded">{shortId(ref)}</span>
        </div>
      ))}
    </div>
  );
};
