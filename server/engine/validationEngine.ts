import type { HydratedFormDefinition } from "./matrixResolver";

export type ValidationError = {
  fieldKey: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export function validateInputs(
  def: HydratedFormDefinition,
  inputs: Record<string, string | number | boolean>,
  gateAnswers: Record<string, string | number | boolean>,
  serviceSelection: Record<string, boolean>,
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const field of def.fields) {
    if (!isFieldVisible(field, gateAnswers, inputs)) continue;

    const value = inputs[field.key];

    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({ fieldKey: field.key, message: `${field.label} is required` });
      continue;
    }

    if (value === undefined || value === null || value === '') continue;

    for (const validation of field.validations) {
      const error = runValidation(field.key, field.label, value, validation);
      if (error) errors.push(error);
    }
  }

  for (const gate of def.leaseGates) {
    if (gate.required && (gateAnswers[gate.gateKey] === undefined || gateAnswers[gate.gateKey] === null)) {
      errors.push({ fieldKey: gate.gateKey, message: `${gate.promptText} is required` });
    }
  }

  const serviceErrors = validateServiceSelection(def, serviceSelection, gateAnswers);
  errors.push(...serviceErrors);

  return { valid: errors.length === 0, errors };
}

function isFieldVisible(
  field: HydratedFormDefinition['fields'][0],
  gateAnswers: Record<string, string | number | boolean>,
  inputs: Record<string, string | number | boolean>,
): boolean {
  if (!field.visibilityRule) return true;

  const rule = field.visibilityRule;
  if (typeof rule !== 'object') return true;

  if (rule.gateKey && rule.gateValue !== undefined) {
    return gateAnswers[rule.gateKey] === rule.gateValue;
  }

  if (rule.fieldKey && rule.fieldValue !== undefined) {
    return inputs[rule.fieldKey] === rule.fieldValue;
  }

  if (rule.gateKey && rule.operator === 'truthy') {
    return !!gateAnswers[rule.gateKey];
  }

  return true;
}

function runValidation(
  fieldKey: string,
  fieldLabel: string,
  value: string | number | boolean,
  validation: { validationType: string; params: any; errorMessage: string },
): ValidationError | null {
  const strVal = String(value);

  switch (validation.validationType) {
    case 'regex': {
      const pattern = validation.params?.pattern;
      if (pattern && !new RegExp(pattern).test(strVal)) {
        return { fieldKey, message: validation.errorMessage };
      }
      break;
    }
    case 'min': {
      const min = validation.params?.value;
      if (min !== undefined && Number(value) < min) {
        return { fieldKey, message: validation.errorMessage };
      }
      break;
    }
    case 'max': {
      const max = validation.params?.value;
      if (max !== undefined && Number(value) > max) {
        return { fieldKey, message: validation.errorMessage };
      }
      break;
    }
    case 'disallow_tokens': {
      const tokens = validation.params?.tokens;
      if (Array.isArray(tokens)) {
        const lower = strVal.toLowerCase();
        for (const token of tokens) {
          if (lower.includes(token.toLowerCase())) {
            return { fieldKey, message: validation.errorMessage };
          }
        }
      }
      break;
    }
    case 'required_if': {
      const condition = validation.params;
      if (condition?.fieldKey && condition?.fieldValue !== undefined) {
        break;
      }
      break;
    }
    case 'custom_rule': {
      const ruleName = validation.params?.rule;
      if (ruleName === 'money_positive' && Number(value) <= 0) {
        return { fieldKey, message: validation.errorMessage };
      }
      if (ruleName === 'date_not_past') {
        const d = new Date(strVal);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (d < today) {
          return { fieldKey, message: validation.errorMessage };
        }
      }
      break;
    }
  }
  return null;
}

function validateServiceSelection(
  def: HydratedFormDefinition,
  serviceSelection: Record<string, boolean>,
  gateAnswers: Record<string, string | number | boolean>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const allowedRules = def.serviceRules.filter(r => r.isAllowed);

  const selectedMethodIds = Object.entries(serviceSelection)
    .filter(([_, selected]) => selected)
    .map(([methodId]) => methodId);

  if (allowedRules.length > 0 && selectedMethodIds.length === 0) {
    errors.push({ fieldKey: 'service_selection', message: 'At least one service method must be selected' });
    return errors;
  }

  for (const methodId of selectedMethodIds) {
    const rule = def.serviceRules.find(r => r.methodId === methodId);
    if (!rule) {
      errors.push({ fieldKey: `service_${methodId}`, message: 'Service method not found in rules' });
      continue;
    }
    if (!rule.isAllowed) {
      errors.push({ fieldKey: `service_${methodId}`, message: `${rule.methodDisplayName} is not allowed for this form` });
      continue;
    }

    if (rule.requiresPriorAttempts && rule.priorAttemptMethodIds.length > 0) {
      const hasAllPrior = rule.priorAttemptMethodIds.every(id => selectedMethodIds.includes(id));
      if (!hasAllPrior) {
        const priorNames = rule.priorAttemptMethodIds
          .map(id => def.serviceRules.find(r => r.methodId === id)?.methodDisplayName || id)
          .join(', ');
        errors.push({
          fieldKey: `service_${methodId}`,
          message: `${rule.methodDisplayName} requires prior attempts of: ${priorNames}`,
        });
      }
    }

    if (rule.requiresAdditionalMethods && rule.additionalMethodIds.length > 0) {
      const hasAllAdditional = rule.additionalMethodIds.every(id => selectedMethodIds.includes(id));
      if (!hasAllAdditional) {
        const additionalNames = rule.additionalMethodIds
          .map(id => def.serviceRules.find(r => r.methodId === id)?.methodDisplayName || id)
          .join(', ');
        errors.push({
          fieldKey: `service_${methodId}`,
          message: `${rule.methodDisplayName} also requires: ${additionalNames}`,
        });
      }
    }
  }

  return errors;
}
