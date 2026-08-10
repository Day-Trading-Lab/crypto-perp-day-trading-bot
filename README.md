<p align="center">
  <img src="docs/banner.png" alt="Crypto Perp Day Trading Bot" width="100%" />
</p>

# Crypto Perp Day Trading Bot

<p align="center">
  <strong>Trade BTC perps like a session desk — not a lottery ticket</strong><br/>
  Donchian-style breakouts · Crowded-funding fades · R-multiple exits · Day-risk gates
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img alt="Hyperliquid" src="https://img.shields.io/badge/Market%20Data-Hyperliquid-00C2FF" />
  <img alt="Modes" src="https://img.shields.io/badge/Paper%20%2B%20Live-ready-success" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</p>

<p align="center">
  Languages: **English** · [中文](README.zh.md) · [Deutsch](README.de.md) · [Español](README.es.md)
</p>

> **Search keywords:** BTC perp day trading · crypto perpetual futures bot · funding rate as signal · Hyperliquid trading bot

Perps reward **process**. This bot combines momentum breakouts with a classic 2026 tell — **extreme funding as crowding** — then sizes and exits with explicit **R multiples** under a daily loss / trade-count ceiling.

---

## Performance snapshot

Demo analytics from the included static dashboard (`npm run dashboard`). Banners and strategy diagrams stay above/below.

<p align="center">
  <img src="docs/dashboard.jpg" alt="PerpPulse — Performance dashboard" width="100%" />
</p>

<p align="center">
  <img src="docs/pnl.jpg" alt="PerpPulse — PnL / equity view" width="100%" />
</p>

<p align="center">
  <img src="docs/analytics.jpg" alt="PerpPulse — Analytics strip" width="100%" />
</p>

---

## Project workflow

End-to-end path from clone to live — paper first, credentials last, risk always on.

```mermaid
flowchart LR
  A[Clone repo] --> B[npm install]
  B --> C[Edit settings.json]
  C --> D[typecheck + test]
  D --> E[npm run paper]
  E --> F{Paper results OK?}
  F -->|Yes| G[Fill .env secrets]
  F -->|Tune| C
  G --> H[npm run live --confirm-live]
  H --> I[Monitor ledger / risk]
  I -->|Limit hit| J[Halt / unwind]
  I -->|Yes| I
```

| Commands | |
|---------|--|
| `npm run paper` | Paper first |
| `npm run dashboard` | Open local analytics dashboard (static) |
| `npm run live` | Requires `--confirm-live` + credentials |
| `npm test` / `npm run typecheck` | CI-local gates |

---

## Edge toolkit

| | |
|--|--|
| Breakout | Leave the lookback range with a buffer |
| Funding fade | Fade crowded longs/shorts when funding is extreme |
| Session filter | Optional UTC killzones / trading windows |
| R sizing + day risk | Fixed equity % to stop distance; max trades/day |

---

## Strategy diagram

```mermaid
flowchart LR
  M[Paper simulator / Hyperliquid Info API] --> C[Candle store]
  C --> B[Breakout signal]
  M --> F[Funding feed]
  F --> Fade[Funding-fade signal]
  B --> S[Combine setups]
  Fade --> S
  S --> Sess{Session open?}
  Sess -->|No| Hold[Flat]
  Sess -->|Yes| Sz[R-multiple size]
  Sz --> Risk[Day trader risk gates]
  Risk -->|OK| Book[Perp book]
  Risk -->|Blocked| Hold
  Book --> X[Paper fill / fail-closed live router]
```

Paper can use **real Hyperliquid public data** with simulated fills. Live stays fail-closed without a signer.

---

## Architecture

```
src/
  marketdata/  candles, Hyperliquid info client, funding
  signals/     breakout, funding-fade, session filter, indicators
  sizing/      R-multiple position sizing
  broker/      paper perp + order state + live router
  portfolio/   signed positions, fees, funding payments
  risk/        day limits, scenarios, killzones
  app/         trader runtime + retry helpers
```

---

## Quickstart

```bash
cd crypto-perp-day-trading-bot
npm install
npm run typecheck
npm test
npm run paper
```

### Live

```bash
cp .env.example .env
# set `HL_PRIVATE_KEY=0x...` (Hyperliquid account signer)
npm run live
```

---

## Configuration

`settings.json` — trading parameters. `.env` — secrets only (see `.env.example`).

- Lookback, funding threshold, R targets
- Session windows
- Day risk caps

---

## Risk & safety

- Keep leverage + riskPerTradePct conservative
- `--confirm-live` required
- Validate on paper first

---

## Disclaimer

Leveraged perps can liquidate accounts quickly. Educational MIT software — **not financial advice**. You are responsible for sizing, venue rules, and compliance.

## License

MIT — see [LICENSE](LICENSE).
