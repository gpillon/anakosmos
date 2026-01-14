import React, { useEffect, useState } from 'react';
import { useOnboardingStore, useDemoResourceLevel, type OnboardingStep } from '../../store/useOnboardingStore';
import { useClusterStore } from '../../store/useClusterStore';
import { 
  Sparkles, 
  MousePointer2, 
  Filter, 
  LayoutGrid,
  ChevronRight,
  ChevronLeft,
  X,
  Rocket,
  Eye,
  CheckCircle2,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowLeft,
  Server,
  Box,
  Boxes,
  GitBranch,
  Network,
  Globe,
  type LucideIcon
} from 'lucide-react';
import clsx from 'clsx';

interface StepConfig {
  id: OnboardingStep;
  title: string;
  description: string;
  icon: LucideIcon;
  position: 'center' | 'top' | 'top-right' | 'bottom-left' | 'bottom-center' | 'left';
  highlight?: 'topbar' | 'legend' | 'viewselector' | 'scene';
  arrow?: 'up' | 'down' | 'left' | 'right';
}

const STEPS: StepConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome to Anakosmos',
    description: 'You are about to explore your Kubernetes cluster in 3D.\n\nThis guide will show you step by step how the visualization works.',
    icon: Sparkles,
    position: 'center',
  },
  {
    id: 'first-node',
    title: 'The Node',
    description: 'Here is your first node! In Kubernetes, a Node is a physical or virtual server that runs your containers.\n\nNodes are represented as hexagonal platforms.',
    icon: Server,
    position: 'top-right',
  },
  {
    id: 'first-pod',
    title: 'The Pod',
    description: 'Here is your first Pod! A Pod is the smallest unit in Kubernetes - it contains one or more containers.\n\nPods are colored spheres placed on the nodes that run them.',
    icon: Box,
    position: 'top-right',
  },
  {
    id: 'more-pods',
    title: 'Replicas',
    description: 'Now you have 3 replicas of the Pod! Kubernetes can run multiple copies of your application to handle load and ensure high availability.\n\nEach sphere represents an independent instance.',
    icon: Boxes,
    position: 'top-right',
  },
  {
    id: 'deployment',
    title: 'Deployment and ReplicaSet',
    description: 'Here is the complete hierarchy!\n\n📦 Deployment: manages updates\n📋 ReplicaSet: maintains the number of replicas\n🔵 Pods: the actual instances\n\nThe lines show ownership relationships.',
    icon: GitBranch,
    position: 'top-right',
  },
  {
    id: 'networking',
    title: 'Networking',
    description: 'Now let\'s add networking!\n\n🔗 Service: exposes pods internally\n🌐 Ingress: exposes the service externally\n\nThe green lines show network connections.',
    icon: Network,
    position: 'top-right',
  },
  {
    id: 'full-cluster',
    title: 'Full Cluster',
    description: 'Here is a more realistic cluster example with:\n\n• 2 nodes\n• Frontend and Backend\n• Services and Ingress\n• ConfigMap and Secret\n\nIn a real cluster you might have hundreds of resources!',
    icon: Globe,
    position: 'top-right',
  },
  {
    id: 'topbar',
    title: 'Top Bar',
    description: 'Here you find the list of namespaces.\n\nYou can filter by namespace and search for specific resources (Any resource!).',
    icon: Filter,
    position: 'top',
    highlight: 'topbar',
    arrow: 'up',
  },
  {
    id: 'legend',
    title: 'Legend and Filters',
    description: 'This panel allows you to:\n\n• See resource types\n• Filter by category\n• Hide/show elements\n• Focus on specific resources',
    icon: Eye,
    position: 'bottom-left',
    highlight: 'legend',
    arrow: 'left',
  },
  {
    id: 'viewselector',
    title: 'Visualization Modes',
    description: 'Choose from 5 views:\n\n🔍 Overview: the whole cluster\n⚙️ Workloads: deployments and pods\n🌐 Networking: services and ingress\n🖥️ Nodes: infrastructure\n💾 Storage: persistent volumes',
    icon: LayoutGrid,
    position: 'bottom-center',
    highlight: 'viewselector',
    arrow: 'down',
  },
  {
    id: 'interactions',
    title: 'Interactions',
    description: '🖱️ Left click: select resources\n🖱️ Right click + drag: rotate view\n🖱️ Scroll: zoom in/out\n⌨️ ESC: deselect',
    icon: MousePointer2,
    position: 'center',
  },
  {
    id: 'complete',
    title: 'Ready to Explore!',
    description: 'You have completed the tutorial! 🎉\n\nYou are now ready to explore your Kubernetes cluster in 3D.\n\nHappy exploration!',
    icon: Rocket,
    position: 'center',
  },
];

