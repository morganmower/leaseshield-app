import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, X, Clock, CheckCircle2 } from 'lucide-react';

interface OnboardingVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingVideoModal({ isOpen, onClose }: OnboardingVideoModalProps) {
  const [showVideo, setShowVideo] = useState(false);

  const handleStartVideo = () => {
    setShowVideo(true);
  };

  const handleSkip = () => {
    localStorage.setItem('leaseshield_video_seen', 'true');
    onClose();
  };

  const handleComplete = () => {
    localStorage.setItem('leaseshield_video_seen', 'true');
    onClose();
  };

  const handleClose = () => {
    localStorage.setItem('leaseshield_video_seen', 'true');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden" data-testid="modal-onboarding-video">
        <div className="relative">
          {!showVideo ? (
            <div className="p-6 sm:p-8">
              <DialogHeader className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default" className="bg-primary">
                    <Clock className="h-3 w-3 mr-1" />
                    3 min
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-display">
                  Quick Setup Guide
                </DialogTitle>
                <p className="text-muted-foreground mt-2">
                  Learn how to protect your rentals in under 3 minutes
                </p>
              </DialogHeader>

              <div 
                className="relative aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg overflow-hidden mb-6 cursor-pointer group"
                onClick={handleStartVideo}
                data-testid="button-play-video"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="h-8 w-8 text-primary-foreground ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-background/90 backdrop-blur-sm rounded-lg p-3">
                    <p className="font-medium text-sm">What you'll learn:</p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                      <li className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        Navigate the dashboard
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        Download your first template
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        Use AI tools for screening
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleStartVideo} 
                  className="flex-1"
                  size="lg"
                  data-testid="button-watch-video"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Watch Quick Guide
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleSkip}
                  size="lg"
                  data-testid="button-skip-video"
                >
                  Skip for now
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm"
                onClick={handleComplete}
                data-testid="button-close-video"
              >
                <X className="h-4 w-4" />
              </Button>
              
              <div className="aspect-video bg-black">
                <div className="w-full h-full flex flex-col items-center justify-center text-white p-8">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Video Coming Soon</h3>
                    <p className="text-gray-400 text-sm mb-6">
                      We're creating a helpful walkthrough video. In the meantime, use the interactive tour!
                    </p>
                    <Button onClick={handleComplete} variant="secondary">
                      Got it, let's explore!
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
