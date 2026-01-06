import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  TestTube,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LandlordWithCredentials {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  hasCredentials: boolean;
  status: 'not_configured' | 'pending_verification' | 'verified' | 'failed';
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
  configuredBy: string | null;
  configuredAt: string | null;
  hasInvitationId: boolean;
  invitationId?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
  not_configured: { label: "Not Configured", color: "bg-muted text-muted-foreground", icon: ShieldX },
  pending_verification: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  verified: { label: "Verified", color: "bg-green-100 text-green-800", icon: ShieldCheck },
  failed: { label: "Failed", color: "bg-red-100 text-red-800", icon: ShieldAlert },
};

export default function AdminScreeningCredentials() {
  const { toast } = useToast();
  const [selectedLandlord, setSelectedLandlord] = useState<LandlordWithCredentials | null>(null);
  const [invitationId, setInvitationId] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: landlords, isLoading } = useQuery<LandlordWithCredentials[]>({
    queryKey: ["/api/admin/screening-credentials"],
  });

  const testMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/screening-credentials/${userId}/test`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/screening-credentials"] });
      if (data.success) {
        toast({ title: "Verified", description: "Credentials are valid and working." });
      } else {
        toast({ 
          title: "Verification Failed", 
          description: data.error || "Credentials could not be verified.", 
          variant: "destructive" 
        });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to test credentials.", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/screening-credentials/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/screening-credentials"] });
      toast({ title: "Deleted", description: "Credentials removed." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to delete credentials.", 
        variant: "destructive" 
      });
    },
  });

  const setInvitationMutation = useMutation({
    mutationFn: async ({ userId, invitationId }: { userId: string; invitationId: string }) => {
      return apiRequest("PATCH", `/api/admin/screening-credentials/${userId}/invitation`, { invitationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/screening-credentials"] });
      toast({ title: "Success", description: "Invitation ID saved." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to save invitation ID.", 
        variant: "destructive" 
      });
    },
  });

  const openDialog = (landlord: LandlordWithCredentials) => {
    setSelectedLandlord(landlord);
    setInvitationId(landlord.invitationId || "");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setSelectedLandlord(null);
    setInvitationId("");
    setIsDialogOpen(false);
  };

  const handleSaveInvitation = () => {
    if (!selectedLandlord || !invitationId.trim()) return;
    setInvitationMutation.mutate({
      userId: selectedLandlord.userId,
      invitationId: invitationId.trim(),
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLandlordName = (landlord: LandlordWithCredentials) => {
    if (landlord.firstName || landlord.lastName) {
      return `${landlord.firstName || ""} ${landlord.lastName || ""}`.trim();
    }
    return landlord.email;
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-6 px-4">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Screening Credentials Status
          </h1>
          <p className="text-muted-foreground">
            View landlord credentials and set their invitation IDs
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Landlords
          </CardTitle>
          <CardDescription>
            Landlords enter their own username/password. You set the invitation ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!landlords || landlords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No landlords found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Landlord</TableHead>
                  <TableHead>Credentials</TableHead>
                  <TableHead>Invitation ID</TableHead>
                  <TableHead>Last Verified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {landlords.map((landlord) => {
                  const config = statusConfig[landlord.status];
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={landlord.userId} data-testid={`row-landlord-${landlord.userId}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{getLandlordName(landlord)}</p>
                          <p className="text-xs text-muted-foreground">{landlord.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        {landlord.lastErrorMessage && (
                          <p className="text-xs text-red-600 mt-1 max-w-xs truncate" title={landlord.lastErrorMessage}>
                            {landlord.lastErrorMessage}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {landlord.hasInvitationId ? (
                          <Badge variant="outline" className="text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Set
                          </Badge>
                        ) : landlord.hasCredentials ? (
                          <Badge variant="outline" className="text-orange-600">
                            <XCircle className="h-3 w-3 mr-1" />
                            Needs ID
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{formatDate(landlord.lastVerifiedAt)}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {landlord.hasCredentials ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDialog(landlord)}
                                data-testid={`button-set-invitation-${landlord.userId}`}
                              >
                                <Settings className="h-4 w-4 mr-1" />
                                Set ID
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => testMutation.mutate(landlord.userId)}
                                disabled={testMutation.isPending}
                                data-testid={`button-test-${landlord.userId}`}
                              >
                                {testMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <TestTube className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteMutation.mutate(landlord.userId)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${landlord.userId}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">Waiting for credentials</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Invitation ID</DialogTitle>
            <DialogDescription>
              {selectedLandlord && (
                <>
                  Set the Western Verify invitation/appscreen ID for{" "}
                  <strong>{getLandlordName(selectedLandlord)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="e.g., BC7CD693-6E88-4DB5-810B-B25B53D28245"
              value={invitationId}
              onChange={(e) => setInvitationId(e.target.value)}
              data-testid="input-invitation-id"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This ID determines which screening package is used when the landlord submits a screening request.
            </p>
          </div>
          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
              Cancel
            </Button>
            {(selectedLandlord?.hasInvitationId || invitationId.trim()) && (
              <Button 
                variant="outline"
                onClick={() => {
                  if (selectedLandlord) {
                    setInvitationMutation.mutate({ userId: selectedLandlord.userId, invitationId: "" });
                  }
                }}
                disabled={setInvitationMutation.isPending || (!selectedLandlord?.hasInvitationId && !invitationId.trim())}
                data-testid="button-clear"
              >
                Clear ID
              </Button>
            )}
            <Button 
              onClick={handleSaveInvitation} 
              disabled={!invitationId.trim() || setInvitationMutation.isPending}
              data-testid="button-save"
            >
              {setInvitationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
