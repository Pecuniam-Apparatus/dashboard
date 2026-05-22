(function () {
  const statusEl = document.getElementById('ws-status');

  KrakenWS.onStatus(status => {
    statusEl.textContent = '● ' + status;
    statusEl.className = 'ws-status ' + status.toLowerCase();
  });

  KrakenWS.on('ticker', msg => {
    if (msg.data && msg.data[0]) Ticker.update(msg.data[0]);
  });

  KrakenWS.on('book',  msg => OrderBook.handle(msg));
  KrakenWS.on('trade', msg => TradesFeed.handle(msg));
  KrakenWS.on('ohlc',  msg => ChartPanel.handleOHLC(msg));

  ChartPanel.init();
  KrakenWS.connect();

  KrakenWS.subscribe({ channel: 'ticker', symbol: ['BTC/USD'] });
  KrakenWS.subscribe({ channel: 'book',   symbol: ['BTC/USD'], depth: 25 });
  KrakenWS.subscribe({ channel: 'trade',  symbol: ['BTC/USD'] });
  KrakenWS.subscribe({ channel: 'ohlc',   symbol: ['BTC/USD'], interval: 1 });
})();
