import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAccessToken, apiRequest } from "@/lib/queryClient";
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
  Scale,
  ClipboardCheck,
  Copy,
  Users,
  Info,
  MessageSquare,
  Lock,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Textarea } from "@/components/ui/textarea";

interface DecoderSection {
  id: string;
  title: string;
  content: string;
  icon: 'info' | 'scale' | 'alert' | 'users' | 'check' | 'copy' | 'questions';
  alwaysVisible: boolean;
}

interface ParsedDecoder {
  alwaysVisible: DecoderSection[];
  collapsible: DecoderSection[];
}

function parseNewDecoderFormat(text: string): ParsedDecoder | null {
  if (!text) return null;
  
  const sectionPatterns = [
    { pattern: /\*\*WHAT THIS MEANS\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'meaning', title: 'What This Means', icon: 'info' as const, alwaysVisible: true },
    { pattern: /\*\*HOW LANDLORDS TYPICALLY WEIGH THIS\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'weighting', title: 'How Landlords Typically Weigh This', icon: 'scale' as const, alwaysVisible: true },
    { pattern: /\*\*HOW THIS IS COMMONLY EVALUATED\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'weighting', title: 'How This Is Commonly Evaluated', icon: 'scale' as const, alwaysVisible: true },
    { pattern: /\*\*WHAT THIS DOES NOT MEAN\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'not-mean', title: 'What This Does NOT Mean', icon: 'alert' as const, alwaysVisible: true },
    { pattern: /\*\*STATE-SPECIFIC NOTES\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'state-notes', title: 'State-Specific Notes', icon: 'info' as const, alwaysVisible: false },
    { pattern: /\*\*COMMON SCREENING APPROACHES\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'approaches', title: 'Common Screening Approaches', icon: 'users' as const, alwaysVisible: false },
    { pattern: /\*\*CONSISTENCY CHECK\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'consistency', title: 'Consistency Check (Fair Housing)', icon: 'check' as const, alwaysVisible: false },
    { pattern: /\*\*DOCUMENTATION HELPER\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'documentation', title: 'Documentation Helper', icon: 'copy' as const, alwaysVisible: false },
    { pattern: /\*\*OPTIONAL FOLLOW-UP QUESTIONS\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'questions', title: 'Optional Follow-Up Questions', icon: 'questions' as const, alwaysVisible: false },
  ];
  
  const alwaysVisible: DecoderSection[] = [];
  const collapsible: DecoderSection[] = [];
  
  for (const { pattern, id, title, icon, alwaysVisible: isVisible } of sectionPatterns) {
    const match = text.match(pattern);
    if (match && match[1].trim()) {
      const section = { id, title, content: match[1].trim(), icon, alwaysVisible: isVisible };
      if (isVisible) {
        alwaysVisible.push(section);
      } else {
        collapsible.push(section);
      }
    }
  }
  
  return (alwaysVisible.length > 0 || collapsible.length > 0) ? { alwaysVisible, collapsible } : null;
}

function parseLegacyFormat(text: string): DecoderSection[] | null {
  if (!text) return null;
  
  const sections: DecoderSection[] = [];
  
  const legacyPatterns = [
    { pattern: /\*\*WHAT THIS MEANS\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'meaning', title: 'What This Means', icon: 'info' as const },
    { pattern: /\*\*YOUR LIABILITY AS A LANDLORD\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'liability', title: 'Your Liability as a Landlord', icon: 'alert' as const },
    { pattern: /\*\*RED FLAGS TO WATCH FOR\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'flags', title: 'Red Flags to Watch For', icon: 'alert' as const },
    { pattern: /\*\*FCRA & FAIR HOUSING COMPLIANCE\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'compliance', title: 'FCRA & Fair Housing Compliance', icon: 'check' as const },
    { pattern: /\*\*FAIR HOUSING & HUD REQUIREMENTS\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'fairhousing', title: 'Fair Housing & HUD Requirements', icon: 'check' as const },
    { pattern: /\*\*QUESTIONS TO ASK THE APPLICANT\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'questions', title: 'Questions to Ask the Applicant', icon: 'questions' as const },
    { pattern: /\*\*STEPS TO PROTECT YOURSELF\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i, id: 'protection', title: 'Steps to Protect Yourself', icon: 'users' as const },
  ];
  
  for (const { pattern, id, title, icon } of legacyPatterns) {
    const match = text.match(pattern);
    if (match && match[1].trim()) {
      sections.push({ id, title, content: match[1].trim(), icon, alwaysVisible: true });
    }
  }
  
  return sections.length > 0 ? sections : null;
}

