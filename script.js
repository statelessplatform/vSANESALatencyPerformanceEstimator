function recalc() {
  const hosts = +document.getElementById('hosts').value;
  const drives = +document.getElementById('drives').value;
  const ftt = +document.getElementById('ftt').value;
  const fttType = document.getElementById('fttType').value;

  const vms = +document.getElementById('vms').value;
  const iopsPerVm = +document.getElementById('iopsPerVm').value;
  const readPct = +document.getElementById('readPct').value / 100;
  const blockKB = +document.getElementById('blockSize').value;

  const nvme = +document.getElementById('nvme').value;
  const rtt = +document.getElementById('rtt').value;
  const esa = +document.getElementById('esa').value;

  const totalIops = vms * iopsPerVm;
  const totalDrives = hosts * drives;

  /* -------------------------------
     ESA write fan-out behavior
  --------------------------------*/
  let writeFactor = 1;
  if (fttType === 'mirror') writeFactor = ftt + 1;
  if (fttType === 'raid5') writeFactor = 1.33;
  if (fttType === 'raid6') writeFactor = 1.5;

  /* -------------------------------
     Queue & contention modeling
  --------------------------------*/
  const iopsPerDrive = totalIops / totalDrives;
  const queueFactor = Math.min(iopsPerDrive / 3000, 2.0);

  /* -------------------------------
     Block size amplification
  --------------------------------*/
  const blockFactor = Math.log2(blockKB / 8 + 1) * 0.15;

  /* -------------------------------
     Latency calculations (µs)
  --------------------------------*/
  const readUs =
    (nvme + esa) *
    (1 + queueFactor * 0.4 + blockFactor);

  const writeUs =
    (nvme + esa + rtt * writeFactor) *
    (1 + queueFactor * 0.6 + blockFactor);

  const p95Us = writeUs * 1.35;

  /* -------------------------------
     Output
  --------------------------------*/
  document.getElementById('readLat').textContent =
    (readUs / 1000).toFixed(2) + ' ms';

  document.getElementById('writeLat').textContent =
    (writeUs / 1000).toFixed(2) + ' ms';

  document.getElementById('p95Lat').textContent =
    (p95Us / 1000).toFixed(2) + ' ms';

  document.getElementById('nvmeOut').textContent = nvme + ' µs';
  document.getElementById('esaOut').textContent = esa + ' µs';
  document.getElementById('netOut').textContent =
    Math.round(rtt * writeFactor) + ' µs';

  document.getElementById('queueOut').textContent =
    '+' + Math.round(queueFactor * 100) + '%';

  document.getElementById('totalOut').textContent =
    (writeUs / 1000).toFixed(2) + ' ms';

  /* -------------------------------
     Health assessment
  --------------------------------*/
  const health = document.getElementById('health');

  if (writeUs < 2000) {
    health.className = 'alert alert-info';
    health.textContent =
      'Excellent: ESA latency well within steady-state production expectations.';
  } else if (writeUs < 5000) {
    health.className = 'alert alert-warning';
    health.textContent =
      'Acceptable: Monitor growth, resync impact, and VM fan-out.';
  } else {
    health.className = 'alert alert-danger';
    health.textContent =
      'At Risk: Consider more hosts, more NVMe drives, lower FTT, or EC.';
  }
}

/* -------------------------------
   Bind events safely
--------------------------------*/
[
  'hosts',
  'drives',
  'ftt',
  'fttType',
  'vms',
  'iopsPerVm',
  'readPct',
  'blockSize',
  'nvme',
  'rtt',
  'esa'
].forEach(id => {
  document.getElementById(id).addEventListener('input', recalc);
});

/* Initial calculation */
recalc();
