/**
 * CPU Performance Explorer - Bottleneck Analyzer Controller
 * Implements Intel Top-Down Microarchitecture Analysis (TMA) and
 * structural stall categorization with actionable optimization recommendations.
 */

(function () {
  let currentProfile = 'latest';

  async function loadBottlenecks(profileKey = 'latest') {
    currentProfile = profileKey;
    try {
      let res;
      if (profileKey === 'latest') {
        res = await apiFetch('/api/bottleneck/from-latest');
      } else if (profileKey === 'matrix_avx512') {
        res = await apiFetch('/api/bottleneck/analyze', {
          method: 'POST',
          body: JSON.stringify({ cpi: 1.85, llc_miss_rate: 14.2, branch_mispredict_rate: 3.5, pipeline_stall_pct: 28.0, dram_latency_ns: 65.0 })
        });
      } else if (profileKey === 'baseline_scalar') {
        res = await apiFetch('/api/bottleneck/analyze', {
          method: 'POST',
          body: JSON.stringify({ cpi: 3.40, llc_miss_rate: 38.5, branch_mispredict_rate: 6.0, pipeline_stall_pct: 16.0, dram_latency_ns: 78.0 })
        });
      } else if (profileKey === 'raytrace_bvh') {
        res = await apiFetch('/api/bottleneck/analyze', {
          method: 'POST',
          body: JSON.stringify({ cpi: 2.95, llc_miss_rate: 22.0, branch_mispredict_rate: 18.5, pipeline_stall_pct: 22.0, dram_latency_ns: 72.0 })
        });
      } else {
        res = await apiFetch('/api/bottleneck/analyze', {
          method: 'POST',
          body: JSON.stringify({ cpi: 2.47, llc_miss_rate: 28.4, branch_mispredict_rate: 8.0, pipeline_stall_pct: 18.0, dram_latency_ns: 68.0 })
        });
      }

      if (res) {
        renderScoreGauge(res.bottleneck_score, res.severity, res.risk_level);
        renderBottlenecksList(res.items);
        renderDistributionBars(res.distribution);
      }
    } catch (e) {
      console.warn('Bottleneck analysis error:', e.message);
    }
  }

  function renderScoreGauge(score, severity, risk) {
    const scoreVal = Math.round(score || 67);
    const scoreEl = document.querySelector('.lg\\:col-span-5 .font-metric-display');
    const riskBadge = document.querySelector('.lg\\:col-span-5 .font-headline-md');
    const arcPath = document.querySelectorAll('.lg\\:col-span-5 svg path')[1];
    const topBadge = document.querySelector('.lg\\:col-span-5 .px-2\\.5.py-0\\.5.rounded-full');

    if (scoreEl) scoreEl.innerText = `${scoreVal}%`;
    if (riskBadge) {
      riskBadge.innerText = severity || (scoreVal > 60 ? 'High' : scoreVal > 30 ? 'Medium' : 'Nominal');
      riskBadge.className = scoreVal >= 60 ? 'font-headline-md text-headline-md text-error font-bold mt-1' :
                            scoreVal >= 30 ? 'font-headline-md text-headline-md text-amber-600 font-bold mt-1' :
                            'font-headline-md text-headline-md text-primary font-bold mt-1';
    }

    if (topBadge) {
      topBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${scoreVal >= 60 ? 'bg-error' : scoreVal >= 30 ? 'bg-amber-500' : 'bg-primary'}"></span> ${risk || severity || 'High Risk'}`;
      topBadge.className = scoreVal >= 60 ? 'px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-xs text-label-xs font-semibold flex items-center gap-1' :
                           scoreVal >= 30 ? 'px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-label-xs text-label-xs font-semibold flex items-center gap-1' :
                           'px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-xs text-label-xs font-semibold flex items-center gap-1';
    }

    if (arcPath) {
      const ARC_LENGTH = 251.2;
      const offset = ARC_LENGTH - (scoreVal / 100) * ARC_LENGTH;
      arcPath.style.strokeDashoffset = offset;
      arcPath.setAttribute('class', scoreVal >= 60 ? 'text-error' : scoreVal >= 30 ? 'text-amber-500' : 'text-primary');
    }
  }

  function renderBottlenecksList(items) {
    const container = document.querySelector('.lg\\:col-span-7 .flex.flex-col.gap-space-sm');
    if (!container || !Array.isArray(items)) return;

    container.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors';

      const isCritical = item.severity === 'Critical';
      const isHigh = item.severity === 'High';
      const isMed = item.severity === 'Medium';

      const icon = item.name.includes('Memory') ? 'dns' :
                   item.name.includes('Pipeline') ? 'account_tree' :
                   item.name.includes('Branch') ? 'alt_route' : 'layers';

      const iconBg = (isHigh || isCritical) ? 'bg-error-container text-on-error-container' :
                     isMed ? 'bg-secondary-fixed text-on-secondary-fixed' :
                     'bg-primary-fixed text-on-primary-fixed-variant';

      const badgeBg = (isHigh || isCritical) ? 'bg-error-container text-on-error-container font-bold' :
                      isMed ? 'bg-secondary-fixed text-on-secondary-fixed font-bold' :
                      'bg-primary-fixed text-on-primary-fixed-variant font-bold';

      const penaltyCycles = item.penalty_cycles ?? item.impact_cycles ?? 0;

      div.innerHTML = `
        <div class="flex items-center gap-space-md">
          <div class="w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-[20px]">${icon}</span>
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <span class="font-label-md text-label-md text-on-surface font-semibold">${escapeHtml(item.name)}</span>
              <span class="font-code-mono text-label-xs text-on-surface-variant">${escapeHtml(item.subsystem)}</span>
            </div>
            <span class="font-body-sm text-body-sm text-on-surface-variant">${escapeHtml(item.description)}</span>
          </div>
        </div>
        <div class="flex items-center gap-space-md">
          <span class="font-code-mono text-label-md font-bold ${(isHigh || isCritical) ? 'text-error' : 'text-on-surface'}">+${penaltyCycles.toLocaleString()} cycles</span>
          <span class="px-3 py-1 rounded-full ${badgeBg} font-label-xs text-label-xs uppercase tracking-wider">${item.severity}</span>
        </div>
      `;
      container.appendChild(div);
    });
  }

  function renderDistributionBars(dist) {
    if (!dist) return;

    // Select the Performance Impact bars panel (second column in second row)
    const impactPanel = document.querySelectorAll('.grid.grid-cols-1.lg\\:grid-cols-12.gap-space-lg')[1]?.children[1];
    if (!impactPanel) return;

    const bars = impactPanel.querySelectorAll('.flex.flex-col.gap-1\\.5');
    if (bars.length >= 4) {
      // Memory
      const memVal = dist.Memory ?? 28.0;
      bars[0].querySelector('.font-code-mono').innerText = `${memVal}%`;
      bars[0].querySelector('.h-full').style.width = `${Math.min(100, memVal)}%`;

      // Pipeline
      const pipeVal = dist.Pipeline ?? 18.0;
      bars[1].querySelector('.font-code-mono').innerText = `${pipeVal}%`;
      bars[1].querySelector('.h-full').style.width = `${Math.min(100, pipeVal)}%`;

      // Branch
      const branchVal = dist.Branch ?? 12.0;
      bars[2].querySelector('.font-code-mono').innerText = `${branchVal}%`;
      bars[2].querySelector('.h-full').style.width = `${Math.min(100, branchVal)}%`;

      // Structural
      const structVal = dist.Structural ?? 9.0;
      bars[3].querySelector('.font-code-mono').innerText = `${structVal}%`;
      bars[3].querySelector('.h-full').style.width = `${Math.min(100, structVal)}%`;
    }
  }

  function setupControls() {
    const profileSelect = document.querySelector('header select, .flex.items-center select');
    if (profileSelect) {
      profileSelect.innerHTML = `
        <option value="latest">Latest Benchmark / Live Profile</option>
        <option value="matrix_avx512">Run #1042 • MatrixMult_AVX512 (Core-Bound)</option>
        <option value="baseline_scalar">Run #1041 • Baseline_Scalar (Memory-Heavy)</option>
        <option value="raytrace_bvh">Run #1040 • RayTrace_BVH (Branch-Heavy)</option>
      `;
      profileSelect.addEventListener('change', () => {
        loadBottlenecks(profileSelect.value);
        if (window.showToast) window.showToast(`Switched bottleneck profile to: ${profileSelect.options[profileSelect.selectedIndex].text}`, 'info');
      });
    }

    const rerunBtn = document.getElementById('rerun-btn');
    if (rerunBtn) {
      rerunBtn.addEventListener('click', async () => {
        const icon = rerunBtn.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.add('animate-spin');
        await loadBottlenecks(profileSelect ? profileSelect.value : currentProfile);
        setTimeout(() => {
          if (icon) icon.classList.remove('animate-spin');
        }, 500);
        if (window.showToast) window.showToast('Microarchitectural bottleneck audit refreshed', 'success');
      });
    }

    // Export Diagnostic Report button
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
      if (btn.textContent.includes('Export Diagnostic Report')) {
        btn.addEventListener('click', async () => {
          try {
            const reportPayload = {
              title: `Bottleneck Diagnostic Audit - ${new Date().toLocaleTimeString()}`,
              report_type: 'Bottleneck Audit',
              summary: 'Comprehensive microarchitectural stall audit and optimization analysis',
              data: {
                timestamp: new Date().toISOString(),
                profile: profileSelect ? profileSelect.value : currentProfile
              }
            };
            const rep = await apiFetch('/api/reports/generate', {
              method: 'POST',
              body: JSON.stringify(reportPayload)
            });
            if (rep && rep.id) {
              if (window.showToast) window.showToast(`Diagnostic Report #${rep.id} exported successfully!`, 'success');
            }
          } catch (e) {
            if (window.showToast) window.showToast('Failed to export report: ' + e.message, 'error');
          }
        });
      }
    });
  }

  function init() {
    setupControls();
    loadBottlenecks('latest');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
