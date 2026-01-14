import { db } from '../db';
import { states } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import memoizee from 'memoizee';

async function fetchStateNames(): Promise<Record<string, string>> {
  const result = await db
    .select({ id: states.id, name: states.name })
    .from(states);
  return Object.fromEntries(result.map((s) => [s.id, s.name]));
}

const getCachedStateNames = memoizee(fetchStateNames, {
  maxAge: 5 * 60 * 1000,
  promise: true,
});

export async function getStateName(stateId: string): Promise<string> {
  const names = await getCachedStateNames();
  return names[stateId] || stateId;
}

export async function getStateNames(): Promise<Record<string, string>> {
  return getCachedStateNames();
}

export function clearStateNameCache(): void {
  getCachedStateNames.clear();
}
