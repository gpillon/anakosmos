import { ClusterScene } from './scene/ClusterScene';
import { HUD } from './ui/HUD';
import { Sidebar } from './ui/sidebar/Sidebar';
import { ViewSelector } from './ui/ViewSelector';
import { ConnectionScreen } from './ui/ConnectionScreen';
import { ResourceLegend } from './ui/ResourceLegend';
import { useKeyboardShortcuts } from './store/useKeyboardShortcuts';
import { useClusterStore } from './store/useClusterStore';
import { useOnboardingVisibility } from './store/useOnboardingStore';
import { OnboardingTutorial } from './ui/onboarding';

import { TerminalWindow } from './ui/TerminalWindow';
import { ResourceDetailsWindow } from './ui/ResourceDetailsWindow';

function App() {
  useKeyboardShortcuts();
  const { isConnected } = useClusterStore();
  const visibility = useOnboardingVisibility();

  if (!isConnected) {
    return <ConnectionScreen />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 text-white font-sans selection:bg-blue-500/30">
      <ClusterScene />
      <HUD showFull={visibility.showTopBar} />
      {visibility.showViewSelector && <ViewSelector />}
      {visibility.showLegend && <ResourceLegend />}
      <Sidebar />
      <TerminalWindow />
      <ResourceDetailsWindow />
      <OnboardingTutorial />
    </div>
  );
}

export default App;
