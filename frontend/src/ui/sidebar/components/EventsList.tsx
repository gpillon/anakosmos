import React from 'react';
import { clsx } from 'clsx';
import { Clock } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface EventsListProps {
  events: any[];
}

const EventItem = ({ type, reason, message, time }: { type: 'Normal' | 'Warning'; reason: string; message: string; time: string }) => (
  <div className="flex gap-3 text-sm relative pl-4 border-l-2 border-slate-800 pb-4 last:pb-0">
    <div className={clsx(
      'absolute -left-[5px] top-0 w-2 h-2 rounded-full ring-4 ring-slate-900',
      type === 'Normal' ? 'bg-slate-500' : 'bg-red-500'
    )} />
    <div className="flex-1 space-y-1">
      <div className="flex justify-between items-center gap-3">
        <span className={clsx('font-semibold text-xs', type === 'Normal' ? 'text-slate-300' : 'text-red-400')}>
          {reason}
        </span>
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Clock size={10} /> {time}
        </span>
      </div>
      <p className="text-slate-400 text-xs leading-relaxed">{message}</p>
    </div>
  </div>
);

export const EventsList: React.FC<EventsListProps> = ({ events }) => {
  if (events.length === 0) {
    return <EmptyState message="No events found" />;
  }

  return (
    <div className="space-y-4">
      {events.map((evt, i) => {
        const time = evt.lastTimestamp || evt.eventTime || evt.metadata.creationTimestamp;
        const date = new Date(time);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        let timeStr = `${diffMins}m ago`;
        if (diffMins < 1) timeStr = 'Just now';
        else if (diffMins > 60) timeStr = `${Math.floor(diffMins / 60)}h ago`;

        return (
          <EventItem
            key={evt.metadata.uid || i}
            type={evt.type === 'Warning' ? 'Warning' : 'Normal'}
            reason={evt.reason}
            message={evt.message}
            time={timeStr}
          />
        );
      })}
    </div>
  );
};
