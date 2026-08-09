import test from "node:test";
import assert from "node:assert/strict";
import { sizePosition } from "../src/sizing/rmultiple.js";
import { initialRiskState, assessTrade, recordTrade } from "../src/risk/limits.js";
import { PaperOrderRouter } from "../src/broker/router.js";

test("R-multiple sizing respects risk and notional caps", () => {
  const plan = sizePosition(
    { side: "long", reason: "test", entry: 100, stop: 95, target: 110, confidence: 1 },
    10_000, 0.01, 1_000,
  );
  assert.equal(plan.notionalUsd, 1_000);
  assert.equal(plan.riskUsd, 50);
  assert.equal(plan.rewardRisk, 2);
});

test("risk state blocks a proposed daily loss breach", () => {
  const state = initialRiskState(1_000);
  const decision = assessTrade(state, { maxDailyLossUsd: 100, maxTradesPerDay: 3, maxDrawdownPct: 0.1 }, 1_000, 101);
  assert.equal(decision.allowed, false);
  assert.match(decision.reason ?? "", /daily loss/);
});

test("paper router charges a fee and accrues funding", async () => {
  const router = new PaperOrderRouter(10);
  const fill = await router.place({ coin: "BTC", side: "buy", quantity: 1, price: 100 });
  assert.equal(fill.feeUsd, 0.1);
  assert.equal(router.accrueFunding(100, 0.001), -0.1);
});

test("a realized loss advances daily state", () => {
  const next = recordTrade(initialRiskState(1_000), -25, 975, { maxDailyLossUsd: 100, maxTradesPerDay: 3, maxDrawdownPct: 0.1 });
  assert.equal(next.tradesToday, 1);
  assert.equal(next.realizedPnlUsd, -25);
  assert.equal(next.halted, false);
});
