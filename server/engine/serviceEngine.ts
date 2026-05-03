import type { HydratedFormDefinition } from "./matrixResolver";

export type AvailableServiceMethod = {
  methodId: string;
  methodKey: string;
  displayName: string;
  isAllowed: boolean;
  requiresPriorAttempts: boolean;
  priorAttemptMethodNames: string[];
  requiresAdditionalMethods: boolean;
  additionalMethodNames: string[];
  requiresAck: boolean;
  ackText: string | null;
  isLockedByGate: boolean;
  lockReason: string | null;
};

export function resolveServiceMethods(
  def: HydratedFormDefinition,
  gateAnswers: Record<string, string | number | boolean>,
): AvailableServiceMethod[] {
  return def.serviceRules.map(rule => {
    let isLockedByGate = false;
    let lockReason: string | null = null;

    for (const gate of def.leaseGates) {
      if (!gate.affectsServiceMethods) continue;
      if (!gate.affectedMethodIds.includes(rule.methodId)) continue;

      const answer = gateAnswers[gate.gateKey];
      if (gate.type === 'boolean' && answer !== true) {
        isLockedByGate = true;
        lockReason = `Requires: ${gate.promptText}`;
      }
    }

    const priorNames = rule.priorAttemptMethodIds
      .map(id => def.serviceRules.find(r => r.methodId === id)?.methodDisplayName || id);
    const additionalNames = rule.additionalMethodIds
      .map(id => def.serviceRules.find(r => r.methodId === id)?.methodDisplayName || id);

    return {
      methodId: rule.methodId,
      methodKey: rule.methodKey,
      displayName: rule.methodDisplayName,
      isAllowed: rule.isAllowed && !isLockedByGate,
      requiresPriorAttempts: rule.requiresPriorAttempts,
      priorAttemptMethodNames: priorNames,
      requiresAdditionalMethods: rule.requiresAdditionalMethods,
      additionalMethodNames: additionalNames,
      requiresAck: rule.requiresAck,
      ackText: rule.ackText,
      isLockedByGate,
      lockReason,
    };
  });
}

export function enforceServiceHierarchy(
  def: HydratedFormDefinition,
  selectedMethodIds: string[],
): { valid: boolean; autoSelected: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const autoSelected = [...selectedMethodIds];

  for (const methodId of selectedMethodIds) {
    const rule = def.serviceRules.find(r => r.methodId === methodId);
    if (!rule) continue;

    if (rule.requiresAdditionalMethods) {
      for (const addId of rule.additionalMethodIds) {
        if (!autoSelected.includes(addId)) {
          autoSelected.push(addId);
          const addName = def.serviceRules.find(r => r.methodId === addId)?.methodDisplayName || addId;
          warnings.push(`${rule.methodDisplayName} requires ${addName} - automatically added`);
        }
      }
    }
  }

  return { valid: true, autoSelected, warnings };
}
