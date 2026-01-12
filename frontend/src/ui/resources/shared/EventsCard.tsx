import React, { useState, useEffect } from 'react';
import { useClusterStore } from '../../../store/useClusterStore';
import { 
  AlertTriangle, 
  Info, 
  ChevronDown, 
  ChevronRight, 
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatAge } from './formatters';

interface EventsCardProps {
  namespace: string;
  resourceId: string; // The UID of the resource
  className?: string;
}

interface K8sEvent {
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    creationTimestamp: string;
  };
  involvedObject: {
    kind: string;
    name: string;
    namespace: string;
    uid: string;
  };
  reason: string;
  message: string;
  type: 'Normal' | 'Warning';
  count?: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  eventTime?: string;
  source?: {
    component?: string;
    host?: string;
  };
}

export const EventsCard: React.FC<EventsCardProps> = ({ namespace, resourceId, className }) => {
  const client = useClusterStore(state => state.client);
  const [events, setEvents] = useState<K8sEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Count events by type
  const warningCount = events.filter(e => e.type === 'Warning').length;
  const normalCount = events.filter(e => e.type === 'Normal').length;
  const hasErrors = warningCount > 0;

  // Fetch events
  useEffect(() => {
    if (!client || !resourceId) return;

    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const evts = await client.getEvents(namespace, resourceId);
        // Sort by timestamp descending (most recent first)
        evts.sort((a: K8sEvent, b: K8sEvent) => {
          const tA = new Date(a.lastTimestamp || a.eventTime || a.metadata.creationTimestamp).getTime();
          const tB = new Date(b.lastTimestamp || b.eventTime || b.metadata.creationTimestamp).getTime();
          return tB - tA;
        });
        setEvents(evts);
      } catch (e) {
        console.warn('Failed to fetch events', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
    // Poll for events every 5 seconds
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [client, namespace, resourceId]);

  const getEventIcon = (type: string) => {
    if (type === 'Warning') {
      return <AlertTriangle size={14} className="text-amber-400" />;
    }
    return <Info size={14} className="text-blue-400" />;
  };

  const getEventTimestamp = (event: K8sEvent) => {
    const timestamp = event.lastTimestamp || event.eventTime || event.metadata.creationTimestamp;
    return formatAge(timestamp);
  };

  return (
    <div className={clsx("bg-slate-900/50 rounded-xl border border-slate-800", className)}>
      {/* Header - Always visible */}
      <div
        className={clsx(
          "px-4 py-3 rounded-t-xl flex items-center gap-3 cursor-pointer transition-colors",
          hasErrors ? "bg-amber-900/30 border-b border-amber-800/50" : "bg-slate-800/50 border-b border-slate-700",
          "hover:bg-slate-800/70"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown size={16} className="text-slate-500" />
        ) : (
          <ChevronRight size={16} className="text-slate-500" />
        )}
        
        {hasErrors ? (
          <AlertCircle size={16} className="text-amber-400" />
        ) : events.length > 0 ? (
          <CheckCircle2 size={16} className="text-emerald-400" />
        ) : (
          <Clock size={16} className="text-slate-400" />
        )}
        
        <span className="font-semibold text-slate-200">Events</span>
        
        {/* Event counts */}
        <div className="flex items-center gap-2 ml-auto">
          {isLoading && <RefreshCw size={12} className="text-slate-500 animate-spin" />}
          
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-900/50 text-amber-300 rounded-full border border-amber-700/50">
              <AlertTriangle size={10} />
              {warningCount} Warning{warningCount > 1 ? 's' : ''}
            </span>
          )}
          
          {normalCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded-full">
              {normalCount} Normal
            </span>
          )}
          
          {events.length === 0 && !isLoading && (
            <span className="text-xs text-slate-500">No events</span>
          )}
        </div>
      </div>

      {/* Events list - Collapsible */}
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No events found for this resource
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {events.map((event) => (
                <div
                  key={event.metadata.uid}
                  className={clsx(
                    "px-4 py-3 text-sm",
                    event.type === 'Warning' && "bg-amber-950/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {getEventIcon(event.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx(
                          "font-medium",
                          event.type === 'Warning' ? "text-amber-300" : "text-slate-200"
                        )}>
                          {event.reason}
                        </span>
                        {event.count && event.count > 1 && (
                          <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                            ×{event.count}
                          </span>
                        )}
                        <span className="text-xs text-slate-500 ml-auto flex items-center gap-1">
                          <Clock size={10} />
                          {getEventTimestamp(event)}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-1 break-words">
                        {event.message}
                      </p>
                      {event.source?.component && (
                        <p className="text-slate-500 text-xs mt-1">
                          Source: {event.source.component}
                          {event.source.host && ` (${event.source.host})`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Compact indicator for top bar - shows just a badge if there are warnings
export const EventsIndicator: React.FC<{ 
  namespace: string; 
  resourceId: string;
  onClick?: () => void;
}> = ({ namespace, resourceId, onClick }) => {
  const client = useClusterStore(state => state.client);
  const [warningCount, setWarningCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!client || !resourceId) return;

    const fetchEvents = async () => {
      try {
        const evts = await client.getEvents(namespace, resourceId);
        setTotalCount(evts.length);
        setWarningCount(evts.filter((e: K8sEvent) => e.type === 'Warning').length);
      } catch {
        // Silently fail
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [client, namespace, resourceId]);

  if (totalCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded border transition-colors",
        warningCount > 0
          ? "text-amber-400 bg-amber-900/30 border-amber-800/50 hover:bg-amber-900/50"
          : "text-slate-400 bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"
      )}
    >
      {warningCount > 0 ? (
        <>
          <AlertTriangle size={12} />
          {warningCount}
        </>
      ) : (
        <>
          <Info size={12} />
          {totalCount}
        </>
      )}
    </button>
  );
};
