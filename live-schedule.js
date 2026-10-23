// ==========================================================================
// GMDC Swim Club - Real-time Live Schedule Controller
// 대회 당일 실시간 경기 순서, 시간 추론 및 모바일 친화적 조작 인터페이스
// ==========================================================================

import { initAuth, getCurrentUser } from "./auth.js?v=20261023_03";
import { ADULT_RACES_DATA, STUDENT_RACES_DATA } from "./races-data.js?v=20261023_03";
import { 
  subscribeLiveStatus, fetchLiveStatus, startCompetition, nextRace, 
  togglePause, undoLastAction, jumpToRace, calculateScheduleEstimates, 
  formatDuration, getCurrentTimeStr 
} from "./live-service.js?v=20261023_03";

// ─── Module State ──────────────────────────────────────────────────────────
let currentDivision = 'adult'; // 'adult' | 'student'
let currentRaces = ADULT_RACES_DATA;
let liveStatus = null;
let calculatedSchedule = null;
let unsubscribeStatus = null;

let isAutoRefresh = true;
let countdownRemaining = 10;
let toastTimeoutId = null;
let isActionInFlight = false;

// Filter State
const filters = {
  ourTeamOnly: false,
  stroke: 'all',
  gender: 'all',
  group: 'all',
  query: ''
};

// DOM References
const elBtnDivAdult = document.getElementById('btnDivAdult');
const elBtnDivStudent = document.getElementById('btnDivStudent');
const elLiveDot = document.getElementById('liveDot');
const elLiveStatusLabel = document.getElementById('liveStatusLabel');
const elLiveTimeNow = document.getElementById('liveTimeNow');
const elChkAutoRefresh = document.getElementById('chkAutoRefresh');
const elCountdownBadge = document.getElementById('countdownBadge');
const elBtnManualRefresh = document.getElementById('btnManualRefresh');

// Banner
const elBannerTag = document.getElementById('bannerTag');
const elBannerPaceInfo = document.getElementById('bannerPaceInfo');
const elBannerMatchNo = document.getElementById('bannerMatchNo');
const elBannerMatchTitle = document.getElementById('bannerMatchTitle');
const elBannerStartTime = document.getElementById('bannerStartTime');
const elBannerElapsedTime = document.getElementById('bannerElapsedTime');
const elPauseTimeBox = document.getElementById('pauseTimeBox');
const elBannerPauseTime = document.getElementById('bannerPauseTime');

// Action Buttons
const elBtnNextRace = document.getElementById('btnNextRace');
const elBtnNextRaceText = document.getElementById('btnNextRaceText');
const elBtnTogglePause = document.getElementById('btnTogglePause');
const elBtnTogglePauseText = document.getElementById('btnTogglePauseText');
const elBtnUndoAction = document.getElementById('btnUndoAction');
const elSelJumpRace = document.getElementById('selJumpRace');

// Filters
const elBtnOurTeamOnly = document.getElementById('btnOurTeamOnly');
const elTxtOurTeamFilter = document.getElementById('txtOurTeamFilter');
const elOurTeamCountBadge = document.getElementById('ourTeamCountBadge');
const elInputSearch = document.getElementById('inputSearchSwimmer');
const elBtnClearSearch = document.getElementById('btnClearSearch');
const elStrokePillsBar = document.getElementById('strokePillsBar');
const elSelGenderFilter = document.getElementById('selGenderFilter');
const elSelGroupFilter = document.getElementById('selGroupFilter');
const elFilterResultCount = document.getElementById('filterResultCount');

// List Container & Floating Action Button
const elRacesContainer = document.getElementById('racesListContainer');
const elBtnScrollToCurrent = document.getElementById('btnScrollToCurrent');
const elFabCurrentRaceText = document.getElementById('fabCurrentRaceText');

// Toast
const elLiveToastBar = document.getElementById('liveToastBar');
const elToastMessage = document.getElementById('toastMessage');
const elBtnToastUndo = document.getElementById('btnToastUndo');

// ──────────────────────────────────────────────────────────────────────────
// 🚀 Initialization
// ──────────────────────────────────────────────────────────────────────────

