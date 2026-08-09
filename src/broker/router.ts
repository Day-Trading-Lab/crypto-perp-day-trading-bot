export type OrderSide = "buy" | "sell";
export interface OrderRequest { coin: string; side: OrderSide; quantity: number; price: number; reduceOnly?: boolean; }
export interface Fill { id: string; coin: string; side: OrderSide; quantity: number; price: number; feeUsd: number; fundingUsd: number; at: Date; }

export interface OrderRouter {
  place(order: OrderRequest): Promise<Fill>;
  accrueFunding(mark: number, hourlyRate: number): number;
}

export class PaperOrderRouter implements OrderRouter {
  private sequence = 0;
  private signedQuantity = 0;
  private entryPrice = 0;
  private accruedFundingUsd = 0;
  constructor(private readonly feeBps: number) {}

  async place(order: OrderRequest): Promise<Fill> {
    if (!Number.isFinite(order.quantity) || order.quantity <= 0) throw new Error("Order quantity must be positive");
    const signed = order.side === "buy" ? order.quantity : -order.quantity;
    if (order.reduceOnly && this.signedQuantity * signed >= 0) throw new Error("Reduce-only order does not reduce paper position");
    const feeUsd = order.quantity * order.price * this.feeBps / 10_000;
    const oldNotional = Math.abs(this.signedQuantity) * this.entryPrice;
    const nextQuantity = this.signedQuantity + signed;
    if (this.signedQuantity === 0 || Math.sign(this.signedQuantity) === Math.sign(signed)) {
      this.entryPrice = (oldNotional + Math.abs(signed) * order.price) / Math.max(Math.abs(nextQuantity), 1e-12);
    } else if (nextQuantity === 0 || Math.sign(nextQuantity) !== Math.sign(this.signedQuantity)) {
      this.entryPrice = nextQuantity === 0 ? 0 : order.price;
    }
    this.signedQuantity = nextQuantity;
    return { id: `paper-${++this.sequence}`, ...order, feeUsd, fundingUsd: 0, at: new Date() };
  }

  accrueFunding(mark: number, hourlyRate: number): number {
    const payment = -this.signedQuantity * mark * hourlyRate;
    this.accruedFundingUsd += payment;
    return payment;
  }

  position(): { quantity: number; entryPrice: number; accruedFundingUsd: number } {
    return { quantity: this.signedQuantity, entryPrice: this.entryPrice, accruedFundingUsd: this.accruedFundingUsd };
  }
}

export class LiveOrderRouter implements OrderRouter {
  constructor(private readonly privateKey: string | undefined, private readonly confirmed: boolean) {}

  async place(order: OrderRequest): Promise<Fill> {
    if (!this.confirmed || !this.privateKey) {
      throw new Error("LIVE ORDER BLOCKED: require --confirm-live and HL_PRIVATE_KEY.");
    }
    // Hyperliquid's exchange endpoint requires EIP-712 action signing. Never send an
    // unsigned placeholder request: this explicit error keeps the live path fail-closed.
    throw new Error(`LIVE ORDER BLOCKED: signing integration required before submitting ${order.coin} to /exchange.`);
  }

  accrueFunding(): number { return 0; }
}
