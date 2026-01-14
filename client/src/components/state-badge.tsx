import { Badge } from "@/components/ui/badge";

interface StateBadgeProps {
  stateId: string;
  className?: string;
}

const STATE_NAMES: Record<string, string> = {
  UT: "Utah",
  TX: "Texas",
  ND: "North Dakota",
  SD: "South Dakota",
  NC: "North Carolina",
  OH: "Ohio",
  MI: "Michigan",
  ID: "Idaho",
  WY: "Wyoming",
  CA: "California",
  VA: "Virginia",
  NV: "Nevada",
  AZ: "Arizona",
  FL: "Florida",
};

export function StateBadge({ stateId, className }: StateBadgeProps) {
  return (
    <Badge variant="secondary" className={className} data-testid={`badge-state-${stateId}`}>
      {STATE_NAMES[stateId] || stateId}
    </Badge>
  );
}
