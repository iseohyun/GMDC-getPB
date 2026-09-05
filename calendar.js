// ==========================================================================
// GMDC Swim Club - Interactive Training Month Calendar Module
// Width-Constrained Responsive Calendar connected to Operation Logs
// Real-time Firestore Sync & LocalStorage Cache-First Architecture
// ==========================================================================

import { firebaseApp } from "./firebase-config.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initAuth } from "./auth.js";
import { 
  OFFICIAL_FIXED_MILESTONES,
  DEFAULT_OPERATION_LOGS,
  cleanTitle, 
  buildCalendarEventsMap,
  loadLocalLogsCache,
  saveLocalLogsCache 
} from "./operation-seed.js";

// Firestore (App singleton provided by firebase-config.js)
const db = getFirestore(firebaseApp);

let currentYear = 2026;
let currentMonth = 9; // 9 = September (1-indexed)
let isShowAllMonths = true; // "모든 월 표시" 기본 활성화

// 0ms Cache-First Initial Custom Events
let firestoreCustomEvents = buildCalendarEventsMap(loadLocalLogsCache());

function formatZero(n) {
  return n < 10 ? '0' + n : String(n);
}

function getLocalDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = formatZero(now.getMonth() + 1);
  const d = formatZero(now.getDate());
  return `${y}-${m}-${d}`;
}

/**
 * Renders a single TD calendar cell
 */
function renderCalendarCell(year, month, day, isOtherMonth = false, isContinuousView = false) {
  const dateKey = `${year}-${formatZero(month)}-${formatZero(day)}`;
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();
  const dayClass = dayOfWeek === 0 ? 'sun' : (dayOfWeek === 6 ? 'sat' : '');

  const todayKey = getLocalDateKey();
  const isToday = !isOtherMonth && (dateKey === todayKey);

  const fixed = OFFICIAL_FIXED_MILESTONES[dateKey] || [];
  const custom = firestoreCustomEvents[dateKey] || [];
  const allEvents = [...fixed, ...custom];

  const hasTraining = allEvents.some(e => e.type === 'training');
  const hasComp = allEvents.some(e => e.type === 'comp');

  let cellClass = `calendar-cell ${dayClass}`;
  if (isOtherMonth) cellClass += ' other-month';
  if (isToday) cellClass += ' today';
  if (hasTraining) cellClass += ' has-training';
  if (hasComp) cellClass += ' has-comp';

  const cellId = isToday ? 'id="calTodayCell"' : '';

  let eventsHtml = '';
  if (allEvents.length > 0) {
    eventsHtml = `<div class="cal-events-list">` + allEvents.map(e => {
      let pillClass = 'pill-notice';
      if (e.type === 'training') pillClass = 'pill-training';
      if (e.type === 'comp') pillClass = 'pill-comp';
      if (e.type === 'meeting') pillClass = 'pill-meeting';
      if (e.type === 'event') pillClass = 'pill-event';
      const displayTitle = cleanTitle(e.title);
      return `
        <a href="meeting_notes.html?date=${dateKey}" class="cal-event-pill ${pillClass}" title="${displayTitle} (운영기록 보기)">
          ${displayTitle}
        </a>
      `;
    }).join('') + `</div>`;
  }

  // Month badge on the 1st of each month in continuous view
  let monthBadgeHtml = '';
  if (isContinuousView && day === 1 && !isOtherMonth) {
    let badgeBg = '#0284c7';
    if (month === 9) badgeBg = '#0369a1';
    if (month === 10) badgeBg = '#d97706';
    monthBadgeHtml = `<span class="cal-month-badge" style="background: ${badgeBg};">${month}월</span>`;
  }

  return `
    <td ${cellId} class="${cellClass}" onclick="if(!event.target.closest('a')) location.href='meeting_notes.html?date=${dateKey}'">
      <div class="cal-date-num">
        <span>${monthBadgeHtml}${day}</span>
        ${hasTraining ? '<span style="font-size:10px; color:#16a34a; font-weight:700;">훈련</span>' : ''}
        ${hasComp ? '<span style="font-size:10px; color:#dc2626; font-weight:700;">대회</span>' : ''}
      </div>
      ${eventsHtml}
    </td>
  `;
}

/**
 * Builds HTML table for a given Single Month
 */
