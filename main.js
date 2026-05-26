(function () {
  const cfg = { ws: 'BTC/USD', pair: 'XBTUSD', label: 'BTC/USD' };

  const statusEl = document.getElementById('ws-status');
  const rowsEl   = document.getElementById('rows');
  const template = document.getElementById('symbol-row');

  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector('.row-label').textContent = cfg.label;
  rowsEl.appendChild(node);

  const ticker    = createTicker(node);
  const orderbook = createOrderBook(node);
  const trades    = createTradesFeed(node);
  const chart     = createChartPanel(node, cfg);
  chart.init();

  KrakenWS.onStatus(status => {
    statusEl.textContent = '● ' + status;
    statusEl.className = 'ws-status ' + status.toLowerCase();
  });

  KrakenWS.on('ticker', m => m.data && ticker.update(m.data[0]));
  KrakenWS.on('book',   m => orderbook.handle(m));
  KrakenWS.on('trade',  m => trades.handle(m));
  KrakenWS.on('ohlc',   m => chart.handleOHLC(m));

  KrakenWS.connect();

  const symbol = [cfg.ws];
  KrakenWS.subscribe({ channel: 'ticker', symbol });
  KrakenWS.subscribe({ channel: 'book',   symbol, depth: 25 });
  KrakenWS.subscribe({ channel: 'trade',  symbol });
  KrakenWS.subscribe({ channel: 'ohlc',   symbol, interval: 60 });

  PaperWS.onStatus(status => { if (status !== 'LIVE') Strategies.setOffline(); });
  PaperWS.onMessage(hb => Strategies.applyHeartbeat(hb));
  PaperWS.connect();

  let currentInterval = 60;
  const tfButtons = document.querySelectorAll('#timeframe-bar .tf');
  tfButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const interval = Number(btn.dataset.interval);
      if (interval === currentInterval) return;
      KrakenWS.unsubscribe({ channel: 'ohlc', symbol, interval: currentInterval });
      currentInterval = interval;
      chart.switchInterval(interval);
      KrakenWS.subscribe({ channel: 'ohlc', symbol, interval });
      tfButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.interval) === interval));
    });
  });
})();