async function init() {
  initAuth();

  // URL 쿼리스트링 파라미터 확인 (예: ?div=student)
  const urlParams = new URLSearchParams(window.location.search);
  const divParam = urlParams.get('div');
  if (divParam === 'student' || divParam === 'adult') {
    currentDivision = divParam;
  }

  setupDivisionView(currentDivision);
  bindEvents();
  startClockAndCountdown();
}

/**
 * 성인부/학생부 뷰 설정 및 실시간 구독
 */
function setupDivisionView(div) {
  currentDivision = div;
  currentRaces = div === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;

  // 탭 활성화 상태
  elBtnDivAdult.classList.toggle('active', div === 'adult');
  elBtnDivStudent.classList.toggle('active', div === 'student');

  // 우리 팀 경기 수 배지 업데이트
  const ourTeamCount = currentRaces.filter(r => r.has_our_swimmer).length;
  elOurTeamCountBadge.textContent = ourTeamCount;

  // 그룹 셀렉트 옵션 재구성
  populateGroupFilter(currentRaces);

  // 점프 셀렉트 옵션 재구성
  populateJumpSelect(currentRaces);

  // 이전 Firestore 리스너 해제 후 재구독
  if (unsubscribeStatus) {
    unsubscribeStatus();
  }

  unsubscribeStatus = subscribeLiveStatus(currentDivision, (status) => {
    liveStatus = status;
    updateUI();
  });
}

/**
 * 그룹 필터 옵션 채우기
 */
function populateGroupFilter(races) {
  const groups = new Set();
  races.forEach(r => {
    if (r.group && r.group !== '일반') groups.add(r.group);
  });
  const sorted = Array.from(groups).sort();

  elSelGroupFilter.innerHTML = '<option value="all">전체 그룹</option>';
  sorted.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    elSelGroupFilter.appendChild(opt);
  });
}

/**
 * 점프 셀렉트 옵션 채우기
 */
function populateJumpSelect(races) {
  elSelJumpRace.innerHTML = '<option value="">조 번호로 이동 ▾</option>';
  races.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.race_index;
    opt.textContent = `[${r.primary_match_no}] ${r.title.slice(0, 24)}...`;
    elSelJumpRace.appendChild(opt);
  });
}

// ──────────────────────────────────────────────────────────────────────────
// 🎨 UI Update & Rendering
// ──────────────────────────────────────────────────────────────────────────

function updateUI() {
  if (!liveStatus) return;

  // 1. 시간 추론 엔진 실행
  calculatedSchedule = calculateScheduleEstimates(currentRaces, liveStatus, new Date());

  // 2. 상단 상태 배너 및 컨트롤러 버튼 상태 업데이트
  renderControllerBanner(calculatedSchedule);

  // 3. 레이스 카드 목록 렌더링
  renderRacesList(calculatedSchedule.races);

  // 4. 스크롤 위치 점검 (Active Card 뷰포트 내 존재 여부)
  checkActiveCardVisibility();
}

/**
 * 컨트롤러 상단 배너 렌더링
 */
