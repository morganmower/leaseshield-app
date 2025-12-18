import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  ArrowLeft,
  MapPin,
  FileText,
  DollarSign,
  Upload,
  Plus,
  Download,
  Calendar,
  ExternalLink,
} from "lucide-react";
import type { Property, RentLedgerEntry, SavedDocument, UploadedDocument } from "@shared/schema";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: property, isLoading: isLoadingProperty } = useQuery<Property>({
    queryKey: ["/api/properties", id],
    queryFn: async () => {
      const token = getAccessToken();
      const res = await fetch(`/api/properties/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load property");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: allLedgerEntries = [], isLoading: isLoadingLedger } = useQuery<RentLedgerEntry[]>({
    queryKey: ["/api/rent-ledger"],
  });

  const { data: allSavedDocs = [], isLoading: isLoadingSaved } = useQuery<SavedDocument[]>({
    queryKey: ["/api/saved-documents"],
  });

  const { data: allUploadedDocs = [], isLoading: isLoadingUploaded } = useQuery<UploadedDocument[]>({
    queryKey: ["/api/uploaded-documents"],
  });

  const ledgerEntries = allLedgerEntries.filter((e) => e.propertyId === id);
  const savedDocuments = allSavedDocs.filter((d) => d.propertyId === id);
  const uploadedDocuments = allUploadedDocs.filter((d) => d.propertyId === id);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const calculateBalance = () => {
    return ledgerEntries.reduce((acc, entry) => {
      const charge = entry.amountExpected || 0;
      const payment = entry.amountReceived || 0;
      return acc + charge - payment;
    }, 0);
  };

  if (isLoadingProperty) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Property Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The property you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/properties">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Properties
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const balance = calculateBalance();
  const totalDocuments = savedDocuments.length + uploadedDocuments.length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Link href="/properties">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-properties">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Properties
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-property-name">
              <Building2 className="h-6 w-6" />
              {property.name}
            </h1>
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" />
              {property.address}
              {property.city && property.state && `, ${property.city}, ${property.state}`}
              {property.zipCode && ` ${property.zipCode}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/rent-ledger">
              <Button variant="outline" size="sm" data-testid="button-add-ledger-entry">
                <Plus className="h-4 w-4 mr-2" />
                Add Ledger Entry
              </Button>
            </Link>
            <Link href="/my-documents">
              <Button variant="outline" size="sm" data-testid="button-upload-document">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Balance</CardDescription>
            <CardTitle className={`text-2xl ${balance > 0 ? "text-red-600" : balance < 0 ? "text-green-600" : ""}`}>
              {formatCurrency(Math.abs(balance))}
              {balance > 0 && <span className="text-sm font-normal ml-1">owed</span>}
              {balance < 0 && <span className="text-sm font-normal ml-1">credit</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {ledgerEntries.length} ledger {ledgerEntries.length === 1 ? "entry" : "entries"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Documents</CardDescription>
            <CardTitle className="text-2xl">{totalDocuments}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {savedDocuments.length} generated, {uploadedDocuments.length} uploaded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Property Type</CardDescription>
            <CardTitle className="text-2xl">{property.propertyType || "Not specified"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {property.units && property.units > 1 ? `${property.units} units` : "Single unit"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="ledger" data-testid="tab-ledger">
            Rent Ledger
            {ledgerEntries.length > 0 && (
              <Badge variant="secondary" className="ml-2">{ledgerEntries.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            Documents
            {totalDocuments > 0 && (
              <Badge variant="secondary" className="ml-2">{totalDocuments}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Property Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Name:</span>
                  <span>{property.name}</span>
                  <span className="text-muted-foreground">Address:</span>
                  <span>{property.address}</span>
                  {property.city && (
                    <>
                      <span className="text-muted-foreground">City:</span>
                      <span>{property.city}</span>
                    </>
                  )}
                  {property.state && (
                    <>
                      <span className="text-muted-foreground">State:</span>
                      <span>{property.state}</span>
                    </>
                  )}
                  {property.zipCode && (
                    <>
                      <span className="text-muted-foreground">ZIP Code:</span>
                      <span>{property.zipCode}</span>
                    </>
                  )}
                  {property.propertyType && (
                    <>
                      <span className="text-muted-foreground">Type:</span>
                      <span>{property.propertyType}</span>
                    </>
                  )}
                  {property.units && (
                    <>
                      <span className="text-muted-foreground">Units:</span>
                      <span>{property.units}</span>
                    </>
                  )}
                </div>
                {property.notes && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground">{property.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingLedger ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : ledgerEntries.length === 0 ? (
                  <div className="text-center py-6">
                    <DollarSign className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No transactions yet</p>
                    <Link href="/rent-ledger">
                      <Button variant="outline" size="sm" className="mt-2">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Entry
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ledgerEntries.slice(0, 5).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{entry.description || entry.category || "Rent"}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(entry.effectiveDate)}</p>
                        </div>
                        <div className="text-right">
                          {entry.type === "charge" ? (
                            <p className="text-sm text-red-600">+{formatCurrency(entry.amountExpected)}</p>
                          ) : (
                            <p className="text-sm text-green-600">-{formatCurrency(entry.amountReceived || 0)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {ledgerEntries.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setActiveTab("ledger")}
                      >
                        View all {ledgerEntries.length} entries
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rent Ledger Tab */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Rent Ledger</CardTitle>
                <CardDescription>All charges and payments for this property</CardDescription>
              </div>
              <Link href="/rent-ledger">
                <Button size="sm" data-testid="button-go-to-ledger">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Full Ledger
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoadingLedger ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Ledger Entries</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start tracking rent and payments for this property
                  </p>
                  <Link href="/rent-ledger">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Entry
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Charge</TableHead>
                        <TableHead className="text-right">Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerEntries.map((entry) => (
                        <TableRow key={entry.id} data-testid={`row-ledger-${entry.id}`}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(entry.effectiveDate)}
                          </TableCell>
                          <TableCell>{entry.tenantName}</TableCell>
                          <TableCell>{entry.description || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.category || "Rent"}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {entry.amountExpected > 0 ? formatCurrency(entry.amountExpected) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {(entry.amountReceived || 0) > 0 ? formatCurrency(entry.amountReceived || 0) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell colSpan={4}>Balance</TableCell>
                        <TableCell colSpan={2} className={`text-right ${balance > 0 ? "text-red-600" : balance < 0 ? "text-green-600" : ""}`}>
                          {formatCurrency(Math.abs(balance))} {balance > 0 ? "owed" : balance < 0 ? "credit" : ""}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Saved/Generated Documents */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Generated Documents
                  </CardTitle>
                  <CardDescription>Documents created from templates</CardDescription>
                </div>
                <Link href="/templates">
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Create
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {isLoadingSaved ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : savedDocuments.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No generated documents</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                        data-testid={`row-saved-doc-${doc.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.documentName}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                          </div>
                        </div>
                        <Link href={`/my-documents`}>
                          <Button size="sm" variant="ghost">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Uploaded Documents */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Uploaded Documents
                  </CardTitle>
                  <CardDescription>Your uploaded files</CardDescription>
                </div>
                <Link href="/my-documents">
                  <Button size="sm" variant="outline">
                    <Upload className="h-4 w-4 mr-1" />
                    Upload
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {isLoadingUploaded ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : uploadedDocuments.length === 0 ? (
                  <div className="text-center py-8">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No uploaded documents</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {uploadedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                        data-testid={`row-uploaded-doc-${doc.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.fileName}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(doc.fileUrl, "_blank")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
