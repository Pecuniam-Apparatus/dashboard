const Strategies = (() => {
  const tbody = document.getElementById('strategies-body');

  const data = [
    { name: 'Doofus Rick', status: 'Offline', pair: 'BTC/USD', pnl: null, lastTrade: null },
  ];

  function statusClass(s) {
    return { running: 'status-running', offline: 'status-offline', error: 'status-error' }[s.toLowerCase()] || '';
  }

  function render() {
    tbody.innerHTML = data.map(s => `<tr>
      <td>${s.name}</td>
      <td><span class="status-badge ${statusClass(s.status)}">${s.status.toUpperCase()}</span></td>
      <td>${s.pair}</td>
      <td>${s.pnl !== null ? (s.pnl >= 0 ? '+' : '') + s.pnl.toFixed(2) : '—'}</td>
      <td>${s.lastTrade || '—'}</td>
    </tr>`).join('');
  }

  render();

  return { data, render };
})();
