import { assertLiveSafety, isSessionOpen, type Settings } from "../config.js";
import { HyperliquidMarketData, type MarketSnapshot } from "../marketdata/hyperliquid.js";
import { PaperOrderRouter, LiveOrderRouter, type OrderRouter } from "../broker/router.js";
import { PerpBook } from "../portfolio/book.js";
import { assessTrade, initialRiskState, recordTrade, type RiskState } from "../risk/limits.js";
import { combineSignals, breakoutSignal, fundingFadeSignal, type TradingSignal } from "../signals/strategy.js";
import { sizePosition } from "../sizing/rmultiple.js";

export interface CycleResult {
  readonly action: string;
  readonly equityUsd: number;
  readonly signal: TradingSignal;
  readonly risk: RiskState;
}

export class DayTradingRuntime {
  private readonly book: PerpBook;
  private readonly router: OrderRouter;
  private risk: RiskState;
  private cashUsd: number;

  constructor(private readonly settings: Settings, private readonly data = new HyperliquidMarketData()) {
    assertLiveSafety(settings);
    this.book = new PerpBook(settings.coin);
    this.router = settings.mode === "paper"
      ? new PaperOrderRouter(settings.feeBps)
      : new LiveOrderRouter(settings.privateKey, settings.confirmLive);
    this.risk = initialRiskState(settings.equityUsd);
    this.cashUsd = settings.equityUsd;
  }

  async cycle(snapshotOverride?: MarketSnapshot): Promise<CycleResult> {
    const snapshot = snapshotOverride ?? await this.data.snapshot(this.settings.coin);
    const marked = this.book.markToMarket(snapshot.mid);
    const equityUsd = this.cashUsd + marked.equityContributionUsd;
    const breakout = breakoutSignal(snapshot, this.settings.breakoutLookback);
    const fade = fundingFadeSignal(snapshot, this.settings.fundingFadeThreshold);
    const signal = combineSignals(breakout, fade);
    if (!isSessionOpen(this.settings)) return { action: "session closed", equityUsd, signal, risk: this.risk };
    if (signal.side === "flat") return { action: signal.reason, equityUsd, signal, risk: this.risk };

    const plan = sizePosition(signal, equityUsd, this.settings.riskPerTradePct, this.settings.maxPositionUsd);
    const decision = assessTrade(this.risk, {
      maxDailyLossUsd: this.settings.maxDailyLossUsd, maxTradesPerDay: this.settings.maxTradesPerDay, maxDrawdownPct: 0.1,
    }, equityUsd, plan.riskUsd);
    if (!decision.allowed || plan.quantity === 0) return { action: `blocked: ${decision.reason ?? plan.rejected}`, equityUsd, signal, risk: this.risk };

    const side = signal.side === "long" ? "buy" : "sell";
    const fill = await this.router.place({ coin: this.settings.coin, side, quantity: plan.quantity, price: snapshot.mid });
    this.book.applyFill(fill);
    const funding = this.router.accrueFunding(snapshot.mid, snapshot.fundingRate);
    this.book.applyFunding(funding);
    const after = this.book.markToMarket(snapshot.mid);
    this.risk = recordTrade(this.risk, -fill.feeUsd + funding, this.cashUsd + after.equityContributionUsd, {
      maxDailyLossUsd: this.settings.maxDailyLossUsd, maxTradesPerDay: this.settings.maxTradesPerDay, maxDrawdownPct: 0.1,
    });
    return { action: `${side} ${plan.quantity} ${this.settings.coin}: ${signal.reason}`, equityUsd: this.cashUsd + after.equityContributionUsd, signal, risk: this.risk };
  }
}
