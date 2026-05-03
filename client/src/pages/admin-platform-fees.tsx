import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Receipt, Download } from "lucide-react";
import { Link } from "wouter";

interface MonthlyEntry {
  month: string;
  feesCents: number;
  paymentCount: number;
  volumeCents: number;
}

interface LandlordEntry {
  userId: string;
  email: string | null;
  name: string;
  feesCents: number;
  paymentCount: number;
  volumeCents: number;
}

interface PlatformFeeSummary {
  totals: {
    totalFeesCents: number;
    totalPaidCount: number;
    totalVolumeCents: number;
  };
  monthly: MonthlyEntry[];
  landlords: LandlordEntry[];
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatMonthLabel(ym: string): string {
  // ym is "YYYY-MM"
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("default", { month: "long", year: "numeric" });
}

export default function AdminPlatformFees() {
  const { data, isLoading } = useQuery<PlatformFeeSummary>({
    queryKey: ["/api/admin/platform-fees/summary"],
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8 flex flex-row items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
            Platform Fee Revenue
          </h1>
          <p className="text-muted-foreground">
            LeaseShield application fees collected on online rent payments.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/admin" asChild>
            <Button variant="outline" data-testid="link-back-admin">
              Back to Admin
            </Button>
          </Link>
          <a
            href="/api/admin/platform-fees/export.csv"
            download
            data-testid="link-export-csv"
          >
            <Button>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Platform Fees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-fees">
                {formatUsd(data?.totals.totalFeesCents ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              All-time, paid rent payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Payments</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-paid-count">
                {(data?.totals.totalPaidCount ?? 0).toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Number of completed transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rent Volume Processed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-volume">
                {formatUsd(data?.totals.totalVolumeCents ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Total tenant payment amount processed
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
          <CardDescription>
            Platform fees collected per calendar month (most recent 24).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data || data.monthly.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-monthly-empty">
              No paid rent payments yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Rent Volume</TableHead>
                  <TableHead className="text-right">Platform Fees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.monthly.map((m) => (
                  <TableRow key={m.month} data-testid={`row-month-${m.month}`}>
                    <TableCell data-testid={`text-month-${m.month}`}>
                      {formatMonthLabel(m.month)}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-month-count-${m.month}`}>
                      {m.paymentCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-month-volume-${m.month}`}>
                      {formatUsd(m.volumeCents)}
                    </TableCell>
                    <TableCell className="text-right font-medium" data-testid={`text-month-fees-${m.month}`}>
                      {formatUsd(m.feesCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Landlords by Fees Generated</CardTitle>
          <CardDescription>
            Landlords driving the most platform fee revenue (top 100).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data || data.landlords.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-landlords-empty">
              No landlord activity yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Landlord</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Rent Volume</TableHead>
                  <TableHead className="text-right">Platform Fees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.landlords.map((l) => (
                  <TableRow key={l.userId} data-testid={`row-landlord-${l.userId}`}>
                    <TableCell data-testid={`text-landlord-name-${l.userId}`}>
                      {l.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`text-landlord-email-${l.userId}`}>
                      {l.email ?? "-"}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-landlord-count-${l.userId}`}>
                      {l.paymentCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-landlord-volume-${l.userId}`}>
                      {formatUsd(l.volumeCents)}
                    </TableCell>
                    <TableCell className="text-right font-medium" data-testid={`text-landlord-fees-${l.userId}`}>
                      {formatUsd(l.feesCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
