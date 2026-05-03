import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, getAccessToken, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStates } from "@/hooks/useStates";
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
import { Building2, Edit, Trash2, Plus, MapPin, FileText, Upload, Home, Copy, ExternalLink, Users, Link as LinkIcon, ChevronRight, ChevronDown, Search, UserCheck, Settings, Pencil, Check, X as XIcon, QrCode, Pause, Play, Eye, ClipboardList, Send } from "lucide-react";
import QRCode from "qrcode";
import type { RentalProperty, RentalUnit, RentalApplicationLink, SavedDocument, UploadedDocument } from "@shared/schema";
import { DEFAULT_DOCUMENT_REQUIREMENTS, type DocumentRequirementsConfig } from "@shared/schema";


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
  const { states } = useStates();
  
  const sortedStates = useMemo(() => 
    [...states].sort((a, b) => a.name.localeCompare(b.name)), 
    [states]
  );
  
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
  const [screeningInvitationId, setScreeningInvitationId] = useState("");

  interface PropertyTermsType {
    monthlyRent?: string;
    applicationFee?: string;
    securityDeposit?: string;
    adminFee?: string;
    leaseSignDeadlineHours?: number;
    additionalNotes?: string;
  }
  const DEFAULT_PROPERTY_TERMS: PropertyTermsType = {};
  const [propertyTerms, setPropertyTerms] = useState<PropertyTermsType>(DEFAULT_PROPERTY_TERMS);

  // Application field toggles - controls which fields appear on the rental application form
  type FieldVisibility = "required" | "optional" | "hidden";
  interface FieldSchemaFields {
    desiredMoveInDate: FieldVisibility;
    numberOfOccupants: FieldVisibility;
    personalReferences: FieldVisibility;
    housingVoucher: FieldVisibility;
    referralSource: FieldVisibility;
    currentLandlordContact: FieldVisibility;
    employerPhone: FieldVisibility;
    monthlyIncome: FieldVisibility;
    reasonForMoving: FieldVisibility;
  }
  const DEFAULT_FIELD_SETTINGS: FieldSchemaFields = {
    desiredMoveInDate: "optional",
    numberOfOccupants: "optional",
    personalReferences: "optional",
    housingVoucher: "hidden",
    referralSource: "optional",
    currentLandlordContact: "optional",
    employerPhone: "optional",
    monthlyIncome: "required",
    reasonForMoving: "optional"
  };
  const [fieldSettings, setFieldSettings] = useState<FieldSchemaFields>(DEFAULT_FIELD_SETTINGS);

  const { data: properties = [], isLoading, error } = useQuery<RentalProperty[]>({
    queryKey: ["/api/rental/properties"],
    retry: (failureCount, error: any) => {
      if (error?.status === 403) return false;
      return failureCount < 3;
    },
  });

  const isTrialExpired = error !== null && (error as any)?.status === 403;

  // Check if Western Verify credentials are configured
  const { data: credentialsStatus, isFetched: credentialsFetched } = useQuery<{ configured: boolean; defaultInvitationId?: string | null }>({
    queryKey: ["/api/screening-credentials"],
  });

  const createMutation = useMutation({
    mutationFn: async ({ data, requiredDocumentTypes, autoScreening, screeningInvitationId, propertyTermsJson, defaultFieldSchemaJson }: { data: PropertyFormData; requiredDocumentTypes: DocumentRequirementsConfig; autoScreening: boolean; screeningInvitationId?: string; propertyTermsJson?: PropertyTermsType; defaultFieldSchemaJson?: any }) => {
      const token = getAccessToken();
      const response = await fetch("/api/rental/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ ...data, requiredDocumentTypes, autoScreening, screeningInvitationId: screeningInvitationId || null, propertyTermsJson, defaultFieldSchemaJson }),
      });
      if (!response.ok) {
        let serverMessage = "Failed to create property";
        try {
          const body = await response.json();
          if (body?.message) serverMessage = body.message;
        } catch {}
        throw new Error(serverMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Property Added", description: "Your property has been added successfully." });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add property. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, requiredDocumentTypes, autoScreening, screeningInvitationId, propertyTermsJson, defaultFieldSchemaJson }: { id: string; data: PropertyFormData; requiredDocumentTypes?: DocumentRequirementsConfig; autoScreening?: boolean; screeningInvitationId?: string; propertyTermsJson?: PropertyTermsType; defaultFieldSchemaJson?: any }) => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/properties/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ ...data, requiredDocumentTypes, autoScreening, screeningInvitationId: screeningInvitationId || null, propertyTermsJson, defaultFieldSchemaJson }),
      });
      if (!response.ok) {
        let serverMessage = "Failed to update property";
        try {
          const body = await response.json();
          if (body?.message) serverMessage = body.message;
        } catch {}
        throw new Error(serverMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties"] });
      setIsEditDialogOpen(false);
      setEditingProperty(null);
      resetForm();
      toast({ title: "Property Updated", description: "Your changes have been saved. Existing application links will show the new settings." });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update property. Please try again.",
        variant: "destructive",
      });
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
    setScreeningInvitationId("");
    setPropertyTerms(DEFAULT_PROPERTY_TERMS);
    setFieldSettings(DEFAULT_FIELD_SETTINGS);
    setEditingProperty(null);
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
    setScreeningInvitationId((property as any).screeningInvitationId || "");
    setPropertyTerms((property as any).propertyTermsJson || DEFAULT_PROPERTY_TERMS);
    // Load field schema settings from property's default field schema
    const override = (property as any).defaultFieldSchemaJson;
    if (override?.fields) {
      setFieldSettings({
        desiredMoveInDate: override.fields.desiredMoveInDate?.visibility || "optional",
        numberOfOccupants: override.fields.numberOfOccupants?.visibility || "optional",
        personalReferences: override.fields.personalReferences?.visibility || "optional",
        housingVoucher: override.fields.housingVoucher?.visibility || "hidden",
        referralSource: override.fields.referralSource?.visibility || "optional",
        currentLandlordContact: override.fields.currentLandlordContact?.visibility || "optional",
        employerPhone: override.fields.employerPhone?.visibility || "optional",
        monthlyIncome: override.fields.monthlyIncome?.visibility || "required",
        reasonForMoving: override.fields.reasonForMoving?.visibility || "optional"
      });
    } else {
      setFieldSettings(DEFAULT_FIELD_SETTINGS);
    }
    setIsEditDialogOpen(true);
  };

  // Quick link mutation - creates link for property (auto-creates unit if needed)
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

  // Build the field schema override, merging with existing settings if editing
  const buildFieldSchemaOverride = () => {
    // Get existing default field schema from property being edited
    const existingOverride = editingProperty ? (editingProperty as any).defaultFieldSchemaJson : null;
    
    // Start with existing or default structure
    const base = existingOverride || {
      stateScope: "all_leaseshield_states",
      fields: {
        phone: { visibility: "required" },
        dlNumber: { visibility: "optional" },
        dlState: { visibility: "optional" },
        ssn: { visibility: "hidden" },
        dob: { visibility: "hidden" },
        currentAddress: { visibility: "required" },
        previousAddresses: { visibility: "required" },
        employmentHistory: { visibility: "required" },
        rentalHistory: { visibility: "optional" },
        vehicles: { visibility: "optional" },
        pets: { visibility: "optional" },
        emergencyContact: { visibility: "optional" }
      },
      historyRules: {
        minAddressYears: 2,
        minEmploymentYears: 2,
        minPreviousRentals: 2
      },
      uploads: {
        govId: { required: true, label: "Government ID" },
        paystubs30Days: { required: true, label: "Paystubs (last 30 days)" },
        taxDocsSelfEmployed: { required: false, label: "Self-employed tax documents (Schedule C, etc.)" },
        otherIncome: { required: false, label: "Other income documentation" }
      }
    };
    
    // Merge in the UI-controlled field settings
    return {
      ...base,
      fields: {
        ...(base.fields || {}),
        desiredMoveInDate: { visibility: fieldSettings.desiredMoveInDate },
        numberOfOccupants: { visibility: fieldSettings.numberOfOccupants },
        personalReferences: { visibility: fieldSettings.personalReferences },
        housingVoucher: { visibility: fieldSettings.housingVoucher },
        referralSource: { visibility: fieldSettings.referralSource },
        currentLandlordContact: { visibility: fieldSettings.currentLandlordContact },
        employerPhone: { visibility: fieldSettings.employerPhone },
        monthlyIncome: { visibility: fieldSettings.monthlyIncome },
        reasonForMoving: { visibility: fieldSettings.reasonForMoving }
      }
    };
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast({ title: "Missing Fields", description: "Please fill in property name.", variant: "destructive" });
      return;
    }

    const defaultFieldSchemaJson = buildFieldSchemaOverride();

    if (editingProperty) {
      updateMutation.mutate({ id: editingProperty.id, data: formData, requiredDocumentTypes: docRequirements, autoScreening, screeningInvitationId, propertyTermsJson: propertyTerms, defaultFieldSchemaJson });
    } else {
      createMutation.mutate({ data: formData, requiredDocumentTypes: docRequirements, autoScreening, screeningInvitationId, propertyTermsJson: propertyTerms, defaultFieldSchemaJson });
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
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-semibold text-foreground mb-1">
                  Properties
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Manage your rental properties, units, and application links.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-properties-count">
                  {properties.length}
                </p>
                <p className="text-xs text-muted-foreground">Properties</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-units-count">
                  {properties.reduce((sum, p: any) => sum + (p.units?.length || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground">Units</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
          <Button onClick={() => { resetForm(); setEditingProperty(null); setIsAddDialogOpen(true); }} data-testid="button-add-property">
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </div>

        {filteredProperties.length === 0 ? (
          <Card className="p-12 border-dashed">
            <div className="text-center max-w-md mx-auto">
              <Building2 className="h-16 w-16 text-primary mx-auto mb-6" />
              <h3 className="text-2xl font-display font-semibold mb-3">Add your first property</h3>
              <p className="text-muted-foreground mb-6">
                Properties are where everything else lives — applications, screening, lease documents, and rent collection all start here.
              </p>
              <Button size="lg" onClick={() => { resetForm(); setEditingProperty(null); setIsAddDialogOpen(true); }} data-testid="button-add-first-property">
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

        {/* Optional: Tenant Screening Setup Card - only shows when credentials not configured */}
        {credentialsFetched && !credentialsStatus?.configured && (
          <Card className="mt-8 p-6 border-dashed bg-muted/30">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3 flex-shrink-0">
                <UserCheck className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Want Tenant Screening?</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Connect your Western Verify account to run background checks, credit reports, and eviction history directly from your applications. This is optional.
                </p>
                <Link to="/settings">
                  <Button variant="outline" size="sm" data-testid="button-setup-screening">
                    <Settings className="h-4 w-4 mr-2" />
                    Set Up in Settings
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
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
                      {sortedStates.map((state) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name}
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

              <div className="space-y-1 pt-2">
                <Label htmlFor="add-screening-invitation-id" className="text-sm">Screening Package ID (optional)</Label>
                <Input
                  id="add-screening-invitation-id"
                  placeholder={credentialsStatus?.defaultInvitationId ? `Default: ${credentialsStatus.defaultInvitationId}` : "Leave blank to use account default"}
                  value={screeningInvitationId}
                  onChange={(e) => setScreeningInvitationId(e.target.value)}
                  data-testid="input-add-screening-invitation-id"
                />
                <p className="text-xs text-muted-foreground">Overrides your account-level default. Leave blank to use your account default.</p>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Property Terms & Fees</Label>
                <p className="text-xs text-muted-foreground">
                  These details will be shown to applicants before they apply. Leave blank or enter "N/A" for any that don't apply.
                </p>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="add-monthlyRent" className="text-sm">Monthly Rent</Label>
                    <Input
                      id="add-monthlyRent"
                      placeholder="e.g., $1,500"
                      value={propertyTerms.monthlyRent || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, monthlyRent: e.target.value }))}
                      data-testid="input-add-monthly-rent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-applicationFee" className="text-sm">Application Fee</Label>
                    <Input
                      id="add-applicationFee"
                      placeholder="e.g., $50 per adult"
                      value={propertyTerms.applicationFee || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, applicationFee: e.target.value }))}
                      data-testid="input-add-application-fee"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-securityDeposit" className="text-sm">Security Deposit</Label>
                    <Input
                      id="add-securityDeposit"
                      placeholder="e.g., $1,500"
                      value={propertyTerms.securityDeposit || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, securityDeposit: e.target.value }))}
                      data-testid="input-add-security-deposit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-adminFee" className="text-sm">Admin / Initiation Fee</Label>
                    <Input
                      id="add-adminFee"
                      placeholder="e.g., $150"
                      value={propertyTerms.adminFee || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, adminFee: e.target.value }))}
                      data-testid="input-add-admin-fee"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-leaseDeadline" className="text-sm">Lease Signing Deadline (hours)</Label>
                    <Input
                      id="add-leaseDeadline"
                      type="number"
                      placeholder="e.g., 48"
                      value={propertyTerms.leaseSignDeadlineHours || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, leaseSignDeadlineHours: e.target.value ? parseInt(e.target.value) : undefined }))}
                      data-testid="input-add-lease-deadline"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-additionalNotes" className="text-sm">Additional Notes</Label>
                    <Input
                      id="add-additionalNotes"
                      placeholder="Any other terms"
                      value={propertyTerms.additionalNotes || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, additionalNotes: e.target.value }))}
                      data-testid="input-add-additional-notes"
                    />
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Application Field Settings</Label>
                <p className="text-xs text-muted-foreground">
                  Choose which fields appear on the rental application and whether they're required
                </p>
                
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Desired Move-in Date</Label>
                      <p className="text-xs text-muted-foreground">When they plan to move in</p>
                    </div>
                    <Select value={fieldSettings.desiredMoveInDate} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, desiredMoveInDate: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-add-field-movein"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Number of Occupants</Label>
                      <p className="text-xs text-muted-foreground">List of everyone who will live there</p>
                    </div>
                    <Select value={fieldSettings.numberOfOccupants} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, numberOfOccupants: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-add-field-occupants"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Personal References</Label>
                      <p className="text-xs text-muted-foreground">Non-landlord/employer references (max 2)</p>
                    </div>
                    <Select value={fieldSettings.personalReferences} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, personalReferences: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-add-field-references"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Housing Voucher / Section 8</Label>
                      <p className="text-xs text-muted-foreground">Hidden by default for source-of-income laws</p>
                    </div>
                    <Select value={fieldSettings.housingVoucher} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, housingVoucher: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-add-field-voucher"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">How Did You Hear About Us</Label>
                      <p className="text-xs text-muted-foreground">Track marketing sources</p>
                    </div>
                    <Select value={fieldSettings.referralSource} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, referralSource: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-add-field-referral"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Current Landlord Contact</Label>
                      <p className="text-xs text-muted-foreground">Landlord name/phone for reference</p>
                    </div>
                    <Select value={fieldSettings.currentLandlordContact} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, currentLandlordContact: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-add-field-landlord"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Employer Phone</Label>
                      <p className="text-xs text-muted-foreground">Phone for employment verification</p>
                    </div>
                    <Select value={fieldSettings.employerPhone} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, employerPhone: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-add-field-employer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Monthly Income</Label>
                      <p className="text-xs text-muted-foreground">Applicant's monthly income</p>
                    </div>
                    <Select value={fieldSettings.monthlyIncome} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, monthlyIncome: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-add-field-income"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Reason for Moving</Label>
                      <p className="text-xs text-muted-foreground">Why they're leaving current residence</p>
                    </div>
                    <Select value={fieldSettings.reasonForMoving} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, reasonForMoving: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-add-field-reason"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) setEditingProperty(null); }}>
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
                      {sortedStates.map((state) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name}
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

              <div className="space-y-1 pt-2">
                <Label htmlFor="edit-screening-invitation-id" className="text-sm">Screening Package ID (optional)</Label>
                <Input
                  id="edit-screening-invitation-id"
                  placeholder={credentialsStatus?.defaultInvitationId ? `Default: ${credentialsStatus.defaultInvitationId}` : "Leave blank to use account default"}
                  value={screeningInvitationId}
                  onChange={(e) => setScreeningInvitationId(e.target.value)}
                  data-testid="input-edit-screening-invitation-id"
                />
                <p className="text-xs text-muted-foreground">Overrides your account-level default. Leave blank to use your account default.</p>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Property Terms & Fees</Label>
                <p className="text-xs text-muted-foreground">
                  These details will be shown to applicants before they apply. Leave blank or enter "N/A" for any that don't apply.
                </p>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-monthlyRent" className="text-sm">Monthly Rent</Label>
                    <Input
                      id="edit-monthlyRent"
                      placeholder="e.g., $1,500"
                      value={propertyTerms.monthlyRent || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, monthlyRent: e.target.value }))}
                      data-testid="input-edit-monthly-rent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-applicationFee" className="text-sm">Application Fee</Label>
                    <Input
                      id="edit-applicationFee"
                      placeholder="e.g., $50 per adult"
                      value={propertyTerms.applicationFee || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, applicationFee: e.target.value }))}
                      data-testid="input-edit-application-fee"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-securityDeposit" className="text-sm">Security Deposit</Label>
                    <Input
                      id="edit-securityDeposit"
                      placeholder="e.g., $1,500"
                      value={propertyTerms.securityDeposit || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, securityDeposit: e.target.value }))}
                      data-testid="input-edit-security-deposit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-adminFee" className="text-sm">Admin / Initiation Fee</Label>
                    <Input
                      id="edit-adminFee"
                      placeholder="e.g., $150"
                      value={propertyTerms.adminFee || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, adminFee: e.target.value }))}
                      data-testid="input-edit-admin-fee"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-leaseDeadline" className="text-sm">Lease Signing Deadline (hours)</Label>
                    <Input
                      id="edit-leaseDeadline"
                      type="number"
                      placeholder="e.g., 48"
                      value={propertyTerms.leaseSignDeadlineHours || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, leaseSignDeadlineHours: e.target.value ? parseInt(e.target.value) : undefined }))}
                      data-testid="input-edit-lease-deadline"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-additionalNotes" className="text-sm">Additional Notes</Label>
                    <Input
                      id="edit-additionalNotes"
                      placeholder="Any other terms"
                      value={propertyTerms.additionalNotes || ""}
                      onChange={(e) => setPropertyTerms(prev => ({ ...prev, additionalNotes: e.target.value }))}
                      data-testid="input-edit-additional-notes"
                    />
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Application Field Settings</Label>
                <p className="text-xs text-muted-foreground">
                  Choose which fields appear on the rental application and whether they're required
                </p>
                
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Desired Move-in Date</Label>
                      <p className="text-xs text-muted-foreground">When they plan to move in</p>
                    </div>
                    <Select value={fieldSettings.desiredMoveInDate} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, desiredMoveInDate: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-edit-field-movein"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Number of Occupants</Label>
                      <p className="text-xs text-muted-foreground">List of everyone who will live there</p>
                    </div>
                    <Select value={fieldSettings.numberOfOccupants} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, numberOfOccupants: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-edit-field-occupants"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Personal References</Label>
                      <p className="text-xs text-muted-foreground">Non-landlord/employer references (max 2)</p>
                    </div>
                    <Select value={fieldSettings.personalReferences} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, personalReferences: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-edit-field-references"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Housing Voucher / Section 8</Label>
                      <p className="text-xs text-muted-foreground">Hidden by default for source-of-income laws</p>
                    </div>
                    <Select value={fieldSettings.housingVoucher} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, housingVoucher: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-edit-field-voucher"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">How Did You Hear About Us</Label>
                      <p className="text-xs text-muted-foreground">Track marketing sources</p>
                    </div>
                    <Select value={fieldSettings.referralSource} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, referralSource: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-edit-field-referral"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Current Landlord Contact</Label>
                      <p className="text-xs text-muted-foreground">Landlord name/phone for reference</p>
                    </div>
                    <Select value={fieldSettings.currentLandlordContact} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, currentLandlordContact: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-edit-field-landlord"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Employer Phone</Label>
                      <p className="text-xs text-muted-foreground">Phone for employment verification</p>
                    </div>
                    <Select value={fieldSettings.employerPhone} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, employerPhone: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-edit-field-employer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Monthly Income</Label>
                      <p className="text-xs text-muted-foreground">Applicant's monthly income</p>
                    </div>
                    <Select value={fieldSettings.monthlyIncome} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, monthlyIncome: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-edit-field-income"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Reason for Moving</Label>
                      <p className="text-xs text-muted-foreground">Why they're leaving current residence</p>
                    </div>
                    <Select value={fieldSettings.reasonForMoving} onValueChange={(v: any) => setFieldSettings(s => ({ ...s, reasonForMoving: v }))}>
                      <SelectTrigger className="w-28" data-testid="select-edit-field-reason"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
  });

  // Always-present default applicant link, auto-created on demand
  const { data: defaultLinkData } = useQuery<{
    publicToken: string;
    vanitySlug: string | null;
    linkId: string;
    isActive?: boolean;
    expiresAt?: string | null;
    viewCount?: number;
  }>({
    queryKey: ["/api/rental/properties", property.id, "default-link"],
  });
  const linkSlugOrToken = defaultLinkData?.vanitySlug || defaultLinkData?.publicToken || null;
  const defaultLinkUrl = linkSlugOrToken
    ? `${window.location.origin}/apply/${linkSlugOrToken}`
    : null;

  // Per-link stats (views, started, submitted) — only fetched once we have a linkId
  const { data: linkStats } = useQuery<{ views: number; started: number; submitted: number }>({
    queryKey: ["/api/rental/links", defaultLinkData?.linkId, "stats"],
    enabled: !!defaultLinkData?.linkId,
  });

  const copyDefaultLink = () => {
    if (!defaultLinkUrl) return;
    navigator.clipboard.writeText(defaultLinkUrl);
    toast({ title: "Link Copied!", description: "Send this link to applicants for this property." });
  };

  // Download a QR code PNG that points to the application link
  const downloadQrCode = async () => {
    if (!defaultLinkUrl) return;
    try {
      const dataUrl = await QRCode.toDataURL(defaultLinkUrl, { width: 512, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      const safeName = (property.name || "property").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "property";
      a.download = `apply-${safeName}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast({ title: "Couldn't generate QR code", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  // Slugify property name as a starting suggestion when the landlord first edits the URL
  const suggestSlugFromPropertyName = (name: string | null | undefined): string => {
    if (!name) return "";
    return name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  };

  // Inline vanity-slug editor
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const startEditSlug = () => {
    const existing = defaultLinkData?.vanitySlug || "";
    setSlugDraft(existing || suggestSlugFromPropertyName(property.name));
    setIsEditingSlug(true);
  };

  // Pause / resume / expiration controls
  const isLinkActive = defaultLinkData?.isActive !== false;
  const expiresAtIso = defaultLinkData?.expiresAt || null;
  const expiresAtDateOnly = expiresAtIso ? new Date(expiresAtIso).toISOString().slice(0, 10) : "";
  const isExpired = !!expiresAtIso && new Date(expiresAtIso) < new Date();
  const updateLinkStatusMutation = useMutation({
    mutationFn: async (data: { isActive?: boolean; expiresAt?: string | null }) => {
      const res = await apiRequest("PATCH", `/api/rental/links/${defaultLinkData?.linkId}/status`, data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to update link" }));
        throw new Error(err.message || "Failed to update link");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties", property.id, "default-link"] });
    },
    onError: (e: any) => {
      toast({ title: "Couldn't update link", description: e.message, variant: "destructive" });
    },
  });
  const togglePause = () => {
    if (!defaultLinkData?.linkId) return;
    updateLinkStatusMutation.mutate({ isActive: !isLinkActive });
  };
  const setExpiresAt = (value: string) => {
    if (!defaultLinkData?.linkId) return;
    updateLinkStatusMutation.mutate({ expiresAt: value === "" ? null : value });
  };
  const updateSlugMutation = useMutation({
    mutationFn: async (newSlug: string | null) => {
      const res = await apiRequest(
        "PATCH",
        `/api/rental/links/${defaultLinkData?.linkId}/vanity-slug`,
        { vanitySlug: newSlug },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to update URL" }));
        throw new Error(err.message || "Failed to update URL");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties", property.id, "default-link"] });
      toast({ title: "Link URL updated" });
      setIsEditingSlug(false);
    },
    onError: (e: any) => {
      toast({ title: "Couldn't update URL", description: e.message, variant: "destructive" });
    },
  });
  const saveSlug = () => {
    const trimmed = slugDraft.trim();
    updateSlugMutation.mutate(trimmed === "" ? null : trimmed);
  };

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
        
        {/* Default applicant link — always shown, ready to share */}
        <div className="mb-3 rounded-md border border-border bg-background p-3" data-testid={`default-link-${property.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <LinkIcon className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium">Application Link</span>
              {!isLinkActive && (
                <Badge variant="secondary" className="text-xs" data-testid={`badge-link-paused-${property.id}`}>Paused</Badge>
              )}
              {isLinkActive && isExpired && (
                <Badge variant="destructive" className="text-xs" data-testid={`badge-link-expired-${property.id}`}>Expired</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">Send to applicants</span>
          </div>
          {defaultLinkUrl ? (
            isEditingSlug ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {window.location.origin}/apply/
                  </span>
                  <Input
                    autoFocus
                    value={slugDraft}
                    onChange={(e) => setSlugDraft(e.target.value)}
                    placeholder="e.g. main-house"
                    className="flex-1 min-w-[180px] h-9 font-mono text-sm"
                    data-testid={`input-vanity-slug-${property.id}`}
                  />
                  <Button
                    size="sm"
                    onClick={saveSlug}
                    disabled={updateSlugMutation.isPending}
                    data-testid={`button-save-slug-${property.id}`}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingSlug(false)}
                    disabled={updateSlugMutation.isPending}
                    data-testid={`button-cancel-slug-${property.id}`}
                  >
                    <XIcon className="h-3.5 w-3.5 mr-1" />
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  3–40 lowercase letters, numbers, hyphens. Leave blank to use the original random URL.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <code
                  className="flex-1 min-w-0 truncate text-xs bg-muted px-2 py-1.5 rounded font-mono"
                  data-testid={`text-default-link-url-${property.id}`}
                  title={defaultLinkUrl}
                >
                  {defaultLinkUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startEditSlug}
                  data-testid={`button-edit-slug-${property.id}`}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit URL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyDefaultLink}
                  data-testid={`button-copy-default-link-${property.id}`}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadQrCode}
                  data-testid={`button-download-qr-${property.id}`}
                >
                  <QrCode className="h-3.5 w-3.5 mr-1" />
                  QR Code
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  asChild
                  data-testid={`button-open-default-link-${property.id}`}
                >
                  <a href={defaultLinkUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Open
                  </a>
                </Button>
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground">Preparing your link…</p>
          )}

          {/* Stats + lifecycle controls */}
          {defaultLinkData?.linkId && !isEditingSlug && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs" data-testid={`link-stats-${property.id}`}>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  <span>
                    <span className="font-semibold text-foreground" data-testid={`stat-views-${property.id}`}>
                      {linkStats?.views ?? 0}
                    </span>{" "}
                    views
                  </span>
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span>
                    <span className="font-semibold text-foreground" data-testid={`stat-started-${property.id}`}>
                      {linkStats?.started ?? 0}
                    </span>{" "}
                    started
                  </span>
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    <span className="font-semibold text-foreground" data-testid={`stat-submitted-${property.id}`}>
                      {linkStats?.submitted ?? 0}
                    </span>{" "}
                    submitted
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={togglePause}
                  disabled={updateLinkStatusMutation.isPending}
                  data-testid={`button-toggle-link-active-${property.id}`}
                >
                  {isLinkActive ? (
                    <>
                      <Pause className="h-3.5 w-3.5 mr-1" />
                      Pause link
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 mr-1" />
                      Resume link
                    </>
                  )}
                </Button>
                <Label htmlFor={`expires-${property.id}`} className="text-xs text-muted-foreground">
                  Expires:
                </Label>
                <Input
                  id={`expires-${property.id}`}
                  type="date"
                  value={expiresAtDateOnly}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  disabled={updateLinkStatusMutation.isPending}
                  className="h-9 w-[160px] text-xs"
                  data-testid={`input-link-expires-${property.id}`}
                />
                {expiresAtDateOnly && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpiresAt("")}
                    disabled={updateLinkStatusMutation.isPending}
                    data-testid={`button-clear-expires-${property.id}`}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Button size="sm" variant="outline" onClick={() => onAddUnit(false)} data-testid={`button-add-unit-${property.id}`}>
            <Plus className="h-4 w-4 mr-1" />
            Add Unit
          </Button>
          <span className="text-xs text-muted-foreground">Only needed if this property has multiple units with different terms.</span>
        </div>

        <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between" data-testid={`button-expand-${property.id}`}>
              <span className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                {units.filter(u => u.unitLabel && u.unitLabel.trim() !== "").length} Additional Unit{units.filter(u => u.unitLabel && u.unitLabel.trim() !== "").length !== 1 ? "s" : ""}
              </span>
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {units.filter(u => u.unitLabel && u.unitLabel.trim() !== "").length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No additional units. Click "Add Unit" above if you have multiple units with different rent or deposits.
              </p>
            ) : (
              <div className="space-y-2">
                {units.filter(u => u.unitLabel && u.unitLabel.trim() !== "").map((unit) => (
                  <UnitCard key={unit.id} unit={unit} propertyId={property.id} property={property} />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function UnitCard({ unit, propertyId, property }: { unit: RentalUnit; propertyId: string; property: RentalProperty }) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(unit.unitLabel || "");
  const [editRent, setEditRent] = useState(unit.rentAmount ? (unit.rentAmount / 100).toFixed(2) : "");
  const [editDeposit, setEditDeposit] = useState(
    (unit as any).securityDepositAmount != null ? ((unit as any).securityDepositAmount / 100).toFixed(2) : ""
  );

  // Parse the property-level deposit string (e.g. "$1,500" or "1500.00") into a plain numeric string for the unit field.
  const propertyTerms = ((property as any).propertyTermsJson || {}) as { monthlyRent?: string; securityDeposit?: string };
  const parseMoneyString = (s?: string): string => {
    if (!s) return "";
    const cleaned = s.replace(/[^0-9.]/g, "");
    if (!cleaned) return "";
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n.toFixed(2) : "";
  };
  const propertyDepositParsed = parseMoneyString(propertyTerms.securityDeposit);
  const propertyRentParsed = parseMoneyString(propertyTerms.monthlyRent);
  
  const { data: links = [] } = useQuery<RentalApplicationLink[]>({
    queryKey: ["/api/rental/units", unit.id, "links"],
  });

  const updateUnitMutation = useMutation({
    mutationFn: async ({ unitLabel, rentAmount, securityDepositAmount }: { unitLabel: string; rentAmount: number | null; securityDepositAmount: number | null }) => {
      const token = getAccessToken();
      const response = await fetch(`/api/rental/units/${unit.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ unitLabel, rentAmount, securityDepositAmount }),
      });
      if (!response.ok) throw new Error("Failed to update unit");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/properties", propertyId, "units"] });
      toast({ title: "Unit Updated", description: "The unit has been updated." });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update unit.", variant: "destructive" });
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
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Unit name</Label>
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="e.g., Apt A, Unit 101"
                    className="h-8 w-32 text-sm"
                    autoFocus
                    data-testid={`input-edit-unit-${unit.id}`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Monthly rent</Label>
                    {propertyRentParsed && (
                      <button
                        type="button"
                        onClick={() => setEditRent(propertyRentParsed)}
                        className="text-xs text-primary hover:underline"
                        data-testid={`button-copy-rent-from-property-${unit.id}`}
                      >
                        Use property rent (${propertyRentParsed})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      value={editRent}
                      onChange={(e) => setEditRent(e.target.value)}
                      placeholder="0.00"
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 w-24 text-sm"
                      data-testid={`input-edit-rent-${unit.id}`}
                    />
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Security deposit</Label>
                    {propertyDepositParsed && (
                      <button
                        type="button"
                        onClick={() => setEditDeposit(propertyDepositParsed)}
                        className="text-xs text-primary hover:underline"
                        data-testid={`button-copy-deposit-from-property-${unit.id}`}
                      >
                        Use property deposit (${propertyDepositParsed})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      value={editDeposit}
                      onChange={(e) => setEditDeposit(e.target.value)}
                      placeholder="Leave blank for none"
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 w-32 text-sm"
                      data-testid={`input-edit-deposit-${unit.id}`}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const rentCents = editRent ? Math.round(parseFloat(editRent) * 100) : null;
                    const depositCents = editDeposit ? Math.round(parseFloat(editDeposit) * 100) : null;
                    updateUnitMutation.mutate({ unitLabel: editLabel, rentAmount: rentCents, securityDepositAmount: depositCents });
                  }}
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
                    setEditRent(unit.rentAmount ? (unit.rentAmount / 100).toFixed(2) : "");
                    setEditDeposit((unit as any).securityDepositAmount != null ? ((unit as any).securityDepositAmount / 100).toFixed(2) : "");
                  }}
                  data-testid={`button-cancel-edit-unit-${unit.id}`}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{unit.unitLabel || "Default"}</span>
              {unit.rentAmount != null && (
                <Badge variant="outline" className="text-xs">
                  ${(unit.rentAmount / 100).toLocaleString()}/mo
                </Badge>
              )}
              {(unit as any).securityDepositAmount != null && (
                <Badge variant="outline" className="text-xs" data-testid={`badge-deposit-${unit.id}`}>
                  Deposit: ${((unit as any).securityDepositAmount / 100).toLocaleString()}
                </Badge>
              )}
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