function renderControllerBanner(data) {
  const { currentIndex, paceFactor, isPaused, currentPauseSec, currentRaceElapsed } = data;
  const isStarted = liveStatus.status === 'running' || liveStatus.status === 'paused' || liveStatus.status === 'finished';

  // 상태 닷 & 레이블
  if (!isStarted || currentIndex === 0) {
    elLiveDot.className = 'live-pulse-dot';
    elLiveDot.style.background = '#94a3b8';
    elLiveStatusLabel.textContent = '대회 시작 대기 중';
    elBtnNextRaceText.textContent = '▶ 대회 시작 (1조 출발)';
    elBtnTogglePause.disabled = true;
    elBtnUndoAction.disabled = true;
    elPauseTimeBox.style.display = 'none';

    elBannerTag.textContent = '시작 전';
    elBannerMatchNo.textContent = '대기';
    elBannerMatchTitle.textContent = '1조가 출발하면 [대회 시작] 버튼을 눌러주세요.';
    elBannerStartTime.textContent = '-';
    elBannerElapsedTime.textContent = '-';
    elBannerPaceInfo.textContent = '기준 소요시간 기반 추론 대기 중';
    return;
  }

  elBtnTogglePause.disabled = false;
  elBtnUndoAction.disabled = false;

  if (liveStatus.status === 'finished') {
    elLiveDot.className = 'live-pulse-dot';
    elLiveDot.style.background = '#64748b';
    elLiveStatusLabel.textContent = '🏁 모든 경기 종료';
    elBtnNextRaceText.textContent = '대회 종료됨';
    elBtnNextRace.disabled = true;
    elBtnTogglePause.disabled = true;
    elPauseTimeBox.style.display = 'none';

    elBannerTag.textContent = '종료';
    elBannerMatchNo.textContent = 'FIN';
    elBannerMatchTitle.textContent = '모든 레이스가 성공적으로 완료되었습니다!';
    elBannerPaceInfo.textContent = `평균 진행 속도 계수: ${paceFactor.toFixed(2)}x`;
    return;
  }

  elBtnNextRace.disabled = false;

  // 현재 진행 중인 레이스 객체
  const curRace = currentRaces[currentIndex - 1];

  if (isPaused) {
    elLiveDot.className = 'live-pulse-dot paused';
    elLiveStatusLabel.textContent = '☕ 현재 휴게(휴식) 중';
    elBtnTogglePause.classList.add('active');
    elBtnTogglePauseText.textContent = '▶ 휴게 종료 (재개)';
    elPauseTimeBox.style.display = 'flex';
    elBannerPauseTime.textContent = formatDuration(currentPauseSec);

    elBannerTag.textContent = '☕ 휴게 시간';
    elBannerMatchNo.textContent = curRace ? curRace.primary_match_no : '-';
    elBannerMatchTitle.textContent = curRace ? `${curRace.title} (휴게 중)` : '휴게 중';
  } else {
    elLiveDot.className = 'live-pulse-dot';
    elLiveStatusLabel.textContent = '🏊‍♂️ 경기 실시간 진행 중';
    elBtnTogglePause.classList.remove('active');
    elBtnTogglePauseText.textContent = '☕ 휴게 시작';
    elPauseTimeBox.style.display = 'none';

    elBannerTag.textContent = '진행 중';
    elBannerMatchNo.textContent = curRace ? curRace.primary_match_no : '-';
    elBannerMatchTitle.textContent = curRace ? curRace.title : '-';
  }

  elBtnNextRaceText.textContent = `⏭ 다음 조 시작 (${currentIndex + 1}조)`;

  // 시작 시각
  if (liveStatus.current_race_started_at) {
    const sD = new Date(liveStatus.current_race_started_at);
    elBannerStartTime.textContent = getCurrentTimeStr(sD);
  } else {
    elBannerStartTime.textContent = '-';
  }

  // 경과 시간
  elBannerElapsedTime.textContent = formatDuration(currentRaceElapsed);

  // 속도 계수 안내
  let paceDesc = '정상 속도';
  if (paceFactor > 1.05) {
    const delayPercent = Math.round((paceFactor - 1.0) * 100);
    paceDesc = `약 ${delayPercent}% 지연 진행 중`;
  } else if (paceFactor < 0.95) {
    const fastPercent = Math.round((1.0 - paceFactor) * 100);
    paceDesc = `약 ${fastPercent}% 빠른 진행 중`;
  }
  elBannerPaceInfo.textContent = `속도 계수: ${paceFactor.toFixed(2)}x (${paceDesc})`;
}

/**
 * 레이스 카드 목록 렌더링
 */
