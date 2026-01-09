import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Download, Loader2, Save, Building2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest, queryClient, getAccessToken } from "@/lib/queryClient";
import type { Template, RentalProperty, LegalUpdate } from "@shared/schema";
import { useState, useEffect } from "react";
import { format } from "date-fns";

interface FieldDefinition {
  id: string;
  label: string;
  type: string;
  required: boolean;
  category: string;
  defaultValue?: string;
  options?: string[];
}

interface FillableSection {
  title: string;
  fields: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
    defaultValue?: string;
    options?: string[];
  }>;
}

interface FillableFormData {
  fields?: FieldDefinition[];
  sections?: FillableSection[];
}

export default function DocumentWizard() {
  const [match, params] = useRoute("/templates/:id/fill/:documentId?");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const templateId = params?.id;
  const documentId = params?.documentId; // Optional: for re-editing saved documents
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [showLegalUpdates, setShowLegalUpdates] = useState(false);

  // Fetch template
  const { data: template, isLoading } = useQuery<Template>({
    queryKey: ["/api/templates", templateId],
    queryFn: async () => {
      const token = getAccessToken();
      const response = await fetch(`/api/templates/${templateId}`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        throw new Error('Failed to fetch template');
      }
      return response.json();
    },
    enabled: !!templateId,
  });

  // Fetch saved document if re-editing
  const { data: savedDocument, isLoading: isLoadingSavedDoc } = useQuery({
    queryKey: ['/api/saved-documents', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      const token = getAccessToken();
      const response = await fetch(`/api/saved-documents/${documentId}`, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Failed to fetch saved document');
      return response.json();
    },
    enabled: !!documentId,
  });

  // Fetch properties
  const { data: properties = [] } = useQuery<RentalProperty[]>({
    queryKey: ['/api/rental/properties'],
  });

  // Fetch legal updates that affect this template
  const { data: relatedLegalUpdates = [] } = useQuery<LegalUpdate[]>({
    queryKey: ["/api/legal-updates", template?.stateId, templateId],
    queryFn: async () => {
      if (!template?.stateId || !templateId) return [];
      // Guard against non-browser environments
      if (typeof window === 'undefined') return [];
      
      const url = `/api/legal-updates?stateId=${template.stateId}`;
      try {
        const token = getAccessToken();
        const response = await fetch(url, { 
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) return [];
        const allUpdates: LegalUpdate[] = await response.json();
        // Filter to only updates that affect this template
        return allUpdates.filter(update => 
          update.affectedTemplateIds?.includes(templateId)
        );
      } catch {
        return [];
      }
    },
    enabled: !!template?.stateId && !!templateId,
  });

  const fillableData = template?.fillableFormData as FillableFormData | null;
  
  // Handle both legacy 'fields' format and new 'sections' format
  const fields: FieldDefinition[] = fillableData?.sections 
    ? fillableData.sections.flatMap(section => 
        section.fields.map(field => ({
          id: field.name,
          label: field.label,
          type: field.type,
          required: field.required,
          category: section.title,
          defaultValue: field.defaultValue,
          options: field.options,
        }))
      )
    : fillableData?.fields || [];

  // Group fields by category
  const categories = fields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, FieldDefinition[]>);

  // Build Zod schema dynamically
  const formSchema = z.object(
    fields.reduce((acc, field) => {
      let fieldSchema: z.ZodTypeAny;

      if (field.type === 'email') {
        fieldSchema = z.string().email('Invalid email address');
      } else if (field.type === 'currency') {
        fieldSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid currency amount');
      } else if (field.type === 'number') {
        fieldSchema = z.string().regex(/^\d+$/, 'Must be a number');
      } else if (field.type === 'tel') {
        fieldSchema = z.string().min(10, 'Phone number must be at least 10 digits');
      } else if (field.type === 'date') {
        fieldSchema = z.string().min(1, 'Date is required');
      } else {
        fieldSchema = z.string().min(1, `${field.label} is required`);
      }

      if (!field.required) {
        fieldSchema = fieldSchema.optional().or(z.literal(''));
      }

      acc[field.id] = fieldSchema;
      return acc;
    }, {} as Record<string, z.ZodTypeAny>)
  );

  // Helper function to normalize saved document data for form fields
  const normalizeSavedData = (savedDoc: any, fieldList: FieldDefinition[]): Record<string, string> => {
    return fieldList.reduce((acc, field) => {
      if (savedDoc?.formData && savedDoc.formData[field.id]) {
        const savedValue = savedDoc.formData[field.id];
        // Handle date formatting - convert from display format back to YYYY-MM-DD
        if (field.type === 'date' && typeof savedValue === 'string' && savedValue.includes(',')) {
          const date = new Date(savedValue);
          acc[field.id] = date.toISOString().split('T')[0];
        } else if (field.type === 'currency' && typeof savedValue === 'string' && savedValue.startsWith('$')) {
          // Remove $ for editing
          acc[field.id] = savedValue.slice(1);
        } else {
          acc[field.id] = String(savedValue);
        }
      } else if (field.defaultValue === 'today') {
        acc[field.id] = new Date().toISOString().split('T')[0];
      } else if (field.defaultValue) {
        acc[field.id] = field.defaultValue;
      } else {
        acc[field.id] = '';
      }
      return acc;
    }, {} as Record<string, string>);
  };

  // Initialize form with default values from template schema only
  const defaultValues = fields.reduce((acc, field) => {
    if (field.defaultValue === 'today') {
      acc[field.id] = new Date().toISOString().split('T')[0];
    } else if (field.defaultValue) {
      acc[field.id] = field.defaultValue;
    } else {
      acc[field.id] = '';
    }
    return acc;
  }, {} as Record<string, string>);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const [lastGeneratedData, setLastGeneratedData] = useState<Record<string, string> | null>(null);
  const [lastGeneratedFormat, setLastGeneratedFormat] = useState<'pdf' | 'docx'>('pdf');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'docx'>('pdf');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  // Reset form with saved document data when documentId or document changes
  useEffect(() => {
    // Only reset if we have a saved document and fields are loaded
    if (savedDocument && fields.length > 0) {
      // Check if form is dirty before resetting
      const isDirty = form.formState.isDirty;
      if (!isDirty) {
        const resetValues = normalizeSavedData(savedDocument, fields);
        form.reset(resetValues);

        // Always set property from saved document (including null to clear previous)
        setSelectedPropertyId(savedDocument.propertyId || null);
      }
    }
  }, [documentId, savedDocument?.createdAt, fields.length, form]);

  // Auto-calculate lease end date based on term period and start date
  const leaseTerm = form.watch('leaseTerm');
  const leaseStartDate = form.watch('leaseStartDate');

  useEffect(() => {
    if (leaseTerm && leaseStartDate && leaseTerm !== 'Custom') {
      const startDate = new Date(leaseStartDate);
      if (!isNaN(startDate.getTime())) {
        let endDate = new Date(startDate);
        if (leaseTerm === '1 Year') {
          endDate.setFullYear(endDate.getFullYear() + 1);
          endDate.setDate(endDate.getDate() - 1);
        } else if (leaseTerm === '2 Years') {
          endDate.setFullYear(endDate.getFullYear() + 2);
          endDate.setDate(endDate.getDate() - 1);
        }
        const endDateStr = endDate.toISOString().split('T')[0];
        const currentEndDate = form.getValues('leaseEndDate');
        if (currentEndDate !== endDateStr) {
          form.setValue('leaseEndDate', endDateStr);
        }
      }
    }
  }, [leaseTerm, leaseStartDate, form]);

  // Save document mutation
  const saveMutation = useMutation({
    mutationFn: async (data: {
      templateId: string;
      templateName: string;
      templateVersion: number | null;
      documentName: string;
      formData: Record<string, string>;
      stateCode: string | null;
      propertyId?: string | null;
    }) => {
      const token = getAccessToken();
      const response = await fetch('/api/saved-documents', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(data),
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
      });
      if (!response.ok) {
        throw new Error('Failed to save document');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-documents'] });
      toast({
        title: "Document Saved!",
        description: "Added to your document library.",
      });
    },
  });

  // Generate document mutation
  const generateMutation = useMutation({
    mutationFn: async ({ fieldValues, format }: { fieldValues: Record<string, string>; format: 'pdf' | 'docx' }) => {
      const token = getAccessToken();
      const response = await fetch(`/api/documents/generate?format=${format}`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ templateId, fieldValues }),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
      });

      // Handle blob response
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate document');
      }

      return { blob: await response.blob(), format };
    },
    onSuccess: ({ blob, format }, { fieldValues }) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = format === 'docx' ? 'docx' : 'pdf';
      a.download = `${template?.title.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Store the data and format for saving
      setLastGeneratedData(fieldValues);
      setLastGeneratedFormat(format);

      // Auto-save to document library
      if (template) {
        const tenantField = fields.find(f => f.id.includes('tenant') && f.id.includes('name'));
        const tenantName = tenantField ? fieldValues[tenantField.id] : '';
        const documentName = tenantName 
          ? `${template.title} - ${tenantName}`
          : template.title;

        saveMutation.mutate({
          templateId: template.id,
          templateName: template.title,
          templateVersion: template.version || null,
          documentName,
          formData: fieldValues,
          stateCode: template.stateId || null,
          propertyId: selectedPropertyId,
        });
      }

      // Show success banner
      setShowSuccessBanner(true);

      const formatLabel = format === 'docx' ? 'Word document' : 'PDF';
      toast({
        title: "Document Generated!",
        description: `Your ${formatLabel} has been downloaded and saved to your library.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerate = (data: Record<string, string>, format: 'pdf' | 'docx') => {
    // Format fields for document generation
    // Note: Currency values are sent without $ prefix - the server template adds it
    const formattedData = Object.entries(data).reduce((acc, [key, value]) => {
      const field = fields.find(f => f.id === key);
      if (field?.type === 'currency' && value) {
        // Keep just the number - server template adds $ prefix
        acc[key] = value;
      } else if (field?.type === 'date' && value) {
        acc[key] = new Date(value).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);

    generateMutation.mutate({ fieldValues: formattedData, format });
  };

  const onSubmit = (data: Record<string, string>) => {
    handleGenerate(data, selectedFormat);
  };

  if (isLoading || isLoadingSavedDoc) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-24 w-full mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!template || !fillableData || fields.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <Card>
            <CardHeader>
              <CardTitle>Template Not Available</CardTitle>
              <CardDescription>
                This template doesn't support document assembly yet, or the template was not found.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setLocation("/templates")} variant="outline" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Templates
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            onClick={() => setLocation(documentId ? "/my-documents" : "/templates")} 
            variant="ghost" 
            className="mb-4"
            data-testid="button-back-to-templates"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {documentId ? "Back to My Documents" : "Back to Templates"}
          </Button>
          
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 rounded-lg p-3">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              {documentId && (
                <div className="mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Re-editing Saved Document
                  </span>
                </div>
              )}
              <h1 className="text-3xl font-display font-semibold mb-2" data-testid="text-template-title">
                {template.title}
              </h1>
              <p className="text-muted-foreground" data-testid="text-template-description">
                {template.description}
              </p>
            </div>
          </div>
        </div>

        {/* Legal Updates Banner - Shows recent law changes affecting this document */}
        {relatedLegalUpdates.length > 0 && (
          <Card className="mb-6 border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30" data-testid="card-legal-updates-banner">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                    <AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                      This Document Reflects Recent Legal Updates
                    </h3>
                    <Badge 
                      variant="default" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      {relatedLegalUpdates.length} Update{relatedLegalUpdates.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    This template has been updated to reflect the latest legislative changes in your state.
                  </p>
                  
                  {/* Toggle to show/hide details */}
                  <button
                    onClick={() => setShowLegalUpdates(!showLegalUpdates)}
                    className="flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-300 mt-2 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors"
                    data-testid="button-toggle-legal-updates"
                  >
                    {showLegalUpdates ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        View What Changed
                      </>
                    )}
                  </button>
                  
                  {/* Expanded legal updates list */}
                  {showLegalUpdates && (
                    <div className="mt-4 space-y-3">
                      {relatedLegalUpdates.map((update) => (
                        <div 
                          key={update.id} 
                          className="bg-white dark:bg-emerald-900/30 rounded-lg p-4 border border-emerald-100 dark:border-emerald-800"
                          data-testid={`legal-update-item-${update.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-foreground">{update.title}</h4>
                            <Badge 
                              variant={update.impactLevel === 'high' ? 'destructive' : update.impactLevel === 'medium' ? 'default' : 'secondary'}
                              className="text-xs flex-shrink-0"
                            >
                              {update.impactLevel} impact
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {update.whyItMatters}
                          </p>
                          {update.effectiveDate && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Effective: {format(new Date(update.effectiveDate), "MMMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      ))}
                      <div className="pt-2">
                        <Link to={`/legal-updates?stateId=${template.stateId}`}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-900"
                            data-testid="button-view-all-legal-updates"
                          >
                            View All Legal Updates
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Banner */}
        {showSuccessBanner && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" data-testid="card-success-banner">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                    Document Generated Successfully!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Your {lastGeneratedFormat === 'docx' ? 'Word document' : 'PDF'} has been downloaded and saved to your library. You can generate another document or view all your saved documents.
                  </p>
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={() => setLocation("/my-documents")}
                      variant="default"
                      size="sm"
                      data-testid="button-view-my-documents"
                    >
                      View My Documents
                    </Button>
                    <Button
                      onClick={() => {
                        setShowSuccessBanner(false);
                        form.reset();
                      }}
                      variant="outline"
                      size="sm"
                      data-testid="button-generate-another"
                    >
                      Generate Another
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Fill Out Document</CardTitle>
            <CardDescription>
              Complete all required fields below. Your information will be used to generate a customized document.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Property Selector */}
            {properties.length > 0 && (
              <div className="mb-6 pb-6 border-b">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Associate with Property (Optional)</label>
                </div>
                <Select
                  value={selectedPropertyId || "none"}
                  onValueChange={(value) => setSelectedPropertyId(value === "none" ? null : value)}
                >
                  <SelectTrigger className="max-w-md" data-testid="select-property">
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Property</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name} - {property.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  Link this document to a specific property for better organization
                </p>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {Object.entries(categories).map(([category, categoryFields]) => (
                  <div key={category} className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2" data-testid={`text-category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                      {category}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryFields.map((field) => (
                        <FormField
                          key={field.id}
                          control={form.control}
                          name={field.id}
                          render={({ field: formField }) => (
                            <FormItem className={field.type === 'text' && field.id.includes('Address') ? 'md:col-span-2' : field.type === 'checkbox' ? 'md:col-span-2' : ''}>
                              <FormLabel>
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                              </FormLabel>
                              <FormControl>
                                {field.type === 'select' && field.options ? (
                                  <Select
                                    value={formField.value || ''}
                                    onValueChange={formField.onChange}
                                  >
                                    <SelectTrigger data-testid={`select-${field.id}`}>
                                      <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {field.options.map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : field.type === 'checkbox' ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={formField.value === 'true'}
                                      onChange={(e) => formField.onChange(e.target.checked ? 'true' : '')}
                                      className="h-4 w-4 rounded border-gray-300"
                                      data-testid={`checkbox-${field.id}`}
                                    />
                                    <span className="text-sm text-muted-foreground">I confirm</span>
                                  </div>
                                ) : (
                                  <Input
                                    type={field.type === 'currency' ? 'text' : field.type}
                                    placeholder={
                                      field.type === 'currency' ? '0.00' :
                                      field.type === 'date' ? 'YYYY-MM-DD' :
                                      field.type === 'tel' ? '(555) 555-5555' :
                                      `Enter ${field.label.toLowerCase()}`
                                    }
                                    disabled={field.id === 'leaseEndDate' && !!leaseTerm && leaseTerm !== 'Custom'}
                                    {...formField}
                                    data-testid={`input-${field.id}`}
                                  />
                                )}
                              </FormControl>
                              {field.id === 'leaseEndDate' && leaseTerm && leaseTerm !== 'Custom' && (
                                <p className="text-xs text-muted-foreground">Auto-calculated based on {leaseTerm} term</p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Submit Buttons - PDF and Word options */}
                <div className="flex flex-col gap-4 pt-6 border-t">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      type="button"
                      size="lg"
                      disabled={generateMutation.isPending}
                      onClick={() => {
                        setSelectedFormat('pdf');
                        form.handleSubmit((data) => handleGenerate(data, 'pdf'))();
                      }}
                      data-testid="button-generate-pdf"
                    >
                      {generateMutation.isPending && selectedFormat === 'pdf' ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Generating PDF...
                        </>
                      ) : (
                        <>
                          <Download className="h-5 w-5 mr-2" />
                          Download PDF
                        </>
                      )}
                    </Button>
                    
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      disabled={generateMutation.isPending}
                      onClick={() => {
                        setSelectedFormat('docx');
                        form.handleSubmit((data) => handleGenerate(data, 'docx'))();
                      }}
                      data-testid="button-generate-docx"
                    >
                      {generateMutation.isPending && selectedFormat === 'docx' ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Generating Word...
                        </>
                      ) : (
                        <>
                          <FileText className="h-5 w-5 mr-2" />
                          Download Word
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Download as PDF for viewing/printing, or Word for editing.
                  </p>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Important:</strong> This document is generated based on your input and state-specific requirements. 
              These are general forms for informational purposes only. We strongly recommend having any completed documents reviewed by a local 
              attorney before use to ensure they meet your specific needs.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
