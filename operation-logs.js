// ==========================================================================
// GMDC Swim Club - Operation Logs (운영기록) Management Module
// Real-time Firestore Sync & LocalStorage Cache-First Architecture
// Admin-Only Detailed View & Lock Enforcement
// ==========================================================================

import { firebaseApp } from "./firebase-config.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  onSnapshot, 
  query, 
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initAuth, isAdmin, getCurrentUser, formatUserDisplayName, canViewOperationNotes, canEditOperationNotes } from "./auth.js";
import { 
  DEFAULT_OPERATION_LOGS, 
  STORAGE_LOGS_CACHE_KEY, 
  STORAGE_LOGS_UPDATED_KEY,
  cleanTitle, 
  getCategoryBadgeClass,
  loadLocalLogsCache,
  saveLocalLogsCache 
} from "./operation-seed.js";

// Firestore (App singleton provided by firebase-config.js)
const db = getFirestore(firebaseApp);
const LOGS_COL_NAME = "gmdc_operation_logs";

// 0ms Cache-First Initial State
let logsState = loadLocalLogsCache();
let activeFilterCategory = "all";
let searchQuery = "";
let currentEditingLogId = null;

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.className = "toast show";
  setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatInline(str) {
  let escaped = escapeHtml(str);
  return escaped
    .replace(/&lt;del&gt;(.*?)&lt;\/del&gt;/gi, '<del class="md-del">$1</del>')
    .replace(/~~(.*?)~~/g, '<del class="md-del">$1</del>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
}

/**
 * Lightweight Safe Markdown Renderer
 */
export function renderMarkdown(text) {
  if (!text) return '';
  
  const lines = String(text).split('\n');
  const htmlLines = [];

  for (let rawLine of lines) {
    let trimmed = rawLine.trim();
    if (!trimmed) {
      htmlLines.push('<div class="md-spacer"></div>');
      continue;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      htmlLines.push(`<h5 class="md-h5">${formatInline(trimmed.substring(5))}</h5>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      htmlLines.push(`<h4 class="md-h4">${formatInline(trimmed.substring(4))}</h4>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      htmlLines.push(`<h3 class="md-h3">${formatInline(trimmed.substring(3))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      htmlLines.push(`<h2 class="md-h2">${formatInline(trimmed.substring(2))}</h2>`);
      continue;
    }

    // Indentation detection
    let indentLevel = 0;
    const matchIndent = rawLine.match(/^(\t+| +)/);
    if (matchIndent) {
      const whitespace = matchIndent[1];
      indentLevel = whitespace.includes('\t') ? whitespace.length : Math.floor(whitespace.length / 2);
      if (indentLevel > 2) indentLevel = 2;
    }

    // Bullet Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      const bulletSymbol = indentLevel === 0 ? '•' : (indentLevel === 1 ? '◦' : '▪');
      const indentClass = indentLevel > 0 ? ` md-indent-${indentLevel}` : '';
      htmlLines.push(`
        <div class="md-list-item${indentClass}">
          <span class="md-bullet">${bulletSymbol}</span>
          <span class="md-text">${formatInline(content)}</span>
        </div>
      `);
      continue;
    }

    // Numbered Lists
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const num = numMatch[1];
      const content = numMatch[2];
      const indentClass = indentLevel > 0 ? ` md-indent-${indentLevel}` : '';
      htmlLines.push(`
        <div class="md-ol-item${indentClass}">
          <span class="md-ol-num">${num}.</span>
          <span class="md-text">${formatInline(content)}</span>
        </div>
      `);
      continue;
    }

    // Regular paragraph
    htmlLines.push(`<div class="md-paragraph">${formatInline(rawLine)}</div>`);
  }

  return `<div class="md-rendered-content">${htmlLines.join('')}</div>`;
}

/**
 * Renders the Operation Logs List
 * - Admin: Full detailed view, collapsible accordions, edit/delete actions.
 * - Non-Admin: Summary overview with lock badge, clicking prompts admin login.
 */
function renderLogsList() {
  const container = document.getElementById('logsListContainer');
  if (!container) return;

  const canView = canViewOperationNotes();
  const canEdit = canEditOperationNotes();

  // Dynamic visibility for toolbar buttons
  const btnNewLog = document.getElementById('btnNewLog');
  if (btnNewLog) {
    btnNewLog.style.display = canEdit ? 'inline-flex' : 'none';
  }

  // Apply filters
  let filtered = [...logsState];
  if (activeFilterCategory !== 'all') {
    if (activeFilterCategory === '운영회의') {
      filtered = filtered.filter(item => item.category === '운영회의' || item.category === '대표자회의' || item.category === '임원회의');
    } else if (activeFilterCategory === '대회일정') {
      filtered = filtered.filter(item => item.category === '대회일정' || item.category === '대회공지');
    } else if (activeFilterCategory === '이벤트') {
      filtered = filtered.filter(item => item.category === '이벤트' || item.category === '정산보고' || item.category === '기타');
    } else {
      filtered = filtered.filter(item => item.category === activeFilterCategory);
    }
  }
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(item => {
      const title = (item.title || '').toLowerCase();
      const content = (item.content || '').toLowerCase();
      const date = (item.date || '').toLowerCase();
      const attendees = (item.attendees || '').toLowerCase();
      const decisions = (item.decisions || '').toLowerCase();
      const location = (item.location || '').toLowerCase();
      return title.includes(q) || content.includes(q) || date.includes(q) || attendees.includes(q) || decisions.includes(q) || location.includes(q);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="logs-empty-card">
        <div class="logs-empty-icon">📝</div>
        <div class="logs-empty-title">등록된 운영기록이 없습니다.</div>
        <div class="logs-empty-desc">
          ${canEdit ? '상단의 <strong>[+ 신규 운영기록 작성]</strong> 버튼을 눌러 새로운 회의록 또는 훈련 운영 기록을 작성해 주세요.' : '현재 등록된 기록이 없습니다.'}
        </div>
        ${canEdit ? `
          <button type="button" class="btn btn-primary" id="btnEmptyNewLog" style="font-weight:700;">
            + 신규 운영기록 작성하기
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(log => {
    const catClass = getCategoryBadgeClass(log.category);
    
    // Header action and toggle icon depending on canView permission
    const actionAttr = canView ? 'data-action="toggle-card"' : 'data-action="locked-card"';
    const toggleIconHtml = canView 
      ? `<span class="log-toggle-chevron" title="세부사항 펼치기/접기">▶</span>`
      : `<span class="log-lock-badge" title="세부사항은 운영진 로그인 후 확인 가능합니다">🔒</span>`;

    // Details block: rendered when canView is true
    const detailsHtml = canView ? `
      <div class="log-card-details">
        <div class="meeting-meta" style="margin-bottom: 14px; font-size: 12.5px;">
          <div class="meeting-meta-item"><strong>📅 일시:</strong> ${escapeHtml(log.date || '-')}${log.time ? ' ' + escapeHtml(log.time) : ''}</div>
          <div class="meeting-meta-item"><strong>📍 장소:</strong> ${escapeHtml(log.location || '-')}</div>
          <div class="meeting-meta-item"><strong>👥 대상/참석:</strong> ${escapeHtml(log.attendees || '-')}</div>
        </div>

        <div class="log-card-body">
          ${log.content ? renderMarkdown(log.content) : ''}
        </div>

        ${log.decisions ? `
          <div class="decision-box" style="margin-top: 14px;">
            <strong style="color: #166534; display: flex; align-items: center; gap: 4px; margin-bottom: 6px;">
              ✅ 의결 및 조치사항:
            </strong>
            ${renderMarkdown(log.decisions)}
          </div>
        ` : ''}
      </div>
    ` : `
      <div class="log-card-details log-card-locked-details">
        <div class="log-locked-notice">
          <span class="log-locked-icon">🔒</span>
          <span>상세 회의록 및 훈련 운영 세부사항은 운영진 로그인 후 확인하실 수 있습니다.</span>
        </div>
      </div>
    `;

    return `
      <article class="log-item-card ${canView ? 'is-admin-card' : 'is-user-locked-card'}" id="log_card_${escapeHtml(log.id)}" data-log-id="${escapeHtml(log.id)}" data-date="${escapeHtml(log.date || '')}">
        <div class="log-card-header" ${actionAttr} title="${canView ? '클릭하여 세부사항 펼치기/접기' : '세부사항은 운영진 로그인 후 확인 가능합니다'}">
          <div class="log-title-area">
            ${toggleIconHtml}
            <span class="log-date-tag">📅 ${escapeHtml(log.date || '-')}</span>
            <span class="log-category-badge ${catClass}">${escapeHtml(log.category || '기록')}</span>
            <span class="log-title-text">${escapeHtml(log.title || '제목 없음')}</span>
          </div>
          ${canEdit ? `
            <div class="log-admin-actions">
              <button type="button" class="btn-log-action edit" data-action="edit" data-id="${escapeHtml(log.id)}">✏️ 수정</button>
              <button type="button" class="btn-log-action delete" data-action="delete" data-id="${escapeHtml(log.id)}">🗑️ 삭제</button>
            </div>
          ` : (!canView ? `
            <div class="log-user-lock-tag" title="관리자 전용 세부내용">
              <span class="lock-tag-text">🔒 운영진 전용</span>
            </div>
          ` : '')}
        </div>

        ${detailsHtml}
      </article>
    `;
  }).join('');
}

/**
 * Open Modal for New or Edit Log
 */
function openLogModal(logId = null) {
  if (!canEditOperationNotes()) {
    showToast('🔒 운영기록 작성 및 수정 권한이 없습니다. (운영진 권한 필요)');
    return;
  }

  currentEditingLogId = logId;
  const modal = document.getElementById('logFormModal');
  const titleEl = document.getElementById('logModalTitle');
  const form = document.getElementById('logEditForm');

  if (!modal || !form) return;

  if (logId) {
    titleEl.textContent = '✏️ 운영기록 수정';
    const existing = logsState.find(l => l.id === logId);
    if (existing) {
      document.getElementById('logInputDate').value = existing.date || '';
      document.getElementById('logInputCategory').value = existing.category || '훈련일정';
      document.getElementById('logInputTitle').value = existing.title || '';
      document.getElementById('logInputTime').value = existing.time || '';
      document.getElementById('logInputLocation').value = existing.location || '';
      document.getElementById('logInputAttendees').value = existing.attendees || '';
      document.getElementById('logInputContent').value = existing.content || '';
      document.getElementById('logInputDecisions').value = existing.decisions || '';
    }
  } else {
    titleEl.textContent = '📝 신규 운영기록 작성';
    form.reset();
    document.getElementById('logInputDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('logInputCategory').value = '훈련일정';
    document.getElementById('logInputLocation').value = '거제 동부학생수영장';
  }

  modal.classList.add('show');
}

function closeLogModal() {
  const modal = document.getElementById('logFormModal');
  if (modal) modal.classList.remove('show');
  currentEditingLogId = null;
}

/**
 * Save Log to Firestore (Upsert with setDoc & Local Cache Instant Sync)
 */
async function saveLogToFirestore() {
  if (!isAdmin()) {
    showToast('🔒 관리자 권한이 필요합니다.');
    return;
  }

  const date = document.getElementById('logInputDate').value.trim();
  const category = document.getElementById('logInputCategory').value.trim();
  const title = document.getElementById('logInputTitle').value.trim();
  const time = document.getElementById('logInputTime').value.trim();
  const location = document.getElementById('logInputLocation').value.trim();
  const attendees = document.getElementById('logInputAttendees').value.trim();
  const content = document.getElementById('logInputContent').value.trim();
  const decisions = document.getElementById('logInputDecisions').value.trim();

  if (!title) {
    alert('제목을 입력해 주세요.');
    document.getElementById('logInputTitle').focus();
    return;
  }

  const user = getCurrentUser();
  const payload = {
    date,
    category,
    title,
    time,
    location,
    attendees,
    content,
    decisions,
    updatedAt: new Date().toISOString(),
    author: user ? formatUserDisplayName(user) : '관리자'
  };

  try {
    if (currentEditingLogId) {
      const docRef = doc(db, LOGS_COL_NAME, currentEditingLogId);
      await setDoc(docRef, payload, { merge: true });

      // Optimistic Local Update
      const idx = logsState.findIndex(l => l.id === currentEditingLogId);
      if (idx !== -1) {
        logsState[idx] = { ...logsState[idx], ...payload };
      }
      saveLocalLogsCache(logsState);
      renderLogsList();

      showToast('💾 운영기록이 성공적으로 저장되었습니다.');
    } else {
      payload.createdAt = new Date().toISOString();
      const colRef = collection(db, LOGS_COL_NAME);
      const newDoc = await addDoc(colRef, payload);

      // Optimistic Local Add
      logsState.unshift({ id: newDoc.id, ...payload });
      logsState.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      saveLocalLogsCache(logsState);
      renderLogsList();

      showToast('✨ 새로운 운영기록이 등록되었습니다.');
    }
    closeLogModal();
  } catch (err) {
    console.error('운영기록 저장 에러:', err);
    showToast('❌ 저장 실패: ' + err.message);
  }
}

/**
 * Delete Log from Firestore (Tombstone & Local Cache Instant Sync)
 */
async function deleteLogFromFirestore(logId) {
  if (!canEditOperationNotes()) {
    showToast('🔒 운영기록 삭제 권한이 없습니다. (운영진 권한 필요)');
    return;
  }

  const target = logsState.find(l => l.id === logId);
  const title = target ? `'${target.title}'` : '해당 기록';

  if (!confirm(`${title}을(를) 정말 삭제하시겠습니까?`)) {
    return;
  }

  try {
    const docRef = doc(db, LOGS_COL_NAME, logId);
    await setDoc(docRef, { isDeleted: true, deletedAt: new Date().toISOString() }, { merge: true });

    // Optimistic Local Remove
    logsState = logsState.filter(l => l.id !== logId);
    saveLocalLogsCache(logsState);
    renderLogsList();

    showToast('🗑️ 운영기록이 삭제되었습니다.');
  } catch (err) {
    console.error('운영기록 삭제 에러:', err);
    showToast('❌ 삭제 실패: ' + err.message);
  }
}

/**
 * Real-time Firestore Listener with Diff Check (No unnecessary rerenders)
 */
function initFirestoreLogsListener() {
  const colRef = collection(db, LOGS_COL_NAME);
  const q = query(colRef, orderBy("date", "desc"));

  onSnapshot(q, (snapshot) => {
    const list = [];
    const deletedIds = new Set();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.isDeleted) {
        deletedIds.add(docSnap.id);
      } else {
        list.push({ id: docSnap.id, ...data });
      }
    });

    // Merge with default seed logs if not in remote and not deleted
    const mergedList = [...list];
    DEFAULT_OPERATION_LOGS.forEach(defLog => {
      if (deletedIds.has(defLog.id)) return;
      const exists = mergedList.some(item => item.id === defLog.id);
      if (!exists) {
        mergedList.push(defLog);
      }
    });

    // Sort by date descending
    mergedList.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    // Diff Check against local cache
    const currentJson = JSON.stringify(logsState);
    const newJson = JSON.stringify(mergedList);

    if (currentJson !== newJson) {
      logsState = mergedList;
      saveLocalLogsCache(mergedList);
      renderLogsList();
    }
  }, (err) => {
    console.warn("Operation logs snapshot listener warning (using local cache):", err);
  });
}

function checkUrlQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get('date');
  if (dateParam) {
    const searchInput = document.getElementById('logSearchInput');
    if (searchInput) {
      searchInput.value = dateParam;
      searchQuery = dateParam;
      renderLogsList();
    }
    // Auto-expand matched date card if admin, or scroll to card
    setTimeout(() => {
      const card = document.querySelector(`.log-item-card[data-date="${dateParam}"]`) || document.querySelector('.log-item-card');
      if (card) {
        if (isAdmin()) {
          card.classList.add('is-expanded');
        } else {
          showToast(`📅 ${dateParam} 기록입니다. 세부사항 확인을 위해 관리자 로그인이 필요합니다.`);
        }
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  }
}

/**
 * Main Initialization
 */
export function initOperationLogs() {
  initAuth({
    showToast,
    onAuthChange: () => {
      renderLogsList();
    }
  });

  // 1. Render immediate 0ms cache
  checkUrlQueryParams();
  renderLogsList();

  // 2. Start background Firestore sync
  initFirestoreLogsListener();

  // Toolbar events
  const searchInput = document.getElementById('logSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderLogsList();
    });
  }

  const catSelect = document.getElementById('logCategorySelect');
  if (catSelect) {
    catSelect.addEventListener('change', (e) => {
      activeFilterCategory = e.target.value;
      renderLogsList();
    });
  }

  // Delegated buttons
  document.addEventListener('click', (e) => {
    // 1. Admin accordion toggle (click anywhere on header except admin action buttons)
    const toggleHeader = e.target.closest('[data-action="toggle-card"]');
    if (toggleHeader && !e.target.closest('.log-admin-actions')) {
      e.preventDefault();
      const card = toggleHeader.closest('.log-item-card');
      if (card) {
        card.classList.toggle('is-expanded');
      }
      return;
    }

    // 2. Non-admin locked card click -> Guide login
    const lockedHeader = e.target.closest('[data-action="locked-card"]');
    if (lockedHeader) {
      e.preventDefault();
      showToast('🔒 세부 회의록 및 운영 내용은 관리자로 로그인 후 확인하실 수 있습니다.');
      const loginBtn = document.getElementById('btnGoogleLogin');
      if (loginBtn) {
        loginBtn.classList.add('pulse-highlight');
        setTimeout(() => loginBtn.classList.remove('pulse-highlight'), 1200);
      }
      return;
    }

    // 3. Print All Detailed Logs as PDF (Expand all cards and window.print)
    if (e.target.closest('#btnPrintAllSchedule') || e.target.closest('#btnPrintAllPdf')) {
      e.preventDefault();
      if (!canViewOperationNotes()) {
        showToast('🔒 세부사항이 포함된 PDF 저장은 열람 권한(운영진 로그인)이 필요합니다.');
        const loginBtn = document.getElementById('btnGoogleLogin');
        if (loginBtn) {
          loginBtn.classList.add('pulse-highlight');
          setTimeout(() => loginBtn.classList.remove('pulse-highlight'), 1200);
        }
        return;
      }

      // Expand all cards so all details are fully visible in print/PDF
      const allCards = document.querySelectorAll('.log-item-card');
      allCards.forEach(card => {
        card.classList.add('is-expanded');
      });

      // Trigger print dialog
      setTimeout(() => {
        window.print();
      }, 120);
      return;
    }

    if (e.target.closest('#btnNewLog') || e.target.closest('#btnEmptyNewLog')) {
      e.preventDefault();
      openLogModal();
      return;
    }

    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) {
      e.preventDefault();
      const id = editBtn.dataset.id;
      openLogModal(id);
      return;
    }

    const delBtn = e.target.closest('[data-action="delete"]');
    if (delBtn) {
      e.preventDefault();
      const id = delBtn.dataset.id;
      deleteLogFromFirestore(id);
      return;
    }

    if (e.target.closest('#btnLogModalClose') || e.target.closest('#btnLogModalCancel')) {
      e.preventDefault();
      closeLogModal();
      return;
    }

    if (e.target.closest('#btnLogModalSave')) {
      e.preventDefault();
      saveLogToFirestore();
      return;
    }

    const modal = document.getElementById('logFormModal');
    if (e.target === modal) {
      closeLogModal();
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOperationLogs);
  } else {
    initOperationLogs();
  }
}
