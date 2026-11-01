/**
 * CPU Performance Explorer - Live Device Monitor Controller
 * Connects directly to backend hardware telemetry (psutil)
 */

(function () {
  let isStreaming = true;
  let timerId = null;
  let cpuHistory = Array(15).fill(25);
  let memHistory = Array(15).fill(40);
  let ws = null;

  async function loadSpecs() {
    try {
      const specs = await apiFetch('/api/device/specifications');
      if (specs) {
        // Update processor name and specs
        const cpuNameEl = document.querySelector('.lg\\:col-span-6 .font-code-mono');
        if (cpuNameEl && specs.processor_name) {
          cpuNameEl.innerText = specs.processor_name;
        }

        // Update memory
        const specItems = document.querySelectorAll('.grid-cols-2.gap-x-space-md .font-code-mono');
        if (specItems.length >= 4) {
          specItems[0].innerText = specs.processor_name || 'Host Processor';
          specItems[1].innerText = `${specs.physical_cores} Cores / ${specs.logical_cores} Threads`;
          specItems[2].innerText = `${specs.memory_total_gb} GB System RAM`;
          specItems[3].innerText = `${specs.disk_total_gb} GB Storage • ${specs.os_name}`;
        }

        // Render dynamic core topology matrix
        renderCoreTopology(specs.logical_cores);
      }
    } catch (e) {
      console.warn('Specs load notice:', e.message);
    }
  }

  function renderCoreTopology(coreCount) {
    const grid = document.querySelector('.grid-cols-4.gap-2.mb-space-md');
    if (!grid) return;

    grid.innerHTML = '';
    const count = Math.min(coreCount || 8, 16);
    for (let i = 0; i < count; i++) {
      const cell = document.createElement('div');
      cell.className = 'bg-surface-container-low p-2 rounded-lg flex flex-col items-center core-cell';
      cell.id = `core-cell-${i}`;
      cell.innerHTML = `
        <span class="font-label-xs text-label-xs text-on-surface-variant">Core ${i}</span>
        <span class="font-code-mono text-label-sm font-bold text-primary" id="core-val-${i}">--%</span>
        <span class="font-label-xs text-label-xs text-outline" id="core-temp-${i}">Active</span>
      `;
      grid.appendChild(cell);
    }
  }

  function updateGauges(data) {
    const CIRCLE_CIRCUMFERENCE = 188.5;

    // CPU Gauge
    const cpuVal = Math.round(data.cpu_percent || 0);
    const cpuEl = document.getElementById('gauge-cpu-val');
    const cpuRing = document.getElementById('gauge-cpu-ring');
    if (cpuEl) cpuEl.innerText = `${cpuVal}%`;
    if (cpuRing) {
      const offset = CIRCLE_CIRCUMFERENCE - (cpuVal / 100) * CIRCLE_CIRCUMFERENCE;
      cpuRing.style.strokeDashoffset = offset;
    }

    // Memory Gauge
    const memVal = Math.round(data.memory_percent || 0);
    const memEl = document.getElementById('gauge-mem-val');
    const memRing = document.getElementById('gauge-mem-ring');
    if (memEl) memEl.innerText = `${memVal}%`;
    if (memRing) {
      const offset = CIRCLE_CIRCUMFERENCE - (memVal / 100) * CIRCLE_CIRCUMFERENCE;
      memRing.style.strokeDashoffset = offset;
    }

    // Temp Gauge (estimated from load if sensors not exposed)
    const tempVal = Math.round(data.temperature_c || (42 + cpuVal * 0.35));
    const tempEl = document.getElementById('gauge-temp-val');
    const tempRing = document.getElementById('gauge-temp-ring');
    if (tempEl) tempEl.innerText = `${tempVal}°C`;
    if (tempRing) {
      const offset = CIRCLE_CIRCUMFERENCE - (Math.min(tempVal, 100) / 100) * CIRCLE_CIRCUMFERENCE;
      tempRing.style.strokeDashoffset = offset;
    }

    // Disk I/O Gauge
    const diskVal = Math.round(data.disk_percent || 30);
    const diskEl = document.getElementById('gauge-disk-val');
    const diskRing = document.getElementById('gauge-disk-ring');
    if (diskEl) diskEl.innerText = `${diskVal}%`;
    if (diskRing) {
      const offset = CIRCLE_CIRCUMFERENCE - (diskVal / 100) * CIRCLE_CIRCUMFERENCE;
      diskRing.style.strokeDashoffset = offset;
    }

    // Memory Stats in header & chart
    const memUsedGb = data.memory_used_gb || (data.memory_percent * 0.64).toFixed(1);
    const memTotalGb = data.memory_total_gb || 64.0;
    const memSubText = document.querySelector('.text-right .font-title-md');
    if (memSubText) {
      memSubText.innerHTML = `${memUsedGb} <span class="text-on-surface-variant font-normal font-body-sm text-body-sm">/ ${memTotalGb} GB</span>`;
    }

    // Telemetry Micro-Cards
    const freqEl = document.querySelector('.font-headline-md.text-headline-md.font-bold.text-on-surface.font-code-mono');
    if (freqEl && data.frequency_mhz) {
      freqEl.innerText = `${(data.frequency_mhz / 1000).toFixed(2)} GHz`;
    }

    // Per-core matrix update
    if (Array.isArray(data.per_core_percent)) {
      data.per_core_percent.forEach((val, idx) => {
        const valEl = document.getElementById(`core-val-${idx}`);
        if (valEl) {
          valEl.innerText = `${Math.round(val)}%`;
          valEl.className = val > 80 ? 'font-code-mono text-label-sm font-bold text-red-600' :
                            val > 50 ? 'font-code-mono text-label-sm font-bold text-amber-600' :
                            'font-code-mono text-label-sm font-bold text-primary';
        }
      });
    }

    // Update Sparkline History & Wave SVGs
    cpuHistory.push(cpuVal);
    cpuHistory.shift();
    memHistory.push(memVal);
    memHistory.shift();
    updateWavePath('cpu-line-path', 'cpu-fill-path', cpuHistory);
    updateWavePath('mem-line-path', 'mem-fill-path', memHistory);

    // Sync timestamp
    const syncTime = document.getElementById('sync-timestamp');
    if (syncTime) {
      syncTime.innerText = new Date().toLocaleTimeString();
    }
  }

  function updateWavePath(lineId, fillId, points) {
    const lineEl = document.getElementById(lineId);
    const fillEl = document.getElementById(fillId);
    if (!lineEl || !fillEl) return;

    const width = 500;
    const height = 120;
    const step = width / (points.length - 1);

    let d = `M 0,${height - (points[0] / 100) * 100}`;
    for (let i = 1; i < points.length; i++) {
      const prevX = (i - 1) * step;
      const prevY = height - (points[i - 1] / 100) * 100;
      const currX = i * step;
      const currY = height - (points[i] / 100) * 100;
      const cpX1 = prevX + step * 0.5;
      const cpX2 = currX - step * 0.5;
      d += ` C ${cpX1.toFixed(1)},${prevY.toFixed(1)} ${cpX2.toFixed(1)},${currY.toFixed(1)} ${currX.toFixed(1)},${currY.toFixed(1)}`;
    }

    lineEl.setAttribute('d', d);
    fillEl.setAttribute('d', `${d} L 500,${height} L 0,${height} Z`);
  }

  async function loadProcesses() {
    try {
      const procs = await apiFetch('/api/device/processes?limit=6');
      if (Array.isArray(procs)) {
        renderProcessTable(procs);
      }
    } catch (e) {
      console.warn('Process table fetch error:', e.message);
    }
  }

  function renderProcessTable(procs) {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    procs.forEach((p, idx) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-surface-container-low/50 transition-colors';
      const icon = p.name.includes('code') ? 'code' :
                   p.name.includes('chrome') || p.name.includes('edge') ? 'tab' :
                   p.name.includes('python') ? 'terminal' : 'memory';

      row.innerHTML = `
        <td class="py-3 px-3 flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-surface-container-high flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-[15px]">${icon}</span>
          </div>
          <div class="font-semibold text-on-surface truncate max-w-[160px]">${p.name}</div>
        </td>
        <td class="py-3 px-3 font-code-mono text-code-mono text-on-surface-variant">${p.pid}</td>
        <td class="py-3 px-3 font-code-mono text-code-mono">${p.threads || 4}</td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-surface-container-high h-2 rounded-full overflow-hidden">
              <div class="bg-primary h-full rounded-full" style="width: ${Math.min(p.cpu_percent * 2, 100)}%;"></div>
            </div>
            <span class="font-code-mono text-code-mono font-semibold text-primary">${p.cpu_percent.toFixed(1)}%</span>
          </div>
        </td>
        <td class="py-3 px-3 font-code-mono text-code-mono">
          <span class="text-on-surface">${p.memory_mb.toFixed(0)} MB</span>
        </td>
        <td class="py-3 px-3 text-right">
          <span class="px-2 py-0.5 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-xs text-label-xs font-bold">${p.status || 'Active'}</span>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  async function pollLiveTelemetry() {
    if (!isStreaming) return;
    try {
      const data = await apiFetch('/api/device/live');
      if (data) {
        updateGauges(data);
      }
    } catch (e) {
      console.warn('Telemetry polling note:', e.message);
    }
  }

  function setupControls() {
    const toggleBtn = document.getElementById('toggle-stream-btn');
    const pauseIcon = document.getElementById('pause-icon');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        isStreaming = !isStreaming;
        if (pauseIcon) {
          pauseIcon.innerText = isStreaming ? 'pause' : 'play_arrow';
        }
        if (window.showToast) {
          window.showToast(isStreaming ? 'Live stream resumed' : 'Telemetry paused', 'info');
        }
      });
    }

    const refreshBtn = document.getElementById('refresh-telemetry-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('animate-spin');
        await pollLiveTelemetry();
        await loadProcesses();
        setTimeout(() => refreshBtn.classList.remove('animate-spin'), 600);
      });
    }
  }

  function init() {
    loadSpecs();
    setupControls();
    pollLiveTelemetry();
    loadProcesses();

    // Start polling loop
    const pollingRate = parseInt(localStorage.getItem('cpu_explorer_polling_ms') || '1500', 10);
    timerId = setInterval(pollLiveTelemetry, pollingRate);
    setInterval(loadProcesses, 4500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
