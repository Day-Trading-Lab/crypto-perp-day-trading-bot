export interface Candle {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface MarketSnapshot {
  readonly coin: string;
  readonly mid: number;
  readonly fundingRate: number;
  readonly candles: Candle[];
  readonly universe: string[];
  readonly observedAt: Date;
}

const endpoint = "https://api.hyperliquid.xyz/info";

async function info<T>(body: unknown, fetcher: typeof fetch): Promise<T> {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Hyperliquid info HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export class HyperliquidMarketData {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async snapshot(coin: string): Promise<MarketSnapshot> {
    const [meta, mids, funding, rawCandles] = await Promise.all([
      info<{ universe: Array<{ name: string }> }>({ type: "meta" }, this.fetcher),
      info<Record<string, string>>({ type: "allMids" }, this.fetcher),
      info<[unknown, Array<{ coin: string; funding: string }>]>(
        { type: "metaAndAssetCtxs" },
        this.fetcher,
      ).then((value) => value[1] ?? []),
      info<Array<{ t: number; o: string; h: string; l: string; c: string; v: string }>>({
        type: "candleSnapshot", req: { coin, interval: "1h", startTime: Date.now() - 86_400_000, endTime: Date.now() },
      }, this.fetcher),
    ]);
    const mid = Number(mids[coin]);
    if (!Number.isFinite(mid) || mid <= 0) throw new Error(`No valid Hyperliquid mid for ${coin}`);
    const fundingRate = Number(funding.find((row) => row.coin === coin)?.funding ?? 0);
    const candles = rawCandles.map((row) => ({
      time: row.t, open: Number(row.o), high: Number(row.h), low: Number(row.l),
      close: Number(row.c), volume: Number(row.v),
    })).filter((candle) => Number.isFinite(candle.close));
    return { coin, mid, fundingRate, candles, universe: meta.universe.map((item) => item.name), observedAt: new Date() };
  }

  syntheticSnapshot(coin: string, mid = 100_000): MarketSnapshot {
    const candles = Array.from({ length: 30 }, (_, index) => {
      const close = mid * (1 + (index - 15) * 0.0005);
      return { time: Date.now() - (30 - index) * 3_600_000, open: close * 0.999, high: close * 1.002, low: close * 0.998, close, volume: 100 + index };
    });
    return { coin, mid: candles.at(-1)!.close, fundingRate: 0.0001, candles, universe: [coin], observedAt: new Date() };
  }
}
