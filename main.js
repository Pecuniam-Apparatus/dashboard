(function () {
  const BASE_CFG = { ws: 'BTC/USD', pair: 'XBTUSD', label: 'BTC/USD' };

  // Map symbol -> Kraken subscription cfg for chart history REST. Used both by
  // the always-on BTC/USD market row and any per-strategy rows created later.
  const SYMBOL_CFG = {
    'BTC/USD': { ws: 'BTC/USD', pair: 'XBTUSD' },
    'ETH/USD': { ws: 'ETH/USD', pair: 'XETHZUSD' },
    'SOL/USD': { ws: 'SOL/USD', pair: 'SOLUSD' },
  };

  const rowsEl   = document.getElementById('rows');
  const template = document.getElementById('symbol-row');

  let currentInterval = 60;
  // Track latest Kraken status so rows created later (per-strategy) initialize
  // their ws-status badge in the right state instead of stuck on CONNECTING.
  let lastKrakenStatus = 'CONNECTING';

  // Per-row tracking. `kind` distinguishes the always-on market row from
  // per-strategy rows so we can skip strategy overlays on the base row.
  // strategies: key "name|symbol" -> entry. The base row uses key "__base__".
  const entries = new Map();
  // symbolRefs counts how many rows (base + strategies) are subscribed to a
  // given Kraken symbol; we keep ONE Kraken subscription per symbol, fanned
  // out to every consumer with `bySymbol` below.
  const symbolRefs = new Map();
  const bySymbol = new Map(); // symbol -> Set<entry>

  function indexAdd(entry) {
    let set = bySymbol.get(entry.symbol);
    if (!set) { set = new Set(); bySymbol.set(entry.symbol, set); }
    set.add(entry);
  }

  function newRow(symbol, cfg, label) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.strategy-name').textContent = label.name;
    node.querySelector('.strategy-symbol').textContent = label.symbol ? `— ${label.symbol}` : '';
    const statusEl = node.querySelector('.ws-status');
    statusEl.textContent = lastKrakenStatus;
    statusEl.className = 'ws-status ' + lastKrakenStatus.toLowerCase();
    rowsEl.appendChild(node);

    const ticker    = createTicker(node);
    const orderbook = createOrderBook(node);
    const trades    = createTradesFeed(node);
    const chart     = createChartPanel(node, cfg);
    chart.init();

    return { node, statusEl, ticker, orderbook, trades, chart, symbol };
  }

  function subscribeSymbol(symbol) {
    const sub = [symbol];
    KrakenWS.subscribe({ channel: 'ticker', symbol: sub });
    KrakenWS.subscribe({ channel: 'book',   symbol: sub, depth: 25 });
    KrakenWS.subscribe({ channel: 'trade',  symbol: sub });
    KrakenWS.subscribe({ channel: 'ohlc',   symbol: sub, interval: currentInterval });
  }

  function ensureSymbol(symbol) {
    const next = (symbolRefs.get(symbol) || 0) + 1;
    symbolRefs.set(symbol, next);
    if (next === 1) subscribeSymbol(symbol);
  }

  // ---- Base BTC/USD market row (always-on, no strategy overlays) ----

  const baseEntry = newRow(
    BASE_CFG.ws,
    { pair: BASE_CFG.pair },
    { name: BASE_CFG.label, symbol: '' }
  );
  baseEntry.kind = 'base';
  baseEntry.lastSeenMs = Infinity; // never goes stale
  entries.set('__base__', baseEntry);
  indexAdd(baseEntry);
  ensureSymbol(BASE_CFG.ws);

  // ---- Kraken fan-out ----

  KrakenWS.onStatus(status => {
    lastKrakenStatus = status;
    const cls = 'ws-status ' + status.toLowerCase();
    entries.forEach(e => {
      e.statusEl.textContent = status;
      e.statusEl.className = cls;
    });
  });

  // Kraken v2 always tucks the symbol into data[0].symbol regardless of
  // channel (ticker, book, trade, ohlc).
  function fanout(m, fn) {
    if (!m.data || !m.data[0]) return;
    const set = bySymbol.get(m.data[0].symbol);
    if (set) set.forEach(e => fn(e));
  }

  KrakenWS.on('ticker', m => fanout(m, e => e.ticker.update(m.data[0])));
  KrakenWS.on('book',   m => fanout(m, e => e.orderbook.handle(m)));
  KrakenWS.on('trade',  m => fanout(m, e => e.trades.handle(m)));
  KrakenWS.on('ohlc',   m => fanout(m, e => e.chart.handleOHLC(m)));

  KrakenWS.connect();

  // ---- PaperWS: per-strategy rows ----

  function ensureStrategy(snap) {
    const key = `${snap.strategy_name}|${snap.symbol}`;
    let entry = entries.get(key);
    if (entry) return entry;

    const cfg = SYMBOL_CFG[snap.symbol];
    if (!cfg) {
      console.warn('Unknown symbol in strategy feed:', snap.symbol);
      return null;
    }

    entry = newRow(
      cfg.ws,
      { pair: cfg.pair },
      { name: snap.strategy_name, symbol: snap.symbol }
    );
    entry.kind = 'strategy';
    entry.key = key;
    entry.lastSeenMs = Date.now();
    entries.set(key, entry);
    indexAdd(entry);
    ensureSymbol(cfg.ws);
    return entry;
  }

  PaperWS.onStatus(status => { if (status !== 'LIVE') Strategies.setOffline(); });
  PaperWS.onMessage(arr => {
    arr.forEach(snap => {
      const entry = ensureStrategy(snap);
      if (!entry) return;
      entry.lastSeenMs = Date.now();
      entry.node.classList.remove('stale');
      entry.chart.applyStrategyState(snap);
      entry.chart.applyFills(snap.fills || []);
    });
    Strategies.applyAll(arr);
  });
  PaperWS.connect();

  // ---- Stale sweep: grey rows that haven't been broadcast in 10s ----

  setInterval(() => {
    const now = Date.now();
    entries.forEach(e => {
      if (e.kind !== 'strategy') return;
      const stale = now - e.lastSeenMs > 10000;
      e.node.classList.toggle('stale', stale);
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

      symbolRefs.forEach((_count, symbol) => {
        KrakenWS.unsubscribe({ channel: 'ohlc', symbol: [symbol], interval: prev });
        KrakenWS.subscribe({   channel: 'ohlc', symbol: [symbol], interval });
      });
      entries.forEach(e => e.chart.switchInterval(interval));
      tfButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.interval) === interval));
    });
  });
})();
