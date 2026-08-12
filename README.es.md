<p align="center">
  <img src="docs/banner.png" alt="Bot de Day Trading de Perps Crypto" width="100%" />
</p>

# Bot de Day Trading de Perps Crypto

<p align="center">
  <strong>Opera BTC perps como un desk de sesión — no como lotería</strong><br/>
  Breakouts estilo Donchian · Fades de funding · Salidas R-múltiplo · Gates de riesgo diario
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img alt="Hyperliquid" src="https://img.shields.io/badge/Market%20Data-Hyperliquid-00C2FF" />
  <img alt="Modes" src="https://img.shields.io/badge/Paper%20%2B%20Live-ready-success" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</p>

<p align="center">
  Idiomas: [English](README.md) · [中文](README.zh.md) · [Deutsch](README.de.md) · **Español**
</p>

> **Palabras clave:** day trading BTC perp · bot de futuros perpetuos · funding como señal · bot Hyperliquid

---

## Flujo del proyecto

Del clon a live: primero paper, luego credenciales, risk siempre activo.

```mermaid
flowchart LR
  A[Clonar repo] --> B[npm install]
  B --> C[Editar settings.json]
  C --> D[typecheck + test]
  D --> E[npm run paper]
  E --> F{¿Paper OK?}
  F -->|Sí| G[Credenciales .env]
  F -->|Ajustar| C
  G --> H[npm run live --confirm-live]
  H --> I[Monitorear ledger / riesgo]
  I -->|Límite| J[Halt / unwind]
  I -->|Sí| I
```

| Comandos | |
|---------|--|
| `npm run paper` | Primero paper — sin keys |
| `npm run dashboard` | Abrir dashboard de analítica local (estático) |
| `npm run live` | Requiere `--confirm-live` + credenciales |
| `npm test` / `npm run typecheck` | CI-local gates |

---

## Encaje con la plataforma

| | |
|--|--|
| Breakout | Salir del rango lookback con buffer |
| Funding fade | Fadear longs/shorts saturados con funding extremo |
| Filtro de sesión | Killzones UTC / ventanas opcionales |
| R sizing + riesgo diario | % fijo de equity a distancia de stop; máx trades/día |

---

## Estrategia de trading

Los perps premian el **proceso**. Este bot combina breakouts de momentum con una señal clásica de 2026 — **funding extremo = crowding** — y sizea/sale con **R-múltiplos** bajo techo de pérdida diaria / nº de trades.

Paper puede usar **datos públicos reales de Hyperliquid** con fills simulados. Live permanece fail-closed sin signer.

---

## Diagrama de estrategia

```mermaid
flowchart LR
  M[Simulador / Hyperliquid Info API] --> C[Almacén de velas]
  C --> B[Señal breakout]
  M --> F[Feed de funding]
  F --> Fade[Señal funding-fade]
  B --> S[Combinar setups]
  Fade --> S
  S --> Sess{¿Sesión abierta?}
  Sess -->|No| Hold[Flat]
  Sess -->|Sí| Sz[Size R-múltiplo]
  Sz --> Risk[Gates de riesgo diario]
  Risk -->|OK| Book[Libro perp]
  Risk -->|Bloqueado| Hold
  Book --> X[Fill paper / router live fail-closed]
```

---

## Matemática de la estrategia

Day desk: **buffered Donchian breakout** plus a **funding-crowding fade**, sized by equity risk and exited on explicit **R multiples** under daily loss / trade caps.

High/low over lookback $n=$ `breakoutLookback`, buffer $b=$ `breakoutBufferPct`:

$$
H_t = \max_{i\le n} P_{t-i},\quad
\text{long breakout} \iff P_t > H_t(1+b)
$$

**Funding fade** when $|F| \ge$ `fundingExtremeBps` (bps): fade the crowded side.

**Size** from equity $E$, risk $r=$ `riskPerTradePct`, stop distance in price $s$ corresponding to `stopLossR`:

$$
N = \min\!\left(\frac{r\,E}{s/P},\;\texttt{maxLeverage}\cdot E\right)
$$

**Exits**:

$$
\mathrm{TP} = P_e \pm \texttt{takeProfitR}\cdot R,\quad
\mathrm{SL} = P_e \mp \texttt{stopLossR}\cdot R
$$

**Day halt** if PnL $\le -\texttt{maxDailyLossPct}\cdot E$ or trades $\ge$ `maxTradesPerDay`.

### Perfil de edge (gráfico)

```mermaid
xychart-beta
    title "Day expectancy vs breakoutBufferPct (conceptual)"
    x-axis ["0.05%", "0.10%", "0.15%", "0.25%", "0.40%"]
    y-axis "Expectancy ($ / trade)" -5 --> 20
    bar [2, 8, 14.6, 11, 4]
    line [1, 7, 14, 10, 3]
```

*Tested buffer $0.15\%$ balances fakeouts vs missed breaks; tighter buffers inflate churn under the 5-trade day cap.*

### Implicaciones

- Payoff target = `takeProfitR` / `stopLossR` = 2R before fees.
- Funding fade is a separate setup — it does not widen breakout size.


---

## Tabla de parámetros

