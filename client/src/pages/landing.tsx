import { Shield, FileText, Search, Users, CheckCircle2, ArrowRight, Star, TrendingUp, Clock, Award, DollarSign, AlertCircle, BadgeCheck, Calculator, X, XCircle, MessageCircle, Send, Minimize2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import heroImage from "@assets/generated_images/LeaseShield_brand_hero_image_75141406.png";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

type FeatureType = "leases" | "compliance" | "screening" | "resources" | null;

interface ChatMessage {
  text: string;
  type: 'user' | 'bot';
}

export default function Landing() {
  const [selectedFeature, setSelectedFeature] = useState<FeatureType>(null);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showBenefitsDialog, setShowBenefitsDialog] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: templateStats } = useQuery<{ count: number }>({
    queryKey: ['/api/stats/template-count'],
  });

  const templateCount = templateStats?.count || 26;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isTyping) return;

    // Client-side validation
    if (text.length > 500) {
      toast({
        title: "Message Too Long",
        description: "Please keep your message under 500 characters.",
        variant: "destructive",
      });
      return;
    }

    // Add user message
    const userMessage: ChatMessage = { text, type: 'user' };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Server returned an error - use the server's message
        const botMessage: ChatMessage = {
          text: data.reply || "Sorry, something went wrong. Please try again.",
          type: 'bot'
        };
        setChatMessages(prev => [...prev, botMessage]);
        
        if (res.status === 429) {
          toast({
            title: "Slow Down",
            description: "You're sending messages too quickly. Please wait a moment.",
            variant: "destructive",
          });
        }
        return;
      }

      const botMessage: ChatMessage = {
        text: data.reply || "Sorry, I had trouble answering that.",
        type: 'bot'
      };
      setChatMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      toast({
        title: "Connection Error",
        description: "Unable to reach the assistant. Please check your connection.",
        variant: "destructive",
      });
      const errorMessage: ChatMessage = {
        text: "I'm having trouble connecting right now. Please check your connection and try again.",
        type: 'bot'
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const featureDetails = {
    leases: {
      title: "State-Specific Leases",
      icon: FileText,
      description: "Access professional lease agreements and rental forms tailored to your state's exact legal requirements.",
      details: [
        "Residential lease agreements compliant with UT, TX, ND, and SD laws",
        "Rental application forms with fair housing compliance",
        "Move-in and move-out inspection checklists",
        "Lease addendums for pets, parking, utilities, and more",
        "Month-to-month rental agreements",
        "Lease renewal and termination notices",
        "All documents available in Word and PDF formats",
        "Step-by-step instructions for customizing each template"
      ]
    },
    compliance: {
      title: "Compliance Guidance",
      icon: Shield,
      description: "Stay ahead of changing landlord-tenant laws with curated updates that only include what could create liability.",
      details: [
        "Real-time monitoring of state legislature and court decisions",
        "Email alerts when laws change in your selected state",
        "Clear before/after comparisons showing what changed",
        "Impact-level ratings (high, medium, low) for each update",
        "Compliance cards summarizing current requirements",
        "Security deposit rules and deadlines by state",
        "Notice period requirements for lease termination",
        "Fair housing and discrimination prevention guidance"
      ]
    },
    screening: {
      title: "Screening Toolkit",
      icon: Search,
      description: "Step-by-step guidance on tenant screening with checklists, red flag indicators, and resources to help you make informed decisions.",
      details: [
        "Credit report decoder explaining key sections and scores",
        "Income verification checklists and guidelines",
        "Rental history verification templates",
        "Criminal background check best practices",
        "Red flags to watch for during screening",
        "Fair housing compliance during screening process",
        "Western Verify (www.westernverify.com) integration for comprehensive checks",
        "Sample screening criteria and policies"
      ]
    },
    resources: {
      title: "Helpful Resources",
      icon: Users,
      description: "Expert guidance and educational resources to help you handle common landlord challenges with confidence.",
      details: [
        "Step-by-step workflows for handling tenant issues",
        "Late rent collection procedures by state",
        "Eviction process guides with required notices",
        "Security deposit return procedures and timelines",
        "Maintenance request handling best practices",
        "Lease violation notice templates",
        "Communication guidelines for difficult situations",
        "Property management tips and checklists"
      ]
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity" data-testid="link-home">
            <Logo iconSize={32} />
            <span className="font-display text-lg sm:text-2xl font-semibold text-foreground">
              LeaseShield<span className="hidden sm:inline"> App</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Button
              variant="ghost"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-login"
              className="text-sm sm:text-base"
            >
              Log In
            </Button>
            <Button
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-start-trial"
              className="text-sm sm:text-base px-3 sm:px-5"
            >
              <span className="hidden xs:inline">Start </span>Trial
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-16 md:pb-32 overflow-hidden">
        {/* Gradient Background with amber/gold and blue */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-background to-primary/10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-400/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div variants={fadeInUp} className="mb-4 flex flex-wrap gap-2">
                <Badge className="px-3 py-1 text-sm">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Trusted by 500+ Landlords
                </Badge>
                <Badge variant="outline" className="px-3 py-1 text-sm border-success text-success">
                  <BadgeCheck className="h-3 w-3 mr-1" />
                  30-Day Money-Back Guarantee
                </Badge>
              </motion.div>
              
              <motion.h1 
                variants={fadeInUp}
                className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-semibold text-foreground leading-tight mb-6"
              >
                Protect Your Rental Business from{" "}
                <span className="bg-gradient-to-r from-amber-600 to-primary bg-clip-text text-transparent">Costly Legal Mistakes</span>
              </motion.h1>
              
              <motion.p 
                variants={fadeInUp}
                className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 leading-relaxed"
              >
                Professional legal templates, automated compliance alerts, tenant screening tools, 
                and multi-property management — all in one platform built for small to midsize 
                landlords.
              </motion.p>

              {/* Pricing Display */}
              <motion.div 
                variants={fadeInUp}
                className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl sm:text-4xl font-bold text-foreground">$12</span>
                      <span className="text-lg text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      7-day free trial • No credit card required • Cancel anytime
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => window.location.href = "/api/login"}
                    className="w-full sm:w-auto whitespace-nowrap"
                    data-testid="button-pricing-cta"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
              
              <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
                <Button
                  size="lg"
                  variant="outline"
                  data-testid="button-hero-learn"
                  className="text-sm sm:text-base px-4 sm:px-8 w-full sm:w-auto"
                  onClick={() => setShowBenefitsDialog(true)}
                >
                  Learn More
                </Button>
              </motion.div>
              
              <motion.div 
                variants={fadeInUp}
                className="flex flex-col xs:flex-row items-start xs:items-center gap-3 xs:gap-6 text-sm text-muted-foreground"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  <span>Instant access</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  <span>Cancel anytime</span>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-lg overflow-hidden shadow-xl border border-border">
                <img 
                  src={heroImage} 
                  alt="LeaseShield - Protect your rental investment with legal templates, compliance guidance, and tenant screening tools"
                  className="w-full h-auto object-cover"
                  data-testid="img-hero"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Lawyer-Safe Disclaimer */}
      <section className="py-4 bg-amber-50 dark:bg-amber-950/20 border-y border-amber-200 dark:border-amber-800">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground">
              <strong>Important:</strong> These are general templates based on current state laws. 
              This is not legal advice. Always have your final documents reviewed by a licensed attorney in your state.
            </p>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              One Bad Lease Can Cost You $10,000+ in 2025
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
              Most small landlords are still using free Google templates written years ago… and hoping 
              they hold up in court. That's where things go sideways:
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6 sm:gap-8"
          >
            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full border-destructive/20 bg-destructive/5">
                <div className="rounded-lg bg-destructive/10 w-12 h-12 flex items-center justify-center mb-4">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="font-semibold text-lg mb-3 text-foreground">
                  New ESA / Assistance-Animal Rules
                </h3>
                <p className="text-muted-foreground">
                  Leases that ignore updated Fair Housing guidance can put you on the wrong side of HUD complaints. One violation can cost $16,000+ in fines.
                </p>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full border-destructive/20 bg-destructive/5">
                <div className="rounded-lg bg-destructive/10 w-12 h-12 flex items-center justify-center mb-4">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="font-semibold text-lg mb-3 text-foreground">
                  Adverse Action Mistakes
                </h3>
                <p className="text-muted-foreground">
                  Using the wrong wording in your denial letters can trigger FCRA problems and angry applicants. Lawsuits start at $1,000 per violation.
                </p>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full border-destructive/20 bg-destructive/5">
                <div className="rounded-lg bg-destructive/10 w-12 h-12 flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="font-semibold text-lg mb-3 text-foreground">
                  $500 Every Time You Email Your Lawyer
                </h3>
                <p className="text-muted-foreground">
                  Paying for one-off questions instead of using a consistent, attorney-vetted foundation. Small questions add up to thousands per year.
                </p>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 sm:py-12 border-y bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8"
          >
            <motion.div variants={fadeInUp} className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-500" />
                <div className="text-2xl sm:text-3xl font-bold text-foreground">500+</div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Active Landlords</div>
              <Badge variant="outline" className="text-xs mt-2">+47 this week</Badge>
            </motion.div>
            <motion.div variants={fadeInUp} className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-500" />
                <div className="text-2xl sm:text-3xl font-bold text-foreground">{templateCount}+</div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Legal Templates</div>
              <button
                className="text-xs mt-1 text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                onClick={() => setShowTemplatePreview(true)}
                data-testid="button-preview-template"
              >
                See Example →
              </button>
            </motion.div>
            <motion.div variants={fadeInUp} className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <div className="text-2xl sm:text-3xl font-bold text-foreground">4</div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">States Covered</div>
            </motion.div>
            <motion.div variants={fadeInUp} className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-600 dark:text-cyan-500" />
                <div className="text-2xl sm:text-3xl font-bold text-foreground">24/7</div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Access Anytime</div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 md:py-28">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Everything You Need to Operate Confidently
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Simple, protective, state-specific guidance that prevents legal and financial mistakes
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full hover-elevate transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full -mr-16 -mt-16" />
                <div className="relative">
                  <div className="rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 w-12 h-12 flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-amber-600 dark:text-amber-500" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-3">State-Specific Templates</h3>
                  <p className="text-muted-foreground mb-4">
                    Professional leases, applications, notices, and forms tailored to your state's
                    exact requirements. Download as PDF or fill online.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Residential leases & applications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Move-in/move-out checklists</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>All required notices by state</span>
                    </li>
                  </ul>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full hover-elevate transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -mr-16 -mt-16" />
                <div className="relative">
                  <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-3">Compliance Protection</h3>
                  <p className="text-muted-foreground mb-4">
                    Stay ahead of changing laws with curated updates that only include what could
                    create liability. Clear before/after comparisons included.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Impact-only legal updates</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Before/after comparisons</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Email alerts for your state</span>
                    </li>
                  </ul>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full hover-elevate transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full -mr-16 -mt-16" />
                <div className="relative">
                  <div className="rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 w-12 h-12 flex items-center justify-center mb-4">
                    <Search className="h-6 w-6 text-cyan-600 dark:text-cyan-500" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-3">Screening Toolkit</h3>
                  <p className="text-muted-foreground mb-4">
                    Step-by-step guidance on tenant screening, red flags to watch for, and
                    direct access to{" "}
                    <a 
                      href="https://www.westernverify.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Western Verify
                    </a>{" "}
                    for background checks.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Screening best practices</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Red flag checklists</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Western Verify integration</span>
                    </li>
                  </ul>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full hover-elevate transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-transparent rounded-full -mr-16 -mt-16" />
                <div className="relative">
                  <div className="rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/10 w-12 h-12 flex items-center justify-center mb-4">
                    <Building2 className="h-6 w-6 text-violet-600 dark:text-violet-500" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-3">Property Management</h3>
                  <p className="text-muted-foreground mb-4">
                    Organize multiple properties, associate documents with specific units, and 
                    keep all your rental paperwork organized in one place.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Track unlimited properties</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Link documents to properties</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Filter & organize by location</span>
                    </li>
                  </ul>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Trusted by Landlords Nationwide
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              See how LeaseShield App is protecting rental businesses just like yours
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-8"
          >
            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <Badge variant="outline" className="mb-3 text-success border-success">
                  Saved $4,200 in attorney fees
                </Badge>
                <p className="text-muted-foreground mb-4">
                  "The eviction template saved me $4,200 in attorney fees. My lawyer said the notice was 
                  perfect and the judge accepted it without any issues. LeaseShield paid for itself 20 times over."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">SJ</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Sarah J.</div>
                    <div className="text-xs text-muted-foreground">4 units in Salt Lake City, UT</div>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <Badge variant="outline" className="mb-3 text-success border-success">
                  Avoided $8,500 lawsuit
                </Badge>
                <p className="text-muted-foreground mb-4">
                  "LeaseShield's compliance alert about Texas security deposit changes saved me from an $8,500 
                  lawsuit. My property manager didn't even know about the new law yet. Best $12/month I've ever spent."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">MC</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Michael C.</div>
                    <div className="text-xs text-muted-foreground">12 units in Dallas, TX</div>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <Badge variant="outline" className="mb-3 text-success border-success">
                  Avoided nightmare tenant
                </Badge>
                <p className="text-muted-foreground mb-4">
                  "The screening toolkit caught red flags I would have missed. Saved me from renting to someone 
                  with 3 previous evictions. The templates are so clear even I can understand them!"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">RP</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Rachel P.</div>
                    <div className="text-xs text-muted-foreground">6 units in Fargo, ND</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pain Points - What Happens Without LeaseShield */}
      <section className="py-20 md:py-28">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              What Happens Without LeaseShield?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              One legal mistake can cost thousands. Here's what landlords face without proper protection:
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
          >
            <motion.div variants={fadeInUp}>
              <Card className="p-6 border-destructive/30 bg-destructive/5">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-destructive/10 p-3 flex-shrink-0">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">$3,000-$10,000 in Attorney Fees</h3>
                    <p className="text-sm text-muted-foreground">
                      Hiring a lawyer to draft or fix one lease agreement costs $500-$2,000. Add eviction 
                      proceedings or compliance issues and you're looking at $5,000+ easily.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 border-destructive/30 bg-destructive/5">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-destructive/10 p-3 flex-shrink-0">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">$5,000+ Security Deposit Lawsuits</h3>
                    <p className="text-sm text-muted-foreground">
                      Wrong notice periods, missing clauses, or outdated forms = automatic tenant lawsuits. 
                      Courts favor tenants when landlords mess up procedures.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 border-destructive/30 bg-destructive/5">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-destructive/10 p-3 flex-shrink-0">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Months of Lost Rent</h3>
                    <p className="text-sm text-muted-foreground">
                      One rejected eviction filing means starting over from scratch. That's 3-6 months of 
                      zero rent while paying the mortgage, taxes, and utilities yourself.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 border-destructive/30 bg-destructive/5">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-destructive/10 p-3 flex-shrink-0">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Fair Housing Violations: $10,000+</h3>
                    <p className="text-sm text-muted-foreground">
                      One wrong question on your rental application or discriminatory screening = federal 
                      fines starting at $10,000 for first offense.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mt-12"
          >
            <div className="inline-block bg-success/10 border border-success/20 rounded-lg px-6 py-4">
              <p className="text-lg font-semibold text-foreground mb-1">
                LeaseShield App: Just $12/month
              </p>
              <p className="text-sm text-muted-foreground">
                One mistake costs more than 2 years of LeaseShield
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              How LeaseShield Compares
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Attorney-quality documents at software prices
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 sm:p-4 font-semibold text-xs sm:text-sm"></th>
                      <th className="text-center p-2 sm:p-4 font-semibold text-muted-foreground text-xs sm:text-sm">DIY Templates</th>
                      <th className="text-center p-2 sm:p-4 font-semibold text-muted-foreground text-xs sm:text-sm">Local Attorney</th>
                      <th className="text-center p-2 sm:p-4 font-semibold bg-primary/5">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="mb-1 text-xs">Best Value</Badge>
                          <span className="text-primary text-xs sm:text-sm">LeaseShield</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4 font-medium text-xs sm:text-sm">Cost</td>
                      <td className="p-2 sm:p-4 text-center text-muted-foreground text-xs sm:text-sm">Free (risky!)</td>
                      <td className="p-2 sm:p-4 text-center text-muted-foreground text-xs sm:text-sm">$300-500/hr</td>
                      <td className="p-2 sm:p-4 text-center bg-primary/5">
                        <span className="font-bold text-primary text-xs sm:text-sm">$12/month</span>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4 font-medium text-xs sm:text-sm">State-Specific</td>
                      <td className="p-2 sm:p-4 text-center">
                        <X className="h-4 w-4 sm:h-5 sm:w-5 text-destructive mx-auto" />
                      </td>
                      <td className="p-2 sm:p-4 text-center">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mx-auto" />
                      </td>
                      <td className="p-2 sm:p-4 text-center bg-primary/5">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4 font-medium text-xs sm:text-sm">Professional Quality</td>
                      <td className="p-2 sm:p-4 text-center">
                        <X className="h-4 w-4 sm:h-5 sm:w-5 text-destructive mx-auto" />
                      </td>
                      <td className="p-2 sm:p-4 text-center">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mx-auto" />
                      </td>
                      <td className="p-2 sm:p-4 text-center bg-primary/5">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4 font-medium text-xs sm:text-sm">Auto Updates</td>
                      <td className="p-2 sm:p-4 text-center">
                        <X className="h-4 w-4 sm:h-5 sm:w-5 text-destructive mx-auto" />
                      </td>
                      <td className="p-2 sm:p-4 text-center text-muted-foreground text-xs sm:text-sm">Pay each time</td>
                      <td className="p-2 sm:p-4 text-center bg-primary/5">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4 font-medium text-xs sm:text-sm">{templateCount}+ Templates</td>
                      <td className="p-2 sm:p-4 text-center">
                        <X className="h-4 w-4 sm:h-5 sm:w-5 text-destructive mx-auto" />
                      </td>
                      <td className="p-2 sm:p-4 text-center text-muted-foreground text-xs sm:text-sm">Extra fees</td>
                      <td className="p-2 sm:p-4 text-center bg-primary/5">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4 font-medium text-xs sm:text-sm">24/7 Access</td>
                      <td className="p-2 sm:p-4 text-center">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mx-auto" />
                      </td>
                      <td className="p-2 sm:p-4 text-center">
                        <X className="h-4 w-4 sm:h-5 sm:w-5 text-destructive mx-auto" />
                      </td>
                      <td className="p-2 sm:p-4 text-center bg-primary/5">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mx-auto" />
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-4 font-medium text-xs sm:text-sm">Compliance Alerts</td>
                      <td className="p-2 sm:p-4 text-center">
                        <X className="h-4 w-4 sm:h-5 sm:w-5 text-destructive mx-auto" />
                      </td>
                      <td className="p-2 sm:p-4 text-center">
                        <X className="h-4 w-4 sm:h-5 sm:w-5 text-destructive mx-auto" />
                      </td>
                      <td className="p-2 sm:p-4 text-center bg-primary/5">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mx-auto" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mt-8"
          >
            <Button
              size="lg"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-comparison-trial"
              className="text-sm sm:text-base px-4 sm:px-8 w-full sm:w-auto"
            >
              <span className="hidden xs:inline">Start Free Trial - </span><span className="xs:hidden">Start Trial - </span>No Credit Card
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-20 md:py-28">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Calculate Your Savings
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              See how much LeaseShield saves you in Year 1
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <Card className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-primary/5 to-amber-500/5">
              <div className="space-y-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="rounded-full bg-primary/10 p-2 sm:p-3 flex-shrink-0">
                    <Calculator className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Without LeaseShield:</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-border/50 text-xs sm:text-sm">
                        <span className="text-muted-foreground">Attorney (3 hrs):</span>
                        <span className="font-semibold">$900</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-border/50 text-xs sm:text-sm">
                        <span className="text-muted-foreground">Lease drafting:</span>
                        <span className="font-semibold">$1,200</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-border/50 text-xs sm:text-sm">
                        <span className="text-muted-foreground">Eviction docs:</span>
                        <span className="font-semibold">$800</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-border/50 text-xs sm:text-sm">
                        <span className="text-muted-foreground">Compliance mistake:</span>
                        <span className="font-semibold text-destructive">$5,000</span>
                      </div>
                      <div className="flex justify-between items-center py-2 sm:py-3 bg-destructive/10 rounded-lg px-3 sm:px-4">
                        <span className="font-bold text-sm sm:text-lg">Total Cost:</span>
                        <span className="font-bold text-xl sm:text-2xl text-destructive">$7,900</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="rounded-full bg-success/10 p-2 sm:p-3 flex-shrink-0">
                    <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">With LeaseShield:</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-border/50 text-xs sm:text-sm">
                        <span className="text-muted-foreground">12 months:</span>
                        <span className="font-semibold">$144</span>
                      </div>
                      <div className="flex justify-between items-center py-2 sm:py-3 bg-success/10 rounded-lg px-3 sm:px-4">
                        <span className="font-bold text-sm sm:text-lg">Total Cost:</span>
                        <span className="font-bold text-xl sm:text-2xl text-success">$144</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 sm:pt-6 border-t-2 border-primary/20">
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">Your First-Year Savings:</p>
                    <p className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-success to-primary bg-clip-text text-transparent mb-3 sm:mb-4">
                      $7,756
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
                      That's a <strong className="text-foreground">5,386% ROI</strong> in Year 1
                    </p>
                    <Button
                      size="lg"
                      onClick={() => window.location.href = "/api/login"}
                      data-testid="button-roi-trial"
                      className="text-sm sm:text-base px-4 sm:px-8 w-full sm:w-auto"
                    >
                      Start Saving Today - Free Trial
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground px-4">
              Everything you need to protect your rental business
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <Card className="p-6 sm:p-8 border-2 border-primary/20 shadow-lg">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Award className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  <Badge variant="outline" className="text-xs sm:text-sm">Most Popular</Badge>
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold mb-2">LeaseShield App</h3>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-4xl sm:text-5xl font-bold text-foreground">$12</span>
                  <span className="text-base sm:text-lg text-muted-foreground">/month</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">7-day free trial • No credit card required</p>
              </div>

              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <li className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm sm:text-base">{templateCount}+ templates for UT, TX, ND, and SD</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm sm:text-base">Real-time legal compliance updates for your state</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm sm:text-base">Complete tenant screening toolkit & resources</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm sm:text-base">Step-by-step guidance for every document</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm sm:text-base">Email alerts when laws change in your state</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm sm:text-base">Cancel anytime, no questions asked</span>
                </li>
              </ul>

              <Button
                size="lg"
                className="w-full text-sm sm:text-base"
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-pricing-trial"
              >
                Start Your Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground px-4">
              Everything you need to know about LeaseShield App
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>What states does LeaseShield App currently support?</AccordionTrigger>
                <AccordionContent>
                  We currently serve landlords in Utah, Texas, North Dakota, and South Dakota with
                  comprehensive state-specific templates and compliance guidance. We're expanding to
                  additional states soon—sign up to get notified when your state is added!
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Are the templates state-specific and up to date?</AccordionTrigger>
                <AccordionContent>
                  Yes! Every template in our library is tailored to each state's specific laws and requirements.
                  We monitor state legislation and update templates whenever laws change to help you stay compliant.
                  However, these are general forms for informational purposes only and we recommend having them reviewed by your own attorney for your specific situation.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Can I cancel my subscription anytime?</AccordionTrigger>
                <AccordionContent>
                  Absolutely. You can cancel your subscription at any time with no cancellation fees
                  or penalties. Your access will continue until the end of your current billing period.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Do I need a credit card for the free trial?</AccordionTrigger>
                <AccordionContent>
                  No! Your 7-day free trial starts immediately with just your email address. You'll
                  only need to add payment information if you choose to continue after the trial ends.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>How often are legal updates published?</AccordionTrigger>
                <AccordionContent>
                  We monitor state legislatures and courts continuously. When a law changes that could
                  affect your liability or requirements, we'll send you an email alert within 48 hours
                  along with clear before/after explanations and updated templates if needed.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6">
                <AccordionTrigger>What if I have properties in multiple states?</AccordionTrigger>
                <AccordionContent>
                  One subscription gives you access to all supported states. You can easily switch
                  between states in your dashboard to access the correct templates and compliance
                  information for each property.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Stop Risking $5,000+ Mistakes
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto px-4">
              Join 500+ landlords protecting their rental businesses with state-specific templates 
              and compliance alerts. Get your first lease ready in 5 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-final-cta"
                className="text-base px-8"
              >
                Get Your First Lease in 5 Minutes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowAllFeatures(true)}
                data-testid="button-final-learn"
                className="text-base px-8"
              >
                Learn More About Features
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              No credit card required • 7-day free trial • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* All Features Dialog */}
      <Dialog open={showAllFeatures} onOpenChange={setShowAllFeatures}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-display">Everything You Get with LeaseShield App</DialogTitle>
            <DialogDescription className="text-base">
              Comprehensive landlord protection for UT, TX, ND, and SD properties
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-6 space-y-8">
            {Object.entries(featureDetails).map(([key, feature]) => {
              const IconComponent = feature.icon;
              return (
                <div key={key} className="border-b pb-6 last:border-b-0">
                  <div className="flex items-start gap-3 mb-4">
                    <IconComponent className="h-7 w-7 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground mb-4">{feature.description}</p>
                      <ul className="space-y-2">
                        {feature.details.map((detail, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t bg-muted/30 -mx-6 px-6 -mb-6 pb-6">
            <div className="text-center space-y-4">
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">{templateCount}+</div>
                  <div className="text-sm text-muted-foreground">Legal Templates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">4</div>
                  <div className="text-sm text-muted-foreground">States Covered</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">$12</div>
                  <div className="text-sm text-muted-foreground">Per Month</div>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full text-base"
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-features-dialog-trial"
              >
                Start Your 7-Day Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-sm text-muted-foreground">
                No credit card required • Cancel anytime
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feature Details Dialog */}
      <Dialog open={selectedFeature !== null} onOpenChange={() => setSelectedFeature(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedFeature && featureDetails[selectedFeature] && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  {(() => {
                    const IconComponent = featureDetails[selectedFeature].icon;
                    return <IconComponent className="h-8 w-8 text-primary" />;
                  })()}
                  <DialogTitle className="text-2xl">{featureDetails[selectedFeature].title}</DialogTitle>
                </div>
                <DialogDescription className="text-base">
                  {featureDetails[selectedFeature].description}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6">
                <h4 className="font-semibold text-foreground mb-4">What's Included:</h4>
                <ul className="space-y-3">
                  {featureDetails[selectedFeature].details.map((detail, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 pt-6 border-t">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => window.location.href = "/api/login"}
                  data-testid="button-dialog-start-trial"
                >
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  7-day free trial • No credit card required
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Subscription Benefits Dialog */}
      <Dialog open={showBenefitsDialog} onOpenChange={setShowBenefitsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">What You Get With LeaseShield</DialogTitle>
            <DialogDescription>
              Everything you need to manage your rental business confidently
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{templateCount}+ State-Specific Templates</p>
                  <p className="text-sm text-muted-foreground">Download as PDF or fill online</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Live Compliance Monitoring</p>
                  <p className="text-sm text-muted-foreground">Instant alerts when laws change</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Before/After Guidance</p>
                  <p className="text-sm text-muted-foreground">Clear explanations of legal changes</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Tenant Screening Toolkit</p>
                  <p className="text-sm text-muted-foreground">Red flags and best practices</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Fair Housing Compliance</p>
                  <p className="text-sm text-muted-foreground">Avoid $10,000+ in federal fines</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">24/7 Access to All Resources</p>
                  <p className="text-sm text-muted-foreground">Your complete landlord toolkit</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">7-Day Free Trial</p>
                  <p className="text-sm text-muted-foreground">No credit card required</p>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t">
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => {
                  setShowBenefitsDialog(false);
                  window.location.href = "/api/login";
                }}
              >
                Start Your Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={showTemplatePreview} onOpenChange={setShowTemplatePreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Utah Residential Lease Agreement - Preview
            </DialogTitle>
            <DialogDescription>
              See the quality and detail of our professional templates
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-foreground font-medium mb-2">This is a preview excerpt</p>
              <p className="text-sm text-muted-foreground">
                Full template available to members. Includes fillable fields, customization guidance, and state-specific clauses.
              </p>
            </div>

            <div className="bg-muted/30 border rounded-lg p-6 font-mono text-sm space-y-4">
              <div className="border-b pb-4">
                <h3 className="font-bold text-base mb-2">RESIDENTIAL LEASE AGREEMENT</h3>
                <p className="text-muted-foreground">State of Utah</p>
              </div>

              <div>
                <p className="font-semibold mb-2">1. PARTIES</p>
                <p className="text-muted-foreground">
                  This Lease Agreement ("Agreement") is entered into on [DATE] between:
                </p>
                <p className="ml-4 text-muted-foreground">
                  LANDLORD: [Your Name] ("Landlord")<br />
                  TENANT(S): [Tenant Name(s)] ("Tenant")
                </p>
              </div>

              <div>
                <p className="font-semibold mb-2">2. PROPERTY</p>
                <p className="text-muted-foreground">
                  Landlord hereby leases to Tenant the property located at:<br />
                  [Property Address], [City], Utah [ZIP Code]
                </p>
              </div>

              <div>
                <p className="font-semibold mb-2">3. TERM</p>
                <p className="text-muted-foreground">
                  The lease term shall begin on [START DATE] and end on [END DATE], for a total term 
                  of [MONTHS/YEARS]. This Agreement shall automatically convert to a month-to-month 
                  tenancy unless either party provides written notice of termination at least 
                  [30/60] days prior to the end date, in accordance with Utah Code § 57-22-4.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-2">4. RENT</p>
                <p className="text-muted-foreground">
                  Tenant agrees to pay monthly rent of $[AMOUNT], due on the [DAY] day of each month. 
                  Rent shall be paid to [Payment Method/Address].<br /><br />
                  <strong>Late Fee:</strong> If rent is not received by the [DAY] day of the month, 
                  a late fee of $[AMOUNT] will be assessed, in compliance with Utah Code § 57-22-4(3).
                </p>
              </div>

              <div>
                <p className="font-semibold mb-2">5. SECURITY DEPOSIT (Utah Code § 57-17-1 et seq.)</p>
                <p className="text-muted-foreground">
                  Tenant shall deposit $[AMOUNT] as a security deposit. This deposit will be held 
                  in accordance with Utah law and returned within 30 days of lease termination, 
                  less any lawful deductions for damages beyond normal wear and tear...
                </p>
              </div>

              <div className="text-center py-4 border-t border-dashed">
                <p className="text-muted-foreground italic">... continues for 12 more pages with all required clauses ...</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-4">
                <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-foreground mb-1">What You Get:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Complete 15-page Utah-compliant lease agreement</li>
                    <li>• All required disclosures and addendums</li>
                    <li>• Fillable PDF with guided instructions</li>
                    <li>• Editable Word document for customization</li>
                    <li>• Regular updates when Utah laws change</li>
                  </ul>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  setShowTemplatePreview(false);
                  window.location.href = "/api/login";
                }}
                data-testid="button-preview-trial"
              >
                Get Your First Lease in 5 Minutes - Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                No credit card required • 30-day money-back guarantee
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Logo iconSize={28} />
                <span className="font-display font-semibold text-lg">LeaseShield App</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your protective mentor for confident, risk-free property management.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><Link to="/blog" className="hover:text-foreground transition-colors">Blog & Resources</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">States</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Utah</li>
                <li>Texas</li>
                <li>North Dakota</li>
                <li>South Dakota</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Support & Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/help" className="hover:text-foreground transition-colors">Help Center</Link></li>
                <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
                <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link></li>
                <li><Link to="/disclaimers" className="hover:text-foreground transition-colors">Legal Disclaimers</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Chat Widget */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="mb-4"
            >
              <Card className="w-[380px] h-[500px] flex flex-col shadow-2xl border-primary/20">
                {/* Chat Header */}
                <div className="bg-primary text-primary-foreground rounded-t-lg">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                      <Logo iconSize={20} className="brightness-0 invert" />
                      <span className="font-semibold">LeaseShield Assistant</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={() => setChatOpen(false)}
                      data-testid="button-close-chat"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="px-4 pb-3 text-xs opacity-90">
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    Educational information only, not legal advice
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium mb-1">Hi! I'm your LeaseShield Assistant</p>
                      <p className="text-xs">Ask me anything about landlord-tenant law or LeaseShield features!</p>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                          msg.type === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card border'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-card border rounded-lg px-4 py-2 text-sm">
                        <span className="inline-flex gap-1">
                          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                          <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                          <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                        </span>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <form onSubmit={handleChatSubmit} className="p-4 border-t bg-background">
                  <div className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask about leases, compliance, or features..."
                      className="flex-1"
                      disabled={isTyping}
                      data-testid="input-chat-message"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isTyping || !chatInput.trim()}
                      data-testid="button-send-chat"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Toggle Button */}
        <div className="flex flex-col items-end gap-2">
          {!chatOpen && (
            <div className="bg-card border shadow-lg rounded-lg px-3 py-2 text-xs text-muted-foreground max-w-[200px]">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              AI assistant • Info only, not legal advice
            </div>
          )}
          <Button
            size="lg"
            onClick={() => setChatOpen(!chatOpen)}
            className="h-14 w-14 rounded-full shadow-2xl"
            data-testid="button-toggle-chat"
          >
            {chatOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <MessageCircle className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
