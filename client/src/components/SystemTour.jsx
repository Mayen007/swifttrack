import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  Bike,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  LayoutDashboard,
  MapPin,
  Package,
  PanelLeft,
  ScanBarcode,
  Truck,
  X,
} from 'lucide-react';

const WORKSPACE_BY_ROLE = {
  SUPER_ADMIN: {
    title: 'Executive Command Center',
    icon: LayoutDashboard,
    detail: 'Company-wide visibility across branches, performance, and operations.',
  },
  BRANCH_MANAGER: {
    title: 'Executive Command Center',
    icon: LayoutDashboard,
    detail: 'Your branch performance, approvals, and daily operations in one place.',
  },
  DISPATCHER: {
    title: 'Operations Control Tower',
    icon: Activity,
    detail: 'Coordinate dispatch, monitor deliveries, and respond to live exceptions.',
  },
  CASHIER: {
    title: 'Parcel Intake & Waybills',
    icon: Package,
    detail: 'Book parcels, prepare waybills, and keep counter service moving.',
  },
  DRIVER: {
    title: 'Courier Driver Portal',
    icon: Bike,
    detail: 'Follow assigned deliveries and capture proof of delivery from the road.',
  },
};

const FIRST_TASK_BY_ROLE = {
  SUPER_ADMIN: {
    title: 'Set up your first branch.',
    description: 'Add a real operating branch before staff begin booking or processing parcels.',
    actionLabel: 'Open branch setup',
    view: 'branches',
    icon: Building2,
  },
  BRANCH_MANAGER: {
    title: 'Review your branch operations.',
    description: 'Start with live exceptions and work moving through your branch.',
    actionLabel: 'Open operations',
    view: 'control-tower',
    icon: Activity,
  },
  DISPATCHER: {
    title: 'Review live operations.',
    description: 'Check the control tower for work that needs dispatch or intervention.',
    actionLabel: 'Open control tower',
    view: 'control-tower',
    icon: Activity,
  },
  CASHIER: {
    title: 'Book your first parcel.',
    description: 'Open the counter terminal to create a waybill and accept payment.',
    actionLabel: 'Open parcel intake',
    view: 'pos',
    icon: ScanBarcode,
  },
  DRIVER: {
    title: 'Review your assigned deliveries.',
    description: 'Open your driver portal to see assigned work and capture proof of delivery.',
    actionLabel: 'Open driver portal',
    view: 'driver',
    icon: Bike,
  },
};

