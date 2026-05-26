const Strategies = (() => {
  const tbody = document.getElementById('strategies-body');
  const statusEl = document.getElementById('strategies-status');
  const PAPER_NAME = 'Doofus Rick';
  const STALE_MS = 10000;

  // All strategies share one feed, so status is global: either all online or none.
  const data = [
    { name: PAPER_NAME, pair: 'BTC/USD', pnl: null, lastTrade: null },
  ];

  let staleTimer = null;

  function paperRow() {
    return data.find(s => s.name === PAPER_NAME) || data[0];
  }

  function pnlCell(pnl) {
    if (pnl === null) return '—';
    const cls = pnl >= 0 ? 'up' : 'down';
    return `<span class="${cls}">${(pnl >= 0 ? '+' : '') + Fmt.num(pnl)}</span>`;
  }

  function render() {
    tbody.innerHTML = data.map(s => `<tr>
      <td>${s.name}</td>
      <td>${s.pair}</td>
      <td>${pnlCell(s.pnl)}</td>
      <td>${s.lastTrade || '—'}</td>
    </tr>`).join('');
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

  function applyHeartbeat(hb) {
    const row = paperRow();
    if (hb.symbol) row.pair = hb.symbol;
    if (hb.unrealized_pnl != null) row.pnl = parseFloat(hb.unrealized_pnl);
    if (hb.in_position) {
      const side = (hb.side || '').toUpperCase();
      row.lastTrade = `${side} @ ${Fmt.num(hb.entry_price)} · ${hb.trade_count} trades`;
    } else {
      row.lastTrade = `FLAT · ${hb.trade_count} trades`;
    }
    setStatus('Running');
    render();
    pulse();

    clearTimeout(staleTimer);
    staleTimer = setTimeout(setOffline, STALE_MS);
  }

  function setOffline() {
    clearTimeout(staleTimer);
    setStatus('Offline');
  }

  setStatus('Offline');
  render();

  return { applyHeartbeat, setOffline };
})();
