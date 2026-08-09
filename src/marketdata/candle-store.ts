import type { Candle } from "./hyperliquid.js";

export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface CandleSeries {
  readonly coin: string;
  readonly interval: Interval;
  readonly candles: readonly Candle[];
  readonly updatedAt: Date;
}

export interface CandleStoreSnapshot {
  readonly series: CandleSeries[];
  readonly maximumCandles: number;
}

function key(coin: string, interval: Interval): string {
  return `${coin.toUpperCase()}:${interval}`;
}

function validate(candle: Candle): Candle {
  if (![candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)) {
    throw new Error("Candle has non-finite values");
  }
  if (candle.low > candle.high || candle.open <= 0 || candle.close <= 0) {
    throw new Error("Candle OHLC bounds are invalid");
  }
  return candle;
}

export class CandleStore {
  private readonly entries = new Map<string, CandleSeries>();
  constructor(private readonly maximumCandles = 2_000) {
    if (!Number.isInteger(maximumCandles) || maximumCandles < 10) throw new Error("maximumCandles must be at least 10");
  }

  replace(coin: string, interval: Interval, incoming: readonly Candle[]): CandleSeries {
    const normalized = incoming.map(validate).sort((left, right) => left.time - right.time);
    const unique = normalized.filter((candle, index) => index === 0 || candle.time !== normalized[index - 1].time);
    const series: CandleSeries = { coin: coin.toUpperCase(), interval, candles: unique.slice(-this.maximumCandles), updatedAt: new Date() };
    this.entries.set(key(coin, interval), series);
    return series;
  }

  append(coin: string, interval: Interval, incoming: Candle): CandleSeries {
    const existing = this.entries.get(key(coin, interval));
    if (!existing) return this.replace(coin, interval, [incoming]);
    const candles = [...existing.candles];
    const index = candles.findIndex((candle) => candle.time === incoming.time);
    if (index >= 0) candles[index] = validate(incoming);
    else candles.push(validate(incoming));
    return this.replace(coin, interval, candles);
  }

  series(coin: string, interval: Interval): CandleSeries | undefined {
    return this.entries.get(key(coin, interval));
  }

  latest(coin: string, interval: Interval): Candle | undefined {
    return this.series(coin, interval)?.candles.at(-1);
  }

  range(coin: string, interval: Interval, startTime: number, endTime: number): Candle[] {
    return (this.series(coin, interval)?.candles ?? []).filter((candle) => candle.time >= startTime && candle.time <= endTime);
  }

  returns(coin: string, interval: Interval): number[] {
    const candles = this.series(coin, interval)?.candles ?? [];
    return candles.slice(1).map((candle, index) => Math.log(candle.close / candles[index].close));
  }

  realizedVolatility(coin: string, interval: Interval, periods = 20): number | undefined {
    const returns = this.returns(coin, interval).slice(-periods);
    if (returns.length < 2) return undefined;
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    return Math.sqrt(returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1));
  }

  isStale(coin: string, interval: Interval, maximumAgeMs: number, now = Date.now()): boolean {
    const candle = this.latest(coin, interval);
    return !candle || now - candle.time > maximumAgeMs;
  }

  snapshot(): CandleStoreSnapshot {
    return { series: [...this.entries.values()].map((item) => ({ ...item, candles: [...item.candles] })), maximumCandles: this.maximumCandles };
  }

  hydrate(snapshot: CandleStoreSnapshot): void {
    if (snapshot.maximumCandles !== this.maximumCandles) throw new Error("Candle-store capacity mismatch");
    this.entries.clear();
    for (const item of snapshot.series) this.replace(item.coin, item.interval, item.candles);
  }
}
