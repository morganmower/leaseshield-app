import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Search, Building2, User, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, Filter, ChevronRight, Home, Briefcase, CalendarDays, PawPrint, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInDays } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";

interface FormData {
  monthlyIncome: string | null;
  employer: string | null;
  employerPhone: string | null;
  moveInDate: string | null;
  desiredMoveInDate: string | null;
  occupantCount: number | null;
  petCount: number | null;
  vehicleCount: number | null;
  pets: Array<{ type?: string; breed?: string; weight?: string; isServiceAnimal?: boolean }>;
  vehicles: Array<{ year?: string; make?: string; model?: string; color?: string; licensePlate?: string }>;
}

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
    formData: FormData | null;
    files: Array<{ fileType: string; availabilityStatus: string }>;
  } | null;
  coApplicants: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    isCompleted: boolean;
    formData: FormData | null;
  }>;
  guarantors: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    isCompleted: boolean;
    formData: FormData | null;
  }>;
  screening: {
    status: string;
    referenceNumber: string;
    createdAt: string;
    updatedAt: string | null;
    reportUrl: string | null;
  } | null;
  decision: {
    decision: string;
    decidedAt: string;
    notes: string | null;
    denialReasons: Array<{ category: string; detail: string | null }>;
  } | null;
  events: Array<{
    type: string;
    createdAt: string;
    metadata: any;
  }>;
}

interface AppStats {
  approvalRate: number;
  topDenialCategory: string | null;
  avgDays: number;
  totalDecided: number;
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

const denialCategoryLabels: Record<string, string> = {
  credit: "Credit History",
  criminal: "Criminal Record",
  eviction: "Prior Evictions",
  rental_history: "Rental History",
  income: "Insufficient Income",
  incomplete: "Incomplete Application",
  false_information: "False Information",
  other: "Other",
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

// Visual timeline step with icon
function TimelineStep({ icon: Icon, label, date, done }: { icon: any; label: string; date: string | null; done: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 pb-4">
        <p className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
        {date && <p className="text-xs text-muted-foreground">{format(new Date(date), "MMM d, yyyy h:mm a")}</p>}
        {!date && !done && <p className="text-xs text-muted-foreground">Pending</p>}
      </div>
    </div>
  );
}

type StatusFilter = "all" | "started" | "submitted" | "screening" | "complete";

export default function AdminApplicationsActivity() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedApplication, setSelectedApplication] = useState<ApplicationActivity | null>(null);

  const { data: applications, isLoading } = useQuery<ApplicationActivity[]>({
    queryKey: ["/api/admin/applications-activity"],
  });