function buildMonthTable(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 6 = Sat
  const lastDate = new Date(year, month, 0).getDate();
  const prevMonthLastDate = new Date(year, month - 1, 0).getDate();

  let cellsHtml = '';
  let dayCount = 0;

  // 1. Previous Month Trailing Days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDate - i;
    const prevMonthNum = month === 1 ? 12 : month - 1;
    const prevYearNum = month === 1 ? year - 1 : year;
    cellsHtml += renderCalendarCell(prevYearNum, prevMonthNum, d, true, false);
    dayCount++;
  }

  // 2. Current Month Days
  for (let d = 1; d <= lastDate; d++) {
    cellsHtml += renderCalendarCell(year, month, d, false, false);
    dayCount++;

    if (dayCount % 7 === 0 && d !== lastDate) {
      cellsHtml += '</tr><tr>';
    }
  }

  // 3. Next Month Leading Days
  let nextDayNum = 1;
  while (dayCount % 7 !== 0) {
    const nextMonthNum = month === 12 ? 1 : month + 1;
    const nextYearNum = month === 12 ? year + 1 : year;
    cellsHtml += renderCalendarCell(nextYearNum, nextMonthNum, nextDayNum, true, false);
    dayCount++;
    nextDayNum++;
  }

  return `
    <table class="calendar-grid">
      <thead>
        <tr>
          <th class="sun">일</th>
          <th>월</th>
          <th>화</th>
          <th>수</th>
          <th>목</th>
          <th>금</th>
          <th class="sat">토</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          ${cellsHtml}
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * Builds Continuous Multi-Month View (8, 9, 10월 연속 캘린더)
 */
function buildAllMonthsContinuousTable(year) {
  const months = [8, 9, 10];
  let fullDaysList = [];

  months.forEach(m => {
    const lastDate = new Date(year, m, 0).getDate();
    for (let d = 1; d <= lastDate; d++) {
      fullDaysList.push({ year, month: m, day: d });
    }
  });

  const firstEntry = fullDaysList[0];
  const firstDow = new Date(firstEntry.year, firstEntry.month - 1, firstEntry.day).getDay();

  let cellsHtml = '';
  let dayCount = 0;

  // Leading days before 8/1 (July trailing days)
  const prevMonthLastDate = new Date(2026, 7, 0).getDate(); // July last day
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevMonthLastDate - i;
    cellsHtml += renderCalendarCell(2026, 7, d, true, true);
    dayCount++;
  }

  // Main continuous days (Aug, Sep, Oct)
  fullDaysList.forEach(entry => {
    cellsHtml += renderCalendarCell(entry.year, entry.month, entry.day, false, true);
    dayCount++;

    if (dayCount % 7 === 0) {
      cellsHtml += '</tr><tr>';
    }
  });

  // Trailing days after 10/31 (November leading days)
  let nextDayNum = 1;
  while (dayCount % 7 !== 0) {
    cellsHtml += renderCalendarCell(2026, 11, nextDayNum, true, true);
    dayCount++;
    nextDayNum++;
  }

  return `
    <div class="calendar-all-months-wrapper">
      <table class="calendar-grid">
        <thead>
          <tr>
            <th class="sun">일</th>
            <th>월</th>
            <th>화</th>
            <th>수</th>
            <th>목</th>
            <th>금</th>
            <th class="sat">토</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            ${cellsHtml}
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Main Calendar Renderer
 */
export function renderCalendarView() {
  const mount = document.getElementById('calendarMountContainer');
  const titleEl = document.getElementById('calCurrentMonthTitle');
  const btnPrev = document.getElementById('btnCalPrevMonth');
  const btnNext = document.getElementById('btnCalNextMonth');
  const btnToggleAll = document.getElementById('btnToggleAllMonths');

  if (!mount) return;

  if (isShowAllMonths) {
    if (titleEl) titleEl.textContent = `${currentYear}년 8월 ~ 10월 전체 일정`;
    if (btnPrev) btnPrev.style.display = 'none';
    if (btnNext) btnNext.style.display = 'none';
    if (btnToggleAll) {
      btnToggleAll.innerHTML = `<span>📅 월별 보기로 전환</span>`;
      btnToggleAll.classList.add('active');
    }
    mount.innerHTML = buildAllMonthsContinuousTable(currentYear);
  } else {
    if (titleEl) titleEl.textContent = `${currentYear}년 ${currentMonth}월`;
    if (btnPrev) {
      btnPrev.style.display = 'inline-flex';
      btnPrev.disabled = (currentMonth <= 8);
    }
    if (btnNext) {
      btnNext.style.display = 'inline-flex';
      btnNext.disabled = (currentMonth >= 10);
    }
    if (btnToggleAll) {
      btnToggleAll.innerHTML = `<span>📅 모든 월 표시</span>`;
      btnToggleAll.classList.remove('active');
    }
    mount.innerHTML = buildMonthTable(currentYear, currentMonth);
  }
}

