export type ManagedOrderState = "created" | "submitted" | "partially-filled" | "filled" | "cancel-requested" | "cancelled" | "rejected" | "expired";
export type ManagedOrderSide = "buy" | "sell";

export interface ManagedOrder {
  readonly clientId: string;
  readonly exchangeId?: string;
  readonly coin: string;
  readonly side: ManagedOrderSide;
  readonly limitPrice: number;
  readonly requestedQuantity: number;
  readonly filledQuantity: number;
  readonly averageFillPrice?: number;
  readonly state: ManagedOrderState;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly reason?: string;
}

export interface ExchangeOrderUpdate {
  readonly exchangeId: string;
  readonly status: "open" | "filled" | "cancelled" | "rejected";
  readonly filledQuantity: number;
  readonly averageFillPrice?: number;
  readonly message?: string;
}

const terminal = new Set<ManagedOrderState>(["filled", "cancelled", "rejected", "expired"]);

export function createOrder(input: Omit<ManagedOrder, "state" | "filledQuantity" | "createdAt" | "updatedAt">): ManagedOrder {
  if (input.requestedQuantity <= 0 || input.limitPrice <= 0) throw new Error("Order quantity and price must be positive");
  const time = new Date();
  return { ...input, state: "created", filledQuantity: 0, createdAt: time, updatedAt: time };
}

export function submitOrder(order: ManagedOrder, exchangeId: string): ManagedOrder {
  if (order.state !== "created") throw new Error(`Cannot submit an order in ${order.state}`);
  return { ...order, exchangeId, state: "submitted", updatedAt: new Date() };
}

export function applyExchangeUpdate(order: ManagedOrder, update: ExchangeOrderUpdate): ManagedOrder {
  if (terminal.has(order.state)) return order;
  if (order.exchangeId && order.exchangeId !== update.exchangeId) throw new Error("Exchange order identifier mismatch");
  if (update.filledQuantity < order.filledQuantity || update.filledQuantity > order.requestedQuantity) throw new Error("Invalid cumulative fill quantity");
  const state: ManagedOrderState = update.status === "filled" ? "filled"
    : update.status === "cancelled" ? "cancelled"
      : update.status === "rejected" ? "rejected"
        : update.filledQuantity > 0 ? "partially-filled" : "submitted";
  return {
    ...order,
    exchangeId: update.exchangeId,
    filledQuantity: update.filledQuantity,
    averageFillPrice: update.averageFillPrice ?? order.averageFillPrice,
    state,
    reason: update.message,
    updatedAt: new Date(),
  };
}

export function requestCancel(order: ManagedOrder): ManagedOrder {
  if (terminal.has(order.state)) return order;
  return { ...order, state: "cancel-requested", updatedAt: new Date() };
}

export function expireOrder(order: ManagedOrder, maximumAgeMs: number, now = Date.now()): ManagedOrder {
  if (terminal.has(order.state) || now - order.createdAt.getTime() <= maximumAgeMs) return order;
  return { ...order, state: "expired", reason: "time in force exceeded", updatedAt: new Date(now) };
}

export class OrderStateMachine {
  private readonly orders = new Map<string, ManagedOrder>();

  register(order: ManagedOrder): ManagedOrder {
    if (this.orders.has(order.clientId)) throw new Error(`Duplicate client order id ${order.clientId}`);
    this.orders.set(order.clientId, order);
    return order;
  }

  submit(clientId: string, exchangeId: string): ManagedOrder {
    return this.update(clientId, (order) => submitOrder(order, exchangeId));
  }

  reconcile(clientId: string, update: ExchangeOrderUpdate): ManagedOrder {
    return this.update(clientId, (order) => applyExchangeUpdate(order, update));
  }

  cancel(clientId: string): ManagedOrder {
    return this.update(clientId, requestCancel);
  }

  expireAll(maximumAgeMs: number, now = Date.now()): ManagedOrder[] {
    return [...this.orders.keys()].map((clientId) => this.update(clientId, (order) => expireOrder(order, maximumAgeMs, now)));
  }

  active(): ManagedOrder[] {
    return [...this.orders.values()].filter((order) => !terminal.has(order.state));
  }

  history(): ManagedOrder[] {
    return [...this.orders.values()].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  private update(clientId: string, mapper: (order: ManagedOrder) => ManagedOrder): ManagedOrder {
    const existing = this.orders.get(clientId);
    if (!existing) throw new Error(`Unknown order ${clientId}`);
    const updated = mapper(existing);
    this.orders.set(clientId, updated);
    return updated;
  }
}
