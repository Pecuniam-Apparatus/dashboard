(function () {
  const SYMBOLS = [
    { ws: 'BTC/USD', pair: 'XBTUSD', label: 'BTC/USD' },
    { ws: 'ETH/USD', pair: 'ETHUSD', label: 'ETH/USD' },
    { ws: 'SOL/USD', pair: 'SOLUSD', label: 'SOL/USD' },
  ];

  const statusEl = document.getElementById('ws-status');
  const rowsEl   = document.getElementById('rows');
  const template = document.getElementById('symbol-row');

  const reg = {};

  SYMBOLS.forEach(cfg => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.row-label').textContent = cfg.label;
    rowsEl.appendChild(node);

    const chart = createChartPanel(node, cfg);
    reg[cfg.ws] = {
      ticker:    createTicker(node),
      orderbook: createOrderBook(node),
      trades:    createTradesFeed(node),
      chart,
    };
    chart.init();
  });

  function routeBySymbol(msg, apply) {
    if (!msg.data) return;
    const buckets = {};
    msg.data.forEach(d => (buckets[d.symbol] ||= []).push(d));
    Object.entries(buckets).forEach(([sym, data]) => {
      const inst = reg[sym];
      if (inst) apply(inst, { ...msg, data });
    });
  }

  KrakenWS.onStatus(status => {
    statusEl.textContent = '● ' + status;
    statusEl.className = 'ws-status ' + status.toLowerCase();
  });

  KrakenWS.on('ticker', m => routeBySymbol(m, (i, mm) => i.ticker.update(mm.data[0])));
  KrakenWS.on('book',   m => routeBySymbol(m, (i, mm) => i.orderbook.handle(mm)));
  KrakenWS.on('trade',  m => routeBySymbol(m, (i, mm) => i.trades.handle(mm)));
  KrakenWS.on('ohlc',   m => routeBySymbol(m, (i, mm) => i.chart.handleOHLC(mm)));

  KrakenWS.connect();

  const wsSymbols = SYMBOLS.map(s => s.ws);
  KrakenWS.subscribe({ channel: 'ticker', symbol: wsSymbols });
  KrakenWS.subscribe({ channel: 'book',   symbol: wsSymbols, depth: 25 });
  KrakenWS.subscribe({ channel: 'trade',  symbol: wsSymbols });
  KrakenWS.subscribe({ channel: 'ohlc',   symbol: wsSymbols, interval: 1 });

  let currentInterval = 1;
  const tfButtons = document.querySelectorAll('#timeframe-bar .tf');
  tfButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const interval = Number(btn.dataset.interval);
      if (interval === currentInterval) return;
      KrakenWS.unsubscribe({ channel: 'ohlc', symbol: wsSymbols, interval: currentInterval });
      currentInterval = interval;
      SYMBOLS.forEach(s => reg[s.ws].chart.switchInterval(interval));
      KrakenWS.subscribe({ channel: 'ohlc', symbol: wsSymbols, interval });
      tfButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.interval) === interval));
    });
  });
})();
