const KrakenWS = (() => {
  const WS_URL = 'wss://ws.kraken.com/v2';
  let subscriptions = [];
  const handlers = {};
  let statusCallback = null;
  let conn = null;

  function connect() {
    conn = createReconnectingWS(WS_URL, {
      onOpen: ({ send }) => subscriptions.forEach(sub => send(sub)),
      onMessage: (msg) => {
        if (msg.channel && handlers[msg.channel]) {
          handlers[msg.channel].forEach(h => h(msg));
        }
      },
      onStatus: (s) => { if (statusCallback) statusCallback(s); },
    });
    conn.connect();
  }

  function send(msg) {
    if (conn) conn.send(msg);
  }

  function subscribe(params) {
    const msg = { method: 'subscribe', params };
    subscriptions.push(msg);
    send(msg);
  }

  function unsubscribe(params) {
    subscriptions = subscriptions.filter(s => {
      if (s.params.channel !== params.channel) return true;
      if (params.symbol && s.params.symbol) {
        return !params.symbol.every(sym => s.params.symbol.includes(sym));
      }
      return false;
    });
    send({ method: 'unsubscribe', params });
  }

  function on(channel, handler) {
    if (!handlers[channel]) handlers[channel] = [];
    handlers[channel].push(handler);
  }

  function onStatus(cb) {
    statusCallback = cb;
  }

  return { connect, subscribe, unsubscribe, on, onStatus };
})();
