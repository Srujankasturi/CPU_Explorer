/**
 * CPU Performance Explorer - Reports & Analytics Controller
 * Handles report generation, database persistence, filtering, preview,
 * JSON, CSV, and PDF print exports.
 */

(function () {
  let reportsList = [];
  let currentFilter = 'All';

  async function loadReports() {
    try {
      const data = await apiFetch('/api/reports');
      if (Array.isArray(data)) {
        reportsList = data;
        renderReportsTable();
        updateReportStats();
      }
    } catch (e) {
      console.warn('Reports load note:', e.message);
    }
  }

  function updateReportStats() {
    const totalCountEl = document.getElementById('stat-total-reports');
    if (totalCountEl) totalCountEl.innerText = reportsList.length;

    const highRiskEl = document.getElementById('stat-high-risk');
    if (highRiskEl) {
      const highCount = reportsList.filter(r => r.report_type.includes('Bottleneck')).length;
      highRiskEl.innerText = highCount;
    }

    const latestEl = document.getElementById('stat-latest-report');
    if (latestEl && reportsList.length > 0) {
      latestEl.innerText = reportsList[0].title;
    }
  }

  function renderReportsTable() {
    const tbody = document.getElementById('reports-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    const filtered = currentFilter === 'All' 
      ? reportsList 
      : reportsList.filter(r => r.report_type.toLowerCase().includes(currentFilter.toLowerCase()));

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-on-surface-variant font-body-sm">
            No reports found for this filter. Click "Generate New Report" to create one from live or benchmark runs.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(r => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-surface-container-low/50 transition-colors border-b border-surface-container';

      const typeBadge = r.report_type.includes('Bottleneck')
        ? 'bg-error-container text-on-error-container'
        : r.report_type.includes('Pipeline')
        ? 'bg-secondary-fixed text-on-secondary-fixed'
        : 'bg-primary-fixed text-on-primary-fixed-variant';

      const createdDate = new Date(r.created_at).toLocaleString();
      const summaryText = r.metrics_summary || r.summary || 'Standard diagnostic snapshot';

      row.innerHTML = `
        <td class="py-3 px-3">
          <div class="font-body-md text-body-md font-semibold text-on-surface">${escapeHtml(r.title)}</div>
          <div class="font-code-mono text-label-xs text-on-surface-variant">ID #${r.id}</div>
        </td>
        <td class="py-3 px-3">
          <span class="px-2.5 py-1 rounded-full font-label-xs text-label-xs font-bold ${typeBadge}">
            ${escapeHtml(r.report_type)}
          </span>
        </td>
        <td class="py-3 px-3 font-code-mono text-label-xs text-on-surface-variant">
          ${createdDate}
        </td>
        <td class="py-3 px-3 font-body-sm text-body-sm text-on-surface-variant max-w-xs truncate" title="${escapeHtml(summaryText)}">
          ${escapeHtml(summaryText)}
        </td>
        <td class="py-3 px-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button class="p-1.5 rounded-lg text-primary hover:bg-primary-fixed/40 transition-colors" title="View Report" onclick="viewReportDetails(${r.id})">
              <span class="material-symbols-outlined text-[18px]">visibility</span>
            </button>
            <button class="p-1.5 rounded-lg text-secondary hover:bg-secondary-fixed/40 transition-colors" title="Export JSON" onclick="exportReportJson(${r.id})">
              <span class="material-symbols-outlined text-[18px]">data_object</span>
            </button>
            <button class="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors" title="Export CSV" onclick="exportReportCsv(${r.id})">
              <span class="material-symbols-outlined text-[18px]">table_view</span>
            </button>
            <button class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors" title="Delete Report" onclick="deleteReport(${r.id})">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  async function generateReportSubmit(e) {
    if (e) e.preventDefault();

    const titleInput = document.getElementById('modal-report-title');
    const typeSelect = document.getElementById('modal-report-type');
    const notesInput = document.getElementById('modal-report-notes');

    const title = titleInput?.value.trim() || `CPU Audit Run - ${new Date().toLocaleTimeString()}`;
    const reportType = typeSelect?.value || 'Performance Analysis';
    const notes = notesInput?.value.trim() || 'Automated hardware diagnostics run';

    try {
      const payload = {
        title: title,
        report_type: reportType,
        summary: notes,
        data: {
          timestamp: new Date().toISOString(),
          notes: notes
        }
      };

      const res = await apiFetch('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res) {
        closeGenerateModal();
        if (window.showToast) window.showToast(`Report generated and saved: "${title}"`, 'success');
        await loadReports();
      }
    } catch (err) {
      if (window.showToast) window.showToast('Generation failed: ' + err.message, 'error');
    }
  }

  async function viewReportDetails(id) {
    try {
      const report = await apiFetch(`/api/reports/${id}`);
      if (!report) return;

      const previewModal = document.getElementById('preview-modal-overlay');
      const contentEl = document.getElementById('preview-modal-content');

      const contentPayload = report.full_content || report.data || {};
      const summaryText = report.metrics_summary || report.summary || 'Audit passed nominal limits.';

      if (previewModal && contentEl) {
        contentEl.innerHTML = `
          <div class="flex flex-col gap-4">
            <div class="border-b border-surface-container pb-3">
              <div class="font-label-xs text-label-xs uppercase font-bold text-primary tracking-wider">${escapeHtml(report.report_type)}</div>
              <h2 class="font-headline-md text-headline-md font-bold text-on-surface mt-1">${escapeHtml(report.title)}</h2>
              <div class="font-code-mono text-label-xs text-on-surface-variant mt-1">Generated: ${new Date(report.created_at).toLocaleString()} · ID #${report.id}</div>
            </div>
            
            <div class="p-3 bg-surface-container-low rounded-xl">
              <div class="font-label-xs text-label-xs font-bold text-on-surface-variant uppercase mb-1">Executive Summary</div>
              <p class="font-body-md text-body-md text-on-surface font-semibold">${escapeHtml(summaryText)}</p>
            </div>

            <div>
              <div class="font-label-xs text-label-xs font-bold text-on-surface-variant uppercase mb-2">Diagnostic Data Payload</div>
              <pre class="bg-surface-container-high/60 p-3 rounded-xl font-code-mono text-label-xs overflow-x-auto text-on-surface max-h-56">${JSON.stringify(contentPayload, null, 2)}</pre>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-surface-container">
              <button class="px-3.5 py-1.5 rounded-xl border border-surface-container font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container transition-colors" onclick="window.print()">
                <span class="material-symbols-outlined text-[16px] align-middle mr-1">print</span>Print / PDF
              </button>
              <button class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors shadow-xs" onclick="exportReportJson(${report.id})">
                Export JSON
              </button>
            </div>
          </div>
        `;
        previewModal.classList.add('open');
      }
    } catch (err) {
      if (window.showToast) window.showToast('Could not load report details: ' + err.message, 'error');
    }
  }

  async function deleteReport(id) {
    if (!confirm(`Are you sure you want to delete report #${id}?`)) return;

    try {
      await apiFetch(`/api/reports/${id}`, { method: 'DELETE' });
      if (window.showToast) window.showToast(`Report #${id} deleted`, 'info');
      await loadReports();
    } catch (e) {
      if (window.showToast) window.showToast('Delete error: ' + e.message, 'error');
    }
  }

  function exportReportJson(id) {
    window.open(`${API_BASE}/api/reports/${id}/export/json`, '_blank');
  }

  function exportReportCsv(id) {
    window.open(`${API_BASE}/api/reports/${id}/export/csv`, '_blank');
  }

  function openGenerateModal() {
    const modal = document.getElementById('generate-modal-overlay');
    if (modal) modal.classList.add('open');
  }

  function closeGenerateModal() {
    const modal = document.getElementById('generate-modal-overlay');
    if (modal) modal.classList.remove('open');
  }

  function closePreviewModal() {
    const modal = document.getElementById('preview-modal-overlay');
    if (modal) modal.classList.remove('open');
  }

  function setupFilterPills() {
    const pills = document.querySelectorAll('.report-filter-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', function () {
        pills.forEach(p => {
          p.className = 'report-filter-pill px-3 py-1.5 rounded-xl font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all cursor-pointer';
        });
        this.className = 'report-filter-pill px-3 py-1.5 rounded-xl font-label-sm text-label-sm bg-primary-container text-on-primary-container font-semibold shadow-sm transition-all cursor-pointer';
        currentFilter = this.getAttribute('data-filter') || 'All';
        renderReportsTable();
      });
    });
  }

  function setupSearch() {
    const searchInput = document.getElementById('report-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      const rows = document.querySelectorAll('#reports-table-body tr');
      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }

  window.viewReportDetails = viewReportDetails;
  window.deleteReport = deleteReport;
  window.exportReportJson = exportReportJson;
  window.exportReportCsv = exportReportCsv;
  window.openGenerateModal = openGenerateModal;
  window.closeGenerateModal = closeGenerateModal;
  window.closePreviewModal = closePreviewModal;

  function init() {
    setupFilterPills();
    setupSearch();

    const generateBtn = document.getElementById('btn-open-generate-modal');
    if (generateBtn) generateBtn.addEventListener('click', openGenerateModal);

    const form = document.getElementById('generate-report-form');
    if (form) form.addEventListener('submit', generateReportSubmit);

    loadReports();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