function renderRacesList(races) {
  let visibleCount = 0;

  const html = races.map(race => {
    // 1. 필터 검사
    if (filters.ourTeamOnly && !race.has_our_swimmer) return '';
    if (filters.stroke !== 'all' && race.stroke !== filters.stroke) return '';
    if (filters.gender !== 'all' && race.gender !== filters.gender) return '';
    if (filters.group !== 'all' && race.group !== filters.group) return '';

    // 검색어 필터
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const matchTitle = race.title.toLowerCase().includes(q);
      const matchLanes = race.lanes.some(l => 
        (l.name && l.name.toLowerCase().includes(q)) || 
        (l.team && l.team.toLowerCase().includes(q))
      );
      if (!matchTitle && !matchLanes) return '';
    }

    visibleCount++;

    const isRunning = race.state === 'running';
    const isPaused = race.state === 'paused';
    const isFinished = race.state === 'finished';

    let cardClass = 'race-card';
    if (isRunning) cardClass += ' state-running';
    else if (isPaused) cardClass += ' state-paused';
    else if (isFinished) cardClass += ' state-finished';

    // 시간 뱃지 텍스트
    let primaryTimeBadge = '-';
    let subTimeBadge = '';
    if (isFinished) {
      primaryTimeBadge = race.estimated_start_hm;
      subTimeBadge = race.time_diff_text;
    } else if (isRunning || isPaused) {
      primaryTimeBadge = race.estimated_start_hm;
      subTimeBadge = race.time_diff_text;
    } else {
      primaryTimeBadge = `예상 ${race.estimated_start_hm}`;
      subTimeBadge = race.time_diff_text;
    }

    // 레인 행 생성
    const laneRows = (race.lanes || []).map(l => {
      const isOur = l.is_our_team;
      const rowClass = isOur ? 'lane-row-our-team' : '';
      const ourBadge = isOur ? '<span class="badge-our-swimmer">우리팀</span>' : '';
      const originalMatchTag = race.is_merged && l.original_match_no ? `<span style="font-size:10.5px; color:#64748b; margin-left:4px;">(${l.original_match_no}번)</span>` : '';

      return `
        <tr class="${rowClass}">
          <td class="lane-no">${l.lane}레인</td>
          <td class="lane-name">${l.name || '-'}${ourBadge}${originalMatchTag}</td>
          <td class="lane-team">${l.team || '-'}</td>
          <td class="lane-note" style="color:#94a3b8; font-size:12px;">${l.note || ''}</td>
        </tr>
      `;
    }).join('');

    // 우리 팀 출전 여부 태그
    const ourTeamTag = race.has_our_swimmer 
      ? '<span class="tag-badge our-team">⭐ 우리팀 출전</span>' 
      : '';

    // 합침 태그
    const mergeTag = race.is_merged 
      ? `<span class="tag-badge" style="background:#e0e7ff; color:#4338ca;">통합조: ${race.merge_note || race.merged_match_nos.join(', ')}</span>` 
      : '';

    return `
      <article class="${cardClass}" id="race-card-${race.race_index}" data-race-index="${race.race_index}">
        <div class="race-card-header">
          <div class="card-title-group">
            <span class="card-match-no-badge">${race.primary_match_no}</span>
            <div>
              <h3 class="card-title-text">${race.title}</h3>
              <div class="card-meta-tags">
                <span class="tag-badge">${race.gender}</span>
                <span class="tag-badge">${race.stroke}</span>
                <span class="tag-badge">${race.distance}</span>
                ${ourTeamTag}
                ${mergeTag}
              </div>
            </div>
          </div>

          <div class="card-status-badge">
            <span class="badge-time-primary">${primaryTimeBadge}</span>
            <span class="badge-time-sub">${subTimeBadge}</span>
          </div>
        </div>

        <table class="lanes-table">
          <thead>
            <tr>
              <th style="width: 65px;">레인</th>
              <th style="width: 140px;">선수명</th>
              <th>소속팀</th>
              <th style="width: 80px;">비고</th>
            </tr>
          </thead>
          <tbody>
            ${laneRows || '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:10px;">배정된 선수가 없습니다.</td></tr>'}
          </tbody>
        </table>
      </article>
    `;
  }).join('');

  elRacesContainer.innerHTML = html || '<div class="loading-placeholder">조건에 맞는 경기가 없습니다.</div>';
  elFilterResultCount.textContent = `전체 ${races.length}개 중 ${visibleCount}개 표시`;
}

// ──────────────────────────────────────────────────────────────────────────
// 🖱️ Event Handlers & Protection
// ──────────────────────────────────────────────────────────────────────────

