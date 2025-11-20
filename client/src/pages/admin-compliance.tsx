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
import { Plus, Shield, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { ComplianceCard } from "@shared/schema";

export default function AdminCompliancePage() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sections, setSections] = useState([{ title: "", content: "" }]);
  const [editingCard, setEditingCard] = useState<ComplianceCard | null>(null);
  const [editSections, setEditSections] = useState<Array<{ title: string; content: string }>>([]);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  
  const { data: cards, isLoading } = useQuery<ComplianceCard[]>({
    queryKey: ["/api/admin/compliance-cards"],
  });

  const { data: states } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/states"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/compliance-cards", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/compliance-cards"] });
      toast({
        title: "Compliance Card Created",
        description: "The compliance card has been created successfully.",
      });
      setShowCreateForm(false);
      setSections([{ title: "", content: "" }]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create compliance card. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PUT", `/api/admin/compliance-cards/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/compliance-cards"] });
      toast({
        title: "Compliance Card Updated",
        description: "The compliance card has been updated successfully.",
      });
      setEditingCard(null);
      setEditSections([]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update compliance card. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/compliance-cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/compliance-cards"] });
      toast({
        title: "Compliance Card Deleted",
        description: "The compliance card has been deleted successfully.",
      });
      setDeleteCardId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete compliance card. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const validSections = sections.filter(s => s.title && s.content);
    
    const data = {
      title: formData.get("title") as string,
      summary: formData.get("summary") as string,
      category: formData.get("category") as string,
      stateId: formData.get("stateId") as string,
      content: { sections: validSections },
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    };

    createMutation.mutate(data);
  };

  const addSection = () => {
    setSections([...sections, { title: "", content: "" }]);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const updateSection = (index: number, field: "title" | "content", value: string) => {
    const newSections = [...sections];
    newSections[index][field] = value;
    setSections(newSections);
  };

  const openEditDialog = (card: ComplianceCard) => {
    setEditingCard(card);
    const content = card.content as any;
    setEditSections(content?.sections || []);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCard) return;
    
    const formData = new FormData(e.currentTarget);
    const validSections = editSections.filter(s => s.title && s.content);
    
    const data = {
      title: formData.get("title") as string,
      summary: formData.get("summary") as string,
      category: formData.get("category") as string,
      stateId: formData.get("stateId") as string,
      content: { sections: validSections },
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    };

    updateMutation.mutate({ id: editingCard.id, data });
  };

  const addEditSection = () => {
    setEditSections([...editSections, { title: "", content: "" }]);
  };

  const removeEditSection = (index: number) => {
    setEditSections(editSections.filter((_, i) => i !== index));
  };

  const updateEditSection = (index: number, field: "title" | "content", value: string) => {
    const newSections = [...editSections];
    newSections[index][field] = value;
    setEditSections(newSections);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading compliance cards...</p>
      </div>
    );
  }

  const groupedCards = cards?.reduce((acc, card) => {
    if (!acc[card.stateId]) {
      acc[card.stateId] = [];
    }
    acc[card.stateId].push(card);
    return acc;
  }, {} as Record<string, ComplianceCard[]>) || {};

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Compliance Card Management</h1>
          <p className="text-muted-foreground">
            Create and manage state-specific compliance requirements
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-toggle-create-form">
          <Plus className="h-4 w-4 mr-2" />
          {showCreateForm ? "Cancel" : "New Card"}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Compliance Card</CardTitle>
            <CardDescription>Add a new compliance requirement or regulation</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Card Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g., Required Lease Disclosures"
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
                      <SelectItem value="disclosures">Disclosures</SelectItem>
                      <SelectItem value="deposits">Security Deposits</SelectItem>
                      <SelectItem value="evictions">Evictions</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="lease_terms">Lease Terms</SelectItem>
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
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  name="summary"
                  placeholder="Brief summary of the compliance requirement..."
                  rows={2}
                  required
                  data-testid="textarea-summary"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Content Sections</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addSection} data-testid="button-add-section">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Section
                  </Button>
                </div>
                {sections.map((section, index) => (
                  <div key={index} className="p-4 border rounded-md space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Section {index + 1}</span>
                      {sections.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeSection(index)}
                          data-testid={`button-remove-section-${index}`}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="Section title"
                      value={section.title}
                      onChange={(e) => updateSection(index, "title", e.target.value)}
                      data-testid={`input-section-title-${index}`}
                    />
                    <Textarea
                      placeholder="Section content"
                      value={section.content}
                      onChange={(e) => updateSection(index, "content", e.target.value)}
                      rows={2}
                      data-testid={`textarea-section-content-${index}`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-card">
                  {createMutation.isPending ? "Creating..." : "Create Compliance Card"}
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
        {Object.entries(groupedCards).map(([stateId, stateCards]) => (
          <Card key={stateId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {states?.find(s => s.id === stateId)?.name} Compliance Cards ({stateCards.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stateCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-start justify-between gap-4 p-4 rounded-md border hover-elevate"
                    data-testid={`card-${card.id}`}
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{card.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{card.summary}</p>
                      <Badge variant="secondary" className="text-xs">
                        {card.category}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(card)}
                        data-testid={`button-edit-${card.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteCardId(card.id)}
                        data-testid={`button-delete-${card.id}`}
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
      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Compliance Card</DialogTitle>
            <DialogDescription>Update the compliance card details</DialogDescription>
          </DialogHeader>
          {editingCard && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    name="title"
                    required
                    defaultValue={editingCard.title}
                    data-testid="input-edit-title"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">Category</Label>
                  <Input
                    id="edit-category"
                    name="category"
                    required
                    defaultValue={editingCard.category}
                    data-testid="input-edit-category"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-summary">Summary</Label>
                <Textarea
                  id="edit-summary"
                  name="summary"
                  required
                  defaultValue={editingCard.summary}
                  rows={2}
                  data-testid="textarea-edit-summary"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="edit-stateId">State</Label>
                  <Select name="stateId" defaultValue={editingCard.stateId} required>
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
                <div>
                  <Label htmlFor="edit-sortOrder">Sort Order</Label>
                  <Input
                    id="edit-sortOrder"
                    name="sortOrder"
                    type="number"
                    defaultValue={editingCard.sortOrder ?? 0}
                    data-testid="input-edit-sort-order"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Content Sections</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addEditSection} data-testid="button-edit-add-section">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Section
                  </Button>
                </div>
                {editSections.map((section, index) => (
                  <div key={index} className="space-y-2 p-3 border rounded-md mb-2">
                    <div className="flex justify-between items-center">
                      <Label>Section {index + 1}</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeEditSection(index)}
                        data-testid={`button-edit-remove-section-${index}`}
                      >
                        Remove
                      </Button>
                    </div>
                    <Input
                      placeholder="Section title"
                      value={section.title}
                      onChange={(e) => updateEditSection(index, "title", e.target.value)}
                      data-testid={`input-edit-section-title-${index}`}
                    />
                    <Textarea
                      placeholder="Section content"
                      value={section.content}
                      onChange={(e) => updateEditSection(index, "content", e.target.value)}
                      rows={2}
                      data-testid={`textarea-edit-section-content-${index}`}
                    />
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingCard(null)} data-testid="button-edit-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-edit-submit">
                  {updateMutation.isPending ? "Updating..." : "Update Card"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCardId} onOpenChange={(open) => !open && setDeleteCardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this compliance card. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCardId && deleteMutation.mutate(deleteCardId)}
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
