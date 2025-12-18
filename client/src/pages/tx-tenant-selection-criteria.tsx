import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Scale, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function TxTenantSelectionCriteria() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  Landlord's Tenant Selection Criteria & Grounds for Denial
                </CardTitle>
                <p className="text-muted-foreground mt-1">Texas Property Code Requirements</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <p className="text-muted-foreground">
              This notice describes factors that may be considered when reviewing a rental application. 
              The landlord may deny an application based on one or more of the factors below, subject to 
              applicable law and consistent screening practices.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg mb-3">Selection Criteria May Include:</h3>
                  <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                    <li>Identity verification and Social Security Number trace results</li>
                    <li>Rental history (including past due balances, lease violations, or evictions)</li>
                    <li>Employment and/or income verification and ability to pay rent</li>
                    <li>Credit history (tradelines, delinquencies, collections, judgments, bankruptcies)</li>
                    <li>Criminal history as permitted by applicable law</li>
                    <li>Prior property-related misconduct (e.g., damage beyond normal wear, unauthorized occupants)</li>
                    <li>Failure to provide complete, accurate, or verifiable information</li>
                    <li>Failure to meet occupancy limits for the unit</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg mb-3">Grounds for Possible Denial May Include:</h3>
                  <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                    <li>Material misrepresentation or omission on the application</li>
                    <li>Inability to verify identity, income, or rental history</li>
                    <li>Screening results that do not meet the landlord's criteria</li>
                    <li>Any other lawful, nondiscriminatory reason consistent with written criteria</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border">
              <h3 className="font-semibold mb-2">How to Request a Copy</h3>
              <p className="text-muted-foreground">
                You may request a copy of these tenant selection criteria at any time by contacting the landlord 
                or property manager listed on your rental application.
              </p>
            </div>

            <div className="text-sm text-muted-foreground border-t pt-4">
              <p>
                This notice is provided in accordance with Texas Property Code requirements regarding 
                tenant selection criteria disclosure.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
