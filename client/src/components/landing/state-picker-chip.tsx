import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check, Bell, MapPin, X } from "lucide-react";

interface StateApi {
  id: string;
  name: string;
  isActive: boolean;
}

const ALL_STATES: { id: string; name: string }[] = [
  { id: "AL", name: "Alabama" }, { id: "AK", name: "Alaska" }, { id: "AZ", name: "Arizona" },
  { id: "AR", name: "Arkansas" }, { id: "CA", name: "California" }, { id: "CO", name: "Colorado" },
  { id: "CT", name: "Connecticut" }, { id: "DE", name: "Delaware" }, { id: "FL", name: "Florida" },
  { id: "GA", name: "Georgia" }, { id: "HI", name: "Hawaii" }, { id: "ID", name: "Idaho" },
  { id: "IL", name: "Illinois" }, { id: "IN", name: "Indiana" }, { id: "IA", name: "Iowa" },
  { id: "KS", name: "Kansas" }, { id: "KY", name: "Kentucky" }, { id: "LA", name: "Louisiana" },
  { id: "ME", name: "Maine" }, { id: "MD", name: "Maryland" }, { id: "MA", name: "Massachusetts" },
  { id: "MI", name: "Michigan" }, { id: "MN", name: "Minnesota" }, { id: "MS", name: "Mississippi" },
  { id: "MO", name: "Missouri" }, { id: "MT", name: "Montana" }, { id: "NE", name: "Nebraska" },
  { id: "NV", name: "Nevada" }, { id: "NH", name: "New Hampshire" }, { id: "NJ", name: "New Jersey" },
  { id: "NM", name: "New Mexico" }, { id: "NY", name: "New York" }, { id: "NC", name: "North Carolina" },
  { id: "ND", name: "North Dakota" }, { id: "OH", name: "Ohio" }, { id: "OK", name: "Oklahoma" },
  { id: "OR", name: "Oregon" }, { id: "PA", name: "Pennsylvania" }, { id: "RI", name: "Rhode Island" },
  { id: "SC", name: "South Carolina" }, { id: "SD", name: "South Dakota" }, { id: "TN", name: "Tennessee" },
  { id: "TX", name: "Texas" }, { id: "UT", name: "Utah" }, { id: "VT", name: "Vermont" },
  { id: "VA", name: "Virginia" }, { id: "WA", name: "Washington" }, { id: "WV", name: "West Virginia" },
  { id: "WI", name: "Wisconsin" }, { id: "WY", name: "Wyoming" },
];

export function StatePickerChip() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: apiStates } = useQuery<StateApi[]>({
    queryKey: ["/api/states"],
    staleTime: 1000 * 60 * 5,
  });

  const activeStateIds = useMemo(() => {
    const set = new Set<string>();
    (apiStates || []).forEach((s) => {
      if (s.isActive) set.add(s.id);
    });
    return set;
  }, [apiStates]);

  const isSelectedActive = selected ? activeStateIds.has(selected.id) : false;

  const handleStateClick = (state: { id: string; name: string }) => {
    setSubmitted(false);
    setEmail("");
    setSelected(state);
  };

  const handleNotifyMe = async () => {
    if (!selected) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast({
        title: "Email required",
        description: "Enter a valid email so we can notify you.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/waitlist/state", {
        email: email.trim(),
        stateId: selected.id,
        stateName: selected.name,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast({
        title: "Couldn't save your request",
        description: err?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl" data-testid="section-state-picker">
      <div className="text-center mb-3 space-y-1">
        <p className="text-xs sm:text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Available nationwide. State-specific forms in select states.
        </p>
        <p className="text-xs text-muted-foreground">
          Applications, screening, and rent collection work in all 50 states. Tap your state to see if local lease and court forms are ready.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 mb-4" data-testid="state-chip-row">
        {ALL_STATES.map((state) => {
          const isActive = activeStateIds.has(state.id);
          const isSelected = selected?.id === state.id;
          return (
            <button
              key={state.id}
              type="button"
              onClick={() => handleStateClick(state)}
              data-testid={`chip-state-${state.id}`}
              data-active={isActive}
              data-selected={isSelected}
              title={isActive ? `${state.name} - Supported` : `${state.name} - Coming soon`}
              className={[
                "min-w-[44px] h-8 px-2.5 rounded-md text-xs font-semibold tabular-nums transition-colors",
                "border hover-elevate active-elevate-2",
                isActive
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/40 text-muted-foreground border-border",
                isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
              ].join(" ")}
            >
              {state.id}
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className="mx-auto max-w-xl rounded-md border border-border bg-card/80 backdrop-blur-sm p-4"
          data-testid="state-picker-result"
        >
          {isSelectedActive ? (
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium text-foreground">
                  {selected.name} is fully supported.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setLocation(`/templates?state=${selected.id}`)}
                  data-testid={`button-see-templates-${selected.id}`}
                >
                  See {selected.id} templates
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                  data-testid="button-clear-state"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : submitted ? (
            <div className="flex items-center gap-2 text-sm justify-center">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span className="text-foreground">
                Got it - we'll email you when {selected.name} is ready.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">
                  {selected.name} isn't supported yet. Get notified when it launches:
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-waitlist-email"
                  className="flex-1"
                />
                <Button
                  size="default"
                  onClick={handleNotifyMe}
                  disabled={submitting}
                  data-testid="button-notify-me"
                >
                  {submitting ? "Saving..." : "Notify me"}
                </Button>
                <Button
                  size="default"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                  data-testid="button-clear-state"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
