import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// Firebase Configuration (Shared Project)
const firebaseConfig = {
  projectId: "gmdc-swim-records"
};

let app, db, DOC_REF;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  DOC_REF = doc(db, "gmdc_swim_club", "records_student_2026_01_01");
} catch (err) {
  console.error("Firebase 초기화 에러:", err);
}

const APP_VERSION = 'v2026.08.17.4_student';
let isScenarioMode = false;
let isInitialSyncCompleted = false;
let serverRecordsCache = null;

const STORAGE_KEY = 'gmdc_student_records_v1';
const STICKY_STORAGE_KEY = 'gmdc_student_pinned_card_id';
const MODAL_STORAGE_KEY = 'gmdc_student_hide_notice_modal_date';
const EVENTS_MODE_KEY = 'gmdc_student_events_view_mode';
const RECORDS_MODE_KEY = 'gmdc_student_records_view_mode';

// Deadline Configuration: 8월 17일(월) 18:00:00 KST
const DEADLINE_ISO = '2026-08-17T18:00:00+09:00';
const DEADLINE = new Date(DEADLINE_ISO);

const STROKE_FIELDS = ['free', 'back', 'breast', 'fly'];
const STROKE_NAMES = {
  free: '자유형',
  back: '배영',
  breast: '평영',
  fly: '접영'
};

const GROUPS = ['1그룹', '2그룹', '3그룹', '4그룹', '5그룹', '6그룹', '7그룹'];

// 2025년 학생부 출전자 분포 데이터 (작년 비교용)
const PREV_YEAR_STUDENT_DISTRIBUTION = {
  '남': {
    '1그룹': { '자유형': 8, '배영': 2, '평영': 4, '접영': 3, total: 17 },
    '2그룹': { '자유형': 16, '배영': 7, '평영': 11, '접영': 6, total: 40 },
    '3그룹': { '자유형': 22, '배영': 10, '평영': 12, '접영': 12, total: 56 },
    '4그룹': { '자유형': 27, '배영': 10, '평영': 12, '접영': 15, total: 64 },
    '5그룹': { '자유형': 22, '배영': 9, '평영': 11, '접영': 11, total: 53 },
    '6그룹': { '자유형': 9, '배영': 3, '평영': 5, '접영': 3, total: 20 },
    '7그룹': { '자유형': 8, '배영': 2, '평영': 5, '접영': 5, total: 20 },
  },
  '여': {
    '1그룹': { '자유형': 5, '배영': 3, '평영': 2, '접영': 4, total: 14 },
    '2그룹': { '자유형': 9, '배영': 5, '평영': 7, '접영': 4, total: 25 },
    '3그룹': { '자유형': 28, '배영': 13, '평영': 17, '접영': 6, total: 64 },
    '4그룹': { '자유형': 17, '배영': 14, '평영': 13, '접영': 13, total: 57 },
    '5그룹': { '자유형': 18, '배영': 9, '평영': 8, '접영': 11, total: 46 },
    '6그룹': { '자유형': 7, '배영': 5, '평영': 6, '접영': 2, total: 20 },
    '7그룹': { '자유형': 3, '배영': 3, '평영': 1, '접영': 5, total: 12 },
  }
};

let isMatrixCompareMode = localStorage.getItem('gmdc_student_matrix_compare_mode') === 'true';

// 2025년 학생부 각 그룹별/성별/영법별 1, 2, 3위 입상 기록
const PREV_YEAR_STUDENT_PODIUM = {
  '남': {
    '1그룹': {
      '자유형': ['47.16', '53.70', '56.01'],
      '배영': ['84.31', '90.49'],
      '평영': ['69.75', '74.00', '82.11'],
      '접영': ['55.44', '66.69', '79.07']
    },
    '2그룹': {
      '자유형': ['45.44', '47.81', '49.09'],
      '배영': ['58.99', '62.56', '70.40'],
      '평영': ['52.90', '56.66', '57.95'],
      '접영': ['48.00', '50.02', '50.80']
    },
    '3그룹': {
      '자유형': ['38.27', '39.22', '40.57'],
      '배영': ['50.67', '53.06', '53.29'],
      '평영': ['46.73', '47.18', '52.99'],
      '접영': ['34.48', '43.66', '44.90']
    },
    '4그룹': {
      '자유형': ['37.00', '38.22', '39.41'],
      '배영': ['44.40', '45.20', '48.00'],
      '평영': ['47.35', '47.43', '53.16'],
      '접영': ['39.79', '40.07', '44.89']
    },
    '5그룹': {
      '자유형': ['35.84', '36.25', '36.97'],
      '배영': ['41.79', '42.01', '42.35'],
      '평영': ['46.66', '47.42', '47.60'],
      '접영': ['39.96', '40.16', '41.19']
    },
    '6그룹': {
      '자유형': ['31.56', '32.73', '33.39'],
      '배영': ['38.75', '49.15', '66.72'],
      '평영': ['41.91', '46.68', '48.31'],
      '접영': ['36.25', '40.56', '58.90']
    },
    '7그룹': {
      '자유형': ['26.29', '27.23', '29.11'],
      '배영': ['51.02', '54.64'],
      '평영': ['37.81', '40.34', '47.25'],
      '접영': ['29.08', '30.21', '31.94']
    }
  },
  '여': {
    '1그룹': {
      '자유형': ['65.16', '69.22', '82.22'],
      '배영': ['64.44', '64.75'],
      '평영': ['67.76', '77.51'],
      '접영': ['67.38', '67.77', '83.20']
    },
    '2그룹': {
      '자유형': ['42.14', '43.80', '48.06'],
      '배영': ['47.73', '53.22', '54.15'],
      '평영': ['61.82', '62.67', '63.69'],
      '접영': ['62.08', '72.73', '95.82']
    },
    '3그룹': {
      '자유형': ['40.00', '41.23', '42.00'],
      '배영': ['41.06', '46.93', '47.95'],
      '평영': ['49.90', '54.24', '55.75'],
      '접영': ['55.23', '56.07', '57.25']
    },
    '4그룹': {
      '자유형': ['35.69', '36.69', '39.51'],
      '배영': ['43.55', '45.20', '47.71'],
      '평영': ['43.00', '46.20', '52.28'],
      '접영': ['39.53', '40.75', '44.67']
    },
    '5그룹': {
      '자유형': ['34.52', '35.34', '36.15'],
      '배영': ['39.30', '43.69', '44.78'],
      '평영': ['44.06', '47.59', '49.27'],
      '접영': ['41.21', '42.80', '43.17']
    },
    '6그룹': {
      '자유형': ['33.88', '36.45', '36.56'],
      '배영': ['43.25', '49.23', '51.24'],
      '평영': ['38.23', '42.99', '47.38'],
      '접영': ['46.75', '54.88']
    },
    '7그룹': {
      '자유형': ['36.60', '38.03', '47.00'],
      '배영': ['38.24', '45.58', '58.63'],
      '평영': ['52.16'],
      '접영': ['35.10', '42.67', '44.06']
    }
  }
};

function formatPodiumTooltip(gender, group, stroke) {
  let strokeKey = stroke;
  if (stroke === 'free' || stroke === '자유형 50') strokeKey = '자유형';
  else if (stroke === 'back' || stroke === '배영 50') strokeKey = '배영';
  else if (stroke === 'breast' || stroke === '평영 50') strokeKey = '평영';
  else if (stroke === 'fly' || stroke === '접영 50') strokeKey = '접영';

  const groupData = PREV_YEAR_STUDENT_PODIUM[gender]?.[group];
  if (!groupData) return '';
  const podiumList = groupData[strokeKey];
  if (!podiumList || podiumList.length === 0) return '';

  const medals = ['🥇1위', '🥈2위', '🥉3위'];
  const podiumStr = podiumList.map((time, idx) => `${medals[idx]} ${time}s`).join(' | ');

  return `[작년 ${group} ${gender === '남' ? '남학생' : '여학생'} ${strokeKey} 입상기록] ${podiumStr}`;
}

function getPodiumShort(gender, group, stroke) {
  let strokeKey = stroke;
  if (stroke === 'free' || stroke === '자유형 50') strokeKey = '자유형';
  else if (stroke === 'back' || stroke === '배영 50') strokeKey = '배영';
  else if (stroke === 'breast' || stroke === '평영 50') strokeKey = '평영';
  else if (stroke === 'fly' || stroke === '접영 50') strokeKey = '접영';

  const groupData = PREV_YEAR_STUDENT_PODIUM[gender]?.[group];
  if (!groupData) return '';
  const podiumList = groupData[strokeKey];
  if (!podiumList || podiumList.length === 0) return '';

  return podiumList.map((time, idx) => `${idx + 1}위 ${time}`).join(' | ');
}

function getPodiumData(gender, group, stroke) {
  let strokeKey = stroke;
  if (stroke === 'free' || stroke === '자유형 50') strokeKey = '자유형';
  else if (stroke === 'back' || stroke === '배영 50') strokeKey = '배영';
  else if (stroke === 'breast' || stroke === '평영 50') strokeKey = '평영';
  else if (stroke === 'fly' || stroke === '접영 50') strokeKey = '접영';

  const groupData = PREV_YEAR_STUDENT_PODIUM[gender]?.[group];
  if (!groupData) return null;
  return groupData[strokeKey] || null;
}

