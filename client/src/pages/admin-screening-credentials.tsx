import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Settings,
  TestTube,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invitationId, setInvitationId] = useState("");

  const { data: landlords, isLoading } = useQuery<LandlordWithCredentials[]>({
    queryKey: ["/api/admin/screening-credentials"],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ userId, username, password, invitationId }: { 
      userId: string; 
      username: string; 
      password: string; 
      invitationId: string;
    }) => {
      return apiRequest("POST", `/api/admin/screening-credentials/${userId}`, {
        username,
        password,
        invitationId: invitationId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/screening-credentials"] });
      toast({ title: "Success", description: "Credentials saved successfully." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to save credentials.", 
        variant: "destructive" 
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/admin/screening-credentials/${userId}/test`, {});
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

  const openDialog = (landlord: LandlordWithCredentials) => {
    setSelectedLandlord(landlord);
    setUsername("");
    setPassword("");
    setInvitationId("");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setSelectedLandlord(null);
    setUsername("");
    setPassword("");
    setInvitationId("");
    setIsDialogOpen(false);
  };

  const handleSave = () => {
    if (!selectedLandlord || !username || !password) return;
    saveMutation.mutate({
      userId: selectedLandlord.userId,
      username,
      password,
      invitationId,
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
            Landlord Screening Credentials
          </h1>
          <p className="text-muted-foreground">
            Configure Western Verify credentials for each landlord
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
            Set up screening credentials (username, password, invitation ID) for each landlord
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
                  <TableHead>Status</TableHead>
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
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <XCircle className="h-3 w-3 mr-1" />
                            Not Set
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{formatDate(landlord.lastVerifiedAt)}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDialog(landlord)}
                            data-testid={`button-configure-${landlord.userId}`}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Configure
                          </Button>
                          {landlord.hasCredentials && (
                            <>
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
            <DialogTitle>Configure Screening Credentials</DialogTitle>
            <DialogDescription>
              {selectedLandlord && (
                <>
                  Set Western Verify credentials for{" "}
                  <strong>{getLandlordName(selectedLandlord)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Western Verify username"
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Western Verify password"
                data-testid="input-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitationId">Invitation ID</Label>
              <Input
                id="invitationId"
                value={invitationId}
                onChange={(e) => setInvitationId(e.target.value)}
                placeholder="e.g., C6BC580D-5E1A-4F51-A93B-927F5CFD5F9E"
                data-testid="input-invitation-id"
              />
              <p className="text-xs text-muted-foreground">
                The unique invitation ID from Western Verify for this landlord
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!username || !password || saveMutation.isPending}
              data-testid="button-save"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
