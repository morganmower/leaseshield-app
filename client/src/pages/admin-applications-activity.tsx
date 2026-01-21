import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Search, Building2, User, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ApplicationActivity {
  id: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  landlord: {
    id: string;
    email: string;
    name: string;
  } | null;
  property: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  unit: {
    id: string;
    label: string;
  } | null;
  applicant: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    isCompleted: boolean;
    completedAt: string | null;
  } | null;
  coApplicants: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    isCompleted: boolean;
  }>;
  guarantors: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    isCompleted: boolean;
  }>;
  screening: {
    status: string;
    referenceNumber: string;
    createdAt: string;
    reportUrl: string | null;
  } | null;
  decision: {
    decision: string;
    decidedAt: string;
    notes: string | null;
  } | null;
  events: Array<{
    type: string;
    createdAt: string;
    metadata: any;
  }>;
}

const statusLabels: Record<string, string> = {
  started: "Started",
  submitted: "Submitted",
  screening_requested: "Screening Requested",
  in_progress: "In Progress",
  complete: "Complete",
};

const screeningStatusLabels: Record<string, string> = {
  not_sent: "Not Sent",
  pending: "Pending",
  sent: "Sent",
  in_progress: "In Progress",
  complete: "Complete",
  error: "Error",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "complete":
      return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Complete</Badge>;
    case "screening_requested":
    case "in_progress":
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> {statusLabels[status] || status}</Badge>;
    case "submitted":
      return <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Submitted</Badge>;
    case "started":
      return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" /> Started</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getScreeningStatusBadge(status: string) {
  switch (status) {
    case "complete":
      return <Badge variant="default">{screeningStatusLabels[status] || status}</Badge>;
    case "in_progress":
    case "pending":
    case "sent":
      return <Badge variant="secondary">{screeningStatusLabels[status] || status}</Badge>;
    case "error":
      return <Badge variant="destructive">{screeningStatusLabels[status] || status}</Badge>;
    default:
      return <Badge variant="outline">{screeningStatusLabels[status] || status}</Badge>;
  }
}

