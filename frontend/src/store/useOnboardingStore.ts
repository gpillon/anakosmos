import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Progressive onboarding steps - resources appear gradually
export type OnboardingStep = 
  | 'welcome'           // Welcome message
  | 'first-node'        // Show first node
  | 'first-pod'         // Show a single pod on the node
  | 'more-pods'         // Show multiple pods (explains replicas)
  | 'deployment'        // Show Deployment + ReplicaSet hierarchy
  | 'networking'        // Show Service connecting to pods
  | 'full-cluster'      // Show all resources, introduce complexity
  | 'topbar'            // Explain top bar UI
  | 'legend'            // Explain legend/filter sidebar
  | 'viewselector'      // Explain view selector
  | 'interactions'      // Explain mouse/keyboard interactions
  | 'complete';         // Tutorial complete

interface OnboardingStore {
  // Persisted
  isCompleted: boolean;
  
  // Session-only (UI state)
  isActive: boolean;
  currentStep: OnboardingStep;
  
  // Actions
  startOnboarding: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setStep: (step: OnboardingStep) => void;
}

const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'first-node',
  'first-pod',
  'more-pods',
  'deployment',
  'networking',
  'full-cluster',
  'topbar',
  'legend',
  'viewselector',
  'interactions',
  'complete'
];

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // Persisted state
      isCompleted: false,
      
      // Session state (not persisted)
      isActive: false,
      currentStep: 'welcome',
      
      startOnboarding: () => set({ 
        isActive: true, 
        currentStep: 'welcome' 
      }),
      
      nextStep: () => {
        const { currentStep } = get();
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        if (currentIndex < STEP_ORDER.length - 1) {
          const nextStep = STEP_ORDER[currentIndex + 1];
          set({ currentStep: nextStep });
          
          // Auto-complete when reaching the complete step
          if (nextStep === 'complete') {
            set({ isCompleted: true });
          }
        }
      },
      
      previousStep: () => {
        const { currentStep } = get();
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        if (currentIndex > 0) {
          set({ currentStep: STEP_ORDER[currentIndex - 1] });
        }
      },
      
      skipOnboarding: () => set({ 
        isActive: false, 
        isCompleted: true,
        currentStep: 'welcome'
      }),
      
      completeOnboarding: () => set({ 
        isActive: false, 
        isCompleted: true,
        currentStep: 'welcome'
      }),
      
      resetOnboarding: () => set({ 
        isCompleted: false,
        isActive: false,
        currentStep: 'welcome'
      }),
      
      setStep: (step) => set({ currentStep: step }),
    }),
    {
      name: 'anakosmos-onboarding',
      partialize: (state) => ({ 
        isCompleted: state.isCompleted,
      }),
    }
  )
);

// Helper hook to determine UI visibility based on onboarding step
export const useOnboardingVisibility = () => {
  const { isActive, currentStep, isCompleted } = useOnboardingStore();
  
  // If not in onboarding, show everything
  if (!isActive || isCompleted) {
    return {
      showTopBar: true,
      showLegend: true,
      showViewSelector: true,
      showStatusBar: true,
    };
  }
  
  // Progressive reveal based on step
  const stepIndex = STEP_ORDER.indexOf(currentStep);
  
  return {
    showTopBar: stepIndex >= STEP_ORDER.indexOf('topbar'),
    showLegend: stepIndex >= STEP_ORDER.indexOf('legend'),
    showViewSelector: stepIndex >= STEP_ORDER.indexOf('viewselector'),
    showStatusBar: true, // Always show minimal status
  };
};

// Helper to determine which demo resources should be visible based on onboarding step
export type DemoResourceLevel = 
  | 'none'           // No resources
  | 'node'           // Just nodes
  | 'single-pod'     // Node + 1 pod
  | 'multi-pods'     // Node + multiple pods
  | 'workloads'      // Node + pods + deployment + replicaset
  | 'networking'     // All above + service + ingress
  | 'full';          // Everything

export const useDemoResourceLevel = (): DemoResourceLevel => {
  const { isActive, currentStep } = useOnboardingStore();
  
  if (!isActive) return 'full';
  
  switch (currentStep) {
    case 'welcome':
      return 'none';
    case 'first-node':
      return 'node';
    case 'first-pod':
      return 'single-pod';
    case 'more-pods':
      return 'multi-pods';
    case 'deployment':
      return 'workloads';
    case 'networking':
      return 'networking';
    case 'full-cluster':
    case 'topbar':
    case 'legend':
    case 'viewselector':
    case 'interactions':
    case 'complete':
    default:
      return 'full';
  }
};

// Export step order for external use
export { STEP_ORDER };
