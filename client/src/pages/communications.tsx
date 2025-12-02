import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Copy, Download } from "lucide-react";
import { useState } from "react";
import type { CommunicationTemplate } from "@shared/schema";

const STATE_NAMES: Record<string, string> = {
  UT: "Utah",
  TX: "Texas",
  ND: "North Dakota",
  SD: "South Dakota",
  NC: "North Carolina",
  OH: "Ohio",
  MI: "Michigan",
  ID: "Idaho",
};

const TEMPLATE_LABELS: Record<string, string> = {
  rent_reminder: "Rent Reminder",
  welcome_letter: "Welcome Letter",
  lease_renewal_notice: "Lease Renewal Notice",
  late_payment_notice: "Late Payment Notice",
  move_in_welcome: "Move-In Welcome",
};

export default function Communications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedState, setSelectedState] = useState<string>(user?.preferredState || "UT");
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplate | null>(null);
  const [mergeFields, setMergeFields] = useState<Record<string, string>>({});

  const { data: templates, isLoading, error } = useQuery<CommunicationTemplate[]>({
    queryKey: ["/api/communications", selectedState],
    queryFn: async () => {
      const response = await fetch(`/api/communications?stateId=${selectedState}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.status}`);
      }
      const data = await response.json();
      console.log(`Fetched ${data?.length || 0} templates for state ${selectedState}`);
      return data || [];
    },
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

  const stateKeys = Object.keys(STATE_NAMES).sort();

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Communication Templates</h1>
        </div>
        <p className="text-muted-foreground">
          Pre-written templates for landlord-to-tenant communication. Customize and download ready to send.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Templates List */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            <div>
              <Label htmlFor="state-select" className="text-base font-semibold">
                Select State
              </Label>
              <select
                id="state-select"
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedTemplate(null);
                  setMergeFields({});
                }}
                className="w-full mt-2 px-3 py-2 border rounded-md bg-background"
                data-testid="select-state"
              >
                {stateKeys.map((code) => (
                  <option key={code} value={code}>
                    {STATE_NAMES[code]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-base font-semibold mb-2 block">Available Templates</Label>
              <div className="space-y-2">
                {isLoading ? (
                  <p className="text-muted-foreground">Loading templates...</p>
                ) : templates && templates.length > 0 ? (
                  templates.map((template) => (
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
                      {TEMPLATE_LABELS[template.templateType] || template.title}
                    </Button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No templates available for this state yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Template Editor */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Card className="p-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">{selectedTemplate.title}</h2>
                <p className="text-sm text-muted-foreground">Fill in the fields below to customize this template</p>
              </div>

              {/* Merge Fields Form */}
              {Object.keys(mergeFields).length > 0 && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-semibold">Customize Template</h3>
                  <div className="space-y-3">
                    {Object.keys(mergeFields).map((field) => (
                      <div key={field}>
                        <Label htmlFor={`field-${field}`} className="capitalize text-sm">
                          {field.replace(/_/g, " ")}
                        </Label>
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
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Template Preview */}
              <div className="space-y-2">
                <h3 className="font-semibold">Preview</h3>
                <div className="p-4 bg-background border rounded-lg min-h-64 whitespace-pre-wrap text-sm leading-relaxed">
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
                  Copy to Clipboard
                </Button>
                <Button
                  onClick={handleDownload}
                  className="flex-1"
                  data-testid="button-download-template"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download as Text
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-6 flex items-center justify-center min-h-64">
              <p className="text-muted-foreground">Select a template to get started</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
