import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  CreditCard,
  AlertTriangle,
  FileText,
  ExternalLink,
  CheckCircle,
  XCircle,
  HelpCircle,
  Lightbulb,
  ArrowLeft,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Textarea } from "@/components/ui/textarea";

interface ParsedExplanation {
  whatItMeans: string;
  whatToWatchFor: string;
  questionsToAsk: string;
}

function parseAIExplanation(text: string): ParsedExplanation | null {
  if (!text) return null;
  
  const sections: ParsedExplanation = {
    whatItMeans: '',
    whatToWatchFor: '',
    questionsToAsk: ''
  };
  
  const whatItMeansMatch = text.match(/What it means:?\s*\n([\s\S]*?)(?=\n\s*What to watch for:|$)/i);
  const whatToWatchForMatch = text.match(/What to watch for:?\s*\n([\s\S]*?)(?=\n\s*Questions to ask:|$)/i);
  const questionsToAskMatch = text.match(/Questions to ask:?\s*\n([\s\S]*?)$/i);
  
  if (whatItMeansMatch) {
    sections.whatItMeans = whatItMeansMatch[1].trim();
  }
  
  if (whatToWatchForMatch) {
    sections.whatToWatchFor = whatToWatchForMatch[1].trim();
  }
  
  if (questionsToAskMatch) {
    sections.questionsToAsk = questionsToAskMatch[1].trim();
  }
  
  if (sections.whatItMeans || sections.whatToWatchFor || sections.questionsToAsk) {
    return sections;
  }
  
  return null;
}