/**
 * Calendar Toolbar Listeners
 */
export function initCalendarListeners() {
  const btnPrev = document.getElementById('btnCalPrevMonth');
  const btnNext = document.getElementById('btnCalNextMonth');
  const btnToday = document.getElementById('btnCalToday');
  const btnToggleAll = document.getElementById('btnToggleAllMonths');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentMonth > 8) {
        currentMonth--;
        renderCalendarView();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (currentMonth < 10) {
        currentMonth++;
        renderCalendarView();
      }
    });
  }

  if (btnToday) {
    btnToday.addEventListener('click', () => {
      const now = new Date();
      const m = now.getMonth() + 1;
      if (m >= 8 && m <= 10) {
        currentMonth = m;
      } else {
        currentMonth = 9;
      }
      renderCalendarView();

      const todayCell = document.getElementById('calTodayCell');
      if (todayCell) {
        todayCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  if (btnToggleAll) {
    btnToggleAll.addEventListener('click', () => {
      isShowAllMonths = !isShowAllMonths;
      renderCalendarView();
    });
  }

  const btnSaveJpg = document.getElementById('btnSaveAsJpg');
  if (btnSaveJpg) {
    btnSaveJpg.addEventListener('click', async () => {
      const targetEl = document.querySelector('.calendar-card');
      if (!targetEl || typeof html2canvas === 'undefined') {
        alert('이미지 생성 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      const origText = btnSaveJpg.innerHTML;
      btnSaveJpg.disabled = true;
      btnSaveJpg.innerHTML = `<span>⏳ 생성 중...</span>`;

      try {
        const canvas = await html2canvas(targetEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const filename = isShowAllMonths 
          ? `GMDC_거제오션_훈련일정표_8~10월_전체.jpg` 
          : `GMDC_거제오션_훈련일정표_${currentYear}년_${currentMonth}월.jpg`;

        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        const toast = document.getElementById('toast');
        if (toast) {
          toast.textContent = `🖼️ '${filename}' 파일이 저장되었습니다.`;
          toast.className = 'toast show';
          setTimeout(() => { toast.className = 'toast'; }, 3000);
        }
      } catch (err) {
        console.error('JPG 이미지 저장 실패:', err);
        alert('이미지 저장 중 오류가 발생했습니다: ' + err.message);
      } finally {
        btnSaveJpg.disabled = false;
        btnSaveJpg.innerHTML = origText;
      }
    });
  }
}

/**
 * Background Firestore Sync for Calendar (Diff-checked against local cache)
 */
function syncCustomLogsToCalendar() {
  const colRef = collection(db, 'gmdc_operation_logs');
  onSnapshot(colRef, (snap) => {
    const list = [];
    const deletedIds = new Set();
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.isDeleted) {
        deletedIds.add(docSnap.id);
      } else if (data) {
        list.push({ id: docSnap.id, ...data });
      }
    });

    // Merge with default seed logs
    const mergedList = [...list];
    DEFAULT_OPERATION_LOGS.forEach(defLog => {
      if (deletedIds.has(defLog.id)) return;
      const exists = mergedList.some(item => item.id === defLog.id);
      if (!exists) {
        mergedList.push(defLog);
      }
    });

    // Build new events map
    const newMap = buildCalendarEventsMap(mergedList);

    // Diff Check against current state
    const currentJson = JSON.stringify(firestoreCustomEvents);
    const newJson = JSON.stringify(newMap);

    if (currentJson !== newJson) {
      firestoreCustomEvents = newMap;
      saveLocalLogsCache(mergedList);
      renderCalendarView();
    }
  }, (err) => {
    console.warn("Calendar custom events sync error (using local cache):", err);
  });
}

export function initTrainingCalendar() {
  initAuth();
  initCalendarListeners();
  
  // 1. 0ms Immediate Cache Render
  renderCalendarView();

  // 2. Background Firestore Sync
  syncCustomLogsToCalendar();

  // 3. Auto Print Handler for ?print=true query
  const params = new URLSearchParams(window.location.search);
  if (params.get('print') === 'true') {
    isShowAllMonths = true;
    renderCalendarView();
    setTimeout(() => {
      window.print();
    }, 350);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTrainingCalendar);
  } else {
    initTrainingCalendar();
  }
}
