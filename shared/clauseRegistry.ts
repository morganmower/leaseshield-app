export const CLAUSE_KEYS = {
  LATE_FEE_CAP_PCT: 'late_fee_cap_pct',
  LATE_FEE_CAP_FLAT_USD: 'late_fee_cap_flat_usd',
  LATE_FEE_GRACE_DAYS: 'late_fee_grace_days',
  DEPOSIT_CAP_MONTHS: 'deposit_cap_months',
  DEPOSIT_RETURN_DAYS: 'deposit_return_days',
  NOTICE_TO_ENTER_HOURS: 'notice_to_enter_hours',
  NOTICE_TERMINATE_MTM_DAYS: 'notice_terminate_mtm_days',
  NOTICE_RENT_INCREASE_DAYS: 'notice_rent_increase_days',
} as const;

export type ClauseKey = typeof CLAUSE_KEYS[keyof typeof CLAUSE_KEYS];

export type ClauseCategory = 'late_fees' | 'deposits' | 'notices';
export type ClauseUnit =
  | 'percent_of_rent'
  | 'usd'
  | 'days'
  | 'months_rent'
  | 'hours';

export interface ClauseDefinition {
  key: ClauseKey;
  label: string;
  category: ClauseCategory;
  unit: ClauseUnit;
  helpText: string;
}

export const CLAUSE_DEFINITIONS: ClauseDefinition[] = [
  {
    key: CLAUSE_KEYS.LATE_FEE_CAP_PCT,
    label: 'Late fee cap (% of monthly rent)',
    category: 'late_fees',
    unit: 'percent_of_rent',
    helpText: 'Maximum late fee expressed as a percent of monthly rent. Leave blank if state uses a flat-dollar cap instead.',
  },
  {
    key: CLAUSE_KEYS.LATE_FEE_CAP_FLAT_USD,
    label: 'Late fee cap (flat dollars)',
    category: 'late_fees',
    unit: 'usd',
    helpText: 'Maximum late fee in dollars (use this when the state caps by amount, not percent).',
  },
  {
    key: CLAUSE_KEYS.LATE_FEE_GRACE_DAYS,
    label: 'Late fee grace period (days)',
    category: 'late_fees',
    unit: 'days',
    helpText: 'Minimum number of days that must elapse after the rent due date before a late fee may be charged.',
  },
  {
    key: CLAUSE_KEYS.DEPOSIT_CAP_MONTHS,
    label: 'Security deposit cap (months of rent)',
    category: 'deposits',
    unit: 'months_rent',
    helpText: 'Maximum security deposit, expressed as a multiple of monthly rent. e.g. 1.5 = one-and-a-half months rent.',
  },
  {
    key: CLAUSE_KEYS.DEPOSIT_RETURN_DAYS,
    label: 'Security deposit return deadline (days)',
    category: 'deposits',
    unit: 'days',
    helpText: 'Maximum number of days after move-out by which the deposit (less lawful deductions) must be returned.',
  },
  {
    key: CLAUSE_KEYS.NOTICE_TO_ENTER_HOURS,
    label: 'Notice to enter (hours)',
    category: 'notices',
    unit: 'hours',
    helpText: 'Minimum advance notice the landlord must give before entering the premises (non-emergency).',
  },
  {
    key: CLAUSE_KEYS.NOTICE_TERMINATE_MTM_DAYS,
    label: 'Termination notice for month-to-month (days)',
    category: 'notices',
    unit: 'days',
    helpText: 'Minimum days of written notice required to terminate a month-to-month tenancy.',
  },
  {
    key: CLAUSE_KEYS.NOTICE_RENT_INCREASE_DAYS,
    label: 'Rent increase notice (days)',
    category: 'notices',
    unit: 'days',
    helpText: 'Minimum days of written notice required before a rent increase takes effect.',
  },
];

export function getClauseDefinition(key: string): ClauseDefinition | undefined {
  return CLAUSE_DEFINITIONS.find((d) => d.key === key);
}

export function formatClauseValue(value: number | null | undefined, unit: ClauseUnit | string | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  switch (unit) {
    case 'percent_of_rent':
      return `${value}% of monthly rent`;
    case 'usd':
      return `$${value.toFixed(2).replace(/\.00$/, '')}`;
    case 'days':
      return `${value} day${value === 1 ? '' : 's'}`;
    case 'months_rent':
      return `${value} month${value === 1 ? '' : 's'} of rent`;
    case 'hours':
      return `${value} hour${value === 1 ? '' : 's'}`;
    default:
      return String(value);
  }
}
