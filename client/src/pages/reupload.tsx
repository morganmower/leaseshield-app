import { useState, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle, AlertCircle, FileText, Loader2, Shield } from "lucide-react";
import logoHorizontal from "@/assets/logo-horizontal.png";

interface FileTypeInfo {
  type: string;
  label: string;
  uploaded: boolean;
}

interface ReuploadTokenData {
  allowed_file_types: FileTypeInfo[];
  expires_at: string;
  all_complete: boolean;
  first_name: string | null;
}

export default function Reupload() {
  const [, params] = useRoute("/reupload/:token");
  const token = params?.token;
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<ReuploadTokenData>({
    queryKey: ["/api/reupload", token],
    queryFn: async () => {
      const res = await fetch(`/api/reupload/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ fileType, file }: { fileType: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", fileType);

      const res = await fetch(`/api/reupload/${token}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "Uploaded", description: "Document uploaded successfully." });
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      setUploadingType(null);
    },
  });

  const handleFileSelect = (fileType: string, file: File) => {
    setUploadingType(fileType);
    uploadMutation.mutate({ fileType, file });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2" data-testid="text-error-title">Link Unavailable</h2>
            <p className="text-muted-foreground" data-testid="text-error-message">
              {(error as Error).message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  if (data.all_complete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2" data-testid="text-complete-title">You're all set!</h2>
            <p className="text-muted-foreground" data-testid="text-complete-message">
              All requested documents have been uploaded. No further action is needed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stillNeeded = data.allowed_file_types.filter((ft) => !ft.uploaded);
  const alreadyDone = data.allowed_file_types.filter((ft) => ft.uploaded);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center justify-center mb-6">
          <img src={logoHorizontal} alt="LeaseShield" className="h-8" data-testid="img-logo" />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl" data-testid="text-page-title">
              {data.first_name ? `Hi ${data.first_name}, w` : "W"}e need a few more documents
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Please upload the missing items below to complete your application.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {stillNeeded.map((ft) => (
              <div
                key={ft.type}
                className="flex items-center justify-between gap-3 p-3 rounded-md border"
                data-testid={`row-doc-${ft.type}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{ft.label}</span>
                </div>
                <div className="shrink-0">
                  <input
                    type="file"
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[ft.type] = el; }}
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(ft.type, file);
                      e.target.value = "";
                    }}
                    data-testid={`input-file-${ft.type}`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={uploadingType !== null}
                    onClick={() => fileInputRefs.current[ft.type]?.click()}
                    data-testid={`button-upload-${ft.type}`}
                  >
                    {uploadingType === ft.type ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Upload
                  </Button>
                </div>
              </div>
            ))}

            {alreadyDone.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Already uploaded</p>
                {alreadyDone.map((ft) => (
                  <div
                    key={ft.type}
                    className="flex items-center gap-3 p-2 rounded-md"
                    data-testid={`row-done-${ft.type}`}
                  >
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-sm text-muted-foreground">{ft.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Your documents are encrypted and stored securely. This link expires on{" "}
                {new Date(data.expires_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                .
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
