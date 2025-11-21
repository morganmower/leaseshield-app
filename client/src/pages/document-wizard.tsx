import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Download, Loader2, Save, Building2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Template, Property } from "@shared/schema";
import { useState, useEffect } from "react";

interface FieldDefinition {
  id: string;
  label: string;
  type: string;
  required: boolean;
  category: string;
  defaultValue?: string;
}

interface FillableFormData {
  fields: FieldDefinition[];
}

export default function DocumentWizard() {
  const [match, params] = useRoute("/templates/:id/fill/:documentId?");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const templateId = params?.id;
  const documentId = params?.documentId; // Optional: for re-editing saved documents
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  // Fetch template
  const { data: template, isLoading } = useQuery<Template>({
    queryKey: ["/api/templates", templateId],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${templateId}`);
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
      const response = await fetch(`/api/saved-documents/${documentId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch saved document');
      return response.json();
    },
    enabled: !!documentId,
  });

  // Fetch properties
  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    queryFn: async () => {
      const response = await fetch('/api/properties', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    },
  });

  const fillableData = template?.fillableFormData as FillableFormData | null;
  const fields = fillableData?.fields || [];

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
      const response = await fetch('/api/saved-documents', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
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
    mutationFn: async (fieldValues: Record<string, string>) => {
      const response = await fetch(`/api/documents/generate`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ templateId, fieldValues }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Handle blob response
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate document');
      }

      return response.blob();
    },
    onSuccess: (blob, fieldValues) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template?.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Store the data for saving
      setLastGeneratedData(fieldValues);

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

      toast({
        title: "Document Generated!",
        description: "Your PDF has been downloaded and saved to your library.",
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

  const onSubmit = (data: Record<string, string>) => {
    // Format currency fields
    const formattedData = Object.entries(data).reduce((acc, [key, value]) => {
      const field = fields.find(f => f.id === key);
      if (field?.type === 'currency' && value) {
        acc[key] = `$${value}`;
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

    generateMutation.mutate(formattedData);
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
                    Your PDF has been downloaded and saved to your library. You can generate another document or view all your saved documents.
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
              Complete all required fields below. Your information will be used to generate a customized PDF document.
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
                            <FormItem className={field.type === 'text' && field.id.includes('Address') ? 'md:col-span-2' : ''}>
                              <FormLabel>
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type={field.type === 'currency' ? 'text' : field.type}
                                  placeholder={
                                    field.type === 'currency' ? '0.00' :
                                    field.type === 'date' ? 'YYYY-MM-DD' :
                                    field.type === 'tel' ? '(555) 555-5555' :
                                    `Enter ${field.label.toLowerCase()}`
                                  }
                                  {...formField}
                                  data-testid={`input-${field.id}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Submit Button */}
                <div className="flex items-center gap-4 pt-6 border-t">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={generateMutation.isPending}
                    data-testid="button-generate-document"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <Download className="h-5 w-5 mr-2" />
                        Generate & Download PDF
                      </>
                    )}
                  </Button>
                  
                  <p className="text-sm text-muted-foreground">
                    Your document will be downloaded as a PDF file.
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
