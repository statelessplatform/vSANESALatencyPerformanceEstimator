function recalc() {
  /* ===============================
     Read Inputs
  =============================== */
  const hosts     = +document.getElementById('hosts').value;
  const drives    = +document.getElementById('drives').value;
  const ftt       = +document.getElementById('ftt').value;
  const fttType   = document.getElementById('fttType').value;

  const vms       = +document.getElementById('vms').value;
  const iopsPerVm = +document.getElementById('iopsPerVm').value;
  const readPct   = +document.getElementById('readPct').value / 100;
  const blockKB   = +document.getElementById('blockSize').value;

  const nvme      = +document.getElementById('nvme').value;
  const rtt       = +document.getElementById('rtt').value;
  const esa       = +document.getElementById('esa').value;

  const health = document.getElementById('health');

  /* ===============================
     Guardrails – Hard Limits
     (Stop calculation)
  =============================== */
  const errors = [];
  const warnings = [];

  if (hosts < 3 || hosts > 64)
    errors.push('vSAN ESA clusters must have between 3 and 64 hosts.');

  if (drives < 1 || drives > 24)
    errors.push('NVMe drives per host must be between 1 and 32.');

  if (vms < 1 || vms > 10000)
    errors.push('VM count must be between 1 and 10,000 per cluster.');

  if (iopsPerVm < 1 || iopsPerVm > 10000)
    warnings.push('IOPS per VM is unusually high; verify workload realism.');

  if (blockKB < 8 || blockKB > 1024)
    errors.push('Block size must be between 8 KB and 1 MB.');

  if (ftt < 1 || ftt > 3)
    errors.push('FTT must be between 1 and 3.');

  /* ===============================
     Availability Policy Guardrails
  =============================== */
  if (fttType === 'raid5' && hosts < 4)
    errors.push('RAID-5 requires a minimum of 4 hosts.');

  if (fttType === 'raid6' && hosts < 6)
    errors.push('RAID-6 requires a minimum of 6 hosts.');

  if (ftt === 3 && fttType === 'raid5')
    errors.push('FTT=3 is not supported with RAID-5.');

  if (ftt === 3 && fttType === 'mirror')
    warnings.push('FTT=3 with mirroring significantly increases write latency and network traffic.');

  /* ===============================
     Density & Design Warnings
  =============================== */
  const vmsPerHost = vms / hosts;
  if (vmsPerHost > 200)
    warnings.push('VM density per host is high; tail latency may increase.');

  if (drives < 4)
    warnings.push('Less than 4 NVMe drives per host reduces parallelism and increases queue depth.');

  if (hosts <= ftt + 1)
    warnings.push('Minimal host count for selected FTT reduces operational headroom.');

  if (rtt > 300)
    warnings.push('High network RTT will directly impact ESA write latency.');

  /* ===============================
     Handle Errors
  =============================== */
  if (errors.length > 0) {
    health.className = 'alert alert-danger';
    health.innerHTML = '<strong>Invalid configuration:</strong><br>' + errors.join('<br>');
    clearOutputs();
    return;
  }

  /* ===============================
     ESA Performance Model
  =============================== */
  const totalIops   = vms * iopsPerVm;
  const totalDrives = hosts * drives;

  /* Write fan-out factor */
  let writeFactor = 1;
  if (fttType === 'mirror') writeFactor = ftt + 1;
  if (fttType === 'raid5')  writeFactor = 1.33;
  if (fttType === 'raid6')  writeFactor = 1.5;

  /* Queue pressure */
  const iopsPerDrive = totalIops / totalDrives;
  const queueFactor  = Math.min(iopsPerDrive / 3000, 2.0);

  /* Block size amplification */
  const blockFactor = Math.log2(blockKB / 8 + 1) * 0.15;

  /* Latency (µs) */
  const readUs =
    (nvme + esa) *
    (1 + queueFactor * 0.4 + blockFactor);

  const writeUs =
    (nvme + esa + rtt * writeFactor) *
    (1 + queueFactor * 0.6 + blockFactor);

  const p95Us = writeUs * 1.35;

  /* ===============================
     Output Results
  =============================== */
  document.getElementById('readLat').textContent  = (readUs / 1000).toFixed(2) + ' ms';
  document.getElementById('writeLat').textContent = (writeUs / 1000).toFixed(2) + ' ms';
  document.getElementById('p95Lat').textContent   = (p95Us / 1000).toFixed(2) + ' ms';

  document.getElementById('nvmeOut').textContent  = nvme + ' µs';
  document.getElementById('esaOut').textContent   = esa + ' µs';
  document.getElementById('netOut').textContent   = Math.round(rtt * writeFactor) + ' µs';
  document.getElementById('queueOut').textContent = '+' + Math.round(queueFactor * 100) + '%';
  document.getElementById('totalOut').textContent = (writeUs / 1000).toFixed(2) + ' ms';

  /* ===============================
     Health Status
  =============================== */
  if (warnings.length > 0) {
    health.className = 'alert alert-warning';
    health.innerHTML =
      '<strong>Configuration warnings:</strong><br>' + warnings.join('<br>');
  } else if (writeUs < 2000) {
    health.className = 'alert alert-info';
    health.textContent =
      'Excellent: ESA latency well within steady-state production expectations.';
  } else if (writeUs < 5000) {
    health.className = 'alert alert-warning';
    health.textContent =
      'Acceptable: Monitor growth, VM fan-out, and failure scenarios.';
  } else {
    health.className = 'alert alert-danger';
    health.textContent =
      'At Risk: Consider more hosts, more NVMe drives, EC policies, or lower FTT.';
  }
}

/* ===============================
   Utility
=============================== */
function clearOutputs() {
  ['readLat','writeLat','p95Lat','nvmeOut','esaOut','netOut','queueOut','totalOut']
    .forEach(id => document.getElementById(id).textContent = '–');
}

/* ===============================
   Bind Live Updates
=============================== */
[
  'hosts','drives','ftt','fttType','vms','iopsPerVm',
  'readPct','blockSize','nvme','rtt','esa'
].forEach(id => {
  document.getElementById(id).addEventListener('input', recalc);
});

/* Initial run */
recalc();
