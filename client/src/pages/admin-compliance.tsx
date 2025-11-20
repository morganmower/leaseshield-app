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
import { Plus, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ComplianceCard } from "@shared/schema";

export default function AdminCompliancePage() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sections, setSections] = useState([{ title: "", content: "" }]);
  
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
                    className="flex items-start justify-between p-4 rounded-md border hover-elevate"
                    data-testid={`card-${card.id}`}
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{card.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{card.summary}</p>
                      <Badge variant="secondary" className="text-xs">
                        {card.category}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
