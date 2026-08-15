/**
 * GMDC 수영 기록 관리 시스템
 * Firebase Cloud Firestore 실시간 연동 & 계영 최적 조합 연산 시스템
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration provided by user
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
let isFirebaseConnected = false;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  DOC_REF = doc(db, "gmdc_swim_club", "records_2026_01_01");
} catch (err) {
  console.error("Firebase 초기화 에러:", err);
}

const STORAGE_KEY = 'gmdc_swim_records_v1';

// Initial 37 Swimmer Records (작년 기준 데이터)
const DEFAULT_RECORDS = [
  { id: 1, age: '15', gender: '남', name: '박슬우', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 2, age: '15', gender: '남', name: '이지훈', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 3, age: '16', gender: '남', name: '이채율', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 4, age: '17', gender: '남', name: '조성찬', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 5, age: '17', gender: '여', name: '이지호', finFly: '', finFree: '31.07', free: '36.78', back: '', breast: '', fly: '' },
  { id: 6, age: '24', gender: '여', name: '추성비', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 7, age: '24', gender: '여', name: '이영경', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 8, age: '33', gender: '남', name: '안재홍', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 9, age: '38', gender: '여', name: '노언영', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 10, age: '37', gender: '여', name: '최이슬', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 11, age: '43', gender: '남', name: '고석보', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 12, age: '44', gender: '남', name: '김기용', finFly: '', finFree: '', free: '35.69', back: '', breast: '41.65', fly: '' },
  { id: 13, age: '42', gender: '남', name: '김준영', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 14, age: '44', gender: '남', name: '손철수', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 15, age: '44', gender: '남', name: '안상준', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 16, age: '41', gender: '남', name: '양승진', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 17, age: '44', gender: '남', name: '이도형', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 18, age: '42', gender: '남', name: '정서현', finFly: '', finFree: '27.92', free: '33.59', back: '', breast: '', fly: '' },
  { id: 19, age: '47', gender: '여', name: '김상희', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 20, age: '43', gender: '여', name: '박다유', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 21, age: '48', gender: '여', name: '손혜정', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 22, age: '40', gender: '여', name: '심민경', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 23, age: '42', gender: '여', name: '여수연', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 24, age: '44', gender: '여', name: '이미영', finFly: '', finFree: '30.42', free: '', back: '', breast: '', fly: '57.17' },
  { id: 25, age: '41', gender: '여', name: '이은희', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 26, age: '50', gender: '남', name: '박재홍', finFly: '30.29', finFree: '28.08', free: '', back: '', breast: '', fly: '' },
  { id: 27, age: '57', gender: '남', name: '박진홍', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 28, age: '50', gender: '남', name: '서충근', finFly: '', finFree: '27.43', free: '', back: '', breast: '', fly: '99.99' },
  { id: 29, age: '50', gender: '남', name: '성지경', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 30, age: '51', gender: '남', name: '이경열', finFly: '', finFree: '', free: '', back: '', breast: '43.51', fly: '' },
  { id: 31, age: '53', gender: '여', name: '김애란', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 32, age: '58', gender: '여', name: '박선화', finFly: '', finFree: '33.64', free: '46.66', back: '', breast: '', fly: '' },
  { id: 33, age: '56', gender: '여', name: '전경미', finFly: '', finFree: '32.42', free: '', back: '55.88', breast: '', fly: '' },
  { id: 34, age: '62', gender: '남', name: '박봉권', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 35, age: '63', gender: '남', name: '성환용', finFly: '', finFree: '99.99', free: '', back: '', breast: '', fly: '' },
  { id: 36, age: '59', gender: '여', name: '송원자', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 37, age: '62', gender: '여', name: '최지희', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' }
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
let searchQuery = '';
let currentFilter = 'all'; // 'all', '남', '여', 'recorded'
let sortColumn = null;
let sortDirection = 'asc'; // 'asc' or 'desc'
let saveTimeout = null;

// DOM Elements
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');
const btnAddRow = document.getElementById('btnAddRow');
const btnResetData = document.getElementById('btnResetData');
const btnExportCsv = document.getElementById('btnExportCsv');
const btnCopyTsv = document.getElementById('btnCopyTsv');
const toastEl = document.getElementById('toast');
const saveStatusText = document.getElementById('saveStatusText');
const btnToggleSticky = document.getElementById('btnToggleSticky');
const comboGrid = document.getElementById('comboGrid');
const stickyBtnLabel = document.getElementById('stickyBtnLabel');

const STICKY_STORAGE_KEY = 'gmdc_sticky_pinned';
const MODAL_STORAGE_KEY = 'gmdc_hide_notice_modal_date';
let isStickyPinned = true; // Default: Pinned (고정 기본)

// Init application
function init() {
  initStickyPreference();
  initNoticeModal();
  loadLocalData();
  bindEvents();
  renderTable();
  updateStats();
  initFirebaseSync();
}

// Initialize Notice Modal Popup
function initNoticeModal() {
  const modal = document.getElementById('noticeModal');
  const btnCloseX = document.getElementById('btnModalCloseX');
  const btnConfirm = document.getElementById('btnModalConfirm');
  const chkHideToday = document.getElementById('chkHideToday');

  if (!modal) return;

  const todayStr = new Date().toDateString(); // e.g. "Sun Aug 16 2026"
  const savedDate = localStorage.getItem(MODAL_STORAGE_KEY);

  // Show modal if not hidden for today
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

  // Close when clicking overlay backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModal();
    }
  });
}

// Initialize Sticky Panel Preference
function initStickyPreference() {
  const saved = localStorage.getItem(STICKY_STORAGE_KEY);
  isStickyPinned = saved !== '0'; // Default is true unless explicitly set to '0'
  applyStickyState(isStickyPinned);
}

function applyStickyState(pinned) {
  if (comboGrid) {
    comboGrid.classList.toggle('is-sticky', pinned);
  }
  if (btnToggleSticky) {
    btnToggleSticky.classList.toggle('active', pinned);
    btnToggleSticky.title = pinned ? '스크롤 시 상단 조합 패널 고정 해제' : '스크롤 시 상단 조합 패널 고정 활성화';
  }
  if (stickyBtnLabel) {
    stickyBtnLabel.textContent = pinned ? '조합패널 고정 ON' : '조합패널 고정 OFF';
  }
}

// 1. Load Local Cache First (for instant startup)
function loadLocalData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      records = JSON.parse(saved);
    } else {
      records = JSON.parse(JSON.stringify(DEFAULT_RECORDS));
    }
  } catch (e) {
    console.error('Failed to parse localStorage data', e);
    records = JSON.parse(JSON.stringify(DEFAULT_RECORDS));
  }
}

// 2. Real-time Firebase Firestore Sync Listener
function initFirebaseSync() {
  if (!db || !DOC_REF) {
    if (saveStatusText) {
      saveStatusText.innerHTML = `<span style="color:#d97706;">⚠️ 로컬 저장 모드 (Firebase 미연결)</span>`;
    }
    return;
  }

  if (saveStatusText) {
    saveStatusText.innerHTML = `<span>⏳ Firebase 클라우드 연결 중...</span>`;
  }

  onSnapshot(DOC_REF, (docSnap) => {
    isFirebaseConnected = true;
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.records)) {
        // Check if data actually changed to prevent focus flickering
        const isDataChanged = JSON.stringify(records) !== JSON.stringify(data.records);
        if (isDataChanged) {
          records = data.records;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
          
          // Don't re-render entire table if user is currently typing in an input
          const activeEl = document.activeElement;
          const isUserTyping = activeEl && activeEl.classList && activeEl.classList.contains('cell-input');
          
          if (!isUserTyping) {
            renderTable();
          }
          updateStats();
        }
      }
      if (saveStatusText) {
        saveStatusText.innerHTML = `<span class="status-dot"></span><span>Firebase 클라우드 동기화 (${new Date().toLocaleTimeString('ko-KR')})</span>`;
      }
    } else {
      // Document does not exist yet: initialize Firestore with DEFAULT_RECORDS
      console.log('Firebase에 초기 데이터 생성 중...');
      syncToFirestore(DEFAULT_RECORDS);
      if (saveStatusText) {
        saveStatusText.innerHTML = `<span class="status-dot"></span><span>Firebase 초기화 완료 (${new Date().toLocaleTimeString('ko-KR')})</span>`;
      }
    }
  }, (error) => {
    console.error('Firebase onSnapshot 에러:', error);
    if (saveStatusText) {
      saveStatusText.innerHTML = `<span style="color:#ef4444;">⚠️ Firebase 접근 권한 확인 필요 (로컬 저장 유지)</span>`;
    }
    showToast('⚠️ Firebase 보안 규칙(Rules)을 테스트 모드로 설정해 주세요.');
  });
}

// 3. Save Data (localStorage immediately + Firestore debounced)
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }

  if (saveStatusText) {
    saveStatusText.innerHTML = `<span>⏳ 저장 중...</span>`;
  }

  // Debounce Firestore write
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

// Filter and Sort Data
function getProcessedRecords() {
  let list = [...records];

  // 1. Search Query Filter (Name or Age)
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    list = list.filter(item => 
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.age && item.age.toString().includes(q))
    );
  }

  // 2. Category Filter
  if (currentFilter === '남') {
    list = list.filter(item => item.gender === '남');
  } else if (currentFilter === '여') {
    list = list.filter(item => item.gender === '여');
  } else if (currentFilter === 'recorded') {
    list = list.filter(item => 
      STROKE_FIELDS.some(field => item[field] && item[field].trim() !== '')
    );
  }

  // 3. Sorting
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

      // Record column sort (numeric seconds, empty values at the bottom)
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

      // String comparison
      return sortDirection === 'asc' 
        ? String(valA).localeCompare(String(valB), 'ko')
        : String(valB).localeCompare(String(valA), 'ko');
    });
  }

  return list;
}

// Render Table
function renderTable() {
  const processed = getProcessedRecords();

  tableBody.innerHTML = '';

  if (processed.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="11" style="padding: 40px; color: var(--text-muted); font-size: 14px;">
        일치하는 데이터가 없습니다.
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }

  processed.forEach((item) => {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;

    // Build Row HTML
    tr.innerHTML = `
      <td class="col-no">${item.id}</td>
      <td class="col-age">
        <input type="text" class="cell-input age-input" data-id="${item.id}" data-field="age" value="${escapeHtml(item.age || '')}" placeholder="나이" inputmode="numeric" />
      </td>
      <td class="col-gender">
        <span class="gender-badge ${item.gender === '남' ? 'male' : 'female'}" data-id="${item.id}" data-field="gender" title="클릭하여 성별 전환">
          ${item.gender || '남'}
        </span>
      </td>
      <td class="col-name">
        <input type="text" class="cell-input name-input" data-id="${item.id}" data-field="name" value="${escapeHtml(item.name || '')}" placeholder="이름" />
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
              />
            </div>
          </td>
        `;
      }).join('')}
      <td class="col-actions">
        <button class="btn-icon-danger" data-delete-id="${item.id}" title="회원 삭제">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    `;

    tableBody.appendChild(tr);
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
      message: `기록 부족 (미등록 종목: ${missing.join(', ')})`
    };
  }

  let bestTime = Infinity;
  let bestAge = 0;
  let bestAssignment = null;

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
    return {
      status: 'AGE_NOT_MET',
      message: `도합나이 ${minAge}세 이상 조합 없음 (4명 고유 배정)`
    };
  }
}

// Compute Optimal Relay Combinations
function calculateRelayCombinations() {
  // 1. Combo 1 (핀계영): Total Age >= 240, Men 3 + Women 3, Stroke: 핀자유(finFree) only
  const finMen = records.filter(r => r.gender === '남' && parseFloat(r.finFree) > 0 && parseFloat(r.age) > 0);
  const finWomen = records.filter(r => r.gender === '여' && parseFloat(r.finFree) > 0 && parseFloat(r.age) > 0);

  let combo1Result = null;
  if (finMen.length < 3 || finWomen.length < 3) {
    combo1Result = {
      status: 'NOT_ENOUGH',
      message: `핀자유 기록 부족 (남 ${finMen.length}/3명, 여 ${finWomen.length}/3명)`
    };
  } else {
    const menCombos = getCombinations(finMen, 3);
    const womenCombos = getCombinations(finWomen, 3);
    let bestTime = Infinity;
    let bestAge = 0;
    let bestMembers = null;

    for (const mGroup of menCombos) {
      const mAge = mGroup.reduce((sum, r) => sum + parseFloat(r.age), 0);
      const mTime = mGroup.reduce((sum, r) => sum + parseFloat(r.finFree), 0);

      for (const wGroup of womenCombos) {
        const wAge = wGroup.reduce((sum, r) => sum + parseFloat(r.age), 0);
        const totalAge = mAge + wAge;

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
      combo1Result = {
        status: 'AGE_NOT_MET',
        message: '도합나이 240세 이상 조합 없음'
      };
    }
  }

  // 2. Combo 2 (남계영): Total Age >= 160, Men 4, 배/평/접/자 각 1명씩 배정
  const combo2Result = findBestMedleyRelay('남', 160);

  // 3. Combo 3 (여계영): Total Age >= 160, Women 4, 배/평/접/자 각 1명씩 배정
  const combo3Result = findBestMedleyRelay('여', 160);

  return { combo1: combo1Result, combo2: combo2Result, combo3: combo3Result };
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
  const { combo1, combo2, combo3 } = calculateRelayCombinations();

  // Render Combo 1
  renderComboCard('combo1', combo1, false);
  // Render Combo 2
  renderComboCard('combo2', combo2, true);
  // Render Combo 3
  renderComboCard('combo3', combo3, true);
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
  // Allow only digits and at most one decimal point
  let clean = val.replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) {
    clean = parts[0] + '.' + parts.slice(1).join('');
  }
  return clean;
}

// Event Bindings
function bindEvents() {
  // Table input events delegation
  tableBody.addEventListener('input', (e) => {
    const target = e.target;
    if (!target.classList.contains('cell-input')) return;

    const id = parseInt(target.dataset.id, 10);
    const field = target.dataset.field;
    const record = records.find(r => r.id === id);
    if (!record) return;

    let val = target.value;

    // Strict number filter for records and age
    if (STROKE_FIELDS.includes(field)) {
      const sanitized = sanitizeNumericInput(val);
      if (sanitized !== val) {
        target.value = sanitized;
        val = sanitized;
      }

      // Dynamic color class update
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

    record[field] = val;
    saveData();
    updateStats();
  });

  // Focusout / Change handler: Revert to last year's record if deleted
  tableBody.addEventListener('focusout', (e) => {
    const target = e.target;
    if (!target.classList.contains('record-input')) return;

    const id = parseInt(target.dataset.id, 10);
    const field = target.dataset.field;
    const record = records.find(r => r.id === id);
    if (!record) return;

    const val = target.value.trim();
    const lastYearVal = getLastYearRecord(id, field);

    // If cleared (empty) and a last year record exists, revert back!
    if (val === '' && lastYearVal !== '') {
      target.value = lastYearVal;
      record[field] = lastYearVal;
      target.classList.remove('is-target');
      target.classList.add('is-last-year');
      target.title = '작년기록 (파란색)';
      saveData();
      updateStats();
      showToast(`'${record.name || '회원'}'의 ${STROKE_NAMES[field]} 기록이 작년기록(${lastYearVal}s)으로 원복되었습니다.`);
    }
  });

  // Real-time beforeinput filter to block non-numeric characters before insertion
  tableBody.addEventListener('beforeinput', (e) => {
    const target = e.target;
    if (!target.classList.contains('cell-input')) return;
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
    // Gender Badge Toggle
    const genderBadge = e.target.closest('.gender-badge');
    if (genderBadge) {
      const id = parseInt(genderBadge.dataset.id, 10);
      const record = records.find(r => r.id === id);
      if (record) {
        record.gender = record.gender === '남' ? '여' : '남';
        genderBadge.textContent = record.gender;
        genderBadge.className = `gender-badge ${record.gender === '남' ? 'male' : 'female'}`;
        saveData();
        updateStats();
      }
      return;
    }

    // Delete Button
    const deleteBtn = e.target.closest('[data-delete-id]');
    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.deleteId, 10);
      const record = records.find(r => r.id === id);
      const name = record ? (record.name || '해당 회원') : '해당 회원';
      if (confirm(`'${name}' 회원을 명단에서 삭제하시겠습니까?`)) {
        records = records.filter(r => r.id !== id);
        saveData();
        renderTable();
        updateStats();
        showToast('회원이 삭제되었습니다.');
      }
    }
  });

  // Keyboard navigation across cells
  tableBody.addEventListener('keydown', handleKeyNavigation);

  // Paste from Excel / TSV
  tableBody.addEventListener('paste', handleTablePaste);

  // Search input
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTable();
  });

  // Filter Buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTable();
    });
  });

  // Add Row Button
  btnAddRow.addEventListener('click', () => {
    const newId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
    const newRecord = {
      id: newId,
      age: '',
      gender: '남',
      name: '',
      finFly: '',
      finFree: '',
      free: '',
      back: '',
      breast: '',
      fly: ''
    };
    records.push(newRecord);
    saveData();
    renderTable();
    updateStats();

    // Focus on the new row's name or age
    setTimeout(() => {
      const newInputs = tableBody.querySelectorAll(`input[data-id="${newId}"]`);
      if (newInputs.length > 1) {
        newInputs[1].focus();
      }
    }, 50);

    showToast('새 회원이 추가되었습니다.');
  });

  // Reset Data Button (초기 데이터 복원)
  btnResetData.addEventListener('click', () => {
    if (confirm('모든 데이터를 초기 기본값(37명)으로 되돌리시겠습니까?\n클라우드 및 로컬의 모든 수정사항이 초기화됩니다.')) {
      records = JSON.parse(JSON.stringify(DEFAULT_RECORDS));
      saveData();
      searchQuery = '';
      searchInput.value = '';
      currentFilter = 'all';
      filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
      sortColumn = null;
      renderTable();
      updateStats();
      showToast('초기 데이터로 복원되었습니다.');
    }
  });

  // Toggle Sticky Panel Button
  if (btnToggleSticky) {
    btnToggleSticky.addEventListener('click', () => {
      isStickyPinned = !isStickyPinned;
      applyStickyState(isStickyPinned);
      localStorage.setItem(STICKY_STORAGE_KEY, isStickyPinned ? '1' : '0');
      showToast(isStickyPinned ? '📌 상단 조합 패널이 고정되었습니다.' : '🔓 상단 조합 패널 고정이 해제되었습니다.');
    });
  }

  // Export CSV Button
  btnExportCsv.addEventListener('click', exportToCsv);

  // Copy TSV Button for Excel
  btnCopyTsv.addEventListener('click', copyToClipboardTsv);

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

      // Update header styles
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

  const clipboardData = e.clipboardData || window.clipboardData;
  const pastedText = clipboardData.getData('text');
  if (!pastedText || !pastedText.includes('\t') && !pastedText.includes('\n')) {
    return; // Single value standard paste
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
  renderTable();
  updateStats();
  showToast('엑셀 데이터가 표에 적용되었습니다.');
}

// Copy to Clipboard as TSV (Tab Separated Values)
function copyToClipboardTsv() {
  const headers = ['2026-01-01', '성별', '이름', '핀접영', '핀자유', '자유형', '배영', '평영', '접영'];
  const rows = records.map(r => [
    r.age || '',
    r.gender || '',
    r.name || '',
    r.finFly || '',
    r.finFree || '',
    r.free || '',
    r.back || '',
    r.breast || '',
    r.fly || ''
  ]);

  const tsv = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tsv).then(() => {
      showToast('📋 전체 데이터가 복사되었습니다. 엑셀에 붙여넣기(Ctrl+V)하세요!');
    }).catch(() => {
      fallbackCopy(tsv);
    });
  } else {
    fallbackCopy(tsv);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showToast('📋 전체 데이터가 복사되었습니다. 엑셀에 붙여넣기(Ctrl+V)하세요!');
}

// Export to CSV with UTF-8 BOM
function exportToCsv() {
  const headers = ['2026-01-01', '성별', '이름', '핀접영', '핀자유', '자유형', '배영', '평영', '접영'];
  const rows = records.map(r => [
    `"${(r.age || '').replace(/"/g, '""')}"`,
    `"${(r.gender || '').replace(/"/g, '""')}"`,
    `"${(r.name || '').replace(/"/g, '""')}"`,
    `"${(r.finFly || '').replace(/"/g, '""')}"`,
    `"${(r.finFree || '').replace(/"/g, '""')}"`,
    `"${(r.free || '').replace(/"/g, '""')}"`,
    `"${(r.back || '').replace(/"/g, '""')}"`,
    `"${(r.breast || '').replace(/"/g, '""')}"`,
    `"${(r.fly || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `수영기록표_2026-01-01.csv`);
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
