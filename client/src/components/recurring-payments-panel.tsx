import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Repeat, Loader2, Copy, Mail, Pause, Play, X, Trash2, ExternalLink,
} from "lucide-react";

interface RentSubscription {
  id: string;
  tenantName: string;
  tenantEmail: string;
  amount: number;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  nextScheduledDate: string | null;
  lateFeeAmount: number;
  gracePeriodDays: number;
  status: string;
  rentalPropertyId: string | null;
  bankAccountLast4: string | null;
  bankAccountBankName: string | null;
  publicToken: string;
  description: string | null;
  authorizationLink?: string;
}

interface PropertyOption {
  id: string;
  name: string;
}

interface Props {
  properties: PropertyOption[];
}

const STATUS_BADGE: Record<string, { label: string; variant: any }> = {
  pending_authorization: { label: "Pending Authorization", variant: "outline" },
  active: { label: "Active", variant: "default" },
  paused: { label: "Paused", variant: "secondary" },
  revoked_by_tenant: { label: "Tenant Canceled", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
  canceled: { label: "Canceled", variant: "destructive" },
  completed: { label: "Completed", variant: "outline" },
};

export function RecurringPaymentsPanel({ properties }: Props) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: subs = [], isLoading } = useQuery<RentSubscription[]>({
    queryKey: ["/api/rent-subscriptions"],
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/rent-subscriptions"] });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/rent-subscriptions/${id}/resend-authorization`);
      return r.json();
    },
    onSuccess: () => toast({ title: "Authorization email sent" }),
    onError: (e: any) => toast({ title: "Could not send", description: e.message, variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: async (vars: { id: string; body: any }) => {
      const r = await apiRequest("PATCH", `/api/rent-subscriptions/${vars.id}`, vars.body);
      return r.json();
    },
    onSuccess: () => { refresh(); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/rent-subscriptions/${id}`);
    },
    onSuccess: () => { refresh(); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              Recurring Auto-Pay
            </CardTitle>
            <CardDescription className="mt-1">
              Set up monthly bank-to-bank rent debits. Tenants authorize once via NACHA-compliant ACH mandate; LeaseShield handles every debit after that.
            </CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-recurring">
                <Plus className="h-4 w-4 mr-2" />
                New Auto-Pay
              </Button>
            </DialogTrigger>
            <CreateRecurringDialog
              properties={properties}
              onSuccess={(created) => {
                refresh();
                setCreateOpen(false);
                if (created.authorizationLink) {
                  copyLink(created.authorizationLink);
                  toast({
                    title: "Subscription created",
                    description: "Authorization link copied. Send it to your tenant.",
                  });
                }
              }}
            />
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : subs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Repeat className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium mb-1">No recurring auto-pay set up yet</p>
              <p className="text-sm">Click "New Auto-Pay" to invite a tenant to authorize monthly debits.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subs.map((sub) => {
                const badge = STATUS_BADGE[sub.status] || { label: sub.status, variant: "outline" };
                const link = sub.authorizationLink || `${window.location.origin}/auto-pay/${sub.publicToken}`;
                const isPending = sub.status === "pending_authorization";
                const isActive = sub.status === "active";
                const isPaused = sub.status === "paused";
                return (
                  <Card key={sub.id} data-testid={`card-sub-${sub.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-[240px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold" data-testid={`text-sub-tenant-${sub.id}`}>{sub.tenantName}</span>
                            <Badge variant={badge.variant} data-testid={`badge-sub-status-${sub.id}`}>{badge.label}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">{sub.tenantEmail}</div>
                          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                            <div><span className="text-muted-foreground">Amount:</span> <strong>${(sub.amount / 100).toFixed(2)}/mo</strong></div>
                            <div><span className="text-muted-foreground">Day:</span> <strong>{sub.dayOfMonth}</strong></div>
                            <div><span className="text-muted-foreground">Starts:</span> <strong>{sub.startDate}</strong></div>
                            {sub.nextScheduledDate && isActive && (
                              <div><span className="text-muted-foreground">Next debit:</span> <strong>{sub.nextScheduledDate}</strong></div>
                            )}
                            {sub.bankAccountBankName && sub.bankAccountLast4 && (
                              <div><span className="text-muted-foreground">Bank:</span> <strong>{sub.bankAccountBankName} ••{sub.bankAccountLast4}</strong></div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {isPending && (
                            <>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => copyLink(link)}
                                data-testid={`button-copy-link-${sub.id}`}
                              >
                                <Copy className="h-4 w-4 mr-2" />Copy Link
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => resendMutation.mutate(sub.id)}
                                disabled={resendMutation.isPending}
                                data-testid={`button-resend-${sub.id}`}
                              >
                                <Mail className="h-4 w-4 mr-2" />Resend Email
                              </Button>
                              <a href={link} target="_blank" rel="noreferrer">
                                <Button variant="outline" size="sm" data-testid={`button-open-link-${sub.id}`}>
                                  <ExternalLink className="h-4 w-4 mr-2" />Preview
                                </Button>
                              </a>
                              <Button
                                variant="ghost" size="icon"
                                onClick={() => deleteMutation.mutate(sub.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${sub.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {isActive && (
                            <Button
                              variant="outline" size="sm"
                              onClick={() => patchMutation.mutate({ id: sub.id, body: { status: "paused" } })}
                              disabled={patchMutation.isPending}
                              data-testid={`button-pause-${sub.id}`}
                            >
                              <Pause className="h-4 w-4 mr-2" />Pause
                            </Button>
                          )}
                          {isPaused && (
                            <Button
                              variant="outline" size="sm"
                              onClick={() => patchMutation.mutate({ id: sub.id, body: { status: "active" } })}
                              disabled={patchMutation.isPending}
                              data-testid={`button-resume-${sub.id}`}
                            >
                              <Play className="h-4 w-4 mr-2" />Resume
                            </Button>
                          )}
                          {(isActive || isPaused) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" data-testid={`button-cancel-${sub.id}`}>
                                  <X className="h-4 w-4 mr-2" />Cancel
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel auto-pay for {sub.tenantName}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    No more debits will be attempted. The tenant's bank PaymentMethod will be detached. This cannot be undone — they'll need a new authorization link to set up auto-pay again.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep Active</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => patchMutation.mutate({ id: sub.id, body: { status: "canceled" } })}
                                  >
                                    Yes, Cancel
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateRecurringDialog({
  properties,
  onSuccess,
}: {
  properties: PropertyOption[];
  onSuccess: (created: RentSubscription) => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [lateFeeDollars, setLateFeeDollars] = useState("0");
  const [gracePeriodDays, setGracePeriodDays] = useState("5");
  const [rentalPropertyId, setRentalPropertyId] = useState<string>("none");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/rent-subscriptions", {
        tenantName,
        tenantEmail,
        amountDollars,
        dayOfMonth: parseInt(dayOfMonth, 10) || 1,
        startDate,
        endDate: endDate || undefined,
        lateFeeDollars,
        gracePeriodDays: parseInt(gracePeriodDays, 10) || 0,
        rentalPropertyId: rentalPropertyId === "none" ? undefined : rentalPropertyId,
        description: description || undefined,
      });
      return r.json();
    },
    onSuccess: (created) => onSuccess(created),
    onError: (e: any) => toast({ title: "Could not create", description: e.message, variant: "destructive" }),
  });

  return (
    <DialogContent className="max-w-lg" data-testid="dialog-create-recurring">
      <DialogHeader>
        <DialogTitle>New Auto-Pay Subscription</DialogTitle>
        <DialogDescription>
          We'll generate a NACHA-compliant authorization link for the tenant. Debits start once they connect their bank.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rec-name">Tenant Name</Label>
            <Input id="rec-name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} data-testid="input-rec-tenant-name" />
          </div>
          <div>
            <Label htmlFor="rec-email">Tenant Email</Label>
            <Input id="rec-email" type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} data-testid="input-rec-tenant-email" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rec-amount">Monthly Amount ($)</Label>
            <Input id="rec-amount" type="number" min="1" step="0.01" value={amountDollars} onChange={(e) => setAmountDollars(e.target.value)} data-testid="input-rec-amount" />
          </div>
          <div>
            <Label htmlFor="rec-day">Day of Month (1–28)</Label>
            <Input id="rec-day" type="number" min="1" max="28" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} data-testid="input-rec-day" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rec-start">First Debit Date</Label>
            <Input id="rec-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-rec-start" />
          </div>
          <div>
            <Label htmlFor="rec-end">Lease End (optional)</Label>
            <Input id="rec-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="input-rec-end" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rec-late">Late Fee ($, optional)</Label>
            <Input id="rec-late" type="number" min="0" step="0.01" value={lateFeeDollars} onChange={(e) => setLateFeeDollars(e.target.value)} data-testid="input-rec-late-fee" />
          </div>
          <div>
            <Label htmlFor="rec-grace">Grace Period (days)</Label>
            <Input id="rec-grace" type="number" min="0" value={gracePeriodDays} onChange={(e) => setGracePeriodDays(e.target.value)} data-testid="input-rec-grace" />
          </div>
        </div>
        <div>
          <Label htmlFor="rec-property">Property (optional)</Label>
          <Select value={rentalPropertyId} onValueChange={setRentalPropertyId}>
            <SelectTrigger id="rec-property" data-testid="select-rec-property">
              <SelectValue placeholder="No property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No property</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="rec-desc">Description (optional)</Label>
          <Textarea id="rec-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-rec-description" />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={
            createMutation.isPending ||
            !tenantName.trim() ||
            !tenantEmail.trim() ||
            !amountDollars ||
            parseFloat(amountDollars) < 1
          }
          data-testid="button-submit-recurring"
        >
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create & Send Authorization
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
