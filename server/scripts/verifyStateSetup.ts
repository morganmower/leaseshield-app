import { db } from '../db';
import { states, templates, complianceCards, communicationTemplates, legalUpdates } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

interface VerificationResult {
  stateId: string;
  stateName: string;
  isActive: boolean;
  issues: string[];
  warnings: string[];
  stats: {
    templates: number;
    complianceCards: number;
    communicationTemplates: number;
    legalUpdates: number;
  };
}

interface VerificationReport {
  timestamp: string;
  totalStates: number;
  activeStates: number;
  statesWithIssues: number;
  statesWithWarnings: number;
  results: VerificationResult[];
}

const REQUIRED_TEMPLATE_TYPES = [
  'lease',
  'application',
  'adverse_action',
  'move_in_checklist',
  'move_out_checklist',
  'late_rent_notice',
  'lease_violation_notice',
  'eviction_notice',
  'security_deposit_return',
];

const REQUIRED_COMPLIANCE_CATEGORIES = [
  'Security Deposit',
  'Eviction',
  'Lease Disclosures',
  'Entry Notice',
  'Fair Housing',
];

const REQUIRED_COMMUNICATION_TYPES = [
  'welcome_letter',
  'rent_reminder',
  'lease_renewal',
  'maintenance_response',
  'late_rent_notice',
];

async function verifyState(stateId: string): Promise<VerificationResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  const stateRow = await db
    .select()
    .from(states)
    .where(eq(states.id, stateId))
    .limit(1);

  if (stateRow.length === 0) {
    return {
      stateId,
      stateName: 'NOT FOUND',
      isActive: false,
      issues: [`State ${stateId} does not exist in the states table`],
      warnings: [],
      stats: { templates: 0, complianceCards: 0, communicationTemplates: 0, legalUpdates: 0 },
    };
  }

  const state = stateRow[0];

  const stateTemplates = await db
    .select()
    .from(templates)
    .where(and(eq(templates.stateId, stateId), eq(templates.isActive, true)));

  const templateTypes = new Set(stateTemplates.map(t => t.templateType));
  for (const requiredType of REQUIRED_TEMPLATE_TYPES) {
    if (!templateTypes.has(requiredType as typeof stateTemplates[0]['templateType'])) {
      issues.push(`Missing required template type: ${requiredType}`);
    }
  }

  const templatesWithoutKey = stateTemplates.filter(t => !t.key);
  if (templatesWithoutKey.length > 0) {
    issues.push(`${templatesWithoutKey.length} templates missing canonical key`);
  }

  const stateComplianceCards = await db
    .select()
    .from(complianceCards)
    .where(eq(complianceCards.stateId, stateId));

  const complianceTitles = stateComplianceCards.map(c => c.title.toLowerCase());
  for (const requiredCategory of REQUIRED_COMPLIANCE_CATEGORIES) {
    const found = complianceTitles.some(title => 
      title.includes(requiredCategory.toLowerCase())
    );
    if (!found) {
      warnings.push(`Missing compliance card for: ${requiredCategory}`);
    }
  }

  const cardsWithoutKey = stateComplianceCards.filter(c => !c.key);
  if (cardsWithoutKey.length > 0) {
    issues.push(`${cardsWithoutKey.length} compliance cards missing canonical key`);
  }

  const stateCommTemplates = await db
    .select()
    .from(communicationTemplates)
    .where(and(eq(communicationTemplates.stateId, stateId), eq(communicationTemplates.isActive, true)));

  const commTypes = new Set(stateCommTemplates.map(t => t.templateType));
  for (const requiredType of REQUIRED_COMMUNICATION_TYPES) {
    if (!commTypes.has(requiredType as typeof stateCommTemplates[0]['templateType'])) {
      warnings.push(`Missing communication template type: ${requiredType}`);
    }
  }

  const commWithoutKey = stateCommTemplates.filter(t => !t.key);
  if (commWithoutKey.length > 0) {
    issues.push(`${commWithoutKey.length} communication templates missing canonical key`);
  }

  const stateLegalUpdates = await db
    .select()
    .from(legalUpdates)
    .where(eq(legalUpdates.stateId, stateId));

  if (stateLegalUpdates.length === 0) {
    warnings.push('No legal updates seeded for this state');
  }

  if (!state.isActive) {
    warnings.push('State is not marked as active');
  }

  return {
    stateId,
    stateName: state.name,
    isActive: state.isActive ?? false,
    issues,
    warnings,
    stats: {
      templates: stateTemplates.length,
      complianceCards: stateComplianceCards.length,
      communicationTemplates: stateCommTemplates.length,
      legalUpdates: stateLegalUpdates.length,
    },
  };
}