const ArrowIndicator: React.FC<{ direction: 'up' | 'down' | 'left' | 'right' }> = ({ direction }) => {
  const icons = {
    up: ArrowUp,
    down: ArrowDown,
    left: ArrowLeft,
    right: ArrowRight,
  };
  const Icon = icons[direction];
  
  return (
    <div className={clsx(
      "absolute animate-bounce",
      direction === 'up' && "-top-12 left-1/2 -translate-x-1/2",
      direction === 'down' && "-bottom-12 left-1/2 -translate-x-1/2",
      direction === 'left' && "-left-12 top-1/2 -translate-y-1/2",
      direction === 'right' && "-right-12 top-1/2 -translate-y-1/2"
    )}>
      <Icon className="w-8 h-8 text-blue-400" />
    </div>
  );
};

const ProgressDots: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="flex gap-1.5 justify-center">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={clsx(
          "w-2 h-2 rounded-full transition-all duration-300",
          i === current 
            ? "bg-blue-500 w-6" 
            : i < current 
              ? "bg-blue-500/50" 
              : "bg-slate-600"
        )}
      />
    ))}
  </div>
);

// Separate component to handle keyboard shortcuts - always rendered
const OnboardingKeyboardHandler: React.FC = () => {
  // Get actions from store (these are stable references)
  const resetOnboarding = useOnboardingStore(state => state.resetOnboarding);
  const startOnboarding = useOnboardingStore(state => state.startOnboarding);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ALT+O to reset and restart onboarding (for testing)
      if (e.altKey && (e.key.toLowerCase() === 'o' || e.code === 'KeyO')) {
        e.preventDefault();
        //console.log('[Onboarding] ALT+O pressed - resetting and starting onboarding');
        
        // Clear localStorage directly to ensure clean reset
        localStorage.removeItem('anakosmos-onboarding');
        //console.log('[Onboarding] Cleared localStorage');
        
        // Reset the store state
        resetOnboarding();
        //console.log('[Onboarding] Called resetOnboarding');
        
        // Force start after a brief delay
        setTimeout(() => {
          //console.log('[Onboarding] Starting onboarding after reset');
          startOnboarding();
        }, 150);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetOnboarding, startOnboarding]);
  
  return null;
};

