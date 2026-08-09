import { z } from "zod";

export const SettingsSchema = z.object({
  mode: z.enum(["paper", "live"]).default("paper"),
  confirmLive: z.boolean().default(false),
  loops: z.number().int().min(1).default(3),
  coin: z.string().min(1).default("BTC"),
  equityUsd: z.number().positive().default(10_000),
  sessionStartUtc: z.number().int().min(0).max(23).default(7),
  sessionEndUtc: z.number().int().min(0).max(23).default(20),
  breakoutLookback: z.number().int().min(3).default(20),
  fundingFadeThreshold: z.number().positive().default(0.00015),
  riskPerTradePct: z.number().positive().max(0.05).default(0.005),
  maxPositionUsd: z.number().positive().default(2_000),
  maxDailyLossUsd: z.number().positive().default(300),
  maxTradesPerDay: z.number().int().positive().default(6),
  feeBps: z.number().nonnegative().default(4),
  privateKey: z.string().optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;

export function parseSettings(argv: string[], environment = process.env): Settings {
  const option = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const asNumber = (name: string): number | undefined => {
    const raw = option(name);
    return raw === undefined ? undefined : Number(raw);
  };
  return SettingsSchema.parse({
    mode: option("mode"),
    confirmLive: argv.includes("--confirm-live"),
    loops: asNumber("loops"),
    coin: option("coin"),
    equityUsd: asNumber("equity"),
    privateKey:
      environment.HL_PRIVATE_KEY ||
      environment.HYPERLIQUID_PRIVATE_KEY,
  });
}

export function assertLiveSafety(settings: Settings): void {
  if (settings.mode !== "live") return;
  if (!settings.confirmLive) {
    throw new Error("Live mode requires --confirm-live; paper mode is the safe default.");
  }
  if (!settings.privateKey) {
    throw new Error(
      "Live mode requires HL_PRIVATE_KEY (or HYPERLIQUID_PRIVATE_KEY); refusing to submit an unsigned order.",
    );
  }
}

export function isSessionOpen(settings: Settings, now = new Date()): boolean {
  const hour = now.getUTCHours();
  if (settings.sessionStartUtc <= settings.sessionEndUtc) {
    return hour >= settings.sessionStartUtc && hour < settings.sessionEndUtc;
  }
  return hour >= settings.sessionStartUtc || hour < settings.sessionEndUtc;
}
