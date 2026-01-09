import { db } from '../db';
import { states } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import memoizee from 'memoizee';

export type ActiveState = {
  id: string;
  name: string;
};

async function fetchActiveStates(): Promise<ActiveState[]> {
  const result = await db
    .select({ id: states.id, name: states.name })
    .from(states)
    .where(eq(states.isActive, true));
  return result;
}

export const getActiveStates = memoizee(fetchActiveStates, {
  maxAge: 5 * 60 * 1000,
  promise: true,
});

export async function getActiveStateIds(): Promise<string[]> {
  const activeStates = await getActiveStates();
  return activeStates.map((s) => s.id);
}

export async function isValidStateId(stateId: string): Promise<boolean> {
  const activeIds = await getActiveStateIds();
  return activeIds.includes(stateId);
}

export function clearStateCache(): void {
  getActiveStates.clear();
}
