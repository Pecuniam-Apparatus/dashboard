const PaperWS = (() => {
  // Paper-execution heartbeat feed. This is a Cloudflare quick-tunnel URL, which
  // rotates whenever the tunnel restarts — update this one line when it changes.
  const WS_URL = 'wss://calvin-eminem-ensuring-memories.trycloudflare.com';
  let messageCallback = null;
  let statusCallback = null;
  let conn = null;

  function connect() {
    conn = createReconnectingWS(WS_URL, {
      onMessage: (msg) => { if (messageCallback) messageCallback(msg); },
      onStatus: (s) => { if (statusCallback) statusCallback(s); },
    });
    conn.connect();
  }

  function onMessage(cb) {
    messageCallback = cb;
  }

  function onStatus(cb) {
    statusCallback = cb;
  }

  return { connect, onMessage, onStatus };
})();
