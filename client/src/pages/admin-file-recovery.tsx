import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getAccessToken } from "@/lib/queryClient";
import {
  FileWarning,
  Upload,
  Download,
  ChevronDown,
  ChevronRight,
  FileText,
  ImageIcon,
  Loader2,
  AlertTriangle,
  FolderSearch,
  Check,
} from "lucide-react";

type MissingFile = {
  id: string;
  fileType: string;
  originalName: string;
  storedPath: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
};

type AffectedPerson = {
  personId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  submissionId: string;
  submissionStatus: string;
  files: MissingFile[];
};

type MissingFilesResponse = {
  totalMissingFiles: number;
  totalAffectedPeople: number;
  people: AffectedPerson[];
};

type OrphanFile = {
  filename: string;
  fullPath: string;
  size: number;
  contentType: string;
  updated: string;
};

type OrphanFilesResponse = {
  totalOrphanFiles: number;
  files: OrphanFile[];
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-4 w-4" />;
  if (["jpg", "jpeg", "png"].includes(ext || "")) return <ImageIcon className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function SingleFileUpload({ fileId, originalName }: { fileId: string; originalName: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getAccessToken();
      const res = await fetch(`/api/admin/file-recovery/reupload/${fileId}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/file-recovery/missing-files"] });
      toast({ title: "File re-uploaded", description: `${originalName} has been restored.` });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Check className="h-3 w-3" />
        Restored
      </Badge>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleUpload}
        data-testid={`input-reupload-${fileId}`}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        data-testid={`button-reupload-${fileId}`}
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
        Re-upload
      </Button>
    </>
  );
}

function BulkUpload({ personId, personName }: { personId: string; personName: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((f) => formData.append("files", f));
      const token = getAccessToken();
      const res = await fetch(`/api/admin/file-recovery/reupload-batch/${personId}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Batch upload failed");
      }
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/file-recovery/missing-files"] });
      toast({
        title: "Bulk upload complete",
        description: `${result.matched.length} matched, ${result.unmatched.length} unmatched for ${personName}.`,
      });
    } catch (error: any) {
      toast({ title: "Bulk upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        className="hidden"
        onChange={handleBulkUpload}
        data-testid={`input-bulk-upload-${personId}`}
      />
      <Button
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        data-testid={`button-bulk-upload-${personId}`}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
        Bulk Upload
      </Button>
    </>
  );
}

function PersonCard({ person }: { person: AffectedPerson }) {
  const [open, setOpen] = useState(false);
  const displayName =
    person.firstName || person.lastName
      ? `${person.firstName || ""} ${person.lastName || ""}`.trim()
      : "Unknown";

  return (
    <Card data-testid={`card-person-${person.personId}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <CollapsibleTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-expand-${person.personId}`}>
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <div className="min-w-0">
              <p className="font-medium truncate" data-testid={`text-person-name-${person.personId}`}>
                {displayName}
              </p>
              <p className="text-sm text-muted-foreground truncate" data-testid={`text-person-email-${person.personId}`}>
                {person.email || "No email"}
              </p>
            </div>
            <Badge variant="secondary" className="capitalize" data-testid={`badge-role-${person.personId}`}>
              {person.role}
            </Badge>
            <Badge
              variant={person.submissionStatus === "complete" ? "default" : "secondary"}
              data-testid={`badge-status-${person.personId}`}
            >
              {person.submissionStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {person.files.length} missing file{person.files.length !== 1 ? "s" : ""}
            </span>
            <BulkUpload personId={person.personId} personName={displayName} />
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {person.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50 flex-wrap"
                  data-testid={`row-file-${file.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(file.originalName)}
                    <span className="text-sm truncate" data-testid={`text-filename-${file.id}`}>
                      {file.originalName}
                    </span>
                    <Badge size="sm" variant="outline" data-testid={`badge-filetype-${file.id}`}>
                      {file.fileType}
                    </Badge>
                    {file.createdAt && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <SingleFileUpload fileId={file.id} originalName={file.originalName} />
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function OrphanFileRow({ file }: { file: OrphanFile }) {
  const handleDownload = () => {
    const token = getAccessToken();
    const url = `/api/admin/file-recovery/orphan-files/${encodeURIComponent(file.filename)}/download`;
    const a = document.createElement("a");
    if (token) {
      fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      })
        .then((res) => res.blob())
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          a.href = objectUrl;
          a.download = file.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(objectUrl);
        });
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50 flex-wrap"
      data-testid={`row-orphan-${file.filename}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {getFileIcon(file.filename)}
        <span className="text-sm font-medium truncate" data-testid={`text-orphan-name-${file.filename}`}>
          {file.filename}
        </span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatBytes(file.size)}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleDownload}
        data-testid={`button-download-orphan-${file.filename}`}
      >
        <Download className="h-3 w-3 mr-1" />
        Download
      </Button>
    </div>
  );
}

export default function AdminFileRecovery() {
  const { data: missingData, isLoading: missingLoading } = useQuery<MissingFilesResponse>({
    queryKey: ["/api/admin/file-recovery/missing-files"],
  });

  const { data: orphanData, isLoading: orphanLoading } = useQuery<OrphanFilesResponse>({
    queryKey: ["/api/admin/file-recovery/orphan-files"],
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">File Recovery</h1>
        <p className="text-muted-foreground">
          Some applicant files were stored on local disk and are no longer accessible.
          Use this tool to re-upload replacement files or review orphan files from cloud storage backup.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Missing Files</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-missing-files">
              {missingLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (missingData?.totalMissingFiles ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Affected Applicants</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-affected-people">
              {missingLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (missingData?.totalAffectedPeople ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Orphan Files (Backup)</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-orphan-files">
              {orphanLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (orphanData?.totalOrphanFiles ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileWarning className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-semibold">Missing Files by Applicant</h2>
          </div>
          {missingLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-muted-foreground">Loading missing files...</span>
            </div>
          ) : !missingData?.people?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                No missing files found. All files are accessible.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {missingData.people.map((person) => (
                <PersonCard key={person.personId} person={person} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <FolderSearch className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-semibold">Orphan Files (Cloud Backup)</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            These files exist in cloud storage but are not linked to any database record.
            Download them to identify which applicant they belong to, then re-upload via the section above.
          </p>
          {orphanLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-muted-foreground">Loading orphan files...</span>
            </div>
          ) : !orphanData?.files?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No orphan files found.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4 space-y-2">
                {orphanData.files.map((file) => (
                  <OrphanFileRow key={file.filename} file={file} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
