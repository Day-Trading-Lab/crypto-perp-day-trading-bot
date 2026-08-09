import type { Fill } from "../broker/router.js";

export interface Position {
  readonly coin: string;
  readonly quantity: number;
  readonly averageEntry: number;
  readonly realizedPnlUsd: number;
  readonly feesUsd: number;
  readonly fundingUsd: number;
}

export class PerpBook {
  private position: Position;
  constructor(coin: string) {
    this.position = { coin, quantity: 0, averageEntry: 0, realizedPnlUsd: 0, feesUsd: 0, fundingUsd: 0 };
  }

  applyFill(fill: Fill): Position {
    const signed = fill.side === "buy" ? fill.quantity : -fill.quantity;
    const prior = this.position;
    let realized = prior.realizedPnlUsd;
    const reducing = prior.quantity !== 0 && Math.sign(prior.quantity) !== Math.sign(signed);
    if (reducing) {
      const closed = Math.min(Math.abs(prior.quantity), Math.abs(signed));
      realized += closed * (fill.price - prior.averageEntry) * Math.sign(prior.quantity);
    }
    const nextQuantity = prior.quantity + signed;
    const adding = prior.quantity === 0 || Math.sign(prior.quantity) === Math.sign(signed);
    const averageEntry = adding
      ? ((Math.abs(prior.quantity) * prior.averageEntry + Math.abs(signed) * fill.price) / Math.max(Math.abs(nextQuantity), 1e-12))
      : (nextQuantity === 0 ? 0 : (Math.sign(nextQuantity) === Math.sign(prior.quantity) ? prior.averageEntry : fill.price));
    this.position = { ...prior, quantity: nextQuantity, averageEntry, realizedPnlUsd: realized - fill.feeUsd, feesUsd: prior.feesUsd + fill.feeUsd };
    return this.position;
  }

  applyFunding(paymentUsd: number): Position {
    this.position = { ...this.position, fundingUsd: this.position.fundingUsd + paymentUsd };
    return this.position;
  }

  markToMarket(mark: number): { unrealizedPnlUsd: number; equityContributionUsd: number } {
    const unrealizedPnlUsd = this.position.quantity * (mark - this.position.averageEntry);
    const equityContributionUsd = this.position.realizedPnlUsd + this.position.fundingUsd + unrealizedPnlUsd;
    return { unrealizedPnlUsd, equityContributionUsd };
  }

  snapshot(): Position { return { ...this.position }; }
}
