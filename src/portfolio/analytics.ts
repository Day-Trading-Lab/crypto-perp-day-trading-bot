import type { Position } from "./book.js";

export interface TradeOutcome {
  readonly openedAt: Date;
  readonly closedAt: Date;
  readonly pnlUsd: number;
  readonly riskUsd: number;
}

export function exposureUsd(position: Position, mark: number): number {
  return Math.abs(position.quantity) * mark;
}

export function netPnl(position: Position, mark: number): number {
  return position.realizedPnlUsd + position.fundingUsd + position.quantity * (mark - position.averageEntry);
}

export function rMultiple(outcome: TradeOutcome): number {
  return outcome.riskUsd <= 0 ? 0 : outcome.pnlUsd / outcome.riskUsd;
}

export function winRate(outcomes: TradeOutcome[]): number {
  if (outcomes.length === 0) return 0;
  return outcomes.filter((outcome) => outcome.pnlUsd > 0).length / outcomes.length;
}

export function profitFactor(outcomes: TradeOutcome[]): number {
  const gains = outcomes.filter((outcome) => outcome.pnlUsd > 0).reduce((sum, outcome) => sum + outcome.pnlUsd, 0);
  const losses = Math.abs(outcomes.filter((outcome) => outcome.pnlUsd < 0).reduce((sum, outcome) => sum + outcome.pnlUsd, 0));
  return losses === 0 ? (gains > 0 ? Infinity : 0) : gains / losses;
}

export function maxDrawdown(equityCurve: number[]): number {
  let highWater = -Infinity;
  let largest = 0;
  for (const equity of equityCurve) {
    highWater = Math.max(highWater, equity);
    if (highWater > 0) largest = Math.max(largest, (highWater - equity) / highWater);
  }
  return largest;
}

export function summarize(outcomes: TradeOutcome[], equityCurve: number[]): Record<string, number> {
  const pnl = outcomes.reduce((sum, outcome) => sum + outcome.pnlUsd, 0);
  const averageR = outcomes.length === 0 ? 0 : outcomes.reduce((sum, outcome) => sum + rMultiple(outcome), 0) / outcomes.length;
  return { trades: outcomes.length, pnlUsd: pnl, winRate: winRate(outcomes), profitFactor: profitFactor(outcomes), averageR, maxDrawdown: maxDrawdown(equityCurve) };
}
