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
import { FileText, Download, Trash2, Search, Calendar, Building2, Edit } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { SavedDocument, Property } from "@shared/schema";
import { format } from "date-fns";

export default function MyDocuments() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery<SavedDocument[]>({
    queryKey: ['/api/saved-documents'],
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

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.templateName.toLowerCase().includes(searchQuery.toLowerCase());
    
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
        </div>

        {filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Documents Yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                {searchQuery
                  ? "No documents match your search. Try a different search term."
                  : "Generate documents using templates to start building your library."}
              </p>
            </CardContent>
          </Card>
        ) : (
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
        )}

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
      </div>
    </div>
  );
}
