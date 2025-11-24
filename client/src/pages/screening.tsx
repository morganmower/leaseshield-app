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
import { Link } from "wouter";
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
      });

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
      });

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return null;

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

        {/* AI Credit Report Helper - Hero Feature */}
        <div className="mb-12" id="ai-helpers">
          <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 dark:from-primary/10 dark:via-primary/5 dark:to-transparent border-2 border-primary/30 dark:border-primary/20 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="rounded-lg bg-primary/20 dark:bg-primary/30 w-14 h-14 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="h-7 w-7 text-primary dark:text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
                  AI Credit Report Helper
                </h2>
                <p className="text-foreground dark:text-foreground/90 mb-3">
                  Get instant explanations of credit report terms, plus the exact questions you should ask your applicant
                </p>
                <Badge variant="secondary" className="bg-primary/20 dark:bg-primary/30 text-primary dark:text-primary border-primary/30 dark:border-primary/40">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  Powered by AI
                </Badge>
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="mb-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-foreground">
                  <strong>Privacy Notice:</strong> For your safety, please do not upload your actual credit report or type Social Security numbers, full account numbers, or exact dollar amounts. We do not store or review your full credit report.
                </p>
              </div>
            </div>
          </div>

          {/* Home Screen */}
          {helperScreen === 'home' && (
            <Card className="p-6 shadow-lg">
              <h3 className="font-semibold text-lg mb-4">How this tool works</h3>
              <p className="text-muted-foreground mb-6">
                This AI-powered tool helps you understand credit report terms AND gives you actionable questions to ask your applicant. Choose an option below:
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={() => {
                    setHelperScreen('learn');
                    setExplanation('');
                  }}
                  className="flex-1"
                  data-testid="button-learn-credit-report"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Learn How to Read a Credit Report
                </Button>
                <Button 
                  onClick={() => {
                    setHelperScreen('ask');
                    setUserQuestion('');
                    setExplanation('');
                  }}
                  variant="default"
                  className="flex-1"
                  data-testid="button-ask-question"
                >
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Ask About a Credit Term (AI)
                </Button>
              </div>
            </Card>
          )}

          {/* Learn Screen */}
          {helperScreen === 'learn' && (
            <Card className="p-6 shadow-lg">
              <div className="mb-4">
                <Button 
                  onClick={() => setHelperScreen('home')}
                  variant="ghost"
                  size="sm"
                  data-testid="button-back-to-home"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </div>

              <h3 className="font-semibold text-lg mb-4">Learn How to Read a Credit Report</h3>
              <p className="text-muted-foreground mb-6">
                Below are common parts of a credit report with explanations. This is for educational purposes only.
              </p>

              <div className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Credit Score
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    A number that summarizes how risky you are as a borrower. Higher is better. Scores range from 300-850.
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Payment History
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Shows if bills were paid on time or late. This is the most important factor in credit scoring.
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    Collections
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Accounts that were not paid and sent to a collection agency. Major red flag for landlords.
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    Charge-off
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    A debt the lender has given up collecting, but it can still hurt your credit score significantly.
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-amber-600" />
                    Utilization
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    How much of your credit limit you are using. For example, using $500 of a $1,000 limit is 50%. Lower is better (under 30% is ideal).
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    Inquiries
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Who has checked your credit recently (for example, a bank or car dealer). Too many inquiries can indicate credit shopping.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Tip:</strong> When looking at your tenant's credit report, match these terms to understand what they mean and how they impact their creditworthiness.
                </p>
              </div>
            </Card>
          )}

          {/* Ask Screen - AI Powered */}
          {helperScreen === 'ask' && (
            <Card className="p-6 shadow-lg">
              <div className="mb-4">
                <Button 
                  onClick={() => {
                    setHelperScreen('home');
                    setUserQuestion('');
                    setExplanation('');
                  }}
                  variant="ghost"
                  size="sm"
                  data-testid="button-back-from-ask"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-lg">Ask About a Credit Term</h3>
                <Badge variant="secondary" className="bg-primary/20 dark:bg-primary/30 text-primary dark:text-primary border-primary/30 dark:border-primary/40">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  AI Powered
                </Badge>
              </div>
              
              <div className="space-y-4">
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-foreground font-medium">What you'll get:</p>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                    <li>Plain-English explanation of the term</li>
                    <li>Warning signs to watch for</li>
                    <li>Specific questions to ask your applicant</li>
                  </ul>
                </div>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">How to use:</strong></p>
                  <p>1. Look at your tenant's credit report</p>
                  <p>2. Type any term you see, such as:</p>
                  <ul className="ml-6 space-y-1 list-disc">
                    <li><em>"account closed by creditor"</em> - What does this mean?</li>
                    <li><em>"maxed out credit card"</em> - Is this a red flag?</li>
                    <li><em>"medical collections"</em> - Should I be concerned?</li>
                    <li><em>"bankruptcy chapter 7"</em> - How recent is too recent?</li>
                    <li><em>"hard inquiry from payday lender"</em> - What's the risk?</li>
                    <li><em>"authorized user on account"</em> - Does this count?</li>
                  </ul>
                  <p>3. Get instant AI-powered guidance tailored for landlords</p>
                </div>

                <div className="bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 dark:border-destructive/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-destructive font-medium">
                      For your safety: Do not type Social Security numbers, full account numbers, or exact dollar amounts.
                    </p>
                  </div>
                </div>

                <Textarea
                  placeholder="Example: charge-off"
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
                  data-testid="button-get-explanation"
                >
                  <Lightbulb className="mr-2 h-4 w-4" />
                  {isExplaining ? 'Getting explanation...' : 'Get AI Explanation'}
                </Button>

                {isExplaining && (
                  <div className="bg-muted/50 border border-muted rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                      <p className="text-sm text-muted-foreground">
                        Analyzing your question and preparing actionable guidance...
                      </p>
                    </div>
                  </div>
                )}

                {!isExplaining && explanation && (() => {
                  const parsed = parseAIExplanation(explanation);
                  
                  if (!parsed) {
                    return (
                      <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-transparent border-2 border-primary/30 dark:border-primary/20 p-6 rounded-lg" data-testid="container-credit-explanation">
                        <div className="flex items-start gap-3 mb-4">
                          <Lightbulb className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground text-lg mb-3">Explanation</h4>
                            <div className="text-foreground dark:text-foreground/95 whitespace-pre-wrap leading-relaxed" data-testid="text-credit-explanation">{explanation}</div>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-primary/20 dark:border-primary/30">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              This information is for general education only. It is not legal or financial advice. Always consult with legal counsel for specific situations.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-transparent border-2 border-primary/30 dark:border-primary/20 p-6 rounded-lg space-y-4" data-testid="container-credit-explanation">
                      {parsed.whatItMeans && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-foreground">What it means</h4>
                          </div>
                          <p className="text-foreground dark:text-foreground/95 leading-relaxed ml-7" data-testid="text-credit-explanation">{parsed.whatItMeans}</p>
                        </div>
                      )}
                      
                      {parsed.whatToWatchFor && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                            <h4 className="font-semibold text-foreground">What to watch for</h4>
                          </div>
                          <p className="text-foreground dark:text-foreground/95 leading-relaxed ml-7">{parsed.whatToWatchFor}</p>
                        </div>
                      )}
                      
                      {parsed.questionsToAsk && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <HelpCircle className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-foreground">Questions to ask</h4>
                          </div>
                          <div className="ml-7 text-foreground dark:text-foreground/95 leading-relaxed whitespace-pre-wrap">{parsed.questionsToAsk}</div>
                        </div>
                      )}
                      
                      <div className="pt-4 border-t border-primary/20 dark:border-primary/30">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            This information is for general education only. It is not legal or financial advice. Always consult with legal counsel for specific situations.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Card>
          )}
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

        {/* AI Criminal & Eviction Screening Helper - Hero Feature */}
        <div className="mb-12">
          <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 dark:from-primary/10 dark:via-primary/5 dark:to-transparent border-2 border-primary/30 dark:border-primary/20 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="rounded-lg bg-primary/20 dark:bg-primary/30 w-14 h-14 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-7 w-7 text-primary dark:text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
                  AI Criminal & Eviction Screening Helper
                </h2>
                <p className="text-foreground dark:text-foreground/90 mb-3">
                  Get instant explanations of screening terms, Fair Housing guidance, and legal considerations for evaluating criminal and eviction records
                </p>
                <Badge variant="secondary" className="bg-primary/20 dark:bg-primary/30 text-primary dark:text-primary border-primary/30 dark:border-primary/40">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  Powered by AI
                </Badge>
              </div>
            </div>
          </div>

          {/* Privacy & Fair Housing Notice */}
          <div className="mb-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-foreground mb-2">
                  <strong>Privacy & Compliance Notice:</strong> For your safety, do not enter Social Security numbers, case numbers, docket numbers, or specific names of individuals. We do not store or review your screening reports.
                </p>
                <p className="text-sm text-foreground">
                  <strong>Fair Housing Reminder:</strong> Blanket bans on criminal history violate Fair Housing laws. Always apply consistent, documented criteria to all applicants and consider individual circumstances.
                </p>
              </div>
            </div>
          </div>

          {/* Home Screen */}
          {criminalHelperScreen === 'home' && (
            <Card className="p-6 shadow-lg">
              <h3 className="font-semibold text-lg mb-4">How this tool works</h3>
              <p className="text-muted-foreground mb-6">
                This AI-powered tool helps you understand criminal and eviction screening terms AND provides Fair Housing guidance. Choose an option below:
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={() => {
                    setCriminalHelperScreen('learn');
                    setCriminalExplanation('');
                  }}
                  className="flex-1"
                  data-testid="button-learn-criminal-screening"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Learn About Background Screening
                </Button>
                <Button 
                  onClick={() => {
                    setCriminalHelperScreen('ask');
                    setCriminalUserQuestion('');
                    setCriminalExplanation('');
                  }}
                  variant="default"
                  className="flex-1"
                  data-testid="button-ask-criminal-question"
                >
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Ask About a Screening Term (AI)
                </Button>
              </div>
            </Card>
          )}

          {/* Learn Screen */}
          {criminalHelperScreen === 'learn' && (
            <Card className="p-6 shadow-lg">
              <div className="mb-4">
                <Button 
                  onClick={() => setCriminalHelperScreen('home')}
                  variant="ghost"
                  size="sm"
                  data-testid="button-back-to-criminal-home"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </div>

              <h3 className="font-semibold text-lg mb-4">Learn About Background Screening</h3>
              <p className="text-muted-foreground mb-6">
                Below are critical Fair Housing and legal compliance concepts. This is for educational purposes only - always consult legal counsel.
              </p>

              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border-2 border-amber-500/30">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Fair Housing Laws (CRITICAL)
                  </h4>
                  <p className="text-sm text-foreground mb-2">
                    <strong>You CANNOT have blanket bans on all criminal history.</strong> Fair Housing laws prohibit policies that create disparate impact discrimination. You must consider:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                    <li>Nature and severity of the offense</li>
                    <li>How long ago it occurred</li>
                    <li>Relevance to safe tenancy</li>
                    <li>Individual circumstances and rehabilitation</li>
                  </ul>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Felony vs. Misdemeanor
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Felonies are serious crimes (often punishable by more than 1 year in prison). Misdemeanors are less serious offenses. Fair Housing requires individualized assessment - not automatic denials.
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Consistent Criteria (REQUIRED)
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    You MUST apply identical screening standards to ALL applicants. Write your criteria down and follow it uniformly. Inconsistent criteria create Fair Housing violations and discrimination claims.
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Eviction Records
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Past evictions show rental payment history. Recent evictions (within 3 years) are more concerning. Ask about circumstances - not all evictions mean the tenant was at fault. Consider job loss, medical issues, or landlord disputes.
                  </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    7-Year Rule & State Restrictions
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Many states limit how far back you can look at criminal records (often 7 years for non-convictions, or "ban the box" laws). Some prohibit asking about arrests without convictions. Check your state laws BEFORE screening.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-destructive/10 border-2 border-destructive/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-foreground font-semibold mb-1">Legal Compliance Required</p>
                    <p className="text-sm text-muted-foreground">
                      Criminal and eviction screening is heavily regulated by Fair Housing laws, state statutes, and local ordinances. Violating these laws can result in expensive lawsuits and penalties. Always consult with a Fair Housing attorney about your screening policies and document all decisions consistently.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Ask Screen - AI Powered */}
          {criminalHelperScreen === 'ask' && (
            <Card className="p-6 shadow-lg">
              <div className="mb-4">
                <Button 
                  onClick={() => {
                    setCriminalHelperScreen('home');
                    setCriminalUserQuestion('');
                    setCriminalExplanation('');
                  }}
                  variant="ghost"
                  size="sm"
                  data-testid="button-back-from-criminal-ask"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-lg">Ask About a Screening Term</h3>
                <Badge variant="secondary" className="bg-primary/20 dark:bg-primary/30 text-primary dark:text-primary border-primary/30 dark:border-primary/40">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  AI Powered
                </Badge>
              </div>
              
              <div className="space-y-4">
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-foreground font-medium">What you'll get:</p>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                    <li>Plain-English explanation of the term</li>
                    <li>Fair Housing and legal considerations</li>
                    <li>Compliance reminders and best practices</li>
                  </ul>
                </div>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">How to use:</strong></p>
                  <p>1. Look at your criminal or eviction screening report</p>
                  <p>2. Type any term or situation you see, such as:</p>
                  <ul className="ml-6 space-y-1 list-disc">
                    <li><em>"dismissed charge"</em> - Does this still matter?</li>
                    <li><em>"misdemeanor theft from 10 years ago"</em> - Can I deny for this?</li>
                    <li><em>"unlawful detainer judgment"</em> - What is this?</li>
                    <li><em>"felony DUI"</em> - How should I evaluate this?</li>
                    <li><em>"eviction filed but not completed"</em> - Red flag or not?</li>
                    <li><em>"expunged record"</em> - Am I allowed to consider it?</li>
                  </ul>
                  <p>3. Get Fair Housing-compliant AI guidance instantly</p>
                </div>

                <div className="bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 dark:border-destructive/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-destructive font-medium">
                      For your safety: Do not type Social Security numbers, case numbers, or specific names.
                    </p>
                  </div>
                </div>

                <Textarea
                  placeholder="Example: misdemeanor"
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
                  {isCriminalExplaining ? 'Getting explanation...' : 'Get AI Explanation'}
                </Button>

                {isCriminalExplaining && (
                  <div className="bg-muted/50 border border-muted rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                      <p className="text-sm text-muted-foreground">
                        Analyzing your question and preparing compliance guidance...
                      </p>
                    </div>
                  </div>
                )}

                {!isCriminalExplaining && criminalExplanation && (() => {
                  const parsed = parseAIExplanation(criminalExplanation);
                  
                  if (!parsed) {
                    return (
                      <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-transparent border-2 border-primary/30 dark:border-primary/20 p-6 rounded-lg" data-testid="container-criminal-explanation">
                        <div className="flex items-start gap-3 mb-4">
                          <Lightbulb className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground text-lg mb-3">Explanation</h4>
                            <div className="text-foreground dark:text-foreground/95 whitespace-pre-wrap leading-relaxed" data-testid="text-criminal-explanation">{criminalExplanation}</div>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-primary/20 dark:border-primary/30">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              This information is for general education only. It is not legal advice. Always consult with legal counsel for specific situations and Fair Housing compliance.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-transparent border-2 border-primary/30 dark:border-primary/20 p-6 rounded-lg space-y-4" data-testid="container-criminal-explanation">
                      {parsed.whatItMeans && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-foreground">What it means</h4>
                          </div>
                          <p className="text-foreground dark:text-foreground/95 leading-relaxed ml-7" data-testid="text-criminal-explanation">{parsed.whatItMeans}</p>
                        </div>
                      )}
                      
                      {parsed.whatToWatchFor && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                            <h4 className="font-semibold text-foreground">What to watch for</h4>
                          </div>
                          <p className="text-foreground dark:text-foreground/95 leading-relaxed ml-7">{parsed.whatToWatchFor}</p>
                        </div>
                      )}
                      
                      {parsed.questionsToAsk && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <HelpCircle className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-foreground">Legal considerations</h4>
                          </div>
                          <div className="ml-7 text-foreground dark:text-foreground/95 leading-relaxed whitespace-pre-wrap">{parsed.questionsToAsk}</div>
                        </div>
                      )}
                      
                      <div className="pt-4 border-t border-primary/20 dark:border-primary/30">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            This information is for general education only. It is not legal advice. Always consult with legal counsel for specific situations and Fair Housing compliance.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Card>
          )}
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
