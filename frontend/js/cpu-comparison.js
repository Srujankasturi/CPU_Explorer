/**
 * CPU Performance Explorer - CPU Comparison Controller
 * Compares two CPU architectures, computes speedup factor:
 * S = Execution_Time(Base) / Execution_Time(Target)
 */

(function () {
  let presetsData = [];
  let currentActiveTab = 'metric';

  const state = {
    cpuA: {
      name: "Zen 4 (Base)",
      frequency_ghz: 2.5,
      cpi: 3.20,
      instruction_count: 10000
    },
    cpuB: {
      name: "Raptor Lake (Optimized)",
      frequency_ghz: 3.0,
      cpi: 2.47,
      instruction_count: 10000
    }
  };

  async function loadPresets() {
    try {
      const res = await apiFetch('/api/comparison/presets');
      const list = Array.isArray(res) ? res : (res?.presets || []);
      if (list.length > 0) {
        presetsData = list;
        renderPresetDropdown();
      }
    } catch (e) {
      console.warn('Presets note:', e.message);
    }
  }

  function renderPresetDropdown() {
    const select = document.getElementById('comparison-preset-select') || document.querySelector('.relative select');
    if (!select || presetsData.length === 0) return;

    select.innerHTML = '';
    presetsData.forEach((p, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.innerText = `Preset: ${p.name || (p.cpu_a.name + ' vs ' + p.cpu_b.name)}`;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      const selected = presetsData[select.value];
      if (selected) {
        state.cpuA = { ...selected.cpu_a };
        state.cpuB = { ...selected.cpu_b };
        runComparison();
      }
    });
  }

  async function runComparison() {
    try {
      const res = await apiFetch('/api/comparison/analyze', {
        method: 'POST',
        body: JSON.stringify({
          cpu_a: state.cpuA,
          cpu_b: state.cpuB
        })
      });

      if (res) {
        updateUI(res);
      }
    } catch (e) {
      console.error('Comparison error:', e);
      if (window.showToast) window.showToast('Comparison failed: ' + e.message, 'error');
    }
  }

  function formatNumber(num, decimals = 2) {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return Number(num).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function updateUI(data) {
    const cpuA = data.cpu_a || {};
    const cpuB = data.cpu_b || {};
    const speedupPct = data.speedup_pct ?? 0;
    const speedFactor = (data.speedup_factor ?? 1.0).toFixed(2);

    // 1. Header Speedup Badge & Factor
    const badge = document.getElementById("speedup-badge");
    if (badge) {
      const isPositive = speedupPct >= 0;
      badge.innerHTML = isPositive
        ? `<span class="material-symbols-outlined text-[28px] text-primary">trending_up</span>
           <span class="font-headline-xl text-headline-xl text-primary">+${speedupPct.toFixed(1)}%</span>`
        : `<span class="material-symbols-outlined text-[28px] text-error">trending_down</span>
           <span class="font-headline-xl text-headline-xl text-error">${speedupPct.toFixed(1)}%</span>`;
    }

    const factorEl = document.getElementById("speedup-factor");
    if (factorEl) {
      factorEl.innerText = `S = ${speedFactor}x Speedup Differential`;
    }

    // 2. Formula Bar
    const tBaseEl = document.getElementById('formula-t-base');
    const tOptEl = document.getElementById('formula-t-opt');
    const factorFormulaEl = document.getElementById('formula-factor');
    if (tBaseEl) tBaseEl.innerText = `${formatNumber(cpuA.execution_time_ms, 2)}ms`;
    if (tOptEl) tOptEl.innerText = `${formatNumber(cpuB.execution_time_ms, 2)}ms`;
    if (factorFormulaEl) factorFormulaEl.innerText = `${speedFactor}x`;

    // 3. CPU A Card
    const nameA = document.getElementById('cpu-a-name');
    if (nameA) nameA.innerText = `${cpuA.name || 'CPU - A'} • ${cpuA.frequency_ghz?.toFixed(2)} GHz Nominal`;
    const freqA = document.getElementById('cpu-a-freq');
    if (freqA) freqA.innerText = `${cpuA.frequency_ghz?.toFixed(2)} GHz`;
    const cpiA = document.getElementById('cpu-a-cpi');
    if (cpiA) cpiA.innerText = formatNumber(cpuA.cpi, 2);
    const ipcA = document.getElementById('cpu-a-ipc');
    if (ipcA) ipcA.innerText = formatNumber(cpuA.ipc, 2);
    const instA = document.getElementById('cpu-a-inst');
    if (instA) instA.innerText = `${formatNumber(cpuA.instruction_count, 0)} inst`;
    const cycA = document.getElementById('cpu-a-cycles');
    if (cycA) cycA.innerText = `${formatNumber(cpuA.total_cycles, 0)} cyc`;
    const execA = document.getElementById('cpu-a-exectime');
    if (execA) execA.innerText = `${formatNumber(cpuA.execution_time_ms, 2)} ms`;
    const mipsA = document.getElementById('cpu-a-mips');
    if (mipsA) mipsA.innerText = `${formatNumber(cpuA.mips, 1)} MIPS`;

    // 4. CPU B Card
    const nameB = document.getElementById('cpu-b-name');
    if (nameB) nameB.innerText = `${cpuB.name || 'CPU - B'} • ${cpuB.frequency_ghz?.toFixed(2)} GHz Boost`;
    const freqB = document.getElementById('cpu-b-freq');
    if (freqB) freqB.innerText = `${cpuB.frequency_ghz?.toFixed(2)} GHz`;
    const cpiB = document.getElementById('cpu-b-cpi');
    if (cpiB) cpiB.innerText = formatNumber(cpuB.cpi, 2);
    const ipcB = document.getElementById('cpu-b-ipc');
    if (ipcB) ipcB.innerText = formatNumber(cpuB.ipc, 2);
    const instB = document.getElementById('cpu-b-inst');
    if (instB) instB.innerText = `${formatNumber(cpuB.instruction_count, 0)} inst`;
    const cycB = document.getElementById('cpu-b-cycles');
    if (cycB) cycB.innerText = `${formatNumber(cpuB.total_cycles, 0)} cyc`;
    const execB = document.getElementById('cpu-b-exectime');
    if (execB) execB.innerText = `${formatNumber(cpuB.execution_time_ms, 2)} ms`;
    const mipsB = document.getElementById('cpu-b-mips');
    const mipsGain = cpuA.mips > 0 ? (((cpuB.mips - cpuA.mips) / cpuA.mips) * 100).toFixed(1) : '0';
    if (mipsB) mipsB.innerText = `${formatNumber(cpuB.mips, 1)} MIPS (${mipsGain >= 0 ? '+' : ''}${mipsGain}%)`;

    // 5. Clustered Bar Chart Render
    renderClusteredBars(cpuA, cpuB);

    // 6. Metrics Comparison Table
    renderMetricsTable(cpuA, cpuB, speedFactor);
  }

  function renderClusteredBars(cpuA, cpuB) {
    const container = document.getElementById('clustered-bars');
    if (!container) return;

    const maxCPI = Math.max(cpuA.cpi || 1, cpuB.cpi || 1) * 1.25;
    const maxIPC = Math.max(cpuA.ipc || 1, cpuB.ipc || 1) * 1.25;
    const maxTime = Math.max(cpuA.execution_time_ms || 1, cpuB.execution_time_ms || 1) * 1.25;
    const maxMips = Math.max(cpuA.mips || 1, cpuB.mips || 1) * 1.25;

    const cpiDelta = cpuA.cpi > 0 ? (((cpuB.cpi - cpuA.cpi) / cpuA.cpi) * 100).toFixed(1) : 0;
    const ipcDelta = cpuA.ipc > 0 ? (((cpuB.ipc - cpuA.ipc) / cpuA.ipc) * 100).toFixed(1) : 0;
    const timeDelta = cpuA.execution_time_ms > 0 ? (((cpuB.execution_time_ms - cpuA.execution_time_ms) / cpuA.execution_time_ms) * 100).toFixed(1) : 0;
    const mipsDelta = cpuA.mips > 0 ? (((cpuB.mips - cpuA.mips) / cpuA.mips) * 100).toFixed(1) : 0;

    const hCpiA = Math.min(100, Math.max(12, (cpuA.cpi / maxCPI) * 100));
    const hCpiB = Math.min(100, Math.max(12, (cpuB.cpi / maxCPI) * 100));

    const hIpcA = Math.min(100, Math.max(12, (cpuA.ipc / maxIPC) * 100));
    const hIpcB = Math.min(100, Math.max(12, (cpuB.ipc / maxIPC) * 100));

    const hTimeA = Math.min(100, Math.max(12, (cpuA.execution_time_ms / maxTime) * 100));
    const hTimeB = Math.min(100, Math.max(12, (cpuB.execution_time_ms / maxTime) * 100));

    const hMipsA = Math.min(100, Math.max(12, (cpuA.mips / maxMips) * 100));
    const hMipsB = Math.min(100, Math.max(12, (cpuB.mips / maxMips) * 100));

    container.innerHTML = `
      <!-- Cluster 1: CPI -->
      <div class="flex flex-col items-center h-full justify-end group">
        <div class="flex items-end gap-2 w-full justify-center h-48">
          <div class="w-7 sm:w-10 rounded-t-lg bg-secondary flex flex-col items-center justify-start pt-1.5 transition-all group-hover:brightness-110" style="height: ${hCpiA}%;">
            <span class="font-code-mono text-label-xs font-bold text-on-secondary">${formatNumber(cpuA.cpi, 2)}</span>
          </div>
          <div class="w-7 sm:w-10 rounded-t-lg bg-primary flex flex-col items-center justify-start pt-1.5 transition-all group-hover:brightness-110" style="height: ${hCpiB}%;">
            <span class="font-code-mono text-label-xs font-bold text-on-primary">${formatNumber(cpuB.cpi, 2)}</span>
          </div>
        </div>
        <span class="mt-3 font-label-md text-label-md text-on-surface font-semibold">CPI</span>
        <span class="font-code-mono text-label-xs ${cpiDelta <= 0 ? 'text-primary' : 'text-error'} font-bold">${cpiDelta > 0 ? '+' : ''}${cpiDelta}%</span>
      </div>

      <!-- Cluster 2: IPC -->
      <div class="flex flex-col items-center h-full justify-end group">
        <div class="flex items-end gap-2 w-full justify-center h-48">
          <div class="w-7 sm:w-10 rounded-t-lg bg-secondary flex flex-col items-center justify-start pt-1.5 transition-all group-hover:brightness-110" style="height: ${hIpcA}%;">
            <span class="font-code-mono text-label-xs font-bold text-on-secondary">${formatNumber(cpuA.ipc, 2)}</span>
          </div>
          <div class="w-7 sm:w-10 rounded-t-lg bg-primary flex flex-col items-center justify-start pt-1.5 transition-all group-hover:brightness-110" style="height: ${hIpcB}%;">
            <span class="font-code-mono text-label-xs font-bold text-on-primary">${formatNumber(cpuB.ipc, 2)}</span>
          </div>
        </div>
        <span class="mt-3 font-label-md text-label-md text-on-surface font-semibold">IPC</span>
        <span class="font-code-mono text-label-xs ${ipcDelta >= 0 ? 'text-primary' : 'text-error'} font-bold">${ipcDelta > 0 ? '+' : ''}${ipcDelta}%</span>
      </div>

      <!-- Cluster 3: Exec Time -->
      <div class="flex flex-col items-center h-full justify-end group">
        <div class="flex items-end gap-2 w-full justify-center h-48">
          <div class="w-7 sm:w-10 rounded-t-lg bg-secondary flex flex-col items-center justify-start pt-1.5 transition-all group-hover:brightness-110" style="height: ${hTimeA}%;">
            <span class="font-code-mono text-label-xs font-bold text-on-secondary">${formatNumber(cpuA.execution_time_ms, 1)}</span>
          </div>
          <div class="w-7 sm:w-10 rounded-t-lg bg-primary flex flex-col items-center justify-start pt-1.5 transition-all group-hover:brightness-110" style="height: ${hTimeB}%;">
            <span class="font-code-mono text-label-xs font-bold text-on-primary">${formatNumber(cpuB.execution_time_ms, 1)}</span>
          </div>
        </div>
        <span class="mt-3 font-label-md text-label-md text-on-surface font-semibold">Time (ms)</span>
        <span class="font-code-mono text-label-xs ${timeDelta <= 0 ? 'text-primary' : 'text-error'} font-bold">${timeDelta > 0 ? '+' : ''}${timeDelta}%</span>
      </div>

      <!-- Cluster 4: MIPS -->
      <div class="flex flex-col items-center h-full justify-end group">
        <div class="flex items-end gap-2 w-full justify-center h-48">
          <div class="w-7 sm:w-10 rounded-t-lg bg-secondary flex flex-col items-center justify-start pt-1.5 transition-all group-hover:brightness-110" style="height: ${hMipsA}%;">
            <span class="font-code-mono text-label-xs font-bold text-on-secondary">${formatNumber(cpuA.mips, 1)}</span>
          </div>
          <div class="w-7 sm:w-10 rounded-t-lg bg-primary flex flex-col items-center justify-start pt-1.5 transition-all group-hover:brightness-110" style="height: ${hMipsB}%;">
            <span class="font-code-mono text-label-xs font-bold text-on-primary">${formatNumber(cpuB.mips, 1)}</span>
          </div>
        </div>
        <span class="mt-3 font-label-md text-label-md text-on-surface font-semibold">MIPS</span>
        <span class="font-code-mono text-label-xs ${mipsDelta >= 0 ? 'text-primary' : 'text-error'} font-bold">${mipsDelta > 0 ? '+' : ''}${mipsDelta}%</span>
      </div>
    `;
  }

  function renderMetricsTable(cpuA, cpuB, speedFactor) {
    const tbody = document.getElementById('comparison-table-body');
    if (!tbody) return;

    const tauA = cpuA.frequency_ghz > 0 ? (1.0 / (cpuA.frequency_ghz * 1e9)) * 1e9 : 0; // ns
    const tauB = cpuB.frequency_ghz > 0 ? (1.0 / (cpuB.frequency_ghz * 1e9)) * 1e9 : 0; // ns

    const rows = [
      {
        icon: 'speed',
        param: 'Clock Frequency (f)',
        valA: `${formatNumber(cpuA.frequency_ghz, 2)} GHz`,
        valB: `${formatNumber(cpuB.frequency_ghz, 2)} GHz`,
        delta: `${cpuB.frequency_ghz >= cpuA.frequency_ghz ? '+' : ''}${formatNumber(cpuB.frequency_ghz - cpuA.frequency_ghz, 2)} GHz (${formatNumber(((cpuB.frequency_ghz - cpuA.frequency_ghz) / cpuA.frequency_ghz) * 100, 1)}%)`,
        winner: cpuB.frequency_ghz >= cpuA.frequency_ghz ? 'CPU - B (Target)' : 'CPU - A (Base)'
      },
      {
        icon: 'pace',
        param: 'Clock Period (τ = 1/f)',
        valA: `${formatNumber(tauA, 3)} ns`,
        valB: `${formatNumber(tauB, 3)} ns`,
        delta: `${tauB >= tauA ? '+' : ''}${formatNumber(tauB - tauA, 3)} ns (${formatNumber(((tauB - tauA) / tauA) * 100, 1)}%)`,
        winner: tauB <= tauA ? 'CPU - B (Faster Pulse)' : 'CPU - A'
      },
      {
        icon: 'autorenew',
        param: 'Cycles Per Instruction (CPI)',
        valA: formatNumber(cpuA.cpi, 2),
        valB: formatNumber(cpuB.cpi, 2),
        delta: `${cpuB.cpi >= cpuA.cpi ? '+' : ''}${formatNumber(cpuB.cpi - cpuA.cpi, 2)} (${formatNumber(((cpuB.cpi - cpuA.cpi) / cpuA.cpi) * 100, 1)}%)`,
        winner: cpuB.cpi <= cpuA.cpi ? 'CPU - B (Less Idle Stalls)' : 'CPU - A'
      },
      {
        icon: 'power',
        param: 'Instructions Per Cycle (IPC)',
        valA: formatNumber(cpuA.ipc, 2),
        valB: formatNumber(cpuB.ipc, 2),
        delta: `${cpuB.ipc >= cpuA.ipc ? '+' : ''}${formatNumber(cpuB.ipc - cpuA.ipc, 2)} (${formatNumber(((cpuB.ipc - cpuA.ipc) / cpuA.ipc) * 100, 1)}%)`,
        winner: cpuB.ipc >= cpuA.ipc ? 'CPU - B (Wider Retire)' : 'CPU - A'
      },
      {
        icon: 'timelapse',
        param: 'Execution Time (T = IC × CPI × τ)',
        valA: `${formatNumber(cpuA.execution_time_ms, 2)} ms`,
        valB: `${formatNumber(cpuB.execution_time_ms, 2)} ms`,
        delta: `${cpuB.execution_time_ms >= cpuA.execution_time_ms ? '+' : ''}${formatNumber(cpuB.execution_time_ms - cpuA.execution_time_ms, 2)} ms (${formatNumber(((cpuB.execution_time_ms - cpuA.execution_time_ms) / cpuA.execution_time_ms) * 100, 1)}%)`,
        winner: cpuB.execution_time_ms <= cpuA.execution_time_ms ? `CPU - B (${speedFactor}x Faster)` : 'CPU - A'
      },
      {
        icon: 'trending_up',
        param: 'MIPS (Throughput Metric)',
        valA: `${formatNumber(cpuA.mips, 1)} MIPS`,
        valB: `${formatNumber(cpuB.mips, 1)} MIPS`,
        delta: `${cpuB.mips >= cpuA.mips ? '+' : ''}${formatNumber(cpuB.mips - cpuA.mips, 1)} MIPS (${formatNumber(((cpuB.mips - cpuA.mips) / cpuA.mips) * 100, 1)}%)`,
        winner: cpuB.mips >= cpuA.mips ? 'CPU - B (Target Dominates)' : 'CPU - A'
      }
    ];

    tbody.innerHTML = rows.map(r => `
      <tr class="hover:bg-surface-container-low/60 transition-colors">
        <td class="py-3.5 px-space-md font-semibold text-on-surface flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px] text-secondary">${r.icon}</span>
          ${r.param}
        </td>
        <td class="py-3.5 px-space-md font-code-mono">${r.valA}</td>
        <td class="py-3.5 px-space-md font-code-mono font-bold text-primary">${r.valB}</td>
        <td class="py-3.5 px-space-md font-code-mono text-primary font-bold">${r.delta}</td>
        <td class="py-3.5 px-space-md">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-xs font-bold">
            <span class="material-symbols-outlined text-[14px]">check</span> ${r.winner}
          </span>
        </td>
      </tr>
    `).join('');
  }

  function switchViewTab(tab) {
    currentActiveTab = tab;
    const tabMetric = document.getElementById('tab-metric');
    const tabExec = document.getElementById('tab-exec');
    const tabRadar = document.getElementById('tab-radar');

    const chartView = document.getElementById('chart-view');
    const radarView = document.getElementById('radar-view');

    const inactiveClass = 'px-3 py-1.5 rounded-lg font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all';
    const activeClass = 'px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-lowest text-primary shadow-sm transition-all';

    if (tabMetric) tabMetric.className = tab === 'metric' ? activeClass : inactiveClass;
    if (tabExec) tabExec.className = tab === 'exec' ? activeClass : inactiveClass;
    if (tabRadar) tabRadar.className = tab === 'radar' ? activeClass : inactiveClass;

    if (tab === 'radar') {
      if (chartView) chartView.classList.add('hidden');
      if (radarView) radarView.classList.remove('hidden');
    } else {
      if (radarView) radarView.classList.add('hidden');
      if (chartView) chartView.classList.remove('hidden');
    }
  }

  function swapProcessors() {
    const temp = { ...state.cpuA };
    state.cpuA = { ...state.cpuB };
    state.cpuB = temp;
    runComparison();
    if (window.showToast) window.showToast('Processors swapped (Base ↔ Target)', 'info');
  }

  window.switchViewTab = switchViewTab;
  window.swapProcessors = swapProcessors;

  function init() {
    loadPresets();
    runComparison();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
