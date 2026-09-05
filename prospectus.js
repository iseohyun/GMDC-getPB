// ==========================================================================
// GMDC Swim Club - Shared Competition Prospectus Module (모집요강 모듈)
// ==========================================================================

import { PROSPECTUS_HTML } from './prospectus-content.js';

export function ensureRulesModal() {
  let modal = document.getElementById('rulesModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rulesModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'rulesModalTitle');

    modal.innerHTML = `
      <div class="modal-card rules-modal-card">
        <div class="modal-header">
          <div class="modal-badge" style="background:#e0f2fe; color:#0284c7; font-weight:800;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            2026년 제19회 거제시장배 전국 마스터즈 수영대회 요강
          </div>
          <button id="btnRulesModalCloseX" class="modal-close-btn" title="닫기" aria-label="닫기">&times;</button>
        </div>
        <div class="modal-body rules-modal-body" id="rulesModalBody">
          ${PROSPECTUS_HTML}
        </div>
        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <a href="prospectus.html" target="_blank" class="btn btn-secondary" style="font-size: 12px; display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px;">
              <span>🖨️ 새 창에서 인쇄하기</span>
            </a>
            <span style="font-size: 12px; color: var(--text-muted);">주관: 거제시수영연맹</span>
          </div>
          <button id="btnRulesModalConfirm" class="btn btn-primary">확인</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    // If modal already in HTML, ensure content is updated from shared source
    const bodyEl = document.getElementById('rulesModalBody');
    if (bodyEl) {
      bodyEl.innerHTML = PROSPECTUS_HTML;
    }
  }
  return modal;
}

export function openRulesModal() {
  const modal = ensureRulesModal();
  if (modal) modal.classList.add('show');
}

export function closeRulesModal() {
  const modal = document.getElementById('rulesModal');
  if (modal) modal.classList.remove('show');
}

export function initRulesModal() {
  ensureRulesModal();

  // Open button handlers
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btnOpenRulesModal') || e.target.closest('.btn-rules-header');
    if (btn) {
      e.preventDefault();
      openRulesModal();
    }
  });

  // Close handlers
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btnRulesModalCloseX') || e.target.closest('#btnRulesModalConfirm')) {
      closeRulesModal();
    } else if (e.target.id === 'rulesModal') {
      closeRulesModal();
    }
  });

  // Escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeRulesModal();
    }
  });
}

// Auto-init on load if browser environment
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRulesModal);
  } else {
    initRulesModal();
  }
}
