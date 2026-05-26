(function () {
  // Kraken-symbol cfg used for chart REST history and as the canonical pair name.
  // Add more entries here if the strategy feed starts reporting other symbols.
  const SYMBOL_CFG = {
    'BTC/USD': { pair: 'XBTUSD', label: 'BTC/USD' },
    'ETH/USD': { pair: 'XETHZUSD', label: 'ETH/USD' },
    'SOL/USD': { pair: 'SOLUSD', label: 'SOL/USD' },
  };
  const BASE_SYMBOL = 'BTC/USD';
  const STRATEGY_STALE_MS = 10000;

  const rowsEl   = document.getElementById('rows');
  const template = document.getElementById('symbol-row');

  let currentInterval = 60;
  let lastKrakenStatus = 'CONNECTING';

  // One entry per unique symbol. Multiple strategies on the same symbol all
  // share that symbol's chart and have their overlays color-coded.
  const symbols = new Map(); // symbol -> { node, statusEl, ticker, orderbook, trades, chart }
  // Per-strategy bookkeeping so a strategy that drops out of the broadcast for
  // STRATEGY_STALE_MS gets its lines/markers removed from the chart.
  const liveStrategies = new Map(); // strategy_name -> { symbol, lastSeenMs }

  function createSymbolRow(symbol) {
    const cfg = SYMBOL_CFG[symbol];
    if (!cfg) {
      console.warn('Unknown symbol; cannot render row:', symbol);
      return null;
    }
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.strategy-name').textContent = cfg.label;
    node.querySelector('.strategy-symbol').textContent = '';
    const statusEl = node.querySelector('.ws-status');
    statusEl.textContent = lastKrakenStatus;
    statusEl.className = 'ws-status ' + lastKrakenStatus.toLowerCase();
    rowsEl.appendChild(node);

    const ticker    = createTicker(node);
    const orderbook = createOrderBook(node);
    const trades    = createTradesFeed(node);
    const chart     = createChartPanel(node, { pair: cfg.pair });
    chart.init();

    const entry = { node, statusEl, ticker, orderbook, trades, chart, symbol };
    symbols.set(symbol, entry);

    const sub = [symbol];
    KrakenWS.subscribe({ channel: 'ticker', symbol: sub });
    KrakenWS.subscribe({ channel: 'book',   symbol: sub, depth: 25 });
    KrakenWS.subscribe({ channel: 'trade',  symbol: sub });
    KrakenWS.subscribe({ channel: 'ohlc',   symbol: sub, interval: currentInterval });

    return entry;
  }

  // Always-on BTC/USD market view, even when no strategies are running.
  createSymbolRow(BASE_SYMBOL);

  // ---- Kraken fan-out: one symbol -> one row ----

  KrakenWS.onStatus(status => {
    lastKrakenStatus = status;
    const cls = 'ws-status ' + status.toLowerCase();
    symbols.forEach(e => {
      e.statusEl.textContent = status;
      e.statusEl.className = cls;
    });
  });

  function dispatch(m, fn) {
    if (!m.data || !m.data[0]) return;
    const e = symbols.get(m.data[0].symbol);
    if (e) fn(e);
  }

  KrakenWS.on('ticker', m => dispatch(m, e => e.ticker.update(m.data[0])));
  KrakenWS.on('book',   m => dispatch(m, e => e.orderbook.handle(m)));
  KrakenWS.on('trade',  m => dispatch(m, e => e.trades.handle(m)));
  KrakenWS.on('ohlc',   m => dispatch(m, e => e.chart.handleOHLC(m)));

  KrakenWS.connect();

  // ---- PaperWS: route strategy overlays onto each symbol's chart ----

  PaperWS.onStatus(status => { if (status !== 'LIVE') Strategies.setOffline(); });
  PaperWS.onMessage(arr => {
    const now = Date.now();
    arr.forEach(snap => {
      const symbolEntry = symbols.get(snap.symbol) || createSymbolRow(snap.symbol);
      if (!symbolEntry) return;
      // If a strategy migrated to a new symbol, clear its overlays from the
      // old chart before drawing on the new one.
      const prev = liveStrategies.get(snap.strategy_name);
      if (prev && prev.symbol !== snap.symbol) {
        const oldEntry = symbols.get(prev.symbol);
        if (oldEntry) oldEntry.chart.removeStrategy(snap.strategy_name);
      }
      liveStrategies.set(snap.strategy_name, { symbol: snap.symbol, lastSeenMs: now });
      symbolEntry.chart.applyStrategyState(snap);
      symbolEntry.chart.applyFills(snap.strategy_name, snap.fills || []);
    });
    Strategies.applyAll(arr);
  });
  PaperWS.connect();

  // Expose the color hash to the table so strategy dots match chart overlays.
  // Uses any chart's helper — they all hash identically.
  const sampleChart = symbols.get(BASE_SYMBOL).chart;
  Strategies.setColorFn(sampleChart.colorForStrategy);

  // ---- Stale sweep: drop overlays for strategies that haven't broadcast in 10s ----

  setInterval(() => {
    const now = Date.now();
    liveStrategies.forEach((info, name) => {
      if (now - info.lastSeenMs <= STRATEGY_STALE_MS) return;
      const entry = symbols.get(info.symbol);
      if (entry) entry.chart.removeStrategy(name);
      liveStrategies.delete(name);
    });
  }, 2000);

  // ---- Global timeframe bar: switches all charts together ----

  const tfButtons = document.querySelectorAll('#timeframe-bar .tf');
  tfButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const interval = Number(btn.dataset.interval);
      if (interval === currentInterval) return;
      const prev = currentInterval;
      currentInterval = interval;

      symbols.forEach((_e, symbol) => {
        KrakenWS.unsubscribe({ channel: 'ohlc', symbol: [symbol], interval: prev });
        KrakenWS.subscribe({   channel: 'ohlc', symbol: [symbol], interval });
      });
      // switchInterval clears overlays as a side effect — they'll be redrawn
      // on the next PaperWS tick. liveStrategies stays so the sweep can still
      // garbage-collect strategies that go silent.
      symbols.forEach(e => e.chart.switchInterval(interval));
      tfButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.interval) === interval));
    });
  });
})();
