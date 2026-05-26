function createChartPanel(root, cfg) {
  const container = root.querySelector('.chart');

  let currentInterval = 60;
  let chart = null;
  let series = null;

  // Overlay state is per-strategy so the chart can show multiple strategies'
  // TP/SL/entry lines and fill markers at once, all color-coded by strategy.
  // key: strategy_name -> { entryLine, tpLine, slLine, fills, color }
  const overlays = new Map();
  let lastMarkerSig = '';

  function colorForStrategy(name) {
    // Deterministic hue from the strategy name; fixed S/L keep contrast
    // consistent against the dark theme.
    let h = 0;
    for (let i = 0; i < name.length; i++) {
      h = (h * 31 + name.charCodeAt(i)) | 0;
    }
    const hue = ((h % 360) + 360) % 360;
    return `hsl(${hue}, 70%, 62%)`;
  }

  function init() {
    chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: '#111111' },
        textColor: '#e0e0e0',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        minBarSpacing: 4,
      },
    });

    series = chart.addCandlestickSeries({
      upColor:        '#00c805',
      downColor:      '#ff3b30',
      borderUpColor:  '#00c805',
      borderDownColor:'#ff3b30',
      wickUpColor:    '#00c805',
      wickDownColor:  '#ff3b30',
    });

    new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    }).observe(container);

    loadHistory(currentInterval);
  }

  async function loadHistory(interval) {
    try {
      const resp = await fetch(
        `https://api.kraken.com/0/public/OHLC?pair=${cfg.pair}&interval=${interval}`
      );
      const json = await resp.json();
      if (json.error && json.error.length) {
        console.error('Kraken REST error:', json.error);
        return;
      }
      const key = Object.keys(json.result).find(k => k !== 'last');
      const candles = json.result[key].map(([time, open, high, low, close]) => ({
        time: Number(time),
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
      }));
      series.setData(candles);
      chart.timeScale().scrollToRealTime();
    } catch (e) {
      console.error('Failed to load chart history:', e);
    }
  }

  function switchInterval(interval) {
    if (interval === currentInterval) return;
    currentInterval = interval;
    // Lines must be nulled BEFORE setData([]) — stale refs can throw inside
    // lightweight-charts when the underlying series points are dropped.
    clearOverlays();
    series.setData([]);
    loadHistory(interval);
  }

  function handleOHLC(msg) {
    if (!msg.data) return;
    msg.data.forEach(candle => {
      const ts = candle.interval_begin || candle.timestamp;
      series.update({
        time:  Math.floor(new Date(ts).getTime() / 1000),
        open:  parseFloat(candle.open),
        high:  parseFloat(candle.high),
        low:   parseFloat(candle.low),
        close: parseFloat(candle.close),
      });
    });
  }

  // ---- Strategy overlays ----

  function getOverlay(name) {
    let o = overlays.get(name);
    if (!o) {
      o = {
        entryLine: null, tpLine: null, slLine: null,
        fills: [],
        color: colorForStrategy(name),
      };
      overlays.set(name, o);
    }
    return o;
  }

  function ensureLine(handle, price, color, title, style) {
    const opts = {
      price,
      color,
      lineWidth: 1,
      lineStyle: style,
      axisLabelVisible: true,
      title,
    };
    if (handle) {
      handle.applyOptions(opts);
      return handle;
    }
    return series.createPriceLine(opts);
  }

  function removeLine(handle) {
    if (handle) series.removePriceLine(handle);
    return null;
  }

  function applyStrategyState(snap) {
    if (!series) return;
    const o = getOverlay(snap.strategy_name);
    // Short label keeps the axis tag readable when several strategies overlap.
    const tag = snap.strategy_name.slice(0, 6);
    if (snap.in_position) {
      o.entryLine = ensureLine(o.entryLine, snap.entry_price, o.color, `${tag} ENT`, LightweightCharts.LineStyle.Solid);
      o.tpLine    = ensureLine(o.tpLine,    snap.tp_price,    o.color, `${tag} TP`,  LightweightCharts.LineStyle.Dashed);
      o.slLine    = ensureLine(o.slLine,    snap.sl_price,    o.color, `${tag} SL`,  LightweightCharts.LineStyle.Dotted);
    } else {
      o.entryLine = removeLine(o.entryLine);
      o.tpLine    = removeLine(o.tpLine);
      o.slLine    = removeLine(o.slLine);
    }
  }

  function markerFor(fill, color) {
    const long = fill.side === 'long';
    const time = Math.floor(fill.ts_ms / 1000);
    if (fill.type === 'entry') {
      return long
        ? { time, position: 'belowBar', shape: 'arrowUp',   color, text: 'L' }
        : { time, position: 'aboveBar', shape: 'arrowDown', color, text: 'S' };
    }
    if (fill.type === 'tp_exit') {
      return {
        time,
        position: long ? 'aboveBar' : 'belowBar',
        shape: 'circle', color, text: 'TP',
      };
    }
    // sl_exit
    return {
      time,
      position: long ? 'aboveBar' : 'belowBar',
      shape: 'circle', color, text: 'SL',
    };
  }

  function renderMarkers() {
    if (!series) return;
    const all = [];
    overlays.forEach(o => {
      o.fills.forEach(f => all.push(markerFor(f, o.color)));
    });
    all.sort((a, b) => a.time - b.time);
    // Cheap signature so the redraw is skipped when nothing changed across
    // ticks (the feed re-sends the full fill array every 250 ms).
    const sig = all.length + ':' + (all.length ? all[all.length - 1].time : 0);
    if (sig === lastMarkerSig) return;
    lastMarkerSig = sig;
    series.setMarkers(all);
  }

  function applyFills(strategyName, fills) {
    if (!series || !fills) return;
    const o = getOverlay(strategyName);
    o.fills = fills;
    renderMarkers();
  }

  function removeStrategy(strategyName) {
    const o = overlays.get(strategyName);
    if (!o) return;
    o.entryLine = removeLine(o.entryLine);
    o.tpLine    = removeLine(o.tpLine);
    o.slLine    = removeLine(o.slLine);
    overlays.delete(strategyName);
    renderMarkers();
  }

  function clearOverlays() {
    overlays.forEach(o => {
      o.entryLine = removeLine(o.entryLine);
      o.tpLine    = removeLine(o.tpLine);
      o.slLine    = removeLine(o.slLine);
    });
    overlays.clear();
    if (series) series.setMarkers([]);
    lastMarkerSig = '';
  }

  return {
    init, handleOHLC, switchInterval,
    applyStrategyState, applyFills, removeStrategy, clearOverlays,
    colorForStrategy,
  };
}
