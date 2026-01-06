import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, getAccessToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building2, Edit, Trash2, Plus, MapPin, FileText, Upload, Home, Copy, ExternalLink, Users, Link as LinkIcon, ChevronRight, ChevronDown, Search } from "lucide-react";
import type { RentalProperty, RentalUnit, RentalApplicationLink, SavedDocument, UploadedDocument } from "@shared/schema";
import { DEFAULT_DOCUMENT_REQUIREMENTS, type DocumentRequirementsConfig } from "@shared/schema";

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

const PROPERTY_TYPES = [
  "Single Family",
  "Multi-Family",
  "Apartment",
  "Condo",
  "Townhouse",
  "Commercial",
  "Other",
];

interface PropertyFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  notes: string;
}

export default function Properties() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deletePropertyId, setDeletePropertyId] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState<RentalProperty | null>(null);
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [addUnitPropertyId, setAddUnitPropertyId] = useState<string | null>(null);

  const [formData, setFormData] = useState<PropertyFormData>({
    name: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    propertyType: "",
    notes: "",
  });

  const [unitForm, setUnitForm] = useState({ unitLabel: "" });
  const [docRequirements, setDocRequirements] = useState<DocumentRequirementsConfig>(DEFAULT_DOCUMENT_REQUIREMENTS);
  const [autoScreening, setAutoScreening] = useState(false);

  const { data: properties = [], isLoading, error } = useQuery<RentalProperty[]>({
    queryKey: ["/api/rental/properties"],
    retry: (failureCount, error: any) => {
      if (error?.status === 403) return false;
      return failureCount < 3;
    },
  });

  const isTrialExpired = error !== null && (error as any)?.status === 403;

  const createMutation = useMutation({
    mutationFn: async ({ data, requiredDocumentTypes, autoScreening }: { data: PropertyFormData; requiredDocumentTypes: DocumentRequirementsConfig; autoScreening: boolean }) => {
      const token = getAccessToken();
      const response = await fetch("/api/rental/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ ...data, requiredDocumentTypes, autoScreening }),
      });
      if (!response.ok) throw new Error("Failed to create property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Property Added", description: "Your property has been added successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add property. Please try again.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, requiredDocumentTypes, autoScreening }: { id: string; data: PropertyFormData; requiredDocumentTypes?: DocumentRequirementsConfig; autoScreening?: boolean }) => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/properties/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ ...data, requiredDocumentTypes, autoScreening }),
      });
      if (!response.ok) throw new Error("Failed to update property");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties"] });
      setIsEditDialogOpen(false);
      setEditingProperty(null);
      resetForm();
      toast({ title: "Property Updated", description: "Your property has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update property. Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
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
      toast({ title: "Property Deleted", description: "Your property has been deleted successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete property. Please try again.", variant: "destructive" });
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
      if (variables.createLink && result.link) {
        const url = `${window.location.origin}/apply/${result.link.publicToken}`;
        navigator.clipboard.writeText(url);
        toast({ title: "Application Link Created", description: "Link has been copied to your clipboard!" });
        setExpandedPropertyId(variables.propertyId);
      } else {
        toast({ title: "Unit Created", description: "The unit has been added to the property." });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create unit.", variant: "destructive" });
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
      notes: "",
    });
    setDocRequirements(DEFAULT_DOCUMENT_REQUIREMENTS);
    setAutoScreening(false);
  };

  const handleEdit = (property: RentalProperty) => {
    setEditingProperty(property);
    setFormData({
      name: property.name || "",
      address: property.address || "",
      city: property.city || "",
      state: property.state || "",
      zipCode: property.zipCode || "",
      propertyType: (property as any).propertyType || "",
      notes: (property as any).notes || "",
    });
    setDocRequirements((property.requiredDocumentTypes as DocumentRequirementsConfig) || DEFAULT_DOCUMENT_REQUIREMENTS);
    setAutoScreening((property as any).autoScreening ?? false);
    setIsEditDialogOpen(true);
  };

  // Quick link mutation - uses existing unit or creates one automatically
  const quickLinkMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/properties/${propertyId}/quick-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create link");
      return response.json();
    },
    onSuccess: (result, propertyId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties", propertyId, "units"] });
      if (result.unit?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/rental/units", result.unit.id, "links"] });
      }
      if (result.link?.publicToken) {
        const url = `${window.location.origin}/apply/${result.link.publicToken}`;
        navigator.clipboard.writeText(url);
        if (result.reused) {
          toast({ title: "Link Copied!", description: "Your existing application link has been copied to clipboard." });
        } else {
          toast({ title: "Link Created!", description: "New application link copied to your clipboard!" });
        }
        setExpandedPropertyId(propertyId);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create application link.", variant: "destructive" });
    },
  });

  const handleAddUnit = (propertyId: string, createLinkImmediately?: boolean) => {
    if (createLinkImmediately) {
      // Use quick-link endpoint that reuses existing unit
      quickLinkMutation.mutate(propertyId);
    } else {
      setAddUnitPropertyId(propertyId);
      setUnitForm({ unitLabel: "" });
      setIsAddUnitOpen(true);
    }
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast({ title: "Missing Fields", description: "Please fill in property name.", variant: "destructive" });
      return;
    }

    if (editingProperty) {
      updateMutation.mutate({ id: editingProperty.id, data: formData, requiredDocumentTypes: docRequirements, autoScreening });
    } else {
      createMutation.mutate({ data: formData, requiredDocumentTypes: docRequirements, autoScreening });
    }
  };

  const filteredProperties = properties.filter(property =>
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
            <Building2 className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              Subscribe to Manage Properties
            </h2>
            <p className="text-muted-foreground mb-8">
              Organize your properties, manage units, collect applications, and track documents
            </p>
            <Link to="/subscribe">
              <Button size="lg" data-testid="button-subscribe-properties-cta">
                Subscribe Now
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2">Properties</h1>
          <p className="text-muted-foreground">Manage your rental properties, units, and application links</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search properties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-properties"
            />
          </div>
          <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }} data-testid="button-add-property">
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </div>

        {filteredProperties.length === 0 ? (
          <Card className="p-12 border-dashed">
            <div className="text-center max-w-md mx-auto">
              <Building2 className="h-16 w-16 text-primary mx-auto mb-6" />
              <h3 className="text-2xl font-display font-semibold mb-3">Get Started</h3>
              <p className="text-muted-foreground mb-6">
                Add your first property to send applications, route screening through Western Verify, and access state-specific leases and notices.
              </p>
              <Button size="lg" onClick={() => { resetForm(); setIsAddDialogOpen(true); }} data-testid="button-add-first-property">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Property
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Properties organize applications, screening, and documents by location.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                isExpanded={expandedPropertyId === property.id}
                onToggleExpand={() => setExpandedPropertyId(expandedPropertyId === property.id ? null : property.id)}
                onEdit={() => handleEdit(property)}
                onDelete={() => setDeletePropertyId(property.id)}
                onAddUnit={(createLink) => handleAddUnit(property.id, createLink)}
              />
            ))}
          </div>
        )}

        {/* Add Property Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Property</DialogTitle>
              <DialogDescription>Enter the details of your rental property</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Sunset Apartments"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-property-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  data-testid="input-property-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Salt Lake City"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    data-testid="input-property-city"
                  />
                </div>
                <div className="space-y-2">
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
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    placeholder="84101"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    data-testid="input-property-zip"
                  />
                </div>
                <div className="space-y-2">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this property..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="min-h-[80px]"
                  data-testid="input-property-notes"
                />
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Required Documents for Applications</Label>
                <p className="text-xs text-muted-foreground">
                  Select which documents applicants must upload when applying
                </p>
                
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="add-req-id" className="text-sm">ID / Driver's License</Label>
                      <p className="text-xs text-muted-foreground">Always required</p>
                    </div>
                    <Switch id="add-req-id" checked={true} disabled data-testid="switch-add-doc-id" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="add-req-income" className="text-sm">Proof of Income</Label>
                      <p className="text-xs text-muted-foreground">Paystubs, employment letter, etc.</p>
                    </div>
                    <Switch 
                      id="add-req-income" 
                      checked={docRequirements.income} 
                      onCheckedChange={(checked) => setDocRequirements({ ...docRequirements, income: checked })}
                      data-testid="switch-add-doc-income"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="add-req-bank" className="text-sm">Bank Statements</Label>
                      <p className="text-xs text-muted-foreground">Recent bank statements</p>
                    </div>
                    <Switch 
                      id="add-req-bank" 
                      checked={docRequirements.bank} 
                      onCheckedChange={(checked) => setDocRequirements({ ...docRequirements, bank: checked })}
                      data-testid="switch-add-doc-bank"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="add-req-reference" className="text-sm">Reference Letters</Label>
                      <p className="text-xs text-muted-foreground">From previous landlords or employers</p>
                    </div>
                    <Switch 
                      id="add-req-reference" 
                      checked={docRequirements.reference} 
                      onCheckedChange={(checked) => setDocRequirements({ ...docRequirements, reference: checked })}
                      data-testid="switch-add-doc-reference"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label htmlFor="add-auto-screening" className="text-sm">Auto-Screening</Label>
                  <p className="text-xs text-muted-foreground">Automatically request screening when application is submitted</p>
                </div>
                <Switch 
                  id="add-auto-screening" 
                  checked={autoScreening} 
                  onCheckedChange={setAutoScreening}
                  data-testid="switch-add-auto-screening"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name || createMutation.isPending}
                data-testid="button-submit-property"
              >
                {createMutation.isPending ? "Creating..." : "Add Property"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Property Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Property</DialogTitle>
              <DialogDescription>Update property details and settings</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Property Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-edit-property-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Street Address</Label>
                <Input
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  data-testid="input-edit-property-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    data-testid="input-edit-property-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-state">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value })}
                  >
                    <SelectTrigger data-testid="select-edit-property-state">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-zipCode">ZIP Code</Label>
                  <Input
                    id="edit-zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    data-testid="input-edit-property-zip"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-propertyType">Property Type</Label>
                  <Select
                    value={formData.propertyType}
                    onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
                  >
                    <SelectTrigger data-testid="select-edit-property-type">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="min-h-[80px]"
                  data-testid="input-edit-property-notes"
                />
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Required Documents for Applications</Label>
                <p className="text-xs text-muted-foreground">
                  Select which documents applicants must upload when applying
                </p>
                
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="req-id" className="text-sm">ID / Driver's License</Label>
                      <p className="text-xs text-muted-foreground">Always required</p>
                    </div>
                    <Switch id="req-id" checked={true} disabled data-testid="switch-doc-id" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="req-income" className="text-sm">Proof of Income</Label>
                      <p className="text-xs text-muted-foreground">Paystubs, employment letter, etc.</p>
                    </div>
                    <Switch 
                      id="req-income" 
                      checked={docRequirements.income} 
                      onCheckedChange={(checked) => setDocRequirements({ ...docRequirements, income: checked })}
                      data-testid="switch-doc-income"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="req-bank" className="text-sm">Bank Statements</Label>
                      <p className="text-xs text-muted-foreground">Recent bank statements</p>
                    </div>
                    <Switch 
                      id="req-bank" 
                      checked={docRequirements.bank} 
                      onCheckedChange={(checked) => setDocRequirements({ ...docRequirements, bank: checked })}
                      data-testid="switch-doc-bank"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="req-reference" className="text-sm">Reference Letters</Label>
                      <p className="text-xs text-muted-foreground">From previous landlords or employers</p>
                    </div>
                    <Switch 
                      id="req-reference" 
                      checked={docRequirements.reference} 
                      onCheckedChange={(checked) => setDocRequirements({ ...docRequirements, reference: checked })}
                      data-testid="switch-doc-reference"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label htmlFor="auto-screening" className="text-sm">Auto-Screening</Label>
                  <p className="text-xs text-muted-foreground">Automatically request screening when application is submitted</p>
                </div>
                <Switch 
                  id="auto-screening" 
                  checked={autoScreening} 
                  onCheckedChange={setAutoScreening}
                  data-testid="switch-auto-screening"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name || updateMutation.isPending}
                data-testid="button-update-property"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletePropertyId} onOpenChange={() => setDeletePropertyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Property?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this property, all its units, and all application links. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletePropertyId && deleteMutation.mutate(deletePropertyId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Delete Property
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Unit Dialog */}
        <Dialog open={isAddUnitOpen} onOpenChange={setIsAddUnitOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Add Unit</DialogTitle>
              <DialogDescription>
                Give this unit a name (like "Apt A" or "Unit 101") so you can tell them apart.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="unitLabel">Unit Name</Label>
                <Input
                  id="unitLabel"
                  placeholder="e.g., Apt A, Unit 101, Basement"
                  value={unitForm.unitLabel}
                  onChange={(e) => setUnitForm({ unitLabel: e.target.value })}
                  data-testid="input-unit-label"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <Button
                className="w-full"
                onClick={() => addUnitPropertyId && createUnitMutation.mutate({ propertyId: addUnitPropertyId, data: unitForm, createLink: true })}
                disabled={createUnitMutation.isPending}
                data-testid="button-create-unit-with-link"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Create Unit + Application Link
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => addUnitPropertyId && createUnitMutation.mutate({ propertyId: addUnitPropertyId, data: unitForm, createLink: false })}
                disabled={createUnitMutation.isPending}
                data-testid="button-create-unit-only"
              >
                Create Unit Only
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setIsAddUnitOpen(false)}>
                Cancel
              </Button>
            </div>
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
  onAddUnit: (createLink?: boolean) => void;
}) {
  const { toast } = useToast();
  
  const { data: units = [] } = useQuery<RentalUnit[]>({
    queryKey: ["/api/rental/properties", property.id, "units"],
    enabled: isExpanded,
  });

  const getPropertyTypeColor = (type: string | null | undefined) => {
    const colors: Record<string, string> = {
      "Single Family": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      "Multi-Family": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      "Apartment": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      "Condo": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      "Townhouse": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      "Commercial": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return colors[type || ""] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  return (
    <Card data-testid={`card-property-${property.id}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
              <CardTitle className="text-lg truncate">{property.name}</CardTitle>
              {(property as any).propertyType && (
                <Badge className={`text-xs ${getPropertyTypeColor((property as any).propertyType)}`}>
                  {(property as any).propertyType}
                </Badge>
              )}
            </div>
            {property.address && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate">
                  {property.address}
                  {property.city && `, ${property.city}`}
                  {property.state && `, ${property.state}`}
                  {property.zipCode && ` ${property.zipCode}`}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-property-${property.id}`}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`button-delete-property-${property.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {(property as any).notes && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{(property as any).notes}</p>
        )}
        
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Button size="sm" variant="outline" onClick={() => onAddUnit(true)} data-testid={`button-create-link-${property.id}`}>
            <LinkIcon className="h-4 w-4 mr-1" />
            Create Application Link
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAddUnit(false)} data-testid={`button-add-unit-${property.id}`}>
            <Plus className="h-4 w-4 mr-1" />
            Add Unit
          </Button>
        </div>

        <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between" data-testid={`button-expand-${property.id}`}>
              <span className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                {units.length} Unit{units.length !== 1 ? "s" : ""}
              </span>
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {units.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No units yet. Create an application link to add your first unit.
              </p>
            ) : (
              <div className="space-y-2">
                {units.map((unit) => (
                  <UnitCard key={unit.id} unit={unit} propertyId={property.id} />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function UnitCard({ unit, propertyId }: { unit: RentalUnit; propertyId: string }) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(unit.unitLabel || "");
  
  const { data: links = [] } = useQuery<RentalApplicationLink[]>({
    queryKey: ["/api/rental/units", unit.id, "links"],
  });

  const updateUnitMutation = useMutation({
    mutationFn: async (newLabel: string) => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/units/${unit.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ unitLabel: newLabel }),
      });
      if (!response.ok) throw new Error("Failed to update unit");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties", propertyId, "units"] });
      toast({ title: "Unit Renamed", description: "The unit name has been updated." });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to rename unit.", variant: "destructive" });
    },
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
      });
      if (!response.ok) throw new Error("Failed to create link");
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/units", unit.id, "links"] });
      if (result.publicToken) {
        const url = `${window.location.origin}/apply/${result.publicToken}`;
        navigator.clipboard.writeText(url);
        toast({ title: "Link Created!", description: "The application link is now copied. You can paste it to send to tenants." });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create application link.", variant: "destructive" });
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async () => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/units/${unit.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete unit");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties", propertyId, "units"] });
      toast({ title: "Unit Deleted", description: "The unit has been removed." });
      setShowDeleteConfirm(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete unit.", variant: "destructive" });
    },
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/apply/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link Copied!", description: "You can now paste and send this link to tenants." });
  };

  const activeLinks = links.filter(l => l.isActive);

  return (
    <div className="bg-muted/50 rounded-lg p-3" data-testid={`card-unit-${unit.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" />
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="e.g., Apt A, Unit 101"
                className="h-7 w-32 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateUnitMutation.mutate(editLabel);
                  } else if (e.key === "Escape") {
                    setIsEditing(false);
                    setEditLabel(unit.unitLabel || "");
                  }
                }}
                data-testid={`input-edit-unit-${unit.id}`}
              />
              <Button
                size="sm"
                onClick={() => updateUnitMutation.mutate(editLabel)}
                disabled={updateUnitMutation.isPending}
                data-testid={`button-save-unit-${unit.id}`}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setEditLabel(unit.unitLabel || "");
                }}
                data-testid={`button-cancel-edit-unit-${unit.id}`}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-medium text-sm">{unit.unitLabel || "Main Unit"}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setIsEditing(true)}
                data-testid={`button-edit-unit-${unit.id}`}
              >
                <Edit className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeLinks.length > 0 ? (
            activeLinks.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Link Ready
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyLink(link.publicToken)}
                  data-testid={`button-copy-link-${link.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy Link
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`/apply/${link.publicToken}`, "_blank")}
                  data-testid={`button-open-link-${link.id}`}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Preview
                </Button>
              </div>
            ))
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => createLinkMutation.mutate()}
              disabled={createLinkMutation.isPending}
              data-testid={`button-create-unit-link-${unit.id}`}
            >
              <LinkIcon className="h-3 w-3 mr-1" />
              Create Application Link
            </Button>
          )}
          
          {/* Delete Unit Button */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteUnitMutation.mutate()}
                disabled={deleteUnitMutation.isPending}
                data-testid={`button-confirm-delete-unit-${unit.id}`}
              >
                {deleteUnitMutation.isPending ? "Deleting..." : "Yes, Delete"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                data-testid={`button-cancel-delete-unit-${unit.id}`}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid={`button-delete-unit-${unit.id}`}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
