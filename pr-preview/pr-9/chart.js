function createChartPanel(root, cfg) {
  const container = root.querySelector('.chart');

  let currentInterval = 60;
  let chart = null;
  let series = null;

  let tpLine = null;
  let slLine = null;
  let entryLine = null;
  let lastFillCount = -1;

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

  function ensureLine(handle, price, color, title, solid) {
    const opts = {
      price,
      color,
      lineWidth: 1,
      lineStyle: solid ? LightweightCharts.LineStyle.Solid : LightweightCharts.LineStyle.Dashed,
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
    if (snap.in_position) {
      entryLine = ensureLine(entryLine, snap.entry_price, '#ff6600', 'ENT', true);
      tpLine    = ensureLine(tpLine,    snap.tp_price,    '#00c805', 'TP',  false);
      slLine    = ensureLine(slLine,    snap.sl_price,    '#ff3b30', 'SL',  false);
    } else {
      entryLine = removeLine(entryLine);
      tpLine    = removeLine(tpLine);
      slLine    = removeLine(slLine);
    }
  }

  function markerFor(fill) {
    const long = fill.side === 'long';
    const time = Math.floor(fill.ts_ms / 1000);
    if (fill.type === 'entry') {
      return long
        ? { time, position: 'belowBar', shape: 'arrowUp',   color: '#00c805', text: 'L' }
        : { time, position: 'aboveBar', shape: 'arrowDown', color: '#ff3b30', text: 'S' };
    }
    if (fill.type === 'tp_exit') {
      return long
        ? { time, position: 'aboveBar', shape: 'circle', color: '#00c805', text: 'TP' }
        : { time, position: 'belowBar', shape: 'circle', color: '#00c805', text: 'TP' };
    }
    // sl_exit
    return long
      ? { time, position: 'aboveBar', shape: 'circle', color: '#ff3b30', text: 'SL' }
      : { time, position: 'belowBar', shape: 'circle', color: '#ff3b30', text: 'SL' };
  }

  function applyFills(fills) {
    if (!series || !fills) return;
    // Full session history arrives every tick. Skip the redraw when nothing
    // new has appended, otherwise we'd rebuild markers 4× per second.
    if (fills.length === lastFillCount) return;
    lastFillCount = fills.length;
    const markers = fills
      .map(markerFor)
      .sort((a, b) => a.time - b.time);
    series.setMarkers(markers);
  }

  function clearOverlays() {
    entryLine = removeLine(entryLine);
    tpLine    = removeLine(tpLine);
    slLine    = removeLine(slLine);
    if (series) series.setMarkers([]);
    lastFillCount = -1;
  }

  return { init, handleOHLC, switchInterval, applyStrategyState, applyFills, clearOverlays };
}
