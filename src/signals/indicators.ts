import type { Candle } from "../marketdata/hyperliquid.js";

export function simpleMovingAverage(values: number[], period: number): number | undefined {
  if (period <= 0 || values.length < period) return undefined;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

export function trueRange(current: Candle, previousClose: number): number {
  return Math.max(current.high - current.low, Math.abs(current.high - previousClose), Math.abs(current.low - previousClose));
}

export function averageTrueRange(candles: Candle[], period = 14): number | undefined {
  if (candles.length < period + 1) return undefined;
  const ranges = candles.slice(-(period + 1)).slice(1).map((candle, index) => trueRange(candle, candles[candles.length - period - 1 + index].close));
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

export function relativeStrengthIndex(candles: Candle[], period = 14): number | undefined {
  if (candles.length < period + 1) return undefined;
  const changes = candles.slice(-(period + 1)).slice(1).map((candle, index) => candle.close - candles[candles.length - period - 1 + index].close);
  const gains = changes.map((change) => Math.max(change, 0));
  const losses = changes.map((change) => Math.max(-change, 0));
  const averageGain = gains.reduce((sum, value) => sum + value, 0) / period;
  const averageLoss = losses.reduce((sum, value) => sum + value, 0) / period;
  if (averageLoss === 0) return 100;
  return 100 - 100 / (1 + averageGain / averageLoss);
}

export function volatility(candles: Candle[], period = 20): number | undefined {
  const closes = candles.slice(-period).map((candle) => candle.close);
  if (closes.length < period) return undefined;
  const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  return Math.sqrt(returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length);
}

export function candleSummary(candles: Candle[]): { trend: "up" | "down" | "flat"; atr?: number; rsi?: number; volatility?: number } {
  const average = simpleMovingAverage(candles.map((candle) => candle.close), 20);
  const latest = candles.at(-1)?.close;
  const trend = average === undefined || latest === undefined ? "flat" : latest > average ? "up" : latest < average ? "down" : "flat";
  return { trend, atr: averageTrueRange(candles), rsi: relativeStrengthIndex(candles), volatility: volatility(candles) };
}
