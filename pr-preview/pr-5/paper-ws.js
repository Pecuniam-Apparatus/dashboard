const PaperWS = (() => {
  // Paper-execution heartbeat feed. This is a Cloudflare quick-tunnel URL, which
  // rotates whenever the tunnel restarts — update this one line when it changes.
  const WS_URL = 'wss://calvin-eminem-ensuring-memories.trycloudflare.com';
  let ws = null;
  let reconnectDelay = 1000;
  let messageCallback = null;
  let statusCallback = null;

  function setStatus(s) {
    if (statusCallback) statusCallback(s);
  }

  function connect() {
    setStatus('CONNECTING');
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setStatus('LIVE');
      reconnectDelay = 1000;
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (messageCallback) messageCallback(msg);
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

  function onMessage(cb) {
    messageCallback = cb;
  }

  function onStatus(cb) {
    statusCallback = cb;
  }

  return { connect, onMessage, onStatus };
})();