// Auto-start hook
const useAutoStartOnboarding = () => {
  const { isActive, isCompleted, startOnboarding } = useOnboardingStore();
  const isSceneReady = useClusterStore(state => state.isSceneReady);
  
  useEffect(() => {
    // Auto-start onboarding for new users when scene is ready
    if (!isCompleted && isSceneReady && !isActive) {
      //console.log('[Onboarding] Auto-starting onboarding for new user');
      const timer = setTimeout(() => {
        startOnboarding();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, isSceneReady, isActive, startOnboarding]);
};

// Hook to sync demo resources with onboarding step
const useSyncDemoResources = () => {
  const { isActive, currentStep } = useOnboardingStore();
  const setDemoResourceLevel = useClusterStore(state => state.setDemoResourceLevel);
  const demoLevel = useDemoResourceLevel();
  
  useEffect(() => {
    // When onboarding is active, set demo resources based on current step
    if (isActive) {
      //console.log('[Onboarding] Setting demo resource level:', demoLevel, 'for step:', currentStep);
      // Small delay for smooth transitions
      const timer = setTimeout(() => {
        setDemoResourceLevel(demoLevel);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isActive, currentStep, demoLevel, setDemoResourceLevel]);
};

export const OnboardingTutorial: React.FC = () => {
  const { isActive, currentStep, nextStep, previousStep, skipOnboarding, completeOnboarding } = useOnboardingStore();
  const [showHighlight, setShowHighlight] = useState(false);

  // Auto-start for new users in demo mode
  useAutoStartOnboarding();
  
  // Sync demo resources with current step
  useSyncDemoResources();

  // Animate highlight appearance
  useEffect(() => {
    setShowHighlight(false);
    const timer = setTimeout(() => setShowHighlight(true), 100);
    return () => clearTimeout(timer);
  }, [currentStep]);

  // Always render keyboard handler, even when tutorial is not active
  if (!isActive) {
    return <OnboardingKeyboardHandler />;
  }

  const currentStepConfig = STEPS.find(s => s.id === currentStep);
  if (!currentStepConfig) return null;

  const currentIndex = STEPS.findIndex(s => s.id === currentStep);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      completeOnboarding();
    } else {
      nextStep();
    }
  };

  const handlePrevious = () => {
    previousStep();
  };

  const handleSkip = () => {
    skipOnboarding();
  };

  // Position classes for the popup
  const positionClasses = {
    'center': 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
    'top': 'left-1/2 top-24 -translate-x-1/2',
    'top-right': 'right-6 top-6',
    'bottom-left': 'left-80 bottom-32',
    'bottom-center': 'left-1/2 bottom-32 -translate-x-1/2',
    'left': 'left-80 top-1/2 -translate-y-1/2',
  };

  return (
    <>
      {/* Keyboard handler - always active */}
      <OnboardingKeyboardHandler />
      
      {/* Overlay */}
      <div 
        className={clsx(
          "fixed inset-0 z-40 transition-all duration-500",
          currentStepConfig.highlight ? "bg-black/40" : "bg-black/60"
        )}
      />

      {/* Highlight areas */}
      {showHighlight && currentStepConfig.highlight === 'topbar' && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 w-[445px] h-11 z-[45] ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent rounded-full animate-pulse pointer-events-none" />
      )}
      {showHighlight && currentStepConfig.highlight === 'legend' && (
        <div className="fixed bottom-14 left-4 w-72 h-[730px] z-[45] ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent rounded-xl animate-pulse pointer-events-none" />
      )}
      {showHighlight && currentStepConfig.highlight === 'viewselector' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[605px] h-[52px] z-[45] ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent rounded-full animate-pulse pointer-events-none" />
      )}

      {/* Tutorial Popup */}
      <div 
        className={clsx(
          "fixed z-50 animate-in fade-in zoom-in-95 duration-300",
          positionClasses[currentStepConfig.position]
        )}
      >
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-600/50 rounded-2xl shadow-2xl shadow-black/50 max-w-md w-96 overflow-hidden">
          
          {/* Glow effect */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
          
          {/* Arrow indicator */}
          {currentStepConfig.arrow && <ArrowIndicator direction={currentStepConfig.arrow} />}
          
          {/* Header */}
          <div className="relative p-6 pb-4">
            <button 
              onClick={handleSkip}
              className="absolute top-4 right-4 p-1 text-slate-500 hover:text-white transition-colors rounded-full hover:bg-slate-700/50"
              title="Skip tutorial"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-500/30">
                <currentStepConfig.icon size={24} />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  Step {currentIndex + 1} of {STEPS.length}
                </div>
                <h2 className="text-xl font-bold text-white">
                  {currentStepConfig.title}
                </h2>
              </div>
            </div>

            <p className="text-slate-300 leading-relaxed whitespace-pre-line">
              {currentStepConfig.description}
            </p>
          </div>

          {/* Progress & Actions */}
          <div className="relative px-6 pb-6 pt-2 flex flex-col gap-4">
            <ProgressDots current={currentIndex} total={STEPS.length} />
            
            <div className="flex gap-3">
              {!isFirst && (
                <button
                  onClick={handlePrevious}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-600/50"
                >
                  <ChevronLeft size={18} />
                  Back
                </button>
              )}
              
              <button
                onClick={handleNext}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all",
                  isLast 
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/30"
                )}
              >
                {isLast ? (
                  <>
                    <CheckCircle2 size={18} />
                    Start exploring
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </div>

            {isFirst && (
              <button
                onClick={handleSkip}
                className="text-center text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                I have already used Anakosmos, skip the tutorial
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