// Initial 19 Student Swimmer Records
const DEFAULT_STUDENT_RECORDS = [
  { id: 1, age: '7', group: '2그룹', gender: '남', name: '배건우', birthId: '20181207-3', event1: '', event2: '', phone: '010-9729-3224', club: 'GMDC', address: '거제시 고현항2로 51 유로스카이 206동 1804호', free: '', back: '', breast: '', fly: '' },
  { id: 2, age: '8', group: '3그룹', gender: '남', name: '김예준', birthId: '20170519-3', event1: '자유형 50', event2: '평영 50', phone: '010-4779-4105', club: 'GMDC', address: '거제시 상동 대동다숲 112동 201호', free: '', back: '', breast: '', fly: '' },
  { id: 3, age: '8', group: '3그룹', gender: '남', name: '한고준', birthId: '20171019-3', event1: '자유형 50', event2: '평영 50', phone: '010-2541-1426', club: 'GMDC', address: '거제시 상동5길46 104동 602호', free: '', back: '', breast: '', fly: '' },
  { id: 4, age: '9', group: '4그룹', gender: '남', name: '손민재', birthId: '20160616-3', event1: '', event2: '', phone: '010-7142-8269', club: 'GMDC', address: '거제시 고현항2로51 207동 3002호', free: '', back: '', breast: '', fly: '' },
  { id: 5, age: '9', group: '4그룹', gender: '여', name: '이유빈', birthId: '20160308-4', event1: '자유형 50', event2: '배영 50', phone: '010-4101-8171', club: 'GMDC', address: '거제시 사등면 두동로54-40 영진 201동 1505호', free: '', back: '', breast: '', fly: '' },
  { id: 6, age: '10', group: '5그룹', gender: '남', name: '양서진', birthId: '20151030-3', event1: '', event2: '', phone: '010-4252-4589', club: 'GMDC', address: '거제시 장평2로19 103동 402호', free: '', back: '', breast: '', fly: '' },
  { id: 7, age: '10', group: '5그룹', gender: '남', name: '이우리', birthId: '20150603-3', event1: '자유형 50', event2: '배영 50', phone: '010-4337-7471', club: 'GMDC', address: '거제시 거제면 두동로259-90 오션파크자이 111동 504호', free: '', back: '', breast: '', fly: '' },
  { id: 8, age: '10', group: '5그룹', gender: '여', name: '김서윤', birthId: '20150115-4', event1: '자유형 50', event2: '평영 50', phone: '010-9822-2363', club: 'GMDC', address: '거제시 옥포로315-2 6동 102호', free: '', back: '', breast: '', fly: '' },
  { id: 9, age: '10', group: '5그룹', gender: '여', name: '류다윤', birthId: '20151002-4', event1: '자유형 50', event2: '평영 50', phone: '010-8738-1436', club: 'GMDC', address: '거제시 옥포로315-2 성은아파트 103동 302호', free: '', back: '', breast: '', fly: '' },
  { id: 10, age: '10', group: '5그룹', gender: '여', name: '이나라', birthId: '20150603-4', event1: '자유형 50', event2: '배영 50', phone: '010-4337-7471', club: 'GMDC', address: '거제시 거제면 두동로259-90 오션파크자이 111동 504호', free: '', back: '', breast: '', fly: '' },
  { id: 11, age: '10', group: '5그룹', gender: '여', name: '이은서', birthId: '20150915-4', event1: '배영 50', event2: '접영 50', phone: '010-8266-4030', club: 'GMDC', address: '거제시 마전5길8-2 영승한마음 101호', free: '', back: '', breast: '', fly: '' },
  { id: 12, age: '10', group: '5그룹', gender: '여', name: '지혜람', birthId: '20150108-4', event1: '자유형 50', event2: '배영 50', phone: '010-4592-9948', club: 'GMDC', address: '거제시 사등면 두동로54-40 영진 201동 206호', free: '', back: '', breast: '', fly: '' },
  { id: 13, age: '10', group: '5그룹', gender: '여', name: '한예진', birthId: '20150316-4', event1: '자유형 50', event2: '평영 50', phone: '010-5048-8145', club: 'GMDC', address: '거제시 성산로42 201동 503호', free: '', back: '', breast: '', fly: '' },
  { id: 14, age: '11', group: '6그룹', gender: '남', name: '김루민', birthId: '20140724-3', event1: '자유형 50', event2: '배영 50', phone: '010-6677-7875', club: 'GMDC', address: '거제시 옥포대첩로4길 40 라이4층', free: '', back: '', breast: '', fly: '' },
  { id: 15, age: '11', group: '6그룹', gender: '남', name: '오태훈', birthId: '20141109-3', event1: '자유형 50', event2: '평영 50', phone: '010-4872-4910', club: 'GMDC', address: '거제시 아주2로138 106동 1305호', free: '', back: '', breast: '', fly: '' },
  { id: 16, age: '14', group: '7그룹', gender: '남', name: '박현민', birthId: '20110608-3', event1: '평영 50', event2: '접영 50', phone: '010-4447-5186', club: 'GMDC', address: '거제시 마전5길8-2 영승한마음 710호', free: '', back: '', breast: '', fly: '' },
  { id: 17, age: '12', group: '7그룹', gender: '남', name: '이선우', birthId: '20130829-3', event1: '자유형 50', event2: '배영 50', phone: '010-4101-8171', club: 'GMDC', address: '거제시 사등면 두동로54-40 영진 201동 1505호', free: '', back: '', breast: '', fly: '' },
  { id: 18, age: '12', group: '7그룹', gender: '여', name: '안서윤', birthId: '20130806-4', event1: '자유형 50', event2: '배영 50', phone: '010-4005-7171', club: 'GMDC', address: '거제시 아주2로138 102동 1801호', free: '', back: '', breast: '', fly: '' },
  { id: 19, age: '13', group: '7그룹', gender: '여', name: '정채윤', birthId: '20120321-4', event1: '자유형 50', event2: '평영 50', phone: '010-8312-5384', club: 'GMDC', address: '거제시 장평1로86 B동 204호', free: '', back: '', breast: '', fly: '' }
];

const LAST_YEAR_MAP = {};
DEFAULT_STUDENT_RECORDS.forEach(d => {
  LAST_YEAR_MAP[d.id] = {
    free: d.free || '',
    back: d.back || '',
    breast: d.breast || '',
    fly: d.fly || ''
  };
});

function getLastYearRecord(id, field) {
  return (LAST_YEAR_MAP[id] && LAST_YEAR_MAP[id][field]) ? LAST_YEAR_MAP[id][field] : '';
}

let records = [];
let sortCol = 'no';
let sortAsc = true;
let currentFilter = 'all';
let currentEventsFilter = 'all';
let currentEventsGroup = 'all';
let searchQuery = '';
let eventsSearchQuery = '';
let currentView = 'records';
let eventsViewMode = 'simple';
let recordsViewMode = 'simple';
let pinnedComboCardId = null; // 고정된 조합 카드 ID (최대 1개)
let saveTimeout = null;

// DOM Elements
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');
const toast = document.getElementById('toast');
const saveStatus = document.getElementById('saveStatus');
const saveStatusText = document.getElementById('saveStatusText');
const btnExportCsv = document.getElementById('btnExportCsv');
const btnCopyTsv = document.getElementById('btnCopyTsv');
const btnToggleRecords = document.getElementById('btnToggleRecords');
const btnToggleEvents = document.getElementById('btnToggleEvents');
const viewRecords = document.getElementById('viewRecords');
const viewEvents = document.getElementById('viewEvents');
const comboGrid = document.getElementById('comboGrid');
const recordTable = document.getElementById('recordTable');
const eventsDetailTable = document.getElementById('eventsDetailTable');
const btnModeSimple = document.getElementById('btnModeSimple');
const btnModeDetailed = document.getElementById('btnModeDetailed');
const btnRecordsModeSimple = document.getElementById('btnRecordsModeSimple');
const btnRecordsModeDetailed = document.getElementById('btnRecordsModeDetailed');
const btnScenarioMode = document.getElementById('btnScenarioMode');

const combo1Time = document.getElementById('combo1Time');
const combo1Age = document.getElementById('combo1Age');
const combo1Members = document.getElementById('combo1Members');
const combo2Time = document.getElementById('combo2Time');
const combo2Age = document.getElementById('combo2Age');
const combo2Members = document.getElementById('combo2Members');
const combo3Time = document.getElementById('combo3Time');
const combo3Age = document.getElementById('combo3Age');
const combo3Members = document.getElementById('combo3Members');
const combo4Time = document.getElementById('combo4Time');
const combo4Age = document.getElementById('combo4Age');
const combo4Members = document.getElementById('combo4Members');

const maleMatrixBody = document.getElementById('maleMatrixBody');
const maleMatrixFoot = document.getElementById('maleMatrixFoot');
const femaleMatrixBody = document.getElementById('femaleMatrixBody');
const femaleMatrixFoot = document.getElementById('femaleMatrixFoot');

const eventsSearchInput = document.getElementById('eventsSearchInput');
const eventsFilterBtns = document.querySelectorAll('.events-filter-btn');
const eventsGroupSelect = document.getElementById('eventsGroupSelect');
const eventsTableBody = document.getElementById('eventsTableBody');
const eventsFilteredCount = document.getElementById('eventsFilteredCount');

function init() {
  window.__GMDC_VERSION__ = APP_VERSION;
  console.log(`%c[GMDC Swim Students] App Version: ${APP_VERSION}`, 'color: #0284c7; font-weight: bold; font-size: 12px;');
  initStickyPreference();
  initNoticeModal();
  initAuditModal();
  initRulesModal();
  initScenarioMode();
  initMatrixCompareMode();
  initRecordsViewMode();
  initEventsViewMode();
  initDeadlineCountdown();
  loadLocalData();
  bindEvents();
  handleUrlRouting();
  renderAll();
  initFirebaseSync();
}

function isDeadlineExpired() {
  return false;
}

function initDeadlineCountdown() {
  const badge = document.getElementById('tableDateBadge');
  if (!badge) return;

  badge.innerHTML = `기준일: 2026-01-01`;
  badge.title = '기준일: 2026-01-01';
}

function initNoticeModal() {
  const modal = document.getElementById('noticeModal');
  const btnCloseX = document.getElementById('btnModalCloseX');
  const btnConfirm = document.getElementById('btnModalConfirm');
  const chkHideToday = document.getElementById('chkHideToday');
  const dateBadge = document.getElementById('tableDateBadge');

  if (!modal) return;

  const hideDate = localStorage.getItem(MODAL_STORAGE_KEY);
  const todayStr = new Date().toISOString().slice(0, 10);

  if (hideDate !== todayStr) {
    modal.classList.add('show');
  }

  function closeModal() {
    if (chkHideToday && chkHideToday.checked) {
      localStorage.setItem(MODAL_STORAGE_KEY, todayStr);
    }
    modal.classList.remove('show');
  }

  if (btnCloseX) btnCloseX.addEventListener('click', closeModal);
  if (btnConfirm) btnConfirm.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (dateBadge) {
    dateBadge.addEventListener('click', () => {
      modal.classList.add('show');
    });
  }
}

