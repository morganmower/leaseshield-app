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
  Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const slides = [
  {
    id: 1,
    title: "Welcome to LeaseShield",
    subtitle: "Your rental protection starts here",
    icon: Home,
    color: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    points: [
      "State-specific legal templates",
      "Real-time compliance updates", 
      "AI-powered assistance"
    ]
  },
  {
    id: 2,
    title: "Legal Templates",
    subtitle: "Professional documents in seconds",
    icon: FileText,
    color: "from-emerald-500/20 to-emerald-500/10",
    iconColor: "text-emerald-500",
    points: [
      "Lease agreements customized for your state",
      "Eviction notices with proper legal language",
      "Move-in/out checklists to protect deposits"
    ]
  },
  {
    id: 3,
    title: "Compliance Cards",
    subtitle: "Know your state's laws",
    icon: Shield,
    color: "from-amber-500/20 to-amber-500/10", 
    iconColor: "text-amber-500",
    points: [
      "Security deposit rules and limits",
      "Required disclosures for your state",
      "Eviction procedures step-by-step"
    ]
  },
  {
    id: 4,
    title: "Tenant Screening",
    subtitle: "Find great tenants safely",
    icon: Search,
    color: "from-purple-500/20 to-purple-500/10",
    iconColor: "text-purple-500",
    points: [
      "Credit report decoder explains terms",
      "Fair Housing compliance guidance",
      "Western Verify integration for reports"
    ]
  },
  {
    id: 5,
    title: "AI Assistant",
    subtitle: "Get answers instantly",
    icon: MessageCircle,
    color: "from-blue-500/20 to-blue-500/10",
    iconColor: "text-blue-500",
    points: [
      "Ask any landlord-tenant question",
      "Available 24/7 in the chat widget",
      "Trained on your state's specific laws"
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
          <DialogTitle>Quick Setup Guide</DialogTitle>
        </VisuallyHidden>
        <div className="relative">
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <Badge variant="outline" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Quick Guide
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
