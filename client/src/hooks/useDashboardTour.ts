import { useEffect, useRef, useCallback } from 'react';
import type Shepherd from 'shepherd.js';

export const useDashboardTour = (shouldShow: boolean) => {
  const tourRef = useRef<Shepherd.Tour | null>(null);

  const startTour = useCallback(() => {
    // Dynamically import Shepherd
    import('shepherd.js').then(({ default: ShepherdClass }) => {
      // Detect mobile for positioning adjustments
      const isMobile = window.innerWidth < 768;
      
      // Create tour instance
      const tour = new ShepherdClass.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          classes: 'shepherd-theme-custom shepherd-step-animated',
          scrollTo: { behavior: 'smooth', block: 'center' },
          cancelIcon: {
            enabled: true,
          },
          // Better positioning for mobile
          popoverClass: isMobile ? 'shepherd-popover-mobile' : '',
        },
      });

      // Step 1: Welcome
      tour.addStep({
        id: 'welcome',
        title: 'Welcome to LeaseShield App',
        text: 'Let\'s take a quick tour of your landlord protection toolkit (60 seconds)',
        buttons: [
          {
            action: tour.next,
            text: 'Start Tour',
            classes: 'shepherd-button-primary',
          },
          {
            action: tour.cancel,
            text: 'Skip',
            classes: 'shepherd-button-secondary',
          },
        ],
        attachTo: {
          element: 'body',
          on: 'center',
        },
      });

      // Step 2: AI Protection Center
      tour.addStep({
        id: 'ai-protection',
        title: '🤖 AI Protection Center',
        text: 'Three powerful AI tools: understand credit reports, get screening guidance, and chat with a 24/7 AI assistant for landlord questions',
        buttons: [
          {
            action: tour.next,
            text: 'Next',
            classes: 'shepherd-button-primary',
          },
          {
            action: tour.back,
            text: 'Back',
            classes: 'shepherd-button-secondary',
          },
        ],
        attachTo: {
          element: '[data-testid="section-ai-protection-center"]',
          on: 'bottom',
        },
      });

      // Step 3: Complete Toolkit
      tour.addStep({
        id: 'complete-toolkit',
        title: '🛠️ Your Complete Toolkit',
        text: 'Everything organized for you: Document Assembly Wizard, Legislative Monitoring, Property Management, and more',
        buttons: [
          {
            action: tour.next,
            text: 'Next',
            classes: 'shepherd-button-primary',
          },
          {
            action: tour.back,
            text: 'Back',
            classes: 'shepherd-button-secondary',
          },
        ],
        attachTo: {
          element: '[data-testid="card-document-wizard"]',
          on: 'bottom',
        },
      });

      // Step 4: Quick Access Toolkits
      tour.addStep({
        id: 'quick-access',
        title: '⚡ Quick Access Toolkits',
        text: 'Fast shortcuts to the three most-used features: Leasing, Screening, and Compliance templates',
        buttons: [
          {
            action: tour.next,
            text: 'Next',
            classes: 'shepherd-button-primary',
          },
          {
            action: tour.back,
            text: 'Back',
            classes: 'shepherd-button-secondary',
          },
        ],
        attachTo: {
          element: '[data-testid="card-leasing-toolkit"]',
          on: 'bottom',
        },
      });

      // Step 5: Legal Updates
      tour.addStep({
        id: 'legal-updates',
        title: '📋 Recent Compliance Updates',
        text: 'Stay compliant: view the latest law changes for your state, automatically monitored each month',
        buttons: [
          {
            action: tour.complete,
            text: 'Got It! Start Exploring',
            classes: 'shepherd-button-primary',
          },
          {
            action: tour.back,
            text: 'Back',
            classes: 'shepherd-button-secondary',
          },
        ],
        attachTo: {
          element: '[data-testid="card-recent-updates"]',
          on: 'top',
        },
      });

      tourRef.current = tour;
      tour.start();
    });
  }, []);

  useEffect(() => {
    if (shouldShow) {
      startTour();
    }

    return () => {
      if (tourRef.current) {
        tourRef.current.cancel();
      }
    };
  }, [shouldShow, startTour]);

  const restartTour = () => {
    startTour();
  };

  return { restartTour };
};
