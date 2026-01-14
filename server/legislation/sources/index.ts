/**
 * Legislative Sources Module
 * 
 * Exports all types, registry functions, and adapters.
 * 
 * To add a new source:
 * 1. Create adapter file in ./adapters/
 * 2. Import it here (auto-registers via registerAdapter call in adapter)
 */

export * from "./types";
export * from "./registry";

import "./adapters/federalRegisterAdapter";
import "./adapters/legiscanAdapter";
import "./adapters/pluralPolicyAdapter";
import "./adapters/courtListenerAdapter";
import "./adapters/utahGlenAdapter";
import "./adapters/ecfrAdapter";
import "./adapters/hudOnapAdapter";
import "./adapters/congressGovAdapter";

export { federalRegisterAdapter } from "./adapters/federalRegisterAdapter";
export { legiscanAdapter } from "./adapters/legiscanAdapter";
export { pluralPolicyAdapter } from "./adapters/pluralPolicyAdapter";
export { courtListenerAdapter } from "./adapters/courtListenerAdapter";
export { utahGlenAdapter } from "./adapters/utahGlenAdapter";
export { ecfrAdapter } from "./adapters/ecfrAdapter";
export { hudOnapAdapter } from "./adapters/hudOnapAdapter";
export { congressGovAdapter } from "./adapters/congressGovAdapter";
