import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Trash2, DollarSign, Edit2 } from "lucide-react";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RentLedgerEntry } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RentLedger() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("fast");
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

  const { data: entries, isLoading } = useQuery<RentLedgerEntry[]>({
    queryKey: ["/api/rent-ledger"],
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
      toast({ description: "Rent entry added successfully!" });
    },
    onError: () => toast({ description: "Failed to add entry", variant: "destructive" }),
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
  };

  const handleUpdateEntry = () => {
    if (!editTenantName || !editingEntry) {
      toast({ description: "Please enter tenant name", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: editingEntry.id,
      userId: editingEntry.userId,
      propertyId: editingEntry.propertyId,
      tenantName: editTenantName,
      effectiveDate: editEffectiveDate || new Date().toISOString().split('T')[0],
      type: editType,
      category: editCategory,
      description: editDescription,
      amountExpected: editType === "charge" ? Math.round(parseFloat(editChargeAmount || "0") * 100) : 0,
      amountReceived: editType === "payment" ? Math.round(parseFloat(editPaymentAmount || "0") * 100) : 0,
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
      const chargeDisplay = entry.type === "charge" ? charge.toFixed(2) : "0.00";
      const paymentDisplay = entry.type === "payment" ? payment.toFixed(2) : "0.00";

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

    const chargeAmt = type === "charge" ? Math.round(parseFloat(chargeAmount || "0") * 100) : 0;
    const paymentAmt = type === "payment" ? Math.round(parseFloat(paymentAmount || "0") * 100) : 0;

    createMutation.mutate({
      userId: user?.id,
      propertyId: null,
      tenantName,
      effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
      type,
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
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="fast" data-testid="tab-fast-path">Export Report</TabsTrigger>
          <TabsTrigger value="slow" data-testid="tab-slow-path">Track Entries</TabsTrigger>
        </TabsList>

        {/* Export Report */}
        <TabsContent value="fast">
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
        <TabsContent value="slow">
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
                  <Label htmlFor="type">Transaction Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as "charge" | "payment")}>
                    <SelectTrigger id="type" data-testid="select-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="charge">Charge</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                    </SelectContent>
                  </Select>
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
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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

                {type === "charge" ? (
                  <div>
                    <Label htmlFor="charge-amount">Charge Amount</Label>
                    <Input
                      id="charge-amount"
                      type="number"
                      step="0.01"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(e.target.value)}
                      placeholder="1500.00"
                      data-testid="input-charge-amount"
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="payment-amount">Payment Amount</Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="1500.00"
                      data-testid="input-payment-amount"
                    />
                  </div>
                )}

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
                <h2 className="text-lg font-bold mb-4">Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(() => {
                    let totalCharges = 0;
                    let totalPayments = 0;
                    entries.forEach((entry) => {
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
              <h2 className="text-xl font-bold mb-4">Ledger History</h2>
              {isLoading ? (
                <p className="text-muted-foreground">Loading entries...</p>
              ) : entries && entries.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Effective Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Charge Amount</TableHead>
                        <TableHead className="text-right">Payment Amount</TableHead>
                        <TableHead className="text-right">Running Balance</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Ref #</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-20">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.sort((a, b) => {
                        const dateA = a.effectiveDate ? new Date(a.effectiveDate).getTime() : new Date(a.createdAt).getTime();
                        const dateB = b.effectiveDate ? new Date(b.effectiveDate).getTime() : new Date(b.createdAt).getTime();
                        return dateB - dateA;
                      }).map((entry) => {
                        const expected = entry.amountExpected / 100;
                        const received = (entry.amountReceived ?? 0) / 100;
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="text-sm">{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-sm">{entry.effectiveDate ? new Date(entry.effectiveDate).toLocaleDateString() : "-"}</TableCell>
                            <TableCell><span className="text-xs bg-muted px-2 py-1 rounded">{entry.type === "payment" ? "Payment" : "Charge"}</span></TableCell>
                            <TableCell className="text-sm">{entry.category}</TableCell>
                            <TableCell className="text-sm max-w-xs truncate">{entry.description || "-"}</TableCell>
                            <TableCell className="text-right font-mono">${entry.type === "charge" ? expected.toFixed(2) : "0.00"}</TableCell>
                            <TableCell className="text-right font-mono text-green-600 dark:text-green-400">${entry.type === "payment" ? received.toFixed(2) : "0.00"}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">${(entry.amountExpected / 100 - (entry.amountReceived ?? 0) / 100).toFixed(2)}</TableCell>
                            <TableCell className="text-sm">{entry.paymentMethod || "-"}</TableCell>
                            <TableCell className="text-sm">{entry.referenceNumber || "-"}</TableCell>
                            <TableCell className="text-sm max-w-xs truncate">{entry.notes || "-"}</TableCell>
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
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No entries yet. Add one above to get started!</p>
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
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
