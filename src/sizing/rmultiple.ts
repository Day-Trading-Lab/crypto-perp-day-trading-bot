import type { TradingSignal } from "../signals/strategy.js";

export interface PositionPlan {
  readonly quantity: number;
  readonly notionalUsd: number;
  readonly riskUsd: number;
  readonly rewardRisk: number;
  readonly rejected?: string;
}

export function calculateRMultiple(signal: TradingSignal): number {
  const risk = Math.abs(signal.entry - signal.stop);
  const reward = Math.abs(signal.target - signal.entry);
  return risk === 0 ? 0 : reward / risk;
}

export function sizePosition(
  signal: TradingSignal,
  equityUsd: number,
  riskPerTradePct: number,
  maxPositionUsd: number,
): PositionPlan {
  if (signal.side === "flat") return { quantity: 0, notionalUsd: 0, riskUsd: 0, rewardRisk: 0, rejected: "flat signal" };
  const stopDistance = Math.abs(signal.entry - signal.stop);
  if (!Number.isFinite(stopDistance) || stopDistance <= 0) {
    return { quantity: 0, notionalUsd: 0, riskUsd: 0, rewardRisk: 0, rejected: "invalid stop distance" };
  }
  const requestedRisk = equityUsd * riskPerTradePct * signal.confidence;
  const unboundedQuantity = requestedRisk / stopDistance;
  const quantityCap = maxPositionUsd / signal.entry;
  const quantity = Math.min(unboundedQuantity, quantityCap);
  const notionalUsd = quantity * signal.entry;
  return {
    quantity: Number(quantity.toFixed(6)),
    notionalUsd: Number(notionalUsd.toFixed(2)),
    riskUsd: Number((quantity * stopDistance).toFixed(2)),
    rewardRisk: Number(calculateRMultiple(signal).toFixed(2)),
    rejected: quantity <= 0 ? "zero calculated quantity" : undefined,
  };
}

export function roundLot(quantity: number, lotSize = 0.001): number {
  if (quantity <= 0 || lotSize <= 0) return 0;
  return Math.floor(quantity / lotSize) * lotSize;
}
