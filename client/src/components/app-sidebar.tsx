import {
  Shield,
  FileText,
  Search,
  AlertCircle,
  Settings,
  LayoutDashboard,
  BookOpen,
  CreditCard,
  ShieldCheck,
  ChevronDown,
  LogOut,
  FolderOpen,
  Building2,
  MessageCircle,
  DollarSign,
  Mail,
  FileCheck2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    iconColor: "text-primary",
  },
  {
    title: "Templates",
    url: "/templates",
    icon: FileText,
    iconColor: "text-blue-500 dark:text-blue-400",
  },
  {
    title: "My Documents",
    url: "/my-documents",
    icon: FolderOpen,
    iconColor: "text-amber-500 dark:text-amber-400",
  },
  {
    title: "Properties",
    url: "/properties",
    icon: Building2,
    iconColor: "text-indigo-500 dark:text-indigo-400",
  },
  {
    title: "Applications",
    url: "/rental-submissions",
    icon: FileCheck2,
    iconColor: "text-emerald-500 dark:text-emerald-400",
  },
  {
    title: "Compliance",
    url: "/compliance",
    icon: Shield,
    iconColor: "text-primary",
  },
  {
    title: "Screening Helpers",
    url: "/screening",
    icon: Search,
    iconColor: "text-violet-500 dark:text-violet-400",
  },
  {
    title: "Tenant Issues",
    url: "/tenant-issues",
    icon: AlertCircle,
    iconColor: "text-orange-500 dark:text-orange-400",
  },
  {
    title: "Legal Updates",
    url: "/legal-updates",
    icon: BookOpen,
    iconColor: "text-cyan-500 dark:text-cyan-400",
  },
  {
    title: "Communications",
    url: "/communications",
    icon: MessageCircle,
    iconColor: "text-pink-500 dark:text-pink-400",
  },
  {
    title: "Rent Ledger",
    url: "/rent-ledger",
    icon: DollarSign,
    iconColor: "text-green-600 dark:text-green-400",
  },
];

const resourceItems = [
  {
    title: "Help Center",
    url: "/help",
    icon: BookOpen,
    iconColor: "text-sky-500 dark:text-sky-400",
  },
];

const accountItems = [
  {
    title: "Admin",
    url: "/admin",
    icon: ShieldCheck,
    iconColor: "text-red-500 dark:text-red-400",
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
    iconColor: "text-emerald-500 dark:text-emerald-400",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    iconColor: "text-slate-500 dark:text-slate-400",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { setOpenMobile } = useSidebar();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count || 0;

  const handleNavClick = () => {
    setOpenMobile(false);
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <Link href="/dashboard" onClick={handleNavClick}>
          <div className="flex items-center cursor-pointer hover-elevate rounded-lg p-2 -m-2 transition-all overflow-hidden">
            <Logo variant="horizontal" className="h-56 -my-8" />
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-6">
        <SidebarGroup className="mb-6">
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} className="h-10">
                    <Link href={item.url} onClick={handleNavClick} data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}>
                      <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="border-t my-4" />

        <SidebarGroup className="mb-6">
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
            Resources
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {resourceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} className="h-10">
                    <Link href={item.url} onClick={handleNavClick} data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}>
                      <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="border-t my-4" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/messages"} className="h-10">
                  <Link href="/messages" onClick={handleNavClick} data-testid="link-messages">
                    <Mail className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                    <span className="font-medium flex-1">Messages</span>
                    {unreadCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="ml-auto h-5 min-w-5 px-1.5 text-xs animate-pulse"
                        data-testid="badge-unread-messages"
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {accountItems
                .filter((item) => item.title !== "Admin" || user?.isAdmin)
                .map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} className="h-10">
                    <Link href={item.url} onClick={handleNavClick} data-testid={`link-${item.title.toLowerCase()}`}>
                      <item.icon className={`h-5 w-5 ${item.iconColor || ''}`} />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t bg-sidebar-accent/30">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between gap-3 px-3 py-2 h-auto hover-elevate rounded-lg"
              data-testid="button-user-menu"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 border-2 border-primary/20">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-sm font-semibold truncate w-full">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email || "User"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate w-full">
                    {user?.subscriptionStatus === 'active' ? 'Active Subscriber' : user?.subscriptionStatus === 'trialing' ? 'Free Trial' : 'Free'}
                  </span>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/settings" data-testid="link-profile-settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing" data-testid="link-profile-billing">
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              data-testid="button-logout"
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
