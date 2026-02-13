/**
 * Jurisdiction Resolution Service
 * 
 * Resolves property location to the appropriate jurisdiction chain for denial rules.
 * Resolution order (most specific wins): City > County > State > Federal
 */

import { db } from '../db';
import { cities, counties, properties } from '../../shared/schema';
import { eq, and, ilike } from 'drizzle-orm';

export interface ResolvedJurisdiction {
  stateId: string;
  cityId: string | null;
  cityName: string | null;
  countyId: string | null;
  countyName: string | null;
  hasLocalRules: boolean;
  ruleVersion: string;
}

export interface JurisdictionWarning {
  type: 'local_rules' | 'criminal_blocked' | 'voucher_blocked' | 'conditional_steps';
  message: string;
  jurisdictionName: string;
}

/**
 * Resolve jurisdiction from property ID
 */
export async function resolveJurisdictionFromProperty(propertyId: string): Promise<ResolvedJurisdiction | null> {
  const propertyResult = await db.select().from(properties).where(eq(properties.id, propertyId));
  if (propertyResult.length === 0) return null;
  
  const property = propertyResult[0];
  if (!property.state) return null;
  
  return resolveJurisdictionFromLocation(
    property.state,
    property.city || undefined,
    property.county || undefined
  );
}

/**
 * Resolve jurisdiction from location components
 */
export async function resolveJurisdictionFromLocation(
  stateId: string,
  cityName?: string,
  countyName?: string
): Promise<ResolvedJurisdiction> {
  let cityId: string | null = null;
  let resolvedCityName: string | null = null;
  let countyId: string | null = null;
  let resolvedCountyName: string | null = null;
  let hasLocalRules = false;

  // Try to match city (case-insensitive)
  if (cityName) {
    const cityMatches = await db.select().from(cities)
      .where(and(
        eq(cities.stateId, stateId),
        ilike(cities.name, cityName.trim()),
        eq(cities.isActive, true)
      ));
    
    if (cityMatches.length > 0) {
      cityId = cityMatches[0].id;
      resolvedCityName = cityMatches[0].name;
      hasLocalRules = true;
    }
  }

  // Try to match county (case-insensitive)
  if (countyName) {
    // Normalize county name - handle "Cook County" vs "Cook"
    const normalizedCounty = countyName.replace(/ County$/i, '').trim();
    const countyMatches = await db.select().from(counties)
      .where(and(
        eq(counties.stateId, stateId),
        eq(counties.isActive, true)
      ));
    
    // Check for match with or without "County" suffix
    const match = countyMatches.find(c => 
      c.name.toLowerCase() === countyName.toLowerCase() ||
      c.name.toLowerCase() === normalizedCounty.toLowerCase() ||
      c.name.toLowerCase() === normalizedCounty.toLowerCase() + ' county'
    );
    
    if (match) {
      countyId = match.id;
      resolvedCountyName = match.name;
      hasLocalRules = true;
    }
  }

  // Generate rule version hash based on jurisdiction chain
  const ruleVersion = generateRuleVersion(stateId, cityId, countyId);

  return {
    stateId,
    cityId,
    cityName: resolvedCityName,
    countyId,
    countyName: resolvedCountyName,
    hasLocalRules,
    ruleVersion,
  };
}

/**
 * Get all known jurisdictions for dropdown fallback
 */
export async function getAllKnownJurisdictions(stateId?: string): Promise<{
  cities: Array<{ id: string; name: string; stateId: string }>;
  counties: Array<{ id: string; name: string; stateId: string }>;
}> {
  const cityQuery = stateId 
    ? db.select().from(cities).where(and(eq(cities.isActive, true), eq(cities.stateId, stateId)))
    : db.select().from(cities).where(eq(cities.isActive, true));
  
  const countyQuery = stateId
    ? db.select().from(counties).where(and(eq(counties.isActive, true), eq(counties.stateId, stateId)))
    : db.select().from(counties).where(eq(counties.isActive, true));

  const [cityResults, countyResults] = await Promise.all([
    cityQuery.orderBy(cities.name),
    countyQuery.orderBy(counties.name)
  ]);

  return {
    cities: cityResults.map(c => ({ id: c.id, name: c.name, stateId: c.stateId })),
    counties: countyResults.map(c => ({ id: c.id, name: c.name, stateId: c.stateId })),
  };
}

/**
 * Calculate specificity score for rule resolution
 * Higher score = more specific rule takes precedence
 */
export function calculateRuleSpecificity(rule: { 
  cityId: string | null; 
  countyId: string | null; 
  stateId: string | null;
}): number {
  let score = 0;
  if (rule.cityId) score += 4;      // City-level is most specific
  if (rule.countyId) score += 2;    // County-level is next
  if (rule.stateId) score += 1;     // State-level is baseline
  return score;
}

/**
 * Generate a version hash for the current ruleset
 */
function generateRuleVersion(stateId: string, cityId: string | null, countyId: string | null): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const jurisdictionPart = [stateId, cityId?.slice(0, 8), countyId?.slice(0, 8)]
    .filter(Boolean)
    .join('-');
  return `v1.${datePart}.${jurisdictionPart}`;
}
