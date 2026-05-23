function createChartPanel(root, cfg) {
  const container = root.querySelector('.chart');

  let currentInterval = 1;
  let chart = null;
  let series = null;

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

  return { init, handleOHLC, switchInterval };
}