function bindEvents() {
  // 성인부 / 학생부 전환
  elBtnDivAdult.addEventListener('click', () => {
    if (currentDivision !== 'adult') setupDivisionView('adult');
  });
  elBtnDivStudent.addEventListener('click', () => {
    if (currentDivision !== 'student') setupDivisionView('student');
  });

  // 다음 조 시작 (Next Race)
  elBtnNextRace.addEventListener('click', async () => {
    if (isActionInFlight) return;
    isActionInFlight = true;
    elBtnNextRace.disabled = true;

    try {
      const nextStatus = await nextRace(currentDivision);
      liveStatus = nextStatus;
      updateUI();
      showToast(`[${nextStatus.current_race_index}조]가 시작되었습니다.`);
    } catch (err) {
      console.error("nextRace error:", err);
      alert("다음 조 시작 처리 중 오류가 발생했습니다.");
    } finally {
      setTimeout(() => {
        isActionInFlight = false;
        elBtnNextRace.disabled = false;
      }, 1200); // 1.2초 연타 방지
    }
  });

  // 휴게 시작/종료 토글
  elBtnTogglePause.addEventListener('click', async () => {
    if (isActionInFlight) return;
    isActionInFlight = true;

    try {
      const nextStatus = await togglePause(currentDivision);
      liveStatus = nextStatus;
      updateUI();
      showToast(nextStatus.is_paused ? '휴게 모드가 시작되었습니다.' : '휴게가 종료되고 경기가 재개되었습니다.');
    } catch (err) {
      console.error("togglePause error:", err);
    } finally {
      isActionInFlight = false;
    }
  });

  // 이전 조로 되돌리기 (Undo)
  elBtnUndoAction.addEventListener('click', executeUndo);
  elBtnToastUndo.addEventListener('click', executeUndo);

  // 조 번호 점프
  elSelJumpRace.addEventListener('change', async (e) => {
    const val = parseInt(e.target.value, 10);
    if (!val) return;
    if (confirm(`현재 진행 조를 [${val}조]로 변경하시겠습니까?`)) {
      const res = await jumpToRace(currentDivision, val);
      liveStatus = res;
      updateUI();
      showToast(`진행 순서가 [${val}조]로 변경되었습니다.`);
    }
    elSelJumpRace.value = '';
  });

  // 수동 즉시 새로고침
  elBtnManualRefresh.addEventListener('click', async () => {
    countdownRemaining = 10;
    elCountdownBadge.textContent = '10s';
    liveStatus = await fetchLiveStatus(currentDivision);
    updateUI();
  });

  // 자동 갱신 체크박스 변경
  elChkAutoRefresh.addEventListener('change', (e) => {
    isAutoRefresh = e.target.checked;
    if (isAutoRefresh) {
      countdownRemaining = 10;
      elCountdownBadge.style.opacity = '1';
    } else {
      elCountdownBadge.style.opacity = '0.5';
    }
  });

  // 우리 팀만 보기 토글
  elBtnOurTeamOnly.addEventListener('click', () => {
    filters.ourTeamOnly = !filters.ourTeamOnly;
    elBtnOurTeamOnly.setAttribute('data-active', String(filters.ourTeamOnly));
    updateUI();
  });

  // 종목 필터 알약 클릭
  elStrokePillsBar.addEventListener('click', (e) => {
    const pill = e.target.closest('.stroke-pill');
    if (!pill) return;
    document.querySelectorAll('.stroke-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    filters.stroke = pill.getAttribute('data-stroke');
    updateUI();
  });

  // 성별 및 그룹 필터
  elSelGenderFilter.addEventListener('change', (e) => {
    filters.gender = e.target.value;
    updateUI();
  });
  elSelGroupFilter.addEventListener('change', (e) => {
    filters.group = e.target.value;
    updateUI();
  });

  // 선수 검색 인풋
  let searchTimer = null;
  elInputSearch.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    elBtnClearSearch.style.display = val ? 'block' : 'none';
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.query = val;
      updateUI();
    }, 180);
  });
  elBtnClearSearch.addEventListener('click', () => {
    elInputSearch.value = '';
    elBtnClearSearch.style.display = 'none';
    filters.query = '';
    updateUI();
  });

  // 플로팅 "최신 진행 위치로 이동" 버튼 클릭
  elBtnScrollToCurrent.addEventListener('click', scrollToCurrentActiveCard);

  // 스크롤 감지 이벤트 바인딩
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
}

/**
 * 실행 취소 (Undo) 공통 함수
 */
async function executeUndo() {
  if (confirm("직전 조작을 취소하고 이전 상태로 되돌리시겠습니까?")) {
    const res = await undoLastAction(currentDivision);
    liveStatus = res;
    updateUI();
    hideToast();
    showToast("직전 상태로 되돌렸습니다.");
  }
}

