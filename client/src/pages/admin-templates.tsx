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
import { Plus, FileText, Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Template } from "@shared/schema";

export default function AdminTemplatesPage() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  
  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: states } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/states"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Created",
        description: "The template has been created successfully.",
      });
      setShowCreateForm(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PUT", `/api/admin/templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Updated",
        description: "The template has been updated successfully.",
      });
      setEditingTemplate(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Deleted",
        description: "The template has been deleted successfully.",
      });
      setDeleteTemplateId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      templateType: formData.get("templateType") as string,
      stateId: formData.get("stateId") as string,
      version: 1,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    };

    createMutation.mutate(data);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTemplate) return;
    
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      templateType: formData.get("templateType") as string,
      stateId: formData.get("stateId") as string,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    };

    updateMutation.mutate({ id: editingTemplate.id, data });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading templates...</p>
      </div>
    );
  }

  const groupedTemplates = templates?.reduce((acc, template) => {
    if (!acc[template.stateId]) {
      acc[template.stateId] = [];
    }
    acc[template.stateId].push(template);
    return acc;
  }, {} as Record<string, Template[]>) || {};

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Template Management</h1>
          <p className="text-muted-foreground">
            Create and manage state-specific legal templates
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-toggle-create-form">
          <Plus className="h-4 w-4 mr-2" />
          {showCreateForm ? "Cancel" : "New Template"}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Template</CardTitle>
            <CardDescription>Add a new legal template to the library</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Template Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g., Utah Residential Lease Agreement"
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
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" required>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leasing">Leasing</SelectItem>
                      <SelectItem value="screening">Screening</SelectItem>
                      <SelectItem value="move_in_out">Move In/Out</SelectItem>
                      <SelectItem value="notices">Notices</SelectItem>
                      <SelectItem value="evictions">Evictions</SelectItem>
                      <SelectItem value="tenant_issues">Tenant Issues</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="templateType">Template Type</Label>
                  <Select name="templateType" required>
                    <SelectTrigger data-testid="select-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lease">Lease Agreement</SelectItem>
                      <SelectItem value="application">Rental Application</SelectItem>
                      <SelectItem value="late_rent_notice">Late Rent Notice</SelectItem>
                      <SelectItem value="lease_violation_notice">Lease Violation Notice</SelectItem>
                      <SelectItem value="move_in_checklist">Move-In Checklist</SelectItem>
                      <SelectItem value="move_out_checklist">Move-Out Checklist</SelectItem>
                      <SelectItem value="adverse_action">Adverse Action Notice</SelectItem>
                      <SelectItem value="eviction_notice">Eviction Notice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    name="sortOrder"
                    type="number"
                    placeholder="0"
                    defaultValue="0"
                    data-testid="input-sort-order"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Brief description of the template and its purpose..."
                  rows={3}
                  required
                  data-testid="textarea-description"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-template">
                  {createMutation.isPending ? "Creating..." : "Create Template"}
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
        {Object.entries(groupedTemplates).map(([stateId, stateTemplates]) => (
          <Card key={stateId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {states?.find(s => s.id === stateId)?.name} Templates ({stateTemplates.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stateTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-start justify-between gap-4 p-4 rounded-md border hover-elevate"
                    data-testid={`template-card-${template.id}`}
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{template.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {template.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          v{template.version}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingTemplate(template)}
                        data-testid={`button-edit-${template.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteTemplateId(template.id)}
                        data-testid={`button-delete-${template.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update the template details</DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    name="title"
                    required
                    defaultValue={editingTemplate.title}
                    data-testid="input-edit-title"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">Category</Label>
                  <Input
                    id="edit-category"
                    name="category"
                    required
                    defaultValue={editingTemplate.category}
                    data-testid="input-edit-category"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="edit-templateType">Template Type</Label>
                  <Input
                    id="edit-templateType"
                    name="templateType"
                    required
                    defaultValue={editingTemplate.templateType}
                    data-testid="input-edit-template-type"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-stateId">State</Label>
                  <Select name="stateId" defaultValue={editingTemplate.stateId} required>
                    <SelectTrigger id="edit-stateId" data-testid="select-edit-state">
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
              </div>

              <div>
                <Label htmlFor="edit-sortOrder">Sort Order</Label>
                <Input
                  id="edit-sortOrder"
                  name="sortOrder"
                  type="number"
                  defaultValue={editingTemplate.sortOrder ?? 0}
                  data-testid="input-edit-sort-order"
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  required
                  defaultValue={editingTemplate.description}
                  rows={3}
                  data-testid="textarea-edit-description"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingTemplate(null)} data-testid="button-edit-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-edit-submit">
                  {updateMutation.isPending ? "Updating..." : "Update Template"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => !open && setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this template. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateId && deleteMutation.mutate(deleteTemplateId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
