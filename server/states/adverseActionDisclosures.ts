/**
 * State-Specific Adverse Action Requirements
 * 
 * This file contains state-specific legal requirements for adverse action notices
 * beyond the federal FCRA requirements. These are injected into adverse action
 * letters based on the applicant's state.
 * 
 * Federal FCRA (applies to all states):
 * - Name/address of CRA
 * - CRA did not make the decision
 * - Right to free report within 60 days
 * - Right to dispute accuracy
 * 
 * State-specific additions documented here.
 */

export interface StateAdverseActionRequirement {
  /** State-specific statute citations */
  statutes: string[];
  /** Additional disclosures required by the state */
  disclosures: string[];
  /** Special timing requirements (if different from federal) */
  timing?: string;
  /** Notes about source of income protection */
  sourceOfIncomeProtection?: string;
  /** Fair chance/ban-the-box requirements for criminal history */
  fairChanceRequirements?: string;
  /** Local ordinances that may apply */
  localOrdinanceNote?: string;
}

/**
 * State-specific adverse action requirements registry.
 * States without entries follow federal FCRA requirements only.
 */
export const STATE_ADVERSE_ACTION_REGISTRY: Record<string, StateAdverseActionRequirement> = {
  CA: {
    statutes: [
      'California Civil Code § 1785 et seq. (California Consumer Credit Reporting Agencies Act)',
      'California Civil Code § 1786 et seq. (Investigative Consumer Reporting Agencies Act)',
      'Government Code § 12955 (California Fair Employment and Housing Act)',
    ],
    disclosures: [
      'If an investigative consumer report was used, you have the right to request a complete disclosure of the nature and scope of the investigation.',
      'Under California law, you may request a copy of any background check or credit report obtained about you.',
      'California prohibits discrimination based on source of income, including Section 8 vouchers and other housing assistance.',
    ],
    sourceOfIncomeProtection: 'California Fair Employment and Housing Act prohibits housing discrimination based on lawful source of income, including Housing Choice Vouchers (Section 8), SSI, SSDI, and other government assistance.',
    fairChanceRequirements: 'Some California cities (San Francisco, Los Angeles, Oakland, Berkeley) have Fair Chance Ordinances that may impose additional requirements when considering criminal history.',
    localOrdinanceNote: 'Check local fair chance housing ordinances in San Francisco, Los Angeles, Oakland, Berkeley, and other cities which may impose waiting periods or additional notice requirements.',
  },
  IL: {
    statutes: [
      '775 ILCS 5/3-102 (Illinois Human Rights Act)',
      '775 ILCS 5/3-102.1 (Source of Income Protection)',
    ],
    disclosures: [
      'Illinois law prohibits discrimination based on source of income, including Housing Choice Vouchers.',
      'Cook County has additional fair housing protections that may apply.',
    ],
    sourceOfIncomeProtection: 'Illinois Human Rights Act prohibits housing discrimination based on lawful source of income, including Housing Choice Vouchers (Section 8), Social Security, and other government assistance.',
    localOrdinanceNote: 'Cook County and City of Chicago have additional fair chance housing ordinances that may apply to criminal history screening.',
  },
  VA: {
    statutes: [
      'Virginia Code § 36-96.1 et seq. (Virginia Fair Housing Law)',
      'Virginia Code § 59.1-443 et seq. (Consumer Reporting)',
    ],
    disclosures: [
      'Virginia Fair Housing Law prohibits discrimination on the basis of race, color, religion, national origin, sex, elderliness, familial status, source of funds, sexual orientation, gender identity, or disability.',
    ],
    sourceOfIncomeProtection: 'Virginia law prohibits discrimination based on source of funds, including housing assistance programs.',
  },
  NV: {
    statutes: [
      'NRS 118.100 et seq. (Nevada Fair Housing Law)',
      'NRS 598C (Consumer Reporting)',
    ],
    disclosures: [
      'Nevada law provides additional consumer reporting protections.',
      'Reno and other jurisdictions have additional fair housing protections.',
    ],
  },
  FL: {
    statutes: [
      'Florida Statutes § 760.20 et seq. (Florida Fair Housing Act)',
    ],
    disclosures: [
      'Florida Fair Housing Act prohibits discrimination based on race, color, national origin, sex, handicap, familial status, or religion.',
    ],
  },
  AZ: {
    statutes: [
      'A.R.S. § 41-1491 et seq. (Arizona Civil Rights Act)',
      'A.R.S. § 33-1321 (Residential Landlord and Tenant Act)',
    ],
    disclosures: [
      'Arizona Civil Rights Act prohibits housing discrimination on various protected grounds.',
    ],
  },
  TX: {
    statutes: [
      'Texas Property Code § 92 (Residential Tenancies)',
      'Texas Property Code § 301 (Texas Fair Housing Act)',
    ],
    disclosures: [
      'Texas Fair Housing Act prohibits discrimination based on race, color, disability, religion, sex, national origin, or familial status.',
    ],
    localOrdinanceNote: 'Austin has additional source of income protections. Check local ordinances.',
  },
  UT: {
    statutes: [
      'Utah Code § 57-21-1 et seq. (Utah Fair Housing Act)',
    ],
    disclosures: [
      'Utah Fair Housing Act prohibits discrimination based on race, color, religion, sex, national origin, familial status, source of income, or disability.',
    ],
    sourceOfIncomeProtection: 'Utah law prohibits discrimination based on source of income.',
  },
  NC: {
    statutes: [
      'N.C.G.S. § 41A-1 et seq. (State Fair Housing Act)',
    ],
    disclosures: [
      'North Carolina Fair Housing Act prohibits discrimination in housing.',
    ],
  },
  OH: {
    statutes: [
      'Ohio Revised Code § 4112 (Ohio Civil Rights)',
    ],
    disclosures: [
      'Ohio Civil Rights Law prohibits housing discrimination.',
    ],
  },
  MI: {
    statutes: [
      'MCL 37.2501 et seq. (Elliott-Larsen Civil Rights Act)',
    ],
    disclosures: [
      'Michigan Elliott-Larsen Civil Rights Act prohibits discrimination in real estate transactions.',
    ],
  },
  ID: {
    statutes: [
      'Idaho Code § 67-5901 et seq. (Idaho Human Rights Act)',
    ],
    disclosures: [
      'Idaho Human Rights Act prohibits housing discrimination.',
    ],
  },
  WY: {
    statutes: [
      'Wyoming Statutes § 6-9-102 (Fair Housing)',
    ],
    disclosures: [
      'Wyoming fair housing law follows federal Fair Housing Act protections.',
    ],
  },
  ND: {
    statutes: [
      'NDCC § 14-02.4 (North Dakota Human Rights Act)',
    ],
    disclosures: [
      'North Dakota Human Rights Act prohibits housing discrimination.',
    ],
  },
  SD: {
    statutes: [
      'SDCL 20-13 (South Dakota Human Relations Act)',
    ],
    disclosures: [
      'South Dakota Human Relations Act prohibits housing discrimination.',
    ],
  },
  NM: {
    statutes: [
      'NMSA § 28-1-1 et seq. (New Mexico Human Rights Act)',
    ],
    disclosures: [
      'New Mexico Human Rights Act prohibits housing discrimination, including based on sexual orientation and gender identity.',
    ],
  },
};