export default function Screening() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();
  const [trialExpired, setTrialExpired] = useState(false);
  
  // Check if URL has hash for criminal helper
  const hasHash = typeof window !== 'undefined' && window.location.hash === '#criminal-helper';
  
  // Scroll to criminal helper section on mount when hash is present
  useEffect(() => {
    if (hasHash || window.location.hash === '#criminal-helper') {
      const scrollToCriminal = () => {
        const criminalSection = document.getElementById('criminal-helper');
        if (criminalSection) {
          criminalSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return true;
        }
        return false;
      };
      
      // Retry multiple times to handle page load timing
      const timer1 = setTimeout(() => scrollToCriminal(), 200);
      const timer2 = setTimeout(() => scrollToCriminal(), 500);
      const timer3 = setTimeout(() => scrollToCriminal(), 1000);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [hasHash]);
  
  // Credit Report Helper state
  const [helperScreen, setHelperScreen] = useState<'home' | 'learn' | 'ask'>('home');
  const [userQuestion, setUserQuestion] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);

  // Criminal & Eviction Helper state
  const [criminalHelperScreen, setCriminalHelperScreen] = useState<'home' | 'learn' | 'ask'>('home');
  const [criminalUserQuestion, setCriminalUserQuestion] = useState('');
  const [criminalExplanation, setCriminalExplanation] = useState('');
  const [isCriminalExplaining, setIsCriminalExplaining] = useState(false);

  const handleExplain = async () => {
    const input = userQuestion.trim();
    
    if (!input) {
      setExplanation('Please type a word or phrase from your report first.');
      return;
    }

    setIsExplaining(true);
    setExplanation('');

    try {
      const response = await fetch('/api/explain-credit-term', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ term: input }),
        credentials: 'include',
      });

      if (response.status === 403) {
        setExplanation('Subscribe to use this AI helper');
        setHelperScreen('home');
        return;
      }

      const data = await response.json();
      setExplanation(data.explanation || 'Unable to get explanation. Please try again.');
    } catch (error) {
      console.error('Error getting explanation:', error);
      setExplanation('Something went wrong. Please try again in a moment.');
    } finally {
      setIsExplaining(false);
    }
  };

  const handleCriminalExplain = async () => {
    const input = criminalUserQuestion.trim();
    
    if (!input) {
      setCriminalExplanation('Please type a term or question first.');
      return;
    }

    setIsCriminalExplaining(true);
    setCriminalExplanation('');

    try {
      const response = await fetch('/api/explain-criminal-eviction-term', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ term: input }),
        credentials: 'include',
      });

      if (response.status === 403) {
        setCriminalExplanation('Subscribe to use this AI helper');
        setCriminalHelperScreen('home');
        return;
      }

      const data = await response.json();
      setCriminalExplanation(data.explanation || 'Unable to get explanation. Please try again.');
    } catch (error) {
      console.error('Error getting criminal/eviction explanation:', error);
      setCriminalExplanation('Something went wrong. Please try again in a moment.');
    } finally {
      setIsCriminalExplaining(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Check if trial expired by attempting to fetch templates
  useEffect(() => {
    const checkTrial = async () => {
      if (isAuthenticated) {
        try {
          const response = await fetch('/api/templates?stateId=UT', { credentials: 'include' });
          if (response.status === 403) {
            setTrialExpired(true);
          }
        } catch (error) {
          // Ignore errors, not fatal
        }
      }
    };
    checkTrial();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return null;

  // If trial expired, show only subscription CTA
  if (trialExpired) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <Card className="p-12 bg-primary/10 border-primary/20 max-w-md">
          <div className="text-center">
            <Search className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              Subscribe to receive updates
            </h2>
            <p className="text-muted-foreground mb-8">
              Get access to AI-powered screening helpers, legal templates, and real-time compliance updates
            </p>
            <Link to="/subscribe">
              <Button size="lg" data-testid="button-subscribe-screening-cta">
                Subscribe Now
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Screening Toolkit
          </h1>
          <p className="text-muted-foreground">
            Learn to read credit reports, spot red flags, and avoid costly screening mistakes
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div className="mb-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-foreground">
                <strong>Not Legal Advice:</strong> This screening guidance is educational only. You are responsible 
                for complying with Fair Housing laws, FCRA requirements, and all applicable screening regulations. 
                Consult an attorney if you have questions. <Link to="/disclaimers" className="text-primary hover:underline">Read full disclaimers</Link>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="mb-8 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/10 dark:to-transparent border border-primary/20 rounded-xl p-6" id="ai-helpers">
          <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            AI Screening Helpers - Quick Start
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-background/80 dark:bg-background/40 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Credit Report Helper</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Paste credit report sections or type terms like "charge-off" or "collection"
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => document.getElementById('credit-helper-input')?.focus()}
                data-testid="button-jump-to-credit"
              >
                Jump to Credit Helper
              </Button>
            </div>
            <div className="bg-background/80 dark:bg-background/40 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Criminal/Eviction Helper</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Paste criminal charges or type terms like "misdemeanor" or "eviction"
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => document.getElementById('criminal-helper-input')?.focus()}
                data-testid="button-jump-to-criminal"
              >
                Jump to Criminal Helper
              </Button>
            </div>
          </div>
        </div>

        {/* AI Credit Report Helper - Direct Input */}
        <div className="mb-8" data-section="credit-helper">
          <Card className="p-6 shadow-lg border-2 border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-primary/20 dark:bg-primary/30 w-12 h-12 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Credit Report AI Helper
                </h2>
                <p className="text-sm text-muted-foreground">
                  Paste credit info or type a term - get instant explanation
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto bg-primary/20 text-primary border-primary/30">
                <Lightbulb className="h-3 w-3 mr-1" />
                AI
              </Badge>
            </div>
            
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Examples:</strong> "charge-off" • "30 days late" • "collection" • paste a section of a credit report
                </p>
              </div>

              <Textarea
                id="credit-helper-input"
                placeholder="Paste credit report info here, or type a term like 'charge-off' or 'collection'"
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                className="min-h-[100px] text-base"
                data-testid="textarea-credit-question"
              />

              <Button 
                onClick={handleExplain}
                disabled={isExplaining || !userQuestion.trim()}
                className="w-full"
                size="lg"
                data-testid="button-get-credit-explanation"
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                {isExplaining ? 'Analyzing...' : 'Get AI Explanation'}
              </Button>

              {isExplaining && (
                <div className="bg-muted/50 border border-muted rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                    <p className="text-sm text-muted-foreground">Analyzing and preparing guidance...</p>
                  </div>
                </div>
              )}

              {!isExplaining && explanation && (() => {
                const parsed = parseAIExplanation(explanation);
                
                if (!parsed) {
                  return (
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-transparent border-2 border-primary/30 p-6 rounded-lg" data-testid="container-credit-explanation">
                      <div className="flex items-start gap-3 mb-4">
                        <Lightbulb className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground text-lg mb-3">Explanation</h4>
                          <div className="text-foreground whitespace-pre-wrap leading-relaxed" data-testid="text-credit-explanation">{explanation}</div>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-transparent border-2 border-primary/30 p-6 rounded-lg space-y-4" data-testid="container-credit-explanation">
                    {parsed.whatItMeans && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-foreground">What it means</h4>
                        </div>
                        <p className="text-foreground leading-relaxed ml-7" data-testid="text-credit-explanation">{parsed.whatItMeans}</p>
                      </div>
                    )}
                    
                    {parsed.whatToWatchFor && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                          <h4 className="font-semibold text-foreground">What to watch for</h4>
                        </div>
                        <p className="text-foreground leading-relaxed ml-7">{parsed.whatToWatchFor}</p>
                      </div>
                    )}
                    
                    {parsed.questionsToAsk && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <HelpCircle className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-foreground">Questions to ask</h4>
                        </div>
                        <div className="ml-7 text-foreground leading-relaxed whitespace-pre-wrap">{parsed.questionsToAsk}</div>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t border-primary/20">
                      <p className="text-xs text-muted-foreground">
                        This is educational guidance only, not legal advice. Always apply consistent criteria to all applicants.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Collapsible Learn Section */}
              <Accordion type="single" collapsible className="mt-4">
                <AccordionItem value="learn-credit" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline" data-testid="accordion-learn-credit">
                    <span className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4" />
                      Learn: Common Credit Report Terms
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid gap-3 text-sm">
                      <div className="flex gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div><strong>Credit Score (300-850):</strong> Higher is better. Shows overall creditworthiness.</div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div><strong>Payment History:</strong> Shows if bills were paid on time - most important factor.</div>
                      </div>
                      <div className="flex gap-2">
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div><strong>Collections:</strong> Unpaid accounts sent to collection agency - major red flag.</div>
                      </div>
                      <div className="flex gap-2">
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div><strong>Charge-off:</strong> Lender gave up collecting - severely hurts credit.</div>
                      </div>
                      <div className="flex gap-2">
                        <HelpCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div><strong>Utilization:</strong> % of credit limit used - under 30% is ideal.</div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </Card>
        </div>

        {/* AI Criminal/Eviction Helper - Direct Input */}
        <div className="mb-8" id="criminal-helper" data-section="criminal-helper">
          <Card className="p-6 shadow-lg border-2 border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-primary/20 dark:bg-primary/30 w-12 h-12 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Criminal & Eviction AI Helper
                </h2>
                <p className="text-sm text-muted-foreground">
                  Paste charges or type a term - get Fair Housing guidance
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto bg-primary/20 text-primary border-primary/30">
                <Lightbulb className="h-3 w-3 mr-1" />
                AI
              </Badge>
            </div>
            
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Examples:</strong> "misdemeanor" • "eviction" • paste a list of charges with dates • "felony DUI from 10 years ago"
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-foreground flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Privacy:</strong> Don't include SSNs or full names. Charge descriptions and dates are fine.</span>
                </p>
              </div>

              <Textarea
                id="criminal-helper-input"
                placeholder="Paste criminal/eviction records here, or type a term like 'misdemeanor' or 'eviction'"
                value={criminalUserQuestion}
                onChange={(e) => setCriminalUserQuestion(e.target.value)}
                className="min-h-[120px] text-base"
                data-testid="textarea-criminal-question"
              />

              <Button 
                onClick={handleCriminalExplain}
                disabled={isCriminalExplaining || !criminalUserQuestion.trim()}
                className="w-full"
                size="lg"
                data-testid="button-get-criminal-explanation"
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                {isCriminalExplaining ? 'Analyzing...' : 'Get AI Explanation'}
              </Button>

              {isCriminalExplaining && (
                <div className="bg-muted/50 border border-muted rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                    <p className="text-sm text-muted-foreground">Analyzing and preparing Fair Housing guidance...</p>
                  </div>
                </div>
              )}

              {!isCriminalExplaining && criminalExplanation && (() => {
                const parsed = parseAIExplanation(criminalExplanation);
                
                if (!parsed) {
                  return (
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-transparent border-2 border-primary/30 p-6 rounded-lg" data-testid="container-criminal-explanation">
                      <div className="flex items-start gap-3 mb-4">
                        <Lightbulb className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground text-lg mb-3">Explanation</h4>
                          <div className="text-foreground whitespace-pre-wrap leading-relaxed" data-testid="text-criminal-explanation">{criminalExplanation}</div>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-transparent border-2 border-primary/30 p-6 rounded-lg space-y-4" data-testid="container-criminal-explanation">
                    {parsed.whatItMeans && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-foreground">What it means</h4>
                        </div>
                        <p className="text-foreground leading-relaxed ml-7" data-testid="text-criminal-explanation">{parsed.whatItMeans}</p>
                      </div>
                    )}
                    
                    {parsed.whatToWatchFor && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                          <h4 className="font-semibold text-foreground">What to watch for</h4>
                        </div>
                        <p className="text-foreground leading-relaxed ml-7">{parsed.whatToWatchFor}</p>
                      </div>
                    )}
                    
                    {parsed.questionsToAsk && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <HelpCircle className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-foreground">Legal considerations</h4>
                        </div>
                        <div className="ml-7 text-foreground leading-relaxed whitespace-pre-wrap">{parsed.questionsToAsk}</div>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t border-primary/20">
                      <p className="text-xs text-muted-foreground">
                        This is educational guidance only, not legal advice. Fair Housing requires individualized assessment - never use blanket bans.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Collapsible Learn Section */}
              <Accordion type="single" collapsible className="mt-4">
                <AccordionItem value="learn-criminal" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline" data-testid="accordion-learn-criminal">
                    <span className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4" />
                      Learn: Criminal Screening Basics
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid gap-3 text-sm">
                      <div className="flex gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div><strong>No Blanket Bans:</strong> Fair Housing prohibits automatic denial for all criminal history.</div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div><strong>Individualized Assessment:</strong> Consider nature, severity, and how long ago.</div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div><strong>Consistent Criteria:</strong> Apply same standards to ALL applicants.</div>
                      </div>
                      <div className="flex gap-2">
                        <HelpCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div><strong>7-Year Rule:</strong> Many states limit how far back you can look.</div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div><strong>Evictions:</strong> Recent evictions (3 years) are more concerning than old ones.</div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </Card>
        </div>

        {/* Privacy Notice - Moved below helpers */}
        <div className="mb-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-foreground">
                <strong>Privacy Notice:</strong> We do not store or review your full reports. For safety, avoid typing Social Security numbers or full account numbers.
              </p>
            </div>
          </div>
        </div>

        {/* Credit Report Decoder */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <CreditCard className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-semibold text-foreground">
              Credit Report Decoder
            </h2>
          </div>

          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-lg mb-4">Sample TransUnion Report (Annotated)</h3>
            <p className="text-muted-foreground mb-6">
              Here's a realistic example with line-by-line explanations. Each section is color-coded to show what's good, concerning, or critical.
            </p>

            {/* Credit Score Section */}
            <div className="mb-8">
              <div className="bg-muted/30 p-4 rounded-lg border mb-3">
                <div className="font-mono text-sm space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-semibold">CREDIT SCORE: 685</span>
                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">Good</Badge>
                  </div>
                  <div className="text-muted-foreground">Report Date: 03/15/2024</div>
                </div>
              </div>
              <div className="text-sm space-y-2 pl-4 border-l-2 border-amber-500/30">
                <p><span className="font-semibold text-foreground">685 = GOOD range.</span> Acceptable for most landlords. This applicant generally pays bills on time but may have had minor past issues.</p>
                <p className="text-xs text-muted-foreground">Score ranges: 740+ (Excellent) • 670-739 (Good) • 580-669 (Fair) • Below 580 (Poor)</p>
              </div>
            </div>

            {/* Personal Information */}
            <div className="mb-8">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Personal Information
              </h4>
              <div className="bg-muted/30 p-4 rounded-lg border mb-3">
                <div className="font-mono text-xs space-y-1">
                  <div>NAME: JOHNSON, SARAH M</div>
                  <div>SSN: XXX-XX-5847</div>
                  <div>DOB: 08/12/1989</div>
                  <div>CURRENT ADDRESS: 1234 MAPLE ST, SALT LAKE CITY, UT 84101</div>
                  <div className="text-muted-foreground">Previous: 567 OAK AVE, PROVO, UT 84604 (2021-2023)</div>
                </div>
              </div>
              <div className="text-sm space-y-2 pl-4 border-l-2 border-success/30">
                <p><CheckCircle className="h-4 w-4 text-success inline mr-1" /><span className="font-semibold text-foreground">Verify this matches application.</span> Name, DOB, and SSN should match exactly. Address history helps confirm stability.</p>
              </div>
            </div>

            {/* Trade Lines - Good Example */}
            <div className="mb-8">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Trade Line Example (Good Account)
              </h4>
              <div className="bg-success/5 p-4 rounded-lg border border-success/20 mb-3">
                <div className="font-mono text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">CHASE BANK - CREDIT CARD</span>
                    <Badge className="bg-success/20 text-success">OPEN</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 mt-2">
                    <div>Account #: ****8234</div>
                    <div>Type: Revolving (R)</div>
                    <div>Opened: 01/2019</div>
                    <div>ECOA: Individual (I)</div>
                    <div>Credit Limit: $8,500</div>
                    <div>Balance: $1,240</div>
                    <div>Monthly Payment: $75</div>
                    <div>Status: Current</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-success/20">
                    <div className="text-xs">24-Month Payment History:</div>
                    <div className="font-bold tracking-wider">✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓</div>
                    <div className="text-muted-foreground text-xs">All payments on time (✓ = Current, 1 = 30 days late, 2 = 60 days, etc.)</div>
                  </div>
                </div>
              </div>
              <div className="text-sm space-y-2 pl-4 border-l-2 border-success/30">
                <p><CheckCircle className="h-4 w-4 text-success inline mr-1" /><span className="font-semibold text-foreground">Excellent account.</span> $1,240 balance on $8,500 limit = 15% utilization (healthy). Perfect 24-month payment history.</p>
                <p><span className="font-semibold text-foreground">ECOA "I" = Individual.</span> This is solely their account (not co-signed, not authorized user).</p>
                <p><span className="font-semibold text-foreground">5+ years open = Strong.</span> Long account history shows stability and experience managing credit.</p>
              </div>
            </div>

            {/* Trade Lines - Concerning Example */}
            <div className="mb-8">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                Trade Line Example (Concerning)
              </h4>
              <div className="bg-amber-500/5 p-4 rounded-lg border border-amber-500/20 mb-3">
                <div className="font-mono text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">CAPITAL ONE - CREDIT CARD</span>
                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">OPEN</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 mt-2">
                    <div>Account #: ****4521</div>
                    <div>Type: Revolving (R)</div>
                    <div>Opened: 06/2022</div>
                    <div>ECOA: Individual (I)</div>
                    <div>Credit Limit: $3,000</div>
                    <div className="text-amber-600 dark:text-amber-500 font-semibold">Balance: $2,850</div>
                    <div>Monthly Payment: $95</div>
                    <div>Status: Current</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-amber-500/20">
                    <div className="text-xs">24-Month Payment History:</div>
                    <div className="font-bold tracking-wider">✓✓✓✓✓1✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓</div>
                    <div className="text-amber-600 dark:text-amber-500 text-xs">One 30-day late payment 18 months ago</div>
                  </div>
                </div>
              </div>
              <div className="text-sm space-y-2 pl-4 border-l-2 border-amber-500/30">
                <p><HelpCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 inline mr-1" /><span className="font-semibold text-foreground">High utilization = Warning.</span> $2,850 on $3,000 limit = 95% utilization. This suggests tight cash flow.</p>
                <p><span className="font-semibold text-foreground">One late payment 18 months ago.</span> Not recent, but worth asking about. "I see a 30-day late from 2022. What happened?"</p>
                <p className="text-xs text-muted-foreground">Current status is good, but high balance raises concerns about ability to pay rent if financially stretched.</p>
              </div>
            </div>

            {/* Collections - Red Flag */}
            <div className="mb-8">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Collections Account (Red Flag)
              </h4>
              <div className="bg-destructive/5 p-4 rounded-lg border border-destructive/20 mb-3">
                <div className="font-mono text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">ABC COLLECTIONS (YXXXXX)</span>
                    <Badge variant="destructive">COLLECTION</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 mt-2">
                    <div>Original Creditor: COMCAST</div>
                    <div>Type: Collection</div>
                    <div>Date Opened: 09/2023</div>
                    <div>Date Verified: 02/2024</div>
                    <div>Original Amount: $487</div>
                    <div className="text-destructive font-semibold">Balance: $487</div>
                    <div className="col-span-2 text-destructive">Status: UNPAID</div>
                  </div>
                </div>
              </div>
              <div className="text-sm space-y-2 pl-4 border-l-2 border-destructive/30">
                <p><XCircle className="h-4 w-4 text-destructive inline mr-1" /><span className="font-semibold text-foreground">Unpaid collection = Major red flag.</span> Sent to collections 6 months ago, still unpaid. Shows unwillingness or inability to resolve debt.</p>
                <p><span className="font-semibold text-foreground">Subscriber code "Y" = Collection agency.</span> Original creditor was Comcast (likely cable/internet bill).</p>
                <p><span className="font-semibold text-foreground">Ask: "What's the status of this Comcast collection?"</span> Listen for payment plan, dispute, or explanation.</p>
                <p className="text-xs text-destructive">If they won't pay a $487 utility bill, will they pay $1,200 rent? Proceed with caution.</p>
              </div>
            </div>

            {/* Inquiries */}
            <div className="mb-8">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Recent Inquiries
              </h4>
              <div className="bg-muted/30 p-4 rounded-lg border mb-3">
                <div className="font-mono text-xs space-y-2">
                  <div className="font-semibold mb-2">HARD INQUIRIES (Last 12 Months):</div>
                  <div>03/10/2024 - PROGRESSIVE AUTO INS</div>
                  <div>01/22/2024 - WELLS FARGO AUTO</div>
                  <div>12/05/2023 - CAPITAL ONE BANK</div>
                  <div className="text-muted-foreground mt-3 pt-2 border-t">
                    SOFT INQUIRIES (Not shown to other lenders):
                  </div>
                  <div className="text-muted-foreground">Multiple pre-screening inquiries...</div>
                </div>
              </div>
              <div className="text-sm space-y-2 pl-4 border-l-2 border-primary/30">
                <p><span className="font-semibold text-foreground">3 hard inquiries = Normal.</span> Auto loan, credit card, and insurance. Not excessive shopping for credit.</p>
                <p><span className="font-semibold text-foreground">Soft inquiries don't matter.</span> These are pre-approvals and don't indicate they applied for credit.</p>
                <p className="text-xs text-muted-foreground">Watch for: 6+ hard inquiries in 6 months (desperate for credit) or inquiries from payday lenders (high-risk).</p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-primary/5 p-6 rounded-lg border border-primary/20">
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Overall Assessment
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div><span className="font-semibold text-foreground">Good:</span> 685 credit score, long payment history on Chase card, stable address</div>
                </div>
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                  <div><span className="font-semibold text-foreground">Concerning:</span> High utilization on Capital One (95%), one past late payment</div>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div><span className="font-semibold text-foreground">Red Flag:</span> Unpaid $487 Comcast collection from 6 months ago</div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="font-semibold text-foreground mb-2">Landlord Decision:</p>
                  <p className="text-muted-foreground">Marginal applicant. Before approving, ask about the collection and high credit card balance. Consider requiring larger security deposit or co-signer.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Criminal & Eviction Screening */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-semibold text-foreground">
              Criminal & Eviction Screening
            </h2>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Criminal Background Checks
              </h3>
              <p className="text-muted-foreground mb-4">
                Criminal screening is heavily regulated. Here's what you need to know:
              </p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Use Consistent Criteria:</strong> Apply
                    the same criminal screening standards to all applicants.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Consider Context:</strong> Look at
                    severity, how long ago, and relevance to tenancy (e.g., property-related crimes).
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Follow State Laws:</strong> Some states
                    limit how far back you can look or what convictions you can consider.
                  </div>
                </li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Eviction History
              </h3>
              <p className="text-muted-foreground mb-4">
                Past evictions are strong predictors of future problems, but verify the details:
              </p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Check Dates:</strong> Recent evictions
                    (within 3 years) are more concerning than older ones.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Ask for Context:</strong> Sometimes
                    evictions result from landlord disputes, not tenant fault.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Verify Outcomes:</strong> Was the
                    eviction completed or dismissed? Did they owe money?
                  </div>
                </li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Adverse Action */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <FileText className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-semibold text-foreground">
              Adverse Action Compliance
            </h2>
          </div>

          <Card className="p-6">
            <p className="text-muted-foreground mb-6">
              If you deny an applicant based on their credit, criminal, or eviction report, federal
              law requires you to provide an Adverse Action Notice within 3-5 business days.
            </p>

            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Required by Federal Law</h4>
                  <p className="text-sm text-muted-foreground">
                    Failing to provide proper adverse action notices can result in lawsuits and
                    penalties. Use our professional templates to help you stay compliant.
                  </p>
                </div>
              </div>
            </div>

            <Link to="/templates?category=screening">
              <Button variant="default" data-testid="button-adverse-action-template">
                <FileText className="mr-2 h-4 w-4" />
                Get Adverse Action Templates
              </Button>
            </Link>
          </Card>
        </div>

        {/* Western Verify CTA - Final Call to Action */}
        <div className="mt-12">
          <Card className="p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/20">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="rounded-xl bg-primary/10 dark:bg-primary/20 w-16 h-16 flex items-center justify-center flex-shrink-0">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-display font-semibold text-foreground mb-3">
                  Ready to Screen Your Next Tenant?
                </h3>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Now that you understand how to read screening reports and stay Fair Housing compliant, get professional tenant screening services through our partner{" "}
                  <a 
                    href="https://www.westernverify.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Western Verify
                  </a>
                  . Comprehensive credit, criminal, and eviction reports delivered quickly and compliantly.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    data-testid="button-western-verify"
                    onClick={() => window.open('https://www.westernverify.com', '_blank')}
                    size="lg"
                  >
                    <Search className="mr-2 h-5 w-5" />
                    Screen with Western Verify
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      const helpersSection = document.getElementById('ai-helpers');
                      if (helpersSection) {
                        helpersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    data-testid="button-back-to-top"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4 rotate-90" />
                    Back to AI Helpers
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
