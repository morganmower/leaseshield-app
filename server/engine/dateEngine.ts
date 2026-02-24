export type DateCalculationInput = {
  dayType: string;
  noticePeriodDays: number;
  countingConvention: string;
  serviceDate: string;
  holidays: Array<{ date: string; label: string }>;
};

export type DateCalculationResult = {
  complianceDeadline: string;
  earliestFilingDate: string;
  explainFormula: string;
};

export function calculateDates(input: DateCalculationInput): DateCalculationResult {
  const { dayType, noticePeriodDays, countingConvention, serviceDate, holidays } = input;

  const service = parseDate(serviceDate);
  const holidaySet = new Set(holidays.map(h => h.date));

  let deadline: Date;
  let formula: string;

  switch (dayType) {
    case 'calendar': {
      deadline = addCalendarDays(service, noticePeriodDays);
      formula = `Service date (${serviceDate}) + ${noticePeriodDays} calendar days = ${formatDate(deadline)}`;
      break;
    }
    case 'business': {
      deadline = addBusinessDays(service, noticePeriodDays, holidaySet);
      formula = `Service date (${serviceDate}) + ${noticePeriodDays} business days (excluding weekends${holidays.length ? ' and holidays' : ''}) = ${formatDate(deadline)}`;
      break;
    }
    case 'judicial':
    case 'judicial_holidays_excluded': {
      deadline = addBusinessDays(service, noticePeriodDays, holidaySet);
      formula = `Service date (${serviceDate}) + ${noticePeriodDays} judicial days (excluding weekends and court holidays) = ${formatDate(deadline)}`;
      break;
    }
    default: {
      deadline = addCalendarDays(service, noticePeriodDays);
      formula = `Service date (${serviceDate}) + ${noticePeriodDays} days = ${formatDate(deadline)}`;
    }
  }

  const earliestFiling = addCalendarDays(deadline, 1);
  const filing = skipToNextBusinessDay(earliestFiling, holidaySet);

  formula += `. Earliest filing date: ${formatDate(filing)} (next business day after deadline)`;

  return {
    complianceDeadline: formatDate(deadline),
    earliestFilingDate: formatDate(filing),
    explainFormula: formula,
  };
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date: Date, holidays: Set<string>): boolean {
  return holidays.has(formatDate(date));
}

function addBusinessDays(startDate: Date, days: number, holidays: Set<string>): Date {
  let current = new Date(startDate);
  let counted = 0;

  while (counted < days) {
    current.setDate(current.getDate() + 1);
    if (!isWeekend(current) && !isHoliday(current, holidays)) {
      counted++;
    }
  }

  return current;
}

function skipToNextBusinessDay(date: Date, holidays: Set<string>): Date {
  let current = new Date(date);
  while (isWeekend(current) || isHoliday(current, holidays)) {
    current.setDate(current.getDate() + 1);
  }
  return current;
}