/**
 * Get state-specific adverse action HTML content
 */
export function getStateAdverseActionHtml(stateCode: string): string {
  const requirements = STATE_ADVERSE_ACTION_REGISTRY[stateCode];
  
  if (!requirements) {
    return ''; // State follows federal FCRA only
  }
  
  let html = `
    <div class="section">
      <div class="section-title">State-Specific Rights (${stateCode})</div>
      <div class="state-box" style="background: #f5f5f5; border: 1px solid #ddd; padding: 10px; margin-top: 6px; font-size: 9.5pt;">
  `;
  
  // Add statute citations
  if (requirements.statutes.length > 0) {
    html += `<p style="margin-bottom: 6px;"><strong>Applicable State Laws:</strong></p>
             <ul style="margin-left: 16px; margin-bottom: 8px; font-size: 9pt;">`;
    for (const statute of requirements.statutes) {
      html += `<li style="margin-bottom: 2px;">${statute}</li>`;
    }
    html += `</ul>`;
  }
  
  // Add disclosures
  if (requirements.disclosures.length > 0) {
    html += `<p style="margin-bottom: 4px;"><strong>Additional State Disclosures:</strong></p>
             <ul style="margin-left: 16px; margin-bottom: 8px;">`;
    for (const disclosure of requirements.disclosures) {
      html += `<li style="margin-bottom: 3px;">${disclosure}</li>`;
    }
    html += `</ul>`;
  }
  
  // Add source of income protection if applicable
  if (requirements.sourceOfIncomeProtection) {
    html += `<p style="margin-top: 6px; font-size: 9pt; border-left: 3px solid #2196F3; padding-left: 8px;">
               <strong>Source of Income Protection:</strong> ${requirements.sourceOfIncomeProtection}
             </p>`;
  }
  
  // Add fair chance requirements if applicable
  if (requirements.fairChanceRequirements) {
    html += `<p style="margin-top: 6px; font-size: 9pt; border-left: 3px solid #FF9800; padding-left: 8px;">
               <strong>Fair Chance Notice:</strong> ${requirements.fairChanceRequirements}
             </p>`;
  }
  
  // Add local ordinance note if applicable
  if (requirements.localOrdinanceNote) {
    html += `<p style="margin-top: 6px; font-size: 8pt; font-style: italic; color: #666;">
               Note: ${requirements.localOrdinanceNote}
             </p>`;
  }
  
  html += `</div></div>`;
  
  return html;
}
