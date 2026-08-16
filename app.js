/**
 * GMDC 수영 기록 및 대회 출전 관리 시스템
 * Firebase Cloud Firestore 실시간 연동, 계영 최적 조합 연산, 출전 종목 현황 매트릭스
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, getDoc, getDocs, collection, addDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBA0ykFrEfU9YS33Zp_HNf3OnBX39WCEkA",
  authDomain: "gmdc-swim-records.firebaseapp.com",
  projectId: "gmdc-swim-records",
  storageBucket: "gmdc-swim-records.firebasestorage.app",
  messagingSenderId: "4329922661",
  appId: "1:4329922661:web:e0799bb08d37fd1e12668c",
  measurementId: "G-5H98EB7ZSP"
};

// Initialize Firebase App & Firestore
let db = null;
let DOC_REF = null;
const HISTORY_COL_NAME = "gmdc_swim_history";

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  DOC_REF = doc(db, "gmdc_swim_club", "records_2026_01_01");
} catch (err) {
  console.error("Firebase 초기화 에러:", err);
}

const APP_VERSION = 'v2026.08.16.7';
let isScenarioMode = false;
let isInitialSyncCompleted = false;
let serverRecordsCache = null;

const STORAGE_KEY = 'gmdc_swim_records_v1';
const STICKY_STORAGE_KEY = 'gmdc_sticky_pinned';
const MODAL_STORAGE_KEY = 'gmdc_hide_notice_modal_date';
const EVENTS_MODE_KEY = 'gmdc_events_view_mode';
const RECORDS_MODE_KEY = 'gmdc_records_view_mode';

// Deadline Configuration: 8월 17일(화) 18:00:00 KST
const DEADLINE_ISO = '2026-08-17T18:00:00+09:00';
const DEADLINE = new Date(DEADLINE_ISO);

function isDeadlineExpired() {
  return new Date() >= DEADLINE;
}

// 6 Available Competition Events (출전 가능 종목)
const EVENT_OPTIONS = [
  '핀자유형 50',
  '핀접영 50',
  '자유형 50',
  '배영 50',
  '평영 50',
  '접영 50'
];

const GROUPS = ['1그룹', '2그룹', '3그룹', '4그룹', '5그룹', '6그룹'];

// Initial 37 Swimmer Records (출전 그룹, 생년월일 식별코드, 출전 종목 1/2, PB 기록)
const DEFAULT_RECORDS = [
  { id: 1, age: '15', group: '1그룹', gender: '남', name: '박슬우', birthId: '20100223-3', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 2, age: '15', group: '1그룹', gender: '남', name: '이지훈', birthId: '20100908-3', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 3, age: '16', group: '1그룹', gender: '남', name: '이채율', birthId: '20090814-3', event1: '핀자유형 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 4, age: '17', group: '1그룹', gender: '남', name: '조성찬', birthId: '20080718-3', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 5, age: '17', group: '1그룹', gender: '여', name: '이지호', birthId: '20080506-4', event1: '핀자유형 50', event2: '자유형 50', finFly: '', finFree: '31.07', free: '36.78', back: '', breast: '', fly: '' },
  { id: 6, age: '24', group: '2그룹', gender: '여', name: '추성비', birthId: '20010521-4', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 7, age: '24', group: '2그룹', gender: '여', name: '이영경', birthId: '20011204-4', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 8, age: '33', group: '3그룹', gender: '남', name: '안재홍', birthId: '19920211-1', event1: '자유형 50', event2: '', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 9, age: '38', group: '3그룹', gender: '여', name: '노언영', birthId: '19870712-2', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 10, age: '37', group: '3그룹', gender: '여', name: '최이슬', birthId: '19881213-2', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 11, age: '43', group: '4그룹', gender: '남', name: '고석보', birthId: '19821227-1', event1: '핀접영 50', event2: '자유형 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 12, age: '44', group: '4그룹', gender: '남', name: '김기용', birthId: '19810929-1', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '', free: '35.69', back: '', breast: '41.65', fly: '' },
  { id: 13, age: '42', group: '4그룹', gender: '남', name: '김준영', birthId: '19830201-1', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 14, age: '44', group: '4그룹', gender: '남', name: '손철수', birthId: '19810217-1', event1: '핀자유형 50', event2: '자유형 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 15, age: '44', group: '4그룹', gender: '남', name: '안상준', birthId: '19811115-1', event1: '자유형 50', event2: '', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 16, age: '41', group: '4그룹', gender: '남', name: '양승진', birthId: '19840221-1', event1: '자유형 50', event2: '', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 17, age: '44', group: '4그룹', gender: '남', name: '이도형', birthId: '19810823-1', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 18, age: '42', group: '4그룹', gender: '남', name: '정서현', birthId: '19830903-1', event1: '평영 50', event2: '배영 50', finFly: '', finFree: '27.92', free: '33.59', back: '', breast: '', fly: '' },
  { id: 19, age: '47', group: '4그룹', gender: '여', name: '김상희', birthId: '19780602-2', event1: '핀자유형 50', event2: '', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 20, age: '43', group: '4그룹', gender: '여', name: '박다유', birthId: '19820825-2', event1: '자유형 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 21, age: '48', group: '4그룹', gender: '여', name: '손혜정', birthId: '19770415-2', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 22, age: '40', group: '4그룹', gender: '여', name: '심민경', birthId: '19850520-2', event1: '자유형 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 23, age: '42', group: '4그룹', gender: '여', name: '여수연', birthId: '19830209-2', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 24, age: '44', group: '4그룹', gender: '여', name: '이미영', birthId: '19811014-2', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '30.42', free: '', back: '', breast: '', fly: '57.17' },
  { id: 25, age: '41', group: '4그룹', gender: '여', name: '이은희', birthId: '19840528-2', event1: '배영 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 26, age: '50', group: '5그룹', gender: '남', name: '박재홍', birthId: '19750715-1', event1: '핀자유형 50', event2: '핀접영 50', finFly: '30.29', finFree: '28.08', free: '', back: '', breast: '', fly: '' },
  { id: 27, age: '57', group: '5그룹', gender: '남', name: '박진홍', birthId: '19681220-1', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 28, age: '50', group: '5그룹', gender: '남', name: '서충근', birthId: '19750724-1', event1: '핀자유형 50', event2: '', finFly: '', finFree: '27.43', free: '', back: '', breast: '', fly: '99.99' },
  { id: 29, age: '50', group: '5그룹', gender: '남', name: '성지경', birthId: '19750223-1', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 30, age: '51', group: '5그룹', gender: '남', name: '이경열', birthId: '19740501-1', event1: '핀자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '43.51', fly: '' },
  { id: 31, age: '53', group: '5그룹', gender: '여', name: '김애란', birthId: '19720727-2', event1: '자유형 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 32, age: '58', group: '5그룹', gender: '여', name: '박선화', birthId: '19671212-2', event1: '핀자유형 50', event2: '평영 50', finFly: '', finFree: '33.64', free: '46.66', back: '', breast: '', fly: '' },
  { id: 33, age: '56', group: '5그룹', gender: '여', name: '전경미', birthId: '19690201-2', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '32.42', free: '', back: '55.88', breast: '', fly: '' },
  { id: 34, age: '62', group: '6그룹', gender: '남', name: '박봉권', birthId: '19630807-1', event1: '평영 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 35, age: '63', group: '6그룹', gender: '남', name: '성환용', birthId: '19620713-1', event1: '핀자유형 50', event2: '', finFly: '', finFree: '99.99', free: '', back: '', breast: '', fly: '' },
  { id: 36, age: '59', group: '6그룹', gender: '여', name: '송원자', birthId: '19660325-2', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 37, age: '62', group: '6그룹', gender: '여', name: '최지희', birthId: '19630705-2', event1: '자유형 50', event2: '핀자유형 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' }
];

// Baseline Map of Last Year's Records (Original 37 swimmers)
const LAST_YEAR_MAP = {};
DEFAULT_RECORDS.forEach(d => {
  LAST_YEAR_MAP[d.id] = { ...d };
});

function getLastYearRecord(id, field) {
  const orig = LAST_YEAR_MAP[id];
  if (orig && orig[field] && String(orig[field]).trim() !== '') {
    return String(orig[field]).trim();
  }
  return '';
}

const STROKE_FIELDS = ['finFly', 'finFree', 'free', 'back', 'breast', 'fly'];
const STROKE_NAMES = {
  finFly: '핀접영',
  finFree: '핀자유',
  free: '자유형',
  back: '배영',
  breast: '평영',
  fly: '접영'
};

// Application State
let records = [];
let currentView = 'records'; // 'records' | 'events'
let searchQuery = '';
let currentFilter = 'all'; // 'all', '남', '여', 'recorded'
let sortColumn = null;
let sortDirection = 'asc';
let recordsViewMode = 'simple'; // 'simple' (기본) | 'detailed'

// Events View State
let eventsSearchQuery = '';
let eventsGenderFilter = 'all';
let eventsGroupFilter = 'all';
let eventsViewMode = 'simple'; // 'simple' (기본) | 'detailed'

let isStickyPinned = false; // 기본값: 고정해제
let saveTimeout = null;

// Header Toggle Buttons & View Containers
const btnToggleRecords = document.getElementById('btnToggleRecords');
const btnToggleEvents = document.getElementById('btnToggleEvents');
const viewRecords = document.getElementById('viewRecords');
const viewEvents = document.getElementById('viewEvents');

// Records View DOM
const tableBody = document.getElementById('tableBody');
const recordTable = document.getElementById('recordTable');
const btnScenarioMode = document.getElementById('btnScenarioMode');
const btnRecordsModeSimple = document.getElementById('btnRecordsModeSimple');
const btnRecordsModeDetailed = document.getElementById('btnRecordsModeDetailed');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');
const btnAddRow = document.getElementById('btnAddRow');
const btnExportCsv = document.getElementById('btnExportCsv');
const btnCopyTsv = document.getElementById('btnCopyTsv');
const toastEl = document.getElementById('toast');
const saveStatus = document.getElementById('saveStatus');
const saveStatusText = document.getElementById('saveStatusText');
const comboGrid = document.getElementById('comboGrid');

// Events View DOM (Side-by-Side Matrices & List)
const maleMatrixBody = document.getElementById('maleMatrixBody');
const maleMatrixFoot = document.getElementById('maleMatrixFoot');
const femaleMatrixBody = document.getElementById('femaleMatrixBody');
const femaleMatrixFoot = document.getElementById('femaleMatrixFoot');

const btnModeSimple = document.getElementById('btnModeSimple');
const btnModeDetailed = document.getElementById('btnModeDetailed');
const eventsDetailTable = document.getElementById('eventsDetailTable');
const eventsSearchInput = document.getElementById('eventsSearchInput');
const eventsFilterBtns = document.querySelectorAll('.events-filter-btn');
const eventsGroupSelect = document.getElementById('eventsGroupSelect');
const eventsTableBody = document.getElementById('eventsTableBody');
const eventsFilteredCount = document.getElementById('eventsFilteredCount');

// Init application
function init() {
  window.__GMDC_VERSION__ = APP_VERSION;
  console.log(`%c[GMDC Swim] App Version: ${APP_VERSION}`, 'color: #0284c7; font-weight: bold; font-size: 12px;');
  initStickyPreference();
  initNoticeModal();
  initAuditModal();
  initRulesModal();
  initScenarioMode();
  initRecordsViewMode();
  initEventsViewMode();
  initDeadlineCountdown();
  loadLocalData();
  bindEvents();
  handleUrlRouting();
  renderAll();
  initFirebaseSync();
}

function initDeadlineCountdown() {
  updateDeadlineCountdown();
  setInterval(updateDeadlineCountdown, 1000);
}

function updateDeadlineCountdown() {
  const badge = document.getElementById('tableDateBadge');
  if (!badge) return;

  const now = new Date();
  const diff = DEADLINE.getTime() - now.getTime();

  if (diff <= 0) {
    badge.className = 'header-date is-expired';
    badge.innerHTML = `🔒 입력 마감됨`;
    badge.title = '입력 마감 시한(8/17 18:00)이 종료되어 읽기 전용 상태입니다.';
    
    if (badge.dataset.expiredState !== 'expired') {
      badge.dataset.expiredState = 'expired';
      renderAll();
    }
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let timeStr = '';
  if (days > 0) {
    timeStr = `마감까지 ${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
  } else if (hours > 0) {
    timeStr = `마감까지 ${hours}시간 ${minutes}분 ${seconds}초`;
  } else {
    timeStr = `마감까지 ${minutes}분 ${seconds}초`;
  }

  const isUrgent = diff < 3600000; // 1시간 이내
  badge.className = `header-date ${isUrgent ? 'is-urgent' : 'is-active'}`;
  badge.innerHTML = `⏳ ${timeStr}`;
  badge.title = `클릭하여 마감 일정 안내 보기 (마감 시한: 8월 17일 18:00)`;
}

function initScenarioMode() {
  if (btnScenarioMode) {
    btnScenarioMode.addEventListener('click', toggleScenarioMode);
  }
}

function toggleScenarioMode() {
  if (!isScenarioMode) {
    // Turning ON
    alert("서버에 업로드 하지 않고, 입력결과를 테스트합니다.");
    isScenarioMode = true;
    if (!serverRecordsCache) {
      serverRecordsCache = JSON.parse(JSON.stringify(records));
    }
    updateScenarioModeUI(true);
    showToast('🧪 시나리오 테스트 모드가 활성화되었습니다. (서버 미저장)');
  } else {
    // Turning OFF
    if (confirm("서버값으로 되돌립니다.")) {
      isScenarioMode = false;
      if (serverRecordsCache && Array.isArray(serverRecordsCache)) {
        records = JSON.parse(JSON.stringify(serverRecordsCache));
      } else {
        records = JSON.parse(JSON.stringify(DEFAULT_RECORDS));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      updateScenarioModeUI(false);
      renderAll();
      showToast('✅ 서버 데이터로 원복되었습니다.');
    }
  }
}

function updateScenarioModeUI(isOn) {
  if (btnScenarioMode) {
    btnScenarioMode.classList.toggle('active', isOn);
    btnScenarioMode.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.31"></path><path d="M14 9.3V1.99"></path><path d="M8.5 2h7"></path><path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path><path d="M5.52 16h12.96"></path></svg>
      <span>${isOn ? '🧪 시나리오 ON' : '시나리오 OFF'}</span>
    `;
    btnScenarioMode.title = isOn 
      ? '시나리오 모드 실행 중 (클릭 시 서버값으로 되돌리기)' 
      : '시나리오 테스트 모드 (서버 저장 없이 가상 테스트)';
  }

  if (saveStatus && saveStatusText) {
    saveStatus.classList.toggle('is-scenario', isOn);
    if (isOn) {
      saveStatusText.innerHTML = `<span>🧪 시나리오 모드 (서버 저장 안 됨)</span>`;
    } else {
      saveStatusText.innerHTML = `<span class="status-dot"></span><span>자동 저장 활성화</span>`;
    }
  }
}

// ============================================================
// HISTORY RECONCILIATION & AUDIT ENGINE
// (히스토리 로그를 초기 기본값부터 순차 재현하여 현재 PB 데이터와 정합성 비교)
// ============================================================
function initAuditModal() {
  const btnAudit = document.getElementById('btnAuditHistory');
  const modal = document.getElementById('auditModal');
  const btnCloseX = document.getElementById('btnAuditModalCloseX');
  const btnConfirm = document.getElementById('btnAuditModalConfirm');

  if (btnAudit) {
    btnAudit.addEventListener('click', openAuditModal);
  }

  if (btnCloseX) {
    btnCloseX.addEventListener('click', closeAuditModal);
  }

  if (btnConfirm) {
    btnConfirm.addEventListener('click', closeAuditModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAuditModal();
      }
    });
  }

  // Expose to window for developer/console debugging
  window.compareHistoryWithCurrentRecords = compareHistoryWithCurrentRecords;
  window.openAuditModal = openAuditModal;
}

function openAuditModal() {
  const modal = document.getElementById('auditModal');
  const body = document.getElementById('auditModalBody');
  const timeEl = document.getElementById('auditModalTimestamp');

  if (!modal || !body) return;

  modal.classList.add('show');
  body.innerHTML = `
    <div style="text-align:center; padding:35px 20px; color:var(--text-muted);">
      <div style="font-size:28px; margin-bottom:10px; animation:spin 1s infinite linear;">⏳</div>
      <div style="font-size:14px; font-weight:700; color:var(--text-main);">Firebase 히스토리 로그 분석 및 정합성 검증 중...</div>
      <div style="font-size:12px; margin-top:5px;">클라우드 히스토리 컬렉션에서 전체 변경 이력을 순차 재현하고 있습니다.</div>
    </div>
  `;

  // Run audit analysis asynchronously
  setTimeout(async () => {
    const result = await compareHistoryWithCurrentRecords();
    if (timeEl) {
      timeEl.textContent = `검증 시각: ${new Date().toLocaleTimeString('ko-KR')}`;
    }

    if (!result || !result.success) {
      body.innerHTML = `
        <div style="background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; padding:16px; color:#991b1b;">
          <div style="font-weight:700; font-size:14px;">⚠️ 검증 실패</div>
          <div style="font-size:12.5px; margin-top:4px;">${escapeHtml(result ? result.reason || result.error : '알 수 없는 오류가 발생했습니다.')}</div>
        </div>
      `;
      return;
    }

    if (result.isPerfectMatch) {
      body.innerHTML = `
        <div style="background:#ecfdf5; border:1px solid #6ee7b7; border-radius:10px; padding:18px; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:8px; color:#065f46; font-weight:800; font-size:16px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>히스토리와 현재 데이터가 100% 완벽히 일치합니다!</span>
          </div>
          <p style="margin-top:8px; font-size:13px; color:#047857; line-height:1.5;">
            서버의 <strong>${HISTORY_COL_NAME}</strong> 컬렉션에 기록된 총 <strong>${result.totalLogs}건</strong>의 변경 로그를 2026-01-01 초기 기본 데이터부터 순차적으로 재현한 결과, 현재 로딩된 모든 회원(37명) 및 <strong>${result.totalFieldChecks}개</strong>의 세부 필드 값과 오차 없이 100% 정확하게 일치함을 검증하였습니다.
          </p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:14px; text-align:center;">
          <div style="background:var(--bg-page); padding:14px 10px; border-radius:8px; border:1px solid var(--border-light);">
            <div style="font-size:11.5px; color:var(--text-muted); font-weight:600;">처리된 히스토리</div>
            <div style="font-size:20px; font-weight:800; color:var(--primary); margin-top:4px;">${result.totalLogs}건</div>
          </div>
          <div style="background:var(--bg-page); padding:14px 10px; border-radius:8px; border:1px solid var(--border-light);">
            <div style="font-size:11.5px; color:var(--text-muted); font-weight:600;">검증된 데이터 필드</div>
            <div style="font-size:20px; font-weight:800; color:var(--secondary); margin-top:4px;">${result.totalFieldChecks}개</div>
          </div>
          <div style="background:var(--bg-page); padding:14px 10px; border-radius:8px; border:1px solid var(--border-light);">
            <div style="font-size:11.5px; color:var(--text-muted); font-weight:600;">데이터 정합성</div>
            <div style="font-size:20px; font-weight:800; color:#10b981; margin-top:4px;">100% 일치</div>
          </div>
        </div>

        <div style="font-size:12px; color:var(--text-muted); background:var(--bg-page); padding:10px 14px; border-radius:6px; border-left:3px solid #10b981;">
          💡 <strong>무결성 보증:</strong> 코드 재배포나 동기화 과정에서 서버 데이터의 유실이나 임의 롤백이 전혀 없었음을 확인하였습니다.
        </div>
      `;
    } else {
      body.innerHTML = `
        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:18px; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:8px; color:#92400e; font-weight:800; font-size:16px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <span>총 ${result.discrepancyCount}건의 차이가 발견되었습니다 (일치율: ${result.matchRate})</span>
          </div>
          <p style="margin-top:8px; font-size:13px; color:#b45309; line-height:1.5;">
            히스토리 로그 재현 결과와 현재 서버/로컬 로딩 데이터 간에 일부 차이가 있습니다. 아래 목록을 확인하고, 필요 시 아래 <strong>[히스토리 데이터로 일괄 복구]</strong> 버튼을 눌러 원상 복구할 수 있습니다.
          </p>
        </div>

        <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-light); border-radius: 8px; margin-bottom: 14px;">
          <table class="audit-table" style="margin-top:0;">
            <thead>
              <tr>
                <th>회원명</th>
                <th>항목</th>
                <th>히스토리 재현값</th>
                <th>현재 로딩값</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              ${result.discrepancies.map(d => `
                <tr>
                  <td style="font-weight:700;">${escapeHtml(d.name)}</td>
                  <td>${escapeHtml(d.fieldName || d.field)}</td>
                  <td style="color:#2563eb; font-weight:700;">${escapeHtml(d.replayedVal)}</td>
                  <td style="color:#dc2626; font-weight:700;">${escapeHtml(d.currentVal)}</td>
                  <td><span style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px; font-size:11px;">${escapeHtml(d.status)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button id="btnRestoreFromHistory" class="btn btn-primary" style="background:#059669; border-color:#059669; font-weight:700; display:flex; align-items:center; gap:6px; font-size:13px; padding:8px 16px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>
            <span>히스토리 데이터로 일괄 복구하기 (${result.discrepancyCount}건 복원)</span>
          </button>
        </div>
      `;

      const btnRestore = body.querySelector('#btnRestoreFromHistory');
      if (btnRestore) {
        btnRestore.addEventListener('click', () => {
          if (confirm(`히스토리에 기록된 ${result.discrepancyCount}건의 변경 내역을 현재 서버 데이터에 완벽하게 복구하시겠습니까?`)) {
            records = JSON.parse(JSON.stringify(result.replayedRecords));
            saveData();
            renderAll();
            showToast(`🎉 ${result.discrepancyCount}건의 기록이 히스토리 데이터로 완벽히 복구되었습니다!`);
            closeAuditModal();
          }
        });
      }
    }
  }, 100);
}

function closeAuditModal() {
  const modal = document.getElementById('auditModal');
  if (modal) modal.classList.remove('show');
}

function initRulesModal() {
  const btnOpen = document.getElementById('btnOpenRulesModal');
  const modal = document.getElementById('rulesModal');
  const btnCloseX = document.getElementById('btnRulesModalCloseX');
  const btnConfirm = document.getElementById('btnRulesModalConfirm');

  if (!modal) return;

  function openModal() {
    modal.classList.add('show');
  }

  function closeModal() {
    modal.classList.remove('show');
  }

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  if (btnCloseX) btnCloseX.addEventListener('click', closeModal);
  if (btnConfirm) btnConfirm.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

async function compareHistoryWithCurrentRecords() {
  if (!db) {
    console.warn('Firebase DB가 연결되지 않았습니다.');
    return { success: false, reason: 'Firebase DB가 연결되지 않았습니다.' };
  }

  try {
    const colRef = collection(db, HISTORY_COL_NAME);
    const q = query(colRef, orderBy("timestamp", "asc"));
    const querySnapshot = await getDocs(q);

    const historyLogs = [];
    querySnapshot.forEach(docSnap => {
      historyLogs.push({ id: docSnap.id, ...docSnap.data() });
    });

    // 1. Start from initial DEFAULT_RECORDS (deep clone)
    let replayed = JSON.parse(JSON.stringify(DEFAULT_RECORDS));

    // 2. Replay all logs chronologically
    historyLogs.forEach(log => {
      const { type, swimmerName, field, newVal } = log;
      if (!swimmerName) return;

      let target = replayed.find(r => r.name === swimmerName);

      if (type === 'MEMBER') {
        if (!target) {
          const newId = replayed.length > 0 ? Math.max(...replayed.map(r => r.id)) + 1 : 1;
          target = {
            id: newId,
            age: '',
            group: '1그룹',
            gender: '남',
            name: swimmerName,
            birthId: '',
            event1: '',
            event2: '',
            finFly: '',
            finFree: '',
            free: '',
            back: '',
            breast: '',
            fly: ''
          };
          replayed.push(target);
        }
      } else if (type === 'DELETE') {
        replayed = replayed.filter(r => r.name !== swimmerName);
        return;
      }

      if (target && field) {
        target[field] = newVal !== undefined && newVal !== null ? String(newVal) : '';
      }
    });

    // 3. Compare replayed with current records (serverRecordsCache or records)
    const currentList = serverRecordsCache || records;
    const discrepancies = [];
    const fieldsToCheck = ['group', 'age', 'gender', 'name', 'event1', 'event2', 'finFly', 'finFree', 'free', 'back', 'breast', 'fly'];

    let totalFieldChecks = 0;
    let matchingFieldChecks = 0;

    currentList.forEach(curr => {
      const rep = replayed.find(r => r.id === curr.id || r.name === curr.name);
      if (!rep) {
        discrepancies.push({
          id: curr.id,
          name: curr.name,
          field: '(회원 존재 여부)',
          fieldName: '회원 존재 여부',
          replayedVal: '미존재',
          currentVal: '존재함',
          status: '히스토리 미기록'
        });
        return;
      }

      fieldsToCheck.forEach(f => {
        totalFieldChecks++;
        const currVal = String(curr[f] || '').trim();
        const repVal = String(rep[f] || '').trim();

        if (currVal === repVal) {
          matchingFieldChecks++;
        } else {
          discrepancies.push({
            id: curr.id,
            name: curr.name,
            field: f,
            fieldName: STROKE_NAMES[f] || f,
            replayedVal: repVal || '(빈값)',
            currentVal: currVal || '(빈값)',
            status: '불일치'
          });
        }
      });
    });

    const matchRate = totalFieldChecks > 0 ? ((matchingFieldChecks / totalFieldChecks) * 100).toFixed(1) : '100.0';
    const result = {
      success: true,
      totalLogs: historyLogs.length,
      totalFieldChecks,
      matchingFieldChecks,
      matchRate: `${matchRate}%`,
      discrepancyCount: discrepancies.length,
      discrepancies,
      replayedRecords: replayed,
      isPerfectMatch: discrepancies.length === 0,
      timestamp: new Date().toISOString()
    };

    // Formatted Developer Console Group
    console.group(`🔍 [GMDC] 히스토리 기반 데이터 정합성 검증 (${new Date().toLocaleTimeString('ko-KR')})`);
    console.log(`📜 처리된 히스토리 로그: ${historyLogs.length}건`);
    console.log(`🎯 데이터 일치율: ${matchRate}% (${matchingFieldChecks}/${totalFieldChecks}개 필드 일치)`);
    if (result.isPerfectMatch) {
      console.log(`%c✅ 완벽 일치: 히스토리 실행 결과와 현재 서버/로딩 데이터가 100% 일치합니다.`, 'color: #10b981; font-weight: bold; font-size: 13px;');
    } else {
      console.warn(`⚠️ 불일치 항목 ${discrepancies.length}건 발견:`, discrepancies);
      console.table(discrepancies);
    }
    console.groupEnd();

    return result;
  } catch (err) {
    console.error('히스토리 검증 중 오류 발생:', err);
    return { success: false, error: err.message || err };
  }
}

function initRecordsViewMode() {
  const saved = localStorage.getItem(RECORDS_MODE_KEY);
  recordsViewMode = (saved === 'detailed') ? 'detailed' : 'simple'; // 기본: simple
  applyRecordsViewMode(recordsViewMode);
}

function applyRecordsViewMode(mode) {
  recordsViewMode = mode;
  if (btnRecordsModeSimple) btnRecordsModeSimple.classList.toggle('active', mode === 'simple');
  if (btnRecordsModeDetailed) btnRecordsModeDetailed.classList.toggle('active', mode === 'detailed');
  if (recordTable) recordTable.classList.toggle('is-simple', mode === 'simple');
}

function initEventsViewMode() {
  const saved = localStorage.getItem(EVENTS_MODE_KEY);
  eventsViewMode = (saved === 'detailed') ? 'detailed' : 'simple'; // 기본: simple
  applyEventsViewMode(eventsViewMode);
}

function applyEventsViewMode(mode) {
  eventsViewMode = mode;
  if (btnModeSimple) btnModeSimple.classList.toggle('active', mode === 'simple');
  if (btnModeDetailed) btnModeDetailed.classList.toggle('active', mode === 'detailed');
  if (eventsDetailTable) eventsDetailTable.classList.toggle('is-simple', mode === 'simple');
}

// Log history change to Firestore & local state
async function logChangeHistory(type, swimmerName, field, fieldName, oldVal, newVal, customMsg = '') {
  if (isScenarioMode) return;
  if (oldVal === newVal && type !== 'MEMBER' && type !== 'DELETE') return;

  const typeLabels = {
    RECORD: '기록 수정',
    EVENT: '종목 변경',
    INFO: '정보 수정',
    MEMBER: '회원 추가',
    DELETE: '회원 삭제'
  };

  let msg = customMsg;
  if (!msg) {
    if (type === 'RECORD') {
      msg = `${swimmerName}: ${fieldName} 기록 (${oldVal || '빈값'} ➔ ${newVal || '삭제'})`;
    } else if (type === 'EVENT') {
      msg = `${swimmerName}: ${fieldName} (${oldVal || '미신청'} ➔ ${newVal || '미신청'})`;
    } else if (type === 'INFO') {
      msg = `${swimmerName}: ${fieldName} (${oldVal} ➔ ${newVal})`;
    }
  }

  const now = new Date();
  const timeStr = now.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const logData = {
    type,
    typeLabel: typeLabels[type] || '수정',
    swimmerName: swimmerName || '무명',
    field: field || '',
    fieldName: fieldName || '',
    prevVal: oldVal !== undefined ? String(oldVal) : '',
    newVal: newVal !== undefined ? String(newVal) : '',
    message: msg,
    timestamp: now.toISOString(),
    timeFormatted: timeStr,
    device: navigator.userAgent.includes('Mobile') ? '모바일' : 'PC'
  };

  // Save directly to Firestore for server history reference
  if (db) {
    try {
      const colRef = collection(db, HISTORY_COL_NAME);
      await addDoc(colRef, logData);
    } catch (err) {
      console.error('Firestore 히스토리 저장 오류:', err);
    }
  }
}

function renderAll() {
  renderTable();
  updateStats();
  renderSummaryMatrices();
  renderEventsTable();
}

// 1. Load Local Cache First (for instant startup)
function loadLocalData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      records = mergeWithDefaultData(parsed);
    } else {
      records = JSON.parse(JSON.stringify(DEFAULT_RECORDS));
    }
  } catch (e) {
    console.error('Failed to parse localStorage data', e);
    records = JSON.parse(JSON.stringify(DEFAULT_RECORDS));
  }
}

// Merge helper to guarantee group, birthId, event1, event2 are preserved
function mergeWithDefaultData(remoteList) {
  if (!Array.isArray(remoteList)) return JSON.parse(JSON.stringify(DEFAULT_RECORDS));

  return remoteList.map(item => {
    const def = DEFAULT_RECORDS.find(d => d.id === item.id || d.name === item.name) || {};
    return {
      id: item.id || def.id || 0,
      age: item.age !== undefined ? item.age : (def.age || ''),
      group: item.group || def.group || '1그룹',
      gender: item.gender || def.gender || '남',
      name: item.name || def.name || '',
      birthId: item.birthId || def.birthId || '',
      event1: item.event1 !== undefined ? item.event1 : (def.event1 || ''),
      event2: item.event2 !== undefined ? item.event2 : (def.event2 || ''),
      finFly: item.finFly !== undefined ? item.finFly : (def.finFly || ''),
      finFree: item.finFree !== undefined ? item.finFree : (def.finFree || ''),
      free: item.free !== undefined ? item.free : (def.free || ''),
      back: item.back !== undefined ? item.back : (def.back || ''),
      breast: item.breast !== undefined ? item.breast : (def.breast || ''),
      fly: item.fly !== undefined ? item.fly : (def.fly || '')
    };
  });
}

// 2. Real-time Firebase Firestore Sync Listener
function initFirebaseSync() {
  if (!db || !DOC_REF) {
    if (saveStatusText) {
      saveStatusText.innerHTML = `<span style="color:#d97706;">⚠️ 로컬 저장 모드</span>`;
    }
    return;
  }

  if (saveStatusText) {
    saveStatusText.innerHTML = `<span>⏳ Firebase 클라우드 연결 중...</span>`;
  }

  onSnapshot(DOC_REF, (docSnap) => {
    if (docSnap.exists()) {
      isInitialSyncCompleted = true;
      const data = docSnap.data();
      if (data && Array.isArray(data.records)) {
        const merged = mergeWithDefaultData(data.records);
        serverRecordsCache = JSON.parse(JSON.stringify(merged));

        if (!isScenarioMode) {
          const isDataChanged = JSON.stringify(records) !== JSON.stringify(merged);
          if (isDataChanged) {
            records = merged;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
            
            const activeEl = document.activeElement;
            const isUserTyping = activeEl && activeEl.classList && (activeEl.classList.contains('cell-input') || activeEl.classList.contains('event-select'));
            
            if (!isUserTyping) {
              renderAll();
            } else {
              updateStats();
              renderSummaryMatrices();
            }
          }
        }
      }
      if (saveStatusText && !isScenarioMode) {
        saveStatusText.innerHTML = `<span class="status-dot"></span><span>Firebase 클라우드 동기화 (${new Date().toLocaleTimeString('ko-KR')})</span>`;
      }
    } else {
      console.warn('⚠️ Firebase 서버 문서를 찾을 수 없습니다. 자동 초기화(덮어쓰기)를 수행하지 않고 읽기 대기합니다.');
      if (saveStatusText && !isScenarioMode) {
        saveStatusText.innerHTML = `<span style="color:#ef4444;">⚠️ 서버 문서 없음 (연결 대기)</span>`;
      }
    }
  }, (error) => {
    console.error('Firebase onSnapshot 에러:', error);
    if (saveStatusText && !isScenarioMode) {
      saveStatusText.innerHTML = `<span style="color:#ef4444;">⚠️ Firebase 접근 권한 확인 필요</span>`;
    }
    showToast('⚠️ Firebase 보안 규칙(Rules)을 확인해 주세요.');
  });
}

// 3. Save Data (localStorage immediately + Firestore debounced)
function saveData() {
  if (isScenarioMode) {
    if (saveStatusText) {
      saveStatusText.innerHTML = `<span>🧪 시나리오 모드 (서버 저장 안 됨)</span>`;
    }
    return;
  }

  // Prevent saving before initial server data has been loaded
  if (!isInitialSyncCompleted && db && DOC_REF) {
    console.warn('⚠️ 서버 최초 데이터 동기화 완료 전 저장을 안전하게 차단합니다.');
    return;
  }

  if (isDeadlineExpired()) {
    showToast('🔒 입력 및 수정 시한이 마감되었습니다.');
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }

  if (saveStatusText) {
    saveStatusText.innerHTML = `<span>⏳ 저장 중...</span>`;
  }

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    syncToFirestore(records);
  }, 400);
}

// Async sync to Firestore
async function syncToFirestore(dataList) {
  if (!db || !DOC_REF) {
    if (saveStatusText) {
      saveStatusText.innerHTML = `<span class="status-dot"></span><span>로컬 저장됨 (${new Date().toLocaleTimeString('ko-KR')})</span>`;
    }
    return;
  }

  try {
    await setDoc(DOC_REF, {
      records: dataList,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (saveStatusText) {
      saveStatusText.innerHTML = `<span class="status-dot"></span><span>클라우드 저장 완료 (${new Date().toLocaleTimeString('ko-KR')})</span>`;
    }
  } catch (err) {
    console.error('Firestore setDoc 실패:', err);
    if (saveStatusText) {
      saveStatusText.innerHTML = `<span style="color:#ef4444;">⚠️ 클라우드 저장 실패 (로컬 저장됨)</span>`;
    }
  }
}

// Show Toast Message
function showToast(message, duration = 2800) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

// View Navigation & URL hash routing
function switchView(viewName) {
  currentView = viewName;
  window.location.hash = viewName;

  if (viewName === 'events') {
    if (btnToggleRecords) btnToggleRecords.classList.remove('active');
    if (btnToggleEvents) btnToggleEvents.classList.add('active');
    if (viewRecords) viewRecords.classList.remove('active');
    if (viewEvents) viewEvents.classList.add('active');
    renderSummaryMatrices();
    renderEventsTable();
  } else {
    if (btnToggleRecords) btnToggleRecords.classList.add('active');
    if (btnToggleEvents) btnToggleEvents.classList.remove('active');
    if (viewRecords) viewRecords.classList.add('active');
    if (viewEvents) viewEvents.classList.remove('active');
    renderTable();
    updateStats();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleUrlRouting() {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'events') {
    switchView('events');
  } else {
    switchView('records');
  }

  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.replace('#', '');
    if (newHash === 'events' && currentView !== 'events') {
      switchView('events');
    } else if (newHash !== 'events' && currentView !== 'records') {
      switchView('records');
    }
  });
}

// Initialize Notice Modal Popup
function initNoticeModal() {
  const modal = document.getElementById('noticeModal');
  const btnCloseX = document.getElementById('btnModalCloseX');
  const btnConfirm = document.getElementById('btnModalConfirm');
  const chkHideToday = document.getElementById('chkHideToday');

  if (!modal) return;

  const todayStr = new Date().toDateString();
  const savedDate = localStorage.getItem(MODAL_STORAGE_KEY);

  if (savedDate !== todayStr) {
    setTimeout(() => {
      modal.classList.add('show');
    }, 200);
  }

  function closeModal() {
    if (chkHideToday && chkHideToday.checked) {
      localStorage.setItem(MODAL_STORAGE_KEY, todayStr);
    }
    modal.classList.remove('show');
  }

  if (btnCloseX) btnCloseX.addEventListener('click', closeModal);
  if (btnConfirm) btnConfirm.addEventListener('click', closeModal);

  // Click on deadline countdown badge to view notice modal
  const tableDateBadge = document.getElementById('tableDateBadge');
  if (tableDateBadge) {
    tableDateBadge.addEventListener('click', () => {
      modal.classList.add('show');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModal();
    }
  });
}

// Initialize Sticky Panel Preference
function initStickyPreference() {
  const saved = localStorage.getItem(STICKY_STORAGE_KEY);
  isStickyPinned = saved === '1'; // 기본값: 고정 해제 (false)
  applyStickyState(isStickyPinned);
}

function applyStickyState(pinned) {
  if (comboGrid) {
    comboGrid.classList.toggle('is-sticky', pinned);
  }
  const pinBtns = document.querySelectorAll('.btn-panel-pin');
  pinBtns.forEach(btn => {
    btn.classList.toggle('active', pinned);
    btn.title = pinned ? '조합 패널 고정 해제 (클릭 시 고정 해제)' : '조합 패널 고정 활성화 (클릭 시 상단 고정)';
  });
}

// Filter and Sort Data for Records View
function getProcessedRecords() {
  let list = [...records];

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    list = list.filter(item => 
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.age && item.age.toString().includes(q)) ||
      (item.group && item.group.toLowerCase().includes(q))
    );
  }

  if (currentFilter === '남') {
    list = list.filter(item => item.gender === '남');
  } else if (currentFilter === '여') {
    list = list.filter(item => item.gender === '여');
  } else if (currentFilter === 'recorded') {
    list = list.filter(item => 
      STROKE_FIELDS.some(field => item[field] && item[field].trim() !== '')
    );
  }

  if (sortColumn) {
    list.sort((a, b) => {
      let valA = a[sortColumn] || '';
      let valB = b[sortColumn] || '';

      if (sortColumn === 'no') {
        valA = a.id;
        valB = b.id;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      if (sortColumn === 'age') {
        const numA = parseFloat(valA) || 0;
        const numB = parseFloat(valB) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      if (STROKE_FIELDS.includes(sortColumn)) {
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        const hasA = !isNaN(numA);
        const hasB = !isNaN(numB);

        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;

        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      return sortDirection === 'asc' 
        ? String(valA).localeCompare(String(valB), 'ko')
        : String(valB).localeCompare(String(valA), 'ko');
    });
  }

  return list;
}

// Render PB Records Table
function renderTable() {
  const processed = getProcessedRecords();
  tableBody.innerHTML = '';

  const expired = isDeadlineExpired();
  const disabledAttr = expired ? 'disabled' : '';

  if (processed.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="12" style="padding: 40px; color: var(--text-muted); font-size: 14px; text-align: center;">
        일치하는 데이터가 없습니다.
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }

  processed.forEach((item) => {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;

    // Events summary tags
    const eventsList = [item.event1, item.event2].filter(Boolean);
    const eventsTagHtml = eventsList.length > 0
      ? `<div class="pb-events-tag-container">${eventsList.map(e => `<span class="pb-event-chip">${escapeHtml(e)}</span>`).join('')}</div>`
      : `<span class="pb-event-chip empty">미신청</span>`;

    tr.innerHTML = `
      <td class="col-no col-pb-detail">${item.id}</td>
      <td class="col-group col-pb-detail">
        <span class="group-badge">${escapeHtml(item.group || '-')}</span>
      </td>
      <td class="col-age col-pb-detail">
        <input type="text" class="cell-input age-input" data-id="${item.id}" data-field="age" value="${escapeHtml(item.age || '')}" placeholder="만나이" inputmode="numeric" ${disabledAttr} />
      </td>
      <td class="col-gender col-pb-detail">
        <span class="gender-badge ${item.gender === '남' ? 'male' : 'female'} ${expired ? 'is-locked' : ''}" data-id="${item.id}" data-field="gender" title="${expired ? '입력 마감됨' : '클릭하여 성별 전환'}">
          ${item.gender || '남'}
        </span>
      </td>
      <td class="col-name">
        <input type="text" class="cell-input name-input" data-id="${item.id}" data-field="name" value="${escapeHtml(item.name || '')}" placeholder="이름" title="클릭하여 이름 수정 (수정 시 확인 절차가 진행됩니다)" ${disabledAttr} />
      </td>
      ${STROKE_FIELDS.map(field => {
        const val = item[field] || '';
        const lastYearVal = getLastYearRecord(item.id, field);
        let colorClass = '';
        let titleText = '';

        if (val !== '') {
          if (lastYearVal !== '' && val === lastYearVal) {
            colorClass = 'is-last-year';
            titleText = '작년기록 (파란색)';
          } else {
            colorClass = 'is-target';
            titleText = lastYearVal ? `희망기록 (붉은색, 작년: ${lastYearVal}s)` : '희망기록 (붉은색)';
          }
        }

        return `
          <td class="col-record">
            <div class="record-cell-wrapper">
              <input 
                type="text" 
                class="cell-input record-input ${colorClass}" 
                data-id="${item.id}" 
                data-field="${field}" 
                value="${escapeHtml(val)}" 
                placeholder="-"
                inputmode="decimal"
                autocomplete="off"
                title="${titleText}"
                ${disabledAttr}
              />
            </div>
          </td>
        `;
      }).join('')}
      <td class="col-events-summary col-pb-detail">
        ${eventsTagHtml}
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

// ============================================================
// SIDE-BY-SIDE SUMMARY MATRICES (남성 / 여성 각각 좌우 표시, 숫자만 + hover 툴팁)
// ============================================================
function renderSummaryMatrices() {
  if (maleMatrixBody && maleMatrixFoot) {
    renderSingleGenderMatrix('남', maleMatrixBody, maleMatrixFoot);
  }
  if (femaleMatrixBody && femaleMatrixFoot) {
    renderSingleGenderMatrix('여', femaleMatrixBody, femaleMatrixFoot);
  }
}

function renderSingleGenderMatrix(gender, bodyEl, footEl) {
  bodyEl.innerHTML = '';
  const filteredList = records.filter(r => r.gender === gender);

  const colTotals = {
    '핀자유형 50': 0,
    '핀접영 50': 0,
    '자유형 50': 0,
    '배영 50': 0,
    '평영 50': 0,
    '접영 50': 0
  };
  let grandTotal = 0;

  GROUPS.forEach(groupName => {
    const groupMembers = filteredList.filter(r => r.group === groupName);
    let groupRowTotal = 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="matrix-cell-group">${groupName}</td>`;

    EVENT_OPTIONS.forEach(eventName => {
      const eventSwimmers = groupMembers.filter(r => r.event1 === eventName || r.event2 === eventName);
      const count = eventSwimmers.length;
      groupRowTotal += count;
      colTotals[eventName] += count;

      if (count > 0) {
        const namesList = eventSwimmers.map(s => s.name).join(', ');
        tr.innerHTML += `
          <td class="matrix-cell has-count" title="${groupName} · ${eventName} (${count}명): ${namesList}">
            <span class="matrix-num">${count}</span>
            <div class="matrix-hover-tooltip">
              <div class="tooltip-header">${groupName} · ${eventName} (${count}명)</div>
              <div class="tooltip-list">
                ${eventSwimmers.map(s => `
                  <span class="tooltip-chip ${gender === '남' ? 'male' : 'female'}">${escapeHtml(s.name)}</span>
                `).join('')}
              </div>
            </div>
          </td>
        `;
      } else {
        tr.innerHTML += `
          <td class="matrix-cell is-empty">
            <span class="matrix-num-empty">-</span>
          </td>
        `;
      }
    });

    grandTotal += groupRowTotal;
    tr.innerHTML += `
      <td class="matrix-cell" style="font-weight:800; background:#f8fafc; color:var(--secondary);">
        ${groupRowTotal > 0 ? groupRowTotal : '-'}
      </td>
    `;
    bodyEl.appendChild(tr);
  });

  // Footer Row
  footEl.innerHTML = `
    <tr>
      <th>계</th>
      ${EVENT_OPTIONS.map(ev => `
        <td>${colTotals[ev] > 0 ? colTotals[ev] : '-'}</td>
      `).join('')}
      <td style="color:${gender === '남' ? '#0284c7' : '#e11d48'}; font-weight:900;">${grandTotal}</td>
    </tr>
  `;
}

// ============================================================
// EVENTS DETAIL TABLE SECTION (출전 선수별 상세 명단)
// ============================================================
function renderEventsTable() {
  if (!eventsTableBody) return;

  let list = [...records];

  // Search filter
  if (eventsSearchQuery.trim()) {
    const q = eventsSearchQuery.trim().toLowerCase();
    list = list.filter(item => 
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.group && item.group.toLowerCase().includes(q)) ||
      (item.birthId && item.birthId.toLowerCase().includes(q))
    );
  }

  // Gender filter
  if (eventsGenderFilter === '남') {
    list = list.filter(item => item.gender === '남');
  } else if (eventsGenderFilter === '여') {
    list = list.filter(item => item.gender === '여');
  }

  // Group filter
  if (eventsGroupFilter !== 'all') {
    list = list.filter(item => item.group === eventsGroupFilter);
  }

  if (eventsFilteredCount) {
    eventsFilteredCount.textContent = `${list.length}명 표시 중 (총 ${records.length}명)`;
  }

  eventsTableBody.innerHTML = '';

  if (list.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="9" style="padding: 36px; color: var(--text-muted); font-size: 14px; text-align: center;">
        일치하는 출전 선수가 없습니다.
      </td>
    `;
    eventsTableBody.appendChild(emptyRow);
    return;
  }

  const expired = isDeadlineExpired();
  const disabledAttr = expired ? 'disabled' : '';

  list.forEach(item => {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;

    const count = [item.event1, item.event2].filter(Boolean).length;
    const countClass = count === 2 ? 'count-2' : count === 1 ? 'count-1' : 'count-0';

    tr.innerHTML = `
      <td class="col-no col-detail" style="text-align:center;">${item.id}</td>
      <td class="col-group col-detail" style="text-align:center;">
        <span class="group-badge">${escapeHtml(item.group || '-')}</span>
      </td>
      <td class="col-gender col-detail" style="text-align:center;">
        <span class="gender-badge ${item.gender === '남' ? 'male' : 'female'}">${item.gender || '남'}</span>
      </td>
      <td class="col-name" style="font-weight:700;">
        ${escapeHtml(item.name || '무명')}
        <span style="font-size:11px; color:var(--text-subtle); margin-left:2px;">(${item.age}세)</span>
      </td>
      <td class="col-birth col-detail" style="text-align:center;">
        <span class="birth-code">${escapeHtml(item.birthId || '-')}</span>
      </td>
      <td class="col-event">
        <select class="event-select ${item.event1 ? 'has-event' : ''}" data-id="${item.id}" data-field="event1" ${disabledAttr}>
          <option value="">(미신청)</option>
          ${EVENT_OPTIONS.map(opt => `
            <option value="${opt}" ${item.event1 === opt ? 'selected' : ''}>${opt}</option>
          `).join('')}
        </select>
      </td>
      <td class="col-event">
        <select class="event-select ${item.event2 ? 'has-event' : ''}" data-id="${item.id}" data-field="event2" ${disabledAttr}>
          <option value="">(미신청)</option>
          ${EVENT_OPTIONS.map(opt => `
            <option value="${opt}" ${item.event2 === opt ? 'selected' : ''}>${opt}</option>
          `).join('')}
        </select>
      </td>
      <td class="col-count col-detail" style="text-align:center;">
        <span class="count-badge ${countClass}">${count}종목</span>
      </td>
      <td class="col-goto-pb col-detail" style="text-align:center;">
        <button class="btn-table-jump" data-jump-id="${item.id}" title="${item.name}의 단체전 기록표로 이동">
          PB 보기
        </button>
      </td>
    `;

    eventsTableBody.appendChild(tr);
  });
}

// Combination generator helper (k-combinations)
function getCombinations(arr, k) {
  const result = [];
  function backtrack(start, combo) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      backtrack(i + 1, combo);
      combo.pop();
    }
  }
  backtrack(0, []);
  return result;
}

// Find best medley relay (배영, 평영, 접영, 자유형 각 1명씩 배정, 4명 고유, 도합나이 >= minAge)
function findBestMedleyRelay(gender, minAge = 160) {
  const pool = records.filter(r => r.gender === gender && parseFloat(r.age) > 0);

  const backList = pool.filter(r => parseFloat(r.back) > 0);
  const breastList = pool.filter(r => parseFloat(r.breast) > 0);
  const flyList = pool.filter(r => parseFloat(r.fly) > 0);
  const freeList = pool.filter(r => parseFloat(r.free) > 0);

  const missing = [];
  if (backList.length === 0) missing.push('배영');
  if (breastList.length === 0) missing.push('평영');
  if (flyList.length === 0) missing.push('접영');
  if (freeList.length === 0) missing.push('자유형');

  if (missing.length > 0) {
    return {
      status: 'MISSING_STROKES',
      message: `조합불가: 기록 부족 (미등록 종목: ${missing.join(', ')})`
    };
  }

  let bestTime = Infinity;
  let bestAge = 0;
  let bestAssignment = null;
  let maxAgeFound = 0;

  for (const sBack of backList) {
    const ageBack = parseFloat(sBack.age);
    const timeBack = parseFloat(sBack.back);

    for (const sBreast of breastList) {
      if (sBreast.id === sBack.id) continue;
      const ageBreast = parseFloat(sBreast.age);
      const timeBreast = parseFloat(sBreast.breast);

      for (const sFly of flyList) {
        if (sFly.id === sBack.id || sFly.id === sBreast.id) continue;
        const ageFly = parseFloat(sFly.age);
        const timeFly = parseFloat(sFly.fly);

        for (const sFree of freeList) {
          if (sFree.id === sBack.id || sFree.id === sBreast.id || sFree.id === sFly.id) continue;
          const ageFree = parseFloat(sFree.age);
          const timeFree = parseFloat(sFree.free);

          const totalAge = ageBack + ageBreast + ageFly + ageFree;
          if (totalAge > maxAgeFound) {
            maxAgeFound = totalAge;
          }

          if (totalAge >= minAge) {
            const totalTime = timeBack + timeBreast + timeFly + timeFree;
            if (totalTime < bestTime) {
              bestTime = totalTime;
              bestAge = totalAge;
              bestAssignment = [
                { id: sBack.id, strokeField: 'back', strokeName: '배영', name: sBack.name, age: sBack.age, time: timeBack, gender: sBack.gender },
                { id: sBreast.id, strokeField: 'breast', strokeName: '평영', name: sBreast.name, age: sBreast.age, time: timeBreast, gender: sBreast.gender },
                { id: sFly.id, strokeField: 'fly', strokeName: '접영', name: sFly.name, age: sFly.age, time: timeFly, gender: sFly.gender },
                { id: sFree.id, strokeField: 'free', strokeName: '자유형', name: sFree.name, age: sFree.age, time: timeFree, gender: sFree.gender }
              ];
            }
          }
        }
      }
    }
  }

  if (bestAssignment) {
    return {
      status: 'SUCCESS',
      totalTime: bestTime,
      totalAge: bestAge,
      members: bestAssignment
    };
  } else {
    const ageSuffix = maxAgeFound > 0 ? ` (현재 ${maxAgeFound}세)` : '';
    return {
      status: 'AGE_NOT_MET',
      message: `조합불가: 도합나이 ${minAge}세 이상 조합 없음${ageSuffix}`
    };
  }
}

// Find best freestyle relay (자유형 50m x 4명, 도합나이 >= minAge)
function findBestFreestyleRelay(gender, minAge = 160) {
  const pool = records.filter(r => r.gender === gender && parseFloat(r.free) > 0 && parseFloat(r.age) > 0);

  if (pool.length < 4) {
    const names = pool.map(p => p.name).join(', ');
    const namesSuffix = names ? `: ${names}` : '';
    return {
      status: 'NOT_ENOUGH',
      message: `조합불가: 자유형 기록 부족 (${gender} ${pool.length}/4명)${namesSuffix}`
    };
  }

  const combos = getCombinations(pool, 4);
  let bestTime = Infinity;
  let bestAge = 0;
  let bestMembers = null;
  let maxAgeFound = 0;

  for (const group of combos) {
    const totalAge = group.reduce((sum, r) => sum + parseFloat(r.age), 0);
    if (totalAge > maxAgeFound) {
      maxAgeFound = totalAge;
    }

    if (totalAge >= minAge) {
      const totalTime = group.reduce((sum, r) => sum + parseFloat(r.free), 0);
      if (totalTime < bestTime) {
        bestTime = totalTime;
        bestAge = totalAge;
        bestMembers = group.map(r => ({
          id: r.id,
          strokeField: 'free',
          strokeName: '자유형',
          name: r.name,
          age: r.age,
          time: parseFloat(r.free),
          gender: r.gender
        }));
      }
    }
  }

  if (bestMembers) {
    bestMembers.sort((a, b) => a.time - b.time);
    return {
      status: 'SUCCESS',
      totalTime: bestTime,
      totalAge: bestAge,
      members: bestMembers
    };
  } else {
    const ageSuffix = maxAgeFound > 0 ? ` (현재 ${maxAgeFound}세)` : '';
    return {
      status: 'AGE_NOT_MET',
      message: `조합불가: 도합나이 ${minAge}세 이상 조합 없음${ageSuffix}`
    };
  }
}

// Compute Optimal Relay Combinations (5 Combinations)
function calculateRelayCombinations() {
  const finMen = records.filter(r => r.gender === '남' && parseFloat(r.finFree) > 0 && parseFloat(r.age) > 0);
  const finWomen = records.filter(r => r.gender === '여' && parseFloat(r.finFree) > 0 && parseFloat(r.age) > 0);

  let combo1Result = null;
  if (finMen.length < 3 || finWomen.length < 3) {
    const mNames = finMen.map(r => r.name).join(', ');
    const wNames = finWomen.map(r => r.name).join(', ');
    const mSuffix = mNames ? ` [${mNames}]` : '';
    const wSuffix = wNames ? ` [${wNames}]` : '';
    combo1Result = {
      status: 'NOT_ENOUGH',
      message: `조합불가: 핀자유 기록 부족 (남 ${finMen.length}/3명${mSuffix}, 여 ${finWomen.length}/3명${wSuffix})`
    };
  } else {
    const menCombos = getCombinations(finMen, 3);
    const womenCombos = getCombinations(finWomen, 3);
    let bestTime = Infinity;
    let bestAge = 0;
    let bestMembers = null;
    let maxAgeFound = 0;

    for (const mGroup of menCombos) {
      const mAge = mGroup.reduce((sum, r) => sum + parseFloat(r.age), 0);
      const mTime = mGroup.reduce((sum, r) => sum + parseFloat(r.finFree), 0);

      for (const wGroup of womenCombos) {
        const wAge = wGroup.reduce((sum, r) => sum + parseFloat(r.age), 0);
        const totalAge = mAge + wAge;
        if (totalAge > maxAgeFound) {
          maxAgeFound = totalAge;
        }

        if (totalAge >= 240) {
          const wTime = wGroup.reduce((sum, r) => sum + parseFloat(r.finFree), 0);
          const totalTime = mTime + wTime;

          if (totalTime < bestTime) {
            bestTime = totalTime;
            bestAge = totalAge;
            bestMembers = [
              ...mGroup.map(r => ({ id: r.id, strokeField: 'finFree', strokeName: '핀자유', name: r.name, age: r.age, time: parseFloat(r.finFree), gender: r.gender })),
              ...wGroup.map(r => ({ id: r.id, strokeField: 'finFree', strokeName: '핀자유', name: r.name, age: r.age, time: parseFloat(r.finFree), gender: r.gender }))
            ];
          }
        }
      }
    }

    if (bestMembers) {
      bestMembers.sort((a, b) => a.time - b.time);
      combo1Result = {
        status: 'SUCCESS',
        totalTime: bestTime,
        totalAge: bestAge,
        members: bestMembers
      };
    } else {
      const ageSuffix = maxAgeFound > 0 ? ` (현재 ${maxAgeFound}세)` : '';
      combo1Result = {
        status: 'AGE_NOT_MET',
        message: `조합불가: 도합나이 240세 이상 조합 없음${ageSuffix}`
      };
    }
  }

  // Combinations 2 & 3: Freestyle Relay (계영 200m)
  const combo2Result = findBestFreestyleRelay('남', 160);
  const combo3Result = findBestFreestyleRelay('여', 160);

  // Combinations 4 & 5: Medley Relay (혼계영 200m)
  const combo4Result = findBestMedleyRelay('남', 160);
  const combo5Result = findBestMedleyRelay('여', 160);

  return {
    combo1: combo1Result,
    combo2: combo2Result,
    combo3: combo3Result,
    combo4: combo4Result,
    combo5: combo5Result
  };
}

// Format seconds into minutes/seconds display
function formatRelayTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) return '-';
  if (seconds < 60) {
    return `${seconds.toFixed(2)}초`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  const formattedSecs = (seconds % 60) < 10 ? `0${secs}` : `${secs}`;
  return `${mins}분 ${formattedSecs}초 (${seconds.toFixed(2)}s)`;
}

// Update Top Dashboard Combination Panels
function updateStats() {
  const { combo1, combo2, combo3, combo4, combo5 } = calculateRelayCombinations();
  renderComboCard('combo1', combo1, false);
  renderComboCard('combo2', combo2, false);
  renderComboCard('combo3', combo3, false);
  renderComboCard('combo4', combo4, true);
  renderComboCard('combo5', combo5, true);
}

function renderComboCard(prefix, result, isMedley = false) {
  const timeEl = document.getElementById(`${prefix}Time`);
  const ageEl = document.getElementById(`${prefix}Age`);
  const membersEl = document.getElementById(`${prefix}Members`);

  if (!timeEl || !ageEl || !membersEl) return;

  if (!result || result.status !== 'SUCCESS') {
    timeEl.textContent = '-';
    timeEl.classList.remove('time-highlight');
    ageEl.textContent = '-';
    membersEl.innerHTML = `<span class="combo-empty-msg">${result ? result.message : '기록 부족'}</span>`;
    return;
  }

  timeEl.textContent = formatRelayTime(result.totalTime);
  timeEl.classList.add('time-highlight');
  ageEl.textContent = `${result.totalAge}세`;

  membersEl.innerHTML = result.members.map(m => {
    const orig = getLastYearRecord(m.id, m.strokeField);
    const isLastYear = orig !== '' && (parseFloat(orig) === m.time);
    const timeClass = isLastYear ? 'is-last-year' : 'is-target';
    return `
      <div class="member-pill">
        ${isMedley 
          ? `<span class="stroke-badge ${m.strokeName}">${m.strokeName}</span>` 
          : `<span class="member-gender ${m.gender === '남' ? 'male' : 'female'}">${m.gender}</span>`
        }
        <span>${escapeHtml(m.name || '무명')}</span>
        <span style="color:var(--text-subtle);font-size:11px;">(${m.age}세)</span>
        <span class="member-time ${timeClass}">${m.time.toFixed(2)}s</span>
      </div>
    `;
  }).join('');
}

// Input filter: strict number and decimal point validation
function sanitizeNumericInput(val) {
  let clean = val.replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) {
    clean = parts[0] + '.' + parts.slice(1).join('');
  }
  return clean;
}

// Jump from Events view to Records view for a specific swimmer
function jumpToSwimmerPB(id) {
  switchView('records');
  searchQuery = '';
  if (searchInput) searchInput.value = '';
  currentFilter = 'all';
  filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  renderTable();

  setTimeout(() => {
    const row = tableBody.querySelector(`tr[data-id="${id}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.transition = 'background-color 0.4s ease';
      row.style.backgroundColor = '#fef08a';
      setTimeout(() => {
        row.style.backgroundColor = '';
      }, 1500);
    }
  }, 100);
}

// Event Bindings
function bindEvents() {
  // Header View Toggle Buttons
  if (btnToggleRecords) btnToggleRecords.addEventListener('click', () => switchView('records'));
  if (btnToggleEvents) btnToggleEvents.addEventListener('click', () => switchView('events'));

  // Records View Mode (간단히 vs 자세히)
  if (btnRecordsModeSimple) {
    btnRecordsModeSimple.addEventListener('click', () => {
      applyRecordsViewMode('simple');
      localStorage.setItem(RECORDS_MODE_KEY, 'simple');
      showToast('📋 단체전 간단히 보기 모드로 전환되었습니다.');
    });
  }
  if (btnRecordsModeDetailed) {
    btnRecordsModeDetailed.addEventListener('click', () => {
      applyRecordsViewMode('detailed');
      localStorage.setItem(RECORDS_MODE_KEY, 'detailed');
      showToast('📋 단체전 자세히 보기 모드로 전환되었습니다.');
    });
  }

  // Events View Mode (간단히 vs 자세히)
  if (btnModeSimple) {
    btnModeSimple.addEventListener('click', () => {
      applyEventsViewMode('simple');
      localStorage.setItem(EVENTS_MODE_KEY, 'simple');
      showToast('📋 간단히 보기 모드로 전환되었습니다.');
    });
  }
  if (btnModeDetailed) {
    btnModeDetailed.addEventListener('click', () => {
      applyEventsViewMode('detailed');
      localStorage.setItem(EVENTS_MODE_KEY, 'detailed');
      showToast('📋 자세히 보기 모드로 전환되었습니다.');
    });
  }

  // Events Table Dropdown Change Delegation
  if (eventsTableBody) {
    eventsTableBody.addEventListener('focusin', (e) => {
      const target = e.target;
      if (target.classList.contains('event-select')) {
        target.dataset.prevVal = target.value;
      }
    });

    eventsTableBody.addEventListener('change', (e) => {
      const target = e.target;
      if (!target.classList.contains('event-select')) return;

      if (isDeadlineExpired()) {
        showToast('🔒 입력 및 수정 시한이 마감되었습니다.');
        renderEventsTable();
        return;
      }

      const id = parseInt(target.dataset.id, 10);
      const field = target.dataset.field; // 'event1' or 'event2'
      const record = records.find(r => r.id === id);
      if (!record) return;

      const prevVal = target.dataset.prevVal || '';
      const newVal = target.value;

      record[field] = newVal;
      target.classList.toggle('has-event', !!newVal);
      target.dataset.prevVal = newVal;

      // Log to server history
      logChangeHistory('EVENT', record.name, field, field === 'event1' ? '출전 종목 1' : '출전 종목 2', prevVal, newVal);

      // Re-render summary matrices & PB table
      saveData();
      renderSummaryMatrices();
      renderEventsTable();
      renderTable();
      showToast(`'${record.name}'의 ${field === 'event1' ? '종목 1' : '종목 2'}이(가) 변경되었습니다.`);
    });

    // Jump to PB button click delegation
    eventsTableBody.addEventListener('click', (e) => {
      const jumpBtn = e.target.closest('[data-jump-id]');
      if (jumpBtn) {
        const id = parseInt(jumpBtn.dataset.jumpId, 10);
        jumpToSwimmerPB(id);
      }
    });
  }

  // Events Search Input
  if (eventsSearchInput) {
    eventsSearchInput.addEventListener('input', (e) => {
      eventsSearchQuery = e.target.value;
      renderEventsTable();
    });
  }

  // Events Gender Filter Buttons
  eventsFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      eventsFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      eventsGenderFilter = btn.dataset.eventsFilter;
      renderEventsTable();
    });
  });

  // Events Group Filter Dropdown
  if (eventsGroupSelect) {
    eventsGroupSelect.addEventListener('change', (e) => {
      eventsGroupFilter = e.target.value;
      renderEventsTable();
    });
  }

  // PB Table Input Delegation - Remember initial value on focusin
  tableBody.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target.classList.contains('cell-input')) {
      target.dataset.prevVal = target.value;
    }
  });

  tableBody.addEventListener('input', (e) => {
    const target = e.target;
    if (!target.classList.contains('cell-input')) return;

    if (isDeadlineExpired()) {
      e.preventDefault();
      showToast('🔒 입력 및 수정 시한이 마감되었습니다.');
      renderTable();
      return;
    }

    const id = parseInt(target.dataset.id, 10);
    const field = target.dataset.field;
    const record = records.find(r => r.id === id);
    if (!record) return;

    let val = target.value;

    if (STROKE_FIELDS.includes(field)) {
      const sanitized = sanitizeNumericInput(val);
      if (sanitized !== val) {
        target.value = sanitized;
        val = sanitized;
      }

      const lastYearVal = getLastYearRecord(id, field);
      target.classList.remove('is-last-year', 'is-target');
      if (val !== '') {
        if (lastYearVal !== '' && val === lastYearVal) {
          target.classList.add('is-last-year');
          target.title = '작년기록 (파란색)';
        } else {
          target.classList.add('is-target');
          target.title = lastYearVal ? `희망기록 (붉은색, 작년: ${lastYearVal}s)` : '희망기록 (붉은색)';
        }
      } else {
        target.title = '';
      }
    } else if (field === 'age') {
      const sanitized = val.replace(/[^0-9]/g, '');
      if (sanitized !== val) {
        target.value = sanitized;
        val = sanitized;
      }
    }

    if (field !== 'name') {
      record[field] = val;
      saveData();
      updateStats();
    }
  });

  // Focusout / Change handler: Log record change & revert to last year's record if deleted
  tableBody.addEventListener('focusout', (e) => {
    const target = e.target;
    if (!target.classList.contains('cell-input')) return;
    if (isDeadlineExpired()) return;

    const id = parseInt(target.dataset.id, 10);
    const field = target.dataset.field;
    const record = records.find(r => r.id === id);
    if (!record) return;

    const val = target.value.trim();
    const prevVal = (target.dataset.prevVal || '').trim();
    const lastYearVal = getLastYearRecord(id, field);

    // Name field change with explicit user confirmation
    if (field === 'name') {
      if (val !== prevVal) {
        const oldName = prevVal || '무명';
        const newName = val || '(빈값)';
        if (!confirm(`'${oldName}' 회원의 이름을 '${newName}'(으)로 변경하시겠습니까?`)) {
          target.value = prevVal;
          record.name = prevVal;
          target.dataset.prevVal = prevVal;
          renderAll();
          return;
        }
        record.name = val;
        saveData();
        renderAll();
        logChangeHistory('INFO', val || record.name, 'name', '이름', prevVal, val);
        showToast(`'${oldName}' 회원의 이름이 '${newName}'(으)로 변경되었습니다.`);
      }
      target.dataset.prevVal = target.value;
      return;
    }

    const isLastYearDQ = lastYearVal === '99.99' || parseFloat(lastYearVal) >= 99;

    if (val === '' && lastYearVal !== '' && !isLastYearDQ && STROKE_FIELDS.includes(field)) {
      target.value = lastYearVal;
      record[field] = lastYearVal;
      target.classList.remove('is-target');
      target.classList.add('is-last-year');
      target.title = '작년기록 (파란색)';
      saveData();
      updateStats();
      logChangeHistory('RECORD', record.name, field, STROKE_NAMES[field], prevVal, lastYearVal, `${record.name}: ${STROKE_NAMES[field]} 기록 작년 데이터(${lastYearVal}s)로 원복`);
      showToast(`'${record.name || '회원'}'의 ${STROKE_NAMES[field]} 기록이 작년기록(${lastYearVal}s)으로 원복되었습니다.`);
    } else if (val !== prevVal) {
      if (STROKE_FIELDS.includes(field)) {
        logChangeHistory('RECORD', record.name, field, STROKE_NAMES[field], prevVal, val);
      } else if (field === 'age') {
        logChangeHistory('INFO', record.name, 'age', '나이', prevVal, val);
      }
    }

    target.dataset.prevVal = target.value;
  });

  // Real-time beforeinput filter to block non-numeric characters before insertion
  tableBody.addEventListener('beforeinput', (e) => {
    const target = e.target;
    if (!target.classList.contains('cell-input')) return;

    if (isDeadlineExpired()) {
      e.preventDefault();
      showToast('🔒 입력 및 수정 시한이 마감되었습니다.');
      return;
    }

    if (!e.data || e.inputType.startsWith('delete') || e.inputType.startsWith('history')) return;

    if (target.classList.contains('record-input')) {
      if (!/^[0-9.]$/.test(e.data)) {
        e.preventDefault();
      } else if (e.data === '.' && target.value.includes('.')) {
        e.preventDefault();
      }
    } else if (target.classList.contains('age-input')) {
      if (!/^[0-9]$/.test(e.data)) {
        e.preventDefault();
      }
    }
  });

  // Table click events (Gender toggle, Delete button)
  tableBody.addEventListener('click', (e) => {
    const genderBadge = e.target.closest('.gender-badge');
    if (genderBadge) {
      if (isDeadlineExpired()) {
        showToast('🔒 입력 및 수정 시한이 마감되었습니다.');
        return;
      }
      const id = parseInt(genderBadge.dataset.id, 10);
      const record = records.find(r => r.id === id);
      if (record) {
        const oldGender = record.gender || '남';
        const targetGender = oldGender === '남' ? '여' : '남';
        const memberName = record.name ? `'${record.name}'` : '해당';

        if (!confirm(`${memberName} 회원의 성별을 '${targetGender}'(으)로 변경하시겠습니까?`)) {
          return;
        }

        record.gender = targetGender;
        genderBadge.textContent = record.gender;
        genderBadge.className = `gender-badge ${record.gender === '남' ? 'male' : 'female'}`;
        logChangeHistory('INFO', record.name, 'gender', '성별', oldGender, record.gender);
        saveData();
        updateStats();
        renderSummaryMatrices();
        showToast(`${memberName} 회원의 성별이 '${targetGender}'(으)로 변경되었습니다.`);
      }
      return;
    }

    const deleteBtn = e.target.closest('[data-delete-id]');
    if (deleteBtn) {
      if (isDeadlineExpired()) {
        showToast('🔒 입력 및 수정 시한이 마감되었습니다.');
        return;
      }
      const id = parseInt(deleteBtn.dataset.deleteId, 10);
      const record = records.find(r => r.id === id);
      const name = record ? (record.name || '해당 회원') : '해당 회원';
      if (confirm(`'${name}' 회원을 명단에서 삭제하시겠습니까?`)) {
        logChangeHistory('DELETE', name, 'member', '회원', `번호 ${record ? record.id : id} (${record ? record.group : ''})`, '삭제됨');
        records = records.filter(r => r.id !== id);
        saveData();
        renderAll();
        showToast('회원이 삭제되었습니다.');
      }
    }
  });

  // Keyboard navigation across cells
  tableBody.addEventListener('keydown', handleKeyNavigation);

  // Paste from Excel / TSV
  tableBody.addEventListener('paste', handleTablePaste);

  // Search input in PB table
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTable();
  });

  // Filter Buttons in PB table
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTable();
    });
  });

  // Add Row Button (If element exists)
  if (btnAddRow) {
    btnAddRow.addEventListener('click', () => {
      if (isDeadlineExpired()) {
        showToast('🔒 신규 회원 등록 시한이 마감되었습니다.');
        return;
      }

      const newId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
      const newRecord = {
        id: newId,
        age: '',
        group: '1그룹',
        gender: '남',
        name: '',
        birthId: '',
        event1: '',
        event2: '',
        finFly: '',
        finFree: '',
        free: '',
        back: '',
        breast: '',
        fly: ''
      };
      records.push(newRecord);
      logChangeHistory('MEMBER', `새 회원 (번호 ${newId})`, 'member', '회원', '', `번호 ${newId} 등록`);
      saveData();
      renderAll();

      setTimeout(() => {
        const newInputs = tableBody.querySelectorAll(`input[data-id="${newId}"]`);
        if (newInputs.length > 1) {
          newInputs[1].focus();
        }
      }, 50);

      showToast('새 회원이 추가되었습니다.');
    });
  }

  // Panel Pin Buttons (Synchronized across all panels)
  document.querySelectorAll('.btn-panel-pin').forEach(btn => {
    btn.addEventListener('click', () => {
      isStickyPinned = !isStickyPinned;
      applyStickyState(isStickyPinned);
      localStorage.setItem(STICKY_STORAGE_KEY, isStickyPinned ? '1' : '0');
      showToast(isStickyPinned ? '📌 상단 조합 패널이 고정되었습니다.' : '🔓 상단 조합 패널 고정이 해제되었습니다.');
    });
  });

  // Export CSV Button (Save Icon)
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', exportToCsv);
  }

  // Copy TSV Button for Excel (Copy Icon)
  if (btnCopyTsv) {
    btnCopyTsv.addEventListener('click', copyToClipboardTsv);
  }

  // Column Header Sorting
  document.querySelectorAll('.record-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortColumn === col) {
        if (sortDirection === 'asc') {
          sortDirection = 'desc';
        } else {
          sortColumn = null;
          sortDirection = 'asc';
        }
      } else {
        sortColumn = col;
        sortDirection = 'asc';
      }

      document.querySelectorAll('.record-table th').forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      if (sortColumn) {
        th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
      }

      renderTable();
    });
  });
}

// Keyboard Navigation (Spreadsheet-like behavior)
function handleKeyNavigation(e) {
  const target = e.target;
  if (!target.classList.contains('cell-input')) return;

  const currentTr = target.closest('tr');
  const allInputsInRow = Array.from(currentTr.querySelectorAll('.cell-input'));
  const colIndexInRow = allInputsInRow.indexOf(target);

  const allRows = Array.from(tableBody.querySelectorAll('tr'));
  const rowIndex = allRows.indexOf(currentTr);

  if (e.key === 'ArrowDown' || e.key === 'Enter') {
    e.preventDefault();
    if (rowIndex < allRows.length - 1) {
      const nextRowInputs = allRows[rowIndex + 1].querySelectorAll('.cell-input');
      if (nextRowInputs[colIndexInRow]) {
        nextRowInputs[colIndexInRow].focus();
        nextRowInputs[colIndexInRow].select();
      }
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (rowIndex > 0) {
      const prevRowInputs = allRows[rowIndex - 1].querySelectorAll('.cell-input');
      if (prevRowInputs[colIndexInRow]) {
        prevRowInputs[colIndexInRow].focus();
        prevRowInputs[colIndexInRow].select();
      }
    }
  } else if (e.key === 'ArrowRight' && target.selectionEnd === target.value.length) {
    if (colIndexInRow < allInputsInRow.length - 1) {
      allInputsInRow[colIndexInRow + 1].focus();
      allInputsInRow[colIndexInRow + 1].select();
      e.preventDefault();
    }
  } else if (e.key === 'ArrowLeft' && target.selectionStart === 0) {
    if (colIndexInRow > 0) {
      allInputsInRow[colIndexInRow - 1].focus();
      allInputsInRow[colIndexInRow - 1].select();
      e.preventDefault();
    }
  }
}

// Paste Grid Support (Excel copy & paste)
function handleTablePaste(e) {
  const target = e.target;
  if (!target.classList.contains('cell-input')) return;

  if (isDeadlineExpired()) {
    e.preventDefault();
    showToast('🔒 입력 및 수정 시한이 마감되었습니다.');
    return;
  }

  const clipboardData = e.clipboardData || window.clipboardData;
  const pastedText = clipboardData.getData('text');
  if (!pastedText || (!pastedText.includes('\t') && !pastedText.includes('\n'))) {
    return;
  }

  e.preventDefault();
  const rowsData = pastedText.trim().split(/\r\n|\r|\n/).map(row => row.split('\t'));
  const currentTr = target.closest('tr');
  const allInputsInRow = Array.from(currentTr.querySelectorAll('.cell-input'));
  const startColIndex = allInputsInRow.indexOf(target);
  const allRows = Array.from(tableBody.querySelectorAll('tr'));
  const startRowIndex = allRows.indexOf(currentTr);

  rowsData.forEach((rowValues, rOffset) => {
    const targetRow = allRows[startRowIndex + rOffset];
    if (!targetRow) return;

    const rowInputs = Array.from(targetRow.querySelectorAll('.cell-input'));
    const rowId = parseInt(targetRow.dataset.id, 10);
    const record = records.find(r => r.id === rowId);
    if (!record) return;

    rowValues.forEach((cellVal, cOffset) => {
      const targetInput = rowInputs[startColIndex + cOffset];
      if (!targetInput) return;

      const field = targetInput.dataset.field;
      let val = cellVal.trim();

      if (STROKE_FIELDS.includes(field)) {
        val = sanitizeNumericInput(val);
      } else if (field === 'age') {
        val = val.replace(/[^0-9]/g, '');
      }

      record[field] = val;
      targetInput.value = val;
    });
  });

  saveData();
  renderAll();
  showToast('엑셀 데이터가 표에 적용되었습니다.');
}

// Copy to Clipboard as TSV (Records only, Exclude Table Headers)
function copyToClipboardTsv() {
  let rows;
  if (currentView === 'events') {
    rows = records.map(r => [
      r.id,
      r.group || '',
      r.gender || '',
      r.name || '',
      r.birthId || '',
      r.event1 || '',
      r.event2 || ''
    ]);
  } else {
    rows = records.map(r => [
      r.id,
      r.group || '',
      r.age || '',
      r.gender || '',
      r.name || '',
      r.finFly || '',
      r.finFree || '',
      r.free || '',
      r.back || '',
      r.breast || '',
      r.fly || '',
      r.event1 || '',
      r.event2 || ''
    ]);
  }

  // Exclude table headers, only copy record data rows
  const tsv = rows.map(row => row.join('\t')).join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tsv).then(() => {
      showToast(`📋 레코드 데이터(${rows.length}명, 헤더 제외)가 복사되었습니다. 엑셀에 붙여넣기(Ctrl+V)하세요!`);
    }).catch(() => {
      fallbackCopy(tsv, rows.length);
    });
  } else {
    fallbackCopy(tsv, rows.length);
  }
}

function fallbackCopy(text, count) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showToast(`📋 레코드 데이터(${count || ''}명, 헤더 제외)가 복사되었습니다. 엑셀에 붙여넣기(Ctrl+V)하세요!`);
}

// Export to CSV with UTF-8 BOM
function exportToCsv() {
  const headers = ['번호', '그룹', '성별', '이름', '생년월일(식별코드)', '출전 종목 1', '출전 종목 2', '나이', '핀접영', '핀자유', '자유형', '배영', '평영', '접영'];
  const rows = records.map(r => [
    `"${r.id}"`,
    `"${r.group || ''}"`,
    `"${r.gender || ''}"`,
    `"${(r.name || '').replace(/"/g, '""')}"`,
    `"${r.birthId || ''}"`,
    `"${r.event1 || ''}"`,
    `"${r.event2 || ''}"`,
    `"${r.age || ''}"`,
    `"${r.finFly || ''}"`,
    `"${r.finFree || ''}"`,
    `"${r.free || ''}"`,
    `"${r.back || ''}"`,
    `"${r.breast || ''}"`,
    `"${r.fly || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `수영기록및출전현황_2026-01-01.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('💾 CSV 파일이 다운로드되었습니다.');
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Run on page load
document.addEventListener('DOMContentLoaded', init);
