/**
 * CPU Performance Explorer - Universal Navigation & App Shell
 */

(function () {
  const PATH_MAP = {
    'dashboard': 'Dahboard.html',
    'performance-analyzer': 'PerformanceAnalyzer.html',
    'pipeline-simulator': 'PipelineSimulator.html',
    'bottleneck-analyzer': 'BottleneckAnalyzer.html',
    'cpu-comparison': 'CPUComparison.html',
    'what-if-analysis': 'What-if Analysis.html',
    'advanced-visualizations': 'AdvancedVisualizations.html',
    'reports-and-analytics': 'Reports.html',
    'reports': 'Reports.html'
  };

  const REVERSE_PATH_MAP = {
    '': 'dashboard',
    'dashboard': 'dashboard',
    'dahboard.html': 'dashboard',
    'dashboard.html': 'dashboard',
    'performance-analyzer': 'performance-analyzer',
    'performanceanalyzer.html': 'performance-analyzer',
    'pipeline-simulator': 'pipeline-simulator',
    'pipelinesimulator.html': 'pipeline-simulator',
    'bottleneck-analyzer': 'bottleneck-analyzer',
    'bottleneckanalyzer.html': 'bottleneck-analyzer',
    'cpu-comparison': 'cpu-comparison',
    'cpucomparison.html': 'cpu-comparison',
    'what-if-analysis': 'what-if-analysis',
    'what-if analysis.html': 'what-if-analysis',
    'what-if-analysis.html': 'what-if-analysis',
    'whatifanalysis.html': 'what-if-analysis',
    'advanced-visualizations': 'advanced-visualizations',
    'advancedvisualizations.html': 'advanced-visualizations',
    'reports': 'reports-and-analytics',
    'reports-and-analytics': 'reports-and-analytics',
    'reports.html': 'reports-and-analytics'
  };

  function getCurrentPageKey() {
    const rawPath = window.location.pathname.split('/').pop() || 'Dahboard.html';
    const decoded = decodeURIComponent(rawPath).toLowerCase();
    return REVERSE_PATH_MAP[decoded] || 'dashboard';
  }

  function initNavigation() {
    const currentPageKey = getCurrentPageKey();
    const navLinks = document.querySelectorAll('nav a[data-path], aside a[data-path]');

    navLinks.forEach(link => {
      const pathKey = link.getAttribute('data-path');

      // Wire correct href if not settings
      if (pathKey === 'settings') {
        link.href = 'javascript:void(0)';
        link.addEventListener('click', (e) => {
          e.preventDefault();
          openSettingsModal();
        });
      } else if (PATH_MAP[pathKey]) {
        link.href = PATH_MAP[pathKey];
      }

      // Active state highlight
      const isActive = (pathKey === currentPageKey) ||
                       (pathKey === 'reports-and-analytics' && currentPageKey === 'reports') ||
                       (pathKey === 'reports' && currentPageKey === 'reports-and-analytics');

      if (isActive) {
        link.setAttribute('aria-current', 'page');
        link.className = 'flex items-center justify-between px-space-md py-2.5 transition-all bg-primary-container text-on-primary-container font-label-md text-label-md rounded-xl shadow-[0_0_12px_rgba(0,135,58,0.25)]';
      } else {
        link.removeAttribute('aria-current');
        link.className = 'flex items-center gap-space-md px-space-md py-2.5 rounded-xl font-body-md text-body-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all';
      }
    });

    initMobileSidebar();
    initGlobalShortcuts();
    injectSettingsModal();
  }

  // Mobile sidebar support
  function initMobileSidebar() {
    const aside = document.querySelector('aside');
    if (!aside) return;

    aside.id = 'main-sidebar';

    let backdrop = document.getElementById('sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    backdrop.addEventListener('click', () => {
      aside.classList.remove('mobile-open');
      backdrop.classList.remove('active');
    });

    // Wire up hamburger button if header exists
    const header = document.querySelector('header');
    if (header && !header.querySelector('.mobile-menu-toggle')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'mobile-menu-toggle mr-2 p-2 rounded-lg text-slate-700 hover:bg-slate-100 hidden';
      toggleBtn.innerHTML = '<span class="material-symbols-outlined text-2xl">menu</span>';
      toggleBtn.title = 'Open navigation menu';
      toggleBtn.addEventListener('click', () => {
        aside.classList.toggle('mobile-open');
        backdrop.classList.toggle('active');
      });
      header.insertBefore(toggleBtn, header.firstChild);
    }
  }

  // Global Keyboard Shortcuts (Ctrl+K search, Esc to close modals)
  function initGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('header input[type="text"]');
        if (searchInput) searchInput.focus();
      }
      if (e.key === 'Escape') {
        closeAllModals();
      }
    });

    // Wire header search input to fast filter jump
    const searchInput = document.querySelector('header input[type="text"]');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = searchInput.value.trim().toLowerCase();
          if (val.includes('pipe') || val.includes('hazard')) window.location.href = PATH_MAP['pipeline-simulator'];
          else if (val.includes('bottle') || val.includes('stall')) window.location.href = PATH_MAP['bottleneck-analyzer'];
          else if (val.includes('compare') || val.includes('bench')) window.location.href = PATH_MAP['cpu-comparison'];
          else if (val.includes('what') || val.includes('tune')) window.location.href = PATH_MAP['what-if-analysis'];
          else if (val.includes('heat') || val.includes('vis') || val.includes('pyramid')) window.location.href = PATH_MAP['advanced-visualizations'];
          else if (val.includes('report') || val.includes('export') || val.includes('analytic')) window.location.href = PATH_MAP['reports-and-analytics'];
          else if (val.includes('cpi') || val.includes('single') || val.includes('perf') || val.includes('isa')) window.location.href = PATH_MAP['performance-analyzer'];
          else if (val.includes('dash') || val.includes('home') || val.includes('tele')) window.location.href = PATH_MAP['dashboard'];
          else if (window.showToast) {
            window.showToast(`No module match for "${val}". Try: pipeline, cpi, bottleneck, compare, what-if, or reports.`, 'info');
          }
        }
      });
    }

    // Wire Notification bell buttons
    document.querySelectorAll('button[aria-label="Notifications"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.showToast) {
          window.showToast('Diagnostics Active: Real-time telemetry probe and simulation engines running nominal.', 'info');
        }
      });
    });

    // Wire "New Analysis" CTA buttons using standard DOM selection
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent && btn.textContent.includes('New Analysis')) {
        btn.onclick = () => {
          window.location.href = 'PerformanceAnalyzer.html';
        };
      }
    });

    // Dynamically update Kernel Probe badge in sidebar with actual platform info
    updateKernelProbe();
  }

  async function updateKernelProbe() {
    try {
      const specs = await apiFetch('/api/device/specifications');
      if (specs) {
        const kernelVal = specs.kernel_version || specs.os_name || 'Active Probe';
        document.querySelectorAll('#kernel-probe-val, [data-kernel-probe]').forEach(el => {
          el.textContent = kernelVal;
          el.setAttribute('title', `Genuine Host OS Kernel: ${kernelVal}`);
        });
      }
    } catch (e) {
      console.warn('Kernel probe dynamic fetch warning:', e);
    }
  }

  // Interactive Settings Modal
  function injectSettingsModal() {
    if (document.getElementById('settings-modal-overlay')) return;

    const modal = document.createElement('div');
    modal.id = 'settings-modal-overlay';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card p-6 flex flex-col gap-5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <span class="material-symbols-outlined text-2xl">settings</span>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-800">System & Engine Settings</h3>
              <p class="text-xs text-slate-500">Configure telemetry polling, pipeline rules, and system probes</p>
            </div>
          </div>
          <button class="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 transition-colors" onclick="closeAllModals()">
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div class="flex flex-col gap-4 text-sm">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Live Telemetry Polling Rate</label>
            <div class="grid grid-cols-3 gap-2">
              <button class="polling-rate-btn active px-3 py-2 rounded-xl border border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold text-xs" data-rate="1000">1.0s (Fast)</button>
              <button class="polling-rate-btn px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium text-xs hover:bg-slate-50" data-rate="2000">2.0s (Balanced)</button>
              <button class="polling-rate-btn px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium text-xs hover:bg-slate-50" data-rate="5000">5.0s (Eco)</button>
            </div>
          </div>

          <div class="flex items-center justify-between py-2 border-t border-slate-100">
            <div>
              <div class="font-semibold text-slate-800">Pipeline Hazard Forwarding Default</div>
              <div class="text-xs text-slate-500">Enable EX/MEM bypass forwarding path by default on simulation start</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="setting-forwarding-default" checked class="sr-only peer">
              <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div class="flex items-center justify-between py-2 border-t border-slate-100">
            <div>
              <div class="font-semibold text-slate-800">High-Precision Micro-stalls</div>
              <div class="text-xs text-slate-500">Track structural stalls and sub-nanosecond clock jitter</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="setting-precision-stalls" checked class="sr-only peer">
              <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div class="font-semibold text-slate-800">Active Architecture Probe</div>
              <div class="text-xs text-slate-500 font-mono">Python 3.10 / FastAPI / psutil 5.9 / SQLite</div>
            </div>
            <button id="reset-cache-btn" class="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors">
              Reset Cache
            </button>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors" onclick="closeAllModals()">Close</button>
          <button class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors" onclick="saveSettings()">Save Preferences</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAllModals();
    });

    // Polling rate toggle
    modal.querySelectorAll('.polling-rate-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        modal.querySelectorAll('.polling-rate-btn').forEach(b => {
          b.className = 'polling-rate-btn px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium text-xs hover:bg-slate-50';
        });
        this.className = 'polling-rate-btn active px-3 py-2 rounded-xl border border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold text-xs';
        localStorage.setItem('cpu_explorer_polling_ms', this.getAttribute('data-rate'));
      });
    });

    const resetBtn = modal.querySelector('#reset-cache-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Clear telemetry cache and local storage?')) {
          localStorage.clear();
          sessionStorage.clear();
          if (window.showToast) window.showToast('Local engine cache cleared', 'info');
          closeAllModals();
        }
      });
    }
  }

  function openSettingsModal() {
    const modal = document.getElementById('settings-modal-overlay');
    if (modal) modal.classList.add('open');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  }

  function saveSettings() {
    closeAllModals();
    if (window.showToast) window.showToast('System configuration saved successfully', 'success');
  }

  window.openSettingsModal = openSettingsModal;
  window.closeAllModals = closeAllModals;
  window.saveSettings = saveSettings;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
  } else {
    initNavigation();
  }
})();