function initScenarioMode() {
  isScenarioMode = false;
  updateScenarioModeUI();

  if (btnScenarioMode) {
    btnScenarioMode.addEventListener('click', toggleScenarioMode);
  }
}

function toggleScenarioMode() {
  if (!isScenarioMode) {
    isScenarioMode = true;
    updateScenarioModeUI();
    alert('🧪 [시나리오 모드 ON]\n서버에 업로드하지 않고, 입력 결과를 가상으로 테스트합니다.\n(상단 최적 계영 조합 및 통계를 마음껏 테스트해보세요.)');
    showToast('🧪 시나리오 모드가 켜졌습니다. (서버 저장 차단)');
  } else {
    const doRevert = confirm('서버값으로 되돌립니다.\n시나리오 모드 중에 변경한 테스트 데이터를 취소하고 원래 서버 데이터로 복구하시겠습니까?');
    if (doRevert) {
      isScenarioMode = false;
      if (serverRecordsCache) {
        records = JSON.parse(JSON.stringify(serverRecordsCache));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        } catch (e) {}
      } else {
        records = JSON.parse(JSON.stringify(DEFAULT_STUDENT_RECORDS));
      }
      renderAll();
      updateScenarioModeUI();
      showToast('🔄 서버 데이터로 안전하게 복구되었습니다.');
    }
  }
}

function updateScenarioModeUI() {
  if (!btnScenarioMode) return;
  if (isScenarioMode) {
    btnScenarioMode.classList.add('active');
    btnScenarioMode.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 2v7.31"></path><path d="M14 9.3V1.99"></path><path d="M8.5 2h7"></path><path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path><path d="M5.52 16h12.96"></path></svg>
      <span>🧪 시나리오 ON</span>
    `;
    if (saveStatus) {
      saveStatus.classList.add('is-scenario');
      if (saveStatusText) saveStatusText.innerHTML = `<span>🧪 시나리오 가상 테스트 중 (서버 미업로드)</span>`;
    }
  } else {
    btnScenarioMode.classList.remove('active');
    btnScenarioMode.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.31"></path><path d="M14 9.3V1.99"></path><path d="M8.5 2h7"></path><path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path><path d="M5.52 16h12.96"></path></svg>
      <span>시나리오 OFF</span>
    `;
    if (saveStatus) {
      saveStatus.classList.remove('is-scenario');
      if (saveStatusText) saveStatusText.innerHTML = `<span class="status-dot"></span><span>자동 저장 활성화</span>`;
    }
  }
}

const HISTORY_COL_NAME = "gmdc_swim_history_student";

function initAuditModal() {
  const btnAudit = document.getElementById('btnAuditHistory');
  const modal = document.getElementById('auditModal');
  const btnCloseX = document.getElementById('btnAuditModalCloseX');
  const btnConfirm = document.getElementById('btnAuditModalConfirm');

  if (btnAudit) {
    btnAudit.addEventListener('click', openAuditModal);
  }
  if (btnCloseX) btnCloseX.addEventListener('click', closeAuditModal);
  if (btnConfirm) btnConfirm.addEventListener('click', closeAuditModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAuditModal();
    });
  }
}

async function openAuditModal() {
  const modal = document.getElementById('auditModal');
  const body = document.getElementById('auditModalBody');
  const tsSpan = document.getElementById('auditModalTimestamp');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align:center; padding:35px 20px; color:var(--text-muted);">
      <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
      <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">학생부 히스토리 데이터 정합성 검증 중...</div>
      <div style="font-size: 13px;">클라우드 히스토리 로그 전체를 재현하여 현재 기록과 비교 분석합니다.</div>
    </div>
  `;
  modal.classList.add('show');

  setTimeout(async () => {
    const result = await compareHistoryWithCurrentRecords();
    if (tsSpan) tsSpan.textContent = `검증 시각: ${new Date().toLocaleTimeString('ko-KR')}`;

    if (!result.success) {
      body.innerHTML = `
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:18px; color:#991b1b;">
          <div style="font-weight:800; margin-bottom:6px;">⚠️ 검증 실패</div>
          <div style="font-size:13px;">${escapeHtml(result.error || result.reason || '알 수 없는 오류가 발생했습니다.')}</div>
        </div>
      `;
      return;
    }

    if (result.isPerfectMatch) {
      body.innerHTML = `
        <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:20px; text-align:center; margin-bottom:16px;">
          <div style="font-size:32px; margin-bottom:8px;">🎯</div>
          <div style="color:#065f46; font-weight:800; font-size:17px; margin-bottom:6px;">
            데이터 정합성 100% 완벽 일치!
          </div>
          <p style="color:#047857; font-size:13px; margin-bottom:12px; line-height:1.5;">
            학생부 히스토리 로그 <strong>${result.totalLogs}건</strong>을 누적 재현한 결과와<br/>
            현재 화면/서버에 로딩된 기록(총 ${result.totalFieldChecks}개 필드)이 <strong>단 하나의 오차 없이 100% 완벽하게 일치</strong>합니다.
          </p>
          <div style="display:inline-flex; gap:16px; background:#fff; padding:8px 16px; border-radius:8px; border:1px solid #d1fae5; font-size:12px; font-weight:700; color:#065f46;">
            <span>처리된 히스토리: ${result.totalLogs}건</span>
            <span>일치율: 100.0%</span>
            <span>불일치: 0건</span>
          </div>
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
            히스토리 로그 재현 결과와 현재 서버/로컬 로딩 데이터 간에 일부 차이가 있습니다. 아래 목록을 확인하고 필요 시 <strong>[히스토리 데이터로 일괄 복구]</strong>를 진행할 수 있습니다.
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
          if (confirm(`히스토리에 기록된 ${result.discrepancyCount}건의 변경 내역을 현재 학생부 서버 데이터에 완벽하게 복구하시겠습니까?`)) {
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

    let replayed = JSON.parse(JSON.stringify(DEFAULT_STUDENT_RECORDS));

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
            group: '2그룹',
            gender: '남',
            name: swimmerName,
            birthId: '',
            event1: '',
            event2: '',
            phone: '',
            club: 'GMDC',
            address: '',
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

    const currentList = serverRecordsCache || records;
    const discrepancies = [];
    const fieldsToCheck = ['group', 'age', 'gender', 'name', 'event1', 'event2', 'free', 'back', 'breast', 'fly'];

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

    console.group(`🔍 [GMDC 학생부] 히스토리 기반 데이터 정합성 검증 (${new Date().toLocaleTimeString('ko-KR')})`);
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
    console.error('학생부 히스토리 검증 중 오류 발생:', err);
    return { success: false, error: err.message || err };
  }
}

function initRecordsViewMode() {
  const saved = localStorage.getItem(RECORDS_MODE_KEY);
  recordsViewMode = (saved === 'detailed') ? 'detailed' : 'simple';
  applyRecordsViewMode(recordsViewMode);
}

function applyRecordsViewMode(mode) {
  recordsViewMode = mode;
  if (btnRecordsModeSimple) btnRecordsModeSimple.classList.toggle('active', mode === 'simple');
  if (btnRecordsModeDetailed) btnRecordsModeDetailed.classList.toggle('active', mode === 'detailed');
  if (recordTable) recordTable.classList.toggle('is-simple', mode === 'simple');
  try {
    localStorage.setItem(RECORDS_MODE_KEY, mode);
  } catch (e) {}
}

function initEventsViewMode() {
  const saved = localStorage.getItem(EVENTS_MODE_KEY);
  eventsViewMode = (saved === 'detailed') ? 'detailed' : 'simple';
  applyEventsViewMode(eventsViewMode);
}

function applyEventsViewMode(mode) {
  eventsViewMode = mode;
  if (btnModeSimple) btnModeSimple.classList.toggle('active', mode === 'simple');
  if (btnModeDetailed) btnModeDetailed.classList.toggle('active', mode === 'detailed');
  if (eventsDetailTable) eventsDetailTable.classList.toggle('is-simple', mode === 'simple');
  try {
    localStorage.setItem(EVENTS_MODE_KEY, mode);
  } catch (e) {}
}

function initStickyPreference() {
  const savedCardId = localStorage.getItem(STICKY_STORAGE_KEY);
  if (savedCardId && document.getElementById(savedCardId)) {
    applySinglePinnedCard(savedCardId);
  } else {
    applySinglePinnedCard(null);
  }
}

function applySinglePinnedCard(cardId) {
  pinnedComboCardId = cardId;
  const cards = document.querySelectorAll('.combo-card');
  const hasPin = Boolean(cardId);

  if (comboGrid) {
    comboGrid.classList.toggle('is-pinned', hasPin);
    comboGrid.classList.toggle('is-sticky', hasPin);
    comboGrid.classList.toggle('has-single-pinned', hasPin);
  }

  cards.forEach(card => {
    const pinBtn = card.querySelector('.btn-panel-pin');
    const isThisCard = card.id === cardId;

    if (!hasPin) {
      card.classList.remove('is-hidden-by-pin', 'is-pinned-card');
      if (pinBtn) {
        pinBtn.classList.remove('active');
        pinBtn.title = '이 조합 패널만 상단에 고정 (클릭 시 나머지 조합 숨김)';
      }
    } else {
      if (isThisCard) {
        card.classList.remove('is-hidden-by-pin');
        card.classList.add('is-pinned-card');
        if (pinBtn) {
          pinBtn.classList.add('active');
          pinBtn.title = '조합 패널 고정 해제 (클릭 시 전체 조합 다시 표시)';
        }
      } else {
        card.classList.add('is-hidden-by-pin');
        card.classList.remove('is-pinned-card');
        if (pinBtn) {
          pinBtn.classList.remove('active');
          pinBtn.title = '이 조합 패널만 상단에 고정 (클릭 시 나머지 조합 숨김)';
        }
      }
    }
  });
}

