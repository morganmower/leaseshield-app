import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface RouteContext {
  title: string;
  breadcrumbs?: { label: string; path?: string }[];
  showState?: boolean;
}

const routeMap: Record<string, RouteContext> = {
  "/dashboard": { title: "Dashboard", showState: true },
  "/templates": { title: "Templates", showState: true },
  "/my-documents": { title: "My Documents" },
  "/properties": { title: "Properties" },
  "/compliance": { title: "Compliance", showState: true },
  "/screening": { title: "Screening Toolkit" },
  "/tenant-issues": { title: "Tenant Issues", showState: true },
  "/billing": { title: "Billing & Subscription" },
  "/settings": { title: "Settings" },
  "/help": { title: "Help Center" },
  "/admin": { title: "Admin Dashboard" },
  "/admin/dashboard": { 
    title: "Analytics", 
    breadcrumbs: [{ label: "Admin" }, { label: "Analytics" }] 
  },
  "/admin/templates": { 
    title: "Manage Templates", 
    breadcrumbs: [{ label: "Admin" }, { label: "Templates" }] 
  },
  "/admin/compliance": { 
    title: "Manage Compliance", 
    breadcrumbs: [{ label: "Admin" }, { label: "Compliance" }] 
  },
  "/admin/legal-updates": { 
    title: "Manage Legal Updates", 
    breadcrumbs: [{ label: "Admin" }, { label: "Legal Updates" }] 
  },
  "/admin/legislative-monitoring": { 
    title: "Legislative Monitoring", 
    breadcrumbs: [{ label: "Admin" }, { label: "Legislative Monitoring" }] 
  },
  "/admin/analytics": { 
    title: "Analytics", 
    breadcrumbs: [{ label: "Admin" }, { label: "Analytics" }] 
  },
};

export function HeaderContext() {
  const [location] = useLocation();
  const { user } = useAuth();

  let context: RouteContext = { title: "" };

  if (location.startsWith("/templates/") && location.includes("/fill")) {
    context = {
      title: "Document Wizard",
      breadcrumbs: [
        { label: "Templates", path: "/templates" },
        { label: "Fill Document" },
      ],
    };
  } else {
    context = routeMap[location] || { title: "" };
  }

  if (!context.title) return null;

  return (
    <div className="flex items-center gap-3">
      {context.breadcrumbs ? (
        <div className="flex items-center gap-2 text-sm">
          {context.breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              <span className={index === context.breadcrumbs!.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}>
                {crumb.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <h1 className="text-lg font-semibold text-foreground">{context.title}</h1>
      )}
      
      {context.showState && user?.preferredState && (
        <Badge variant="secondary" className="text-xs">
          {user.preferredState}
        </Badge>
      )}
    </div>
  );
}
