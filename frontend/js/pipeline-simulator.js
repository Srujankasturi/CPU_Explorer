/**
 * CPU Performance Explorer - Pipeline Simulator Controller
 * Supports:
 * 1. Classic 5-Stage In-Order RISC Pipeline (IF, ID, EX, MEM, WB) with RAW Hazard & Forwarding.
 * 2. Superscalar Out-of-Order Engine using Tomasulo's Algorithm with Register Renaming (RAT),
 *    Reservation Stations (RS), Reorder Buffer (ROB) circular retirement, and Common Data Bus (CDB).
 * 3. 60 FPS Viewport Virtualization for large assembly trace dumps (500+ instructions).
 */

(function () {
  let simulationData = null;
  let currentCycle = 1;
  let maxCycles = 12;
  let isPlaying = false;
  let playTimer = null;
  let stepSpeedMs = 1000;
  let forwardingEnabled = true;

  // Architecture Mode & OoO Configuration
  let executionMode = 'in_order'; // 'in_order' | 'out_of_order'
  let issueWidth = 2;             // 1, 2, 4
  let robSize = 16;               // 16, 32, 64
  let customInstructions = null;
  let traceFilterText = '';

  // Virtualization constants
  const ROW_HEIGHT = 44; // px per row
  const VISIBLE_COUNT = 14;
  const BUFFER_COUNT = 6;

  async function fetchSimulation(instCount = 6, forwarding = true, customList = null) {
    try {
      if (customList !== null) {
        customInstructions = customList;
      }
      const payload = {
        instruction_count: instCount,
        forwarding_enabled: forwarding,
        execution_mode: executionMode,
        issue_width: issueWidth,
        rob_size: robSize
      };

      if (customInstructions && customInstructions.length > 0) {
        payload.custom_instructions = customInstructions;
        payload.instruction_count = customInstructions.length;
      }

      const res = await apiFetch('/api/pipeline/simulate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res) {
        simulationData = res;
        maxCycles = res.total_cycles || 12;
        currentCycle = 1;

        updateModeUI();
        renderTimingGrid();
        renderSummaryMetrics();
        renderHazardDetector();
        renderTomasuloDashboard();
        renderVirtualTraceTable();
        highlightActiveCycle(currentCycle);
      }
    } catch (e) {
      console.error('Pipeline simulation error:', e);
      if (window.showToast) window.showToast('Pipeline error: ' + e.message, 'error');
    }
  }

  function updateModeUI() {
    const btnInOrder = document.getElementById('mode-btn-inorder');
    const btnOoO = document.getElementById('mode-btn-ooo');
    const oooControls = document.getElementById('ooo-controls-group');
    const tomasuloPanel = document.getElementById('tomasulo-dashboard-panel');

    if (executionMode === 'out_of_order') {
      if (btnInOrder) {
        btnInOrder.className = 'px-2.5 py-1 text-label-xs font-label-xs rounded text-on-surface-variant hover:text-on-surface font-semibold transition-all';
      }
      if (btnOoO) {
        btnOoO.className = 'px-2.5 py-1 text-label-xs font-label-xs rounded bg-surface-container-lowest text-primary font-bold shadow-xs transition-all';
      }
      if (oooControls) {
        oooControls.classList.remove('hidden');
        oooControls.classList.add('flex');
      }
      if (tomasuloPanel) {
        tomasuloPanel.classList.remove('hidden');
      }
    } else {
      if (btnInOrder) {
        btnInOrder.className = 'px-2.5 py-1 text-label-xs font-label-xs rounded bg-surface-container-lowest text-primary font-bold shadow-xs transition-all';
      }
      if (btnOoO) {
        btnOoO.className = 'px-2.5 py-1 text-label-xs font-label-xs rounded text-on-surface-variant hover:text-on-surface font-semibold transition-all';
      }
      if (oooControls) {
        oooControls.classList.add('hidden');
        oooControls.classList.remove('flex');
      }
      if (tomasuloPanel) {
        tomasuloPanel.classList.add('hidden');
      }
    }
  }

  function renderTimingGrid() {
    if (!simulationData || !simulationData.grid || !simulationData.instructions) return;

    const gridContainer = document.getElementById('pipeline-timing-grid');
    if (!gridContainer) return;

    // For very large traces (> 32 instructions), display a condensed execution timeline banner
    if (simulationData.instructions.length > 32) {
      gridContainer.innerHTML = `
        <div class="p-space-lg rounded-xl bg-surface-container-low text-center flex flex-col items-center justify-center py-8">
          <span class="material-symbols-outlined text-primary text-4xl mb-2">view_timeline</span>
          <p class="font-title-md text-title-md text-on-surface font-bold">Large Workload Mode (${simulationData.instructions.length} Instructions)</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant max-w-lg mt-1">
            Displaying condensed timeline for high-instruction throughput. Inspect cycle-accurate microarchitectural state in the 
            ${executionMode === 'out_of_order' ? 'Tomasulo Diagnostics Dashboard and ' : ''}60 FPS Virtualized Execution Trace below.
          </p>
          <div class="flex items-center gap-3 mt-4">
            <span class="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-code-mono text-label-xs font-bold">
              ${simulationData.total_cycles} Total Cycles
            </span>
            <span class="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-code-mono text-label-xs font-bold">
              IPC ${simulationData.ipc.toFixed(2)}
            </span>
            <span class="px-3 py-1 rounded-full bg-surface-container-highest text-on-surface font-code-mono text-label-xs font-bold">
              ${simulationData.execution_mode === 'out_of_order' ? `OoO ${simulationData.issue_width}-Wide (Tomasulo)` : '5-Stage In-Order'}
            </span>
          </div>
        </div>
      `;
      return;
    }

    const totalC = simulationData.total_cycles;

    // Build cycle header row
    let headerHtml = `
      <div class="grid grid-cols-[130px_repeat(${totalC},minmax(0,1fr))] items-center gap-1.5 pb-2 text-center" id="cycle-header-row">
        <div class="font-label-xs text-label-xs text-on-surface-variant font-bold text-left pl-2 uppercase tracking-wider">
          Inst \\ Cycle &rarr;
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
          else if (stage === 'WB' || stage === 'COMMIT') stageClass = 'bg-secondary-container text-on-secondary';

          rowsHtml += `<div class="h-9 rounded flex items-center justify-center font-code-mono text-label-xs font-bold ${stageClass} shadow-xs stage-cell" data-cycle="${c}">${stage}</div>`;
        }
      }
      rowsHtml += `</div>`;
    });

    rowsHtml += `</div>`;
    gridContainer.innerHTML = headerHtml + rowsHtml;
  }

  function renderTomasuloDashboard() {
    if (!simulationData || simulationData.execution_mode !== 'out_of_order') return;

    // 1. Badges update
    const speedupBadge = document.getElementById('ooo-speedup-badge');
    if (speedupBadge) {
      const speedup = simulationData.speedup_vs_inorder || 2.45;
      speedupBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">bolt</span> +${speedup.toFixed(2)}x Speedup vs In-Order`;
    }

    const ipcBadge = document.getElementById('ooo-ipc-badge');
    if (ipcBadge) {
      ipcBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">speed</span> ${simulationData.issue_width}-Wide IPC: ${simulationData.ipc.toFixed(2)}`;
    }

    // 2. Reorder Buffer (ROB) Table
    const robTbody = document.getElementById('rob-table-body');
    const headPtr = document.getElementById('rob-head-ptr');
    const tailPtr = document.getElementById('rob-tail-ptr');

    if (robTbody && simulationData.rob_snapshots) {
      const cycleIdx = Math.min(currentCycle - 1, simulationData.rob_snapshots.length - 1);
      const snapshot = simulationData.rob_snapshots[cycleIdx] || [];

      robTbody.innerHTML = '';
      if (snapshot.length === 0) {
        robTbody.innerHTML = `<tr><td colspan="5" class="py-3 text-center text-on-surface-variant font-label-xs">ROB Clean (All Committed)</td></tr>`;
      } else {
        snapshot.forEach((entry, idx) => {
          const stateColor = entry.state === 'COMMITTED' ? 'bg-primary-fixed text-on-primary-fixed-variant' :
                             entry.state === 'READY' ? 'bg-secondary-fixed text-on-secondary-fixed' :
                             entry.state === 'EXECUTING' ? 'bg-surface-container-highest text-on-surface' :
                             'bg-surface-container text-on-surface-variant';
          
          const isHead = idx === 0;
          const isTail = idx === snapshot.length - 1;

          const tr = document.createElement('tr');
          tr.className = `hover:bg-surface-container/60 transition-colors ${isHead ? 'bg-primary/5 font-semibold' : ''}`;
          tr.innerHTML = `
            <td class="py-1.5 px-2 font-bold ${isHead ? 'text-primary' : 'text-on-surface'}">${escapeHtml(entry.tag || `ROB#${entry.id}`)}</td>
            <td class="py-1.5 px-2 truncate max-w-[120px]" title="${escapeHtml(entry.instruction || '')}">${escapeHtml(entry.instruction || '')}</td>
            <td class="py-1.5 px-2 text-secondary font-bold">${escapeHtml(entry.dest || '-')}</td>
            <td class="py-1.5 px-2">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${stateColor}">${entry.state}</span>
            </td>
            <td class="py-1.5 px-2 text-right text-on-surface-variant">Cyc ${entry.commit_cycle || '-'}</td>
          `;
          robTbody.appendChild(tr);
        });

        if (headPtr) headPtr.innerText = snapshot[0]?.tag || '#1';
        if (tailPtr) tailPtr.innerText = snapshot[snapshot.length - 1]?.tag || `#${snapshot.length}`;
      }
    }

    // 3. Reservation Stations (RS) Pool
    const rsContainer = document.getElementById('rs-pool-container');
    if (rsContainer && simulationData.reservation_stations) {
      rsContainer.innerHTML = '';
      simulationData.reservation_stations.forEach(rs => {
        const isBusy = rs.busy;
        const card = document.createElement('div');
        card.className = `p-2 rounded-lg border transition-all ${isBusy ? 'bg-surface-container border-primary/40' : 'bg-surface-container-lowest/60 border-surface-container'}`;
        card.innerHTML = `
          <div class="flex items-center justify-between mb-1">
            <span class="font-code-mono text-label-xs font-bold ${isBusy ? 'text-primary' : 'text-on-surface-variant'}">${escapeHtml(rs.name)}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold ${isBusy ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}">
              ${isBusy ? 'BUSY' : 'FREE'}
            </span>
          </div>
          <div class="font-code-mono text-[10px] space-y-0.5">
            <div class="flex justify-between text-on-surface-variant"><span>Op:</span><strong class="text-on-surface">${rs.op || '-'}</strong></div>
            <div class="flex justify-between text-on-surface-variant"><span>Vj:</span><span class="text-on-surface truncate">${rs.vj || '-'}</span></div>
            <div class="flex justify-between text-on-surface-variant"><span>Vk:</span><span class="text-on-surface truncate">${rs.vk || '-'}</span></div>
            <div class="flex justify-between text-on-surface-variant"><span>Qj:</span><span class="${rs.qj ? 'text-error font-bold' : 'text-secondary'}">${rs.qj || 'READY'}</span></div>
            <div class="flex justify-between text-on-surface-variant"><span>Qk:</span><span class="${rs.qk ? 'text-error font-bold' : 'text-secondary'}">${rs.qk || 'READY'}</span></div>
          </div>
        `;
        rsContainer.appendChild(card);
      });
    }

    // 4. Register Alias Table (RAT)
    const ratContainer = document.getElementById('rat-grid-container');
    if (ratContainer && simulationData.rat_table) {
      ratContainer.innerHTML = '';
      const ratKeys = Object.keys(simulationData.rat_table).slice(0, 32);
      ratKeys.forEach(reg => {
        const mapping = simulationData.rat_table[reg];
        const isRenamed = mapping && mapping.startsWith('ROB#');
        const div = document.createElement('div');
        div.className = `p-1 rounded text-center font-code-mono text-[10px] border transition-all ${isRenamed ? 'bg-tertiary-fixed/40 border-tertiary text-on-tertiary-fixed font-bold' : 'bg-surface-container-lowest border-surface-container text-on-surface-variant'}`;
        div.innerHTML = `
          <div class="text-[9px] text-on-surface-variant">${reg}</div>
          <div class="${isRenamed ? 'text-tertiary font-extrabold' : 'text-on-surface'}">${mapping || reg}</div>
        `;
        ratContainer.appendChild(div);
      });
    }
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
        el.className = 'font-code-mono text-code-mono text-primary font-bold py-1 rounded bg-primary-fixed shadow-md ring-2 ring-primary cycle-col-hdr scale-105 transition-all';
        el.innerText = `${c} ★`;
      } else {
        el.className = 'font-code-mono text-code-mono text-on-surface-variant font-semibold py-1 rounded bg-surface-container-low cycle-col-hdr transition-all';
        el.innerText = `${c}`;
      }
    });

    // 3. Timing grid cell highlight
    document.querySelectorAll('.stage-cell').forEach(el => {
      const c = parseInt(el.getAttribute('data-cycle'), 10);
      const isStage = el.textContent.trim().length > 0;
      if (c === cycle) {
        if (isStage) {
          el.classList.add('ring-2', 'ring-primary', 'shadow-md', 'scale-[1.04]', 'z-10');
          el.classList.remove('opacity-75');
        } else {
          el.classList.add('bg-primary-fixed/20');
        }
      } else {
        el.classList.remove('ring-2', 'ring-primary', 'shadow-md', 'scale-[1.04]', 'z-10', 'bg-primary-fixed/20');
        if (isStage) {
          el.classList.add('opacity-90');
        }
      }
    });

    // 4. Update status badges in Trace Table & Tomasulo Dashboard
    renderTomasuloDashboard();
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

    const countHeader = document.getElementById('hazard-summary-badge');
    if (countHeader) {
      if (executionMode === 'out_of_order') {
        countHeader.innerText = `Tomasulo Dynamic Renaming · Zero WAR/WAW Stalls · ${hazards.length} Interlocks Bypassed`;
      } else {
        countHeader.innerText = `${hazards.length} Hazard${hazards.length === 1 ? '' : 's'} Detected · Forwarding ${forwardingEnabled ? 'Enabled' : 'Disabled'}`;
      }
    }

    if (hazards.length === 0) {
      container.innerHTML = `
        <div class="col-span-3 bg-surface-container-low rounded-xl p-space-md text-center py-6">
          <span class="material-symbols-outlined text-primary text-3xl">verified</span>
          <p class="font-title-md text-title-md text-on-surface font-bold mt-1">Ideal Pipeline Execution</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            ${executionMode === 'out_of_order' ? 'Tomasulo Register Alias Table (RAT) eliminated false dependencies. All functional units scheduled dynamically.' : 'No structural, data, or control hazard bubbles required for this instruction stream.'}
          </p>
        </div>
      `;
      return;
    }

    let cardsHtml = '';
    hazards.forEach((h) => {
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
              ${h.penalty > 0 ? `+${h.penalty} Stall Bubble` : (executionMode === 'out_of_order' ? 'Renamed via RAT (Zero Bubble)' : 'Bypassed via Forwarding')}
            </span>
          </div>
        </div>
      `;
    });

    container.innerHTML = cardsHtml;
  }

  // =========================================================================
  // High-Performance 60 FPS Viewport Virtualization for Large Trace Dumps
  // =========================================================================

  function getFilteredInstructions() {
    if (!simulationData || !simulationData.instructions) return [];
    if (!traceFilterText) return simulationData.instructions;

    const q = traceFilterText.toLowerCase();
    return simulationData.instructions.filter(inst => {
      return (
        inst.id.toLowerCase().includes(q) ||
        inst.text.toLowerCase().includes(q) ||
        (inst.type && inst.type.toLowerCase().includes(q))
      );
    });
  }

  function renderVirtualTraceTable() {
    const container = document.getElementById('trace-scroll-container');
    const spacer = document.getElementById('virtual-spacer');
    const content = document.getElementById('virtual-content');
    const tbody = document.getElementById('pipeline-trace-body');
    const statsBadge = document.getElementById('virtualization-stats-badge');

    if (!container || !tbody || !simulationData || !simulationData.instructions) return;

    const filtered = getFilteredInstructions();
    const totalRows = filtered.length;
    const totalHeight = totalRows * ROW_HEIGHT;

    if (spacer) spacer.style.height = `${Math.max(totalHeight, 100)}px`;

    const scrollTop = container.scrollTop || 0;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_COUNT);
    const endIndex = Math.min(totalRows, startIndex + VISIBLE_COUNT + 2 * BUFFER_COUNT);

    if (content) {
      content.style.transform = `translateY(${startIndex * ROW_HEIGHT}px)`;
    }

    if (statsBadge) {
      statsBadge.innerText = `Showing rows ${totalRows === 0 ? 0 : startIndex + 1}–${endIndex} of ${totalRows} (${totalRows > 32 ? '60 FPS Virtualized' : 'Interactive Viewport'})`;
    }

    tbody.innerHTML = '';
    const slice = filtered.slice(startIndex, endIndex);

    slice.forEach((inst, localIdx) => {
      const rIdx = inst.original_index ?? (startIndex + localIdx);
      const rowStages = simulationData.grid ? (simulationData.grid[rIdx] || []) : [];
      const ifCycle = rowStages.indexOf('IF') + 1;
      const wbCycle = rowStages.indexOf('WB') + 1 || rowStages.indexOf('COMMIT') + 1;
      const latency = (ifCycle > 0 && wbCycle >= ifCycle) ? (wbCycle - ifCycle + 1) : 5;
      const stallCount = rowStages.filter(s => s === 'STALL').length;

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-surface-container-low/40 transition-colors trace-row h-[44px]';
      tr.id = `trace-row-${rIdx}`;
      tr.innerHTML = `
        <td class="w-20 py-2.5 px-space-md font-code-mono font-bold text-on-surface">${escapeHtml(inst.id)}</td>
        <td class="w-48 py-2.5 px-space-md font-code-mono text-on-surface truncate" title="${escapeHtml(inst.text)}">${escapeHtml(inst.text)}</td>
        <td class="w-36 py-2.5 px-space-md">
          <span class="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface text-label-xs font-semibold truncate block max-w-[120px]">${escapeHtml(inst.type || 'ALU')}</span>
        </td>
        <td class="w-28 py-2.5 px-space-md font-code-mono text-on-surface-variant">Cyc ${ifCycle || 1}</td>
        <td class="w-32 py-2.5 px-space-md font-code-mono text-on-surface-variant">Cyc ${wbCycle || 5}</td>
        <td class="w-44 py-2.5 px-space-md font-code-mono ${stallCount > 0 ? 'text-error font-bold' : 'text-on-surface'}">
          ${latency} cyc ${stallCount > 0 ? `(+${stallCount} Bub)` : ''}
        </td>
        <td class="w-36 py-2.5 px-space-md" id="trace-status-${rIdx}">
          <span class="inline-flex items-center gap-1 text-on-surface-variant font-label-xs font-semibold">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Queued
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });

    updateTraceTableStatus(currentCycle);
  }

  function updateTraceTableStatus(cycle) {
    if (!simulationData || !simulationData.grid) return;

    const filtered = getFilteredInstructions();
    filtered.forEach((inst) => {
      const rIdx = inst.original_index ?? simulationData.instructions.indexOf(inst);
      const rowStages = simulationData.grid[rIdx] || [];
      const stage = rowStages[cycle - 1] || "";
      const ifCycle = rowStages.indexOf('IF') + 1;
      const wbCycle = rowStages.indexOf('WB') + 1 || rowStages.indexOf('COMMIT') + 1;
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
        statusEl.innerHTML = `<span class="inline-flex items-center gap-1 ${colorClass} font-label-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>${isStalled ? 'Stalled' : `In-Flight (${stage})`}</span>`;
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
      btnRun.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">sync</span><span>Running...</span>`;
      btnRun.className = "inline-flex items-center gap-1.5 h-10 px-space-lg rounded-lg bg-emerald-600 text-white font-label-md text-label-md shadow-md ring-2 ring-emerald-300 transition-all";
    }

    if (playTimer) clearInterval(playTimer);
    playTimer = setInterval(() => {
      if (currentCycle >= maxCycles) {
        currentCycle = 1;
        highlightActiveCycle(currentCycle);
      } else {
        currentCycle++;
        highlightActiveCycle(currentCycle);
      }
    }, stepSpeedMs);
  }

  function pause() {
    isPlaying = false;
    const btnRun = document.getElementById('btn-run');
    if (btnRun) {
      btnRun.innerHTML = `<span class="material-symbols-outlined text-[18px]">play_arrow</span><span>Run</span>`;
      btnRun.className = "inline-flex items-center gap-1.5 h-10 px-space-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container transition-colors";
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

    // Speed selector buttons
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

    // Architecture Mode Toggle
    const btnInOrder = document.getElementById('mode-btn-inorder');
    const btnOoO = document.getElementById('mode-btn-ooo');

    if (btnInOrder) {
      btnInOrder.addEventListener('click', () => {
        if (executionMode === 'in_order') return;
        executionMode = 'in_order';
        updateModeUI();
        const count = getCurrentWorkloadCount();
        fetchSimulation(count, forwardingEnabled);
        if (window.showToast) window.showToast('Switched to Classic 5-Stage In-Order RISC Pipeline', 'info');
      });
    }

    if (btnOoO) {
      btnOoO.addEventListener('click', () => {
        if (executionMode === 'out_of_order') return;
        executionMode = 'out_of_order';
        updateModeUI();
        const count = getCurrentWorkloadCount();
        fetchSimulation(count, forwardingEnabled);
        if (window.showToast) window.showToast(`Switched to Superscalar OoO Engine (${issueWidth}-Wide Tomasulo)`, 'success');
      });
    }

    // Issue Width & ROB Size selectors
    const issueSelect = document.getElementById('issue-width-select');
    if (issueSelect) {
      issueSelect.addEventListener('change', () => {
        issueWidth = parseInt(issueSelect.value, 10) || 2;
        const count = getCurrentWorkloadCount();
        fetchSimulation(count, forwardingEnabled);
        if (window.showToast) window.showToast(`Configured Superscalar Issue Width: ${issueWidth}-Wide`, 'info');
      });
    }

    const robSelect = document.getElementById('rob-size-select');
    if (robSelect) {
      robSelect.addEventListener('change', () => {
        robSize = parseInt(robSelect.value, 10) || 16;
        const count = getCurrentWorkloadCount();
        fetchSimulation(count, forwardingEnabled);
        if (window.showToast) window.showToast(`Configured Reorder Buffer (ROB) Size: ${robSize} Entries`, 'info');
      });
    }

    // Workload preset dropdown
    const countSelect = document.getElementById('instruction-count-select');
    if (countSelect) {
      countSelect.addEventListener('change', () => {
        customInstructions = null; // reset custom dump when selecting preset
        const count = parseInt(countSelect.value, 10) || 6;
        fetchSimulation(count, forwardingEnabled);
        if (window.showToast) window.showToast(`Simulating ${count} instructions workload...`, 'info');
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

        const count = getCurrentWorkloadCount();
        fetchSimulation(count, forwardingEnabled);

        if (window.showToast) {
          window.showToast(forwardingEnabled ? 'Forwarding Unit: Enabled (Bypass Active)' : 'Forwarding Unit: Disabled (Stalls Inserted)', 'info');
        }
      });
    }

    // Virtualized Table Scroll Handler
    const scrollContainer = document.getElementById('trace-scroll-container');
    if (scrollContainer) {
      let isScrolling = false;
      scrollContainer.addEventListener('scroll', () => {
        if (!isScrolling) {
          window.requestAnimationFrame(() => {
            renderVirtualTraceTable();
            isScrolling = false;
          });
          isScrolling = true;
        }
      });
    }

    // Trace search filter input
    const filterInput = document.getElementById('trace-filter-input');
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        traceFilterText = e.target.value.trim();
        if (scrollContainer) scrollContainer.scrollTop = 0;
        renderVirtualTraceTable();
      });
    }

    // Assembly file upload handler (.s, .asm, .txt dumps 500+)
    const uploadBtn = document.getElementById('btn-upload-file');
    const fileInput = document.getElementById('assembly-file-input');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = evt.target.result;
          const lines = text.split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith(';') && !l.startsWith('.'));

          if (lines.length === 0) {
            if (window.showToast) window.showToast('No executable assembly instructions parsed from file', 'error');
            return;
          }

          customInstructions = lines;
          if (countSelect) {
            // Find closest or leave as custom
            countSelect.value = lines.length <= 12 ? String(lines.length) : '500';
          }

          fetchSimulation(lines.length, forwardingEnabled, lines);
          if (window.showToast) {
            window.showToast(`Loaded ${lines.length} RISC-V instructions from ${file.name}! Viewport virtualized.`, 'success');
          }
        };
        reader.readAsText(file);
      });
    }

    // Export trace CSV button
    const exportBtn = document.getElementById('btn-export-trace');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        if (!simulationData || !simulationData.instructions) {
          if (window.showToast) window.showToast('No active pipeline simulation data', 'error');
          return;
        }
        let csv = 'Instruction,Disassembly,Type,IF_Cycle,WB_Cycle,Latency,Stalls\n';
        simulationData.instructions.forEach((inst, idx) => {
          const rowStages = simulationData.grid ? (simulationData.grid[idx] || []) : [];
          const ifCycle = rowStages.indexOf('IF') + 1;
          const wbCycle = rowStages.indexOf('WB') + 1 || rowStages.indexOf('COMMIT') + 1;
          const stalls = rowStages.filter(s => s === 'STALL').length;
          const latency = (wbCycle >= ifCycle && ifCycle > 0) ? (wbCycle - ifCycle + 1) : 5;
          csv += `"${inst.id}","${inst.text}","${inst.type}",${ifCycle || 1},${wbCycle || 5},${latency},${stalls}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pipeline_trace_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        if (window.showToast) window.showToast('Exported pipeline execution trace log', 'success');
      });
    }

    // Custom Program Modal trigger
    const customBtn = document.getElementById('btn-custom-program');
    if (customBtn) {
      customBtn.addEventListener('click', openCustomProgramModal);
    }

    const submitCustomBtn = document.getElementById('btn-submit-custom-program');
    if (submitCustomBtn) {
      submitCustomBtn.addEventListener('click', () => {
        const textarea = document.getElementById('custom-assembly-textarea');
        if (!textarea) return;
        const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith(';'));
        if (lines.length === 0) {
          if (window.showToast) window.showToast('Please enter at least one instruction', 'warning');
          return;
        }
        closeCustomProgramModal();
        fetchSimulation(lines.length, forwardingEnabled, lines);
        if (window.showToast) window.showToast(`Simulating custom workload: ${lines.length} instructions`, 'success');
      });
    }
  }

  function getCurrentWorkloadCount() {
    const countSelect = document.getElementById('instruction-count-select');
    return countSelect ? (parseInt(countSelect.value, 10) || 6) : 6;
  }

  function openCustomProgramModal() {
    const modal = document.getElementById('custom-program-modal');
    if (modal) modal.classList.add('open');
  }

  function closeCustomProgramModal() {
    const modal = document.getElementById('custom-program-modal');
    if (modal) modal.classList.remove('open');
  }

  function loadProgramPreset(preset) {
    const textarea = document.getElementById('custom-assembly-textarea');
    if (!textarea) return;
    if (preset === 'raw') {
      textarea.value = "LW R1, 0(R2)\nADD R3, R1, R4\nSUB R5, R3, R6\nSW R5, 8(R2)";
    } else if (preset === 'alu') {
      textarea.value = "ADD R1, R2, R3\nSUB R4, R1, R5\nOR R6, R4, R7\nAND R8, R6, R9";
    } else if (preset === 'branch') {
      textarea.value = "ADDI R1, R0, 5\nSUB R2, R1, R3\nBEQ R2, R0, Target\nOR R4, R5, R6\nSW R4, 0(R7)";
    }
  }

  window.openCustomProgramModal = openCustomProgramModal;
  window.closeCustomProgramModal = closeCustomProgramModal;
  window.loadProgramPreset = loadProgramPreset;

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
