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
    const t0 = Date.now();

    // Two independent strategy generators so the dashboard can demo
    // multi-strategy color-coded overlays on a single chart.
    function makeStrat(qty, tp, sl, startCountdown) {
      return {
        fills: [], inPos: false, entry: 0, cyclesUntilFlip: startCountdown,
        qty, tp, sl,
      };
    }
    const stratA = makeStrat(0.05, 100, 60, 8);
    const stratB = makeStrat(0.03, 70, 45, 16);

    function tickStrat(s, price) {
      if (--s.cyclesUntilFlip > 0) return;
      s.cyclesUntilFlip = 12 + Math.floor(Math.random() * 20);
      if (!s.inPos) {
        s.inPos = true;
        s.entry = price;
        s.fills.push({ ts_ms: Date.now(), price, side: 'long', type: 'entry' });
      } else {
        const exitType = price >= s.entry ? 'tp_exit' : 'sl_exit';
        s.fills.push({ ts_ms: Date.now(), price, side: 'long', type: exitType });
        s.inPos = false;
        s.entry = 0;
      }
    }

    function snap(name, s, price) {
      return {
        strategy_name: name,
        symbol: 'BTC/USD',
        ts_ms: Date.now(),
        last_price: price,
        best_bid: price - 0.5,
        best_ask: price + 0.5,
        in_position: s.inPos,
        side: s.inPos ? 'long' : 'flat',
        position_qty: s.inPos ? s.qty : 0,
        entry_price: s.inPos ? s.entry : 0,
        tp_price: s.inPos ? s.entry + s.tp : 0,
        sl_price: s.inPos ? s.entry - s.sl : 0,
        cash_usd: 100000,
        equity: 100000 + (s.inPos ? (price - s.entry) * s.qty : 0),
        unrealized_pnl: s.inPos ? (price - s.entry) * s.qty : 0,
        trade_count: Math.floor(s.fills.length / 2),
        fills: s.fills.slice(),
      };
    }

    setInterval(() => {
      const price = 76500 + Math.sin((Date.now() - t0) / 4000) * 80;
      tickStrat(stratA, price);
      tickStrat(stratB, price);
      dispatch([
        snap('Doofus Rick', stratA, price),
        snap('Turbo Doofus Rick', stratB, price),
      ]);
    }, 250);
  }

  return { connect, onMessage, onStatus };
})();
