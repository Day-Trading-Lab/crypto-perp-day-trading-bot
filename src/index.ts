import { parseSettings } from "./config.js";
import { DayTradingRuntime } from "./app/runtime.js";
import { HyperliquidMarketData } from "./marketdata/hyperliquid.js";

async function main(): Promise<void> {
  const settings = parseSettings(process.argv.slice(2));
  const runtime = new DayTradingRuntime(settings);
  const fallback = new HyperliquidMarketData();
  console.log(`Starting ${settings.mode} ${settings.coin} runtime for ${settings.loops} cycles`);
  for (let cycle = 0; cycle < settings.loops; cycle += 1) {
    try {
      const result = await runtime.cycle();
      console.log(JSON.stringify({ cycle: cycle + 1, action: result.action, equityUsd: result.equityUsd.toFixed(2), halted: result.risk.halted }));
      if (result.risk.halted) break;
    } catch (error) {
      if (settings.mode !== "paper") throw error;
      const result = await runtime.cycle(fallback.syntheticSnapshot(settings.coin));
      console.warn(`Live data unavailable; paper fallback: ${(error as Error).message}`);
      console.log(JSON.stringify({ cycle: cycle + 1, action: result.action, equityUsd: result.equityUsd.toFixed(2) }));
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});