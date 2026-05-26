const Strategies = (() => {
  const tbody = document.getElementById('strategies-body');
  const PAPER_NAME = 'Doofus Rick';
  const STALE_MS = 10000;

  const data = [
    { name: PAPER_NAME, status: 'Offline', pair: 'BTC/USD', pnl: null, lastTrade: null },
  ];

  let staleTimer = null;

  function paperRow() {
    return data.find(s => s.name === PAPER_NAME) || data[0];
  }

  function statusClass(s) {
    return { running: 'status-running', offline: 'status-offline', error: 'status-error' }[s.toLowerCase()] || '';
  }

  function pnlCell(pnl) {
    if (pnl === null) return '—';
    const cls = pnl >= 0 ? 'up' : 'down';
    return `<span class="${cls}">${(pnl >= 0 ? '+' : '') + Fmt.num(pnl)}</span>`;
  }

  function render() {
    tbody.innerHTML = data.map(s => `<tr>
      <td>${s.name}</td>
      <td><span class="status-badge ${statusClass(s.status)}">${s.status.toUpperCase()}</span></td>
      <td>${s.pair}</td>
      <td>${pnlCell(s.pnl)}</td>
      <td>${s.lastTrade || '—'}</td>
    </tr>`).join('');
  }

  function pulse() {
    const badge = tbody.querySelector('.status-badge');
    if (!badge) return;
    badge.classList.remove('beat');
    void badge.offsetWidth; // restart the animation
    badge.classList.add('beat');
  }

  function applyHeartbeat(hb) {
    const row = paperRow();
    row.status = 'Running';
    if (hb.symbol) row.pair = hb.symbol;
    if (hb.unrealized_pnl != null) row.pnl = parseFloat(hb.unrealized_pnl);
    if (hb.in_position) {
      const side = (hb.side || '').toUpperCase();
      row.lastTrade = `${side} @ ${Fmt.num(hb.entry_price)} · ${hb.trade_count} trades`;
    } else {
      row.lastTrade = `FLAT · ${hb.trade_count} trades`;
    }
    render();
    pulse();

    clearTimeout(staleTimer);
    staleTimer = setTimeout(setOffline, STALE_MS);
  }

  function setOffline() {
    clearTimeout(staleTimer);
    paperRow().status = 'Offline';
    render();
  }

  render();

  return { applyHeartbeat, setOffline };
})();
