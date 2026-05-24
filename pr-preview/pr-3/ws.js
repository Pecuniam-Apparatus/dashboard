const KrakenWS = (() => {
  const WS_URL = 'wss://ws.kraken.com/v2';
  let ws = null;
  let reconnectDelay = 1000;
  let subscriptions = [];
  const handlers = {};
  let statusCallback = null;

  function setStatus(s) {
    if (statusCallback) statusCallback(s);
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function connect() {
    setStatus('CONNECTING');
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setStatus('LIVE');
      reconnectDelay = 1000;
      subscriptions.forEach(sub => send(sub));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.channel && handlers[msg.channel]) {
        handlers[msg.channel].forEach(h => h(msg));
      }
    };

    ws.onerror = () => setStatus('ERROR');

    ws.onclose = () => {
      setStatus('RECONNECTING');
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        connect();
      }, reconnectDelay);
    };
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