function getAccordionState(key: string): string[] {
  try {
    const stored = localStorage.getItem(`decoder-accordion-${key}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setAccordionState(key: string, value: string[]) {
  try {
    localStorage.setItem(`decoder-accordion-${key}`, JSON.stringify(value));
  } catch {
    // Ignore localStorage errors
  }
}

function formatContent(content: string): JSX.Element {
  const lines = content.split('\n').filter(line => line.trim());
  
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <span className="text-primary mt-1.5 text-xs">•</span>
              <span>{trimmed.replace(/^[•-]\s*/, '')}</span>
            </div>
          );
        }
        if (/^\d+\./.test(trimmed)) {
          const num = trimmed.match(/^(\d+)\./)?.[1];
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <span className="text-primary font-semibold min-w-[20px]">{num}.</span>
              <span className="italic">{trimmed.replace(/^\d+\.\s*/, '').replace(/^[""]|[""]$/g, '')}</span>
            </div>
          );
        }
        return <p key={i}>{trimmed}</p>;
      })}
    </div>
  );
}

function getSectionIcon(iconType: DecoderSection['icon']) {
  const iconClass = "h-5 w-5";
  switch (iconType) {
    case 'info': return <Info className={`${iconClass} text-primary`} />;
    case 'scale': return <Scale className={`${iconClass} text-primary`} />;
    case 'alert': return <AlertTriangle className={`${iconClass} text-amber-600`} />;
    case 'users': return <Users className={`${iconClass} text-primary`} />;
    case 'check': return <ClipboardCheck className={`${iconClass} text-success`} />;
    case 'copy': return <Copy className={`${iconClass} text-primary`} />;
    case 'questions': return <MessageSquare className={`${iconClass} text-primary`} />;
    default: return <FileText className={`${iconClass} text-primary`} />;
  }
}

function getSectionBg(iconType: DecoderSection['icon']) {
  switch (iconType) {
    case 'alert': return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';
    case 'check': return 'bg-success/5 border-success/20';
    default: return 'bg-muted/30 border-muted';
  }
}

interface StateNoteData {
  title: string;
  bullets: string[];
  sourceLinks: string[];
}

interface DecoderDisplayProps {
  explanation: string;
  decoderType: 'credit' | 'criminal';
  userState?: string | null;
  userStateName?: string | null;
  stateNote?: StateNoteData | null;
  fallbackText?: string | null;
}

function DecoderDisplay({ explanation, decoderType, userState, userStateName, stateNote, fallbackText }: DecoderDisplayProps) {
  const { toast } = useToast();
  const parsed = parseNewDecoderFormat(explanation);
  const legacy = parsed ? null : parseLegacyFormat(explanation);
  
  const [openSections, setOpenSections] = useState<string[]>(() => 
    getAccordionState(decoderType)
  );

  const handleAccordionChange = (value: string[]) => {
    setOpenSections(value);
    setAccordionState(decoderType, value);
  };

  const handleCopyDocumentation = (content: string) => {
    const match = content.match(/"([^"]+)"/);
    const textToCopy = match ? match[1] : content;
    navigator.clipboard.writeText(textToCopy);
    toast({
      title: "Copied!",
      description: "Documentation language copied to clipboard.",
    });
  };

  if (parsed) {
    return (
      <div className="space-y-4" data-testid={`container-${decoderType}-explanation`}>
        {parsed.alwaysVisible.map((section) => (
          <div key={section.id} className={`p-4 rounded-lg border ${getSectionBg(section.icon)}`}>
            <div className="flex items-center gap-2 mb-3">
              {getSectionIcon(section.icon)}
              <h4 className="font-semibold text-foreground">{section.title}</h4>
            </div>
            <div className="text-foreground text-sm leading-relaxed ml-7">
              {formatContent(section.content)}
            </div>
          </div>
        ))}
        
        {parsed.collapsible.length > 0 && (
          <Accordion 
            type="multiple" 
            value={openSections}
            onValueChange={handleAccordionChange}
            className="space-y-2"
          >
            {parsed.collapsible.map((section) => (
              <AccordionItem 
                key={section.id} 
                value={section.id} 
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50" data-testid={`accordion-${section.id}`}>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {getSectionIcon(section.icon)}
                    {section.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2">
                  <div className="text-sm leading-relaxed ml-7">
                    {section.id === 'documentation' && (
                      <p className="text-muted-foreground mb-3">
                        Use this neutral language to document your screening decision consistently, whether you approve or deny the application.
                      </p>
                    )}
                    {formatContent(section.content)}
                    {section.id === 'documentation' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3"
                        onClick={() => handleCopyDocumentation(section.content)}
                        data-testid="button-copy-documentation"
                      >
                        <Copy className="h-3 w-3 mr-2" />
                        Copy to Clipboard
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
        
        {/* State-Specific Notes - from vetted database snippets */}
        {stateNote && userStateName && (
          <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h4 className="font-semibold text-foreground">{stateNote.title}</h4>
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                {userStateName}
              </span>
            </div>
            <ul className="text-foreground text-sm leading-relaxed ml-7 space-y-1">
              {stateNote.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            {stateNote.sourceLinks && stateNote.sourceLinks.length > 0 && (
              <div className="mt-3 ml-7">
                <p className="text-xs text-muted-foreground">Sources:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {stateNote.sourceLinks.map((link, i) => (
                    <a 
                      key={i} 
                      href={link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      {new URL(link).hostname}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Fallback Text - when state law question but no vetted snippet */}
        {fallbackText && !stateNote && (
          <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h4 className="font-semibold text-foreground">State-Specific Requirements</h4>
            </div>
            <p className="text-foreground text-sm leading-relaxed ml-7">{fallbackText}</p>
          </div>
        )}
        
        <div className="pt-2 text-xs text-muted-foreground border-t border-muted/50 mt-4 space-y-1">
          {userStateName && (
            <p className="flex items-center gap-1">
              Based on your selected state: <span className="font-medium">{userStateName}</span>.{' '}
              <a href="/settings" className="text-primary hover:underline inline-flex items-center gap-0.5">
                Change in Settings
              </a>
            </p>
          )}
          <p>This explanation is informational only and does not direct approval or denial decisions. Final screening decisions should be based on your written criteria and applied consistently.</p>
        </div>
      </div>
    );
  }

  if (legacy) {
    return (
      <div className="space-y-4" data-testid={`container-${decoderType}-explanation`}>
        {legacy.map((section) => (
          <div key={section.id} className={`p-4 rounded-lg border ${getSectionBg(section.icon)}`}>
            <div className="flex items-center gap-2 mb-3">
              {getSectionIcon(section.icon)}
              <h4 className="font-semibold text-foreground">{section.title}</h4>
            </div>
            <div className="text-foreground text-sm leading-relaxed ml-7">
              {formatContent(section.content)}
            </div>
          </div>
        ))}
        <div className="pt-2 text-xs text-muted-foreground space-y-1">
          {userStateName && (
            <p className="flex items-center gap-1">
              Based on your selected state: <span className="font-medium">{userStateName}</span>.{' '}
              <a href="/settings" className="text-primary hover:underline inline-flex items-center gap-0.5">
                Change in Settings
              </a>
            </p>
          )}
          <p>This is educational guidance only, not legal advice. Always apply consistent criteria to all applicants.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-transparent border-2 border-primary/30 p-6 rounded-lg" data-testid={`container-${decoderType}-explanation`}>
      <div className="text-foreground whitespace-pre-wrap leading-relaxed" data-testid={`text-${decoderType}-explanation`}>{explanation}</div>
    </div>
  );
}

export default function Screening() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();
  const [trialExpired, setTrialExpired] = useState(false);
  
  // Check if URL has hash for helper sections
  const currentHash = typeof window !== 'undefined' ? window.location.hash : '';
  
  // Scroll to helper section on mount when hash is present
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#criminal-helper' || hash === '#credit-helper') {
      const scrollToSection = () => {
        const sectionId = hash.replace('#', '');
        const section = document.getElementById(sectionId);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return true;
        }
        return false;
      };
      
      // Retry multiple times to handle page load timing
      const timer1 = setTimeout(() => scrollToSection(), 200);
      const timer2 = setTimeout(() => scrollToSection(), 500);
      const timer3 = setTimeout(() => scrollToSection(), 1000);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [currentHash]);
  
  // Credit Report Helper state
  const [helperScreen, setHelperScreen] = useState<'home' | 'learn' | 'ask'>('home');
  const [userQuestion, setUserQuestion] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [creditUserState, setCreditUserState] = useState<string | null>(null);
  const [creditUserStateName, setCreditUserStateName] = useState<string | null>(null);
  const [creditStateNote, setCreditStateNote] = useState<{ title: string; bullets: string[]; sourceLinks: string[] } | null>(null);
  const [creditFallbackText, setCreditFallbackText] = useState<string | null>(null);

  // Criminal & Eviction Helper state
  const [criminalHelperScreen, setCriminalHelperScreen] = useState<'home' | 'learn' | 'ask'>('home');
  const [criminalUserQuestion, setCriminalUserQuestion] = useState('');
  const [criminalExplanation, setCriminalExplanation] = useState('');
  const [isCriminalExplaining, setIsCriminalExplaining] = useState(false);
  const [criminalUserState, setCriminalUserState] = useState<string | null>(null);
  const [criminalUserStateName, setCriminalUserStateName] = useState<string | null>(null);
  const [criminalStateNote, setCriminalStateNote] = useState<{ title: string; bullets: string[]; sourceLinks: string[] } | null>(null);
  const [criminalFallbackText, setCriminalFallbackText] = useState<string | null>(null);

  const handleExplain = async () => {
    const input = userQuestion.trim();
    
    if (!input) {
      setExplanation('Please type a word or phrase from your report first.');
      return;
    }

    setIsExplaining(true);
    setExplanation('');

    try {
      const token = getAccessToken();
      const response = await fetch('/api/explain-credit-term', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ term: input }),
        credentials: 'include',
      });

      if (response.status === 401) {
        setExplanation('Your session expired. Please log in again.');
        toast({
          title: "Session Expired",
          description: "Please log in again to use the AI helper.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
        return;
      }

      if (response.status === 403) {
        setExplanation('Subscribe to use this AI helper');
        setHelperScreen('home');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setExplanation(errorData.message || 'Unable to get explanation. Please try again.');
        return;
      }

      const data = await response.json();
      setExplanation(data.explanation || 'Unable to get explanation. Please try again.');
      setCreditUserState(data.userState || null);
      setCreditUserStateName(data.userStateName || null);
      setCreditStateNote(data.stateNote || null);
      setCreditFallbackText(data.fallbackText || null);
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
      const token = getAccessToken();
      const response = await fetch('/api/explain-criminal-eviction-term', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ term: input }),
        credentials: 'include',
      });

      if (response.status === 401) {
        setCriminalExplanation('Your session expired. Please log in again.');
        toast({
          title: "Session Expired",
          description: "Please log in again to use the AI helper.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
        return;
      }

      if (response.status === 403) {
        setCriminalExplanation('Subscribe to use this AI helper');
        setCriminalHelperScreen('home');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setCriminalExplanation(errorData.message || 'Unable to get explanation. Please try again.');
        return;
      }

      const data = await response.json();
      setCriminalExplanation(data.explanation || 'Unable to get explanation. Please try again.');
      setCriminalUserState(data.userState || null);
      setCriminalUserStateName(data.userStateName || null);
      setCriminalStateNote(data.stateNote || null);
      setCriminalFallbackText(data.fallbackText || null);
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
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Check if trial expired by attempting to fetch templates
  useEffect(() => {
    const checkTrial = async () => {
      if (isAuthenticated) {
        try {
          const token = getAccessToken();
          const response = await fetch('/api/templates?stateId=UT', { 
            credentials: 'include',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
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
            Screening Decoder
          </h1>
          <p className="text-muted-foreground mb-2">
            <span className="font-semibold text-foreground">This prevents misinterpretation, the most common screening mistake landlords make.</span>
          </p>
          <p className="text-muted-foreground">
            Describe what you see on your report. LeaseShield explains what matters, what doesn't, and what to ask next.
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
                Describe what you see or type terms like "charge-off" or "collection"
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
                Describe charges or type terms like "misdemeanor" or "eviction"
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
        <div className="mb-8" id="credit-helper" data-section="credit-helper">
          <Card className="p-6 shadow-lg border-2 border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-primary/20 dark:bg-primary/30 w-12 h-12 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Understand Your Credit Report in Plain English
                </h2>
                <p className="text-xs text-muted-foreground font-medium mb-1">
                  Clear explanations and compliance risk flags - fast.
                </p>
                <p className="text-sm text-muted-foreground">
                  Paste or type any confusing part of the report. LeaseShield will explain what it means and flag compliance risks.
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-foreground flex items-start gap-2">
                  <Lock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Privacy:</strong> Do NOT enter Social Security numbers, account numbers, or names. Just describe what you see.</span>
                </p>
              </div>

              {/* Quick-start chips */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setUserQuestion("What does a charge-off mean and should I be worried?")}
                  data-testid="chip-chargeoff"
                >
                  Charge-off?
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setUserQuestion("Credit score is low - is this risky?")}
                  data-testid="chip-lowscore"
                >
                  Low score?
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setUserQuestion("Applicant has late payments on the report - what should I ask?")}
                  data-testid="chip-latepayments"
                >
                  Late payments?
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setUserQuestion("High credit card balances near limits - what does this tell me?")}
                  data-testid="chip-highbalances"
                >
                  High balances?
                </Button>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                <p className="text-foreground font-medium mb-2">Or try one of these:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li 
                    className="cursor-pointer hover:text-foreground transition-colors pl-4 py-0.5 -ml-2 rounded hover:bg-muted/50"
                    onClick={() => setUserQuestion("What does charge-off mean and should I be worried?")}
                  >
                    • "What does charge-off mean and should I be worried?"
                  </li>
                  <li 
                    className="cursor-pointer hover:text-foreground transition-colors pl-4 py-0.5 -ml-2 rounded hover:bg-muted/50"
                    onClick={() => setUserQuestion("Applicant has 3 collections totaling $2,400 - what questions should I ask?")}
                  >
                    • "Applicant has 3 collections totaling $2,400 - what questions should I ask?"
                  </li>
                  <li 
                    className="cursor-pointer hover:text-foreground transition-colors pl-4 py-0.5 -ml-2 rounded hover:bg-muted/50"
                    onClick={() => setUserQuestion("Credit score is 580 with 2 late payments - is this risky?")}
                  >
                    • "Credit score is 580 with 2 late payments - is this risky?"
                  </li>
                  <li 
                    className="cursor-pointer hover:text-foreground transition-colors pl-4 py-0.5 -ml-2 rounded hover:bg-muted/50"
                    onClick={() => setUserQuestion("High credit card balances near limits - what does this tell me?")}
                  >
                    • "High credit card balances near limits - what does this tell me?"
                  </li>
                </ul>
              </div>

              <Textarea
                id="credit-helper-input"
                placeholder="Type or paste anything confusing from the report here (e.g., 'Charge-off from 2022' or '3 collections totaling $2,400')."
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
                {isExplaining ? 'Analyzing...' : 'Explain This in Plain English'}
              </Button>

              {isExplaining && (
                <div className="bg-muted/50 border border-muted rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                    <p className="text-sm text-muted-foreground">Analyzing and preparing guidance...</p>
                  </div>
                </div>
              )}

              {!isExplaining && explanation && (
                <DecoderDisplay 
                  explanation={explanation} 
                  decoderType="credit" 
                  userState={creditUserState}
                  userStateName={creditUserStateName}
                  stateNote={creditStateNote}
                  fallbackText={creditFallbackText}
                />
              )}

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
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Understand Criminal & Eviction Records in Plain English
                </h2>
                <p className="text-xs text-muted-foreground font-medium mb-1">
                  Clear explanations and Fair Housing risk flags - fast.
                </p>
                <p className="text-sm text-muted-foreground">
                  Describe what you see on the report. LeaseShield will explain what it means and flag Fair Housing compliance risks.
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-foreground flex items-start gap-2">
                  <Lock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Privacy:</strong> Do NOT enter Social Security numbers, case numbers, or names. Just describe the charges or records.</span>
                </p>
              </div>

              {/* Quick-start chips */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCriminalUserQuestion("Applicant has a misdemeanor from years ago - can I consider this?")}
                  data-testid="chip-misdemeanor"
                >
                  Misdemeanor?
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCriminalUserQuestion("Applicant has an eviction on record - what should I ask?")}
                  data-testid="chip-eviction"
                >
                  Eviction?
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCriminalUserQuestion("What questions should I ask about a DUI conviction?")}
                  data-testid="chip-dui"
                >
                  DUI?
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCriminalUserQuestion("Multiple old charges on record - what's my liability?")}
                  data-testid="chip-oldcharges"
                >
                  Old charges?
                </Button>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                <p className="text-foreground font-medium mb-2">Or try one of these:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li 
                    className="cursor-pointer hover:text-foreground transition-colors pl-4 py-0.5 -ml-2 rounded hover:bg-muted/50"
                    onClick={() => setCriminalUserQuestion("Applicant has a misdemeanor theft from 5 years ago - can I ask about it?")}
                  >
                    • "Applicant has a misdemeanor theft from 5 years ago - can I ask about it?"
                  </li>
                  <li 
                    className="cursor-pointer hover:text-foreground transition-colors pl-4 py-0.5 -ml-2 rounded hover:bg-muted/50"
                    onClick={() => setCriminalUserQuestion("What questions should I ask about a DUI conviction?")}
                  >
                    • "What questions should I ask about a DUI conviction?"
                  </li>
                  <li 
                    className="cursor-pointer hover:text-foreground transition-colors pl-4 py-0.5 -ml-2 rounded hover:bg-muted/50"
                    onClick={() => setCriminalUserQuestion("Eviction filed in 2021 but dismissed - should I be concerned?")}
                  >
                    • "Eviction filed in 2021 but dismissed - should I be concerned?"
                  </li>
                  <li 
                    className="cursor-pointer hover:text-foreground transition-colors pl-4 py-0.5 -ml-2 rounded hover:bg-muted/50"
                    onClick={() => setCriminalUserQuestion("Multiple drug charges from 8 years ago - what's my liability if I rent to them?")}
                  >
                    • "Multiple drug charges from 8 years ago - what's my liability if I rent to them?"
                  </li>
                </ul>
              </div>

              <Textarea
                id="criminal-helper-input"
                placeholder="Type or paste anything confusing from the report here (e.g., 'Misdemeanor theft from 2019' or 'Eviction filed but dismissed')."
                value={criminalUserQuestion}
                onChange={(e) => setCriminalUserQuestion(e.target.value)}
                className="min-h-[100px] text-base"
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
                {isCriminalExplaining ? 'Analyzing...' : 'Explain This in Plain English'}
              </Button>

              {isCriminalExplaining && (
                <div className="bg-muted/50 border border-muted rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                    <p className="text-sm text-muted-foreground">Analyzing and preparing Fair Housing guidance...</p>
                  </div>
                </div>
              )}

              {!isCriminalExplaining && criminalExplanation && (
                <DecoderDisplay 
                  explanation={criminalExplanation} 
                  decoderType="criminal"
                  userState={criminalUserState}
                  userStateName={criminalUserStateName}
                  stateNote={criminalStateNote}
                  fallbackText={criminalFallbackText}
                />
              )}

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
                        <div><strong>No Blanket Bans:</strong> You CAN deny for specific crimes, but you CANNOT deny everyone with any criminal history regardless of offense.</div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div><strong>Individualized Assessment:</strong> Consider nature of crime, severity, time elapsed, and relevance to tenancy.</div>
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
                    onClick={() => {
                      apiRequest('POST', '/api/analytics/track', {
                        eventType: 'western_verify_click',
                        eventData: { source: 'screening_page' },
                      }).catch(() => {});
                      window.open('https://www.westernverify.com', '_blank');
                    }}
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
