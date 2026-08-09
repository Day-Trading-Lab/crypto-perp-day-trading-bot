export interface RiskState {
  readonly realizedPnlUsd: number;
  readonly peakEquityUsd: number;
  readonly tradesToday: number;
  readonly halted: boolean;
  readonly reasons: string[];
}

export interface RiskLimits {
  readonly maxDailyLossUsd: number;
  readonly maxTradesPerDay: number;
  readonly maxDrawdownPct: number;
}

export function initialRiskState(equityUsd: number): RiskState {
  return { realizedPnlUsd: 0, peakEquityUsd: equityUsd, tradesToday: 0, halted: false, reasons: [] };
}

export function assessTrade(
  state: RiskState,
  limits: RiskLimits,
  equityUsd: number,
  proposedRiskUsd: number,
): { allowed: boolean; reason?: string } {
  if (state.halted) return { allowed: false, reason: state.reasons.join("; ") };
  if (state.tradesToday >= limits.maxTradesPerDay) return { allowed: false, reason: "daily trade limit reached" };
  if (state.realizedPnlUsd - proposedRiskUsd <= -limits.maxDailyLossUsd) return { allowed: false, reason: "daily loss limit would be breached" };
  const drawdown = 1 - equityUsd / Math.max(state.peakEquityUsd, 1);
  if (drawdown >= limits.maxDrawdownPct) return { allowed: false, reason: "drawdown circuit breaker" };
  return { allowed: true };
}

export function recordTrade(state: RiskState, pnlUsd: number, equityUsd: number, limits: RiskLimits): RiskState {
  const realizedPnlUsd = state.realizedPnlUsd + pnlUsd;
  const peakEquityUsd = Math.max(state.peakEquityUsd, equityUsd);
  const reasons: string[] = [];
  if (realizedPnlUsd <= -limits.maxDailyLossUsd) reasons.push("daily loss limit reached");
  if (1 - equityUsd / peakEquityUsd >= limits.maxDrawdownPct) reasons.push("drawdown circuit breaker");
  return { realizedPnlUsd, peakEquityUsd, tradesToday: state.tradesToday + 1, halted: reasons.length > 0, reasons };
}
