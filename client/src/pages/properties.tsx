import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Edit, Trash2, Plus, MapPin } from "lucide-react";
import type { Property, InsertProperty } from "@shared/schema";

const US_STATES = [
  { code: "UT", name: "Utah" },
  { code: "TX", name: "Texas" },
  { code: "ND", name: "North Dakota" },
  { code: "SD", name: "South Dakota" },
];

const PROPERTY_TYPES = [
  "Single Family",
  "Multi-Family",
  "Apartment",
  "Condo",
  "Townhouse",
  "Commercial",
  "Other",
];

export default function Properties() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deletePropertyId, setDeletePropertyId] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState<Partial<InsertProperty>>({
    name: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    propertyType: "",
    units: 1,
    notes: "",
  });

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<InsertProperty>) => {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Property Added",
        description: "Your property has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add property. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertProperty> }) => {
      const response = await fetch(`/api/properties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      setIsEditDialogOpen(false);
      setEditingProperty(null);
      resetForm();
      toast({
        title: "Property Updated",
        description: "Your property has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update property. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/properties/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      setDeletePropertyId(null);
      toast({
        title: "Property Deleted",
        description: "Your property has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete property. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      propertyType: "",
      units: 1,
      notes: "",
    });
  };

  // Helper to safely get string value (convert null to empty string)
  const safeStringValue = (value: string | null | undefined): string => value || "";

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setFormData({
      name: property.name || "",
      address: property.address || "",
      city: property.city || "",
      state: property.state || "",
      zipCode: property.zipCode || "",
      propertyType: property.propertyType || "",
      units: property.units ?? 1,
      notes: property.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.address) {
      toast({
        title: "Missing Fields",
        description: "Please fill in property name and address.",
        variant: "destructive",
      });
      return;
    }

    if (editingProperty) {
      updateMutation.mutate({ id: editingProperty.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredProperties = properties.filter(property =>
    property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    property.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2">Properties</h1>
          <p className="text-muted-foreground">Manage your rental properties</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input
            placeholder="Search properties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
            data-testid="input-search-properties"
          />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-property">
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Property</DialogTitle>
                <DialogDescription>
                  Enter the details of your property below.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Property Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Main Street Duplex"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-property-name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    placeholder="Street address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    data-testid="input-property-address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      data-testid="input-property-city"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => setFormData({ ...formData, state: value })}
                    >
                      <SelectTrigger data-testid="select-property-state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.code} value={state.code}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input
                      id="zipCode"
                      placeholder="12345"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      data-testid="input-property-zip"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="units">Number of Units</Label>
                    <Input
                      id="units"
                      type="number"
                      min="1"
                      value={formData.units}
                      onChange={(e) => setFormData({ ...formData, units: parseInt(e.target.value) || 1 })}
                      data-testid="input-property-units"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="propertyType">Property Type</Label>
                  <Select
                    value={formData.propertyType}
                    onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
                  >
                    <SelectTrigger data-testid="select-property-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes about this property..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    data-testid="input-property-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-property">
                  {createMutation.isPending ? "Adding..." : "Add Property"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {filteredProperties.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Properties Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Get started by adding your first property.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-property">
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.map((property) => (
              <Card key={property.id} className="hover-elevate" data-testid={`card-property-${property.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{property.name}</CardTitle>
                      <CardDescription className="flex items-start gap-1 mt-1">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{property.address}</span>
                      </CardDescription>
                    </div>
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {property.city && property.state && (
                      <div>
                        <span className="text-muted-foreground">Location: </span>
                        <span>{property.city}, {property.state} {property.zipCode}</span>
                      </div>
                    )}
                    {property.propertyType && (
                      <div>
                        <span className="text-muted-foreground">Type: </span>
                        <span>{property.propertyType}</span>
                      </div>
                    )}
                    {property.units && property.units > 1 && (
                      <div>
                        <span className="text-muted-foreground">Units: </span>
                        <span>{property.units}</span>
                      </div>
                    )}
                    {property.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-muted-foreground text-xs line-clamp-2">{property.notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(property)}
                      className="flex-1"
                      data-testid={`button-edit-property-${property.id}`}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletePropertyId(property.id)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-property-${property.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Property</DialogTitle>
              <DialogDescription>
                Update the details of your property below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Property Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-edit-property-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-address">Address *</Label>
                <Input
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  data-testid="input-edit-property-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    data-testid="input-edit-property-city"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-state">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value })}
                  >
                    <SelectTrigger data-testid="select-edit-property-state">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-zipCode">Zip Code</Label>
                  <Input
                    id="edit-zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    data-testid="input-edit-property-zip"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-units">Number of Units</Label>
                  <Input
                    id="edit-units"
                    type="number"
                    min="1"
                    value={formData.units}
                    onChange={(e) => setFormData({ ...formData, units: parseInt(e.target.value) || 1 })}
                    data-testid="input-edit-property-units"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-propertyType">Property Type</Label>
                <Select
                  value={formData.propertyType}
                  onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
                >
                  <SelectTrigger data-testid="select-edit-property-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  data-testid="input-edit-property-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={updateMutation.isPending} data-testid="button-update-property">
                {updateMutation.isPending ? "Updating..." : "Update Property"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deletePropertyId} onOpenChange={() => setDeletePropertyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Property?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this property. Documents associated with this property will not be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletePropertyId && deleteMutation.mutate(deletePropertyId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
