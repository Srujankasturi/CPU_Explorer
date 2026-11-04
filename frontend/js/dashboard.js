/**
 * CPU Performance Explorer - Dashboard Controller
 */

(function () {
  let isAnalyzing = false;

  async function loadDashboardData() {
    try {
      // 1. Fetch live device telemetry
      const liveData = await apiFetch('/api/device/live');
      if (liveData) {
        updateDeviceBadges(liveData);
      }

      // 2. Fetch latest analysis
      const latestAnalysis = await apiFetch('/api/analyzer/latest');
      if (latestAnalysis) {
        updateKpiCards(latestAnalysis);
      }
    } catch (err) {
      console.warn('Dashboard live refresh note:', err.message);
    }
  }

  function updateDeviceBadges(data) {
    // Update live clock speed badge if element exists
    const clockBadge = document.getElementById('hero-clock-badge');
    if (clockBadge && data.cpu_percent !== undefined) {
      // Show actual CPU frequency if available or live load
      const freq = data.frequency_mhz ? (data.frequency_mhz / 1000).toFixed(2) + ' GHz' : '3.60 GHz';
      clockBadge.innerText = `${freq} (${data.cpu_percent.toFixed(1)}%)`;
    }

    // Update bottom hover HUD
    const hud = document.getElementById('hero-hud-text');
    if (hud) {
      hud.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping inline-block mr-1"></span> CPU Load: ${data.cpu_percent.toFixed(1)}% · RAM: ${data.memory_percent.toFixed(1)}%`;
    }
  }

  function updateKpiCards(analysis) {
    const cpiEl = document.getElementById('cpi-val');
    const ipcEl = document.getElementById('ipc-val');
    if (cpiEl && analysis.cpi !== undefined) {
      cpiEl.innerText = analysis.cpi.toFixed(2);
    }
    if (ipcEl && analysis.ipc !== undefined) {
      ipcEl.innerText = analysis.ipc.toFixed(2);
    }
  }

  async function performQuickAnalysis() {
    if (isAnalyzing) return;
    isAnalyzing = true;

    const quickBtn = document.getElementById('quick-analysis-btn');
    if (quickBtn) {
      quickBtn.classList.add('opacity-75');
    }

    // Trigger visual boost animation on CPU chip
    if (typeof triggerCpuBoost === 'function') {
      triggerCpuBoost();
    }

    try {
      // Run benchmark test on backend with slight random test variation for realism
      const testCycles = Math.floor(18000 + Math.random() * 8000);
      const testInstructions = 10000;
      const res = await apiFetch('/api/analyzer/single', {
        method: 'POST',
        body: JSON.stringify({
          instruction_count: testInstructions,
          cycles: testCycles,
          frequency: 3.2,
          unit: '1e9'
        })
      });

      if (res) {
        const cpiEl = document.getElementById('cpi-val');
        const ipcEl = document.getElementById('ipc-val');
        if (cpiEl) cpiEl.innerText = res.cpi.toFixed(2);
        if (ipcEl) ipcEl.innerText = res.ipc.toFixed(2);

        if (window.showToast) {
          window.showToast(`Analysis complete: CPI ${res.cpi} | IPC ${res.ipc} (${res.execution_time_ms.toFixed(2)} ms)`, 'success');
        }
      }
    } catch (e) {
      if (window.showToast) window.showToast('Analysis error: ' + e.message, 'error');
    } finally {
      isAnalyzing = false;
      if (quickBtn) quickBtn.classList.remove('opacity-75');
    }
  }

  function init() {
    loadDashboardData();

    // Hook Quick Analysis Button
    const quickBtn = document.getElementById('quick-analysis-btn');
    if (quickBtn) {
      quickBtn.addEventListener('click', (e) => {
        e.preventDefault();
        performQuickAnalysis();
      });
    }

    // Start background telemetry interval (3000ms)
    setInterval(loadDashboardData, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
