const PaperWS = (() => {
  // Paper-execution heartbeat feed. This is a Cloudflare quick-tunnel URL, which
  // rotates whenever the tunnel restarts — update this one line when it changes.
  // The far end runs the gambit dashboard WS (see GAMBIT_WS_HOST/PORT) tunneled
  // through cloudflared. Broadcasts a JSON array every 250 ms, one element per
  // running strategy. See schema in PaperWS.onMessage callback contract below.
  const WS_URL = 'wss://calvin-eminem-ensuring-memories.trycloudflare.com';
  let messageCallback = null;
  let statusCallback = null;
  let conn = null;

  // Mock mode: ?mock=1 fires a synthetic two-strategy broadcast every 250 ms
  // so the dashboard can be developed without the live engine tunnel.
  const MOCK = new URLSearchParams(location.search).has('mock');

  function dispatch(msg) {
    // The new schema is always an array; drop anything else so legacy or
    // out-of-band frames can't crash downstream consumers.
    if (!Array.isArray(msg)) return;
    if (messageCallback) messageCallback(msg);
  }

  function connect() {
    if (MOCK) {
      startMock();
      return;
    }
    conn = createReconnectingWS(WS_URL, {
      onMessage: dispatch,
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

  // ---- Mock generator: two strategies on BTC/USD, one cycling positions ----

  function startMock() {
    if (statusCallback) statusCallback('LIVE');
    let t0 = Date.now();
    const fills = [];
    let inPos = false;
    let entry = 0;
    let cyclesUntilFlip = 8;

    setInterval(() => {
      const price = 76500 + Math.sin((Date.now() - t0) / 4000) * 80;
      if (--cyclesUntilFlip <= 0) {
        cyclesUntilFlip = 12 + Math.floor(Math.random() * 20);
        if (!inPos) {
          inPos = true;
          entry = price;
          fills.push({ ts_ms: Date.now(), price, side: 'long', type: 'entry' });
        } else {
          inPos = false;
          const exitType = price >= entry ? 'tp_exit' : 'sl_exit';
          fills.push({ ts_ms: Date.now(), price, side: 'long', type: exitType });
          entry = 0;
        }
      }

      const snapA = {
        strategy_name: 'Doofus Rick',
        symbol: 'BTC/USD',
        ts_ms: Date.now(),
        last_price: price,
        best_bid: price - 0.5,
        best_ask: price + 0.5,
        in_position: inPos,
        side: inPos ? 'long' : 'flat',
        position_qty: inPos ? 0.05 : 0,
        entry_price: inPos ? entry : 0,
        tp_price: inPos ? entry + 100 : 0,
        sl_price: inPos ? entry - 60 : 0,
        cash_usd: 100000,
        equity: 100000 + (inPos ? (price - entry) * 0.05 : 0),
        unrealized_pnl: inPos ? (price - entry) * 0.05 : 0,
        trade_count: Math.floor(fills.length / 2),
        fills: fills.slice(),
      };
      const snapB = {
        ...snapA,
        strategy_name: 'Turbo Doofus Rick',
        in_position: false,
        side: 'flat',
        position_qty: 0,
        entry_price: 0,
        tp_price: 0,
        sl_price: 0,
        unrealized_pnl: 0,
        equity: 100000,
        trade_count: 0,
        fills: [],
      };
      dispatch([snapA, snapB]);
    }, 250);
  }

  return { connect, onMessage, onStatus };
})();
