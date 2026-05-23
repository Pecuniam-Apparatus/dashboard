function createTicker(root) {
  const lastPriceEl = root.querySelector('.last-price');
  const changeEl    = root.querySelector('.ticker-change');
  const highEl      = root.querySelector('.ticker-high');
  const lowEl       = root.querySelector('.ticker-low');
  const volumeEl    = root.querySelector('.ticker-volume');

  let prevPrice = null;
  let flashTimer = null;

  function fmt(n, dec = 2) {
    return parseFloat(n).toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  }

  function update(data) {
    const price = parseFloat(data.last);

    if (prevPrice !== null && price !== prevPrice) {
      clearTimeout(flashTimer);
      lastPriceEl.classList.remove('up', 'down');
      // Force reflow so transition restarts
      void lastPriceEl.offsetWidth;
      lastPriceEl.classList.add(price > prevPrice ? 'up' : 'down');
      flashTimer = setTimeout(() => lastPriceEl.classList.remove('up', 'down'), 600);
    }
    prevPrice = price;

    lastPriceEl.textContent = fmt(price);

    const pct = parseFloat(data.change_pct);
    changeEl.textContent = (pct >= 0 ? '+' : '') + fmt(pct) + '%';
    changeEl.className = pct >= 0 ? 'up' : 'down';

    highEl.textContent = fmt(data.high);
    lowEl.textContent  = fmt(data.low);

    const vol = parseFloat(data.volume);
    volumeEl.textContent = vol >= 1000 ? fmt(vol / 1000, 1) + 'K' : fmt(vol, 2);
  }

  return { update };
}
