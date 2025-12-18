import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getAccessToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  Search,
  Trash2,
  Edit,
  Home,
  MapPin,
  Copy,
  ExternalLink,
  Users,
  Link as LinkIcon,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import type { RentalProperty, RentalUnit, RentalApplicationLink } from "@shared/schema";

const US_STATES = [
  { value: "UT", label: "Utah" },
  { value: "TX", label: "Texas" },
  { value: "ND", label: "North Dakota" },
  { value: "SD", label: "South Dakota" },
  { value: "NC", label: "North Carolina" },
  { value: "OH", label: "Ohio" },
  { value: "MI", label: "Michigan" },
  { value: "ID", label: "Idaho" },
  { value: "WY", label: "Wyoming" },
  { value: "CA", label: "California" },
  { value: "VA", label: "Virginia" },
  { value: "NV", label: "Nevada" },
  { value: "AZ", label: "Arizona" },
  { value: "FL", label: "Florida" },
];

export default function RentalApplications() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isEditPropertyOpen, setIsEditPropertyOpen] = useState(false);
  const [deletePropertyId, setDeletePropertyId] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState<RentalProperty | null>(null);
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [addUnitPropertyId, setAddUnitPropertyId] = useState<string | null>(null);
  const [createLinkAfterUnit, setCreateLinkAfterUnit] = useState(false);

  const [propertyForm, setPropertyForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  });

  const [unitForm, setUnitForm] = useState({
    unitLabel: "",
  });

  const { data: properties = [], isLoading, error, refetch } = useQuery<RentalProperty[]>({
    queryKey: ["/api/rental/properties"],
    retry: (failureCount, error: any) => {
      if (error?.status === 403) return false;
      return failureCount < 3;
    },
  });

  const isTrialExpired = error !== null && (error as any)?.status === 403;
  const hasError = error !== null && !isTrialExpired;

  const createPropertyMutation = useMutation({
    mutationFn: async (data: typeof propertyForm) => {
      const token = getAccessToken();
      const response = await fetch("/api/rental/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties"] });
      setIsAddPropertyOpen(false);
      setPropertyForm({ name: "", address: "", city: "", state: "", zipCode: "" });
      toast({ title: "Property Created", description: "Your rental property has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create property.", variant: "destructive" });
    },
  });

  const updatePropertyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof propertyForm }) => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/properties/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties"] });
      setIsEditPropertyOpen(false);
      setEditingProperty(null);
      setPropertyForm({ name: "", address: "", city: "", state: "", zipCode: "" });
      toast({ title: "Property Updated", description: "Your rental property has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update property.", variant: "destructive" });
    },
  });

  const deletePropertyMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/properties/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Failed to delete property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties"] });
      setDeletePropertyId(null);
      toast({ title: "Property Deleted", description: "Your rental property has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete property.", variant: "destructive" });
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: async ({ propertyId, data, createLink }: { propertyId: string; data: typeof unitForm; createLink?: boolean }) => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/properties/${propertyId}/units`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ ...data, createLink }),
      });
      if (!response.ok) throw new Error("Failed to create unit");
      return response.json();
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties", variables.propertyId, "units"] });
      if (result.unit?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/rental/units", result.unit.id, "links"] });
      }
      setIsAddUnitOpen(false);
      setAddUnitPropertyId(null);
      setUnitForm({ unitLabel: "" });
      setCreateLinkAfterUnit(false);
      if (variables.createLink && result.link) {
        const url = `${window.location.origin}/apply/${result.link.publicToken}`;
        navigator.clipboard.writeText(url);
        toast({ title: "Property Link Created", description: "Application link has been copied to your clipboard!" });
        setExpandedPropertyId(variables.propertyId);
      } else {
        toast({ title: "Unit Created", description: "The unit has been added to the property." });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create unit.", variant: "destructive" });
    },
  });

  const handleEditProperty = (property: RentalProperty) => {
    setEditingProperty(property);
    setPropertyForm({
      name: property.name,
      address: property.address || "",
      city: property.city || "",
      state: property.state || "",
      zipCode: property.zipCode || "",
    });
    setIsEditPropertyOpen(true);
  };

  const handleAddUnit = (propertyId: string, createLinkImmediately?: boolean) => {
    setAddUnitPropertyId(propertyId);
    setUnitForm({ unitLabel: "" });
    setCreateLinkAfterUnit(!!createLinkImmediately);
    
    if (createLinkImmediately) {
      // Create a default unit and link immediately without showing dialog
      createUnitMutation.mutate({ propertyId, data: { unitLabel: "" }, createLink: true });
    } else {
      setIsAddUnitOpen(true);
    }
  };

  const filteredProperties = properties.filter(
    (property) =>
      property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  if (isTrialExpired) {
    return (
      <div className="h-full overflow-auto flex items-center justify-center">
        <Card className="p-12 bg-primary/10 border-primary/20 max-w-md">
          <div className="text-center">
            <Users className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              Subscribe to Manage Applications
            </h2>
            <p className="text-muted-foreground mb-8">
              Create application links, screen tenants, and manage your rental process
            </p>
            <Link to="/subscribe">
              <Button size="lg" data-testid="button-subscribe-rental-cta">
                Subscribe Now
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="h-full overflow-auto flex items-center justify-center">
        <Card className="p-12 max-w-md">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              Something Went Wrong
            </h2>
            <p className="text-muted-foreground mb-8">
              We couldn't load your rental properties. Please try again.
            </p>
            <Button onClick={() => refetch()} data-testid="button-retry-rental-properties">
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2">Rental Applications</h1>
          <p className="text-muted-foreground">
            Manage properties, create application links, and process tenant applications
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search properties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-rental-properties"
            />
          </div>
          <Button onClick={() => setIsAddPropertyOpen(true)} data-testid="button-add-rental-property">
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </div>

        {filteredProperties.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Rental Properties Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Add your first property to start collecting rental applications.
              </p>
              <Button onClick={() => setIsAddPropertyOpen(true)} data-testid="button-add-first-rental-property">
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                isExpanded={expandedPropertyId === property.id}
                onToggleExpand={() =>
                  setExpandedPropertyId(expandedPropertyId === property.id ? null : property.id)
                }
                onEdit={() => handleEditProperty(property)}
                onDelete={() => setDeletePropertyId(property.id)}
                onAddUnit={(createLinkImmediately) => handleAddUnit(property.id, createLinkImmediately)}
              />
            ))}
          </div>
        )}

        {/* Add Property Dialog */}
        <Dialog open={isAddPropertyOpen} onOpenChange={setIsAddPropertyOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Rental Property</DialogTitle>
              <DialogDescription>
                Add a property to start collecting rental applications
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Sunset Apartments"
                  value={propertyForm.name}
                  onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                  data-testid="input-rental-property-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street"
                  value={propertyForm.address}
                  onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                  data-testid="input-rental-property-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Salt Lake City"
                    value={propertyForm.city}
                    onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })}
                    data-testid="input-rental-property-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={propertyForm.state}
                    onValueChange={(value) => setPropertyForm({ ...propertyForm, state: value })}
                  >
                    <SelectTrigger data-testid="select-rental-property-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  placeholder="84101"
                  value={propertyForm.zipCode}
                  onChange={(e) => setPropertyForm({ ...propertyForm, zipCode: e.target.value })}
                  data-testid="input-rental-property-zip"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddPropertyOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createPropertyMutation.mutate(propertyForm)}
                disabled={!propertyForm.name || createPropertyMutation.isPending}
                data-testid="button-submit-rental-property"
              >
                {createPropertyMutation.isPending ? "Creating..." : "Add Property"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Property Dialog */}
        <Dialog open={isEditPropertyOpen} onOpenChange={setIsEditPropertyOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Rental Property</DialogTitle>
              <DialogDescription>Update property details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Property Name *</Label>
                <Input
                  id="edit-name"
                  value={propertyForm.name}
                  onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                  data-testid="input-edit-rental-property-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Street Address</Label>
                <Input
                  id="edit-address"
                  value={propertyForm.address}
                  onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                  data-testid="input-edit-rental-property-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={propertyForm.city}
                    onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })}
                    data-testid="input-edit-rental-property-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-state">State</Label>
                  <Select
                    value={propertyForm.state}
                    onValueChange={(value) => setPropertyForm({ ...propertyForm, state: value })}
                  >
                    <SelectTrigger data-testid="select-edit-rental-property-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-zipCode">ZIP Code</Label>
                <Input
                  id="edit-zipCode"
                  value={propertyForm.zipCode}
                  onChange={(e) => setPropertyForm({ ...propertyForm, zipCode: e.target.value })}
                  data-testid="input-edit-rental-property-zip"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditPropertyOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  editingProperty &&
                  updatePropertyMutation.mutate({ id: editingProperty.id, data: propertyForm })
                }
                disabled={!propertyForm.name || updatePropertyMutation.isPending}
                data-testid="button-update-rental-property"
              >
                {updatePropertyMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Property Confirmation */}
        <AlertDialog open={!!deletePropertyId} onOpenChange={() => setDeletePropertyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Property?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this property and all its units and application links. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletePropertyId && deletePropertyMutation.mutate(deletePropertyId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-rental-property"
              >
                Delete Property
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Unit Dialog */}
        <Dialog open={isAddUnitOpen} onOpenChange={setIsAddUnitOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Add Unit</DialogTitle>
              <DialogDescription>Add a unit to this property</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="unitLabel">Unit Label</Label>
                <Input
                  id="unitLabel"
                  placeholder="e.g., Unit 101, Apt A (optional)"
                  value={unitForm.unitLabel}
                  onChange={(e) => setUnitForm({ unitLabel: e.target.value })}
                  data-testid="input-rental-unit-label"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank if the property is a single unit (e.g., a house)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddUnitOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  addUnitPropertyId &&
                  createUnitMutation.mutate({ propertyId: addUnitPropertyId, data: unitForm })
                }
                disabled={createUnitMutation.isPending}
                data-testid="button-submit-rental-unit"
              >
                {createUnitMutation.isPending ? "Adding..." : "Add Unit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function PropertyCard({
  property,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddUnit,
}: {
  property: RentalProperty;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddUnit: (createLinkImmediately?: boolean) => void;
}) {
  const { data: units = [] } = useQuery<RentalUnit[]>({
    queryKey: ["/api/rental/properties", property.id, "units"],
    enabled: isExpanded,
  });

  return (
    <Card className="hover-elevate" data-testid={`card-rental-property-${property.id}`}>
      <CardHeader className="cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <ChevronRight
              className={`h-5 w-5 text-muted-foreground transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-lg">{property.name}</CardTitle>
              {property.address && (
                <CardDescription className="flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {property.address}
                  {property.city && `, ${property.city}`}
                  {property.state && `, ${property.state}`}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-rental-property-${property.id}`}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`button-delete-rental-property-${property.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Home className="h-4 w-4" />
                Units ({units.length})
              </h4>
              <Button size="sm" variant="outline" onClick={() => onAddUnit()} data-testid={`button-add-unit-${property.id}`}>
                <Plus className="h-4 w-4 mr-1" />
                Add Unit
              </Button>
            </div>

            {units.length === 0 ? (
              <div className="py-4 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  No units configured for this property.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => onAddUnit(true)}
                    data-testid={`button-create-property-link-${property.id}`}
                  >
                    <LinkIcon className="h-4 w-4 mr-1" />
                    Create Property Link
                  </Button>
                  <span className="text-xs text-muted-foreground">or</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAddUnit(false)}
                    data-testid={`button-add-unit-multi-${property.id}`}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Individual Units
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Use "Create Property Link" for single-unit properties. Use "Add Individual Units" if this property has multiple apartments/units.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {units.map((unit) => (
                  <UnitRow key={unit.id} unit={unit} propertyId={property.id} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function UnitRow({ unit, propertyId }: { unit: RentalUnit; propertyId: string }) {
  const { toast } = useToast();
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  const { data: links = [] } = useQuery<RentalApplicationLink[]>({
    queryKey: ["/api/rental/units", unit.id, "links"],
  });

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/units/${unit.id}/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Failed to create link");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/units", unit.id, "links"] });
      setIsCreatingLink(false);
      toast({ title: "Link Created", description: "Application link has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create link.", variant: "destructive" });
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async () => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/units/${unit.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Failed to delete unit");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties", propertyId, "units"] });
      toast({ title: "Unit Deleted", description: "The unit has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete unit.", variant: "destructive" });
    },
  });

  const activeLinks = links.filter((l) => l.isActive);

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/apply/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Application link copied to clipboard." });
  };

  return (
    <div className="p-3 bg-muted/50 rounded-lg space-y-2" data-testid={`row-rental-unit-${unit.id}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{unit.unitLabel || "Main Unit"}</span>
          {activeLinks.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeLinks.length} active link{activeLinks.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeLinks.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyLink(activeLinks[0].publicToken)}
              data-testid={`button-copy-link-${unit.id}`}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy Link
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => createLinkMutation.mutate()}
              disabled={createLinkMutation.isPending}
              data-testid={`button-create-link-${unit.id}`}
            >
              <LinkIcon className="h-3 w-3 mr-1" />
              {createLinkMutation.isPending ? "Creating..." : "Create Link"}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => deleteUnitMutation.mutate()}
            disabled={deleteUnitMutation.isPending}
            data-testid={`button-delete-unit-${unit.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {activeLinks.length > 0 && (
        <p className="text-xs text-muted-foreground pl-7">
          Share this link with all interested applicants. Each person can submit their own application.
        </p>
      )}
    </div>
  );
}
