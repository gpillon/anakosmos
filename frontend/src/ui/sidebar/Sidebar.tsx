import React, { useCallback, useEffect, useMemo, useState } from 'react';
import yaml from 'js-yaml';
import { clsx } from 'clsx';
import { ErrorModal } from '../components/ErrorModal';
import { PodMetricsDisplay, NodeMetricsDisplay } from '../components/MetricsChart';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useClusterStore } from '../../store/useClusterStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useResourceDetailsStore } from '../../store/useResourceDetailsStore';
import { SidebarHeader } from './components/SidebarHeader';
import { SidebarTabs, type SidebarTab } from './components/SidebarTabs';
import { SidebarSection } from './components/Section';
import { EventsList } from './components/EventsList';
import { YamlEditor } from './components/YamlEditor';
import { RelationsList } from './components/RelationsList';
import { EmptyState } from './components/EmptyState';
import { ResourceOverview } from './overview/ResourceOverview';
import { useSidebarResource } from './hooks/useSidebarResource';

export const Sidebar: React.FC = () => {
  const selectedResourceId = useSettingsStore(state => state.selectedResourceId);
  const setSelectedResourceId = useSettingsStore(state => state.setSelectedResourceId);
  const resources = useClusterStore(state => state.resources);
  const client = useClusterStore(state => state.client);
  const { openTerminal } = useTerminalStore();
  const openDetails = useResourceDetailsStore(state => state.openDetails);

  const [activeTab, setActiveTab] = useState<SidebarTab>('overview');
  const [events, setEvents] = useState<any[]>([]);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [isYamlLoading, setIsYamlLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [errorModal, setErrorModal] = useState<{ open: boolean; error: string }>({ open: false, error: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const resource = selectedResourceId ? resources[selectedResourceId] : null;
  const { rawResource, isLoading: isRawLoading } = useSidebarResource(resource);

  useEffect(() => {
    setFeedback(null);
    setErrorModal({ open: false, error: '' });
  }, [activeTab, resource?.id]);

  useEffect(() => {
    if (!resource || activeTab !== 'events' || !client) return;

    const fetchEvents = async () => {
      const evts = await client.getEvents(resource.namespace, resource.id);
      evts.sort((a, b) => {
        const tA = new Date(a.lastTimestamp || a.eventTime || a.metadata.creationTimestamp).getTime();
        const tB = new Date(b.lastTimestamp || b.eventTime || b.metadata.creationTimestamp).getTime();
        return tB - tA;
      });
      setEvents(evts);
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 3000);

    return () => clearInterval(interval);
  }, [resource, activeTab, client]);

  useEffect(() => {
    if (!resource || activeTab !== 'yaml' || !client) return;

    const fetchYaml = async () => {
      setIsYamlLoading(true);
      try {
        const rawContent = await client.getYaml(resource.namespace, resource.kind, resource.name);
        try {
          const doc = yaml.load(rawContent) as any;
          if (doc?.metadata?.managedFields) {
            delete doc.metadata.managedFields;
          }
          setYamlContent(yaml.dump(doc));
        } catch (e) {
          console.error('YAML parse error', e);
          setYamlContent(rawContent);
        }
      } finally {
        setIsYamlLoading(false);
      }
    };

    fetchYaml();
  }, [resource, activeTab, client]);

  const handleApplyYaml = async () => {
    if (!client || !resource) return;
    setIsYamlLoading(true);
    setFeedback(null);
    try {
      await client.applyYaml(resource.namespace, resource.kind, resource.name, yamlContent);
      setFeedback({ type: 'success', message: 'Resource updated' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (e: any) {
      let shortError = 'Update failed';
      let fullErrorForModal = e.message || JSON.stringify(e, null, 2);

      if (e.details && typeof e.details === 'object') {
        if (e.details.message) {
          shortError = e.details.message;
        }
        fullErrorForModal = JSON.stringify(e.details, null, 2);
      } else {
        try {
          const jsonMatch = (e.message || '').match(/\{.*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.message) {
              shortError = parsed.message;
            }
            fullErrorForModal = JSON.stringify(parsed, null, 2);
          } else {
            shortError = e.message;
          }
        } catch {
          shortError = e.message;
        }
      }

      setErrorModal({ open: true, error: fullErrorForModal });
      setFeedback({ type: 'error', message: shortError });
    } finally {
      setIsYamlLoading(false);
    }
  };

  const applyUpdatedRaw = useCallback(async (updatedRaw: any, successMessage: string) => {
    if (!client || !resource) return;
    setActionLoading(true);
    try {
      const cleaned = JSON.parse(JSON.stringify(updatedRaw));
      if (cleaned?.metadata?.managedFields) delete cleaned.metadata.managedFields;
      await client.applyYaml(resource.namespace, resource.kind, resource.name, yaml.dump(cleaned));
      setFeedback({ type: 'success', message: successMessage });
      setTimeout(() => setFeedback(null), 2500);
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', message: e.message || 'Action failed' });
    } finally {
      setActionLoading(false);
    }
  }, [client, resource]);

  const handleScaleDeployment = useCallback(async (replicas: number) => {
    if (!resource || !client) return;
    const raw = rawResource || resource.raw || (await client.getResource(resource.namespace, resource.kind, resource.name));
    if (!raw) return;
    const updated = JSON.parse(JSON.stringify(raw));
    updated.spec = updated.spec || {};
    updated.spec.replicas = replicas;
    await applyUpdatedRaw(updated, `Scaled to ${replicas}`);
  }, [resource, client, rawResource, applyUpdatedRaw]);

  const overviewContext = useMemo(() => {
    if (!resource) return null;
    return {
      resource,
      raw: rawResource || resource.raw,
      onOpenDetails: () => openDetails(resource.id),
      onOpenTerminal: (mode: 'shell' | 'logs') => openTerminal(resource.id, resource.name, resource.namespace || 'default', mode),
      onScale: resource.kind === 'Deployment' ? handleScaleDeployment : undefined,
      scaleInProgress: actionLoading,
    };
  }, [resource, rawResource, openDetails, openTerminal, actionLoading, handleScaleDeployment]);

  if (!resource) return null;

  return (
    <>
      <ErrorModal
        isOpen={errorModal.open}
        onClose={() => setErrorModal({ ...errorModal, open: false })}
        title={`Failed to apply ${resource.kind}`}
        error={errorModal.error}
      />

      <div className={clsx(
        'absolute top-0 right-0 h-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 text-slate-100 shadow-2xl flex flex-col z-20 transition-all duration-300',
        activeTab === 'yaml' ? 'w-[800px]' : 'w-96'
      )}>
        <SidebarHeader resource={resource} onClose={() => setSelectedResourceId(null)} />
        <SidebarTabs active={activeTab} onChange={setActiveTab} />

        <div className={clsx(
          'flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent',
          activeTab === 'yaml' ? 'p-0 flex flex-col' : 'p-6'
        )}>
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {(resource.kind === 'Pod' || resource.kind === 'Node') && (
                <SidebarSection title="Metrics">
                  {resource.kind === 'Pod' && client && (
                    <PodMetricsDisplay
                      namespace={resource.namespace || 'default'}
                      podName={resource.name}
                      client={client}
                    />
                  )}
                  {resource.kind === 'Node' && client && (
                    <NodeMetricsDisplay
                      nodeName={resource.name}
                      client={client}
                    />
                  )}
                </SidebarSection>
              )}

              {overviewContext && <ResourceOverview {...overviewContext} />}

              <SidebarSection title="Relations">
                <RelationsList ownerRefs={resource.ownerRefs} />
              </SidebarSection>

              {isRawLoading && (
                <SidebarSection title="Loading">
                  <EmptyState message="Loading resource details..." />
                </SidebarSection>
              )}
            </div>
          )}

          {activeTab === 'events' && <EventsList events={events} />}

          {activeTab === 'yaml' && (
            <YamlEditor
              value={yamlContent}
              onChange={setYamlContent}
              onApply={handleApplyYaml}
              isLoading={isYamlLoading}
              feedback={feedback}
            />
          )}
        </div>
      </div>
    </>
  );
};
