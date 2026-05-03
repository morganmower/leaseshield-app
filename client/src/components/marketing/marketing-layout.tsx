import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

interface MarketingLayoutProps {
  children: ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
          <Link to="/" className="flex items-center hover:opacity-80 transition-opacity" data-testid="link-home">
            <Logo variant="horizontal" size="lg" />
          </Link>
          <nav className="hidden lg:flex items-center gap-5 ml-6 text-sm font-medium">
            <Link to="/rental-management-system" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-system">System</Link>
            <Link to="/tenant-screening-services" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-screening">Screening</Link>
            <Link to="/screening-report-decoder" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-decoder">Decoder</Link>
            <Link to="/rental-application-software" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-applications">Applications</Link>
            <Link to="/rent-collection-software" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-rent">Rent</Link>
            <Link to="/landlord-forms-and-notices" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-forms">Forms</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3 ml-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              onClick={() => setLocation("/login")}
              data-testid="button-login"
              className="text-sm sm:text-base min-h-[48px]"
            >
              Log In
            </Button>
            <Button
              onClick={() => setLocation("/signup")}
              data-testid="button-signup-header"
              size="lg"
              className="bg-brand-500 hover:bg-brand-600 text-white text-base sm:text-lg px-6 sm:px-8 py-3 min-h-[48px]"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t py-12 bg-muted/30">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="mb-4">
                <Logo variant="horizontal" size="md" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your protective mentor for confident, risk-free property management.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/rental-management-system" className="hover:text-foreground transition-colors" data-testid="footer-link-system">Rental Management</Link></li>
                <li><Link to="/tenant-screening-services" className="hover:text-foreground transition-colors" data-testid="footer-link-screening">Tenant Screening</Link></li>
                <li><Link to="/screening-report-decoder" className="hover:text-foreground transition-colors" data-testid="footer-link-decoder">Screening Decoder</Link></li>
                <li><Link to="/rental-application-software" className="hover:text-foreground transition-colors" data-testid="footer-link-applications">Applications</Link></li>
                <li><Link to="/rent-collection-software" className="hover:text-foreground transition-colors" data-testid="footer-link-rent">Rent Collection</Link></li>
                <li><Link to="/landlord-forms-and-notices" className="hover:text-foreground transition-colors" data-testid="footer-link-forms">Forms &amp; Notices</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">States</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Utah, Texas, North Dakota</li>
                <li>South Dakota, North Carolina, Ohio</li>
                <li>Michigan, Idaho, Wyoming</li>
                <li>California, Virginia, Nevada</li>
                <li>Arizona, Florida, Illinois</li>
                <li>New Mexico</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Support &amp; Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/help" className="hover:text-foreground transition-colors" data-testid="footer-link-help">Help Center</Link></li>
                <li><Link to="/contact" className="hover:text-foreground transition-colors" data-testid="footer-link-contact">Contact</Link></li>
                <li><Link to="/blog" className="hover:text-foreground transition-colors" data-testid="footer-link-blog">Blog</Link></li>
                <li><Link to="/terms" className="hover:text-foreground transition-colors" data-testid="footer-link-terms">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-foreground transition-colors" data-testid="footer-link-privacy">Privacy Policy</Link></li>
                <li><Link to="/refund-policy" className="hover:text-foreground transition-colors" data-testid="footer-link-refund">Refund Policy</Link></li>
                <li><Link to="/disclaimers" className="hover:text-foreground transition-colors" data-testid="footer-link-disclaimers">Legal Disclaimers</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
