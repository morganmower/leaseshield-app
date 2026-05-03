import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Copy, Download, Calendar, Mail, FileText, Inbox } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import type { CommunicationTemplate } from "@shared/schema";
import { getAccessToken } from "@/lib/queryClient";
import { useStates } from "@/hooks/useStates";
import { SEO } from "@/components/seo";

const TEMPLATE_LABELS: Record<string, string> = {
  rent_reminder: "Rent Reminder",
  welcome_letter: "Welcome Letter",
  lease_renewal_notice: "Lease Renewal Notice",
  late_payment_notice: "Late Payment Notice",
  move_in_welcome: "Move-In Welcome",
  thirty_day_notice: "30 Day Notice",
};

function DatePickerField({ 
  field, 
  value, 
  onChange 
}: { 
  field: string; 
  value: string | undefined; 
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal"
          data-testid={`input-${field}`}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {value || `Select ${field.replace(/_/g, " ")}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, "MMMM d, yyyy"));
              setOpen(false);
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default function Communications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { states } = useStates();
  
  const sortedStates = useMemo(() => 
    [...states].sort((a, b) => a.name.localeCompare(b.name)), 
    [states]
  );
  
  const [selectedState, setSelectedState] = useState<string>(user?.preferredState || "UT");
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplate | null>(null);
  const [mergeFields, setMergeFields] = useState<Record<string, string>>({});

  // Log when state changes to debug the issue
  useEffect(() => {
    console.log(`📍 State changed to: ${selectedState}`);
  }, [selectedState]);

  const { data: templates = [], isLoading, error, refetch } = useQuery<CommunicationTemplate[]>({
    queryKey: ["/api/communications", selectedState],
    queryFn: async ({ queryKey }) => {
      const [_, state] = queryKey as [string, string];
      const url = `/api/communications?stateId=${state}`;
      console.log(`🔄 Fetching templates for state ${state} from ${url}`);
      const token = getAccessToken();
      const response = await fetch(url, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText} for ${url}`);
        throw new Error(`Failed to fetch templates: ${response.status}`);
      }
      const data = await response.json();
      console.log(`✅ Fetched ${Array.isArray(data) ? data.length : 0} templates for state ${state}:`, data);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    gcTime: 0, // Disable caching to force fresh fetch on state change
  });

  const extractMergeFields = (text: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const fields: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!fields.includes(match[1])) {
        fields.push(match[1]);
      }
    }
    return fields;
  };

  const renderTemplate = (text: string, fields: Record<string, string>): string => {
    let rendered = text;
    Object.entries(fields).forEach(([key, value]) => {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    });
    // Convert literal \n to actual newlines for proper display
    rendered = rendered.replace(/\\n/g, '\n');
    return rendered;
  };

  const handleCopyToClipboard = () => {
    if (!selectedTemplate) return;
    const rendered = renderTemplate(selectedTemplate.bodyText, mergeFields);
    navigator.clipboard.writeText(rendered);
    toast({ description: "Copied to clipboard!" });
  };

  const handleDownload = () => {
    if (!selectedTemplate) return;
    const rendered = renderTemplate(selectedTemplate.bodyText, mergeFields);
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(rendered));
    element.setAttribute("download", `${selectedTemplate.title}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast({ description: "Download started!" });
  };

  const uniqueTemplates = (templates || []).filter(
    (t, i, arr) => arr.findIndex((x) => x.templateType === t.templateType) === i,
  );
  const currentStateName = sortedStates.find((s) => s.id === selectedState)?.name || selectedState;

  return (
    <div className="flex-1 overflow-auto">
      <SEO
        title="Communication Templates - Landlord-to-tenant messages"
        description="Pre-written, state-specific landlord communication templates: rent reminders, welcome letters, lease renewals, late payment notices. Customize and download."
        canonical="/communications"
      />

      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-semibold text-foreground mb-1">
                  Communication Templates
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Pre-written landlord-to-tenant messages. Customize, copy, download.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-template-count">
                  {uniqueTemplates.length}
                </p>
                <p className="text-xs text-muted-foreground">Templates</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-states-count">
                  {sortedStates.length}
                </p>
                <p className="text-xs text-muted-foreground">States</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Templates List */}
          <div className="lg:col-span-1">
            <div className="space-y-5">
              <div>
                <Label htmlFor="state-select" className="text-sm font-medium mb-2 block">
                  State
                </Label>
                <Select
                  value={selectedState}
                  onValueChange={(val) => {
                    setSelectedState(val);
                    setSelectedTemplate(null);
                    setMergeFields({});
                  }}
                >
                  <SelectTrigger id="state-select" data-testid="select-state">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedStates.map((state) => (
                      <SelectItem key={state.id} value={state.id}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Available templates</Label>
                <div className="space-y-2">
                  {error && (
                    <p className="text-sm text-destructive">Error: {error.message}</p>
                  )}
                  {isLoading ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />
                      ))}
                    </div>
                  ) : uniqueTemplates.length > 0 ? (
                    uniqueTemplates.map((template) => (
                      <Button
                        key={template.id}
                        variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                        className="w-full justify-start text-left"
                        onClick={() => {
                          setSelectedTemplate(template);
                          const fields = extractMergeFields(template.bodyText);
                          setMergeFields(Object.fromEntries(fields.map((f) => [f, ""])));
                        }}
                        data-testid={`button-template-${template.id}`}
                      >
                        <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                        {TEMPLATE_LABELS[template.templateType] || template.title}
                      </Button>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed p-6 text-center" data-testid="empty-state-no-templates">
                      <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground mb-1">
                        No templates for {currentStateName} yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        We're rolling these out state by state. Try a different state above.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Template Editor */}
          <div className="lg:col-span-2">
            {selectedTemplate ? (
              <Card className="p-6 space-y-6 shadow-sm">
                <div>
                  <h2 className="text-xl font-display font-semibold mb-1">{selectedTemplate.title}</h2>
                  <p className="text-sm text-muted-foreground">Fill in the fields below to customize this template.</p>
                </div>

              {/* Merge Fields Form */}
              {Object.keys(mergeFields).length > 0 && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-semibold">Customize Template</h3>
                  <div className="space-y-3">
                    {Object.keys(mergeFields).map((field) => {
                      const isDateField = field.toLowerCase().includes('date');
                      
                      return (
                        <div key={field}>
                          <Label htmlFor={`field-${field}`} className="capitalize text-sm">
                            {field.replace(/_/g, " ")}
                          </Label>
                          {isDateField ? (
                            <DatePickerField
                              field={field}
                              value={mergeFields[field]}
                              onChange={(value) => setMergeFields((prev) => ({ ...prev, [field]: value }))}
                            />
                          ) : (
                            <Input
                              id={`field-${field}`}
                              value={mergeFields[field]}
                              onChange={(e) =>
                                setMergeFields((prev) => ({
                                  ...prev,
                                  [field]: e.target.value,
                                }))
                              }
                              placeholder={`Enter ${field.replace(/_/g, " ")}`}
                              data-testid={`input-${field}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

                {/* Template Preview */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Preview</h3>
                  <div className="p-4 bg-muted/30 border rounded-md min-h-64 whitespace-pre-wrap text-sm leading-relaxed">
                    {renderTemplate(selectedTemplate.bodyText, mergeFields)}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleCopyToClipboard}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-copy-template"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to clipboard
                  </Button>
                  <Button
                    onClick={handleDownload}
                    className="flex-1"
                    data-testid="button-download-template"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download as text
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="p-12 flex flex-col items-center justify-center text-center min-h-[320px] shadow-sm" data-testid="empty-state-no-selection">
                <div className="p-4 bg-primary/10 rounded-md mb-4">
                  <Mail className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                  Pick a template to start
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Select a template from the list to preview, fill in tenant-specific details, and copy or download a ready-to-send message.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
