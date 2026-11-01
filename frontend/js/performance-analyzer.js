/**
 * CPU Performance Explorer - Performance Analyzer Controller
 * Implements the Iron Law of Processor Performance:
 * Execution Time = Instruction Count × CPI × Clock Cycle Time
 * CPI = Total Cycles / Total Instructions
 * IPC = 1 / CPI
 * MIPS = Frequency (MHz) / CPI
 * Weighted CPI = Σ(Count_i × CPI_i) / Total Instructions
 */

(function () {
  let currentMode = 'single'; // 'single' | 'isa'

  function updateDerivedCycleTime() {
    const freqInput = currentMode === 'single'
      ? document.getElementById('input-frequency')
      : document.getElementById('input-isa-freq');
    const unitSelect = currentMode === 'single'
      ? document.getElementById('input-unit')
      : document.getElementById('input-isa-unit');
    const displayEl = document.getElementById('display-cycle-time');

    if (!freqInput || !unitSelect || !displayEl) return;

    const freq = parseFloat(freqInput.value) || 1.0;
    const unitMultiplier = parseFloat(unitSelect.value) || 1e9;
    const freqHz = freq * unitMultiplier;
    const cycleTimeNs = (1 / freqHz) * 1e9;

    displayEl.innerText = cycleTimeNs >= 1 ? cycleTimeNs.toFixed(2) : cycleTimeNs.toFixed(3);
  }

  function setMode(mode) {
    currentMode = mode;
    const singleBtn = document.getElementById('mode-single');
    const isaBtn = document.getElementById('mode-isa');
    const singleForm = document.getElementById('form-single-mode');
    const isaForm = document.getElementById('form-isa-mode');

    const activeClass = "px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-primary shadow-sm font-label-md text-label-md transition-all flex items-center gap-1.5";
    const inactiveClass = "px-space-md py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-all flex items-center gap-1.5";

    if (mode === 'single') {
      if (singleBtn) singleBtn.className = activeClass;
      if (isaBtn) isaBtn.className = inactiveClass;
      if (singleForm) singleForm.classList.remove('hidden');
      if (isaForm) isaForm.classList.add('hidden');
    } else {
      if (isaBtn) isaBtn.className = activeClass;
      if (singleBtn) singleBtn.className = inactiveClass;
      if (singleForm) singleForm.classList.add('hidden');
      if (isaForm) isaForm.classList.remove('hidden');
    }

    updateDerivedCycleTime();
    runAnalysis();
  }

  async function runAnalysis() {
    if (currentMode === 'single') {
      await runSingleAnalysis();
    } else {
      await runIsaAnalysis();
    }
  }

  async function runSingleAnalysis() {
    const icInput = document.getElementById('input-ic');
    const cyclesInput = document.getElementById('input-cycles');
    const freqInput = document.getElementById('input-frequency');
    const unitSelect = document.getElementById('input-unit');

    if (!icInput || !cyclesInput || !freqInput) return;

    const ic = parseFloat(icInput.value);
    const cycles = parseFloat(cyclesInput.value);
    const freq = parseFloat(freqInput.value);
    const unit = unitSelect ? unitSelect.value : '1e9';

    if (isNaN(ic) || ic <= 0) {
      if (window.showToast) window.showToast('Instruction count must be greater than 0', 'error');
      return;
    }
    if (isNaN(cycles) || cycles <= 0) {
      if (window.showToast) window.showToast('Clock cycles must be greater than 0', 'error');
      return;
    }
    if (isNaN(freq) || freq <= 0) {
      if (window.showToast) window.showToast('Clock frequency must be greater than 0', 'error');
      return;
    }

    try {
      const res = await apiFetch('/api/analyzer/single', {
        method: 'POST',
        body: JSON.stringify({
          instruction_count: ic,
          cycles: cycles,
          frequency: freq,
          unit: unit
        })
      });

      if (res) {
        updateResultsUI(res, ic);
      }
    } catch (e) {
      if (window.showToast) window.showToast('Analysis error: ' + e.message, 'error');
    }
  }

  async function runIsaAnalysis() {
    const aluCount = parseFloat(document.getElementById('input-alu-count')?.value || 0);
    const aluCpi = parseFloat(document.getElementById('input-alu-cpi')?.value || 1.0);
    const memCount = parseFloat(document.getElementById('input-mem-count')?.value || 0);
    const memCpi = parseFloat(document.getElementById('input-mem-cpi')?.value || 4.0);
    const branchCount = parseFloat(document.getElementById('input-branch-count')?.value || 0);
    const branchCpi = parseFloat(document.getElementById('input-branch-cpi')?.value || 3.0);
    const otherCount = parseFloat(document.getElementById('input-other-count')?.value || 0);
    const otherCpi = parseFloat(document.getElementById('input-other-cpi')?.value || 2.0);

    const freqInput = document.getElementById('input-isa-freq');
    const unitSelect = document.getElementById('input-isa-unit');
    const freq = parseFloat(freqInput?.value || 3.0);
    const unit = unitSelect ? unitSelect.value : '1e9';

    const totalIc = aluCount + memCount + branchCount + otherCount;
    if (totalIc <= 0) {
      if (window.showToast) window.showToast('Total instructions across categories must be greater than 0', 'error');
      return;
    }
    if (freq <= 0) {
      if (window.showToast) window.showToast('Clock frequency must be greater than 0', 'error');
      return;
    }

    const payload = {
      alu_count: aluCount,
      alu_cpi: aluCpi,
      mem_count: memCount,
      mem_cpi: memCpi,
      branch_count: branchCount,
      branch_cpi: branchCpi,
      other_count: otherCount,
      other_cpi: otherCpi,
      frequency: freq,
      unit: unit
    };

    try {
      const res = await apiFetch('/api/analyzer/instruction-set', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res) {
        updateResultsUI(res, totalIc);
      }
    } catch (e) {
      if (window.showToast) window.showToast('ISA Analysis error: ' + e.message, 'error');
    }
  }

  function updateResultsUI(res, totalInstructions) {
    const cpi = res.cpi ?? res.weighted_cpi ?? 0;
    const ipc = res.ipc ?? 0;
    const execTimeMs = res.execution_time_ms ?? 0;
    const mips = res.mips ?? 0;

    // 1. KPI Cards
    const cpiEl = document.getElementById('metric-cpi');
    const ipcEl = document.getElementById('metric-ipc');
    const execTimeEl = document.getElementById('metric-exectime');
    const mipsEl = document.getElementById('metric-mips');

    if (cpiEl) cpiEl.innerText = cpi.toFixed(2);
    if (ipcEl) ipcEl.innerText = ipc.toFixed(2);
    if (execTimeEl) execTimeEl.innerText = execTimeMs >= 1 ? execTimeMs.toFixed(2) : execTimeMs.toFixed(4);
    if (mipsEl) mipsEl.innerText = mips >= 100 ? mips.toFixed(1) : mips.toFixed(2);

    // 2. Trend Badges (Calculated deltas vs baseline)
    const trendCpiEl = document.getElementById('trend-cpi');
    const trendIpcEl = document.getElementById('trend-ipc');
    const trendExecEl = document.getElementById('trend-exectime');
    const trendMipsEl = document.getElementById('trend-mips');

    if (trendCpiEl) {
      const delta = res.trend_cpi ?? 0;
      trendCpiEl.innerText = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
      const badge = trendCpiEl.parentElement;
      if (badge) {
        badge.className = delta <= 0
          ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-xs text-label-xs font-bold"
          : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-xs text-label-xs font-bold";
        const icon = badge.querySelector('.material-symbols-outlined');
        if (icon) icon.innerText = delta <= 0 ? 'arrow_downward' : 'arrow_upward';
      }
    }

    if (trendIpcEl) {
      const delta = res.trend_ipc ?? 0;
      trendIpcEl.innerText = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
      const badge = trendIpcEl.parentElement;
      if (badge) {
        badge.className = delta >= 0
          ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-xs text-label-xs font-bold"
          : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-xs text-label-xs font-bold";
        const icon = badge.querySelector('.material-symbols-outlined');
        if (icon) icon.innerText = delta >= 0 ? 'arrow_upward' : 'arrow_downward';
      }
    }

    if (trendExecEl) {
      const delta = res.trend_exectime ?? 0;
      trendExecEl.innerText = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
      const badge = trendExecEl.parentElement;
      if (badge) {
        badge.className = delta <= 0
          ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-xs text-label-xs font-bold"
          : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-xs text-label-xs font-bold";
        const icon = badge.querySelector('.material-symbols-outlined');
        if (icon) icon.innerText = delta <= 0 ? 'arrow_downward' : 'arrow_upward';
      }
    }

    if (trendMipsEl) {
      const delta = res.trend_mips ?? 0;
      trendMipsEl.innerText = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
      const badge = trendMipsEl.parentElement;
      if (badge) {
        badge.className = delta >= 0
          ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-xs text-label-xs font-bold"
          : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-xs text-label-xs font-bold";
        const icon = badge.querySelector('.material-symbols-outlined');
        if (icon) icon.innerText = delta >= 0 ? 'arrow_upward' : 'arrow_downward';
      }
    }

    // 3. Stage Breakdown Horizontal Bars
    if (res.stage_breakdown) {
      const sb = res.stage_breakdown;
      const stages = ['if', 'id', 'ex', 'mem', 'wb'];
      stages.forEach(st => {
        const key = st.toUpperCase();
        const data = sb[key];
        if (data) {
          const bar = document.getElementById(`stage-${st}-bar`);
          const text = document.getElementById(`stage-${st}-text`);
          if (bar) bar.style.width = `${data.pct}%`;
          if (text) text.innerText = `${data.pct}% • ${data.cycles.toLocaleString()} cyc`;
        }
      });
    }

    // 4. Donut Chart & Legend
    const donutTotal = document.getElementById('donut-total');
    if (donutTotal) donutTotal.innerText = Math.round(totalInstructions).toLocaleString();

    const dist = res.instruction_distribution;
    if (dist) {
      const circumference = 389.55;
      let cumulativeOffset = 0;

      const aluPct = dist.ALU?.pct || 0;
      const memPct = dist.Memory?.pct || 0;
      const brPct = dist.Branch?.pct || 0;
      const othPct = dist.Others?.pct || 0;

      const circleAlu = document.getElementById('donut-circle-alu');
      const circleMem = document.getElementById('donut-circle-mem');
      const circleBranch = document.getElementById('donut-circle-branch');
      const circleOther = document.getElementById('donut-circle-other');

      if (circleAlu) {
        const dash = (aluPct / 100) * circumference;
        circleAlu.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${circumference}`);
        circleAlu.setAttribute('stroke-dashoffset', (-cumulativeOffset).toFixed(1));
        cumulativeOffset += dash;
      }
      if (circleMem) {
        const dash = (memPct / 100) * circumference;
        circleMem.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${circumference}`);
        circleMem.setAttribute('stroke-dashoffset', (-cumulativeOffset).toFixed(1));
        cumulativeOffset += dash;
      }
      if (circleBranch) {
        const dash = (brPct / 100) * circumference;
        circleBranch.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${circumference}`);
        circleBranch.setAttribute('stroke-dashoffset', (-cumulativeOffset).toFixed(1));
        cumulativeOffset += dash;
      }
      if (circleOther) {
        const dash = (othPct / 100) * circumference;
        circleOther.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${circumference}`);
        circleOther.setAttribute('stroke-dashoffset', (-cumulativeOffset).toFixed(1));
      }

      // Legend
      const lAluLbl = document.getElementById('legend-alu-label');
      const lAluCnt = document.getElementById('legend-alu-count');
      if (lAluLbl) lAluLbl.innerText = `ALU (${aluPct}%)`;
      if (lAluCnt) lAluCnt.innerText = `${(dist.ALU?.count || 0).toLocaleString()} inst`;

      const lMemLbl = document.getElementById('legend-mem-label');
      const lMemCnt = document.getElementById('legend-mem-count');
      if (lMemLbl) lMemLbl.innerText = `Memory (${memPct}%)`;
      if (lMemCnt) lMemCnt.innerText = `${(dist.Memory?.count || 0).toLocaleString()} inst`;

      const lBrLbl = document.getElementById('legend-branch-label');
      const lBrCnt = document.getElementById('legend-branch-count');
      if (lBrLbl) lBrLbl.innerText = `Branch (${brPct}%)`;
      if (lBrCnt) lBrCnt.innerText = `${(dist.Branch?.count || 0).toLocaleString()} inst`;

      const lOthLbl = document.getElementById('legend-other-label');
      const lOthCnt = document.getElementById('legend-other-count');
      if (lOthLbl) lOthLbl.innerText = `Others (${othPct}%)`;
      if (lOthCnt) lOthCnt.innerText = `${(dist.Others?.count || 0).toLocaleString()} inst`;
    }
  }

  function resetDefaults() {
    if (currentMode === 'single') {
      const icInput = document.getElementById('input-ic');
      const cyclesInput = document.getElementById('input-cycles');
      const freqInput = document.getElementById('input-frequency');
      const unitSelect = document.getElementById('input-unit');

      if (icInput) icInput.value = 10000;
      if (cyclesInput) cyclesInput.value = 24700;
      if (freqInput) freqInput.value = 3.0;
      if (unitSelect) unitSelect.value = '1e9';
    } else {
      document.getElementById('input-alu-count').value = 4200;
      document.getElementById('input-alu-cpi').value = 1.0;
      document.getElementById('input-mem-count').value = 2800;
      document.getElementById('input-mem-cpi').value = 4.0;
      document.getElementById('input-branch-count').value = 1200;
      document.getElementById('input-branch-cpi').value = 3.0;
      document.getElementById('input-other-count').value = 1800;
      document.getElementById('input-other-cpi').value = 2.0;
      document.getElementById('input-isa-freq').value = 3.0;
      document.getElementById('input-isa-unit').value = '1e9';
    }

    updateDerivedCycleTime();
    runAnalysis();
    if (window.showToast) window.showToast('Reset parameters to reference baseline', 'info');
  }

  function loadSamplePreset(preset) {
    if (currentMode === 'single') {
      const icInput = document.getElementById('input-ic');
      const cyclesInput = document.getElementById('input-cycles');
      const freqInput = document.getElementById('input-frequency');

      if (preset === 'arm64') {
        if (icInput) icInput.value = 18500;
        if (cyclesInput) cyclesInput.value = 29600;
        if (freqInput) freqInput.value = 3.5;
        if (window.showToast) window.showToast('Loaded ARM v9 Neoverse workload (High-IPC Profile)', 'info');
      } else if (preset === 'x86_avx') {
        if (icInput) icInput.value = 25000;
        if (cyclesInput) cyclesInput.value = 32000;
        if (freqInput) freqInput.value = 4.2;
        if (window.showToast) window.showToast('Loaded x86 AVX-512 vector workload', 'info');
      }
    } else {
      if (preset === 'arm64' || preset === 'balanced') {
        document.getElementById('input-alu-count').value = 6000;
        document.getElementById('input-alu-cpi').value = 1.0;
        document.getElementById('input-mem-count').value = 2000;
        document.getElementById('input-mem-cpi').value = 3.0;
        document.getElementById('input-branch-count').value = 1000;
        document.getElementById('input-branch-cpi').value = 2.0;
        document.getElementById('input-other-count').value = 1000;
        document.getElementById('input-other-cpi').value = 1.5;
        if (window.showToast) window.showToast('Loaded Balanced RISC ISA Mix', 'info');
      }
    }

    updateDerivedCycleTime();
    runAnalysis();
  }

  function copyMetrics() {
    const cpi = document.getElementById('metric-cpi')?.innerText || '2.47';
    const ipc = document.getElementById('metric-ipc')?.innerText || '0.40';
    const mips = document.getElementById('metric-mips')?.innerText || '1214.6';
    const execTime = document.getElementById('metric-exectime')?.innerText || '8.23';

    const spec = {
      mode: currentMode,
      cpi: cpi,
      ipc: ipc,
      mips: mips,
      execution_time_ms: execTime
    };
    navigator.clipboard?.writeText(JSON.stringify(spec, null, 2));
    if (window.showToast) window.showToast('Copied metrics to clipboard', 'info');
  }

  window.setMode = setMode;
  window.runAnalysis = runAnalysis;
  window.resetDefaults = resetDefaults;
  window.loadSamplePreset = loadSamplePreset;
  window.copyMetrics = copyMetrics;

  function init() {
    const singleInputs = ['input-ic', 'input-cycles', 'input-frequency'];
    singleInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => {
        updateDerivedCycleTime();
        runAnalysis();
      });
    });

    const singleSelect = document.getElementById('input-unit');
    if (singleSelect) singleSelect.addEventListener('change', () => {
      updateDerivedCycleTime();
      runAnalysis();
    });

    const isaInputs = [
      'input-alu-count', 'input-alu-cpi',
      'input-mem-count', 'input-mem-cpi',
      'input-branch-count', 'input-branch-cpi',
      'input-other-count', 'input-other-cpi',
      'input-isa-freq'
    ];
    isaInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => {
        updateDerivedCycleTime();
        runAnalysis();
      });
    });

    const isaSelect = document.getElementById('input-isa-unit');
    if (isaSelect) isaSelect.addEventListener('change', () => {
      updateDerivedCycleTime();
      runAnalysis();
    });

    updateDerivedCycleTime();
    runAnalysis();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
