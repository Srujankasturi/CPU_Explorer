/**
 * CPU Performance Explorer - Advanced Visualizations Controller
 * Heatmaps, Memory Pyramid, Pipeline Waterfall, and Execution Curves
 */

(function () {
  let vizData = null;
  let activeTab = 'heatmap';

  async function loadVisualizations() {
    const heatmapBody = document.getElementById('heatmap-body');
    if (heatmapBody && !vizData) {
      heatmapBody.innerHTML = `
        <div class="py-8 text-center text-on-surface-variant font-code-mono text-label-xs flex items-center justify-center gap-2">
          <span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          <span>Sampling microarchitectural performance matrix...</span>
        </div>
      `;
    }

    try {
      const data = await apiFetch('/api/visualizations/data');
      if (data) {
        vizData = data;
        renderHeatmap(data.heatmap);
        renderMemoryPyramid(data.memory_pyramid);
        renderWaterfall(data.waterfall);
        updateTabMessages(data);
      }
    } catch (e) {
      console.warn('Visualizations fetch error:', e.message);
      if (heatmapBody) {
        heatmapBody.innerHTML = `
          <div class="py-6 text-center text-error font-body-sm flex flex-col items-center gap-2">
            <span>Failed to sample live utilization data: ${escapeHtml(e.message)}</span>
            <button class="px-3 py-1 rounded-lg bg-surface-container font-label-xs text-on-surface" onclick="location.reload()">Retry</button>
          </div>
        `;
      }
    }
  }

  function getHeatmapColor(pct) {
    if (pct < 25) return { bg: 'bg-[#86efac]', text: 'text-on-surface' };
    if (pct < 50) return { bg: 'bg-[#4ade80]', text: 'text-white' };
    if (pct < 65) return { bg: 'bg-[#facc15]', text: 'text-on-surface' };
    if (pct < 85) return { bg: 'bg-[#fb923c]', text: 'text-white' };
    return { bg: 'bg-[#ef4444]', text: 'text-white' };
  }

  function renderHeatmap(matrix) {
    const container = document.getElementById('heatmap-body');
    if (!container || !Array.isArray(matrix)) return;

    container.innerHTML = '';
    matrix.forEach((row, idx) => {
      const coreNum = idx + 1;
      const rowDiv = document.createElement('div');
      rowDiv.className = 'grid grid-cols-8 gap-2 items-center';

      let cellsHtml = `<span class="text-on-surface-variant font-semibold text-left pl-1">Core ${coreNum}</span>`;
      row.forEach(val => {
        const color = getHeatmapColor(val);
        cellsHtml += `
          <span class="h-8 rounded ${color.bg} flex items-center justify-center text-[10px] ${color.text} font-bold shadow-xs transition-transform hover:scale-105 cursor-pointer" title="Core ${coreNum}: ${val}% utilization">
            ${val}%
          </span>
        `;
      });

      rowDiv.innerHTML = cellsHtml;
      container.appendChild(rowDiv);
    });
  }

  function renderMemoryPyramid(pyramid) {
    if (!Array.isArray(pyramid)) return;

    const l1 = pyramid.find(p => p.level.includes('L1'));
    const l2 = pyramid.find(p => p.level.includes('L2'));
    const l3 = pyramid.find(p => p.level.includes('L3'));
    const dram = pyramid.find(p => p.level.includes('DDR') || p.level.includes('RAM'));

    const elL1 = document.getElementById('pyramid-l1-latency');
    const elL2 = document.getElementById('pyramid-l2-latency');
    const elL3 = document.getElementById('pyramid-l3-latency');
    const elDram = document.getElementById('pyramid-dram-latency');

    if (elL1 && l1) elL1.innerText = `${l1.latency_cycles} Cycles (${l1.hit_rate}% Hit)`;
    if (elL2 && l2) elL2.innerText = `${l2.latency_cycles} Cycles (${l2.hit_rate}% Hit)`;
    if (elL3 && l3) elL3.innerText = `${l3.latency_cycles} Cycles (${l3.hit_rate}% Hit)`;
    if (elDram && dram) elDram.innerText = `${dram.latency_cycles} Cycles (~61.1ns)`;
  }

  function renderWaterfall(waterfall) {
    if (!Array.isArray(waterfall)) return;

    const totalItem = waterfall.find(w => w.stage && w.stage.toLowerCase().includes('total'));
    const totalCycles = totalItem ? totalItem.cycles : 15780;

    const branchItem = waterfall.find(w => w.stage && w.stage.toLowerCase().includes('branch'));
    const l1Item = waterfall.find(w => w.stage && w.stage.toLowerCase().includes('l1 cache'));
    const memBusItem = waterfall.find(w => w.stage && w.stage.toLowerCase().includes('memory bus'));
    const rawItem = waterfall.find(w => w.stage && w.stage.toLowerCase().includes('raw'));

    const memCycles = (l1Item ? l1Item.cycles : 2400) + (memBusItem ? memBusItem.cycles : 940);
    const branchCycles = branchItem ? branchItem.cycles : 1420;
    const rawCycles = rawItem ? rawItem.cycles : 1840;

    const memPct = ((memCycles / totalCycles) * 100).toFixed(1);
    const branchPct = ((branchCycles / totalCycles) * 100).toFixed(1);
    const rawPct = ((rawCycles / totalCycles) * 100).toFixed(1);

    const elMemText = document.getElementById('waterfall-memory-cyc-text');
    if (elMemText) elMemText.innerText = `${memCycles.toLocaleString()} cyc (${memPct}%)`;

    const elBranchText = document.getElementById('waterfall-branch-cyc-text');
    if (elBranchText) elBranchText.innerText = `${branchCycles.toLocaleString()} cyc (${branchPct}%)`;

    const elRawText = document.getElementById('waterfall-raw-cyc-text');
    if (elRawText) elRawText.innerText = `${rawCycles.toLocaleString()} cyc (${rawPct}%)`;
  }

  const tabMessages = {
    branch: { msg: 'Branch Speculation: 1,420 cycles lost to branch misprediction flushes (9.0% penalty)', type: 'warning' },
    memory: { msg: 'Memory Subsystem: 3,340 cycles lost to L1 cache misses & memory bus contention (21.2% penalty)', type: 'info' },
    cache: { msg: 'Cache Hierarchy: L1 (4 cyc) → L2 (14 cyc) → L3 (42 cyc) → DDR5 (180 cyc)', type: 'info' },
    heatmap: { msg: 'Multi-Core Heatmap: Live workload balancing matrix', type: 'success' },
    sankey: { msg: 'Sankey Flow: Instruction dispatch routing from fetch to execution units', type: 'info' },
    waterfall: { msg: 'Execution Waterfall: Detailed cycle breakdown of active compute vs stall overhead', type: 'info' },
    treemap: { msg: 'Equilibrium Treemap: Microarchitectural resource balance & power budget', type: 'info' }
  };

  function updateTabMessages(data) {
    if (!data) return;
    const cores = data.logical_cores || (data.heatmap ? data.heatmap.length : 8);
    tabMessages.heatmap.msg = `Multi-Core Heatmap: Live ${cores}-thread workload balancing matrix`;

    if (Array.isArray(data.waterfall)) {
      const totalItem = data.waterfall.find(w => w.stage && w.stage.toLowerCase().includes('total'));
      const totalCycles = totalItem ? totalItem.cycles : 15780;
      const branchItem = data.waterfall.find(w => w.stage && w.stage.toLowerCase().includes('branch'));
      const l1Item = data.waterfall.find(w => w.stage && w.stage.toLowerCase().includes('l1 cache'));
      const memBusItem = data.waterfall.find(w => w.stage && w.stage.toLowerCase().includes('memory bus'));

      const memCycles = (l1Item ? l1Item.cycles : 2400) + (memBusItem ? memBusItem.cycles : 940);
      const branchCycles = branchItem ? branchItem.cycles : 1420;

      const memPct = ((memCycles / totalCycles) * 100).toFixed(1);
      const branchPct = ((branchCycles / totalCycles) * 100).toFixed(1);

      tabMessages.branch.msg = `Branch Speculation: ${branchCycles.toLocaleString()} cycles lost to branch misprediction flushes (${branchPct}% penalty)`;
      tabMessages.memory.msg = `Memory Subsystem: ${memCycles.toLocaleString()} cycles lost to L1 cache misses & memory bus contention (${memPct}% penalty)`;
    }
  }

  function setupTabs() {
    const tabTargetMap = {
      heatmap: 'viz-card-heatmap',
      sankey: 'viz-card-sankey',
      waterfall: 'viz-card-waterfall',
      treemap: 'viz-card-equilibrium',
      cache: 'viz-card-cache',
      memory: 'viz-card-cache',
      branch: 'viz-card-waterfall'
    };

    const tabs = document.querySelectorAll('.viz-tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', function () {
        tabs.forEach(t => {
          t.className = 'viz-tab-btn px-4 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-all';
        });
        this.className = 'viz-tab-btn px-4 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold shadow-sm transition-all';

        activeTab = this.getAttribute('data-tab');
        const targetId = tabTargetMap[activeTab];
        if (targetId) {
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.classList.add('ring-2', 'ring-primary');
            setTimeout(() => targetEl.classList.remove('ring-2', 'ring-primary'), 1600);
          }
        }

        // Specifically highlight row inside waterfall when Branch or Memory is chosen
        if (activeTab === 'branch') {
          const branchRow = document.getElementById('waterfall-branch-row');
          if (branchRow) {
            branchRow.classList.add('ring-2', 'ring-error', 'bg-error/10');
            setTimeout(() => branchRow.classList.remove('ring-2', 'ring-error', 'bg-error/10'), 2500);
          }
        } else if (activeTab === 'memory') {
          const memRow = document.getElementById('waterfall-memory-row');
          if (memRow) {
            memRow.classList.add('ring-2', 'ring-secondary', 'bg-secondary/10');
            setTimeout(() => memRow.classList.remove('ring-2', 'ring-secondary', 'bg-secondary/10'), 2500);
          }
        }

        if (window.showToast) {
          const info = tabMessages[activeTab] || { msg: `Viewing ${this.textContent.trim()} component`, type: 'info' };
          window.showToast(info.msg, info.type);
        }
      });
    });
  }

  function setupControls() {
    // Reprofile Trace button
    const reprofileBtn = document.getElementById('btn-reprofile-trace');
    if (reprofileBtn) {
      reprofileBtn.addEventListener('click', async () => {
        const icon = reprofileBtn.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.add('animate-spin');
        vizData = null;
        await loadVisualizations();
        setTimeout(() => {
          if (icon) icon.classList.remove('animate-spin');
        }, 500);
        if (window.showToast) window.showToast('Re-profiled microarchitectural telemetry stream', 'success');
      });
    }

    // Fullscreen toggle
    const fullScreenBtn = document.getElementById('fullscreen-toggle');
    if (fullScreenBtn) {
      fullScreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          fullScreenBtn.querySelector('span').textContent = 'fullscreen_exit';
        } else {
          document.exitFullscreen().catch(() => {});
          fullScreenBtn.querySelector('span').textContent = 'fullscreen';
        }
      });
    }

    // Export CSV button
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
      if (btn.textContent.includes('Export CSV')) {
        btn.addEventListener('click', () => {
          if (!vizData || !vizData.heatmap) {
            if (window.showToast) window.showToast('No telemetry data available to export', 'error');
            return;
          }
          let csv = 'Core,0s,10s,20s,30s,40s,50s,60s\n';
          vizData.heatmap.forEach((row, i) => {
            csv += `Core ${i + 1},` + row.join(',') + '\n';
          });
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cpu_telemetry_heatmap_${Date.now()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          if (window.showToast) window.showToast('Downloaded Heatmap CSV', 'success');
        });
      }

      if (btn.textContent.includes('Download High-Res')) {
        btn.addEventListener('click', () => {
          window.print();
        });
      }
    });
  }

  function init() {
    setupTabs();
    setupControls();
    loadVisualizations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
