const Strategies = (() => {
  const tbody = document.getElementById('strategies-body');
  const statusEl = document.getElementById('strategies-status');
  const STALE_MS = 10000;

  // Row state keyed by `${strategy_name}|${symbol}`. Tracks the previous
  // last_price per key so we can flash the cell on change (same pattern as
  // ticker.js for the chart ticker).
  const rows = new Map();

  let staleTimer = null;

  function keyOf(snap) {
    return `${snap.strategy_name}|${snap.symbol}`;
  }

  function sideBadge(side) {
    const s = (side || 'flat').toLowerCase();
    return `<span class="side-badge ${s}">${s.toUpperCase()}</span>`;
  }

  function pnlCell(pnl) {
    const n = parseFloat(pnl);
    if (!Number.isFinite(n)) return '—';
    const cls = n >= 0 ? 'up' : 'down';
    return `<span class="${cls}">${(n >= 0 ? '+' : '') + Fmt.num(n)}</span>`;
  }

  function priceOrDash(v, inPos) {
    return inPos && v ? Fmt.num(v) : '—';
  }

  function renderRow(snap, prev) {
    const flashCls =
      prev != null && snap.last_price !== prev
        ? (snap.last_price > prev ? 'flash-up' : 'flash-down')
        : '';
    return `<tr data-key="${keyOf(snap)}">
      <td>${snap.strategy_name}</td>
      <td>${snap.symbol}</td>
      <td>${sideBadge(snap.side)}</td>
      <td>${snap.in_position ? Fmt.num(snap.position_qty, 4) : '—'}</td>
      <td>${priceOrDash(snap.entry_price, snap.in_position)}</td>
      <td>${priceOrDash(snap.tp_price, snap.in_position)}</td>
      <td>${priceOrDash(snap.sl_price, snap.in_position)}</td>
      <td class="last-cell ${flashCls}">${Fmt.num(snap.last_price)}</td>
      <td>${pnlCell(snap.unrealized_pnl)}</td>
      <td>${Fmt.num(snap.equity)}</td>
      <td>${snap.trade_count}</td>
    </tr>`;
  }

  function render() {
    // Sort by name|symbol for stable row order across ticks.
    const ordered = Array.from(rows.values()).sort((a, b) =>
      keyOf(a.snap).localeCompare(keyOf(b.snap))
    );
    tbody.innerHTML = ordered.map(r => renderRow(r.snap, r.prevPrice)).join('');
  }

  function setStatus(status) {
    const cls = { running: 'status-running', offline: 'status-offline', error: 'status-error' }[status.toLowerCase()] || '';
    statusEl.className = 'status-badge ' + cls;
    statusEl.textContent = status.toUpperCase();
  }

  function pulse() {
    statusEl.classList.remove('beat');
    void statusEl.offsetWidth; // restart the animation
    statusEl.classList.add('beat');
  }

  function applyAll(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(snap => {
      const k = keyOf(snap);
      const prev = rows.get(k);
      rows.set(k, {
        snap,
        prevPrice: prev ? prev.snap.last_price : null,
      });
    });
    setStatus('Running');
    render();
    pulse();

    clearTimeout(staleTimer);
    staleTimer = setTimeout(setOffline, STALE_MS);
  }

  function removeStrategy(key) {
    rows.delete(key);
    render();
  }

  function setOffline() {
    clearTimeout(staleTimer);
    setStatus('Offline');
  }

  setStatus('Offline');
  render();

  return { applyAll, setOffline, removeStrategy };
})();
