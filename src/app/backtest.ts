import type { MarketSnapshot } from "../marketdata/hyperliquid.js";
import type { TradingSignal } from "../signals/strategy.js";
import { breakoutSignal, fundingFadeSignal, combineSignals } from "../signals/strategy.js";
import { sizePosition } from "../sizing/rmultiple.js";

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  side: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnlUsd: number;
  feesUsd: number;
  netPnlUsd: number;
  exitReason: string;
}

export interface BacktestReport {
  trades: BacktestTrade[];
  equityCurve: number[];
  startingEquityUsd: number;
  endingEquityUsd: number;
  maximumDrawdownPct: number;
  sharpeLike: number;
}

interface OpenTrade {
  signal: TradingSignal;
  entryTime: number;
  quantity: number;
}

function snapshotAt(source: MarketSnapshot, end: number): MarketSnapshot {
  const candles = source.candles.slice(0, end);
  return { ...source, candles, mid: candles.at(-1)!.close };
}

function exitPrice(trade: OpenTrade, candle: { high: number; low: number; close: number }): { price?: number; reason?: string } {
  if (trade.signal.side === "long") {
    if (candle.low <= trade.signal.stop) return { price: trade.signal.stop, reason: "stop" };
    if (candle.high >= trade.signal.target) return { price: trade.signal.target, reason: "target" };
  }
  if (trade.signal.side === "short") {
    if (candle.high >= trade.signal.stop) return { price: trade.signal.stop, reason: "stop" };
    if (candle.low <= trade.signal.target) return { price: trade.signal.target, reason: "target" };
  }
  return {};
}

function pnl(open: OpenTrade, exit: number): number {
  const direction = open.signal.side === "long" ? 1 : -1;
  return direction * open.quantity * (exit - open.signal.entry);
}

export function maximumDrawdown(equity: number[]): number {
  let high = equity[0] ?? 0;
  let drawdown = 0;
  for (const value of equity) {
    high = Math.max(high, value);
    drawdown = Math.max(drawdown, high === 0 ? 0 : (high - value) / high);
  }
  return drawdown;
}

export function sharpeLike(equity: number[]): number {
  if (equity.length < 3) return 0;
  const returns = equity.slice(1).map((value, index) => value / equity[index] - 1);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  return variance === 0 ? 0 : mean / Math.sqrt(variance) * Math.sqrt(365 * 24);
}

export function backtest(
  source: MarketSnapshot,
  startingEquityUsd = 10_000,
  lookback = 20,
  feeBps = 4,
): BacktestReport {
  let equity = startingEquityUsd;
  let open: OpenTrade | undefined;
  const trades: BacktestTrade[] = [];
  const equityCurve = [equity];
  for (let index = lookback + 1; index < source.candles.length; index += 1) {
    const slice = snapshotAt(source, index + 1);
    const candle = slice.candles.at(-1)!;
    if (open) {
      const exit = exitPrice(open, candle);
      if (exit.price !== undefined) {
        const grossPnlUsd = pnl(open, exit.price);
        const feesUsd = open.quantity * (open.signal.entry + exit.price) * feeBps / 10_000;
        const netPnlUsd = grossPnlUsd - feesUsd;
        equity += netPnlUsd;
        trades.push({ entryTime: open.entryTime, exitTime: candle.time, side: open.signal.side as "long" | "short", entryPrice: open.signal.entry, exitPrice: exit.price, quantity: open.quantity, grossPnlUsd, feesUsd, netPnlUsd, exitReason: exit.reason! });
        open = undefined;
      }
    }
    if (!open) {
      const signal = combineSignals(breakoutSignal(slice, lookback), fundingFadeSignal(slice, 0.00015));
      const plan = sizePosition(signal, equity, 0.005, 2_000);
      if (signal.side !== "flat" && plan.quantity > 0) open = { signal, entryTime: candle.time, quantity: plan.quantity };
    }
    const marked = open ? pnl(open, candle.close) : 0;
    equityCurve.push(equity + marked);
  }
  return { trades, equityCurve, startingEquityUsd, endingEquityUsd: equityCurve.at(-1) ?? startingEquityUsd, maximumDrawdownPct: maximumDrawdown(equityCurve), sharpeLike: sharpeLike(equityCurve) };
}
