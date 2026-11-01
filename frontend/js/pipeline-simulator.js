/**
 * CPU Performance Explorer - 5-Stage RISC Pipeline Simulator Controller
 * Simulates: IF (Instruction Fetch), ID (Instruction Decode), EX (Execute),
 * MEM (Memory Access), WB (Write Back) with RAW Hazard and Forwarding logic.
 */

(function () {
  let simulationData = null;
  let currentCycle = 1;
  let maxCycles = 12;
  let isPlaying = false;
  let playTimer = null;
  let stepSpeedMs = 1000;
  let forwardingEnabled = true;

  async function fetchSimulation(instCount = 6, forwarding = true) {
    try {
      const res = await apiFetch('/api/pipeline/simulate', {
        method: 'POST',
        body: JSON.stringify({
          instruction_count: instCount,
          forwarding_enabled: forwarding
        })
      });

      if (res) {
        simulationData = res;
        maxCycles = res.total_cycles || 12;
        currentCycle = 1;

        renderTimingGrid();
        renderSummaryMetrics();
        renderHazardDetector();
        renderTraceTable();
        highlightActiveCycle(currentCycle);
      }
    } catch (e) {
      console.error('Pipeline simulation error:', e);
      if (window.showToast) window.showToast('Pipeline error: ' + e.message, 'error');
    }
  }

  function renderTimingGrid() {
    if (!simulationData || !simulationData.grid || !simulationData.instructions) return;

    const gridContainer = document.getElementById('pipeline-timing-grid');
    if (!gridContainer) return;

    const totalC = simulationData.total_cycles;

    // Build cycle header row
    let headerHtml = `
      <div class="grid grid-cols-[130px_repeat(${totalC},minmax(0,1fr))] items-center gap-1.5 pb-2 text-center" id="cycle-header-row">
        <div class="font-label-xs text-label-xs text-on-surface-variant font-bold text-left pl-2 uppercase tracking-wider">
          Inst \\ Cycle →
        </div>
    `;

    for (let c = 1; c <= totalC; c++) {
      headerHtml += `<div class="font-code-mono text-code-mono text-on-surface-variant font-semibold py-1 rounded bg-surface-container-low cycle-col-hdr" data-cycle="${c}">${c}</div>`;
    }
    headerHtml += `</div>`;

    // Build instruction rows
    let rowsHtml = `<div class="flex flex-col gap-2">`;

    simulationData.instructions.forEach((inst, rIdx) => {
      const rowStages = simulationData.grid[rIdx] || [];
      const typeLabel = inst.type || 'ALU Compute';
      const isLoad = typeLabel.toLowerCase().includes('load');
      const isBranch = typeLabel.toLowerCase().includes('branch');
      const isStore = typeLabel.toLowerCase().includes('store');
      const typeColor = isLoad ? 'text-tertiary' : isBranch ? 'text-amber-600' : isStore ? 'text-secondary' : 'text-primary';

      rowsHtml += `
        <div class="grid grid-cols-[130px_repeat(${totalC},minmax(0,1fr))] items-center gap-1.5 group hover:bg-surface-container-low/50 p-1 rounded-lg transition-colors pipeline-row" data-inst-idx="${rIdx}">
          <div class="flex flex-col pr-2">
            <span class="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1">
              ${escapeHtml(inst.id)} <span class="font-code-mono text-label-xs text-on-surface-variant font-normal truncate">${escapeHtml(inst.text)}</span>
            </span>
            <span class="font-label-xs text-label-xs ${typeColor}">${escapeHtml(typeLabel)}</span>
          </div>
      `;

      for (let c = 1; c <= totalC; c++) {
        const stage = rowStages[c - 1] || "";
        if (!stage) {
          rowsHtml += `<div class="h-9 rounded bg-surface-container-low/40 stage-cell" data-cycle="${c}"></div>`;
        } else if (stage === 'STALL') {
          rowsHtml += `
            <div class="h-9 rounded flex items-center justify-center font-code-mono text-label-xs font-extrabold bg-error-container text-on-error-container shadow-xs stage-cell relative overflow-hidden" data-cycle="${c}" title="Hardware Hazard: EX Stage Busy (Bubble inserted)">
              <div class="absolute inset-0 opacity-15 bg-gradient-to-r from-transparent via-error to-transparent"></div>
              <span>STALL</span>
            </div>
          `;
        } else {
          let stageClass = 'bg-primary-fixed text-on-primary-fixed-variant';
          if (stage === 'ID') stageClass = 'bg-secondary-fixed text-on-secondary-fixed';
          else if (stage === 'EX') stageClass = 'bg-surface-container-highest text-on-surface';
          else if (stage === 'MEM') stageClass = 'bg-tertiary-fixed text-on-tertiary-fixed';
          else if (stage === 'WB') stageClass = 'bg-secondary-container text-on-secondary';

          rowsHtml += `<div class="h-9 rounded flex items-center justify-center font-code-mono text-label-xs font-bold ${stageClass} shadow-xs stage-cell" data-cycle="${c}">${stage}</div>`;
        }
      }
      rowsHtml += `</div>`;
    });

    rowsHtml += `</div>`;
    gridContainer.innerHTML = headerHtml + rowsHtml;
  }

  function highlightActiveCycle(cycle) {
    // 1. Update cycle readout badge
    const readout = document.getElementById('cycle-readout');
    if (readout) {
      readout.textContent = `Cycle ${cycle.toString().padStart(2, '0')}`;
    }

    // 2. Header column highlight
    document.querySelectorAll('.cycle-col-hdr').forEach(el => {
      const c = parseInt(el.getAttribute('data-cycle'), 10);
      if (c === cycle) {
        el.className = 'font-code-mono text-code-mono text-primary font-bold py-1 rounded bg-primary-fixed shadow-xs cycle-col-hdr';
        el.innerText = `${c} ★`;
      } else {
        el.className = 'font-code-mono text-code-mono text-on-surface-variant font-semibold py-1 rounded bg-surface-container-low cycle-col-hdr';
        el.innerText = `${c}`;
      }
    });

    // 3. Timing grid cell highlight
    document.querySelectorAll('.stage-cell').forEach(el => {
      const c = parseInt(el.getAttribute('data-cycle'), 10);
      if (c === cycle) {
        el.classList.add('ring-2', 'ring-primary');
      } else {
        el.classList.remove('ring-2', 'ring-primary');
      }
    });

    // 4. Update status badges in Trace Table
    updateTraceTableStatus(cycle);
  }

  function renderSummaryMetrics() {
    if (!simulationData) return;

    const cyclesEl = document.getElementById('metric-total-cycles');
    if (cyclesEl) cyclesEl.innerText = simulationData.total_cycles;

    const stallsEl = document.getElementById('metric-pipeline-stalls');
    if (stallsEl) stallsEl.innerText = simulationData.stall_cycles;

    const cpiEl = document.getElementById('metric-sim-cpi');
    if (cpiEl) cpiEl.innerText = simulationData.cpi.toFixed(2);

    const ipcEl = document.getElementById('metric-sim-ipc');
    if (ipcEl) ipcEl.innerText = simulationData.ipc.toFixed(2);

    const throughputEl = document.getElementById('metric-pipeline-throughput');
    if (throughputEl) throughputEl.innerText = simulationData.ipc.toFixed(2);
  }

  function renderHazardDetector() {
    const hazards = simulationData?.hazards_detected || [];
    const container = document.getElementById('hazard-cards-container');
    if (!container) return;

    const countHeader = document.querySelector('.bg-surface-container-lowest .inline-flex.rounded-full');
    if (countHeader) {
      countHeader.innerText = `${hazards.length} Hazard${hazards.length === 1 ? '' : 's'} Detected · Forwarding ${forwardingEnabled ? 'Enabled' : 'Disabled'}`;
    }

    if (hazards.length === 0) {
      container.innerHTML = `
        <div class="col-span-3 bg-surface-container-low rounded-xl p-space-md text-center py-6">
          <span class="material-symbols-outlined text-primary text-3xl">verified</span>
          <p class="font-title-md text-title-md text-on-surface font-bold mt-1">Ideal Pipeline Execution</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">No structural, data, or control hazard bubbles required for this instruction stream.</p>
        </div>
      `;
      return;
    }

    let cardsHtml = '';
    hazards.forEach((h, idx) => {
      const isDataHazard = h.type.includes('RAW') || h.type.includes('Data');
      cardsHtml += `
        <div class="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="px-2 py-0.5 rounded font-code-mono text-label-xs font-bold ${h.penalty > 0 ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-on-primary-fixed-variant'}">
                ${escapeHtml(h.type)}
              </span>
              <span class="font-code-mono text-label-xs text-on-surface-variant">Cycle ${h.cycle}</span>
            </div>
            <p class="font-body-md text-body-md text-on-surface font-semibold mb-1">Instruction ${escapeHtml(h.instruction)}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${escapeHtml(h.description)}</p>
          </div>
          <div class="mt-space-md pt-space-xs flex items-center justify-between border-t border-surface-container-high/60">
            <span class="font-label-xs text-label-xs text-on-surface-variant uppercase">Hardware Impact</span>
            <span class="font-label-sm text-label-sm ${h.penalty > 0 ? 'text-error font-bold' : 'text-primary font-bold'}">
              ${h.penalty > 0 ? `+${h.penalty} Stall Bubble` : 'Bypassed via Forwarding'}
            </span>
          </div>
        </div>
      `;
    });

    container.innerHTML = cardsHtml;
  }

  function renderTraceTable() {
    const tbody = document.getElementById('pipeline-trace-body');
    if (!tbody || !simulationData || !simulationData.instructions) return;

    tbody.innerHTML = '';
    simulationData.instructions.forEach((inst, rIdx) => {
      const rowStages = simulationData.grid[rIdx] || [];
      const ifCycle = rowStages.indexOf('IF') + 1;
      const wbCycle = rowStages.indexOf('WB') + 1;
      const latency = (ifCycle > 0 && wbCycle >= ifCycle) ? (wbCycle - ifCycle + 1) : 5;
      const stallCount = rowStages.filter(s => s === 'STALL').length;

      const row = document.createElement('tr');
      row.className = 'hover:bg-surface-container-low/40 transition-colors trace-row';
      row.id = `trace-row-${rIdx}`;
      row.innerHTML = `
        <td class="py-3 px-space-md font-code-mono font-bold text-on-surface">${escapeHtml(inst.id)}</td>
        <td class="py-3 px-space-md font-code-mono text-on-surface">${escapeHtml(inst.text)}</td>
        <td class="py-3 px-space-md">
          <span class="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface text-label-xs font-semibold">${escapeHtml(inst.type)}</span>
        </td>
        <td class="py-3 px-space-md font-code-mono text-on-surface-variant">Cycle ${ifCycle || 1}</td>
        <td class="py-3 px-space-md font-code-mono text-on-surface-variant">Cycle ${wbCycle || 5}</td>
        <td class="py-3 px-space-md font-code-mono ${stallCount > 0 ? 'text-error font-bold' : 'text-on-surface'}">
          ${latency} cycles ${stallCount > 0 ? `(+${stallCount} Bubble)` : ''}
        </td>
        <td class="py-3 px-space-md" id="trace-status-${rIdx}">
          <span class="inline-flex items-center gap-1 text-on-surface-variant font-label-xs font-semibold">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Queued
          </span>
        </td>
      `;
      tbody.appendChild(row);
    });

    updateTraceTableStatus(currentCycle);
  }

  function updateTraceTableStatus(cycle) {
    if (!simulationData || !simulationData.grid) return;

    simulationData.instructions.forEach((inst, rIdx) => {
      const rowStages = simulationData.grid[rIdx] || [];
      const stage = rowStages[cycle - 1] || "";
      const ifCycle = rowStages.indexOf('IF') + 1;
      const wbCycle = rowStages.indexOf('WB') + 1;
      const statusEl = document.getElementById(`trace-status-${rIdx}`);
      const rowEl = document.getElementById(`trace-row-${rIdx}`);

      if (!statusEl) return;

      if (cycle < ifCycle) {
        statusEl.innerHTML = `<span class="inline-flex items-center gap-1 text-on-surface-variant font-label-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Queued</span>`;
        if (rowEl) rowEl.classList.remove('bg-primary-fixed/20', 'bg-error-container/20');
      } else if (cycle > wbCycle && wbCycle > 0) {
        statusEl.innerHTML = `<span class="inline-flex items-center gap-1 text-primary font-label-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-primary"></span>Retired</span>`;
        if (rowEl) rowEl.classList.remove('bg-primary-fixed/20', 'bg-error-container/20');
      } else {
        const isStalled = stage === 'STALL';
        const colorClass = isStalled ? 'text-error' : 'text-secondary';
        const dotColor = isStalled ? 'bg-error animate-ping' : 'bg-secondary animate-pulse';
        statusEl.innerHTML = `<span class="inline-flex items-center gap-1 ${colorClass} font-label-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>${isStalled ? 'Stalled (Hazard)' : `In-Flight (${stage})`}</span>`;
        if (rowEl) {
          if (isStalled) {
            rowEl.classList.add('bg-error-container/20');
            rowEl.classList.remove('bg-primary-fixed/20');
          } else {
            rowEl.classList.add('bg-primary-fixed/20');
            rowEl.classList.remove('bg-error-container/20');
          }
        }
      }
    });
  }

  function stepForward() {
    if (currentCycle < maxCycles) {
      currentCycle++;
      highlightActiveCycle(currentCycle);
    } else {
      pause();
    }
  }

  function stepBackward() {
    if (currentCycle > 1) {
      currentCycle--;
      highlightActiveCycle(currentCycle);
    }
  }

  function play() {
    isPlaying = true;
    const btnRun = document.getElementById('btn-run');
    if (btnRun) {
      btnRun.classList.add('ring-2', 'ring-primary-container');
    }
    if (playTimer) clearInterval(playTimer);
    playTimer = setInterval(() => {
      if (currentCycle >= maxCycles) {
        currentCycle = 1;
      }
      stepForward();
    }, stepSpeedMs);
  }

  function pause() {
    isPlaying = false;
    const btnRun = document.getElementById('btn-run');
    if (btnRun) {
      btnRun.classList.remove('ring-2', 'ring-primary-container');
    }
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
  }

  function reset() {
    pause();
    currentCycle = 1;
    highlightActiveCycle(currentCycle);
    if (window.showToast) window.showToast('Reset pipeline to Cycle 01', 'info');
  }

  function setupControls() {
    const btnRun = document.getElementById('btn-run');
    if (btnRun) btnRun.addEventListener('click', play);

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', pause);

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) btnReset.addEventListener('click', reset);

    const btnPrev = document.getElementById('btn-prev');
    if (btnPrev) btnPrev.addEventListener('click', stepBackward);

    const btnNext = document.getElementById('btn-next');
    if (btnNext) btnNext.addEventListener('click', stepForward);

    // Speed selector buttons using standard querySelectorAll without :contains
    const speedButtons = document.querySelectorAll('.inline-flex.rounded-lg.bg-surface-container-low button');
    speedButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const text = this.textContent.trim();
        if (text === '1.0x') stepSpeedMs = 1000;
        else if (text === '2.0x') stepSpeedMs = 500;
        else if (text === '0.5x') stepSpeedMs = 2000;

        speedButtons.forEach(b => {
          b.className = 'px-2.5 py-1 text-label-xs font-label-xs rounded text-on-surface-variant hover:text-on-surface';
        });
        this.className = 'px-2.5 py-1 text-label-xs font-label-xs rounded bg-surface-container-lowest text-primary font-bold shadow-xs';

        if (isPlaying) {
          pause();
          play();
        }
      });
    });

    // Instruction count dropdown using standard ID selector
    const countSelect = document.getElementById('instruction-count-select');
    if (countSelect) {
      countSelect.addEventListener('change', () => {
        const count = parseInt(countSelect.value, 10) || 6;
        fetchSimulation(count, forwardingEnabled);
      });
    }

    // Forwarding toggle button
    const forwardingToggle = document.getElementById('forwarding-toggle-btn');
    if (forwardingToggle) {
      forwardingToggle.addEventListener('click', () => {
        forwardingEnabled = !forwardingEnabled;
        const dot = document.getElementById('forwarding-indicator-dot');
        const text = document.getElementById('forwarding-status-text');

        if (dot) dot.className = `w-2 h-2 rounded-full ${forwardingEnabled ? 'bg-secondary' : 'bg-error'}`;
        if (text) {
          text.className = `${forwardingEnabled ? 'text-secondary' : 'text-error'} font-semibold`;
          text.textContent = forwardingEnabled ? 'Enabled' : 'Disabled';
        }

        const count = countSelect ? parseInt(countSelect.value, 10) || 6 : 6;
        fetchSimulation(count, forwardingEnabled);

        if (window.showToast) {
          window.showToast(forwardingEnabled ? 'Forwarding Unit: Enabled (Bypass Active)' : 'Forwarding Unit: Disabled (Stalls Inserted)', 'info');
        }
      });
    }
  }

  function init() {
    setupControls();
    fetchSimulation(6, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