export async function verifyAllStates(): Promise<VerificationReport> {
  const allStates = await db.select().from(states);

  const results: VerificationResult[] = [];

  for (const state of allStates) {
    const result = await verifyState(state.id);
    results.push(result);
  }

  const statesWithIssues = results.filter(r => r.issues.length > 0).length;
  const statesWithWarnings = results.filter(r => r.warnings.length > 0).length;
  const activeStates = results.filter(r => r.isActive).length;

  return {
    timestamp: new Date().toISOString(),
    totalStates: allStates.length,
    activeStates,
    statesWithIssues,
    statesWithWarnings,
    results,
  };
}

export async function verifySingleState(stateId: string): Promise<VerificationResult> {
  return verifyState(stateId);
}

function formatReport(report: VerificationReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('STATE SETUP VERIFICATION REPORT');
  lines.push(`Generated: ${report.timestamp}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Total States: ${report.totalStates}`);
  lines.push(`Active States: ${report.activeStates}`);
  lines.push(`States with Issues: ${report.statesWithIssues}`);
  lines.push(`States with Warnings: ${report.statesWithWarnings}`);
  lines.push('');

  for (const result of report.results) {
    const statusIcon = result.issues.length > 0 ? 'X' : result.warnings.length > 0 ? '!' : 'v';
    const activeLabel = result.isActive ? '[ACTIVE]' : '[INACTIVE]';

    lines.push('-'.repeat(60));
    lines.push(`[${statusIcon}] ${result.stateId} - ${result.stateName} ${activeLabel}`);
    lines.push(`    Templates: ${result.stats.templates} | Compliance: ${result.stats.complianceCards} | Communications: ${result.stats.communicationTemplates} | Legal Updates: ${result.stats.legalUpdates}`);

    if (result.issues.length > 0) {
      lines.push('    ISSUES:');
      for (const issue of result.issues) {
        lines.push(`      - ${issue}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('    WARNINGS:');
      for (const warning of result.warnings) {
        lines.push(`      - ${warning}`);
      }
    }
  }

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('Legend: [v] = OK, [!] = Warnings, [X] = Issues');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

async function main() {
  const targetState = process.argv[2];

  try {
    if (targetState) {
      console.log(`Verifying state: ${targetState}\n`);
      const result = await verifySingleState(targetState.toUpperCase());

      if (result.stateName === 'NOT FOUND') {
        console.error(`State ${targetState} not found in database`);
        process.exit(1);
      }

      const report: VerificationReport = {
        timestamp: new Date().toISOString(),
        totalStates: 1,
        activeStates: result.isActive ? 1 : 0,
        statesWithIssues: result.issues.length > 0 ? 1 : 0,
        statesWithWarnings: result.warnings.length > 0 ? 1 : 0,
        results: [result],
      };

      console.log(formatReport(report));

      if (result.issues.length > 0) {
        process.exit(1);
      }
    } else {
      console.log('Verifying all states...\n');
      const report = await verifyAllStates();
      console.log(formatReport(report));

      if (report.statesWithIssues > 0) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

main();
