import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Bell, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { LegalUpdate } from "@shared/schema";
import { format } from "date-fns";

export default function AdminLegalUpdatesPage() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<LegalUpdate | null>(null);
  const [deleteUpdateId, setDeleteUpdateId] = useState<string | null>(null);
  
  const { data: updates, isLoading } = useQuery<LegalUpdate[]>({
    queryKey: ["/api/admin/legal-updates"],
  });

  const { data: states } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/states"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/legal-updates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/legal-updates"] });
      toast({
        title: "Legal Update Created",
        description: "The legal update has been published successfully.",
      });
      setShowCreateForm(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create legal update. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PUT", `/api/admin/legal-updates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/legal-updates"] });
      toast({
        title: "Legal Update Updated",
        description: "The legal update has been updated successfully.",
      });
      setEditingUpdate(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update legal update. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/legal-updates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/legal-updates"] });
      toast({
        title: "Legal Update Deleted",
        description: "The legal update has been deleted successfully.",
      });
      setDeleteUpdateId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete legal update. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      title: formData.get("title") as string,
      summary: formData.get("summary") as string,
      whyItMatters: formData.get("whyItMatters") as string,
      beforeText: formData.get("beforeText") as string,
      afterText: formData.get("afterText") as string,
      stateId: formData.get("stateId") as string,
      impactLevel: formData.get("impactLevel") as string,
      effectiveDate: new Date(formData.get("effectiveDate") as string),
    };

    createMutation.mutate(data);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUpdate) return;
    
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      summary: formData.get("summary") as string,
      whyItMatters: formData.get("whyItMatters") as string,
      beforeText: formData.get("beforeText") as string,
      afterText: formData.get("afterText") as string,
      stateId: formData.get("stateId") as string,
      impactLevel: formData.get("impactLevel") as string,
      effectiveDate: new Date(formData.get("effectiveDate") as string),
    };

    updateMutation.mutate({ id: editingUpdate.id, data });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading legal updates...</p>
      </div>
    );
  }

  const groupedUpdates = updates?.reduce((acc, update) => {
    if (!acc[update.stateId]) {
      acc[update.stateId] = [];
    }
    acc[update.stateId].push(update);
    return acc;
  }, {} as Record<string, LegalUpdate[]>) || {};

  const getImpactBadge = (level: string) => {
    switch (level) {
      case "high":
        return <Badge variant="destructive" className="text-xs">High Impact</Badge>;
      case "medium":
        return <Badge variant="default" className="text-xs">Medium Impact</Badge>;
      case "low":
        return <Badge variant="secondary" className="text-xs">Low Impact</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Legal Update Management</h1>
          <p className="text-muted-foreground">
            Publish and manage legal updates for landlords
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-toggle-create-form">
          <Plus className="h-4 w-4 mr-2" />
          {showCreateForm ? "Cancel" : "New Update"}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Legal Update</CardTitle>
            <CardDescription>Publish a new legal or regulatory update for landlords</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Update Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g., New Security Deposit Requirements"
                    required
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stateId">State</Label>
                  <Select name="stateId" required>
                    <SelectTrigger data-testid="select-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states?.map((state) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="impactLevel">Impact Level</Label>
                  <Select name="impactLevel" required>
                    <SelectTrigger data-testid="select-impact">
                      <SelectValue placeholder="Select impact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High - Immediate action required</SelectItem>
                      <SelectItem value="medium">Medium - Important to review</SelectItem>
                      <SelectItem value="low">Low - Good to know</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="effectiveDate">Effective Date</Label>
                  <Input
                    id="effectiveDate"
                    name="effectiveDate"
                    type="date"
                    required
                    data-testid="input-effective-date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  name="summary"
                  placeholder="One-sentence summary of the legal change..."
                  rows={2}
                  required
                  data-testid="textarea-summary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whyItMatters">Why It Matters</Label>
                <Textarea
                  id="whyItMatters"
                  name="whyItMatters"
                  placeholder="Explain the impact on landlords and why they should care..."
                  rows={2}
                  required
                  data-testid="textarea-why-it-matters"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="beforeText">Before (Old Law)</Label>
                  <Textarea
                    id="beforeText"
                    name="beforeText"
                    placeholder="How the law worked before this change..."
                    rows={3}
                    required
                    data-testid="textarea-before"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="afterText">After (New Law)</Label>
                  <Textarea
                    id="afterText"
                    name="afterText"
                    placeholder="How the law works now with this change..."
                    rows={3}
                    required
                    data-testid="textarea-after"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-update">
                  {createMutation.isPending ? "Publishing..." : "Publish Legal Update"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)} data-testid="button-cancel">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {Object.entries(groupedUpdates).map(([stateId, stateUpdates]) => (
          <Card key={stateId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {states?.find(s => s.id === stateId)?.name} Legal Updates ({stateUpdates.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stateUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="flex items-start justify-between p-4 rounded-md border hover-elevate"
                    data-testid={`update-${update.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{update.title}</h3>
                        {getImpactBadge(update.impactLevel)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{update.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        Effective: {update.effectiveDate ? format(new Date(update.effectiveDate), "MMMM d, yyyy") : "TBD"}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setEditingUpdate(update)}
                        data-testid={`button-edit-${update.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setDeleteUpdateId(update.id)}
                        data-testid={`button-delete-${update.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editingUpdate} onOpenChange={() => setEditingUpdate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Legal Update</DialogTitle>
            <DialogDescription>
              Update the legal update information below.
            </DialogDescription>
          </DialogHeader>
          {editingUpdate && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  name="title"
                  defaultValue={editingUpdate.title}
                  required
                  data-testid="input-edit-title"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-stateId">State</Label>
                  <Select name="stateId" defaultValue={editingUpdate.stateId} required>
                    <SelectTrigger id="edit-stateId" data-testid="select-edit-state">
                      <SelectValue placeholder="Select a state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states?.map((state) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-impactLevel">Impact Level</Label>
                  <Select name="impactLevel" defaultValue={editingUpdate.impactLevel} required>
                    <SelectTrigger id="edit-impactLevel" data-testid="select-edit-impact">
                      <SelectValue placeholder="Select impact level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-effectiveDate">Effective Date</Label>
                  <Input
                    id="edit-effectiveDate"
                    name="effectiveDate"
                    type="date"
                    defaultValue={editingUpdate.effectiveDate ? new Date(editingUpdate.effectiveDate).toISOString().split('T')[0] : ''}
                    required
                    data-testid="input-edit-effective-date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-summary">Summary</Label>
                <Textarea
                  id="edit-summary"
                  name="summary"
                  defaultValue={editingUpdate.summary}
                  rows={2}
                  required
                  data-testid="textarea-edit-summary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-whyItMatters">Why It Matters</Label>
                <Textarea
                  id="edit-whyItMatters"
                  name="whyItMatters"
                  defaultValue={editingUpdate.whyItMatters}
                  rows={2}
                  required
                  data-testid="textarea-edit-why-it-matters"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-beforeText">Before (Old Law)</Label>
                  <Textarea
                    id="edit-beforeText"
                    name="beforeText"
                    defaultValue={editingUpdate.beforeText}
                    rows={3}
                    required
                    data-testid="textarea-edit-before"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-afterText">After (New Law)</Label>
                  <Textarea
                    id="edit-afterText"
                    name="afterText"
                    defaultValue={editingUpdate.afterText}
                    rows={3}
                    required
                    data-testid="textarea-edit-after"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUpdate(null)} data-testid="button-cancel-edit">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-edit">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUpdateId} onOpenChange={() => setDeleteUpdateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Legal Update</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this legal update? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUpdateId && deleteMutation.mutate(deleteUpdateId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
