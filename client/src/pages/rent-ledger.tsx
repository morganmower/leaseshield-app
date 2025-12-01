import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Trash2, DollarSign } from "lucide-react";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RentLedgerEntry } from "@shared/schema";

export default function RentLedger() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("fast");
  const [tenantName, setTenantName] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [amountExpected, setAmountExpected] = useState("");
  const [amountReceived, setAmountReceived] = useState("");

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

  const downloadExcelTemplate = () => {
    const csv = `Tenant Name,Month (YYYY-MM),Amount Expected,Amount Received,Payment Date,Notes
John Doe,${new Date().toISOString().slice(0, 7)},1500,0,,
Jane Smith,${new Date().toISOString().slice(0, 7)},1200,0,,`;

    const element = document.createElement("a");
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
    element.setAttribute("download", "rent-ledger-template.csv");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast({ description: "Excel template downloaded!" });
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
      paymentDate: amountReceived ? new Date().toISOString() : null,
      propertyId: null,
      userId: "", // Will be set by server
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
              <h2 className="text-2xl font-bold mb-2">Quick Download</h2>
              <p className="text-muted-foreground mb-6">Get started instantly with our pre-formatted Excel template</p>
              <Button
                onClick={downloadExcelTemplate}
                className="gap-2"
                data-testid="button-download-excel"
              >
                <Download className="h-4 w-4" />
                Download Excel Template
              </Button>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
              <p className="font-semibold">What's included:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Pre-formatted columns for tenant name, month, expected & received amounts</li>
                <li>Payment date and notes fields</li>
                <li>Ready to share with accountant or save locally</li>
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
                  <Label htmlFor="amount-expected">Amount Expected *</Label>
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
                  <Label htmlFor="amount-received">Amount Received</Label>
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
              <h2 className="text-xl font-bold mb-4">Rent Tracking</h2>
              {isLoading ? (
                <p className="text-muted-foreground">Loading entries...</p>
              ) : entries && entries.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                        <TableHead className="w-16">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => {
                        const expected = entry.amountExpected / 100;
                        const received = (entry.amountReceived ?? 0) / 100;
                        const status = received >= expected ? "Paid" : received > 0 ? "Partial" : "Pending";
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">{entry.tenantName}</TableCell>
                            <TableCell>{entry.month}</TableCell>
                            <TableCell className="text-right">${expected.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${received.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
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
                            <TableCell>
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
    </div>
  );
}
