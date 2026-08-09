import type { MarketSnapshot } from "../marketdata/hyperliquid.js";

export type SignalSide = "long" | "short" | "flat";
export interface TradingSignal {
  readonly side: SignalSide;
  readonly reason: string;
  readonly entry: number;
  readonly stop: number;
  readonly target: number;
  readonly confidence: number;
}

function range(values: number[]): { high: number; low: number } {
  return { high: Math.max(...values), low: Math.min(...values) };
}

export function breakoutSignal(snapshot: MarketSnapshot, lookback: number): TradingSignal {
  const history = snapshot.candles.slice(-(lookback + 1), -1);
  if (history.length < lookback) return { side: "flat", reason: "insufficient candles", entry: snapshot.mid, stop: snapshot.mid, target: snapshot.mid, confidence: 0 };
  const bounds = range(history.map((candle) => candle.high));
  const lows = range(history.map((candle) => candle.low));
  const unit = Math.max(snapshot.mid * 0.003, (bounds.high - lows.low) * 0.25);
  if (snapshot.mid > bounds.high) {
    return { side: "long", reason: "hourly range breakout", entry: snapshot.mid, stop: snapshot.mid - unit, target: snapshot.mid + unit * 2, confidence: 0.7 };
  }
  if (snapshot.mid < lows.low) {
    return { side: "short", reason: "hourly range breakdown", entry: snapshot.mid, stop: snapshot.mid + unit, target: snapshot.mid - unit * 2, confidence: 0.7 };
  }
  return { side: "flat", reason: "inside breakout range", entry: snapshot.mid, stop: snapshot.mid, target: snapshot.mid, confidence: 0 };
}

export function fundingFadeSignal(snapshot: MarketSnapshot, threshold: number): TradingSignal {
  const unit = snapshot.mid * 0.004;
  if (snapshot.fundingRate >= threshold) {
    return { side: "short", reason: "crowded-long funding fade", entry: snapshot.mid, stop: snapshot.mid + unit, target: snapshot.mid - unit * 1.5, confidence: 0.55 };
  }
  if (snapshot.fundingRate <= -threshold) {
    return { side: "long", reason: "crowded-short funding fade", entry: snapshot.mid, stop: snapshot.mid - unit, target: snapshot.mid + unit * 1.5, confidence: 0.55 };
  }
  return { side: "flat", reason: "funding neutral", entry: snapshot.mid, stop: snapshot.mid, target: snapshot.mid, confidence: 0 };
}

export function combineSignals(breakout: TradingSignal, fade: TradingSignal): TradingSignal {
  if (breakout.side === "flat") return fade;
  if (fade.side === "flat" || fade.side === breakout.side) return breakout;
  return { side: "flat", reason: "strategy disagreement", entry: breakout.entry, stop: breakout.entry, target: breakout.entry, confidence: 0 };
}
