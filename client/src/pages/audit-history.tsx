import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  CheckCircle,
  AlertTriangle,
  Lock,
  ArrowLeft,
  ClipboardList,
  Calendar,
  MapPin,
  FileText,
  Loader2,
} from "lucide-react";

interface AuditLog {
  id: string;
  userId: string;
  applicantName: string | null;
  stateId: string;
  cityId: string | null;
  cityName: string | null;
  ruleVersion: string;
  outcome: 'approve' | 'conditional' | 'deny';
  criteriaPresent: string[];
  criteriaSelectedForDenial: string[] | null;
  generatedDenialText: string | null;
  adverseActionLetterGenerated: boolean;
  conditionsApplied: string[] | null;
  createdAt: string;
}

const OUTCOME_STYLES = {
  approve: {
    icon: CheckCircle,
    label: "Approved",
    badgeClass: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    iconClass: "text-green-600",
  },
  conditional: {
    icon: AlertTriangle,
    label: "Conditional",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    iconClass: "text-amber-600",
  },
  deny: {
    icon: Lock,
    label: "Denied",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    iconClass: "text-red-600",
  },
};

export default function AuditHistory() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['/api/denial-decision/audit-history'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/denial-decision/audit-history');
      return res.json();
    },
    enabled: !!user,
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/screening">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Screening
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2" data-testid="text-page-title">
          <ClipboardList className="h-6 w-6" />
          Screening Decision History
        </h1>
        <p className="text-muted-foreground">
          Review your past screening decisions and compliance documentation.
        </p>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Decisions Yet</h3>
            <p className="text-muted-foreground mb-4">
              Your screening decisions will appear here after you use the Denial Decision Assistant.
            </p>
            <Link href="/denial-decision">
              <Button data-testid="button-start-decision">
                Start a Decision
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const style = OUTCOME_STYLES[log.outcome];
            const Icon = style.icon;
            
            return (
              <Card key={log.id} data-testid={`card-audit-${log.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full bg-muted ${style.iconClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {log.applicantName || "Applicant"}
                          <Badge className={style.badgeClass}>
                            {style.label}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(log.createdAt)}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {log.cityName ? `${log.cityName}, ${log.stateId}` : log.stateId}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {log.criteriaPresent && log.criteriaPresent.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Criteria Present:</p>
                      <div className="flex flex-wrap gap-1">
                        {log.criteriaPresent.map((code, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.outcome === 'conditional' && log.conditionsApplied && log.conditionsApplied.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Conditions Applied:</p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {log.conditionsApplied.map((condition, i) => (
                          <li key={i}>{condition}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {log.outcome === 'deny' && (
                    <div className="flex items-center gap-4 text-sm">
                      {log.adverseActionLetterGenerated && (
                        <span className="flex items-center gap-1 text-primary">
                          <FileText className="h-4 w-4" />
                          Adverse Action Letter Generated
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
