import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Trash2, DollarSign, Edit2, Building2, CreditCard, Send, Copy, Link as LinkIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RentLedgerEntry, RentalProperty, RentPaymentRequest } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RentLedger() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("track");
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

  const { data: entries, isLoading } = useQuery<RentLedgerEntry[]>({
    queryKey: ["/api/rent-ledger"],
  });

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
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Rent Ledger</h1>
        </div>
        <p className="text-muted-foreground">
          Professional rent tracking with detailed payments, fees, and documentation.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="track" data-testid="tab-track-entries">Track Entries</TabsTrigger>
          <TabsTrigger value="online" data-testid="tab-online-payments">Online Payments</TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export-report">Export Report</TabsTrigger>
        </TabsList>

        {/* Online Payments (Stripe Connect ACH) */}
        <TabsContent value="online">
          <OnlinePaymentsPanel properties={properties} />
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
                    // Filter entries for summary calculation
                    const filteredEntries = entries.filter((entry) => {
                      if (filterPropertyId === "all") return true;
                      if (filterPropertyId === "unassigned") return !entry.propertyId;
                      return entry.propertyId === filterPropertyId;
                    });
                    
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
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
                        // Filter entries by property if filter is active
                        const filteredEntries = entries.filter((entry) => {
                          if (filterPropertyId === "all") return true;
                          if (filterPropertyId === "unassigned") return !entry.propertyId;
                          return entry.propertyId === filterPropertyId;
                        });
                        
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

  const { data: status, isLoading: statusLoading } = useQuery<ConnectStatus>({
    queryKey: ["/api/stripe-connect/status"],
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<RentPaymentRequest[]>({
    queryKey: ["/api/rent-payments"],
  });

  type ApiError = Error & { body?: { message?: string } };

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
    createPaymentMutation.mutate({
      tenantName,
      tenantEmail: tenantEmail || null,
      amountDollars: parseFloat(amountDollars),
      dueDate,
      description: description || null,
      lateFeeDollars: parseFloat(lateFeeDollars || "0"),
      gracePeriodDays: parseInt(gracePeriodDays) || 5,
      reminderDaysBefore: parseInt(reminderDaysBefore) || 5,
      rentalPropertyId: rentalPropertyId || null,
    });
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
              Connect your Stripe account so tenants can pay rent by bank transfer (ACH) — no credit card processing fees for you or your tenants.
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

  return (
    <div className="space-y-6">
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
          <p className="text-sm text-muted-foreground" data-testid="text-no-payments">
            No rent payment requests yet. Create one to send your tenant a payment link.
          </p>
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
                    <TableCell className="text-sm text-muted-foreground">{property?.name || "—"}</TableCell>
                    <TableCell className="font-medium" data-testid={`text-amount-${p.id}`}>
                      ${(p.amount / 100).toFixed(2)}
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
    </div>
  );
}
