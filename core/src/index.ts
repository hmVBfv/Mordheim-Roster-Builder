/* @mordheim/core — shared rules and campaign logic.
   No DOM, no Node APIs, no globals: every function takes what it needs.
   Node-only helpers (loading data from disk) are in "@mordheim/core/node". */
export * from './data/types.ts';
export { createGameData } from './data/gameData.ts';
export * from './state/types.ts';
export * from './state/house.ts';
export * from './rules/context.ts';
export * from './rules/lookup.ts';
export * from './rules/districts.ts';
export * from './rules/pricing.ts';
export * from './rules/hire.ts';
export * from './rules/equipment.ts';
export * from './rules/costs.ts';
export * from './rules/worth.ts';
export * from './rules/saves.ts';