export function SystemTour({ isOpen, user, selectedBranch, onClose, onNavigate }) {
  const [stepIndex, setStepIndex] = useState(0);
  const closeButtonRef = useRef(null);
  const role = user?.role || 'SUPER_ADMIN';
  const workspace = WORKSPACE_BY_ROLE[role] || WORKSPACE_BY_ROLE.SUPER_ADMIN;
  const firstTask = FIRST_TASK_BY_ROLE[role] || FIRST_TASK_BY_ROLE.SUPER_ADMIN;
  const WorkspaceIcon = workspace.icon;
  const branchDescription = role === 'SUPER_ADMIN'
    ? 'Use the branch selector in the top bar to focus on a hub or review all Kenya hubs.'
    : `Your account is assigned to ${selectedBranch?.name || 'your operating branch'}. Your access stays within that branch.`;

  const steps = [
    {
      eyebrow: 'YOUR FIRST SHIFT',
      title: `Welcome${user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}.`,
      description: 'SwiftTrack brings parcel intake, branch operations, delivery, and reconciliation into one workspace.',
      icon: Compass,
    },
    {
      eyebrow: 'START HERE',
      title: workspace.title,
      description: workspace.detail,
      icon: WorkspaceIcon,
    },
    {
      eyebrow: 'GET AROUND',
      title: 'Your tools live in the side rail.',
      description: 'Open the navigation on the left to move between the modules available to your role. Your workspace is always one click away.',
      icon: PanelLeft,
    },
    {
      eyebrow: 'STAY IN CONTEXT',
      title: 'Work in the right branch.',
      description: branchDescription,
      icon: role === 'SUPER_ADMIN' ? MapPin : Truck,
    },
    {
      eyebrow: 'KEEP IN THE LOOP',
      title: 'Watch for updates and alerts.',
      description: 'The bell in the top bar collects operational notifications. Reopen this tour any time from your profile menu.',
      icon: Bell,
    },
    {
      eyebrow: 'YOUR FIRST TASK',
      title: firstTask.title,
      description: firstTask.description,
      icon: firstTask.icon,
      actionLabel: firstTask.actionLabel,
      view: firstTask.view,
    },
  ];

  useEffect(() => {
    if (!isOpen) return undefined;

    setStepIndex(0);
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      if (event.key === 'ArrowLeft') setStepIndex((current) => Math.max(current - 1, 0));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, steps.length]);

  if (!isOpen) return null;

  const currentStep = steps[stepIndex];
  const StepIcon = currentStep.icon;
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#05070b]/80 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="system-tour-title"
        aria-modal="true"
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-[#30394a] bg-[#0e121a] text-slate-200 shadow-[0_32px_100px_rgba(0,0,0,0.7)]"
        role="dialog"
      >
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative grid md:grid-cols-[0.9fr_1.1fr]">
          <div className="flex min-h-56 flex-col justify-between border-b border-[#252d3b] bg-[#111722]/90 p-6 md:min-h-[390px] md:border-b-0 md:border-r md:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-amber-300">
                <Compass className="h-4 w-4" />
                SwiftTrack / Briefing
              </div>
              <button
                aria-label="Close system tour"
                className="rounded-md p-2 text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                onClick={onClose}
                ref={closeButtonRef}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-10 md:mt-0">
              <div className="mb-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                <span>FIELD GUIDE</span>
                <span className="h-px w-7 bg-amber-400/60" />
                <span>{String(stepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
              </div>
              <p className="max-w-xs text-3xl font-semibold leading-tight tracking-tight text-white md:text-[2.4rem]">
                Every parcel. Every branch. In motion.
              </p>
            </div>

            <div className="mt-8 flex items-center gap-2" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
              {steps.map((step, index) => (
                <span
                  aria-current={index === stepIndex ? 'step' : undefined}
                  className={`h-1 rounded-full transition-all ${index === stepIndex ? 'w-9 bg-amber-400' : 'w-4 bg-slate-700'}`}
                  key={step.eyebrow}
                />
              ))}
            </div>
          </div>

          <div aria-live="polite" className="flex flex-col justify-between p-6 md:p-8">
            <div>
              <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-400/10 text-amber-300">
                <StepIcon className="h-5 w-5" />
              </div>
              <p className="mb-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-amber-300">
                {currentStep.eyebrow}
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-white" id="system-tour-title">
                {currentStep.title}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                {currentStep.description}
              </p>

              {stepIndex === 1 && (
                <div className="mt-6 flex items-center gap-3 rounded-lg border border-[#293344] bg-[#121924] p-3">
                  <WorkspaceIcon className="h-4 w-4 shrink-0 text-amber-300" />
                  <span className="text-xs font-medium text-slate-200">{workspace.title}</span>
                  <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-slate-500">{role.replace('_', ' ')}</span>
                </div>
              )}

              {stepIndex === 3 && selectedBranch && (
                <div className="mt-6 flex items-center gap-3 rounded-lg border border-[#293344] bg-[#121924] p-3">
                  <MapPin className="h-4 w-4 shrink-0 text-amber-300" />
                  <span className="truncate text-xs font-medium text-slate-200">{selectedBranch.name}</span>
                  <span className="ml-auto shrink-0 text-[9px] font-mono uppercase tracking-wider text-slate-500">{selectedBranch.code}</span>
                </div>
              )}
            </div>

            <div className="mt-10 flex items-center justify-between gap-3 border-t border-[#252d3b] pt-5">
              <button
                className="text-xs font-medium text-slate-500 transition hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                onClick={onClose}
                type="button"
              >
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <button
                    aria-label="Previous tour step"
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-[#30394a] text-slate-300 transition hover:border-slate-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                    onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
                    type="button"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-amber-400 px-4 text-xs font-bold text-[#17140d] transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  onClick={() => {
                    if (isLastStep) {
                      onClose();
                      if (currentStep.view) onNavigate?.(currentStep.view);
                    }
                    else setStepIndex((current) => Math.min(current + 1, steps.length - 1));
                  }}
                  type="button"
                >
                  {isLastStep ? (
                    <>
                      {currentStep.actionLabel} <Check className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
