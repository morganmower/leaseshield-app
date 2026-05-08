import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { AlertTriangle, Save } from 'lucide-react';
import {
  CLAUSE_DEFINITIONS,
  CLAUSE_KEYS,
  type ClauseDefinition,
  type ClauseUnit,
} from '@shared/clauseRegistry';

const SUPPORTED_STATES = [
  { id: 'UT', name: 'Utah' }, { id: 'TX', name: 'Texas' },
  { id: 'ND', name: 'North Dakota' }, { id: 'SD', name: 'South Dakota' },
  { id: 'NC', name: 'North Carolina' }, { id: 'OH', name: 'Ohio' },
  { id: 'MI', name: 'Michigan' }, { id: 'ID', name: 'Idaho' },
  { id: 'WY', name: 'Wyoming' }, { id: 'CA', name: 'California' },
  { id: 'VA', name: 'Virginia' }, { id: 'NV', name: 'Nevada' },
  { id: 'AZ', name: 'Arizona' }, { id: 'FL', name: 'Florida' },
  { id: 'IL', name: 'Illinois' }, { id: 'NM', name: 'New Mexico' },
];

interface StateClauseValueRow {
  id: string;
  stateId: string;
  clauseKey: string;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string | null;
  statuteCitation: string | null;
  effectiveDate: string | null;
  needsReview: boolean;
  notes: string | null;
  updatedAt: string;
}

interface ListResponse {
  definitions: ClauseDefinition[];
  values: StateClauseValueRow[];
}

function unitSuffix(unit: ClauseUnit | string | null | undefined): string {
  switch (unit) {
    case 'percent_of_rent': return '% of rent';
    case 'usd': return 'USD';
    case 'days': return 'days';
    case 'hours': return 'hours';
    case 'months_rent': return 'months of rent';
    default: return '';
  }
}

interface ClauseRowEditorProps {
  stateId: string;
  definition: ClauseDefinition;
  existing: StateClauseValueRow | undefined;
}

function ClauseRowEditor({ stateId, definition, existing }: ClauseRowEditorProps) {
  const { toast } = useToast();
  const [valueNumeric, setValueNumeric] = useState<string>(existing?.valueNumeric != null ? String(existing.valueNumeric) : '');
  const [statuteCitation, setStatuteCitation] = useState<string>(existing?.statuteCitation ?? '');
  const [notes, setNotes] = useState<string>(existing?.notes ?? '');

  // Re-sync local form state whenever the underlying row identity changes
  // (e.g. user switched the selected state).
  useEffect(() => {
    setValueNumeric(existing?.valueNumeric != null ? String(existing.valueNumeric) : '');
    setStatuteCitation(existing?.statuteCitation ?? '');
    setNotes(existing?.notes ?? '');
  }, [stateId, definition.key, existing?.valueNumeric, existing?.statuteCitation, existing?.notes]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = valueNumeric.trim();
      const parsed = trimmed === '' ? null : Number(trimmed);
      if (parsed !== null && Number.isNaN(parsed)) {
        throw new Error('Value must be a number');
      }
      const res = await apiRequest(
        'PATCH',
        `/api/admin/state-clause-values/${stateId}/${definition.key}`,
        {
          valueNumeric: parsed,
          statuteCitation: statuteCitation.trim() || null,
          notes: notes.trim() || null,
          needsReview: parsed === null,
        },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state-clause-values', stateId] });
      toast({ title: 'Saved', description: `${definition.label} updated for ${stateId}.` });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message || 'Failed to save', variant: 'destructive' });
    },
  });

  const isEmpty = existing?.valueNumeric == null;

  return (
    <Card data-testid={`card-clause-${definition.key}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <CardTitle className="text-base">{definition.label}</CardTitle>
            <CardDescription>{definition.helpText}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{definition.category.replace('_', ' ')}</Badge>
            {isEmpty && (
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Needs value
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor={`value-${definition.key}`} className="text-xs">
              Value ({unitSuffix(definition.unit)})
            </Label>
            <Input
              id={`value-${definition.key}`}
              type="number"
              step="any"
              value={valueNumeric}
              onChange={(e) => setValueNumeric(e.target.value)}
              placeholder="—"
              data-testid={`input-value-${definition.key}`}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor={`citation-${definition.key}`} className="text-xs">
              Statute citation
            </Label>
            <Input
              id={`citation-${definition.key}`}
              value={statuteCitation}
              onChange={(e) => setStatuteCitation(e.target.value)}
              placeholder="e.g. Cal. Civ. Code § 1950.5"
              data-testid={`input-citation-${definition.key}`}
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`notes-${definition.key}`} className="text-xs">
            Internal notes (optional)
          </Label>
          <Input
            id={`notes-${definition.key}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional admin notes"
            data-testid={`input-notes-${definition.key}`}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {existing?.updatedAt
              ? `Last updated ${new Date(existing.updatedAt).toLocaleString()}`
              : 'Never saved'}
          </p>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid={`button-save-${definition.key}`}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClauseValuesTab() {
  const { toast } = useToast();
  const [stateId, setStateId] = useState<string>('CA');

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ['/api/admin/state-clause-values', stateId],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem('jwt_token');
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/admin/state-clause-values?stateId=${stateId}`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error('Failed to load clause values');
      return res.json();
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/state-clause-values/seed-empty', {});
      return res.json();
    },
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state-clause-values'] });
      toast({
        title: 'Seed complete',
        description: `Inserted ${resp?.inserted ?? 0} new placeholder rows.`,
      });
    },
  });

  const valuesByKey = useMemo(() => {
    const m = new Map<string, StateClauseValueRow>();
    (data?.values ?? []).forEach((v) => m.set(v.clauseKey, v));
    return m;
  }, [data?.values]);

  const definitions = data?.definitions ?? CLAUSE_DEFINITIONS;
  const grouped = useMemo(() => {
    const groups: Record<string, ClauseDefinition[]> = { late_fees: [], deposits: [], notices: [] };
    definitions.forEach((d) => {
      (groups[d.category] ||= []).push(d);
    });
    return groups;
  }, [definitions]);

  const populatedCount = (data?.values ?? []).filter((v) => v.valueNumeric != null).length;
  const totalDefinitions = definitions.length;

  return (
    <div className="space-y-4" data-testid="tab-content-clause-values">
      <Card>
        <CardHeader>
          <CardTitle>State Clause Values</CardTitle>
          <CardDescription>
            Edit per-state legal limits (late fee caps, deposit caps, notice periods).
            The lease generator reads these values at render time and adds a state-specific
            compliance footnote next to each affected clause.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">State</Label>
              <Select value={stateId} onValueChange={setStateId}>
                <SelectTrigger data-testid="select-clause-state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_STATES.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`option-state-${s.id}`}>
                      {s.name} ({s.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Populated for {stateId}</span>
              <Badge variant="outline" className="w-fit" data-testid="badge-populated-count">
                {populatedCount} / {totalDefinitions}
              </Badge>
            </div>
            <Button
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              data-testid="button-seed-empty"
              title="Idempotently insert blank rows for any (state, clause) pair that doesn't have one yet"
            >
              Seed missing rows
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : (
        (['late_fees', 'deposits', 'notices'] as const).map((cat) => (
          <div key={cat} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {cat === 'late_fees' ? 'Late Fees' : cat === 'deposits' ? 'Security Deposits' : 'Notices'}
            </h3>
            {grouped[cat].map((def) => (
              <ClauseRowEditor
                key={def.key}
                stateId={stateId}
                definition={def}
                existing={valuesByKey.get(def.key)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
