import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lightbulb, Mail, CheckCircle2, Clock, Send } from "lucide-react";

interface Tip {
  title: string;
  summary: string;
  content: string;
  actionItem: string;
  index: number;
  isCurrent: boolean;
}

interface TipsResponse {
  tips: Tip[];
  currentTipIndex: number;
  currentBiweek: number;
  totalTips: number;
}

export default function AdminTips() {
  const { toast } = useToast();
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);

  const { data: tipsData, isLoading } = useQuery<TipsResponse>({
    queryKey: ["/api/admin/tips"],
  });

  const previewMutation = useMutation({
    mutationFn: async (tipIndex: number) => {
      setSendingIndex(tipIndex);
      const res = await apiRequest("POST", `/api/admin/tips/${tipIndex}/preview`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Preview Sent",
        description: data.message,
      });
      setSendingIndex(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send preview.",
        variant: "destructive",
      });
      setSendingIndex(null);
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Lightbulb className="h-8 w-8 text-primary" />
          Tips Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Preview and manage biweekly landlord tips. Tips are sent every 2 weeks to opted-in users.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Current Biweek</p>
              <p className="text-2xl font-bold">{tipsData?.currentBiweek}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Active Tip</p>
              <p className="text-2xl font-bold">#{(tipsData?.currentTipIndex ?? 0) + 1}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Tips</p>
              <p className="text-2xl font-bold">{tipsData?.totalTips}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            With {tipsData?.totalTips} tips rotating every 2 weeks, the full cycle repeats every {(tipsData?.totalTips ?? 0) * 2} weeks ({Math.round((tipsData?.totalTips ?? 0) * 2 / 4.33)} months).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {tipsData?.tips.map((tip) => (
          <Card key={tip.index} className={tip.isCurrent ? "border-primary" : ""}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={tip.isCurrent ? "default" : "secondary"}>
                    Tip #{tip.index + 1}
                  </Badge>
                  {tip.isCurrent && (
                    <Badge variant="outline" className="border-green-500 text-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Current
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => previewMutation.mutate(tip.index)}
                  disabled={sendingIndex === tip.index}
                  data-testid={`button-preview-tip-${tip.index}`}
                >
                  {sendingIndex === tip.index ? (
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-1" />
                      Preview
                    </>
                  )}
                </Button>
              </div>
              <CardTitle className="text-lg">{tip.title}</CardTitle>
              <CardDescription>{tip.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{tip.content}</p>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r">
                <p className="text-sm">
                  <strong>Action Item:</strong> {tip.actionItem}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
