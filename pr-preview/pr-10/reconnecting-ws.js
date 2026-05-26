function createReconnectingWS(url, { onOpen, onMessage, onStatus } = {}) {
  let ws = null;
  let reconnectDelay = 1000;

  function setStatus(s) {
    if (onStatus) onStatus(s);
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function connect() {
    setStatus('CONNECTING');
    ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus('LIVE');
      reconnectDelay = 1000;
      if (onOpen) onOpen({ send });
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (onMessage) onMessage(msg);
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

  return { connect, send };
}