function formatHistoryTimestamp() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const time = now.toLocaleTimeString('ko-KR', { hour12: false });
  return `${month}. ${date}. ${time}`;
}

async function logChangeHistory(type, swimmerName, field, fieldName, prevVal, newVal, customMessage = '') {
  if (isScenarioMode) return;
  if (prevVal === newVal && type !== 'MEMBER' && type !== 'DELETE') return;

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const device = isMobile ? '모바일' : 'PC';
  const timeFormatted = formatHistoryTimestamp();

  let message = customMessage;
  let typeLabel = '기록 수정';

  if (!message) {
    if (type === 'RECORD') {
      typeLabel = '기록 수정';
      const beforeStr = prevVal ? `${prevVal}` : '빈값';
      const afterStr = newVal ? `${newVal}` : '삭제';
      message = `${swimmerName}: ${fieldName} 기록 (${beforeStr} ➔ ${afterStr})`;
    } else if (type === 'EVENT') {
      typeLabel = '종목 수정';
      const beforeStr = prevVal ? `${prevVal}` : '미신청';
      const afterStr = newVal ? `${newVal}` : '취소';
      message = `${swimmerName}: ${fieldName} (${beforeStr} ➔ ${afterStr})`;
    } else if (type === 'INFO') {
      typeLabel = '정보 수정';
      message = `${swimmerName}: ${fieldName} (${prevVal} ➔ ${newVal})`;
    } else if (type === 'MEMBER') {
      typeLabel = '회원 추가';
      message = `${swimmerName} 회원 신규 등록`;
    } else if (type === 'DELETE') {
      typeLabel = '회원 삭제';
      message = `${swimmerName} 회원 삭제`;
    }
  }

  const logPayload = {
    timestamp: new Date().toISOString(),
    timeFormatted,
    device,
    type,
    typeLabel,
    swimmerName,
    field,
    fieldName,
    prevVal: prevVal !== undefined ? String(prevVal) : '',
    newVal: newVal !== undefined ? String(newVal) : '',
    message
  };

  if (db) {
    try {
      const colRef = collection(db, HISTORY_COL_NAME);
      await addDoc(colRef, logPayload);
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

function loadLocalData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      records = mergeWithDefaultData(parsed);
    } else {
      records = JSON.parse(JSON.stringify(DEFAULT_STUDENT_RECORDS));
    }
  } catch (e) {
    console.error('Failed to parse localStorage data', e);
    records = JSON.parse(JSON.stringify(DEFAULT_STUDENT_RECORDS));
  }
}

function mergeWithDefaultData(remoteList) {
  if (!Array.isArray(remoteList)) return JSON.parse(JSON.stringify(DEFAULT_STUDENT_RECORDS));

  return remoteList.map(item => {
    const def = DEFAULT_STUDENT_RECORDS.find(d => d.id === item.id || d.name === item.name) || {};
    return {
      id: item.id || def.id || 0,
      age: item.age !== undefined ? item.age : (def.age || ''),
      group: item.group || def.group || '2그룹',
      gender: item.gender || def.gender || '남',
      name: item.name || def.name || '',
      birthId: item.birthId || def.birthId || '',
      event1: item.event1 !== undefined ? item.event1 : (def.event1 || ''),
      event2: item.event2 !== undefined ? item.event2 : (def.event2 || ''),
      phone: item.phone || def.phone || '',
      club: item.club || def.club || 'GMDC',
      address: item.address || def.address || '',
      free: item.free !== undefined ? item.free : (def.free || ''),
      back: item.back !== undefined ? item.back : (def.back || ''),
      breast: item.breast !== undefined ? item.breast : (def.breast || ''),
      fly: item.fly !== undefined ? item.fly : (def.fly || '')
    };
  });
}

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
      console.log('🌱 Firestore 학생부 문서가 없어 기본 데이터(19명, 단체전 PB 빈 데이터)로 DB에 일괄 입력(초기화)합니다.');
      isInitialSyncCompleted = true;
      syncToFirestore(DEFAULT_STUDENT_RECORDS);
    }
  }, (error) => {
    console.error('Firebase onSnapshot 에러:', error);
    if (saveStatusText && !isScenarioMode) {
      saveStatusText.innerHTML = `<span style="color:#ef4444;">⚠️ Firebase 접근 권한 확인 필요</span>`;
    }
    showToast('⚠️ Firebase 보안 규칙(Rules)을 확인해 주세요.');
  });
}

