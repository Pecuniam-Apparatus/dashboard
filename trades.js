const TradesFeed = (() => {
  const listEl = document.getElementById('trades-list');
  const MAX = 60;
  const trades = [];

  function fmt(n, dec = 2) {
    return parseFloat(n).toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function render() {
    listEl.innerHTML = trades.map(t => `
      <div class="trade-row ${t.side}">
        <span class="trade-time">${fmtTime(t.timestamp)}</span>
        <span class="trade-price">${fmt(t.price)}</span>
        <span class="trade-qty">${fmt(t.qty, 4)}</span>
      </div>
    `).join('');
  }

  function handle(msg) {
    if (!msg.data) return;
    msg.data.forEach(t => trades.unshift(t));
    if (trades.length > MAX) trades.length = MAX;
    render();
  }

  return { handle };
})();
