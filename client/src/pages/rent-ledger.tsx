import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Trash2, DollarSign, Edit2, Building2, CreditCard, Send, Copy, Link as LinkIcon, AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { useState, useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RentLedgerEntry, RentalProperty, RentPaymentRequest } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecurringPaymentsPanel } from "@/components/recurring-payments-panel";
import { SEO } from "@/components/seo";

export default function RentLedger() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "online";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab && ["online", "track", "recurring", "export"].includes(tab) ? tab : "online";
  });
  const [tenantName, setTenantName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<"charge" | "payment">("charge");
  const [category, setCategory] = useState("Rent");
  const [description, setDescription] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [editingEntry, setEditingEntry] = useState<RentLedgerEntry | null>(null);
  const [editTenantName, setEditTenantName] = useState("");
  const [editEffectiveDate, setEditEffectiveDate] = useState("");
  const [editType, setEditType] = useState<"charge" | "payment">("charge");
  const [editCategory, setEditCategory] = useState("Rent");
  const [editDescription, setEditDescription] = useState("");
  const [editChargeAmount, setEditChargeAmount] = useState("");
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editReferenceNumber, setEditReferenceNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [editPropertyId, setEditPropertyId] = useState<string>("");
  const [filterPropertyId, setFilterPropertyId] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterDay, setFilterDay] = useState<string>("");

  const { data: entries, isLoading } = useQuery<RentLedgerEntry[]>({
    queryKey: ["/api/rent-ledger"],
  });

  // Single source of truth for filtering - used by both Summary and Ledger
  // History so they always agree. Date filter uses effectiveDate (falls back
  // to createdAt). filterDay is a YYYY-MM-DD string from <input type="date">.
  const matchesFilters = (entry: RentLedgerEntry) => {
    if (filterPropertyId === "unassigned" && entry.propertyId) return false;
    if (filterPropertyId !== "all" && filterPropertyId !== "unassigned" && entry.propertyId !== filterPropertyId) return false;
    // Use UTC to keep "calendar day" filtering stable regardless of the
    // viewer's timezone - the date input <input type="date"> returns a
    // YYYY-MM-DD string with no tz, so comparing against UTC components
    // gives consistent results for everyone.
    const d = new Date(entry.effectiveDate || entry.createdAt);
    if (filterYear !== "all" && String(d.getUTCFullYear()) !== filterYear) return false;
    if (filterMonth !== "all" && String(d.getUTCMonth() + 1).padStart(2, "0") !== filterMonth) return false;
    if (filterDay) {
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      if (iso !== filterDay) return false;
    }
    return true;
  };

  // Years present in the dataset (for the year dropdown). Always include the
  // current year so the user can filter to "this year" even with zero entries.
  const availableYears = (() => {
    const set = new Set<number>();
    set.add(new Date().getUTCFullYear());
    (entries || []).forEach((e) => {
      const d = new Date(e.effectiveDate || e.createdAt);
      if (!isNaN(d.getTime())) set.add(d.getUTCFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  })();

  const monthOptions = [
    { value: "01", label: "January" }, { value: "02", label: "February" },
    { value: "03", label: "March" },   { value: "04", label: "April" },
    { value: "05", label: "May" },     { value: "06", label: "June" },
    { value: "07", label: "July" },    { value: "08", label: "August" },
    { value: "09", label: "September" },{ value: "10", label: "October" },
    { value: "11", label: "November" },{ value: "12", label: "December" },
  ];

  const hasActiveDateFilter = filterYear !== "all" || filterMonth !== "all" || !!filterDay;
  const clearDateFilters = () => { setFilterYear("all"); setFilterMonth("all"); setFilterDay(""); };

  const { data: properties = [] } = useQuery<RentalProperty[]>({
    queryKey: ["/api/rental/properties"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest("POST", "/api/rent-ledger", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-ledger"] });
      setTenantName("");
      setEffectiveDate(new Date().toISOString().split('T')[0]);
      setType("charge");
      setCategory("Rent");
      setDescription("");
      setChargeAmount("");
      setPaymentAmount("");
      setPaymentMethod("");
      setReferenceNumber("");
      setNotes("");
      setPropertyId("");
      toast({ description: "Rent entry added successfully!" });
    },
    onError: (error: any) => {
      console.error("Rent ledger create error:", error);
      // Extract the detailed message from the API response
      const errorMessage = error?.body?.message || error?.message || 'Unknown error';
      toast({ description: `Failed to add entry: ${errorMessage}`, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/rent-ledger/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-ledger"] });
      toast({ description: "Entry deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest("PUT", `/api/rent-ledger/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-ledger"] });
      setEditingEntry(null);
      toast({ description: "Entry updated successfully!" });
    },
    onError: () => toast({ description: "Failed to update entry", variant: "destructive" }),
  });

  const handleEditClick = (entry: RentLedgerEntry) => {
    setEditingEntry(entry);
    setEditTenantName(entry.tenantName);
    setEditEffectiveDate(entry.effectiveDate ? new Date(entry.effectiveDate).toISOString().split('T')[0] : "");
    setEditType((entry.type as "charge" | "payment") || "charge");
    setEditCategory(entry.category || "Rent");
    setEditDescription(entry.description || "");
    setEditChargeAmount((entry.amountExpected / 100).toFixed(2));
    setEditPaymentAmount(((entry.amountReceived ?? 0) / 100).toFixed(2));
    setEditPaymentMethod(entry.paymentMethod || "");
    setEditReferenceNumber(entry.referenceNumber || "");
    setEditNotes(entry.notes || "");
    setEditPropertyId(entry.propertyId || "");
  };

  const handleUpdateEntry = () => {
    if (!editTenantName || !editingEntry) {
      toast({ description: "Please enter tenant name", variant: "destructive" });
      return;
    }
    const chargeAmt = Math.round(parseFloat(editChargeAmount || "0") * 100);
    const paymentAmt = Math.round(parseFloat(editPaymentAmount || "0") * 100);
    const entryType = chargeAmt > 0 ? "charge" : "payment";

    updateMutation.mutate({
      id: editingEntry.id,
      userId: editingEntry.userId,
      propertyId: editPropertyId || null,
      tenantName: editTenantName,
      effectiveDate: editEffectiveDate || new Date().toISOString().split('T')[0],
      type: entryType,
      category: editCategory,
      description: editDescription,
      amountExpected: chargeAmt,
      amountReceived: paymentAmt,
      paymentMethod: editPaymentMethod,
      referenceNumber: editReferenceNumber,
      notes: editNotes,
    });
  };

  const downloadExcelTemplate = () => {
    if (!entries || entries.length === 0) {
      toast({ description: "No entries to export. Add entries to the ledger first.", variant: "destructive" });
      return;
    }

    const sortedEntries = [...entries].sort((a, b) => {
      const dateA = a.effectiveDate ? new Date(a.effectiveDate).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.effectiveDate ? new Date(b.effectiveDate).getTime() : new Date(b.createdAt).getTime();
      return dateA - dateB;
    });

    let totalCharges = 0;
    let totalPayments = 0;
    let runningBalance = 0;

    const csvRows = [
      "RENT LEDGER REPORT",
      `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      `Tenant: ${sortedEntries[0]?.tenantName || ""}`,
      "",
      "Date,Effective Date,Type,Category,Description,Charge Amount,Payment Amount,Running Balance,Payment Method,Ref #,Notes",
    ];

    sortedEntries.forEach((entry) => {
      const charge = entry.amountExpected / 100;
      const payment = (entry.amountReceived ?? 0) / 100;
      runningBalance += charge - payment;
      totalCharges += charge;
      totalPayments += payment;

      const dateStr = new Date(entry.createdAt).toLocaleDateString();
      const effectiveDateStr = entry.effectiveDate ? new Date(entry.effectiveDate).toLocaleDateString() : "";
      const entryType = entry.type === "payment" ? "Payment" : "Charge";
      const chargeDisplay = charge > 0 ? charge.toFixed(2) : "0.00";
      const paymentDisplay = payment > 0 ? payment.toFixed(2) : "0.00";

      csvRows.push(
        `"${dateStr}","${effectiveDateStr}","${entryType}","${entry.category || ""}","${entry.description || ""}","$${chargeDisplay}","$${paymentDisplay}","$${runningBalance.toFixed(2)}","${entry.paymentMethod || ""}","${entry.referenceNumber || ""}","${(entry.notes || "").replace(/"/g, '""')}"`
      );
    });

    const totalBalance = totalCharges - totalPayments;
    csvRows.push("");
    csvRows.push("SUMMARY");
    csvRows.push(`Total Charges,$${totalCharges.toFixed(2)}`);
    csvRows.push(`Total Payments,$${totalPayments.toFixed(2)}`);
    csvRows.push(`Outstanding Balance,$${totalBalance.toFixed(2)}`);
    csvRows.push(`Status,${totalBalance === 0 ? "Paid / Current" : "Outstanding"}`);

    const csv = csvRows.join("\n");
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
    element.setAttribute("download", `rent-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast({ description: "Professional rent ledger exported!" });
  };

  const handleAddEntry = () => {
    if (!tenantName) {
      toast({ description: "Please enter tenant name", variant: "destructive" });
      return;
    }

    const chargeAmt = Math.round(parseFloat(chargeAmount || "0") * 100);
    const paymentAmt = Math.round(parseFloat(paymentAmount || "0") * 100);

    // Determine type based on which amount is entered
    const entryType = chargeAmt > 0 ? "charge" : "payment";

    createMutation.mutate({
      userId: user?.id,
      propertyId: propertyId || null,
      tenantName,
      effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
      type: entryType,
      category,
      description,
      amountExpected: chargeAmt,
      amountReceived: paymentAmt,
      paymentMethod,
      referenceNumber,
      notes,
    });
  };

  return (
    <div className="flex-1 overflow-auto">
      <SEO
        title="Rent Payments - ACH collection, recurring auto-pay, and ledger"
        description="Send rent payment requests, set up recurring ACH auto-pay, and keep an audit-ready ledger. Tenants pay rent online by bank transfer."
        canonical="/rent-ledger"
      />

      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md">
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-semibold text-foreground mb-1" data-testid="text-page-title">
                  Rent Payments
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Send payment requests, track recurring auto-pay, and export records for tax time.
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
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-entries-count">
                  {entries?.length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Ledger entries</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="online" data-testid="tab-online-payments">Requests</TabsTrigger>
          <TabsTrigger value="track" data-testid="tab-track-entries">History</TabsTrigger>
          <TabsTrigger value="recurring" data-testid="tab-recurring">Recurring</TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export-report">Export</TabsTrigger>
        </TabsList>

        {/* Online Payments (Stripe Connect ACH) */}
        <TabsContent value="online">
          <OnlinePaymentsPanel properties={properties} />
        </TabsContent>

        {/* Recurring auto-pay (Plan B) */}
        <TabsContent value="recurring">
          <RecurringPaymentsPanel properties={properties} />
        </TabsContent>

        {/* Export Report */}
        <TabsContent value="export">
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Export Professional Report</h2>
              <p className="text-muted-foreground mb-6">Download your complete rent ledger with all entries, running balances, and totals</p>
              <Button
                onClick={downloadExcelTemplate}
                className="gap-2"
                data-testid="button-download-excel"
              >
                <Download className="h-4 w-4" />
                Export Rent Ledger (CSV/Excel)
              </Button>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
              <p className="font-semibold">Report includes:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Transaction date and effective date for each entry</li>
                <li>Transaction type (charge or payment) and category</li>
                <li>Payment method and reference number for documentation</li>
                <li>Running balance calculation</li>
                <li>Professional summary with totals</li>
              </ul>
            </div>
          </Card>
        </TabsContent>

        {/* Track Entries */}
        <TabsContent value="track">
          <div className="space-y-6">
            {/* Add Entry Form */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">Add Ledger Entry</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="tenant-name">Tenant Name *</Label>
                  <Input
                    id="tenant-name"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="John Doe"
                    data-testid="input-tenant-name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="effective-date">Effective Date</Label>
                  <Input
                    id="effective-date"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    data-testid="input-effective-date"
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rent">Rent</SelectItem>
                      <SelectItem value="Late Fee">Late Fee</SelectItem>
                      <SelectItem value="Utility">Utility</SelectItem>
                      <SelectItem value="Deposit">Deposit</SelectItem>
                      <SelectItem value="Pet Fee">Pet Fee</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {properties.length > 0 && (
                  <div>
                    <Label htmlFor="property">Property (Optional)</Label>
                    <Select value={propertyId || "none"} onValueChange={(v) => setPropertyId(v === "none" ? "" : v)}>
                      <SelectTrigger id="property" data-testid="select-property">
                        <SelectValue placeholder="No property selected" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No property</SelectItem>
                        {properties.map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            {property.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., December Rent, Late Fee - 5 days late"
                    data-testid="input-description"
                  />
                </div>

                <div>
                  <Label htmlFor="charge-amount">Charge Amount</Label>
                  <Input
                    id="charge-amount"
                    type="number"
                    step="0.01"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-charge-amount"
                  />
                </div>

                <div>
                  <Label htmlFor="payment-amount">Payment Amount</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-payment-amount"
                  />
                </div>

                <div>
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment-method" data-testid="select-payment-method">
                      <SelectValue placeholder="Select method..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Check">Check</SelectItem>
                      <SelectItem value="Zelle">Zelle</SelectItem>
                      <SelectItem value="Venmo">Venmo</SelectItem>
                      <SelectItem value="ACH">ACH</SelectItem>
                      <SelectItem value="Certified Funds">Certified Funds</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="reference-number">Reference # (Check #, Transaction ID)</Label>
                  <Input
                    id="reference-number"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g., CHK-1234 or TXN #9134"
                    data-testid="input-reference-number"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Paid in full, NSF - bank returned payment"
                    data-testid="input-notes"
                  />
                </div>
              </div>

              <Button
                onClick={handleAddEntry}
                className="gap-2"
                disabled={createMutation.isPending}
                data-testid="button-add-entry"
              >
                <Plus className="h-4 w-4" />
                Add Entry
              </Button>
            </Card>

            {/* Summary Section */}
            {entries && entries.length > 0 && (
              <Card className="p-6 bg-muted/30 border-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Summary</h2>
                  {filterPropertyId !== "all" && (
                    <span className="text-sm text-muted-foreground">
                      Filtered: {filterPropertyId === "unassigned" 
                        ? "Unassigned entries" 
                        : properties.find(p => p.id === filterPropertyId)?.name || ""}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(() => {
                    // Filter entries for summary calculation (property + date filters combined)
                    const filteredEntries = entries.filter(matchesFilters);
                    
                    let totalCharges = 0;
                    let totalPayments = 0;
                    filteredEntries.forEach((entry) => {
                      totalCharges += entry.amountExpected / 100;
                      totalPayments += (entry.amountReceived ?? 0) / 100;
                    });
                    const outstandingBalance = totalCharges - totalPayments;
                    const status = outstandingBalance === 0 ? "Paid / Current" : "Outstanding";
                    
                    return (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Total Charges</p>
                          <p className="text-2xl font-bold">${totalCharges.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Total Payments</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalPayments.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Outstanding Balance</p>
                          <p className="text-2xl font-bold">${outstandingBalance.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Status</p>
                          <p className={`text-2xl font-bold ${outstandingBalance === 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {status}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </Card>
            )}

            {/* Ledger Table */}
            <Card className="p-6">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">Ledger History</h2>
                  {properties.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <Select value={filterPropertyId} onValueChange={setFilterPropertyId}>
                        <SelectTrigger className="w-[200px]" data-testid="select-filter-property">
                          <SelectValue placeholder="Filter by property" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Properties</SelectItem>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
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
                {/* Time-travel filters: drill down by year, month, or specific day */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                  <span className="text-xs font-medium text-muted-foreground pr-1">Look back:</span>
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="w-[120px]" data-testid="select-filter-year">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {availableYears.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterMonth} onValueChange={setFilterMonth}>
                    <SelectTrigger className="w-[140px]" data-testid="select-filter-month">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All months</SelectItem>
                      {monthOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={filterDay}
                    onChange={(e) => setFilterDay(e.target.value)}
                    className="w-[160px]"
                    data-testid="input-filter-day"
                    aria-label="Filter by exact day"
                  />
                  {hasActiveDateFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearDateFilters}
                      data-testid="button-clear-date-filters"
                    >
                      Clear dates
                    </Button>
                  )}
                </div>
              </div>
              {isLoading ? (
                <p className="text-muted-foreground">Loading entries...</p>
              ) : entries && entries.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Effective Date</TableHead>
                        {properties.length > 0 && <TableHead className="text-xs">Property</TableHead>}
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs text-right">Charge Amt</TableHead>
                        <TableHead className="text-xs text-right">Payment Amt</TableHead>
                        <TableHead className="text-xs text-right">Balance</TableHead>
                        <TableHead className="text-xs">Method</TableHead>
                        <TableHead className="text-xs">Ref #</TableHead>
                        <TableHead className="text-xs w-16">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // Filter entries by property + date filters (shared helper)
                        const filteredEntries = entries.filter(matchesFilters);
                        
                        // Sort chronologically (oldest first) to calculate correct running balances
                        const chronologicalEntries = [...filteredEntries].sort((a, b) => {
                          const dateA = a.effectiveDate ? new Date(a.effectiveDate).getTime() : new Date(a.createdAt).getTime();
                          const dateB = b.effectiveDate ? new Date(b.effectiveDate).getTime() : new Date(b.createdAt).getTime();
                          return dateA - dateB;
                        });
                        
                        // Calculate running balance for each entry
                        let runningBalance = 0;
                        const entriesWithBalance = chronologicalEntries.map((entry) => {
                          const expected = entry.amountExpected / 100;
                          const received = (entry.amountReceived ?? 0) / 100;
                          runningBalance += expected - received;
                          return { ...entry, calculatedBalance: runningBalance };
                        });
                        
                        // Now sort for display (newest first)
                        const sortedEntries = entriesWithBalance.reverse();
                        
                        if (sortedEntries.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={properties.length > 0 ? 10 : 9} className="text-center text-muted-foreground py-8">
                                No entries for this property filter
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        return sortedEntries.map((entry) => {
                          const expected = entry.amountExpected / 100;
                          const received = (entry.amountReceived ?? 0) / 100;
                          return (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs">{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell className="text-xs">{entry.effectiveDate ? new Date(entry.effectiveDate).toLocaleDateString() : "-"}</TableCell>
                              {properties.length > 0 && (
                                <TableCell className="text-xs">
                                  {entry.propertyId 
                                    ? properties.find(p => p.id === entry.propertyId)?.name || "-"
                                    : <span className="text-muted-foreground">-</span>
                                  }
                                </TableCell>
                              )}
                              <TableCell className="text-xs">{entry.category}</TableCell>
                              <TableCell className="text-right font-mono text-xs">${expected > 0 ? expected.toFixed(2) : "0.00"}</TableCell>
                              <TableCell className="text-right font-mono text-green-600 dark:text-green-400 text-xs">${received > 0 ? received.toFixed(2) : "0.00"}</TableCell>
                              <TableCell className="text-right font-mono font-semibold text-xs">${entry.calculatedBalance.toFixed(2)}</TableCell>
                              <TableCell className="text-xs">{entry.paymentMethod || "-"}</TableCell>
                              <TableCell className="text-xs">{entry.referenceNumber || "-"}</TableCell>
                              <TableCell className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEditClick(entry)}
                                  data-testid={`button-edit-${entry.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteMutation.mutate(entry.id)}
                                  data-testid={`button-delete-${entry.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-12 px-4 text-center"
                  data-testid="empty-state-rent-ledger"
                >
                  <div className="rounded-full bg-primary/10 p-4 mb-4">
                    <DollarSign className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Track your first rent payment</h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-4">
                    A clean ledger is your best evidence in court. Log charges and payments here so you always have proof of what was owed and what was paid.
                  </p>
                  <Button
                    onClick={() => setActiveTab("track")}
                    data-testid="button-empty-add-entry"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first entry
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Rent Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-tenant">Tenant Name</Label>
                <Input
                  id="edit-tenant"
                  value={editTenantName}
                  onChange={(e) => setEditTenantName(e.target.value)}
                  data-testid="input-edit-tenant"
                />
              </div>
              <div>
                <Label htmlFor="edit-effective-date">Effective Date</Label>
                <Input
                  id="edit-effective-date"
                  type="date"
                  value={editEffectiveDate}
                  onChange={(e) => setEditEffectiveDate(e.target.value)}
                  data-testid="input-edit-effective-date"
                />
              </div>
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <Select value={editType} onValueChange={(v) => setEditType(v as "charge" | "payment")}>
                  <SelectTrigger id="edit-type" data-testid="select-edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charge">Charge</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger id="edit-category" data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rent">Rent</SelectItem>
                    <SelectItem value="Late Fee">Late Fee</SelectItem>
                    <SelectItem value="Utility">Utility</SelectItem>
                    <SelectItem value="Deposit">Deposit</SelectItem>
                    <SelectItem value="Pet Fee">Pet Fee</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {properties.length > 0 && (
                <div>
                  <Label htmlFor="edit-property">Property (Optional)</Label>
                  <Select value={editPropertyId || "none"} onValueChange={(v) => setEditPropertyId(v === "none" ? "" : v)}>
                    <SelectTrigger id="edit-property" data-testid="select-edit-property">
                      <SelectValue placeholder="No property selected" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No property</SelectItem>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  data-testid="input-edit-description"
                />
              </div>
              {editType === "charge" ? (
                <div>
                  <Label htmlFor="edit-charge">Charge Amount</Label>
                  <Input
                    id="edit-charge"
                    type="number"
                    step="0.01"
                    value={editChargeAmount}
                    onChange={(e) => setEditChargeAmount(e.target.value)}
                    data-testid="input-edit-charge"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="edit-payment">Payment Amount</Label>
                  <Input
                    id="edit-payment"
                    type="number"
                    step="0.01"
                    value={editPaymentAmount}
                    onChange={(e) => setEditPaymentAmount(e.target.value)}
                    data-testid="input-edit-payment"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="edit-payment-method">Payment Method</Label>
                <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                  <SelectTrigger id="edit-payment-method" data-testid="select-edit-payment-method">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Zelle">Zelle</SelectItem>
                    <SelectItem value="Venmo">Venmo</SelectItem>
                    <SelectItem value="ACH">ACH</SelectItem>
                    <SelectItem value="Certified Funds">Certified Funds</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-reference-number">Reference #</Label>
                <Input
                  id="edit-reference-number"
                  value={editReferenceNumber}
                  onChange={(e) => setEditReferenceNumber(e.target.value)}
                  data-testid="input-edit-reference-number"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Input
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  data-testid="input-edit-notes"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingEntry(null)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateEntry}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

// =====================================================================
// Online Payments Panel - Stripe Connect ACH rent collection
// =====================================================================
interface ConnectStatus {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

function OnlinePaymentsPanel({ properties }: { properties: RentalProperty[] }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [description, setDescription] = useState("");
  const [lateFeeDollars, setLateFeeDollars] = useState("0");
  const [gracePeriodDays, setGracePeriodDays] = useState("5");
  const [reminderDaysBefore, setReminderDaysBefore] = useState("5");
  const [rentalPropertyId, setRentalPropertyId] = useState("");
  // Per-request service fee override (always tenant-paid; only the amount
  // can be tweaked per-request).
  const [serviceFeeDollars, setServiceFeeDollars] = useState("");

  type ApiError = Error & { body?: { message?: string } };

  type FeeSettings = {
    defaultServiceFeeEnabled: boolean;
    defaultServiceFeeAmount: number;
    platformFeeAmount: number;
    minServiceFeeAmount: number;
    maxServiceFeeAmount: number;
  };

  const { data: feeSettings } = useQuery<FeeSettings>({
    queryKey: ["/api/rent-payments/fee-settings"],
  });

  // Local state for the fee-defaults settings panel (amount only - tenant-paid
  // service fee is mandatory and not landlord-toggleable).
  const [feeDefaultDollars, setFeeDefaultDollars] = useState("4.95");
  useEffect(() => {
    if (feeSettings) {
      setFeeDefaultDollars((feeSettings.defaultServiceFeeAmount / 100).toFixed(2));
    }
  }, [feeSettings]);

  const updateFeeSettingsMutation = useMutation({
    mutationFn: async (payload: { defaultServiceFeeDollars?: number }) =>
      apiRequest("PATCH", "/api/rent-payments/fee-settings", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-payments/fee-settings"] });
      toast({ description: "Fee settings updated" });
    },
    onError: (e: ApiError) => toast({
      description: e?.body?.message || "Failed to update fee settings",
      variant: "destructive",
    }),
  });

  const { data: status, isLoading: statusLoading } = useQuery<ConnectStatus>({
    queryKey: ["/api/stripe-connect/status"],
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<RentPaymentRequest[]>({
    queryKey: ["/api/rent-payments"],
  });

  const onboardMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/stripe-connect/onboard", {}),
    onSuccess: async (response: Response) => {
      const data = (await response.json()) as { url?: string };
      if (data?.url) window.location.href = data.url;
    },
    onError: (e: ApiError) => toast({
      description: e?.body?.message || e?.message || "Failed to start onboarding",
      variant: "destructive",
    }),
  });

  const dashboardLinkMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/stripe-connect/login-link", {}),
    onSuccess: async (response: Response) => {
      const data = (await response.json()) as { url?: string };
      if (data?.url) window.open(data.url, "_blank");
    },
    onError: (e: ApiError) => toast({
      description: e?.body?.message || "Failed to open Stripe dashboard",
      variant: "destructive",
    }),
  });

  type CreateRentPaymentPayload = {
    tenantName: string;
    tenantEmail: string | null;
    amountDollars: number;
    dueDate: string;
    description: string | null;
    lateFeeDollars: number;
    gracePeriodDays: number;
    reminderDaysBefore: number;
    rentalPropertyId?: string | null;
    serviceFeeAmountDollars?: number;
  };

  const createPaymentMutation = useMutation({
    mutationFn: async (payload: CreateRentPaymentPayload) =>
      apiRequest("POST", "/api/rent-payments", payload),
    onSuccess: async (response: Response) => {
      const data = (await response.json()) as RentPaymentRequest & { paymentLink?: string };
      queryClient.invalidateQueries({ queryKey: ["/api/rent-payments"] });
      toast({ description: "Payment request created. Tenant link is ready to share." });
      setShowCreate(false);
      setTenantName("");
      setTenantEmail("");
      setAmountDollars("");
      setDescription("");
      setLateFeeDollars("0");
      setRentalPropertyId("");
      setServiceFeeDollars("");
      if (data?.paymentLink) {
        try {
          await navigator.clipboard.writeText(data.paymentLink);
          toast({ description: "Payment link copied to clipboard" });
        } catch {}
      }
    },
    onError: (e: ApiError) => toast({
      description: e?.body?.message || "Failed to create payment request",
      variant: "destructive",
    }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/rent-payments/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-payments"] });
      toast({ description: "Payment request deleted" });
    },
    onError: (e: ApiError) => toast({
      description: e?.body?.message || "Failed to delete",
      variant: "destructive",
    }),
  });

  // Edit-payment-request state + mutation. Opening the dialog seeds the
  // local form fields from the row; saving sends a PATCH and reopens any
  // expired Stripe session lazily on the tenant's next click.
  const [editing, setEditing] = useState<RentPaymentRequest | null>(null);
  const [editTenantName, setEditTenantNameLocal] = useState("");
  const [editTenantEmail, setEditTenantEmailLocal] = useState("");
  const [editAmountDollars, setEditAmountDollars] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDescription, setEditDescriptionLocal] = useState("");
  const [editLateFeeDollars, setEditLateFeeDollars] = useState("0");
  const [editGracePeriodDays, setEditGracePeriodDays] = useState("5");
  const [editReminderDaysBefore, setEditReminderDaysBefore] = useState("5");
  const [editRentalPropertyId, setEditRentalPropertyId] = useState("");
  const [editServiceFeeDollars, setEditServiceFeeDollars] = useState("");

  const openEditDialog = (p: RentPaymentRequest) => {
    setEditing(p);
    setEditTenantNameLocal(p.tenantName || "");
    setEditTenantEmailLocal(p.tenantEmail || "");
    setEditAmountDollars((p.amount / 100).toFixed(2));
    setEditDueDate(p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : "");
    setEditDescriptionLocal(p.description || "");
    setEditLateFeeDollars(((p.lateFeeAmount || 0) / 100).toFixed(2));
    setEditGracePeriodDays(String(p.gracePeriodDays ?? 5));
    setEditReminderDaysBefore(String(p.reminderDaysBefore ?? 5));
    setEditRentalPropertyId(p.rentalPropertyId || "");
    setEditServiceFeeDollars(((p.serviceFeeAmount || 0) / 100).toFixed(2));
  };

  const editPaymentMutation = useMutation({
    mutationFn: async (payload: { id: string; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/rent-payments/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-payments"] });
      toast({ description: "Payment request updated. Tenant link still works." });
      setEditing(null);
    },
    onError: (e: ApiError) => toast({
      description: e?.body?.message || "Failed to update",
      variant: "destructive",
    }),
  });

  const handleEditSave = () => {
    if (!editing) return;
    if (!editTenantName.trim()) {
      toast({ description: "Tenant name is required", variant: "destructive" });
      return;
    }
    if (!editAmountDollars || parseFloat(editAmountDollars) < 1) {
      toast({ description: "Amount must be at least $1.00", variant: "destructive" });
      return;
    }
    if (!editDueDate) {
      toast({ description: "Due date is required", variant: "destructive" });
      return;
    }
    editPaymentMutation.mutate({
      id: editing.id,
      data: {
        tenantName: editTenantName,
        tenantEmail: editTenantEmail || null,
        amountDollars: parseFloat(editAmountDollars),
        dueDate: editDueDate,
        description: editDescription || null,
        lateFeeDollars: parseFloat(editLateFeeDollars || "0"),
        gracePeriodDays: parseInt(editGracePeriodDays) || 0,
        reminderDaysBefore: parseInt(editReminderDaysBefore) || 0,
        rentalPropertyId: editRentalPropertyId || null,
        serviceFeeAmountDollars: parseFloat(editServiceFeeDollars || "0"),
      },
    });
  };

  const reminderMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/rent-payments/${id}/send-reminder`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-payments"] });
      toast({ description: "Reminder email sent" });
    },
    onError: (e: ApiError) => toast({
      description: e?.body?.message || "Failed to send reminder",
      variant: "destructive",
    }),
  });

  const handleCreate = () => {
    if (!tenantName || !amountDollars || !dueDate) {
      toast({ description: "Tenant name, amount, and due date are required", variant: "destructive" });
      return;
    }
    const payload: CreateRentPaymentPayload = {
      tenantName,
      tenantEmail: tenantEmail || null,
      amountDollars: parseFloat(amountDollars),
      dueDate,
      description: description || null,
      lateFeeDollars: parseFloat(lateFeeDollars || "0"),
      gracePeriodDays: parseInt(gracePeriodDays) || 5,
      reminderDaysBefore: parseInt(reminderDaysBefore) || 5,
      rentalPropertyId: rentalPropertyId || null,
    };
    if (serviceFeeDollars.trim() !== "") {
      payload.serviceFeeAmountDollars = parseFloat(serviceFeeDollars);
    }
    createPaymentMutation.mutate(payload);
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/pay-rent/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ description: "Link copied to clipboard" });
    } catch {
      toast({ description: url });
    }
  };

  const statusBadge = (s: string) => {
    type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
    const map: Record<string, { label: string; variant: BadgeVariant }> = {
      pending: { label: "Pending", variant: "secondary" },
      reminded: { label: "Reminded", variant: "secondary" },
      processing: { label: "Processing", variant: "outline" },
      paid: { label: "Paid", variant: "default" },
      overdue: { label: "Overdue", variant: "destructive" },
      canceled: { label: "Canceled", variant: "outline" },
    };
    const m = map[s] || { label: s, variant: "secondary" as BadgeVariant };
    return <Badge variant={m.variant} data-testid={`status-payment-${s}`}>{m.label}</Badge>;
  };

  // Connect onboarding gate
  if (statusLoading) {
    return <Card className="p-6"><p className="text-sm text-muted-foreground">Loading…</p></Card>;
  }

  if (!status?.chargesEnabled) {
    const hasAccount = !!status?.accountId;
    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <CreditCard className="h-6 w-6 text-primary mt-1" />
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Accept rent online via ACH</h2>
            <p className="text-muted-foreground">
              Connect your Stripe account so tenants can pay rent by bank transfer (ACH) - no credit card processing fees for you or your tenants.
              Funds are paid out directly to your bank.
            </p>
          </div>
        </div>
        <div className="bg-muted/40 rounded-md p-4 text-sm space-y-1">
          <p className="font-semibold">What you'll need to complete onboarding:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Your business or personal info (name, address, DOB, SSN/EIN)</li>
            <li>Bank account routing & account numbers (for payouts)</li>
          </ul>
        </div>
        {hasAccount && !status?.detailsSubmitted && (
          <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <p>Your onboarding is incomplete. Continue where you left off.</p>
          </div>
        )}
        {hasAccount && status?.detailsSubmitted && !status?.chargesEnabled && (
          <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <p>Your account is under review by Stripe. Charges aren't enabled yet.</p>
          </div>
        )}
        <Button
          onClick={() => onboardMutation.mutate()}
          disabled={onboardMutation.isPending}
          data-testid="button-stripe-connect-onboard"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          {hasAccount ? "Continue Stripe Onboarding" : "Connect Stripe Account"}
        </Button>
      </Card>
    );
  }

  const platformFeeDollars = ((feeSettings?.platformFeeAmount ?? 150) / 100).toFixed(2);
  const maxFeeDollars = ((feeSettings?.maxServiceFeeAmount ?? 5000) / 100).toFixed(2);
  const minFeeDollars = ((feeSettings?.minServiceFeeAmount ?? 350) / 100).toFixed(2);
  const platformFeeCents = feeSettings?.platformFeeAmount ?? 150;
  const defaultFeeCents = feeSettings?.defaultServiceFeeAmount ?? 495;

  // Live breakdown helper used by both create and edit dialogs. Mirrors
  // server-side `computeRentFees()` so landlords see exactly what the tenant
  // will pay and what they (the landlord) will net. Service fee is always
  // tenant-paid now, so the only inputs are rent and fee amount.
  const buildBreakdown = (rentDollarsStr: string, feeDollarsStr: string) => {
    const rentCents = Math.max(0, Math.round((parseFloat(rentDollarsStr || "0") || 0) * 100));
    const customCents = feeDollarsStr.trim() === ""
      ? defaultFeeCents
      : Math.round((parseFloat(feeDollarsStr) || 0) * 100);
    const serviceFeeCents = Math.max(0, customCents);
    const tenantTotal = rentCents + serviceFeeCents;
    const landlordNet = Math.max(0, tenantTotal - serviceFeeCents - platformFeeCents);
    return { rentCents, serviceFeeCents, tenantTotal, landlordNet };
  };

  const renderBreakdown = (rentDollarsStr: string, feeDollarsStr: string, testIdPrefix: string) => {
    const b = buildBreakdown(rentDollarsStr, feeDollarsStr);
    const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
    return (
      <div className="md:col-span-2 rounded-md bg-muted/40 p-3 text-sm space-y-1" data-testid={`${testIdPrefix}-breakdown`}>
        <div className="font-semibold mb-1">Breakdown</div>
        <div className="flex justify-between"><span className="text-muted-foreground">Rent</span><span data-testid={`${testIdPrefix}-breakdown-rent`}>{fmt(b.rentCents)}</span></div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Service fee (tenant pays)</span>
          <span data-testid={`${testIdPrefix}-breakdown-service-fee`}>{fmt(b.serviceFeeCents)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 mt-1">
          <span className="text-muted-foreground">Tenant total</span>
          <span className="font-semibold" data-testid={`${testIdPrefix}-breakdown-tenant-total`}>{fmt(b.tenantTotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>LeaseShield platform fee</span>
          <span data-testid={`${testIdPrefix}-breakdown-platform-fee`}>− {fmt(platformFeeCents)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 mt-1">
          <span className="font-semibold">You receive</span>
          <span className="font-semibold" data-testid={`${testIdPrefix}-breakdown-landlord-net`}>{fmt(b.landlordNet)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4" data-testid="card-fee-settings">
        <div className="flex items-start gap-3">
          <DollarSign className="h-6 w-6 text-primary mt-1" />
          <div>
            <h2 className="text-xl font-bold">Payment Fees</h2>
            <p className="text-sm text-muted-foreground">
              Online rent payments include a small convenience fee that the tenant pays on top of rent -
              this covers bank-transfer (ACH) processing so you receive the full rent amount. A flat
              ${platformFeeDollars} LeaseShield platform fee is also deducted at settlement
              (you don't see it as a separate transaction). Minimum fee ${minFeeDollars}, max ${maxFeeDollars}.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <Label htmlFor="fee-default">Tenant convenience fee (USD)</Label>
            <Input
              id="fee-default"
              type="number"
              step="0.01"
              min={minFeeDollars}
              max={maxFeeDollars}
              value={feeDefaultDollars}
              onChange={(e) => setFeeDefaultDollars(e.target.value)}
              data-testid="input-default-service-fee"
            />
            <p className="text-xs text-muted-foreground mt-1" data-testid="text-fee-preview">
              Tenant pays rent + ${parseFloat(feeDefaultDollars || "0").toFixed(2)} · You receive the full rent amount minus a ${platformFeeDollars} platform fee.
            </p>
          </div>
          <Button
            onClick={() => updateFeeSettingsMutation.mutate({
              defaultServiceFeeDollars: parseFloat(feeDefaultDollars || "0"),
            })}
            disabled={updateFeeSettingsMutation.isPending}
            data-testid="button-save-fee-settings"
          >
            Save Fee Settings
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mt-1" />
            <div>
              <h2 className="text-xl font-bold">Stripe Connected</h2>
              <p className="text-sm text-muted-foreground">
                You can accept ACH bank transfers from tenants. Payouts go directly to your linked bank.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => dashboardLinkMutation.mutate()}
              disabled={dashboardLinkMutation.isPending}
              data-testid="button-stripe-dashboard"
            >
              Stripe Dashboard
            </Button>
            <Button
              onClick={() => setShowCreate(true)}
              data-testid="button-create-rent-request"
            >
              <Plus className="h-4 w-4 mr-2" />
              Request Rent Payment
            </Button>
          </div>
        </div>

        {paymentsLoading ? (
          <p className="text-sm text-muted-foreground">Loading payment requests…</p>
        ) : payments.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-10 px-4 text-center"
            data-testid="text-no-payments"
          >
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Inbox className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-1">No rent payment requests yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Create a request to send your tenant a secure ACH payment link. Funds land in your linked bank account.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              data-testid="button-empty-create-rent-request"
            >
              <Plus className="h-4 w-4 mr-2" />
              Request Rent Payment
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => {
                const property = properties.find((rp) => rp.id === p.rentalPropertyId);
                return (
                  <TableRow key={p.id} data-testid={`row-payment-${p.id}`}>
                    <TableCell>
                      <div className="font-medium" data-testid={`text-tenant-${p.id}`}>{p.tenantName}</div>
                      {p.tenantEmail && <div className="text-xs text-muted-foreground">{p.tenantEmail}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{property?.name || "-"}</TableCell>
                    <TableCell className="font-medium" data-testid={`text-amount-${p.id}`}>
                      <div>${(p.amount / 100).toFixed(2)}</div>
                      {(p.serviceFeeAmount || 0) > 0 && p.serviceFeePayer !== 'none' && (
                        <div className="text-xs text-muted-foreground" data-testid={`text-fee-summary-${p.id}`}>
                          {p.serviceFeePayer === 'tenant'
                            ? `+ $${(p.serviceFeeAmount/100).toFixed(2)} fee (tenant pays)`
                            : `− $${(p.serviceFeeAmount/100).toFixed(2)} fee (you absorb)`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(p.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyLink(p.publicToken)}
                          data-testid={`button-copy-link-${p.id}`}
                        >
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                        {p.tenantEmail && p.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => reminderMutation.mutate(p.id)}
                            disabled={reminderMutation.isPending}
                            data-testid={`button-send-reminder-${p.id}`}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {p.status !== "paid" && p.status !== "processing" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(p)}
                            data-testid={`button-edit-payment-${p.id}`}
                            title="Edit this payment request"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {p.status !== "paid" && p.status !== "processing" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deletePaymentMutation.mutate(p.id)}
                            disabled={deletePaymentMutation.isPending}
                            data-testid={`button-delete-payment-${p.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Rent Payment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div>
              <Label htmlFor="rp-tenant">Tenant Name *</Label>
              <Input
                id="rp-tenant"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                data-testid="input-rp-tenant-name"
              />
            </div>
            <div>
              <Label htmlFor="rp-email">Tenant Email (for reminders)</Label>
              <Input
                id="rp-email"
                type="email"
                value={tenantEmail}
                onChange={(e) => setTenantEmail(e.target.value)}
                data-testid="input-rp-tenant-email"
              />
            </div>
            <div>
              <Label htmlFor="rp-amount">Amount (USD) *</Label>
              <Input
                id="rp-amount"
                type="number"
                step="0.01"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                placeholder="0.00"
                data-testid="input-rp-amount"
              />
            </div>
            <div>
              <Label htmlFor="rp-due">Due Date *</Label>
              <Input
                id="rp-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-rp-due-date"
              />
            </div>
            {properties.length > 0 && (
              <div className="md:col-span-2">
                <Label htmlFor="rp-property">Property (Optional)</Label>
                <Select value={rentalPropertyId || "none"} onValueChange={(v) => setRentalPropertyId(v === "none" ? "" : v)}>
                  <SelectTrigger id="rp-property" data-testid="select-rp-property">
                    <SelectValue placeholder="No property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No property</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="md:col-span-2">
              <Label htmlFor="rp-desc">Description / Memo</Label>
              <Textarea
                id="rp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="e.g., December rent for 123 Main St"
                data-testid="input-rp-description"
              />
            </div>
            <div>
              <Label htmlFor="rp-late">Late Fee (USD)</Label>
              <Input
                id="rp-late"
                type="number"
                step="0.01"
                value={lateFeeDollars}
                onChange={(e) => setLateFeeDollars(e.target.value)}
                data-testid="input-rp-late-fee"
              />
            </div>
            <div>
              <Label htmlFor="rp-grace">Grace Period (days)</Label>
              <Input
                id="rp-grace"
                type="number"
                min="0"
                value={gracePeriodDays}
                onChange={(e) => setGracePeriodDays(e.target.value)}
                data-testid="input-rp-grace-days"
              />
            </div>
            <div>
              <Label htmlFor="rp-remind">Send reminder N days before due</Label>
              <Input
                id="rp-remind"
                type="number"
                min="0"
                value={reminderDaysBefore}
                onChange={(e) => setReminderDaysBefore(e.target.value)}
                data-testid="input-rp-reminder-days"
              />
            </div>
            <div>
              <Label htmlFor="rp-fee-amount">Tenant convenience fee (USD)</Label>
              <Input
                id="rp-fee-amount"
                type="number"
                step="0.01"
                min={minFeeDollars}
                max={maxFeeDollars}
                value={serviceFeeDollars}
                onChange={(e) => setServiceFeeDollars(e.target.value)}
                placeholder={((feeSettings?.defaultServiceFeeAmount ?? 495) / 100).toFixed(2)}
                data-testid="input-rp-fee-amount"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave blank to use your default (${((feeSettings?.defaultServiceFeeAmount ?? 495) / 100).toFixed(2)}).</p>
            </div>
            {renderBreakdown(amountDollars, serviceFeeDollars, "rp")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} data-testid="button-cancel-rp">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={createPaymentMutation.isPending}
              data-testid="button-submit-rp"
            >
              Create & Get Payment Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit existing payment request - same fields as create dialog,
          pre-filled. Tenant payment link (publicToken) is preserved so the
          tenant doesn't need a new email; if amount or due date changed,
          the server expires any open Stripe session and a fresh one is
          created on their next click. */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Payment Request</DialogTitle>
          </DialogHeader>
          {editing && (
            <p className="text-xs text-muted-foreground -mt-2 mb-1">
              Status: {editing.status} • The existing payment link will continue to work after saving.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div>
              <Label htmlFor="ep-tenant">Tenant Name *</Label>
              <Input
                id="ep-tenant"
                value={editTenantName}
                onChange={(e) => setEditTenantNameLocal(e.target.value)}
                data-testid="input-ep-tenant-name"
              />
            </div>
            <div>
              <Label htmlFor="ep-email">Tenant Email</Label>
              <Input
                id="ep-email"
                type="email"
                value={editTenantEmail}
                onChange={(e) => setEditTenantEmailLocal(e.target.value)}
                data-testid="input-ep-tenant-email"
              />
            </div>
            <div>
              <Label htmlFor="ep-amount">Amount (USD) *</Label>
              <Input
                id="ep-amount"
                type="number"
                step="0.01"
                value={editAmountDollars}
                onChange={(e) => setEditAmountDollars(e.target.value)}
                data-testid="input-ep-amount"
              />
            </div>
            <div>
              <Label htmlFor="ep-due">Due Date *</Label>
              <Input
                id="ep-due"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                data-testid="input-ep-due-date"
              />
            </div>
            {properties.length > 0 && (
              <div className="md:col-span-2">
                <Label htmlFor="ep-property">Property (Optional)</Label>
                <Select
                  value={editRentalPropertyId || "none"}
                  onValueChange={(v) => setEditRentalPropertyId(v === "none" ? "" : v)}
                >
                  <SelectTrigger id="ep-property" data-testid="select-ep-property">
                    <SelectValue placeholder="No property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No property</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="md:col-span-2">
              <Label htmlFor="ep-desc">Description / Memo</Label>
              <Textarea
                id="ep-desc"
                value={editDescription}
                onChange={(e) => setEditDescriptionLocal(e.target.value)}
                rows={2}
                data-testid="input-ep-description"
              />
            </div>
            <div>
              <Label htmlFor="ep-late">Late Fee (USD)</Label>
              <Input
                id="ep-late"
                type="number"
                step="0.01"
                value={editLateFeeDollars}
                onChange={(e) => setEditLateFeeDollars(e.target.value)}
                data-testid="input-ep-late-fee"
              />
            </div>
            <div>
              <Label htmlFor="ep-grace">Grace Period (days)</Label>
              <Input
                id="ep-grace"
                type="number"
                min="0"
                value={editGracePeriodDays}
                onChange={(e) => setEditGracePeriodDays(e.target.value)}
                data-testid="input-ep-grace-days"
              />
            </div>
            <div>
              <Label htmlFor="ep-remind">Reminder N days before due</Label>
              <Input
                id="ep-remind"
                type="number"
                min="0"
                value={editReminderDaysBefore}
                onChange={(e) => setEditReminderDaysBefore(e.target.value)}
                data-testid="input-ep-reminder-days"
              />
            </div>
            <div>
              <Label htmlFor="ep-fee-amount">Tenant convenience fee (USD)</Label>
              <Input
                id="ep-fee-amount"
                type="number"
                step="0.01"
                min={minFeeDollars}
                max={maxFeeDollars}
                value={editServiceFeeDollars}
                onChange={(e) => setEditServiceFeeDollars(e.target.value)}
                data-testid="input-ep-fee-amount"
              />
            </div>
            {renderBreakdown(editAmountDollars, editServiceFeeDollars, "ep")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} data-testid="button-cancel-ep">Cancel</Button>
            <Button
              onClick={handleEditSave}
              disabled={editPaymentMutation.isPending}
              data-testid="button-submit-ep"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
