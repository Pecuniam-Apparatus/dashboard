# Gambit Dashboard — Scaffold Plan

## What We're Building

A Bloomberg Terminal-style crypto trading dashboard. Static HTML/CSS/JS, hosted on GitHub Pages via GitHub Actions. No backend, no build step.

## Stack

- Vanilla JS (no modules — plain `<script>` tags, globals)
- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) via CDN (standalone UMD bundle → `window.LightweightCharts`)
- Kraken WebSocket API (`wss://ws.kraken.com/v2`) for live data — no auth needed for public feeds
- Pure CSS for layout and Bloomberg-style dark theme
- GitHub Actions → GitHub Pages for deploy

## Layout

### Desktop (CSS Grid)

```
+---------------------------+----------+
|                           |  TICKER  |
|       CHART PANEL         |  L1/L2   |
|   (Lightweight Charts)    | ORDER BK |
|                           | TRADES   |
+---------------------------+----------+
|        STRATEGIES TABLE              |
+--------------------------------------+
```

- Left: chart panel (~70% width)
- Right: sidebar (~30% width), stacked sections top to bottom: ticker summary → order book → recent trades
- Bottom: strategies table (full width)

### Mobile (stacked, breakpoint ≤ 768px)

```
TICKER
CHART
ORDER BOOK
RECENT TRADES
STRATEGIES TABLE
```

## Data Sources (all via Kraken public WS)

Single connection to `wss://ws.kraken.com/v2`, subscribing to:

- `ticker` — last price, 24h high/low/volume for the header ticker bar
- `book` — order book depth (L2), top ~15 bids and asks
- `trade` — executed trades feed (recent trades list)
- `ohlc` — candlestick data for the chart, interval switchable by user

Pair: **BTC/USD** hardcoded to start. (Verify: Kraken WS v2 may use `BTC/USD` not the legacy `XBT/USD`.)

### Initial Chart Load (avoiding blank chart)

1. On startup, call Kraken REST API to fetch historical OHLC candles:
   `GET https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=<minutes>`
2. Seed the chart with the response before WS connects
3. When subscribing to WS `ohlc`, include `snapshot: true` to get recent candles from WS too
4. WS interval values are integers (minutes): 1, 5, 15, 30, 60, 240, 1440 — map UI labels accordingly

## Chart Panel

- Candlestick chart via Lightweight Charts
- Timeframe selector buttons: 1m / 5m / 15m / 1h / 4h / 1D
- Switching timeframe re-subscribes to `ohlc` on WS with new interval
- Trade markers placed on chart when strategies table has a trade (placeholder for now)
- Real-time candle updates via `series.update()`

## Right Sidebar

### Ticker / L1 Summary
- Last price (large, colored green/red on change)
- 24h change %, high, low, volume

### Order Book
- Two columns: Bids (green) | Asks (red)
- Top 15 levels each
- Bar visualization showing relative size
- Updates live from `book` subscription

### Recent Trades Feed
- Scrolling list, newest on top
- Each row: time | price | size | buy/sell colored

## Strategies Table

Full-width table at the bottom. Hardcoded initial row:

| Name | Status | Pair | PnL | Last Trade |
|---|---|---|---|---|
| Doofus Rick | Offline | BTC/USD | — | — |

Columns: Name, Status (colored badge), Pair, PnL, Last Trade timestamp.

## File Structure

```
gambit_dashboard/
├── index.html          # shell, loads all modules
├── style.css           # bloomberg dark theme, responsive grid
├── main.js             # entry point, wires everything together
├── ws.js               # Kraken WS connection manager, subscribe/unsubscribe
├── chart.js            # Lightweight Charts setup and update logic
├── orderbook.js        # order book state + DOM rendering
├── trades.js           # recent trades feed rendering
├── ticker.js           # ticker/L1 summary rendering
├── strategies.js       # strategies table (hardcoded data for now)
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions → GitHub Pages
```

## Bloomberg Color Palette

- Background: `#0a0a0a` (near black)
- Panel bg: `#111111`
- Border: `#2a2a2a`
- Text primary: `#e0e0e0`
- Text muted: `#666666`
- Green (buy/up): `#00c805`
- Red (sell/down): `#ff3b30`
- Orange (accent): `#ff6600` (Bloomberg orange)
- Header/title: `#ff6600`

## GitHub Actions Deploy

- Trigger: push to `main`
- Action: copy repo contents to GitHub Pages (no build step needed)
- Use `actions/upload-pages-artifact` + `actions/deploy-pages`

## Open Questions / Future

- Auth for private Kraken WS (for actual bot trade events)?
- How do real strategy trade markers get pushed to the chart?
- Add more pairs / pair switcher?
- Historical candle data on initial load (Kraken REST API)?