export default function AdminApplicationsActivity() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<ApplicationActivity | null>(null);

  const { data: applications, isLoading } = useQuery<ApplicationActivity[]>({
    queryKey: ["/api/admin/applications-activity"],
  });

  const filteredApplications = applications?.filter((app) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      app.landlord?.name?.toLowerCase().includes(search) ||
      app.landlord?.email?.toLowerCase().includes(search) ||
      app.applicant?.firstName?.toLowerCase().includes(search) ||
      app.applicant?.lastName?.toLowerCase().includes(search) ||
      app.applicant?.email?.toLowerCase().includes(search) ||
      app.property?.name?.toLowerCase().includes(search) ||
      app.screening?.referenceNumber?.toLowerCase().includes(search)
    );
  });

  const stats = {
    total: applications?.length || 0,
    submitted: applications?.filter((a) => a.status === "submitted").length || 0,
    screening: applications?.filter((a) => ["screening_requested", "in_progress"].includes(a.status)).length || 0,
    complete: applications?.filter((a) => a.status === "complete").length || 0,
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Applications Activity</h1>
        <p className="text-muted-foreground">
          View all rental applications across all landlords with applicant and screening details
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Awaiting Screening</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.screening}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Complete</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.complete}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>All Applications</CardTitle>
              <CardDescription>
                Click on an application to see full details including screening reference numbers
              </CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, property..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-applications"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading applications...</p>
          ) : filteredApplications && filteredApplications.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-applications">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Landlord</th>
                    <th className="text-left py-3 px-2 font-medium">Property</th>
                    <th className="text-left py-3 px-2 font-medium">Applicant</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-left py-3 px-2 font-medium">Screening</th>
                    <th className="text-left py-3 px-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app) => (
                    <tr
                      key={app.id}
                      className="border-b hover-elevate cursor-pointer"
                      onClick={() => setSelectedApplication(app)}
                      data-testid={`row-application-${app.id}`}
                    >
                      <td className="py-3 px-2">
                        <div className="flex flex-col">
                          <span className="font-medium">{app.landlord?.name || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">{app.landlord?.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex flex-col">
                          <span>{app.property?.name || "—"}</span>
                          <span className="text-xs text-muted-foreground">
                            {app.unit?.label}
                            {app.property?.city && `, ${app.property.city}`}
                            {app.property?.state && `, ${app.property.state}`}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {app.applicant ? (
                          <div className="flex flex-col">
                            <span>
                              {[app.applicant.firstName, app.applicant.lastName]
                                .filter(Boolean)
                                .join(" ") || "—"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {app.applicant.email || app.applicant.phone || "No contact"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No applicant</span>
                        )}
                      </td>
                      <td className="py-3 px-2">{getStatusBadge(app.status)}</td>
                      <td className="py-3 px-2">
                        {app.screening ? (
                          <div className="flex flex-col gap-1">
                            {getScreeningStatusBadge(app.screening.status)}
                            <span className="text-xs text-muted-foreground font-mono">
                              {app.screening.referenceNumber}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                        {format(new Date(app.createdAt), "MMM d, yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No applications match your search" : "No applications found"}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Full details for troubleshooting and matching with Western Verify
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Application ID</h4>
                    <p className="font-mono text-sm">{selectedApplication.id}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
                    {getStatusBadge(selectedApplication.status)}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <Users className="h-5 w-5" /> Landlord
                  </h3>
                  {selectedApplication.landlord ? (
                    <div className="bg-muted/50 rounded-md p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Name</h4>
                          <p>{selectedApplication.landlord.name}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Email</h4>
                          <p>{selectedApplication.landlord.email}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No landlord data</p>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <Building2 className="h-5 w-5" /> Property
                  </h3>
                  {selectedApplication.property ? (
                    <div className="bg-muted/50 rounded-md p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Property Name</h4>
                          <p>{selectedApplication.property.name}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Unit</h4>
                          <p>{selectedApplication.unit?.label || "—"}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Address</h4>
                        <p>
                          {[
                            selectedApplication.property.address,
                            selectedApplication.property.city,
                            selectedApplication.property.state,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No property data</p>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <User className="h-5 w-5" /> Primary Applicant
                  </h3>
                  {selectedApplication.applicant ? (
                    <div className="bg-muted/50 rounded-md p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Name</h4>
                          <p>
                            {[
                              selectedApplication.applicant.firstName,
                              selectedApplication.applicant.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ") || "—"}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                          <p>
                            {selectedApplication.applicant.isCompleted ? (
                              <Badge variant="default">Completed</Badge>
                            ) : (
                              <Badge variant="secondary">In Progress</Badge>
                            )}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Email</h4>
                          <p>{selectedApplication.applicant.email || "—"}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Phone</h4>
                          <p>{selectedApplication.applicant.phone || "—"}</p>
                        </div>
                      </div>
                      {selectedApplication.applicant.completedAt && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Completed At</h4>
                          <p>{format(new Date(selectedApplication.applicant.completedAt), "MMM d, yyyy h:mm a")}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No applicant data</p>
                  )}
                </div>

                {selectedApplication.coApplicants.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Co-Applicants ({selectedApplication.coApplicants.length})</h3>
                      <div className="space-y-2">
                        {selectedApplication.coApplicants.map((co) => (
                          <div key={co.id} className="bg-muted/50 rounded-md p-3 flex justify-between items-center">
                            <div>
                              <p className="font-medium">
                                {[co.firstName, co.lastName].filter(Boolean).join(" ") || "—"}
                              </p>
                              <p className="text-sm text-muted-foreground">{co.email || "No email"}</p>
                            </div>
                            {co.isCompleted ? (
                              <Badge variant="default">Completed</Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedApplication.guarantors.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Guarantors ({selectedApplication.guarantors.length})</h3>
                      <div className="space-y-2">
                        {selectedApplication.guarantors.map((g) => (
                          <div key={g.id} className="bg-muted/50 rounded-md p-3 flex justify-between items-center">
                            <div>
                              <p className="font-medium">
                                {[g.firstName, g.lastName].filter(Boolean).join(" ") || "—"}
                              </p>
                              <p className="text-sm text-muted-foreground">{g.email || "No email"}</p>
                            </div>
                            {g.isCompleted ? (
                              <Badge variant="default">Completed</Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <Search className="h-5 w-5" /> Screening (Western Verify)
                  </h3>
                  {selectedApplication.screening ? (
                    <div className="bg-muted/50 rounded-md p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Reference Number</h4>
                          <p className="font-mono text-lg font-bold">{selectedApplication.screening.referenceNumber}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                          {getScreeningStatusBadge(selectedApplication.screening.status)}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Requested At</h4>
                        <p>{format(new Date(selectedApplication.screening.createdAt), "MMM d, yyyy h:mm a")}</p>
                      </div>
                      {selectedApplication.screening.reportUrl && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">Report URL</h4>
                          <a
                            href={selectedApplication.screening.reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            View Report
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No screening requested yet</p>
                  )}
                </div>

                {selectedApplication.decision && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Decision</h3>
                      <div className="bg-muted/50 rounded-md p-4 space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground">Decision</h4>
                            <Badge variant={selectedApplication.decision.decision === "approved" ? "default" : "destructive"}>
                              {selectedApplication.decision.decision}
                            </Badge>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground">Decided At</h4>
                            <p>{format(new Date(selectedApplication.decision.decidedAt), "MMM d, yyyy h:mm a")}</p>
                          </div>
                        </div>
                        {selectedApplication.decision.notes && (
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
                            <p>{selectedApplication.decision.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {selectedApplication.events.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                        <Clock className="h-5 w-5" /> Event Timeline
                      </h3>
                      <div className="space-y-2">
                        {selectedApplication.events.map((event, idx) => (
                          <div key={idx} className="flex items-start gap-3 text-sm">
                            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">{event.type.replace(/_/g, " ")}</p>
                              <p className="text-muted-foreground">
                                {format(new Date(event.createdAt), "MMM d, yyyy h:mm a")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground pt-4">
                  <div>
                    <span className="font-medium">Created:</span>{" "}
                    {format(new Date(selectedApplication.createdAt), "MMM d, yyyy h:mm a")}
                  </div>
                  {selectedApplication.submittedAt && (
                    <div>
                      <span className="font-medium">Submitted:</span>{" "}
                      {format(new Date(selectedApplication.submittedAt), "MMM d, yyyy h:mm a")}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
