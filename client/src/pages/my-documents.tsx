import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Trash2, Search, Calendar, Building2, Edit, Upload, File } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { SavedDocument, Property, UploadedDocument } from "@shared/schema";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function MyDocuments() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocumentName, setUploadDocumentName] = useState("");
  const [uploadPropertyId, setUploadPropertyId] = useState<string>("none");
  const [uploadDescription, setUploadDescription] = useState("");
  const [deleteUploadedDocId, setDeleteUploadedDocId] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery<SavedDocument[]>({
    queryKey: ['/api/saved-documents'],
  });

  const { data: uploadedDocuments = [] } = useQuery<UploadedDocument[]>({
    queryKey: ['/api/uploaded-documents'],
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    queryFn: async () => {
      const response = await fetch('/api/properties', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/saved-documents/${id}/download`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to download document');
      }
      return { blob: await response.blob(), id };
    },
    onSuccess: ({ blob, id }) => {
      const savedDoc = documents.find(d => d.id === id);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${savedDoc?.documentName || 'document'}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Document Downloaded",
        description: "Your PDF has been downloaded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "Failed to download the document.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/saved-documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-documents'] });
      toast({
        title: "Document Deleted",
        description: "The document has been removed from your library.",
      });
      setDeleteDocId(null);
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the document.",
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, documentName, propertyId, description }: {
      file: File;
      documentName: string;
      propertyId?: string;
      description?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', documentName); // Custom name for the document
      if (propertyId && propertyId !== 'none') {
        formData.append('propertyId', propertyId);
      }
      if (description) {
        formData.append('description', description);
      }
      
      const response = await fetch('/api/uploaded-documents', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload document');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/uploaded-documents'] });
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      setUploadDocumentName("");
      setUploadPropertyId("none");
      setUploadDescription("");
      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const downloadUploadedMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/uploaded-documents/${id}/download`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to download document');
      }
      return { blob: await response.blob(), id };
    },
    onSuccess: ({ blob, id }) => {
      const uploadedDoc = uploadedDocuments.find(d => d.id === id);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = uploadedDoc?.fileName || 'document';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Document Downloaded",
        description: "Your document has been downloaded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "Failed to download the document.",
        variant: "destructive",
      });
    },
  });

  const deleteUploadedMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/uploaded-documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/uploaded-documents'] });
      toast({
        title: "Document Deleted",
        description: "The document has been removed from your library.",
      });
      setDeleteUploadedDocId(null);
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the document.",
        variant: "destructive",
      });
    },
  });

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.templateName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesProperty = selectedPropertyId === "all" ||
      (selectedPropertyId === "none" && !doc.propertyId) ||
      doc.propertyId === selectedPropertyId;
    
    return matchesSearch && matchesProperty;
  });

  const filteredUploadedDocuments = uploadedDocuments.filter(doc => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesProperty = selectedPropertyId === "all" ||
      (selectedPropertyId === "none" && !doc.propertyId) ||
      doc.propertyId === selectedPropertyId;
    
    return matchesSearch && matchesProperty;
  });

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
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
          <h1 className="text-4xl font-bold text-foreground mb-2">My Documents</h1>
          <p className="text-muted-foreground">
            Access and manage all your generated legal documents
          </p>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-documents"
            />
          </div>
          
          {properties.length > 0 && (
            <div className="relative max-w-xs">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium text-muted-foreground">Filter by Property</label>
              </div>
              <Select
                value={selectedPropertyId}
                onValueChange={setSelectedPropertyId}
              >
                <SelectTrigger data-testid="select-property-filter">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  <SelectItem value="none">No Property</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={() => setIsUploadDialogOpen(true)}
            data-testid="button-upload-document"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>

        {/* Generated Documents Section */}
        {filteredDocuments.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Generated Documents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map((document) => (
              <Card key={document.id} className="hover-elevate" data-testid={`card-document-${document.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-2" data-testid={`text-document-name-${document.id}`}>
                        {document.documentName}
                      </CardTitle>
                      <CardDescription className="mt-1" data-testid={`text-template-name-${document.id}`}>
                        {document.templateName}
                      </CardDescription>
                    </div>
                    <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span data-testid={`text-created-date-${document.id}`}>
                        {format(new Date(document.createdAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {document.propertyId && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground" data-testid={`text-property-${document.id}`}>
                          {properties.find(p => p.id === document.propertyId)?.name || 'Unknown Property'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => downloadMutation.mutate(document.id)}
                      disabled={downloadMutation.isPending}
                      className="flex-1"
                      data-testid={`button-download-${document.id}`}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation(`/templates/${document.templateId}/fill/${document.id}`)}
                      data-testid={`button-edit-${document.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteDocId(document.id)}
                      data-testid={`button-delete-${document.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>
          </div>
        )}

        {/* Uploaded Documents Section */}
        {filteredUploadedDocuments.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Uploaded Documents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUploadedDocuments.map((document) => (
                <Card key={document.id} className="hover-elevate" data-testid={`card-uploaded-document-${document.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg line-clamp-2" data-testid={`text-uploaded-document-name-${document.id}`}>
                          {document.fileName}
                        </CardTitle>
                        {document.description && (
                          <CardDescription className="mt-1" data-testid={`text-uploaded-description-${document.id}`}>
                            {document.description}
                          </CardDescription>
                        )}
                      </div>
                      <File className="h-8 w-8 text-primary flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span data-testid={`text-uploaded-date-${document.id}`}>
                          {format(new Date(document.uploadedAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {document.propertyId && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground" data-testid={`text-uploaded-property-${document.id}`}>
                            {properties.find(p => p.id === document.propertyId)?.name || 'Unknown Property'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => downloadUploadedMutation.mutate(document.id)}
                        disabled={downloadUploadedMutation.isPending}
                        className="flex-1"
                        data-testid={`button-download-uploaded-${document.id}`}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteUploadedDocId(document.id)}
                        data-testid={`button-delete-uploaded-${document.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredDocuments.length === 0 && filteredUploadedDocuments.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Documents Yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                {searchQuery
                  ? "No documents match your search. Try a different search term."
                  : "Generate documents using templates or upload your own to start building your library."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Upload Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent data-testid="dialog-upload-document">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload your own lease or other document. Accepted formats: PDF, DOC, DOCX (max 20MB).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="file-upload">Select File *</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 20 * 1024 * 1024) {
                        toast({
                          title: "File Too Large",
                          description: "Please select a file smaller than 20MB.",
                          variant: "destructive",
                        });
                        e.target.value = '';
                        return;
                      }
                      setUploadFile(file);
                      if (!uploadDocumentName) {
                        setUploadDocumentName(file.name);
                      }
                    }
                  }}
                  data-testid="input-file-upload"
                />
                {uploadFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="document-name">Document Name *</Label>
                <Input
                  id="document-name"
                  placeholder="My Lease Agreement"
                  value={uploadDocumentName}
                  onChange={(e) => setUploadDocumentName(e.target.value)}
                  data-testid="input-document-name"
                  required
                />
                <p className="text-sm text-muted-foreground">Give this document a custom name</p>
              </div>

              {properties.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="upload-property-select">Property (Optional)</Label>
                  <Select
                    value={uploadPropertyId}
                    onValueChange={setUploadPropertyId}
                  >
                    <SelectTrigger id="upload-property-select" data-testid="select-upload-property">
                      <SelectValue placeholder="Select a property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Property</SelectItem>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="upload-description">Description (Optional)</Label>
                <Textarea
                  id="upload-description"
                  placeholder="Add notes about this document..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  data-testid="textarea-upload-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setUploadFile(null);
                  setUploadDocumentName("");
                  setUploadPropertyId("none");
                  setUploadDescription("");
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (uploadFile && uploadDocumentName.trim()) {
                    uploadMutation.mutate({
                      file: uploadFile,
                      documentName: uploadDocumentName.trim(),
                      propertyId: uploadPropertyId !== "none" ? uploadPropertyId : undefined,
                      description: uploadDescription || undefined,
                    });
                  }
                }} 
                disabled={!uploadFile || !uploadDocumentName.trim() || uploadMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Generated Document Dialog */}
        <AlertDialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
          <AlertDialogContent data-testid="dialog-confirm-delete">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this document from your library. You can always regenerate it from the template.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDocId && deleteMutation.mutate(deleteDocId)}
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Uploaded Document Dialog */}
        <AlertDialog open={!!deleteUploadedDocId} onOpenChange={(open) => !open && setDeleteUploadedDocId(null)}>
          <AlertDialogContent data-testid="dialog-confirm-delete-uploaded">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Uploaded Document?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this uploaded document from your library. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-uploaded">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteUploadedDocId && deleteUploadedMutation.mutate(deleteUploadedDocId)}
                data-testid="button-confirm-delete-uploaded"
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
