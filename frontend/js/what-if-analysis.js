/**
 * CPU Performance Explorer - What-if Analysis Controller
 * Interactive Architectural Parameter Sensitivity Simulator
 */

(function () {
  const elements = {
    freqSlider: document.getElementById('sliderFreq'),
    freqInput: document.getElementById('inputFreq'),
    cpiSlider: document.getElementById('sliderCPI'),
    cpiInput: document.getElementById('inputCPI'),
    cacheSlider: document.getElementById('sliderCacheMiss'),
    cacheInput: document.getElementById('inputCacheMiss'),
    branchSlider: document.getElementById('sliderBranchMis'),
    branchInput: document.getElementById('inputBranchMis'),
    stallSlider: document.getElementById('sliderStalls'),
    stallInput: document.getElementById('inputStalls'),

    resetBtn: document.getElementById('btnResetControls'),
    resetScenarioBtn: document.getElementById('btnResetScenario'),
    applyBtn: document.getElementById('btnApplyChanges'),
    recalcBtn: document.getElementById('btnRecalculate'),
    saveBtn: document.getElementById('btnSaveScenario'),
    loadBtn: document.getElementById('btnLoadScenario'),

    kpiExec: document.getElementById('kpiExecTime'),
    kpiExecDelta: document.getElementById('kpiExecDelta'),
    kpiIPC: document.getElementById('kpiIPC'),
    kpiIPCDelta: document.getElementById('kpiIPCDelta'),
    kpiGain: document.getElementById('kpiGain'),

    activePoint: document.getElementById('activePoint'),
    activePointLabel: document.getElementById('activePointLabel'),

    scen3Cpi: document.getElementById('scen3-cpi'),
    scen3Stalls: document.getElementById('scen3-stalls'),
    scen3Time: document.getElementById('scen3-time'),
    scen3Gain: document.getElementById('scen3-gain')
  };

  function syncPair(slider, input) {
    if (!slider || !input) return;
    slider.addEventListener('input', () => {
      input.value = slider.value;
      debouncedRun();
    });
    input.addEventListener('change', () => {
      slider.value = input.value;
      debouncedRun();
    });
  }

  let debounceTimer = null;
  function debouncedRun() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runWhatIfAnalysis, 60);
  }

  function getPayload() {
    return {
      frequency_ghz: parseFloat(elements.freqSlider?.value || 3.0),
      base_cpi: parseFloat(elements.cpiSlider?.value || 2.47),
      cache_miss_rate: parseFloat(elements.cacheSlider?.value || 10.0),
      branch_mispredict_rate: parseFloat(elements.branchSlider?.value || 8.0),
      stall_cycles: parseFloat(elements.stallSlider?.value || 2.0),
      instruction_count: 10000.0
    };
  }

  async function runWhatIfAnalysis() {
    const payload = getPayload();
    try {
      const res = await apiFetch('/api/what-if/analyze', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res) {
        updateWhatIfUI(res, payload);
      }
    } catch (e) {
      console.warn('What-if analyze error:', e.message);
    }
  }

  function updateWhatIfUI(data, payload) {
    const execMs = data.execution_time_ms;
    const speedup = data.speedup_pct;
    const ipc = data.ipc;

    // 1. KPI Cards
    if (elements.kpiExec) {
      elements.kpiExec.innerText = execMs.toFixed(1);
    }
    if (elements.kpiExecDelta) {
      const isImprovement = speedup >= 0;
      elements.kpiExecDelta.innerText = `${isImprovement ? '−' : '+'}${Math.abs(speedup).toFixed(1)}% Latency`;
    }

    if (elements.kpiIPC) {
      elements.kpiIPC.innerText = ipc.toFixed(2);
    }
    if (elements.kpiIPCDelta) {
      const ipcBase = 0.35;
      const ipcBoost = (((ipc - ipcBase) / ipcBase) * 100).toFixed(1);
      elements.kpiIPCDelta.innerText = `${ipcBoost >= 0 ? '+' : ''}${ipcBoost}% Eff.`;
    }

    if (elements.kpiGain) {
      elements.kpiGain.innerText = speedup > 0 ? speedup.toFixed(1) : '0.0';
    }

    // 2. Active Highlight Point on Chart SVG
    if (elements.activePoint && elements.activePointLabel) {
      const freq = payload.frequency_ghz;
      // Map Freq (1.0 to 5.0 GHz) -> SVG X (60 to 540)
      const clampedFreq = Math.min(5.0, Math.max(1.0, freq));
      const xPos = 60 + ((clampedFreq - 1.0) / 4.0) * (540 - 60);

      // Map ExecTime (16ms to 4ms) -> SVG Y (20 to 180)
      const clampedExec = Math.min(16.0, Math.max(4.0, execMs));
      const yPos = 20 + ((16.0 - clampedExec) / 12.0) * (180 - 20);

      elements.activePoint.setAttribute('cx', xPos.toFixed(1));
      elements.activePoint.setAttribute('cy', yPos.toFixed(1));

      elements.activePointLabel.setAttribute('x', Math.max(40, xPos - 35).toFixed(1));
      elements.activePointLabel.setAttribute('y', Math.max(25, yPos - 12).toFixed(1));
      elements.activePointLabel.textContent = `${execMs.toFixed(1)}ms • ${freq.toFixed(1)}G`;
    }

    // 3. Scenario 3 (Candidate) Matrix Card
    if (elements.scen3Cpi) elements.scen3Cpi.innerText = `CPI: ${data.effective_cpi.toFixed(2)}`;
    if (elements.scen3Stalls) elements.scen3Stalls.innerText = `Stalls: ${payload.stall_cycles.toFixed(0)} cyc`;
    if (elements.scen3Time) elements.scen3Time.innerText = execMs.toFixed(1);
    if (elements.scen3Gain) elements.scen3Gain.innerText = `${speedup >= 0 ? '+' : ''}${speedup.toFixed(1)}% Gain`;
  }

  function resetControls() {
    if (elements.freqSlider) { elements.freqSlider.value = 3.0; elements.freqInput.value = 3.0; }
    if (elements.cpiSlider) { elements.cpiSlider.value = 2.47; elements.cpiInput.value = 2.47; }
    if (elements.cacheSlider) { elements.cacheSlider.value = 10; elements.cacheInput.value = 10; }
    if (elements.branchSlider) { elements.branchSlider.value = 8; elements.branchInput.value = 8; }
    if (elements.stallSlider) { elements.stallSlider.value = 2; elements.stallInput.value = 2; }

    runWhatIfAnalysis();
    if (window.showToast) window.showToast('Reset What-If sliders to baseline parameters', 'info');
  }

  async function saveScenario() {
    const name = prompt('Enter a name for this architectural scenario:', 'Optimized Core v' + Math.floor(Math.random() * 90 + 10));
    if (!name) return;

    const payload = {
      scenario_name: name,
      ...getPayload()
    };

    try {
      const res = await apiFetch('/api/what-if/save-scenario', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res && res.id) {
        if (window.showToast) window.showToast(`Scenario "${name}" saved to database (ID #${res.id})`, 'success');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Failed to save scenario: ' + e.message, 'error');
    }
  }

  async function loadScenario() {
    try {
      const res = await apiFetch('/api/what-if/scenarios');
      const list = res?.scenarios || [];
      if (list.length === 0) {
        if (window.showToast) window.showToast('No saved scenarios found in database yet. Click "Save Scenario" to create one!', 'info');
        return;
      }

      showScenarioPickerModal(list);
    } catch (e) {
      if (window.showToast) window.showToast('Failed to fetch scenarios: ' + e.message, 'error');
    }
  }

  function showScenarioPickerModal(scenarios) {
    let modal = document.getElementById('scenario-picker-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'scenario-picker-modal';
      modal.className = 'fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm flex items-center justify-center p-4';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-xl max-w-md w-full border border-surface-container">
        <div class="flex items-center justify-between pb-space-sm mb-space-sm border-b border-surface-container">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[22px]">folder_open</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Load Architectural Scenario</h3>
          </div>
          <button id="close-scen-modal" class="text-on-surface-variant hover:text-on-surface">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <p class="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
          Select a previously saved simulation profile to populate parameters:
        </p>
        <div class="max-h-60 overflow-y-auto space-y-2 mb-space-md">
          ${scenarios.map(s => `
            <div class="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors flex items-center justify-between scen-item" data-id="${s.id}">
              <div>
                <div class="font-label-md text-label-md text-on-surface font-bold">${s.scenario_name}</div>
                <div class="font-code-mono text-label-xs text-on-surface-variant">
                  ${s.frequency_ghz}GHz • Base CPI: ${s.base_cpi} • Stalls: ${s.stall_cycles}cyc
                </div>
              </div>
              <span class="font-code-mono text-label-xs font-bold text-primary">${s.execution_time_ms.toFixed(1)}ms</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    modal.classList.remove('hidden');

    modal.querySelector('#close-scen-modal').onclick = () => modal.classList.add('hidden');
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    };

    modal.querySelectorAll('.scen-item').forEach(item => {
      item.onclick = () => {
        const id = parseInt(item.getAttribute('data-id'));
        const chosen = scenarios.find(s => s.id === id);
        if (chosen) {
          if (elements.freqSlider) { elements.freqSlider.value = chosen.frequency_ghz; elements.freqInput.value = chosen.frequency_ghz; }
          if (elements.cpiSlider) { elements.cpiSlider.value = chosen.base_cpi; elements.cpiInput.value = chosen.base_cpi; }
          if (elements.cacheSlider) { elements.cacheSlider.value = chosen.cache_miss_rate; elements.cacheInput.value = chosen.cache_miss_rate; }
          if (elements.branchSlider) { elements.branchSlider.value = chosen.branch_mispredict_rate; elements.branchInput.value = chosen.branch_mispredict_rate; }
          if (elements.stallSlider) { elements.stallSlider.value = chosen.stall_cycles; elements.stallInput.value = chosen.stall_cycles; }

          runWhatIfAnalysis();
          modal.classList.add('hidden');
          if (window.showToast) window.showToast(`Loaded scenario "${chosen.scenario_name}"`, 'success');
        }
      };
    });
  }

  function init() {
    syncPair(elements.freqSlider, elements.freqInput);
    syncPair(elements.cpiSlider, elements.cpiInput);
    syncPair(elements.cacheSlider, elements.cacheInput);
    syncPair(elements.branchSlider, elements.branchInput);
    syncPair(elements.stallSlider, elements.stallInput);

    if (elements.resetBtn) elements.resetBtn.addEventListener('click', resetControls);
    if (elements.resetScenarioBtn) elements.resetScenarioBtn.addEventListener('click', resetControls);
    if (elements.applyBtn) {
      elements.applyBtn.addEventListener('click', () => {
        runWhatIfAnalysis();
        if (window.showToast) window.showToast('Architectural model evaluated and applied', 'success');
      });
    }
    if (elements.recalcBtn) {
      elements.recalcBtn.addEventListener('click', () => {
        runWhatIfAnalysis();
        if (window.showToast) window.showToast('Simulated parameter sweep complete', 'info');
      });
    }

    if (elements.saveBtn) elements.saveBtn.addEventListener('click', saveScenario);
    if (elements.loadBtn) elements.loadBtn.addEventListener('click', loadScenario);

    runWhatIfAnalysis();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
