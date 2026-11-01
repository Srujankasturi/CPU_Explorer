/**
 * CPU Performance Explorer - Common Utilities & API Wrapper
 */

const API_BASE = window.location.origin.includes('http') ? '' : 'http://127.0.0.1:8000';

/**
 * Universal fetch helper with error handling and toasts
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      let errorMsg = `Server error: ${response.status} ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch (e) {}
      throw new Error(errorMsg);
    }

    // Check if response is JSON or blob
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType.includes('text/csv')) {
      return await response.text();
    } else {
      return await response.blob();
    }
  } catch (err) {
    console.error(`API Call failed [${endpoint}]:`, err);
    throw err;
  }
}

/**
 * Modern Toast Notifications
 */
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'check_circle';
  if (type === 'error') iconName = 'error';
  else if (type === 'warning') iconName = 'warning';
  else if (type === 'info') iconName = 'info';

  toast.innerHTML = `
    <span class="material-symbols-rounded text-xl ${
      type === 'error' ? 'text-red-600' :
      type === 'warning' ? 'text-amber-600' :
      type === 'info' ? 'text-blue-600' : 'text-emerald-600'
    }">${iconName}</span>
    <div class="flex-1 text-sm font-medium text-slate-800">${escapeHtml(message)}</div>
    <button class="text-slate-400 hover:text-slate-600 transition-colors" onclick="this.parentElement.remove()">
      <span class="material-symbols-rounded text-sm">close</span>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

/**
 * Helpers
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return Number(num).toLocaleString('en-US');
}

window.apiFetch = apiFetch;
window.showToast = showToast;
window.formatBytes = formatBytes;
window.formatNumber = formatNumber;
