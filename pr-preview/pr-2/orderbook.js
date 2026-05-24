function createOrderBook(root) {
  const asksEl  = root.querySelector('.asks-container');
  const bidsEl  = root.querySelector('.bids-container');
  const spreadEl = root.querySelector('.spread-value');
  const DEPTH = 15;

  const bids = new Map();
  const asks = new Map();

  function applyLevels(map, levels) {
    levels.forEach(({ price, qty }) => {
      const q = parseFloat(qty);
      if (q === 0) map.delete(price);
      else map.set(price, q);
    });
  }

  function fmt(n, dec = 2) {
    return parseFloat(n).toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  }

  function sortedTop(map, descending) {
    return Array.from(map.entries())
      .sort((a, b) => descending
        ? parseFloat(b[0]) - parseFloat(a[0])
        : parseFloat(a[0]) - parseFloat(b[0]))
      .slice(0, DEPTH);
  }

  function renderRows(container, levels, side, maxQty) {
    container.innerHTML = levels.map(([price, qty]) => {
      const pct = (qty / maxQty * 100).toFixed(1);
      const bar = side === 'bid'
        ? `background: linear-gradient(to left, rgba(0,200,5,0.12) ${pct}%, transparent ${pct}%)`
        : `background: linear-gradient(to right, rgba(255,59,48,0.12) ${pct}%, transparent ${pct}%)`;
      return `<div class="ob-row ${side}" style="${bar}">
        <span class="ob-qty">${fmt(qty, 4)}</span>
        <span class="ob-price">${fmt(price)}</span>
      </div>`;
    }).join('');
  }

  function render() {
    const bidLevels = sortedTop(bids, true);
    const askLevels = sortedTop(asks, false);

    const maxQty = Math.max(
      ...bidLevels.map(([, q]) => q),
      ...askLevels.map(([, q]) => q),
      1
    );

    // Asks rendered bottom-up so lowest ask is nearest the spread
    renderRows(asksEl, [...askLevels].reverse(), 'ask', maxQty);
    renderRows(bidsEl, bidLevels, 'bid', maxQty);

    const bestBid = bidLevels[0] ? parseFloat(bidLevels[0][0]) : null;
    const bestAsk = askLevels[0] ? parseFloat(askLevels[0][0]) : null;
    if (bestBid !== null && bestAsk !== null) {
      spreadEl.textContent = `SPREAD  ${fmt(bestAsk - bestBid)}`;
    }
  }

  function handle(msg) {
    if (!msg.data) return;
    msg.data.forEach(d => {
      if (d.bids) applyLevels(bids, d.bids);
      if (d.asks) applyLevels(asks, d.asks);
    });
    render();
  }

  return { handle };
}
