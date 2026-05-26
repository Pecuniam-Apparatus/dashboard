const Strategies = (() => {
  const WS_URL = 'wss://bell-ipod-kilometers-producer.trycloudflare.com';
  const tbody = document.getElementById('strategies-body');

  let data = [];
  let ws = null;
  let reconnectDelay = 1000;

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

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (Array.isArray(msg)) {
          data = msg;
          render();
        } else if (msg && typeof msg === 'object') {
          const idx = data.findIndex(s => s.name === msg.name);
          if (idx >= 0) data[idx] = { ...data[idx], ...msg };
          else data.push(msg);
          render();
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => {
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        connect();
      }, reconnectDelay);
    };

    ws.onopen = () => { reconnectDelay = 1000; };
  }

  connect();

  return { data, render };
})();
