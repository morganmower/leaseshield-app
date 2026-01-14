/**
 * Source Registry
 * 
 * Central registry for all legislative data source adapters.
 * To add a new source:
 * 1. Create the adapter file (e.g., newSourceAdapter.ts)
 * 2. Import and add to SOURCE_REGISTRY array
 * That's it.
 */

import { LegislationSourceAdapter, SourceId } from "./types";

const adapters: Map<SourceId, LegislationSourceAdapter> = new Map();

export function registerAdapter(adapter: LegislationSourceAdapter): void {
  if (adapters.has(adapter.id)) {
    console.warn(`Adapter ${adapter.id} already registered, replacing...`);
  }
  adapters.set(adapter.id, adapter);
}

export function getAdapter(id: SourceId): LegislationSourceAdapter | undefined {
  return adapters.get(id);
}

export function getAllAdapters(): LegislationSourceAdapter[] {
  return Array.from(adapters.values());
}

export function getEnabledAdapters(enabledIds: SourceId[]): LegislationSourceAdapter[] {
  return enabledIds
    .map(id => adapters.get(id))
    .filter((a): a is LegislationSourceAdapter => a !== undefined);
}

export async function getAvailableAdapters(): Promise<LegislationSourceAdapter[]> {
  const all = getAllAdapters();
  const available: LegislationSourceAdapter[] = [];
  
  for (const adapter of all) {
    try {
      if (await adapter.isAvailable()) {
        available.push(adapter);
      }
    } catch {
      console.warn(`Adapter ${adapter.id} availability check failed`);
    }
  }
  
  return available;
}
