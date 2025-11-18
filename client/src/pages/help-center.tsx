import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft, Book, FileText, Scale, Users, MessageCircle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

export default function HelpCenter() {
  const { isAuthenticated, isLoading } = useAuth();

  const handleQuickLinkClick = (href: string) => {
    // If not authenticated and trying to access protected routes, redirect to login
    if (!isAuthenticated && (href === '/templates' || href === '/compliance' || href === '/screening')) {
      window.location.href = '/api/login';
    } else {
      window.location.href = href;
    }
  };

  const faqs = [
    {
      category: "Getting Started",
      icon: Book,
      questions: [
        {
          q: "How do I access legal templates?",
          a: "After subscribing, navigate to the Templates section from your dashboard. Select your state (UT, TX, ND, or SD), choose the template you need, and download it in Word or PDF format. Each template includes step-by-step instructions for customization."
        },
        {
          q: "What's included in my subscription?",
          a: "Your subscription includes unlimited access to 37+ state-specific legal templates, compliance guidance cards, tenant screening resources, legal update notifications, and our credit report decoder toolkit. Everything you need to manage your rental properties with confidence."
        },
        {
          q: "Can I cancel my subscription anytime?",
          a: "Yes, you can cancel your subscription at any time from your Settings page. You'll continue to have access until the end of your current billing period."
        }
      ]
    },
    {
      category: "Legal Templates",
      icon: FileText,
      questions: [
        {
          q: "Are these templates legally valid?",
          a: "All our templates are reviewed by attorneys familiar with landlord-tenant law in UT, TX, ND, and SD. However, they are provided for educational purposes. We recommend reviewing them with your own attorney for your specific situation."
        },
        {
          q: "How often are templates updated?",
          a: "We monitor state law changes continuously and update templates as needed to reflect new legal requirements. You'll receive notifications when templates in your preferred state are updated."
        },
        {
          q: "Can I customize the templates?",
          a: "Absolutely! All templates are provided in editable formats (Word and PDF). We include guidance on which sections can be customized and which provisions should remain as-is for legal compliance."
        }
      ]
    },
    {
      category: "Compliance & Legal Updates",
      icon: Scale,
      questions: [
        {
          q: "How do I stay updated on law changes?",
          a: "Enable notifications in your Settings to receive email alerts about legal updates affecting your state. You can also check the Compliance section regularly for the latest changes and guidance."
        },
        {
          q: "What if I miss a legal update?",
          a: "All legal updates are archived in the Compliance section, organized by state and impact level. You can review past updates anytime to ensure you're caught up."
        },
        {
          q: "Do you provide legal advice?",
          a: "No, LeaseShield Pro provides educational templates and compliance guidance only. We do not provide legal advice or representation. For specific legal questions about your situation, please consult with a licensed attorney."
        }
      ]
    },
    {
      category: "Tenant Screening",
      icon: Users,
      questions: [
        {
          q: "How does the credit report decoder work?",
          a: "Our credit report decoder helps you understand the key sections of tenant credit reports, including payment history, debt-to-income ratios, and red flags. It's a educational tool to help you make informed decisions."
        },
        {
          q: "Does LeaseShield Pro run background checks?",
          a: "No, we don't run background checks directly. We provide guidance and resources to help you understand screening reports and integrate with Western Verify (www.westernverify.com) for comprehensive tenant screening."
        },
        {
          q: "What should I look for when screening tenants?",
          a: "Visit our Screening section for detailed checklists covering credit history, rental history, income verification, and criminal background checks. We provide state-specific guidance on fair housing requirements."
        }
      ]
    }
  ];

  const quickLinks = [
    { title: "Download Templates", icon: FileText, href: "/templates" },
    { title: "Check Compliance", icon: Scale, href: "/compliance" },
    { title: "Screen Tenants", icon: Users, href: "/screening" },
    { title: "Contact Support", icon: MessageCircle, href: "/contact" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" data-testid="link-home">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="font-display text-base sm:text-xl font-semibold text-foreground">
              LeaseShield Pro
            </span>
          </a>
          <Button
            variant="ghost"
            onClick={() => window.location.href = "/"}
            data-testid="button-back-home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <motion.div
            className="text-center max-w-3xl mx-auto"
            {...fadeIn}
          >
            <div className="flex items-center justify-center gap-2 mb-6">
              <Book className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-4">
              Help Center
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Everything you need to know about using LeaseShield Pro
            </p>
          </motion.div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link, index) => (
            <motion.div
              key={link.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card 
                className="hover-elevate active-elevate-2 cursor-pointer" 
                onClick={() => handleQuickLinkClick(link.href)}
                data-testid={`card-quick-${link.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <link.icon className="h-6 w-6 text-primary" />
                    <span className="font-semibold text-foreground">{link.title}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-8">
          {faqs.map((section, sectionIndex) => (
            <motion.div
              key={section.category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + sectionIndex * 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <section.icon className="h-6 w-6 text-primary" />
                    {section.category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {section.questions.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-foreground mb-2">{item.q}</h3>
                          <p className="text-muted-foreground leading-relaxed">{item.a}</p>
                        </div>
                      </div>
                      {index < section.questions.length - 1 && (
                        <div className="border-t mt-4" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Still Need Help */}
        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1 }}
        >
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-foreground mb-3">
                Still have questions?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Can't find what you're looking for? Our support team is here to help you get the most out of LeaseShield Pro.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  onClick={() => window.location.href = "/contact"}
                  data-testid="button-contact-support"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Contact Support
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => window.location.href = "mailto:support@leaseshieldpro.com"}
                  data-testid="button-email-support"
                >
                  Email Us
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                We typically respond within 24-48 hours
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