/**
 * 1초마다 시계 및 카운트다운 타이머 동작
 */
function startClockAndCountdown() {
  setInterval(async () => {
    // 1. 현재 시각 갱신
    elLiveTimeNow.textContent = getCurrentTimeStr();

    // 2. 현재 조 진행 중 경과 시간 배너 갱신
    if (calculatedSchedule && calculatedSchedule.currentIndex > 0 && liveStatus && liveStatus.current_race_started_at) {
      const curStart = new Date(liveStatus.current_race_started_at);
      const elapsedSec = Math.max(0, Math.round((new Date() - curStart) / 1000));
      elBannerElapsedTime.textContent = formatDuration(elapsedSec);

      if (liveStatus.is_paused && liveStatus.pause_started_at) {
        const pStart = new Date(liveStatus.pause_started_at);
        const pauseSec = Math.max(0, Math.round((new Date() - pStart) / 1000));
        elBannerPauseTime.textContent = formatDuration(pauseSec);
      }
    }

    // 3. 자동 갱신 카운트다운
    if (isAutoRefresh && elChkAutoRefresh.checked) {
      countdownRemaining--;
      if (countdownRemaining <= 0) {
        countdownRemaining = 10;
        // 10초 주기 최신화
        liveStatus = await fetchLiveStatus(currentDivision);
        updateUI();
      }
      elCountdownBadge.textContent = `${countdownRemaining}s`;
    }
  }, 1000);
}

// ──────────────────────────────────────────────────────────────────────────
// 📜 Scroll Position & Floating Action Button Logic
// ──────────────────────────────────────────────────────────────────────────

/**
 * 브라우저 스크롤 이벤트 감지
 * Active Card가 화면 밖으로 벗어나면 자동 갱신 해제 및 플로팅 버튼 노출
 */
function handleWindowScroll() {
  checkActiveCardVisibility();
}

/**
 * 현재 진행 중인 조(Active Card)가 뷰포트에 보이는지 검사
 */
function checkActiveCardVisibility() {
  if (!liveStatus || liveStatus.current_race_index <= 0) {
    elBtnScrollToCurrent.style.display = 'none';
    return;
  }

  const activeCard = document.getElementById(`race-card-${liveStatus.current_race_index}`);
  if (!activeCard) {
    elBtnScrollToCurrent.style.display = 'none';
    return;
  }

  const rect = activeCard.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;

  // 카드가 뷰포트 내에 일부분이라도 보이는지 확인
  const isVisible = (rect.top <= windowHeight && rect.bottom >= 0);

  if (!isVisible) {
    // 화면 밖으로 벗어남 -> 자동 갱신 체크 해제 & 플로팅 버튼 노출!
    if (elChkAutoRefresh.checked) {
      elChkAutoRefresh.checked = false;
      isAutoRefresh = false;
      elCountdownBadge.style.opacity = '0.5';
    }
    elFabCurrentRaceText.textContent = `진행 중 [${liveStatus.current_race_index}조]로 이동`;
    elBtnScrollToCurrent.style.display = 'flex';
  } else {
    // 뷰포트 내에 보임
    elBtnScrollToCurrent.style.display = 'none';
  }
}

/**
 * 현재 진행 중인 카드로 부드럽게 스크롤 점프
 */
function scrollToCurrentActiveCard() {
  if (!liveStatus || liveStatus.current_race_index <= 0) return;
  const activeCard = document.getElementById(`race-card-${liveStatus.current_race_index}`);
  if (activeCard) {
    activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 자동 갱신 다시 체크
    elChkAutoRefresh.checked = true;
    isAutoRefresh = true;
    elCountdownBadge.style.opacity = '1';
    countdownRemaining = 10;
    elBtnScrollToCurrent.style.display = 'none';
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 🍞 Toast Notifications
// ──────────────────────────────────────────────────────────────────────────

function showToast(msg) {
  clearTimeout(toastTimeoutId);
  elToastMessage.textContent = msg;
  elLiveToastBar.style.display = 'flex';

  toastTimeoutId = setTimeout(() => {
    hideToast();
  }, 5000);
}

function hideToast() {
  elLiveToastBar.style.display = 'none';
}

// ──────────────────────────────────────────────────────────────────────────
// DOMContentLoaded
// ──────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
