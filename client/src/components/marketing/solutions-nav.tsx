import { Link } from "wouter";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Building2, Search, Sparkles, ClipboardList, Receipt, FileText } from "lucide-react";

export const SOLUTIONS_ITEMS = [
  { to: "/rental-management-system", icon: Building2, title: "Rental Management System", desc: "All-in-one workflow", testid: "solutions-link-system" },
  { to: "/tenant-screening-services", icon: Search, title: "Tenant Screening", desc: "County-level verification", testid: "solutions-link-screening" },
  { to: "/screening-report-decoder", icon: Sparkles, title: "Screening Report Decoder", desc: "Plain-English risk flags", testid: "solutions-link-decoder" },
  { to: "/rental-application-software", icon: ClipboardList, title: "Rental Applications", desc: "Screening-ready forms", testid: "solutions-link-applications" },
  { to: "/rent-collection-software", icon: Receipt, title: "Online Rent Collection", desc: "ACH tied to your lease", testid: "solutions-link-rent" },
  { to: "/landlord-forms-and-notices", icon: FileText, title: "Forms & Notices", desc: "State-compliant templates", testid: "solutions-link-forms" },
];

const items = SOLUTIONS_ITEMS;

export function SolutionsNav() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="text-sm font-medium bg-transparent" data-testid="nav-solutions-trigger">
            Solutions
          </NavigationMenuTrigger>
          <NavigationMenuContent className="p-3">
            <div className="grid grid-cols-2 gap-1 w-[560px]">
              {items.map((it) => (
                <Link key={it.to} to={it.to} data-testid={it.testid} className="flex items-start gap-3 p-3 rounded-md hover-elevate">
                  <div className="p-2 bg-primary/10 rounded-md flex-shrink-0">
                    <it.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-semibold leading-snug">{it.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{it.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