function saveData() {
  if (isScenarioMode) {
    if (saveStatusText) {
      saveStatusText.innerHTML = `<span>🧪 시나리오 모드 (서버 저장 안 됨)</span>`;
    }
    return;
  }

  if (!isInitialSyncCompleted && db && DOC_REF) {
    console.warn('⚠️ 서버 최초 데이터 동기화 완료 전 저장을 안전하게 차단합니다.');
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

function handleUrlRouting() {
  const hash = window.location.hash.toLowerCase();
  if (hash === '#events' || hash === '#viewevents') {
    switchView('events');
  } else {
    switchView('records');
  }

  window.addEventListener('hashchange', () => {
    const currentHash = window.location.hash.toLowerCase();
    if (currentHash === '#events' || currentHash === '#viewevents') {
      switchView('events');
    } else {
      switchView('records');
    }
  });
}

function switchView(viewName) {
  const currentScroll = window.scrollY;
  currentView = viewName;

  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (viewName === 'records') {
    viewRecords.classList.add('active');
    viewEvents.classList.remove('active');
    if (window.location.hash !== '' && window.location.hash !== '#records') {
      history.replaceState(null, null, ' ');
    }
  } else {
    viewRecords.classList.remove('active');
    viewEvents.classList.add('active');
    if (window.location.hash !== '#events') {
      history.replaceState(null, null, '#events');
    }
  }

  if (currentScroll > 0) {
    window.scrollTo({ top: currentScroll, behavior: 'instant' });
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function calculateIndividualBest() {
  const strokeBests = {};
  STROKE_FIELDS.forEach(field => {
    strokeBests[field] = {
      '남': Infinity,
      '여': Infinity
    };
  });

  records.forEach(r => {
    const gender = r.gender;
    if (!gender || (gender !== '남' && gender !== '여')) return;

    STROKE_FIELDS.forEach(field => {
      const val = parseFloat(r[field]);
      if (!isNaN(val) && val > 0 && val < 90) {
        if (val < strokeBests[field][gender]) {
          strokeBests[field][gender] = val;
        }
      }
    });
  });

  return strokeBests;
}

function renderTable() {
  let list = [...records];

  if (currentFilter === '남' || currentFilter === '여') {
    list = list.filter(r => r.gender === currentFilter);
  } else if (currentFilter === 'recorded') {
    list = list.filter(r => {
      return STROKE_FIELDS.some(field => {
        const val = parseFloat(r[field]);
        return !isNaN(val) && val > 0;
      });
    });
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(r => {
      const name = (r.name || '').toLowerCase();
      const age = String(r.age || '');
      const group = (r.group || '').toLowerCase();
      return name.includes(q) || age.includes(q) || group.includes(q);
    });
  }

  list.sort((a, b) => {
    let aVal = a[sortCol];
    let bVal = b[sortCol];

    if (sortCol === 'no') {
      aVal = a.id;
      bVal = b.id;
    } else if (sortCol === 'age') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else if (STROKE_FIELDS.includes(sortCol)) {
      aVal = parseFloat(aVal) || (sortAsc ? 9999 : -1);
      bVal = parseFloat(bVal) || (sortAsc ? 9999 : -1);
    } else {
      aVal = String(aVal || '');
      bVal = String(bVal || '');
    }

    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return a.id - b.id;
  });

  const bests = calculateIndividualBest();

  tableBody.innerHTML = list.map((item) => {
    const genderClass = item.gender === '남' ? 'badge-male' : 'badge-female';
    const isMale = item.gender === '남';

    const eventsList = [];
    if (item.event1) eventsList.push(item.event1);
    if (item.event2) eventsList.push(item.event2);
    const eventsText = eventsList.length > 0 ? eventsList.join(', ') : '-';

    return `
      <tr data-id="${item.id}">
        <td class="col-no col-pb-detail">${item.id}</td>
        <td class="col-group col-pb-detail">
          <span class="group-badge">${escapeHtml(item.group || '-')}</span>
        </td>
        <td class="col-age col-pb-detail editable-age-cell" data-id="${item.id}" title="클릭하여 생년월일/만나이 변경" style="cursor: pointer; font-weight: 700;">
          ${escapeHtml(item.age || '-')}
        </td>
        <td class="col-gender col-pb-detail">
          <span class="gender-toggle ${genderClass}" data-id="${item.id}" title="클릭하여 성별 전환 (현재: ${item.gender})">
            ${item.gender}
          </span>
        </td>
        <td class="col-name">
          <input 
            type="text" 
            class="cell-input cell-name" 
            value="${escapeHtml(item.name || '')}" 
            data-id="${item.id}" 
            data-field="name" 
            data-prev-val="${escapeHtml(item.name || '')}"
            placeholder="이름"
            title="클릭하여 회원 이름 수정 (수정 시 재확인 창이 표시됩니다)"
            autocomplete="off"
          />
        </td>
        ${STROKE_FIELDS.map(field => {
          const val = item[field] || '';
          const numVal = parseFloat(val);
          const lastYearVal = getLastYearRecord(item.id, field);
          const isBest = !isNaN(numVal) && numVal > 0 && numVal === bests[field][item.gender];
          const podiumList = getPodiumData(item.gender, item.group, field);
          const podiumInfo = formatPodiumTooltip(item.gender, item.group, field);

          let colorClass = '';
          let titleText = '';

          if (val !== '') {
            if (val === '99.99' || parseFloat(val) >= 99) {
              colorClass = 'is-last-year';
              titleText = '실격 점수 (99.99)';
            } else if (lastYearVal !== '' && val === lastYearVal) {
              colorClass = 'is-last-year';
              titleText = '작년기록 (파란색)';
            } else {
              colorClass = 'is-target';
              titleText = lastYearVal ? `희망기록 (붉은색, 작년: ${lastYearVal}s)` : '희망기록 (붉은색)';
            }
          }

          const fullTitle = [titleText, podiumInfo].filter(Boolean).join('\n');

          return `
            <td class="col-record ${isBest ? 'is-best' : ''}">
              <div class="input-wrapper pb-input-wrapper">
                <input 
                  type="text" 
                  inputmode="decimal" 
                  class="cell-input ${colorClass}" 
                  value="${escapeHtml(val)}" 
                  data-id="${item.id}" 
                  data-field="${field}" 
                  data-prev-val="${escapeHtml(val)}"
                  placeholder="-"
                  title="${escapeHtml(fullTitle)}"
                  autocomplete="off"
                />
                ${isBest ? `<span class="best-badge" title="${isMale ? '남성' : '여성'} ${STROKE_NAMES[field]} 1위 (최고기록)">BEST</span>` : ''}
                ${podiumList && podiumList.length > 0 ? `
                  <div class="podium-popover" role="tooltip">
                    <div class="popover-header">
                      <span class="popover-group-tag">${item.group} ${item.gender === '남' ? '남' : '여'}</span>
                      <span class="popover-title">${STROKE_NAMES[field]} 입상기록</span>
                    </div>
                    <div class="popover-ranks">
                      ${podiumList.map((time, idx) => `
                        <span class="popover-rank rank-${idx + 1}">
                          <span class="medal-icon">${['🥇', '🥈', '🥉'][idx]}</span>
                          <span class="rank-label">${idx + 1}위</span>
                          <strong class="rank-time">${time}s</strong>
                        </span>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            </td>
          `;
        }).join('')}
        <td class="col-events-summary col-pb-detail">
          <span class="events-summary-text ${eventsList.length > 0 ? 'has-events' : ''}" title="${escapeHtml(eventsText)}">
            ${escapeHtml(eventsText)}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  updateSortHeaders();
}

function updateSortHeaders() {
  const headers = document.querySelectorAll('.record-table thead th');
  headers.forEach(th => {
    const col = th.dataset.sort;
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (col === sortCol) {
      th.classList.add(sortAsc ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

function getCombinations(arr, k) {
  const result = [];
  function backtrack(start, current) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

// Check if 4 swimmers meet the Student Relay rules (1-2 group, 3-4 group, 5-6 group)
function isValidStudentRelayGroup(swimmers) {
  if (swimmers.length !== 4) return false;
  const validGroups = ['1그룹', '2그룹', '3그룹', '4그룹', '5그룹', '6그룹'];
  if (!swimmers.every(s => validGroups.includes(s.group))) return false;

  let hasG12 = false;
  let hasG34 = false;
  let hasG56 = false;

  swimmers.forEach(s => {
    if (s.group === '1그룹' || s.group === '2그룹') hasG12 = true;
    if (s.group === '3그룹' || s.group === '4그룹') hasG34 = true;
    if (s.group === '5그룹' || s.group === '6그룹') hasG56 = true;
  });

  return hasG12 && hasG34 && hasG56;
}

// Find best student freestyle relay (자유형 50m x 4명, 학년 규정 충족)
function findBestStudentFreestyleRelay(gender) {
  const pool = records.filter(r => r.gender === gender && parseFloat(r.free) > 0 && parseFloat(r.free) < 90 && ['1그룹','2그룹','3그룹','4그룹','5그룹','6그룹'].includes(r.group));

  if (pool.length < 4) {
    const names = pool.map(p => p.name).join(', ');
    const namesSuffix = names ? `: ${names}` : '';
    return {
      status: 'NOT_ENOUGH',
      message: `조합불가: 자유형 기록 부족 (초등부 ${gender} ${pool.length}/4명)${namesSuffix}`
    };
  }

  const combos = getCombinations(pool, 4);
  let bestTime = Infinity;
  let bestAge = 0;
  let bestMembers = null;

  for (const group of combos) {
    if (!isValidStudentRelayGroup(group)) continue;

    const totalTime = group.reduce((sum, r) => sum + parseFloat(r.free), 0);
    const totalAge = group.reduce((sum, r) => sum + (parseFloat(r.age) || 0), 0);

    if (totalTime < bestTime) {
      bestTime = totalTime;
      bestAge = totalAge;
      bestMembers = group.map(r => ({
        id: r.id,
        strokeField: 'free',
        strokeName: '자유형',
        name: r.name,
        age: r.age,
        group: r.group,
        time: parseFloat(r.free),
        gender: r.gender
      }));
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
    const g12 = pool.filter(r => r.group === '1그룹' || r.group === '2그룹');
    const g34 = pool.filter(r => r.group === '3그룹' || r.group === '4그룹');
    const g56 = pool.filter(r => r.group === '5그룹' || r.group === '6그룹');
    const missingGrps = [];
    if (g12.length === 0) missingGrps.push('1·2학년');
    if (g34.length === 0) missingGrps.push('3·4학년');
    if (g56.length === 0) missingGrps.push('5·6학년');

    const essential = [];
    if (g12.length === 1) essential.push(`${g12[0].name}(${g12[0].group})`);
    if (g34.length === 1) essential.push(`${g34[0].name}(${g34[0].group})`);
    if (g56.length === 1) essential.push(`${g56[0].name}(${g56[0].group})`);

    let msg = '조합불가: 학년 안배 불충족';
    if (missingGrps.length > 0) {
      msg += ` (미등록: ${missingGrps.join(', ')})`;
    }
    if (essential.length > 0) {
      msg += ` [필수선발: ${essential.join(', ')}]`;
    }
    return {
      status: 'RULE_NOT_MET',
      message: msg
    };
  }
}

// Find best student medley relay (배·평·접·자 4명 고유, 학년 규정 충족)
function findBestStudentMedleyRelay(gender) {
  const pool = records.filter(r => r.gender === gender && ['1그룹','2그룹','3그룹','4그룹','5그룹','6그룹'].includes(r.group));

  const backList = pool.filter(r => parseFloat(r.back) > 0 && parseFloat(r.back) < 90);
  const breastList = pool.filter(r => parseFloat(r.breast) > 0 && parseFloat(r.breast) < 90);
  const flyList = pool.filter(r => parseFloat(r.fly) > 0 && parseFloat(r.fly) < 90);
  const freeList = pool.filter(r => parseFloat(r.free) > 0 && parseFloat(r.free) < 90);

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

  for (const sBack of backList) {
    const timeBack = parseFloat(sBack.back);
    const ageBack = parseFloat(sBack.age) || 0;

    for (const sBreast of breastList) {
      if (sBreast.id === sBack.id) continue;
      const timeBreast = parseFloat(sBreast.breast);
      const ageBreast = parseFloat(sBreast.age) || 0;

      for (const sFly of flyList) {
        if (sFly.id === sBack.id || sFly.id === sBreast.id) continue;
        const timeFly = parseFloat(sFly.fly);
        const ageFly = parseFloat(sFly.age) || 0;

        for (const sFree of freeList) {
          if (sFree.id === sBack.id || sFree.id === sBreast.id || sFree.id === sFly.id) continue;
          const timeFree = parseFloat(sFree.free);
          const ageFree = parseFloat(sFree.age) || 0;

          if (!isValidStudentRelayGroup([sBack, sBreast, sFly, sFree])) continue;

          const totalTime = timeBack + timeBreast + timeFly + timeFree;
          const totalAge = ageBack + ageBreast + ageFly + ageFree;

          if (totalTime < bestTime) {
            bestTime = totalTime;
            bestAge = totalAge;
            bestAssignment = [
              { id: sBack.id, strokeField: 'back', strokeName: '배영', name: sBack.name, age: sBack.age, group: sBack.group, time: timeBack, gender: sBack.gender },
              { id: sBreast.id, strokeField: 'breast', strokeName: '평영', name: sBreast.name, age: sBreast.age, group: sBreast.group, time: timeBreast, gender: sBreast.gender },
              { id: sFly.id, strokeField: 'fly', strokeName: '접영', name: sFly.name, age: sFly.age, group: sFly.group, time: timeFly, gender: sFly.gender },
              { id: sFree.id, strokeField: 'free', strokeName: '자유형', name: sFree.name, age: sFree.age, group: sFree.group, time: timeFree, gender: sFree.gender }
            ];
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
    const uniqueMap = new Map();
    [...backList, ...breastList, ...flyList, ...freeList].forEach(r => uniqueMap.set(r.id, r));
    const uniqueList = Array.from(uniqueMap.values());

    if (uniqueList.length < 4) {
      const names = uniqueList.map(r => r.name).join(', ');
      return {
        status: 'NOT_ENOUGH',
        message: `조합불가: 4명 고유 배정 불가 (초등부 ${gender} ${uniqueList.length}/4명): ${names}`
      };
    }

    const g12 = uniqueList.filter(r => r.group === '1그룹' || r.group === '2그룹');
    const g34 = uniqueList.filter(r => r.group === '3그룹' || r.group === '4그룹');
    const g56 = uniqueList.filter(r => r.group === '5그룹' || r.group === '6그룹');
    const missingGrps = [];
    if (g12.length === 0) missingGrps.push('1·2학년');
    if (g34.length === 0) missingGrps.push('3·4학년');
    if (g56.length === 0) missingGrps.push('5·6학년');

    const essential = [];
    if (g12.length === 1) essential.push(`${g12[0].name}(${g12[0].group})`);
    if (g34.length === 1) essential.push(`${g34[0].name}(${g34[0].group})`);
    if (g56.length === 1) essential.push(`${g56[0].name}(${g56[0].group})`);

    let msg = '조합불가: 학년 안배 불충족';
    if (missingGrps.length > 0) {
      msg += ` (미등록: ${missingGrps.join(', ')})`;
    }
    if (essential.length > 0) {
      msg += ` [필수선발: ${essential.join(', ')}]`;
    }
    return {
      status: 'RULE_NOT_MET',
      message: msg
    };
  }
}

// Compute Optimal Student Relay Combinations (4 Combinations)
function calculateRelayCombinations() {
  const combo1Result = findBestStudentFreestyleRelay('남');
  const combo2Result = findBestStudentFreestyleRelay('여');
  const combo3Result = findBestStudentMedleyRelay('남');
  const combo4Result = findBestStudentMedleyRelay('여');

  return {
    combo1: combo1Result,
    combo2: combo2Result,
    combo3: combo3Result,
    combo4: combo4Result
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

// Generate Recommended Student Relay Lineup based on Grade Rules
// 1·2학년(2학년 우선) + 3·4학년(4학년 우선) + 5·6학년(6학년 우선) + 와일드카드(6학년 우선)
function getStudentRecommendedLineup(gender) {
  const pool = records.filter(r => r.gender === gender && ['1그룹','2그룹','3그룹','4그룹','5그룹','6그룹'].includes(r.group));
  
  const g12 = pool.filter(r => r.group === '1그룹' || r.group === '2그룹');
  const g34 = pool.filter(r => r.group === '3그룹' || r.group === '4그룹');
  const g56 = pool.filter(r => r.group === '5그룹' || r.group === '6그룹');

  const missing = [];
  if (g12.length === 0) missing.push('1·2학년');
  if (g34.length === 0) missing.push('3·4학년');
  if (g56.length === 0) missing.push('5·6학년');

  if (missing.length > 0) {
    return `[${missing.join(', ')} 미등록]으로 팀 구성 불가`;
  }

  if (pool.length < 4) {
    const names = pool.map(r => r.name).join(', ');
    return `[선수 등록 부족 (${pool.length}/4명: ${names})]으로 팀 구성 불가`;
  }

  // Slot 1: 1, 2학년 (2학년 우선)
  const g2 = pool.filter(r => r.group === '2그룹');
  const g1 = pool.filter(r => r.group === '1그룹');
  const s1Pool = g2.length > 0 ? g2 : g1;

  // Slot 2: 3, 4학년 (4학년 우선)
  const g4 = pool.filter(r => r.group === '4그룹');
  const g3 = pool.filter(r => r.group === '3그룹');
  const s2Pool = g4.length > 0 ? g4 : g3;

  // Slot 3 & 4: 5, 6학년 & 와일드카드 (6학년 우선)
  const g6 = pool.filter(r => r.group === '6그룹');
  const g5 = pool.filter(r => r.group === '5그룹');

  const slot1Str = s1Pool.length === 1 ? s1Pool[0].name : `[${s1Pool.map(c => c.name).join(' or ')}]`;
  const slot2Str = s2Pool.length === 1 ? s2Pool[0].name : `[${s2Pool.map(c => c.name).join(' or ')}]`;
  let slot3Str = '';
  let slot4Str = '';

  if (g6.length >= 2) {
    if (g6.length === 2) {
      slot3Str = g6[0].name;
      slot4Str = g6[1].name;
    } else {
      slot3Str = `[${g6.map(c => c.name).join(' or ')}]`;
      slot4Str = `[${g6.map(c => c.name).join(' or ')}]`;
    }
  } else if (g6.length === 1) {
    slot3Str = g6[0].name;
    const remaining = g5.length > 0 ? g5 : pool.filter(r => r.id !== g6[0].id && !s1Pool.some(p => p.id === r.id) && !s2Pool.some(p => p.id === r.id));
    if (remaining.length === 1) {
      slot4Str = remaining[0].name;
    } else if (remaining.length > 1) {
      slot4Str = `[${remaining.map(c => c.name).join(' or ')}]`;
    } else {
      slot4Str = `[와일드카드]`;
    }
  } else {
    if (g5.length === 2) {
      slot3Str = g5[0].name;
      slot4Str = g5[1].name;
    } else if (g5.length > 2) {
      slot3Str = `[${g5.map(c => c.name).join(' or ')}]`;
      slot4Str = `[${g5.map(c => c.name).join(' or ')}]`;
    } else {
      slot3Str = g5.length === 1 ? g5[0].name : `[5·6학년]`;
      slot4Str = `[와일드카드]`;
    }
  }

  return `${slot1Str} + ${slot2Str} + ${slot3Str} + ${slot4Str}`;
}

// Update Top Dashboard Combination Panels
function updateStats() {
  const { combo1, combo2, combo3, combo4 } = calculateRelayCombinations();
  renderComboCard('combo1', combo1, false, '남');
  renderComboCard('combo2', combo2, false, '여');
  renderComboCard('combo3', combo3, true, '남');
  renderComboCard('combo4', combo4, true, '여');
}

function renderComboCard(prefix, result, isMedley = false, gender = '남') {
  const timeEl = document.getElementById(`${prefix}Time`);
  const ageEl = document.getElementById(`${prefix}Age`);
  const membersEl = document.getElementById(`${prefix}Members`);

  if (!timeEl || !ageEl || !membersEl) return;

  if (!result || result.status !== 'SUCCESS') {
    timeEl.textContent = '-';
    timeEl.classList.remove('time-highlight');
    ageEl.textContent = '-';

    const recommendLine = getStudentRecommendedLineup(gender);
    const failMsg = result ? result.message : '기록 부족';

    membersEl.innerHTML = `
      <div class="combo-recommendation-box">
        <div class="combo-fail-reason">${escapeHtml(failMsg)}</div>
        <div class="combo-recommend-line">
          <span class="recommend-badge">추천 라인업</span>
          <span class="recommend-members">${escapeHtml(recommendLine)}</span>
        </div>
      </div>
    `;
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
        <span style="color:var(--text-subtle);font-size:11px;">(${m.group || m.age + '세'})</span>
        <span class="member-time ${timeClass}">${m.time.toFixed(2)}s</span>
      </div>
    `;
  }).join('');
}

function initMatrixCompareMode() {
  const chkMale = document.getElementById('chkCompareMaleMatrix');
  const chkFemale = document.getElementById('chkCompareFemaleMatrix');

  function updateCheckboxes() {
    if (chkMale) chkMale.checked = isMatrixCompareMode;
    if (chkFemale) chkFemale.checked = isMatrixCompareMode;
  }

  function handleToggle(e) {
    isMatrixCompareMode = e.target.checked;
    localStorage.setItem('gmdc_student_matrix_compare_mode', isMatrixCompareMode);
    updateCheckboxes();
    renderSummaryMatrices();
  }

  if (chkMale) chkMale.addEventListener('change', handleToggle);
  if (chkFemale) chkFemale.addEventListener('change', handleToggle);
  updateCheckboxes();
}

function renderSummaryMatrices() {
  const eventTypes = [
    { label: '자유형', match: (e) => e === '자유형 50' || e === '자유형' },
    { label: '배영', match: (e) => e === '배영 50' || e === '배영' },
    { label: '평영', match: (e) => e === '평영 50' || e === '평영' },
    { label: '접영', match: (e) => e === '접영 50' || e === '접영' }
  ];

  function buildMatrix(gender) {
    const list = records.filter(r => r.gender === gender);
    const matrix = {};
    const swimmersByCell = {};

    GROUPS.forEach(g => {
      matrix[g] = {};
      swimmersByCell[g] = {};
      eventTypes.forEach(ev => {
        matrix[g][ev.label] = 0;
        swimmersByCell[g][ev.label] = [];
      });
    });

    list.forEach(r => {
      const g = r.group;
      if (!matrix[g]) return;

      const events = [r.event1, r.event2].filter(Boolean);
      events.forEach(e => {
        eventTypes.forEach(ev => {
          if (ev.match(e)) {
            matrix[g][ev.label]++;
            swimmersByCell[g][ev.label].push(r.name);
          }
        });
      });
    });

    return { matrix, swimmersByCell };
  }

  function renderMatrixHTML(gender, tbody, tfoot, data) {
    const { matrix, swimmersByCell } = data;
    const colTotals = {};
    eventTypes.forEach(ev => colTotals[ev.label] = 0);
    let grandTotal = 0;

    tbody.innerHTML = GROUPS.map(g => {
      let rowTotal = 0;
      const cells = eventTypes.map(ev => {
        const count = matrix[g][ev.label];
        const prevCount = PREV_YEAR_STUDENT_DISTRIBUTION[gender]?.[g]?.[ev.label] ?? 0;
        const swimmers = swimmersByCell[g][ev.label];
        rowTotal += count;
        colTotals[ev.label] += count;

        if (isMatrixCompareMode) {
          const tooltip = count > 0 
            ? `title="${g} ${ev.label} (올해 ${count}명 / 작년 ${prevCount}명): ${swimmers.join(', ')}"` 
            : `title="${g} ${ev.label} (올해 0명 / 작년 ${prevCount}명)"`;
          return `
            <td class="matrix-cell is-compared ${count > 0 ? 'has-swimmers' : 'is-empty'}" ${tooltip}>
              <span class="matrix-num-compare">
                <span class="${count > 0 ? 'num-curr' : 'num-curr-zero'}">${count}</span>
                <span class="num-slash">/</span>
                <span class="num-prev">(${prevCount})</span>
              </span>
            </td>
          `;
        } else {
          const countDisplay = count > 0 ? `<strong class="cell-count count-active">${count}</strong>` : `<span class="cell-count count-zero">-</span>`;
          const tooltip = count > 0 ? `title="${g} ${ev.label} (${count}명): ${swimmers.join(', ')}"` : '';
          return `<td class="matrix-cell ${count > 0 ? 'has-swimmers' : ''}" ${tooltip}>${countDisplay}</td>`;
        }
      }).join('');

      grandTotal += rowTotal;
      const prevGroupTotal = PREV_YEAR_STUDENT_DISTRIBUTION[gender]?.[g]?.total ?? 0;

      if (isMatrixCompareMode) {
        return `
          <tr>
            <td class="matrix-row-group">${g}</td>
            ${cells}
            <td class="matrix-row-total is-compared" style="font-weight:800; background:#f8fafc; color:var(--secondary);">
              <span class="matrix-num-compare">
                <span class="${rowTotal > 0 ? 'num-curr' : 'num-curr-zero'}">${rowTotal}</span>
                <span class="num-slash">/</span>
                <span class="num-prev">(${prevGroupTotal})</span>
              </span>
            </td>
          </tr>
        `;
      } else {
        const rowTotalDisplay = rowTotal > 0 ? `<strong class="row-total-active">${rowTotal}</strong>` : `<span>-</span>`;
        return `
          <tr>
            <td class="matrix-row-group">${g}</td>
            ${cells}
            <td class="matrix-row-total">${rowTotalDisplay}</td>
          </tr>
        `;
      }
    }).join('');

    const prevGrandTotal = GROUPS.reduce((sum, g) => sum + (PREV_YEAR_STUDENT_DISTRIBUTION[gender]?.[g]?.total ?? 0), 0);

    const footCells = eventTypes.map(ev => {
      const total = colTotals[ev.label];
      const prevColTotal = GROUPS.reduce((sum, g) => sum + (PREV_YEAR_STUDENT_DISTRIBUTION[gender]?.[g]?.[ev.label] ?? 0), 0);

      if (isMatrixCompareMode) {
        return `
          <th class="matrix-foot-cell is-compared">
            <span class="matrix-num-compare">
              <span class="${total > 0 ? 'num-curr' : 'num-curr-zero'}">${total}</span>
              <span class="num-slash">/</span>
              <span class="num-prev">(${prevColTotal})</span>
            </span>
          </th>
        `;
      } else {
        return `<th class="matrix-foot-cell">${total > 0 ? `<strong>${total}</strong>` : '-'}</th>`;
      }
    }).join('');

    tfoot.innerHTML = `
      <tr>
        <th class="matrix-foot-label">합계</th>
        ${footCells}
        <th class="matrix-foot-grand-total ${isMatrixCompareMode ? 'is-compared' : ''}">
          ${isMatrixCompareMode ? `
            <span class="matrix-num-compare">
              <span class="num-curr">${grandTotal}</span>
              <span class="num-slash">/</span>
              <span class="num-prev">(${prevGrandTotal})</span>
            </span>
          ` : grandTotal}
        </th>
      </tr>
    `;
  }

  const maleData = buildMatrix('남');
  const femaleData = buildMatrix('여');

  if (maleMatrixBody && maleMatrixFoot) renderMatrixHTML('남', maleMatrixBody, maleMatrixFoot, maleData);
  if (femaleMatrixBody && femaleMatrixFoot) renderMatrixHTML('여', femaleMatrixBody, femaleMatrixFoot, femaleData);
}

const EVENT_OPTIONS = [
  '',
  '자유형 50',
  '배영 50',
  '평영 50',
  '접영 50'
];

function renderEventsTable() {
  if (!eventsTableBody) return;

  let list = [...records];

  if (currentEventsFilter === '남' || currentEventsFilter === '여') {
    list = list.filter(r => r.gender === currentEventsFilter);
  }

  if (currentEventsGroup !== 'all') {
    list = list.filter(r => r.group === currentEventsGroup);
  }

  if (eventsSearchQuery) {
    const q = eventsSearchQuery.toLowerCase();
    list = list.filter(r => {
      const name = (r.name || '').toLowerCase();
      const birth = (r.birthId || '').toLowerCase();
      const group = (r.group || '').toLowerCase();
      const phone = (r.phone || '').toLowerCase();
      return name.includes(q) || birth.includes(q) || group.includes(q) || phone.includes(q);
    });
  }

  list.sort((a, b) => {
    if (a.group !== b.group) {
      return a.group.localeCompare(b.group);
    }
    return a.id - b.id;
  });

  if (eventsFilteredCount) {
    eventsFilteredCount.textContent = `총 ${list.length}명 표시 중`;
  }

  eventsTableBody.innerHTML = list.map((item) => {
    const genderClass = item.gender === '남' ? 'badge-male' : 'badge-female';
    const eventCount = (item.event1 ? 1 : 0) + (item.event2 ? 1 : 0);

    return `
      <tr data-id="${item.id}">
        <td class="col-no col-detail">${item.id}</td>
        <td class="col-group col-detail">
          <span class="group-badge">${escapeHtml(item.group || '-')}</span>
        </td>
        <td class="col-gender col-detail">
          <span class="gender-toggle ${genderClass}" data-id="${item.id}" title="클릭하여 성별 전환 (현재: ${item.gender})">
            ${item.gender}
          </span>
        </td>
        <td class="col-name">
          <span class="swimmer-name-text">${escapeHtml(item.name)}</span>
        </td>
        <td class="col-birth col-detail">
          <span class="birth-code">${escapeHtml(item.birthId || '-')}</span>
        </td>
        <td class="col-event">
          <select 
            class="event-select ${item.event1 ? 'has-event' : ''}" 
            data-id="${item.id}" 
            data-event-idx="1"
            title="${escapeHtml(item.event1 ? formatPodiumTooltip(item.gender, item.group, item.event1) : '출전 종목 선택 (선택 시 작년 입상기록 확인)')}"
          >
            ${EVENT_OPTIONS.map(opt => {
              const optPodium = opt ? getPodiumShort(item.gender, item.group, opt) : '';
              const optLabel = opt ? (optPodium ? `${opt} [${optPodium}]` : opt) : '(선택 안 함)';
              return `
                <option value="${escapeHtml(opt)}" ${item.event1 === opt ? 'selected' : ''}>
                  ${escapeHtml(optLabel)}
                </option>
              `;
            }).join('')}
          </select>
        </td>
        <td class="col-event">
          <select 
            class="event-select ${item.event2 ? 'has-event' : ''}" 
            data-id="${item.id}" 
            data-event-idx="2"
            title="${escapeHtml(item.event2 ? formatPodiumTooltip(item.gender, item.group, item.event2) : '출전 종목 선택 (선택 시 작년 입상기록 확인)')}"
          >
            ${EVENT_OPTIONS.map(opt => {
              const optPodium = opt ? getPodiumShort(item.gender, item.group, opt) : '';
              const optLabel = opt ? (optPodium ? `${opt} [${optPodium}]` : opt) : '(선택 안 함)';
              return `
                <option value="${escapeHtml(opt)}" ${item.event2 === opt ? 'selected' : ''}>
                  ${escapeHtml(optLabel)}
                </option>
              `;
            }).join('')}
          </select>
        </td>
        <td class="col-detail" style="font-size:12px; color:var(--text-muted); font-variant-numeric:tabular-nums;">
          ${escapeHtml(item.phone || '-')}
        </td>
        <td class="col-detail" style="font-size:12px; color:var(--text-muted); text-align:left; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(item.address || '')}">
          ${escapeHtml(item.address || '-')}
        </td>
        <td class="col-count col-detail">
          <span class="event-count-badge ${eventCount > 0 ? 'has-events' : ''}">${eventCount}개</span>
        </td>
        <td class="col-goto-pb col-detail">
          <button class="btn-goto-pb" data-name="${escapeHtml(item.name)}" title="${escapeHtml(item.name)}의 단체전 기록표로 이동">
            기록보기 ➔
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function bindEvents() {
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = btn.dataset.view;
      if (targetView) switchView(targetView);
    });
  });

  if (btnRecordsModeSimple) {
    btnRecordsModeSimple.addEventListener('click', () => applyRecordsViewMode('simple'));
  }
  if (btnRecordsModeDetailed) {
    btnRecordsModeDetailed.addEventListener('click', () => applyRecordsViewMode('detailed'));
  }

  if (btnModeSimple) {
    btnModeSimple.addEventListener('click', () => applyEventsViewMode('simple'));
  }
  if (btnModeDetailed) {
    btnModeDetailed.addEventListener('click', () => applyEventsViewMode('detailed'));
  }

  // Panel Pin Buttons (Only 1 pinned at a time, hiding remaining cards)
  document.querySelectorAll('.combo-card .btn-panel-pin').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.combo-card');
      if (!card) return;

      const cardId = card.id;
      if (pinnedComboCardId === cardId) {
        pinnedComboCardId = null;
        localStorage.removeItem(STICKY_STORAGE_KEY);
        applySinglePinnedCard(null);
        showToast('🔓 조합 패널 고정이 해제되어 모든 조합이 표시됩니다.');
      } else {
        pinnedComboCardId = cardId;
        localStorage.setItem(STICKY_STORAGE_KEY, cardId);
        applySinglePinnedCard(cardId);
        const title = card.querySelector('.combo-title')?.textContent?.trim() || '선택한 조합';
        showToast(`📌 '${title}' 패널이 상단에 고정되었습니다. (나머지 조합 숨김)`);
      }
    });
  });

  const tableHeaders = document.querySelectorAll('.record-table thead th[data-sort]');
  tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortCol === col) {
        sortAsc = !sortAsc;
      } else {
        sortCol = col;
        sortAsc = true;
      }
      renderTable();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderTable();
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTable();
    });
  });

  if (eventsSearchInput) {
    eventsSearchInput.addEventListener('input', (e) => {
      eventsSearchQuery = e.target.value.trim();
      renderEventsTable();
    });
  }

  eventsFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      eventsFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEventsFilter = btn.dataset.eventsFilter;
      renderEventsTable();
    });
  });

  if (eventsGroupSelect) {
    eventsGroupSelect.addEventListener('change', (e) => {
      currentEventsGroup = e.target.value;
      renderEventsTable();
    });
  }

  // Real-time table input handler
  tableBody.addEventListener('input', (e) => {
    const target = e.target;
    if (!target.classList.contains('cell-input')) return;

    const id = parseInt(target.dataset.id, 10);
    const field = target.dataset.field;
    let val = target.value.trim();

    if (field !== 'name') {
      val = val.replace(/[^0-9.]/g, '');
      const parts = val.split('.');
      if (parts.length > 2) {
        val = parts[0] + '.' + parts.slice(1).join('');
      }
      target.value = val;
    }

    const record = records.find(r => r.id === id);
    if (!record) return;

    record[field] = val;

    if (STROKE_FIELDS.includes(field)) {
      const lastYearVal = getLastYearRecord(id, field);
      target.classList.remove('is-last-year', 'is-target');
      if (val !== '') {
        if (lastYearVal !== '' && val === lastYearVal) {
          target.classList.add('is-last-year');
          target.title = val === '99.99' ? '실격 점수 (99.99)' : '작년기록 (파란색)';
        } else {
          target.classList.add('is-target');
          target.title = lastYearVal ? `희망기록 (붉은색, 작년: ${lastYearVal}s)` : '희망기록 (붉은색)';
        }
      } else {
        target.title = '';
      }
    }

    saveData();
    updateStats();
  });

  // Focusout handler for revert, confirmation, and history logging
  tableBody.addEventListener('focusout', (e) => {
    const target = e.target;
    if (!target.classList.contains('cell-input')) return;

    const id = parseInt(target.dataset.id, 10);
    const field = target.dataset.field;
    const record = records.find(r => r.id === id);
    if (!record) return;

    const val = target.value.trim();
    const prevVal = (target.dataset.prevVal || '').trim();
    const lastYearVal = getLastYearRecord(id, field);

    if (field === 'name') {
      if (val !== prevVal) {
        const oldName = prevVal || '무명';
        const newName = val || '(빈값)';
        if (!confirm(`'${oldName}' 학생의 이름을 '${newName}'(으)로 변경하시겠습니까?`)) {
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
        showToast(`'${oldName}' 학생의 이름이 '${newName}'(으)로 변경되었습니다.`);
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
      showToast(`'${record.name || '학생'}'의 ${STROKE_NAMES[field]} 기록이 작년기록(${lastYearVal}s)으로 원복되었습니다.`);
    } else if (val !== prevVal) {
      if (STROKE_FIELDS.includes(field)) {
        logChangeHistory('RECORD', record.name, field, STROKE_NAMES[field], prevVal, val);
      } else if (field === 'age') {
        logChangeHistory('INFO', record.name, 'age', '나이', prevVal, val);
      }
    }

    target.dataset.prevVal = target.value;
  });

  tableBody.addEventListener('beforeinput', (e) => {
    const target = e.target;
    if (!target.classList.contains('cell-input')) return;

    const field = target.dataset.field;
    if (field === 'name') return;

    const data = e.data;
    if (data && !/^[0-9.]$/.test(data)) {
      e.preventDefault();
      showToast('숫자와 소수점(.)만 입력 가능합니다.');
    }
  });

  // Gender toggle with confirmation
  tableBody.addEventListener('click', (e) => {
    const toggle = e.target.closest('.gender-toggle');
    if (!toggle) return;

    const id = parseInt(toggle.dataset.id, 10);
    const record = records.find(r => r.id === id);
    if (!record) return;

    const oldGender = record.gender;
    const newGender = oldGender === '남' ? '여' : '남';

    if (!confirm(`'${record.name || '학생'}'의 성별을 [${newGender}]으로 변경하시겠습니까?`)) {
      return;
    }

    record.gender = newGender;
    saveData();
    renderAll();
    logChangeHistory('INFO', record.name, 'gender', '성별', oldGender, newGender);
    showToast(`'${record.name}' 학생의 성별이 [${newGender}]으로 변경되었습니다.`);
  });

  // Age cell click prompt
  tableBody.addEventListener('click', (e) => {
    const cell = e.target.closest('.editable-age-cell');
    if (!cell) return;

    const id = parseInt(cell.dataset.id, 10);
    const record = records.find(r => r.id === id);
    if (!record) return;

    const birthInput = prompt(`'${record.name}' 학생의 생년월일 8자리를 입력해주세요.\n(예: 20150603 또는 20150603-3)\n현재 등록 식별코드: ${record.birthId || '없음'}`, record.birthId || '');
    if (birthInput === null) return;

    const cleanInput = birthInput.trim();
    if (!cleanInput) return;

    const yyyymmdd = cleanInput.replace(/[^0-9]/g, '').slice(0, 8);
    if (yyyymmdd.length !== 8) {
      alert('생년월일 8자리(YYYYMMDD)를 올바르게 입력해주세요.');
      return;
    }

    const y = parseInt(yyyymmdd.slice(0, 4), 10);
    const m = parseInt(yyyymmdd.slice(4, 6), 10);
    const d = parseInt(yyyymmdd.slice(6, 8), 10);

    const baseYear = 2026;
    const baseMonth = 1;
    const baseDay = 1;

    let calcAge = baseYear - y;
    if (m > baseMonth || (m === baseMonth && d > baseDay)) {
      calcAge -= 1;
    }

    const oldAge = record.age;
    const oldBirth = record.birthId;

    record.age = String(calcAge);
    record.birthId = cleanInput;

    saveData();
    renderAll();
    logChangeHistory('INFO', record.name, 'age', '만나이(생년월일)', `${oldAge}세(${oldBirth})`, `${calcAge}세(${cleanInput})`);
    showToast(`'${record.name}' 학생의 만나이가 ${calcAge}세(생년월일: ${cleanInput})로 갱신되었습니다.`);
  });

  // Event dropdown selection handler
  if (eventsTableBody) {
    eventsTableBody.addEventListener('change', (e) => {
      const select = e.target.closest('.event-select');
      if (!select) return;

      const id = parseInt(select.dataset.id, 10);
      const eventIdx = select.dataset.eventIdx;
      const record = records.find(r => r.id === id);
      if (!record) return;

      const field = `event${eventIdx}`;
      const prevVal = record[field] || '';
      const newVal = select.value;

      record[field] = newVal;
      saveData();
      renderAll();
      logChangeHistory('EVENT', record.name, field, `출전 종목 ${eventIdx}`, prevVal, newVal);
      showToast(`'${record.name}' 학생의 출전 종목 ${eventIdx}이(가) 변경되었습니다.`);
    });

    eventsTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-goto-pb');
      if (!btn) return;

      const swimmerName = btn.dataset.name;
      switchView('records');

      if (searchInput) {
        searchInput.value = swimmerName;
        searchQuery = swimmerName;
      }
      filterBtns.forEach(b => b.classList.remove('active'));
      const allFilterBtn = document.querySelector('.filter-btn[data-filter="all"]');
      if (allFilterBtn) allFilterBtn.classList.add('active');
      currentFilter = 'all';

      renderTable();

      setTimeout(() => {
        const inputEl = document.querySelector(`.cell-name[value="${CSS.escape(swimmerName)}"]`);
        if (inputEl) {
          const tr = inputEl.closest('tr');
          if (tr) {
            tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            tr.style.transition = 'background-color 0.5s ease';
            tr.style.backgroundColor = '#fef08a';
            setTimeout(() => {
              tr.style.backgroundColor = '';
            }, 1500);
          }
        }
      }, 100);
    });
  }

  // Export CSV
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', exportToCsv);
  }

  // Copy TSV for Excel
  if (btnCopyTsv) {
    btnCopyTsv.addEventListener('click', copyTsvToClipboard);
  }

  // Excel paste (Ctrl+V) handler
  document.addEventListener('paste', handleTablePaste);
}

function handleTablePaste(e) {
  const activeEl = document.activeElement;
  if (!activeEl || !activeEl.classList.contains('cell-input')) return;

  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  const pastedText = clipboardData.getData('text');
  if (!pastedText || !pastedText.includes('\t') && !pastedText.includes('\n')) return;

  e.preventDefault();

  const rows = pastedText.trim().split(/\r?\n/).map(row => row.split('\t'));
  const startId = parseInt(activeEl.dataset.id, 10);
  const startField = activeEl.dataset.field;

  const strokeOrder = STROKE_FIELDS;
  const startColIdx = strokeOrder.indexOf(startField);

  if (startColIdx === -1) {
    activeEl.value = rows[0][0].trim();
    const r = records.find(rec => rec.id === startId);
    if (r) r[startField] = activeEl.value;
    saveData();
    renderAll();
    return;
  }

  const sortedList = [...records].sort((a, b) => a.id - b.id);
  const startRowIdx = sortedList.findIndex(r => r.id === startId);
  if (startRowIdx === -1) return;

  let updateCount = 0;

  rows.forEach((rowVals, rOffset) => {
    const targetRowIdx = startRowIdx + rOffset;
    if (targetRowIdx >= sortedList.length) return;

    const targetRecord = sortedList[targetRowIdx];

    rowVals.forEach((val, cOffset) => {
      const targetColIdx = startColIdx + cOffset;
      if (targetColIdx >= strokeOrder.length) return;

      const targetField = strokeOrder[targetColIdx];
      const cleanVal = val.trim().replace(/[^0-9.]/g, '');
      targetRecord[targetField] = cleanVal;
      updateCount++;
    });
  });

  saveData();
  renderAll();
  showToast(`📋 엑셀에서 ${updateCount}개 기록이 성공적으로 붙여넣어졌습니다.`);
}

function copyTsvToClipboard() {
  const headers = ['번호', '그룹', '만나이', '성별', '이름', '자유형', '배영', '평영', '접영', '출전종목1', '출전종목2', '연락처', '주소'];
  const rows = records.map(r => [
    r.id,
    r.group,
    r.age,
    r.gender,
    r.name,
    r.free,
    r.back,
    r.breast,
    r.fly,
    r.event1 || '',
    r.event2 || '',
    r.phone || '',
    r.address || ''
  ]);

  const tsvContent = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');

  navigator.clipboard.writeText(tsvContent).then(() => {
    showToast('📋 학생부 전체 데이터가 엑셀 붙여넣기용(TSV)으로 복사되었습니다.');
  }).catch(err => {
    console.error('Clipboard copy error', err);
    showToast('⚠️ 클립보드 복사 실패');
  });
}

function exportToCsv() {
  const headers = ['번호', '그룹', '만나이', '성별', '이름', '자유형', '배영', '평영', '접영', '출전종목1', '출전종목2', '연락처', '주소'];
  const rows = records.map(r => [
    r.id,
    r.group,
    r.age,
    r.gender,
    `"${(r.name || '').replace(/"/g, '""')}"`,
    r.free,
    r.back,
    r.breast,
    r.fly,
    `"${(r.event1 || '').replace(/"/g, '""')}"`,
    `"${(r.event2 || '').replace(/"/g, '""')}"`,
    `"${(r.phone || '').replace(/"/g, '""')}"`,
    `"${(r.address || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `GMDC_수영_기록관리표_학생부_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('💾 학생부 CSV 파일이 다운로드되었습니다.');
}

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

document.addEventListener('DOMContentLoaded', init);
