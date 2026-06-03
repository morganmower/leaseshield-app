// Shared property-terms helpers used by both the applicant frontend and the
// apply API. Property terms (rent, fees, deposits, deadlines) are read live so
// landlord edits propagate to existing application links immediately. Because of
// that, an applicant can begin an application, acknowledge the terms once, and
// then have the terms change underneath them. These helpers let the client and
// server agree on (a) which terms are actually shown to applicants and (b)
// whether the live terms have drifted from what an applicant acknowledged, which
// triggers a required re-acknowledgment before they can submit.

export interface PropertyTerms {
  monthlyRent?: string;
  applicationFee?: string;
  securityDeposit?: string;
  adminFee?: string;
  leaseSignDeadlineHours?: number;
  additionalNotes?: string;
}

// The exact set of fields that are surfaced to applicants on the cover page.
// Any field compared for drift must be a field the applicant could actually see.
const TERM_FIELDS: (keyof PropertyTerms)[] = [
  "monthlyRent",
  "applicationFee",
  "securityDeposit",
  "adminFee",
  "leaseSignDeadlineHours",
  "additionalNotes",
];

// A value is "N/A" (and therefore hidden from applicants) when it is empty or an
// explicit n/a marker. Hidden values must never count toward drift, otherwise an
// unrelated cleanup edit would force a needless re-acknowledgment.
export const isNA = (value: string | number | undefined | null): boolean => {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "number") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "n/a" || normalized === "na";
};

// Normalize a single displayable term to a comparable string. Returns null when
// the term is N/A so two terms that are both effectively absent compare equal.
const normalizeTerm = (value: string | number | undefined | null): string | null => {
  if (isNA(value)) return null;
  if (typeof value === "number") return String(value);
  return value!.trim();
};

// True when the terms object has at least one value an applicant would actually
// see. When false, there is nothing to acknowledge and no drift is possible.
export const hasDisplayableTerms = (terms?: PropertyTerms | null): boolean => {
  if (!terms) return false;
  return TERM_FIELDS.some((field) => !isNA(terms[field]));
};

// True when the displayable terms an applicant acknowledged differ from the
// current live terms. A missing snapshot (e.g. legacy submissions, or terms that
// were not displayable at start) is treated as "no drift" so we never block an
// applicant on a comparison we cannot make.
export const propertyTermsChanged = (
  acknowledged: PropertyTerms | null | undefined,
  live: PropertyTerms | null | undefined,
): boolean => {
  if (!acknowledged) return false;
  // If live terms have nothing displayable, there is nothing for the applicant
  // to re-acknowledge.
  if (!hasDisplayableTerms(live)) return false;
  return TERM_FIELDS.some(
    (field) => normalizeTerm(acknowledged[field]) !== normalizeTerm(live?.[field]),
  );
};
