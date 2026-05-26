function createTradesFeed(root) {
  const listEl = root.querySelector('.trades-list');
  const MAX = 60;
  const trades = [];

  function render() {
    listEl.innerHTML = trades.map(t => `
      <div class="trade-row ${t.side}">
        <span class="trade-time">${Fmt.time(t.timestamp)}</span>
        <span class="trade-price">${Fmt.num(t.price)}</span>
        <span class="trade-qty">${Fmt.num(t.qty, 4)}</span>
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
}
