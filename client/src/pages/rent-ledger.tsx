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

export default function RentLedger() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("fast");
  const [tenantName, setTenantName] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [amountExpected, setAmountExpected] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [editingEntry, setEditingEntry] = useState<RentLedgerEntry | null>(null);
  const [editTenantName, setEditTenantName] = useState("");
  const [editMonth, setEditMonth] = useState("");
  const [editCharge, setEditCharge] = useState("");
  const [editPayment, setEditPayment] = useState("");

  const { data: entries, isLoading } = useQuery<RentLedgerEntry[]>({
    queryKey: ["/api/rent-ledger"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest("POST", "/api/rent-ledger", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-ledger"] });
      setTenantName("");
      setMonth(new Date().toISOString().slice(0, 7));
      setAmountExpected("");
      setAmountReceived("");
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
    setEditMonth(entry.month);
    setEditCharge((entry.amountExpected / 100).toFixed(2));
    setEditPayment(((entry.amountReceived ?? 0) / 100).toFixed(2));
  };

  const handleUpdateEntry = () => {
    if (!editTenantName || !editMonth || !editCharge || !editingEntry) {
      toast({ description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: editingEntry.id,
      tenantName: editTenantName,
      month: editMonth,
      amountExpected: Math.round(parseFloat(editCharge) * 100),
      amountReceived: Math.round(parseFloat(editPayment) * 100),
      paymentDate: null,
      propertyId: null,
      notes: "",
    });
  };

  const downloadExcelTemplate = () => {
    if (!entries || entries.length === 0) {
      toast({ description: "No entries to export. Add entries to the ledger first.", variant: "destructive" });
      return;
    }

    // Sort entries by date
    const sortedEntries = [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Calculate totals and running balances
    let totalCharges = 0;
    let totalPayments = 0;
    let runningBalance = 0;

    const csvRows = [
      // Header
      "RENT LEDGER REPORT",
      `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      "",
      // Column headers
      "Date,Tenant Name,Month,Charge Amount,Payment Received,Running Balance,Status",
    ];

    // Data rows with running balance
    sortedEntries.forEach((entry) => {
      const charge = entry.amountExpected / 100;
      const payment = (entry.amountReceived ?? 0) / 100;
      runningBalance += charge - payment;
      totalCharges += charge;
      totalPayments += payment;

      const status = payment >= charge ? "Paid" : payment > 0 ? "Partial" : "Pending";
      const dateStr = new Date(entry.createdAt).toLocaleDateString();

      csvRows.push(
        `"${dateStr}","${entry.tenantName}","${entry.month}","$${charge.toFixed(2)}","$${payment.toFixed(2)}","$${runningBalance.toFixed(2)}","${status}"`
      );
    });

    // Totals row
    const totalBalance = totalCharges - totalPayments;
    csvRows.push("");
    csvRows.push(`"TOTALS","","","$${totalCharges.toFixed(2)}","$${totalPayments.toFixed(2)}","$${totalBalance.toFixed(2)}",""`);

    // Summary
    csvRows.push("");
    csvRows.push("SUMMARY");
    csvRows.push(`"Total Charges","$${totalCharges.toFixed(2)}""`);
    csvRows.push(`"Total Payments","$${totalPayments.toFixed(2)}""`);
    csvRows.push(`"Outstanding Balance","$${totalBalance.toFixed(2)}""`);

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
    if (!tenantName || !month || !amountExpected) {
      toast({ description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      tenantName,
      month,
      amountExpected: Math.round(parseFloat(amountExpected) * 100),
      amountReceived: amountReceived ? Math.round(parseFloat(amountReceived) * 100) : 0,
      paymentDate: null,
      propertyId: null,
      notes: "",
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
          Track monthly rent payments and manage your rental income.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="fast" data-testid="tab-fast-path">Quick Download (Excel)</TabsTrigger>
          <TabsTrigger value="slow" data-testid="tab-slow-path">Track Rent</TabsTrigger>
        </TabsList>

        {/* Fast Path - Excel Download */}
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
              <p className="font-semibold">What's included:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>All itemized rent charges and payments with dates</li>
                <li>Running balance calculation for each transaction</li>
                <li>Status column (Paid, Partial, Pending)</li>
                <li>Professional summary with total charges, payments, and outstanding balance</li>
                <li>Ready to share with accountant, lender, or save for records</li>
              </ul>
            </div>
          </Card>
        </TabsContent>

        {/* Slow Path - In-App Tracking */}
        <TabsContent value="slow">
          <div className="space-y-6">
            {/* Add Entry Form */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">Add Rent Entry</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="month">Month *</Label>
                  <Input
                    id="month"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    data-testid="input-month"
                  />
                </div>
                <div>
                  <Label htmlFor="amount-expected">Charge Amount *</Label>
                  <Input
                    id="amount-expected"
                    type="number"
                    step="0.01"
                    value={amountExpected}
                    onChange={(e) => setAmountExpected(e.target.value)}
                    placeholder="1500.00"
                    data-testid="input-amount-expected"
                  />
                </div>
                <div>
                  <Label htmlFor="amount-received">Payment Received</Label>
                  <Input
                    id="amount-received"
                    type="number"
                    step="0.01"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder="1500.00"
                    data-testid="input-amount-received"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddEntry}
                className="mt-6 gap-2"
                disabled={createMutation.isPending}
                data-testid="button-add-entry"
              >
                <Plus className="h-4 w-4" />
                Add Entry
              </Button>
            </Card>

            {/* Rent Ledger Table */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Rent Ledger History</h2>
              {isLoading ? (
                <p className="text-muted-foreground">Loading entries...</p>
              ) : entries && entries.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Charge</TableHead>
                        <TableHead className="text-right">Payment</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-16">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((entry, idx) => {
                        const expected = entry.amountExpected / 100;
                        const received = (entry.amountReceived ?? 0) / 100;
                        const balance = expected - received;
                        const status = received >= expected ? "Paid" : received > 0 ? "Partial" : "Pending";
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="text-sm">{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell className="font-medium">{entry.tenantName}</TableCell>
                            <TableCell>{entry.month}</TableCell>
                            <TableCell className="text-right font-mono">${expected.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600 dark:text-green-400">${received.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">${balance.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded ${
                                  status === "Paid"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                    : status === "Partial"
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                }`}
                                data-testid={`status-${entry.id}`}
                              >
                                {status}
                              </span>
                            </TableCell>
                            <TableCell className="flex gap-2">
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
                      {entries && entries.length > 0 && (() => {
                        const totalCharge = entries.reduce((sum, e) => sum + (e.amountExpected / 100), 0);
                        const totalPayment = entries.reduce((sum, e) => sum + ((e.amountReceived ?? 0) / 100), 0);
                        const totalBalance = totalCharge - totalPayment;
                        return (
                          <TableRow className="border-t-2 border-t-primary font-bold bg-muted/50">
                            <TableCell colSpan={3}>TOTALS</TableCell>
                            <TableCell className="text-right font-mono">${totalCharge.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600 dark:text-green-400">${totalPayment.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">${totalBalance.toFixed(2)}</TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                        );
                      })()}
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Rent Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <Label htmlFor="edit-month">Month</Label>
              <Input
                id="edit-month"
                type="month"
                value={editMonth}
                onChange={(e) => setEditMonth(e.target.value)}
                data-testid="input-edit-month"
              />
            </div>
            <div>
              <Label htmlFor="edit-charge">Charge Amount</Label>
              <Input
                id="edit-charge"
                type="number"
                step="0.01"
                value={editCharge}
                onChange={(e) => setEditCharge(e.target.value)}
                data-testid="input-edit-charge"
              />
            </div>
            <div>
              <Label htmlFor="edit-payment">Payment Received</Label>
              <Input
                id="edit-payment"
                type="number"
                step="0.01"
                value={editPayment}
                onChange={(e) => setEditPayment(e.target.value)}
                data-testid="input-edit-payment"
              />
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