  const { data: appStats } = useQuery<AppStats>({
    queryKey: ["/api/admin/applications-activity/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/applications-activity/stats");
      return res.json();
    },
  });

  const filteredApplications = applications?.filter((app) => {
    // Status filter
    if (statusFilter === "screening") {
      if (!["screening_requested", "in_progress"].includes(app.status)) return false;
    } else if (statusFilter !== "all") {
      if (app.status !== statusFilter) return false;
    }
    // Text search
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

  const filterButtons: { id: StatusFilter; label: string; count?: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "submitted", label: "Submitted", count: stats.submitted },
    { id: "screening", label: "In Screening", count: stats.screening },
    { id: "complete", label: "Complete", count: stats.complete },
  ];

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Applications Activity</h1>
        <p className="text-muted-foreground">
          Track all rental applications across all landlords - every stage from link sent to final decision
        </p>
      </div>

      {/* Funnel stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium">Awaiting Screening</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.screening}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.complete}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {appStats ? `${appStats.approvalRate}%` : "-"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {appStats?.totalDecided ? `of ${appStats.totalDecided} decided` : "No decisions yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Outcome insight cards */}
      {appStats && appStats.totalDecided > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top Denial Reason</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {appStats.topDenialCategory
                  ? denialCategoryLabels[appStats.topDenialCategory] || appStats.topDenialCategory
                  : "None recorded"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Days to Decision</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {appStats.avgDays > 0 ? `${appStats.avgDays} days` : "-"}
              </p>
              <p className="text-xs text-muted-foreground">From submission to final decision</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>All Applications</CardTitle>
                <CardDescription>
                  Click any row for a full timeline and applicant details
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
            {/* Status filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              {filterButtons.map(({ id, label, count }) => (
                <Button
                  key={id}
                  size="sm"
                  variant={statusFilter === id ? "default" : "outline"}
                  onClick={() => setStatusFilter(id)}
                  data-testid={`button-filter-${id}`}
                  className="gap-1"
                >
                  {label}
                  {count !== undefined && (
                    <Badge variant="secondary" className="ml-1 text-xs no-default-active-elevate">{count}</Badge>
                  )}
                </Button>
              ))}
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
                    <th className="text-left py-3 px-2 font-medium">Decision</th>
                    <th className="text-left py-3 px-2 font-medium">Created</th>
                    <th className="text-left py-3 px-2 font-medium"></th>
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
                          <span>{app.property?.name || "-"}</span>
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
                                .join(" ") || "-"}
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
                        {app.decision ? (
                          <Badge variant={app.decision.decision === "approved" ? "default" : "destructive"}>
                            {app.decision.decision}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                        {format(new Date(app.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="py-3 px-2">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              {searchTerm || statusFilter !== "all" ? "No applications match your filters" : "No applications found"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Full lifecycle view - from link sent to final decision
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">

                {/* Status + IDs */}
                <div className="flex items-center gap-4 flex-wrap">
                  {getStatusBadge(selectedApplication.status)}
                  {selectedApplication.decision && (
                    <Badge variant={selectedApplication.decision.decision === "approved" ? "default" : "destructive"}>
                      {selectedApplication.decision.decision === "approved" ? "Approved" : "Denied"}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground font-mono">{selectedApplication.id}</span>
                </div>

                <Separator />

                {/* Visual lifecycle timeline */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Lifecycle</h3>
                  <div className="space-y-0">
                    <TimelineStep
                      icon={FileText}
                      label="Application Link Created"
                      date={selectedApplication.createdAt}
                      done={true}
                    />
                    <TimelineStep
                      icon={User}
                      label="Applicant Submitted"
                      date={selectedApplication.submittedAt}
                      done={!!selectedApplication.submittedAt}
                    />
                    <TimelineStep
                      icon={Search}
                      label="Screening Requested"
                      date={selectedApplication.screening?.createdAt || null}
                      done={!!selectedApplication.screening}
                    />
                    <TimelineStep
                      icon={CheckCircle}
                      label="Screening Complete"
                      date={
                        selectedApplication.screening?.status === "complete"
                          ? (selectedApplication.screening.updatedAt ?? selectedApplication.screening.createdAt)
                          : null
                      }
                      done={selectedApplication.screening?.status === "complete"}
                    />
                    <TimelineStep
                      icon={selectedApplication.decision?.decision === "approved" ? CheckCircle : XCircle}
                      label={selectedApplication.decision ? `Decision: ${selectedApplication.decision.decision}` : "Decision"}
                      date={selectedApplication.decision?.decidedAt || null}
                      done={!!selectedApplication.decision}
                    />
                  </div>
                  {selectedApplication.submittedAt && selectedApplication.decision?.decidedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Total time: {differenceInDays(new Date(selectedApplication.decision.decidedAt), new Date(selectedApplication.submittedAt))} days from submission to decision
                    </p>
                  )}
                </div>

                <Separator />

                {/* Landlord */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Landlord</h3>
                  {selectedApplication.landlord ? (
                    <div className="bg-muted/50 rounded-md p-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="font-medium">{selectedApplication.landlord.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p>{selectedApplication.landlord.email}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No landlord data</p>
                  )}
                </div>

                <Separator />

                {/* Property */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Property</h3>
                  {selectedApplication.property ? (
                    <div className="bg-muted/50 rounded-md p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Property</p>
                          <p className="font-medium">{selectedApplication.property.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Unit</p>
                          <p>{selectedApplication.unit?.label || "-"}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Address</p>
                        <p>{[selectedApplication.property.address, selectedApplication.property.city, selectedApplication.property.state].filter(Boolean).join(", ") || "-"}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No property data</p>
                  )}
                </div>

                <Separator />

                {/* Primary Applicant */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Primary Applicant</h3>
                  {selectedApplication.applicant ? (
                    <div className="space-y-3">
                      <div className="bg-muted/50 rounded-md p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Name</p>
                            <p className="font-medium">{[selectedApplication.applicant.firstName, selectedApplication.applicant.lastName].filter(Boolean).join(" ") || "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            {selectedApplication.applicant.isCompleted ? (
                              <Badge variant="default">Completed</Badge>
                            ) : (
                              <Badge variant="secondary">In Progress</Badge>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p>{selectedApplication.applicant.email || "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p>{selectedApplication.applicant.phone || "-"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Form data */}
                      {selectedApplication.applicant.formData && (
                        <div className="bg-muted/30 rounded-md p-4 space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Application Details</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {selectedApplication.applicant.formData.monthlyIncome && (
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Monthly Income</p>
                                  <p className="font-medium">${Number(selectedApplication.applicant.formData.monthlyIncome).toLocaleString()}</p>
                                </div>
                              </div>
                            )}
                            {selectedApplication.applicant.formData.employer && (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Employer</p>
                                  <p className="font-medium">{selectedApplication.applicant.formData.employer}</p>
                                </div>
                              </div>
                            )}
                            {selectedApplication.applicant.formData.desiredMoveInDate && (
                              <div className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Move-In Date</p>
                                  <p className="font-medium">{selectedApplication.applicant.formData.desiredMoveInDate}</p>
                                </div>
                              </div>
                            )}
                            {(selectedApplication.applicant.formData.occupantCount ?? 0) > 0 && (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Additional Occupants</p>
                                  <p className="font-medium">{selectedApplication.applicant.formData.occupantCount}</p>
                                </div>
                              </div>
                            )}
                            {(selectedApplication.applicant.formData.petCount ?? 0) > 0 && (
                              <div className="flex items-center gap-2">
                                <PawPrint className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Pets</p>
                                  <p className="font-medium">
                                    {selectedApplication.applicant.formData.pets.map(p => [p.type, p.breed].filter(Boolean).join(" ")).join(", ") || selectedApplication.applicant.formData.petCount}
                                  </p>
                                </div>
                              </div>
                            )}
                            {(selectedApplication.applicant.formData.vehicleCount ?? 0) > 0 && (
                              <div className="flex items-center gap-2">
                                <Car className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Vehicles</p>
                                  <p className="font-medium">
                                    {selectedApplication.applicant.formData.vehicles.map(v => [v.year, v.make, v.model].filter(Boolean).join(" ")).join(", ") || selectedApplication.applicant.formData.vehicleCount}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Documents */}
                      {selectedApplication.applicant.files.length > 0 && (
                        <div className="bg-muted/30 rounded-md p-4 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documents</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedApplication.applicant.files.map((f, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs gap-1">
                                {f.availabilityStatus === "available" ? (
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 text-amber-500" />
                                )}
                                {f.fileType.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No applicant data</p>
                  )}
                </div>

                {/* Co-Applicants */}
                {selectedApplication.coApplicants.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Co-Applicants ({selectedApplication.coApplicants.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedApplication.coApplicants.map((co) => (
                          <div key={co.id} className="bg-muted/50 rounded-md p-3 flex justify-between items-center gap-4">
                            <div>
                              <p className="font-medium">{[co.firstName, co.lastName].filter(Boolean).join(" ") || "-"}</p>
                              <p className="text-sm text-muted-foreground">{co.email || "No email"}</p>
                            </div>
                            {co.isCompleted ? <Badge variant="default">Completed</Badge> : <Badge variant="secondary">Pending</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Guarantors */}
                {selectedApplication.guarantors.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Guarantors ({selectedApplication.guarantors.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedApplication.guarantors.map((g) => (
                          <div key={g.id} className="bg-muted/50 rounded-md p-3 flex justify-between items-center gap-4">
                            <div>
                              <p className="font-medium">{[g.firstName, g.lastName].filter(Boolean).join(" ") || "-"}</p>
                              <p className="text-sm text-muted-foreground">{g.email || "No email"}</p>
                            </div>
                            {g.isCompleted ? <Badge variant="default">Completed</Badge> : <Badge variant="secondary">Pending</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Screening */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Screening (Western Verify)</h3>
                  {selectedApplication.screening ? (
                    <div className="bg-muted/50 rounded-md p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Reference Number</p>
                          <p className="font-mono text-lg font-bold">{selectedApplication.screening.referenceNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          {getScreeningStatusBadge(selectedApplication.screening.status)}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Requested At</p>
                        <p>{format(new Date(selectedApplication.screening.createdAt), "MMM d, yyyy h:mm a")}</p>
                      </div>
                      {selectedApplication.screening.reportUrl && (
                        <a
                          href={selectedApplication.screening.reportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          View Report
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No screening requested yet</p>
                  )}
                </div>

                {/* Decision */}
                {selectedApplication.decision && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Decision</h3>
                      <div className="bg-muted/50 rounded-md p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Outcome</p>
                            <Badge variant={selectedApplication.decision.decision === "approved" ? "default" : "destructive"} className="mt-1">
                              {selectedApplication.decision.decision === "approved" ? "Approved" : "Denied"}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Decided At</p>
                            <p>{format(new Date(selectedApplication.decision.decidedAt), "MMM d, yyyy h:mm a")}</p>
                          </div>
                        </div>
                        {selectedApplication.decision.notes && (
                          <div>
                            <p className="text-xs text-muted-foreground">Notes</p>
                            <p className="text-sm">{selectedApplication.decision.notes}</p>
                          </div>
                        )}
                        {selectedApplication.decision.denialReasons.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Denial Reasons</p>
                            <div className="flex flex-wrap gap-2">
                              {selectedApplication.decision.denialReasons.map((r, idx) => (
                                <Badge key={idx} variant="destructive" className="text-xs">
                                  {denialCategoryLabels[r.category] || r.category}
                                  {r.detail ? `: ${r.detail}` : ""}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Event log */}
                {selectedApplication.events.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Event Log</h3>
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
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