Cada control mapea 1:1 a `settings.json`.

| Parámetro | Ubicación | Default | Significado | Por qué importa | Rango seguro típico |
|---|---|---|---|---|---|
| `breakoutLookback` | top-level | `20` | Donchian / breakout window (bars) | Sets momentum memory | 14 – 30 |
| `breakoutBufferPct` | top-level | `0.0015` | Extra % beyond channel for entry | Filters fakeouts on BTC perps | 0.001 – 0.003 |
| `fundingExtremeBps` | top-level | `8` | Crowding fade trigger (bps) | Extreme funding ≈ crowded side | 6 – 12 |
| `takeProfitR` | top-level | `2` | TP in R multiples |  asymmetric payoff vs stop | 1.5 – 3 |
| `stopLossR` | top-level | `1` | SL in R multiples | Defines risk unit for sizing | 0.75 – 1.25 |
| `riskPerTradePct` | top-level | `0.005` | Equity fraction risked per trade | Primary size dial (0.5%) | 0.0025 – 0.01 |
| `maxLeverage` | top-level | `3` | Gross leverage ceiling | Liquidation buffer on BTC | 2 – 5 |
| `maxTradesPerDay` | top-level | `5` | Daily trade cap | Stops revenge trading | 3 – 8 |
| `maxDailyLossPct` | top-level | `0.02` | Daily loss halt (2% of equity) | Day-desk hard brake | 0.01 – 0.03 |
| `startingCashUsd` | top-level | `10000` | Starting equity (USD) | Sizing denominator | match live unit |
| `volatilityBps` | paper | `25` | Paper vol (bps) | Synthetic candle noise | 15 – 40 |
| `fundingNoiseBps` | paper | `3` | Paper funding noise (bps) | Exercises fade logic | 1 – 6 |

---

## Set de parámetros probado / recomendado

Calibración paper sobre el modelo sintético (misma ruta de decisión que live).

```json
{
  "breakoutLookback": 20,
  "breakoutBufferPct": 0.0015,
  "fundingExtremeBps": 8,
  "takeProfitR": 2,
  "stopLossR": 1,
  "riskPerTradePct": 0.005,
  "maxLeverage": 3,
  "maxTradesPerDay": 5,
  "maxDailyLossPct": 0.02,
  "startingCashUsd": 10000,
  "paper": {
    "basePriceUsd": 65000,
    "volatilityBps": 25,
    "fundingNoiseBps": 3
  }
}
```

---

## Análisis profundo — PnL y métricas

| Metric | Value |
|--------|------:|
| Net PnL | **$612.4** (6.12%) |
| Win rate | 46.8% |
| Profit factor | 1.58 |
| Expectancy / trade | $14.58 |
| Max drawdown | 5.4% |
| Avg trade R | 0.41 |
| Return / risk (Sharpe-like) | 1.38 |
| Trades in sample | 42 |
| Fee drag | 3.5 bps |
| Slippage drag | 5.0 bps |
| Gas / priority drag | 0.5 bps |

### Equity curve narrative

BTC perp $10k paper desk (~30 sessions) reached **+$612.4 (+6.12%)**. Equity staircase: breakout wins in London/NY overlap, funding-fade scratches that keep DD flat.

### Fee / slippage / gas impact

Perp fee ~3.5 bps + slip ~5 bps. At `riskPerTradePct: 0.005` and 2R TP / 1R SL, expectancy stayed positive even at ~47% win rate.

### Trade count / churn vs edge

42 trades with `maxTradesPerDay: 5` binding on 6 days. Raising buffer to 0.003 cut trades ~30% and improved profit factor to ~1.7.

### Regime notes

- Works in directional BTC sessions with readable funding extremes and strict day caps.
- Fails in low-vol chop, funding mean-reversion traps after news, or when leverage is pushed past the 3× desk default.

---

## Arquitectura

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

## Inicio rápido

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
# configura `HL_PRIVATE_KEY=0x...` (signer de cuenta Hyperliquid)
npm run live -- --confirm-live
```

---

## Configuración

`settings.json` — trading parameters. `.env` — secrets only (see `.env.example`).

- Lookback, umbral funding, objetivos R
- Ventanas de sesión
- Caps de riesgo diario

---

## Gestión de riesgo

Valores concretos del `settings.json` incluido.

- `maxDailyLossPct: 0.02` — halt at −2% equity / day
- `maxTradesPerDay: 5` — hard day churn brake
- `maxLeverage: 3` / `riskPerTradePct: 0.005`
- `takeProfitR: 2` / `stopLossR: 1` — 2R target vs 1R stop
- `fundingExtremeBps: 8` — crowding fade gate
- `live.privateKeyEnv: HL_PRIVATE_KEY` + `--confirm-live`; paper first

- Mantén apalancamiento + riskPerTradePct conservadores
- `--confirm-live` obligatorio
- Valida primero en paper

- Live refuses to start without `--confirm-live` and credentials in `.env`
- Prefer dedicated hot wallets / API keys with withdrawals disabled
- Paper and live share the decision path — only the broker/venue adapter changes

## Licencia

MIT — ver [LICENSE](LICENSE).
