import type { Position } from "../portfolio/book.js";

export interface Scenario {
  readonly name: string;
  readonly markChangePct: number;
  readonly fundingRate: number;
  readonly hours: number;
}

export interface ScenarioResult {
  readonly name: string;
  readonly endingMark: number;
  readonly pricePnlUsd: number;
  readonly fundingPnlUsd: number;
  readonly totalPnlUsd: number;
  readonly marginRequiredUsd: number;
}

export const standardScenarios: Scenario[] = [
  { name: "moderate rally", markChangePct: 0.05, fundingRate: 0.0001, hours: 8 },
  { name: "moderate selloff", markChangePct: -0.05, fundingRate: -0.0001, hours: 8 },
  { name: "gap higher", markChangePct: 0.15, fundingRate: 0.0005, hours: 1 },
  { name: "gap lower", markChangePct: -0.15, fundingRate: -0.0005, hours: 1 },
  { name: "funding squeeze", markChangePct: 0, fundingRate: 0.001, hours: 12 },
];

export function evaluateScenario(position: Position, mark: number, scenario: Scenario, maintenanceMarginPct = 0.1): ScenarioResult {
  const endingMark = mark * (1 + scenario.markChangePct);
  const pricePnlUsd = position.quantity * (endingMark - mark);
  const fundingPnlUsd = -position.quantity * endingMark * scenario.fundingRate * scenario.hours;
  return {
    name: scenario.name, endingMark, pricePnlUsd, fundingPnlUsd,
    totalPnlUsd: pricePnlUsd + fundingPnlUsd,
    marginRequiredUsd: Math.abs(position.quantity) * endingMark * maintenanceMarginPct,
  };
}

export function worstCase(position: Position, mark: number, scenarios = standardScenarios): ScenarioResult | undefined {
  return scenarios.map((scenario) => evaluateScenario(position, mark, scenario)).sort((left, right) => left.totalPnlUsd - right.totalPnlUsd)[0];
}

export function liquidationBuffer(equityUsd: number, scenario: ScenarioResult): number {
  return equityUsd + scenario.totalPnlUsd - scenario.marginRequiredUsd;
}

export function permittedLeverage(equityUsd: number, worstLossPct: number, safetyMultiplier = 2): number {
  if (equityUsd <= 0 || worstLossPct <= 0) return 0;
  return 1 / (worstLossPct * safetyMultiplier);
}

export function correlationAdjustedRisk(positions: Array<{ notionalUsd: number; volatility: number }>, correlation: number): number {
  if (positions.length === 0) return 0;
  const individualVariance = positions.reduce((sum, item) => sum + (item.notionalUsd * item.volatility) ** 2, 0);
  const crossVariance = positions.flatMap((left, index) => positions.slice(index + 1).map((right) => 2 * correlation * left.notionalUsd * left.volatility * right.notionalUsd * right.volatility)).reduce((sum, value) => sum + value, 0);
  return Math.sqrt(Math.max(0, individualVariance + crossVariance));
}
