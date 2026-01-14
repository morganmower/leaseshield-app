import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Shield, 
  Search, 
  MessageCircle,
  CheckCircle2,
  Sparkles,
  LayoutDashboard,
  FolderOpen,
  Building2,
  AlertCircle,
  BookOpen,
  DollarSign,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const slides = [
  {
    id: 1,
    title: "How LeaseShield Works",
    subtitle: "A simple workflow for applications, screening, and compliant documents.",
    icon: LayoutDashboard,
    color: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    points: [
      "LeaseShield is the control center for your rental workflow"
    ]
  },
  {
    id: 2,
    title: "One Workflow. Clear Roles.",
    subtitle: "LeaseShield manages the workflow. Western Verify performs the screening.",
    icon: Shield,
    color: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    points: [
      "LeaseShield manages the workflow",
      "Western Verify performs the screening"
    ]
  },
  {
    id: 3,
    title: "Everything Starts With a Property",
    subtitle: "Properties organize applications, screening, and documents by location.",
    icon: Building2,
    color: "from-emerald-500/20 to-emerald-500/10",
    iconColor: "text-emerald-500",
    points: [
      "Applications",
      "Screening",
      "Documents"
    ]
  },
  {
    id: 4,
    title: "Send One Application Link",
    subtitle: "Send one link to the applicant. Screening runs through Western Verify.",
    icon: ClipboardList,
    color: "from-emerald-500/20 to-emerald-500/10",
    iconColor: "text-emerald-500",
    points: [
      "Applicant completes application",
      "Authorization captured",
      "Screening runs through Western Verify",
      "Status tracked in LeaseShield"
    ]
  },
  {
    id: 5,
    title: "Understand Screening Results",
    subtitle: "The Screening Decoder explains what matters and helps prevent misinterpretation.",
    icon: Search,
    color: "from-cyan-500/20 to-cyan-500/10",
    iconColor: "text-cyan-500",
    points: [
      "Explains what matters",
      "Flags common risk areas",
      "Helps prevent misinterpretation"
    ]
  },
  {
    id: 6,
    title: "Use the Right Document When You Act",
    subtitle: "LeaseShield provides state-specific leases and notices updated as laws change.",
    icon: FileText,
    color: "from-amber-500/20 to-amber-500/10",
    iconColor: "text-amber-500",
    points: [
      "State-specific leases",
      "Notices and checklists",
      "Updated as legislation changes"
    ]
  },
  {
    id: 7,
    title: "Start Where You're Comfortable",
    subtitle: "Add a property or create your first application to begin.",
    icon: Play,
    color: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    points: [
      "If you're not sure where to begin, start by adding a property or creating your first application"
    ]
  }
];

export function OnboardingVideoModal({ isOpen, onClose }: OnboardingVideoModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('leaseshield_video_seen', 'true');
    setCurrentSlide(0);
    onClose();
  };

  const handleClose = () => {
    localStorage.setItem('leaseshield_video_seen', 'true');
    setCurrentSlide(0);
    onClose();
  };

  if (!isOpen) return null;

  const slide = slides[currentSlide];
  const SlideIcon = slide.icon;
  const isLastSlide = currentSlide === slides.length - 1;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden" data-testid="modal-onboarding-video">
        <VisuallyHidden>
          <DialogTitle>How LeaseShield Works (90 seconds)</DialogTitle>
        </VisuallyHidden>
        <div className="relative">
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <Badge variant="outline" className="text-xs">
                <Play className="h-3 w-3 mr-1" />
                90 seconds
              </Badge>
              <div className="flex items-center gap-1">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setDirection(idx > currentSlide ? 1 : -1);
                      setCurrentSlide(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentSlide 
                        ? 'bg-primary w-6' 
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                    data-testid={`button-slide-${idx}`}
                    title={slides[idx].title}
                  />
                ))}
              </div>
            </div>

            <div className="relative min-h-[340px]">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={currentSlide}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 }
                  }}
                  className="w-full"
                >
                  <div className="text-center mb-5">
                    <motion.div 
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${slide.color} flex items-center justify-center mx-auto mb-3`}
                      initial={{ scale: 0.8, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.1, type: "spring" }}
                    >
                      <SlideIcon className={`h-8 w-8 ${slide.iconColor}`} />
                    </motion.div>
                    <motion.h2 
                      className="text-xl font-display font-semibold text-foreground mb-1"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      {slide.title}
                    </motion.h2>
                    <motion.p 
                      className="text-sm text-muted-foreground"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      {slide.subtitle}
                    </motion.p>
                  </div>

                  <motion.div 
                    className="space-y-2 max-w-sm mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    {slide.points.map((point, idx) => (
                      <motion.div
                        key={idx}
                        className="flex items-center gap-3 bg-muted/50 rounded-lg p-3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + idx * 0.1 }}
                      >
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm text-foreground">{point}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={handlePrev}
                disabled={currentSlide === 0}
                className="gap-1"
                data-testid="button-prev-slide"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>

              <span className="text-sm text-muted-foreground">
                {currentSlide + 1} of {slides.length}
              </span>

              {isLastSlide ? (
                <Button 
                  onClick={handleComplete}
                  className="gap-1"
                  data-testid="button-complete-guide"
                >
                  Get Started
                  <Play className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  onClick={handleNext}
                  className="gap-1"
                  data-testid="button-next-slide"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
