// ==========================================================================
// GMDC Swim Club - Compact Real-time Live Schedule Controller
// 1열: [순번] [남/여] [종목] [시작시간][시작 아이콘][시작 취소 아이콘]
// 2열: [1레인선수(들)] [2레인선수(들)] [3레인선수(들)] [4레인선수(들)]
// ==========================================================================

import { ADULT_RACES_DATA, STUDENT_RACES_DATA } from "./races-data.js?v=20261026_06";
import { 
  subscribeLiveStatus, subscribeRosterDoc, fetchLiveStatus, getDefaultLiveStatus, getInitialLiveStatus,
  startRaceAt, cancelRaceAt, startBreak, endBreak, cancelBreak,
  finishAllRaces, cancelFinishAllRaces,
  calculateScheduleEstimates, formatMMSS, formatTimeHM
} from "./live-service.js?v=20261026_06";

// 모집요강(5. 경기 일정 및 순서) 기준 부별 종목 순서 매핑
const PROSPECTUS_EVENT_ORDER = {
  student: {
    '계영 200m': 1,
    '접영 50m': 2,
    '배영 50m': 3,
    '평영 50m': 4,
    '자유형 50m': 5,
    '혼계영 200m': 6
  },
  adult: {
    '핀접영 50m': 1,
    '배영 50m': 2,
    '계영 200m': 3,
    '접영 50m': 4,
    '핀자유형 50m': 5,
    '평영 50m': 6,
    '혼계영 200m': 7,
    '자유형 50m': 8,
    '혼성핀계영 300m': 9
  }
};

// ─── 기본 명부 및 단체전 영자 데이터 (Firestore 실시간 동기화 전 즉시 사용) ───
const DEFAULT_STUDENT_ROSTER = [
  { id: 1, age: "8", group: "2그룹", gender: "남", name: "배건우", phone: "010-9729-3224", team: "거제야르" },
  { id: 2, age: "9", group: "3그룹", gender: "남", name: "김예준", phone: "010-4779-4105", team: "거제야르" },
  { id: 3, age: "9", group: "3그룹", gender: "남", name: "한고준", phone: "010-2541-1426", team: "거제야르" },
  { id: 4, age: "10", group: "4그룹", gender: "남", name: "손민재", phone: "010-7142-8269", team: "거제야르" },
  { id: 5, age: "10", group: "4그룹", gender: "여", name: "이유빈", phone: "010-4101-8171", team: "거제야르" },
  { id: 20, age: "11", group: "5그룹", gender: "남", name: "김하준", phone: "010-4779-4105", team: "거제야르" },
  { id: 6, age: "11", group: "5그룹", gender: "남", name: "양서진", phone: "010-4252-4589", team: "거제야르" },
  { id: 7, age: "11", group: "5그룹", gender: "남", name: "이우리", phone: "010-6337-7471", team: "거제야르" },
  { id: 8, age: "11", group: "5그룹", gender: "여", name: "김서윤", phone: "010-9822-2363", team: "거제야르" },
  { id: 9, age: "11", group: "5그룹", gender: "여", name: "류다윤", phone: "010-8738-1436", team: "거제야르" },
  { id: 10, age: "11", group: "5그룹", gender: "여", name: "이나라", phone: "010-6337-7471", team: "거제야르" },
  { id: 11, age: "11", group: "5그룹", gender: "여", name: "이은서", phone: "010-8266-4030", team: "거제야르" },
  { id: 12, age: "11", group: "5그룹", gender: "여", name: "지혜람", phone: "010-4592-9948", team: "거제야르" },
  { id: 13, age: "11", group: "5그룹", gender: "여", name: "한예진", phone: "010-5048-8145", team: "거제야르" },
  { id: 14, age: "12", group: "6그룹", gender: "남", name: "김루민", phone: "010-6677-7875", team: "거제야르" },
  { id: 15, age: "12", group: "6그룹", gender: "남", name: "오태훈", phone: "010-4872-4910", team: "거제야르" },
  { id: 16, age: "15", group: "7그룹", gender: "남", name: "박현민", phone: "010-4447-5186", team: "거제야르" },
  { id: 17, age: "13", group: "7그룹", gender: "남", name: "이선우", phone: "010-4101-8171", team: "거제야르" },
  { id: 18, age: "13", group: "7그룹", gender: "여", name: "안서윤", phone: "010-4005-7171", team: "거제야르" },
  { id: 19, age: "14", group: "7그룹", gender: "여", name: "정채윤", phone: "010-8312-5384", team: "거제야르" },
  { id: 21, age: "8", group: "2그룹", gender: "여", name: "이설하", phone: "010-9374-1091", team: "거제야르" },
  { id: 22, age: "8", group: "2그룹", gender: "여", name: "지상희", phone: "010-3419-1020", team: "거제야르" },
  { id: 23, age: "10", group: "4그룹", gender: "남", name: "이승후", phone: "010-9374-1091", team: "거제야르" },
  { id: 24, age: "8", group: "2그룹", gender: "남", name: "이서빈", phone: "010-3016-1982", team: "거제야르" }
];

const DEFAULT_ADULT_ROSTER = [
  { id: 1, group: "1그룹", gender: "남", name: "박슬우", team: "거제몽꾸", phone: "010-2558-7116" },
  { id: 2, group: "1그룹", gender: "남", name: "이지훈", team: "거제몽꾸", phone: "010-4176-0239" },
  { id: 4, group: "1그룹", gender: "남", name: "조성찬", team: "거제몽꾸", phone: "010-6681-9874" },
  { id: 5, group: "1그룹", gender: "여", name: "이지호", team: "거제몽꾸", phone: "010-6451-0229" },
  { id: 6, group: "2그룹", gender: "여", name: "추성비", team: "거제몽꾸", phone: "010-2818-2055" },
  { id: 7, group: "2그룹", gender: "여", name: "이영경", team: "거제몽꾸", phone: "010-6327-7828" },
  { id: 8, group: "3그룹", gender: "남", name: "안재홍", team: "거제몽꾸", phone: "010-7199-7719" },
  { id: 9, group: "3그룹", gender: "여", name: "노언영", team: "거제몽꾸", phone: "010-3833-3074" },
  { id: 10, group: "3그룹", gender: "여", name: "최이슬", team: "거제몽꾸", phone: "010-2398-6484" },
  { id: 11, group: "4그룹", gender: "남", name: "고석보", team: "거제몽꾸", phone: "010-4040-6987" },
  { id: 12, group: "4그룹", gender: "남", name: "김기용", team: "거제몽꾸", phone: "010-4018-3188" },
  { id: 13, group: "4그룹", gender: "남", name: "김준영", team: "거제몽꾸", phone: "010-4572-7285" },
  { id: 14, group: "4그룹", gender: "남", name: "손철수", team: "거제몽꾸", phone: "010-7142-8269" },
  { id: 15, group: "4그룹", gender: "남", name: "안상준", team: "거제몽꾸", phone: "010-4005-7171" },
  { id: 16, group: "4그룹", gender: "남", name: "양승진", team: "거제야르", phone: "010-4252-4589" },
  { id: 17, group: "4그룹", gender: "남", name: "이도형", team: "거제야르", phone: "010-5155-2728" },
  { id: 18, group: "4그룹", gender: "남", name: "정서현", team: "거제야르", phone: "010-4266-4766" },
  { id: 19, group: "4그룹", gender: "여", name: "김상희", team: "거제야르", phone: "010-6880-5472" },
  { id: 20, group: "4그룹", gender: "여", name: "박다유", team: "거제몽꾸", phone: "010-8234-5210" },
  { id: 21, group: "4그룹", gender: "여", name: "손혜정", team: "거제몽꾸", phone: "010-8603-9827" },
  { id: 22, group: "4그룹", gender: "여", name: "심민경", team: "거제야르", phone: "010-9611-8332" },
  { id: 23, group: "4그룹", gender: "여", name: "여수연", team: "거제야르", phone: "010-3723-8453" },
  { id: 24, group: "4그룹", gender: "여", name: "이미영", team: "거제몽꾸", phone: "010-9688-1754" },
  { id: 25, group: "4그룹", gender: "여", name: "이은희", team: "거제야르", phone: "010-7456-1512" },
  { id: 26, group: "5그룹", gender: "남", name: "박재홍", team: "거제몽꾸", phone: "010-8707-5940" },
  { id: 27, group: "5그룹", gender: "남", name: "박진홍", team: "거제몽꾸", phone: "010-2517-9826" },
  { id: 28, group: "5그룹", gender: "남", name: "서충근", team: "거제몽꾸", phone: "010-5566-3542" },
  { id: 29, group: "5그룹", gender: "남", name: "성지경", team: "거제몽꾸", phone: "010-2587-7399" },
  { id: 30, group: "5그룹", gender: "남", name: "이경열", team: "거제몽꾸", phone: "010-5065-8643" },
  { id: 31, group: "5그룹", gender: "여", name: "김애란", team: "거제야르", phone: "010-5146-9873" },
  { id: 32, group: "5그룹", gender: "여", name: "박선화", team: "거제몽꾸", phone: "010-2599-6441" },
  { id: 33, group: "5그룹", gender: "여", name: "전경미", team: "거제몽꾸", phone: "010-6332-4009" },
  { id: 34, group: "6그룹", gender: "남", name: "박봉권", team: "거제몽꾸", phone: "010-9669-5629" },
  { id: 35, group: "6그룹", gender: "남", name: "성환용", team: "거제몽꾸", phone: "010-9689-2830" },
  { id: 36, group: "6그룹", gender: "여", name: "송원자", team: "거제몽꾸", phone: "010-2854-3715" },
  { id: 37, group: "6그룹", gender: "여", name: "최지희", team: "거제몽꾸", phone: "010-3560-6375" },
  { id: 38, group: "6그룹", gender: "남", name: "권순용", team: "거제야르", phone: "010-5890-7052" },
  { id: 39, group: "2그룹", gender: "남", name: "정성민", team: "거제야르", phone: "010-9989-7218" },
  { id: 42, group: "5그룹", gender: "남", name: "서정찬", team: "거제몽꾸", phone: "010-8501-0605" },
  { id: 43, group: "4그룹", gender: "남", name: "윤주권", team: "거제야르", phone: "010-6606-7048" }
];

// 현재 DB 기준 단체전 영자 구성 기본값
let adultPinnedRelays = {
  A: {
    combo1: ['이지훈', '서충근', '박재홍', '이지호', '전경미', '박선화'],
    combo2: ['박슬우', '안상준', '김기용', '서정찬'],
    combo3: ['이영경', '손혜정', '이미영', '송원자'],
    combo4: { back: '조성찬', breast: '서정찬', fly: '안상준', free: '박재홍' },
    combo5: { back: '전경미', breast: '이미영', fly: '이지호', free: '손혜정' }
  },
  B: {
    combo1: ['정서현', '권순용', '이도형', '김애란', '여수연', '김상희'],
    combo2: ['정서현', '권순용', '양승진', '정성민'],
    combo3: ['이은희', '김애란', '김상희', '심민경'],
    combo4: { back: '정서현', breast: '권순용', fly: '윤주권', free: '정성민' },
    combo5: { back: '심민경', breast: '이은희', fly: '김애란', free: '김상희' }
  }
};

let studentPinnedRelays = {
  combo1: ['배건우', '손민재', '양서진', '김루민'],
  combo2: ['지상희', '이유빈', '지혜람', '이은서'],
  combo3: { back: '김하준', breast: '김예준', fly: '양서진', free: '이서빈' },
  combo4: { back: '김서윤', breast: '이유빈', fly: '류다윤', free: '이설하' }
};

let studentRosterMap = new Map(DEFAULT_STUDENT_ROSTER.map(s => [s.name, s]));
let adultRosterList = [...DEFAULT_ADULT_ROSTER];

// ─── Module State ──────────────────────────────────────────────────────────
let currentDivision = 'adult'; // 'adult' | 'student'
let currentRaces = ADULT_RACES_DATA;
let liveStatus = null;
let calculatedSchedule = null;
let unsubscribeStatus = null;
let unsubscribeRoster = null;

let isAutoRefresh = true;
let countdownRemaining = 10;
let toastTimeoutId = null;
let isActionInFlight = false;
let searchQuery = '';

// ─── DOM References ────────────────────────────────────────────────────────
const elLiveMainContainer = document.getElementById('liveMainContainer');
const elLiveControllerCard = document.getElementById('liveControllerCard');
const elCtrlCurrentNo = document.getElementById('ctrlCurrentNo');
const elCtrlCurrentEvent = document.getElementById('ctrlCurrentEvent');
const elCtrlPaceInfo = document.getElementById('ctrlPaceInfo');
const elBtnScrollCurrentRace = document.getElementById('btnScrollCurrentRace');
const elBtnDownloadScheduleImage = document.getElementById('btnDownloadScheduleImage');
const elBtnStartBreak = document.getElementById('btnStartBreak');
const elBtnAutoRefreshToggle = document.getElementById('btnAutoRefreshToggle');
const elCountdownBadge = document.getElementById('countdownBadge');
const elBtnManualRefresh = document.getElementById('btnManualRefresh');

const elCtrlSearchBox = document.getElementById('ctrlSearchBox');
const elInputSearch = document.getElementById('inputSearchSwimmer');
const elBtnClearSearch = document.getElementById('btnClearSearch');
const elSwimmerSuggestDropdown = document.getElementById('swimmerSuggestDropdown');

const elRacesContainer = document.getElementById('racesListContainer');

// Student Modal DOM
const elStudentModal = document.getElementById('studentInfoModal');
const elBtnCloseStudentModal = document.getElementById('btnCloseStudentModal');
const elModalStudentPhoto = document.getElementById('modalStudentPhoto');
const elModalStudentName = document.getElementById('modalStudentName');
const elModalStudentMeta = document.getElementById('modalStudentMeta');
const elBtnCopyStudentPhone = document.getElementById('btnCopyStudentPhone');
const elModalStudentPhone = document.getElementById('modalStudentPhone');
const elModalCopyHint = document.getElementById('modalCopyHint');

// Toast DOM
const elLiveToastBar = document.getElementById('liveToastBar');
const elToastMessage = document.getElementById('toastMessage');

// Floating Stroke Order Bar DOM
const elFloatingStrokeBar = document.getElementById('floatingStrokeOrderBar');
const elFsbVerticalPanel = document.getElementById('fsbVerticalPanel');
const elBtnToggleFsbVertical = document.getElementById('btnToggleFsbVertical');
const elFsbStepsTrack = document.getElementById('fsbStepsTrack');
const elBtnCloseFloatingStrokeBar = document.getElementById('btnCloseFloatingStrokeBar');
let isFsbExpanded = false;
let fsbForcedStepKey = null;
let fsbForcedStepUntil = 0;

// 부별 실제 경기 진행 종목 순서 (성인부 9종목 / 학생부 6종목)
const DIVISION_STROKE_STEPS = {
  adult: [
    { key: '핀접영',     shortLabel: '핀접',   fullLabel: '1. 핀접영 50m (#1~#20)',         firstRaceIndex: 1 },
    { key: '배영',       shortLabel: '배영',   fullLabel: '2. 배영 50m (#21~#35)',          firstRaceIndex: 21 },
    { key: '계영',       shortLabel: '계영',   fullLabel: '3. 계영 200m (#36~#39)',         firstRaceIndex: 36 },
    { key: '접영',       shortLabel: '접영',   fullLabel: '4. 접영 50m (#40~#59)',          firstRaceIndex: 40 },
    { key: '핀자유형',   shortLabel: '핀자',   fullLabel: '5. 핀자유형 50m (#60~#83)',      firstRaceIndex: 60 },
    { key: '평영',       shortLabel: '평영',   fullLabel: '6. 평영 50m (#84~#105)',         firstRaceIndex: 84 },
    { key: '혼계영',     shortLabel: '혼계영', fullLabel: '7. 혼계영 200m (#106~#109)',     firstRaceIndex: 106 },
    { key: '자유형',     shortLabel: '자유형', fullLabel: '8. 자유형 50m (#110~#139)',      firstRaceIndex: 110 },
    { key: '혼성핀계영', shortLabel: '혼성핀', fullLabel: '9. 혼성 핀계영 300m (#140~#141)', firstRaceIndex: 140 }
  ],
  student: [
    { key: '계영',   shortLabel: '계영',   fullLabel: '1. 계영 200m (#1~#6)',      firstRaceIndex: 1 },
    { key: '접영',   shortLabel: '접영',   fullLabel: '2. 접영 50m (#7~#46)',      firstRaceIndex: 7 },
    { key: '배영',   shortLabel: '배영',   fullLabel: '3. 배영 50m (#47~#93)',     firstRaceIndex: 47 },
    { key: '평영',   shortLabel: '평영',   fullLabel: '4. 평영 50m (#94~#148)',    firstRaceIndex: 94 },
    { key: '자유형', shortLabel: '자유형', fullLabel: '5. 자유형 50m (#149~#226)', firstRaceIndex: 149 },
    { key: '혼계영', shortLabel: '혼계영', fullLabel: '6. 혼계영 200m (#227~#232)', firstRaceIndex: 227 }
  ]
};

let fsbClosedAtScrollY = null;
let fsbLastActiveStepKey = null;
let fsbLastDivision = null;
let fsbScrollRafId = null;

// ──────────────────────────────────────────────────────────────────────────
// 🚀 Initialization
// ──────────────────────────────────────────────────────────────────────────

function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const divParam = urlParams.get('div');
  if (divParam === 'student' || divParam === 'adult') {
    currentDivision = divParam;
  }

  setupFixedControllerOffset();
  setupDivisionView(currentDivision);
  bindEvents();
  startCountdownTimer();

  // 느린 인터넷 환경에서도 대진표가 0ms 만에 먼저 표시되도록 인증 모듈은 백그라운드에서 비동기 초기화
  import("./auth.js?v=20261024_19")
    .then(mod => mod.initAuth())
    .catch(err => console.warn("[LiveSchedule] Auth init delayed:", err));
}

function setupFixedControllerOffset() {
  if (!elLiveControllerCard || !elLiveMainContainer) return;
  const syncOffset = () => {
    const h = elLiveControllerCard.offsetHeight;
    if (h > 0) {
      elLiveMainContainer.style.paddingTop = `${h + 10}px`;
    }
  };
  syncOffset();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(syncOffset);
    ro.observe(elLiveControllerCard);
  } else {
    window.addEventListener('resize', syncOffset);
  }
}

function setupDivisionView(div) {
  currentDivision = div;
  currentRaces = div === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;

  // 네트워크 응답을 기다리지 않고 브라우저가 기억하는 이전 시작 상태(localStorage) + 대진표를 0ms 만에 즉시 렌더링
  liveStatus = getInitialLiveStatus(currentDivision);
  updateUI();

  // 실시간 진행 상태 구독
  if (unsubscribeStatus) unsubscribeStatus();
  unsubscribeStatus = subscribeLiveStatus(currentDivision, (status) => {
    liveStatus = status;
    updateUI();
  });

  // 명부(DB) 단체전 영자 및 연락처 실시간 구독
  if (unsubscribeRoster) unsubscribeRoster();
  unsubscribeRoster = subscribeRosterDoc(currentDivision, (docData) => {
    if (!docData) return;
    if (currentDivision === 'student') {
      if (docData.pinnedRelays) {
        studentPinnedRelays = { ...studentPinnedRelays, ...docData.pinnedRelays };
      }
      if (Array.isArray(docData.records)) {
        docData.records.forEach(r => {
          if (r && r.name) {
            const existing = studentRosterMap.get(r.name) || {};
            studentRosterMap.set(r.name, {
              ...existing,
              id: r.id || existing.id,
              name: r.name,
              group: r.group || existing.group || '',
              age: r.age || existing.age || '',
              gender: r.gender || existing.gender || '',
              phone: r.phone || existing.phone || '',
              team: '거제야르'
            });
          }
        });
      }
    } else {
      if (docData.pinnedRelays) {
        adultPinnedRelays = {
          A: { ...adultPinnedRelays.A, ...(docData.pinnedRelays.A || {}) },
          B: { ...adultPinnedRelays.B, ...(docData.pinnedRelays.B || {}) }
        };
      }
      if (Array.isArray(docData.records)) {
        const activeAdults = docData.records.filter(r => r && r.name && !r.disabled);
        if (activeAdults.length > 0) {
          adultRosterList = activeAdults.map(r => ({
            id: r.id,
            name: r.name,
            group: r.group || '',
            gender: r.gender || '',
            phone: r.phone || '',
            team: r.team === 'B' ? '거제야르' : '거제몽꾸'
          }));
        }
      }
    }
    updateUI();
  });
}

// ──────────────────────────────────────────────────────────────────────────
// 🏊 단체전(계영·혼계영·핀계영) 우리 팀 영자 목록 조회 (DB 연동)
// ──────────────────────────────────────────────────────────────────────────

function getOurRelaySwimmers(race, teamName) {
  if (!race.is_relay) return null;
  if (teamName !== '거제몽꾸' && teamName !== '거제야르') return null;

  if (race.division === '성인부') {
    const teamKey = teamName === '거제몽꾸' ? 'A' : 'B';
    const cfg = adultPinnedRelays[teamKey];
    if (!cfg) return null;

    if (race.stroke === '혼성핀계영' || race.title.includes('혼성 핀계영')) {
      return Array.isArray(cfg.combo1) ? cfg.combo1.filter(Boolean) : null;
    }
    if (race.gender === '남자' && race.stroke === '계영') {
      return Array.isArray(cfg.combo2) ? cfg.combo2.filter(Boolean) : null;
    }
    if (race.gender === '여자' && race.stroke === '계영') {
      return Array.isArray(cfg.combo3) ? cfg.combo3.filter(Boolean) : null;
    }
    if (race.gender === '남자' && race.stroke === '혼계영' && cfg.combo4) {
      return [cfg.combo4.back, cfg.combo4.breast, cfg.combo4.fly, cfg.combo4.free].filter(Boolean);
    }
    if (race.gender === '여자' && race.stroke === '혼계영' && cfg.combo5) {
      return [cfg.combo5.back, cfg.combo5.breast, cfg.combo5.fly, cfg.combo5.free].filter(Boolean);
    }
  } else if (race.division === '학생부' && teamName === '거제야르') {
    const cfg = studentPinnedRelays;
    if (!cfg) return null;

    if (race.gender === '남자' && race.stroke === '계영') {
      return Array.isArray(cfg.combo1) ? cfg.combo1.filter(Boolean) : null;
    }
    if (race.gender === '여자' && race.stroke === '계영') {
      return Array.isArray(cfg.combo2) ? cfg.combo2.filter(Boolean) : null;
    }
    if (race.gender === '남자' && race.stroke === '혼계영' && cfg.combo3) {
      return [cfg.combo3.back, cfg.combo3.breast, cfg.combo3.fly, cfg.combo3.free].filter(Boolean);
    }
    if (race.gender === '여자' && race.stroke === '혼계영' && cfg.combo4) {
      return [cfg.combo4.back, cfg.combo4.breast, cfg.combo4.fly, cfg.combo4.free].filter(Boolean);
    }
  }
  return null;
}

/**
 * 종목 표시 문자열 압축 (1열의 [종목] 영역용)
 * 예: "성인부 남자 1그룹 핀접영 50m 결승 (1번,2번 합침)" -> "1그룹 핀접영 50m (1번,2번 합침)"
 */
function formatCompactEventTitle(race) {
  let t = race.title || '';
  t = t.replace(/^(성인부|학생부)\s*/, '');
  t = t.replace(/^(남자|여자|혼성)\s*/, '');
  t = t.replace(/\s*결승/, '');
  return t.trim();
}

/**
 * 상단 ctrlCurrentEvent 표시 포맷:
 * [모집요강에 올라온 경기순번+경기순서] [남여] [그룹]
 * 예: "[2. 접영 50m] [남자] [3그룹]"
 */
function formatProspectusCurrentEvent(race, division) {
  if (!race) return '';
  const eventKey = `${race.stroke || ''} ${race.distance || ''}`.trim();
  const orderMap = PROSPECTUS_EVENT_ORDER[division] || {};
  const orderNo = orderMap[eventKey];
  const eventLabel = orderNo ? `${orderNo}. ${eventKey}` : eventKey;
  const genderLabel = race.gender || '-';
  const groupLabel = race.group || '-';
  return `[${eventLabel}] [${genderLabel}] [${groupLabel}]`;
}

// ──────────────────────────────────────────────────────────────────────────
// 🎨 UI Rendering
// ──────────────────────────────────────────────────────────────────────────

function updateUI() {
  if (!liveStatus) return;

  calculatedSchedule = calculateScheduleEstimates(currentRaces, liveStatus, new Date());
  renderControllerHeader(calculatedSchedule);
  renderRacesList(calculatedSchedule.races, calculatedSchedule.breaks || []);
}

/**
 * 상단 live-controller-card 1행 렌더링:
 * [현재/전체 n%] [현재 종목] [평균 경기 진행속도] [현재 경기 이동] [휴게 시작] [자동갱신여부] [갱신대기시간(초)][즉시 새로고침 아이콘]
 */
function renderControllerHeader(data) {
  const { currentIndex, avgIndivSec, avgRelaySec, activeBreak } = data;
  const totalRaces = currentRaces.length || 1;
  const isStarted = liveStatus.status === 'running' || liveStatus.status === 'paused' || liveStatus.status === 'finished';

  if (elCtrlPaceInfo) {
    elCtrlPaceInfo.textContent = `평균 경기 진행속도:(${formatMMSS(avgIndivSec)})(단체전:${formatMMSS(avgRelaySec)})`;
  }

  if (elBtnStartBreak) {
    elBtnStartBreak.classList.toggle('active', Boolean(activeBreak));
    elBtnStartBreak.textContent = activeBreak ? '☕ 휴게 중' : '☕ 휴게 시작';
  }

  const isPendingSync = Boolean(liveStatus.pending_sync);

  if (elCtrlCurrentNo) {
    elCtrlCurrentNo.classList.toggle('is-pending-sync', isPendingSync);
    elCtrlCurrentNo.title = isPendingSync
      ? '⏳ DB 서버 반영 대기 중 (백그라운드 자동 재시도 중) · 클릭 시 현재 경기로 이동'
      : '클릭 시 현재 진행 순번으로 스크롤 이동';
  }

  if (elBtnManualRefresh) {
    elBtnManualRefresh.classList.toggle('is-pending-sync', isPendingSync);
    elBtnManualRefresh.title = isPendingSync
      ? '⏳ DB 서버와 동기화 중 (클릭 시 즉시 재시도)'
      : '즉시 새로고침';
  }

  if (activeBreak) {
    const afterIdx = activeBreak.after_race_index || currentIndex || 1;
    const pct = Math.round((afterIdx / totalRaces) * 100);
    const afterRace = currentRaces[afterIdx - 1];
    if (elCtrlCurrentNo) {
      elCtrlCurrentNo.textContent = `[${afterIdx}/${totalRaces} ${pct}%]`;
      elCtrlCurrentNo.classList.remove('is-waiting');
      elCtrlCurrentNo.classList.add('is-break');
    }
    if (elCtrlCurrentEvent) {
      elCtrlCurrentEvent.textContent = afterRace
        ? `${formatProspectusCurrentEvent(afterRace, currentDivision)} · ☕ 휴게 진행 중`
        : '☕ 휴게 진행 중';
    }
    return;
  }

  if (!isStarted || currentIndex === 0) {
    if (elCtrlCurrentNo) {
      elCtrlCurrentNo.textContent = `[0/${totalRaces} 0%]`;
      elCtrlCurrentNo.classList.add('is-waiting');
      elCtrlCurrentNo.classList.remove('is-break');
    }
    if (elCtrlCurrentEvent) {
      const divLabel = currentDivision === 'student' ? '학생부(24일)' : '성인부(25일)';
      elCtrlCurrentEvent.textContent = `${divLabel} · 공식 시작 08:30 (▶ 아이콘으로 경기 시작)`;
    }
    return;
  }

  const curRace = currentRaces[currentIndex - 1];
  if (curRace) {
    const pct = Math.round((curRace.race_index / totalRaces) * 100);
    if (elCtrlCurrentNo) {
      elCtrlCurrentNo.textContent = `[${curRace.race_index}/${totalRaces} ${pct}%]`;
      elCtrlCurrentNo.classList.remove('is-waiting', 'is-break');
    }
    if (elCtrlCurrentEvent) {
      const baseText = formatProspectusCurrentEvent(curRace, currentDivision);
      if (liveStatus.status === 'finished') {
        const lastHist = Array.isArray(liveStatus.history)
          ? liveStatus.history.find(h => h.race_index === totalRaces)
          : null;
        const finIso = liveStatus.finished_at || lastHist?.finished_at;
        const finTimeLabel = finIso ? formatTimeHM(new Date(finIso)) : '17:05';
        elCtrlCurrentEvent.textContent = `${baseText} · 🏁 전 경기 종료 (${finTimeLabel})`;
      } else {
        elCtrlCurrentEvent.textContent = baseText;
      }
    }
  }
}

/**
 * 각 race-card 및 휴게(break-card) 렌더링
 * 1열: [index] [순번] [남/여] [종목] [시작시간][시작 아이콘][시작 취소 아이콘]
 * 2열: [1레인선수(들)] [2레인선수(들)] [3레인선수(들)] [4레인선수(들)]
 */
function renderRacesList(races, breaks = []) {
  if (!elRacesContainer) return;

  const q = searchQuery.toLowerCase();
  const breaksByAfterIdx = new Map();
  breaks.forEach(b => {
    const idx = Number(b.after_race_index) || 1;
    if (!breaksByAfterIdx.has(idx)) breaksByAfterIdx.set(idx, []);
    breaksByAfterIdx.get(idx).push(b);
  });

  const html = races.map(race => {
    // 각 레인(1~4레인)에 표시할 선수명(들) 및 소속팀 판별
    const laneDataByNo = { 1: [], 2: [], 3: [], 4: [] };
    (race.lanes || []).forEach(l => {
      const laneNo = Number(l.lane);
      if (laneNo >= 1 && laneNo <= 4) {
        const relaySwimmers = getOurRelaySwimmers(race, l.team);
        laneDataByNo[laneNo].push({
          ...l,
          relaySwimmers
        });
      }
    });

    // 해당 순번(race_index) 다음에 등록된 휴게(break-card) 렌더링 문자열 생성
    const attachedBreaks = breaksByAfterIdx.get(race.race_index) || [];
    const breaksHtml = attachedBreaks.map(brk => {
      const isBreakScheduled = brk.state === 'scheduled';
      const isBreakRunning = brk.state === 'running';

      if (isBreakScheduled) {
        const schedSec = brk.duration_sec || brk.scheduled_duration_sec || 600;
        const schedMin = Math.round(schedSec / 60);
        const estStart = brk.estimated_started_at ? new Date(brk.estimated_started_at) : null;
        const estEnd = brk.estimated_finished_at ? new Date(brk.estimated_finished_at) : null;
        const estTimeStr = estStart
          ? (estEnd ? `예상 ${formatTimeHM(estStart)}~${formatTimeHM(estEnd)}` : `예상 ${formatTimeHM(estStart)}`)
          : `예정 ${schedMin}분`;
        const descText = brk.label || `예정 휴식 (${formatMMSS(schedSec)})`;

        return `
          <article class="race-card break-card state-break-scheduled" id="break-card-${escapeHtml(brk.id)}" data-break-id="${escapeHtml(brk.id)}">
            <div class="rc-row-1">
              <span class="rc-break-badge">☕ 예정 휴식 (${schedMin}분)</span>
              <span class="rc-break-title">#${race.race_index} (${escapeHtml(race.primary_match_no)}번) 다음 · ${escapeHtml(descText)}</span>
              <div class="rc-right-controls">
                <span class="rc-time">${escapeHtml(estTimeStr)}</span>
                <button type="button" class="rc-btn-break-start" data-action="start-scheduled-break" data-break-id="${escapeHtml(brk.id)}">▶ 휴게 시작</button>
                <button type="button" class="rc-btn-break-cancel" data-action="cancel-break" data-break-id="${escapeHtml(brk.id)}">휴게 취소</button>
              </div>
            </div>
          </article>
        `;
      }

      const bStart = brk.started_at ? new Date(brk.started_at) : new Date();
      const elapsedSec = isBreakRunning
        ? Math.max(0, Math.round((Date.now() - bStart.getTime()) / 1000))
        : (brk.duration_sec || 0);
      const startTimeStr = formatTimeHM(bStart, true);
      const breakStatusText = isBreakRunning
        ? `경과 ${formatMMSS(elapsedSec)}`
        : `소요 ${formatMMSS(elapsedSec)}`;

      const isBreakPendingSync = isBreakRunning && Boolean(liveStatus?.pending_sync);

      return `
        <article class="race-card break-card ${isBreakRunning ? 'state-break-running' : 'state-break-finished'}${isBreakPendingSync ? ' is-pending-sync' : ''}" id="break-card-${escapeHtml(brk.id)}" data-break-id="${escapeHtml(brk.id)}">
          <div class="rc-row-1">
            <span class="rc-break-badge">${isBreakRunning ? '☕ 휴게 중' : '☕ 휴게 완료'}</span>
            <span class="rc-break-title">#${race.race_index} (${escapeHtml(race.primary_match_no)}번) 다음 휴게 · ${breakStatusText}</span>
            <div class="rc-right-controls">
              <span class="rc-time">${escapeHtml(startTimeStr)}</span>
              <button type="button" class="rc-btn-break-end" data-action="end-break" data-break-id="${escapeHtml(brk.id)}" ${!isBreakRunning ? 'disabled' : ''}>휴게 종료</button>
              <button type="button" class="rc-btn-break-cancel" data-action="cancel-break" data-break-id="${escapeHtml(brk.id)}">휴게 취소</button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // 검색어 필터링 (index, 순번, 종목명, 개인전 선수명, 단체전 영자명, 우리 팀명)
    if (q) {
      if (!doesRaceMatchQuery(race, laneDataByNo, q)) {
        // 우리 팀 필터('거제몽꾸'/'거제야르'/'우리팀 전체') 시에도 휴식 카드는 함께 보여줌
        if ((q === '거제몽꾸' || q === '거제야르' || q === '우리팀 전체' || q === '우리팀') && breaksHtml) {
          return breaksHtml;
        }
        return '';
      }
    }

    const isRunning = race.state === 'running' || race.state === 'paused';
    const isFinished = race.state === 'finished';
    const canCancel = isRunning || isFinished;
    const isCardPendingSync = isRunning && Boolean(liveStatus?.pending_sync);

    let cardClass = 'race-card';
    if (isRunning) cardClass += ' state-running';
    else if (isFinished) cardClass += ' state-finished';
    if (isCardPendingSync) cardClass += ' is-pending-sync';

    const genderKey = race.gender === '남자' ? 'male' : (race.gender === '여자' ? 'female' : 'mixed');
    const compactEvent = formatCompactEventTitle(race);

    // 2열: 1~4레인 셀 생성
    const laneCellsHtml = [1, 2, 3, 4].map(laneNo => {
      const entries = laneDataByNo[laneNo];
      if (!entries || entries.length === 0) {
        return `
          <div class="rc-lane-cell is-empty">
            <span class="rc-lane-num">${laneNo}</span>
            <span class="rc-lane-names">-</span>
          </div>
        `;
      }

      // 우리 팀 하이라이트 클래스 결정 (거제몽꾸: 주황색, 거제야르: 파란색)
      const hasMongkku = entries.some(e => e.team === '거제몽꾸');
      const hasYareu = entries.some(e => e.team === '거제야르');
      let cellClass = 'rc-lane-cell';
      if (hasMongkku) cellClass += ' team-mongkku';
      else if (hasYareu) cellClass += ' team-yareu';
      if (race.is_relay) cellClass += ' is-relay-cell';

      // 선수명만 표시 (단체전은 DB 영자들만 표시)
      const namesHtml = entries.map(e => {
        if (race.is_relay) {
          if (Array.isArray(e.relaySwimmers) && e.relaySwimmers.length > 0) {
            if (currentDivision === 'student' && e.team === '거제야르') {
              return e.relaySwimmers.map(swName => formatStudentClickable(swName)).join(' ');
            }
            return escapeHtml(e.relaySwimmers.join(' '));
          }
          // 타 팀 단체전은 엑셀에 영자 이름이 없으므로 '-' 표시
          return '-';
        } else {
          const swName = e.name || '-';
          if (currentDivision === 'student' && e.team === '거제야르' && swName !== '-') {
            return formatStudentClickable(swName);
          }
          return escapeHtml(swName);
        }
      }).join(' / ');

      return `
        <div class="${cellClass}">
          <span class="rc-lane-num">${laneNo}</span>
          <span class="rc-lane-names">${namesHtml}</span>
        </div>
      `;
    }).join('');

    const raceCardHtml = `
      <article class="${cardClass}" id="race-card-${race.race_index}" data-race-index="${race.race_index}">
        <div class="rc-row-1">
          <span class="rc-index" title="전체 ${currentRaces.length}경기 중 ${race.race_index}번째 경기">#${race.race_index}</span>
          <span class="rc-no">${escapeHtml(race.primary_match_no)}</span>
          <span class="rc-gender rc-gender-${genderKey}">${escapeHtml(race.gender)}</span>
          <span class="rc-event" title="${escapeHtml(race.title)}">${escapeHtml(compactEvent)}</span>
          <div class="rc-right-controls">
            <span class="rc-time">${escapeHtml(race.display_time)}</span>
            <button type="button" class="rc-btn-icon rc-btn-start ${isRunning ? 'active' : ''}" data-action="start-race" data-index="${race.race_index}" title="${escapeHtml(race.primary_match_no)}번 경기 시작">▶</button>
            <button type="button" class="rc-btn-icon rc-btn-cancel" data-action="cancel-race" data-index="${race.race_index}" title="${escapeHtml(race.primary_match_no)}번 시작 취소" ${!canCancel ? 'disabled' : ''}>↩</button>
          </div>
        </div>
        <div class="rc-row-2">
          ${laneCellsHtml}
        </div>
      </article>
    `;

    return raceCardHtml + breaksHtml;
  }).join('');

  // 마지막 경기 이후 [🏁 경기종료] 배너 카드 생성
  let finishAllCardHtml = '';
  const lastRace = races[races.length - 1];
  if (lastRace && (!q || q === '거제몽꾸' || q === '거제야르' || html.includes(`id="race-card-${lastRace.race_index}"`))) {
    const isAllFinished = liveStatus?.status === 'finished';
    const lastHist = Array.isArray(liveStatus?.history)
      ? liveStatus.history.find(h => h.race_index === lastRace.race_index)
      : null;
    const finIso = liveStatus?.finished_at || lastHist?.finished_at;

    let finishTimeLabel = '';
    if (isAllFinished && finIso) {
      finishTimeLabel = `종료 ${formatTimeHM(new Date(finIso), true)}`;
    } else if (lastRace.estimated_start_time instanceof Date) {
      const estDurSec = Math.round((lastRace.base_duration_sec || (lastRace.is_relay ? 180 : 75)) * (calculatedSchedule?.paceFactor || 1));
      const estEndDate = new Date(lastRace.estimated_start_time.getTime() + estDurSec * 1000);
      finishTimeLabel = `예상 종료 ${formatTimeHM(estEndDate)}`;
    }

    const isFinishPendingSync = isAllFinished && Boolean(liveStatus?.pending_sync);
    const cardStateClass = (isAllFinished ? 'state-finish-completed' : 'state-finish-ready') + (isFinishPendingSync ? ' is-pending-sync' : '');
    const badgeLabel = isAllFinished ? '🏁 전 경기 종료 완료' : '🏁 대회 일정 마감';
    const titleLabel = isAllFinished
      ? `전체 ${races.length}경기 진행 완료 · 마지막 #${lastRace.race_index} (${escapeHtml(lastRace.primary_match_no)}번) 종료됨`
      : `마지막 #${lastRace.race_index} (${escapeHtml(lastRace.primary_match_no)}번) 경기 이후 전체 대회를 종료합니다`;

    finishAllCardHtml = `
      <article class="race-card finish-all-card ${cardStateClass}" id="finish-all-card">
        <div class="rc-row-1">
          <span class="rc-finish-badge">${badgeLabel}</span>
          <span class="rc-finish-title">${titleLabel}</span>
          <div class="rc-right-controls">
            ${finishTimeLabel ? `<span class="rc-time">${escapeHtml(finishTimeLabel)}</span>` : ''}
            <button type="button" class="rc-btn-finish-all ${isAllFinished ? 'active' : ''}" data-action="finish-all-races" ${isAllFinished ? 'disabled' : ''} title="마지막 경기 종료 및 전체 대회 마감">🏁 경기종료</button>
            <button type="button" class="rc-btn-finish-cancel" data-action="cancel-finish-all" ${!isAllFinished ? 'disabled' : ''} title="경기 종료 취소 (마지막 경기 진행 중 상태로 복귀)">↩ 종료 취소</button>
          </div>
        </div>
      </article>
    `;
  }

  elRacesContainer.innerHTML = (html + finishAllCardHtml) || '<div class="loading-placeholder">검색 조건에 맞는 경기가 없습니다.</div>';
}

function formatStudentClickable(name) {
  const safe = escapeHtml(name);
  return `<span class="student-clickable" data-student-name="${safe}" title="클릭하여 ${safe} 학생 사진 및 전화번호 보기">${safe}</span>`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────────────────────────────────────
// 🔍 검색창 우리 팀("거제몽꾸", "거제야르") 및 선수 이름 추천 (Autocomplete Chips)
// ──────────────────────────────────────────────────────────────────────────

function doesRaceMatchQuery(race, laneDataByNo, rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase();
  if (!q) return true;
  if (q === '우리팀 전체' || q === '우리팀') {
    return Object.values(laneDataByNo).flat().some(
      item => item.team === '거제몽꾸' || item.team === '거제야르'
    );
  }
  const cleanQ = q.replace(/^#/, '');
  const matchIdx = String(race.race_index) === cleanQ;
  const matchNo = String(race.primary_match_no || '').toLowerCase().includes(q) ||
    (race.merged_match_nos || []).some(n => String(n).toLowerCase().includes(q));
  const matchTitle = (race.title || '').toLowerCase().includes(q);
  const matchLane = Object.values(laneDataByNo).flat().some(item => {
    const nameMatch = item.name && item.name.toLowerCase().includes(q);
    const teamMatch = item.team && item.team.toLowerCase().includes(q);
    const relayMatch = Array.isArray(item.relaySwimmers) && item.relaySwimmers.some(sw => sw.toLowerCase().includes(q));
    return nameMatch || teamMatch || relayMatch;
  });
  return matchIdx || matchNo || matchTitle || matchLane;
}

function renderSwimmerSuggestions(filterText = '') {
  if (!elSwimmerSuggestDropdown) return;
  const q = filterText.trim().toLowerCase();

  const teamPresets = currentDivision === 'adult'
    ? [
        { name: '우리팀 전체', team: '우리팀', isTeam: true },
        { name: '거제몽꾸', team: '거제몽꾸', isTeam: true },
        { name: '거제야르', team: '거제야르', isTeam: true }
      ]
    : [
        { name: '거제야르', team: '거제야르', isTeam: true }
      ];
  const matchedTeams = teamPresets.filter(t => !q || t.name.toLowerCase().includes(q));

  const swimmers = currentDivision === 'student'
    ? Array.from(studentRosterMap.values())
    : adultRosterList;

  const filteredSwimmers = swimmers.filter(s => !q || s.name.toLowerCase().includes(q));
  if (matchedTeams.length === 0 && filteredSwimmers.length === 0) {
    elSwimmerSuggestDropdown.style.display = 'none';
    return;
  }

  const teamChipsHtml = matchedTeams.map(t => {
    const chipTeamClass = t.team === '거제몽꾸' ? 'chip-mongkku' : 'chip-yareu';
    return `<button type="button" class="suggest-chip ${chipTeamClass}" data-suggest-name="${escapeHtml(t.name)}">🏊 ${escapeHtml(t.name)}</button>`;
  }).join('');

  const swimmerChipsHtml = filteredSwimmers.map(s => {
    const chipTeamClass = s.team === '거제몽꾸' ? 'chip-mongkku' : 'chip-yareu';
    return `<button type="button" class="suggest-chip ${chipTeamClass}" data-suggest-name="${escapeHtml(s.name)}">${escapeHtml(s.name)}</button>`;
  }).join('');

  elSwimmerSuggestDropdown.innerHTML = `
    <div class="suggest-header">
      <span>🏊 우리 팀(거제몽꾸·거제야르) 및 선수 추천 (${filteredSwimmers.length}명)</span>
      <div class="suggest-header-right">
        <span style="font-weight:600; font-size:10.5px;">클릭 시 해당 팀·선수 필터</span>
        <button type="button" class="btn-close-suggest" data-action="close-suggest" title="추천 창 닫기">✕ 닫기</button>
      </div>
    </div>
    <div class="suggest-chips-wrap">
      ${teamChipsHtml}
      ${swimmerChipsHtml}
    </div>
  `;
  elSwimmerSuggestDropdown.style.display = 'block';
}

// ──────────────────────────────────────────────────────────────────────────
// 🧒 학생 증명사진 & 전화번호 모달 팝업 + 클립보드 복사
// ──────────────────────────────────────────────────────────────────────────

function openStudentModal(studentName) {
  const info = studentRosterMap.get(studentName);
  if (!info || !elStudentModal) return;

  const photoUrl = `photos/students/student_${info.id}.png`;
  if (elModalStudentPhoto) {
    elModalStudentPhoto.src = photoUrl;
    elModalStudentPhoto.alt = `${info.name} 증명사진`;
  }
  if (elModalStudentName) elModalStudentName.textContent = info.name;
  if (elModalStudentMeta) elModalStudentMeta.textContent = `${info.group} · ${info.age}세(${info.gender})`;
  if (elModalStudentPhone) elModalStudentPhone.textContent = info.phone || '연락처 없음';
  if (elBtnCopyStudentPhone) {
    elBtnCopyStudentPhone.classList.remove('copied');
    elBtnCopyStudentPhone.dataset.phone = info.phone || '';
  }
  if (elModalCopyHint) elModalCopyHint.textContent = '📋 복사';

  elStudentModal.style.display = 'flex';
}

function closeStudentModal() {
  if (elStudentModal) elStudentModal.style.display = 'none';
}

async function copyStudentPhone() {
  const phone = elBtnCopyStudentPhone?.dataset.phone;
  if (!phone) return;

  try {
    await navigator.clipboard.writeText(phone);
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = phone;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  if (elBtnCopyStudentPhone) elBtnCopyStudentPhone.classList.add('copied');
  if (elModalCopyHint) elModalCopyHint.textContent = '✓ 복사됨';
  showToast(`전화번호(${phone})가 클립보드에 복사되었습니다.`);
}

// ──────────────────────────────────────────────────────────────────────────
// 🖱️ Event Handlers
// ──────────────────────────────────────────────────────────────────────────

function scrollToCurrentRace() {
  if (!liveStatus) return;

  // 검색 필터로 인해 현재 경기 카드가 숨겨져 있다면 필터 해제 후 스크롤
  const activeBreak = Array.isArray(liveStatus.breaks)
    ? liveStatus.breaks.find(b => b.state === 'running')
    : null;

  const targetId = activeBreak
    ? `break-card-${activeBreak.id}`
    : `race-card-${liveStatus.current_race_index || 1}`;

  let targetEl = document.getElementById(targetId);
  if (!targetEl && searchQuery) {
    if (elInputSearch) elInputSearch.value = '';
    if (elBtnClearSearch) elBtnClearSearch.style.display = 'none';
    searchQuery = '';
    updateUI();
    targetEl = document.getElementById(targetId);
  }

  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!liveStatus.current_race_index && !activeBreak) {
      showToast('아직 시작된 경기가 없어 1번째 경기로 이동했습니다.');
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 🖼️ 우리팀(거제몽꾸·거제야르) 전체 대진표 고화질 이미지(PNG) 생성 및 다운로드
// ──────────────────────────────────────────────────────────────────────────

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncateCanvasText(ctx, text, maxWidth) {
  const str = String(text || '');
  if (ctx.measureText(str).width <= maxWidth) return str;
  let len = str.length;
  while (len > 0 && ctx.measureText(str.slice(0, len) + '…').width > maxWidth) {
    len--;
  }
  return str.slice(0, Math.max(1, len)) + '…';
}

async function downloadScheduleImage() {
  if (!calculatedSchedule || !Array.isArray(calculatedSchedule.races)) {
    showToast('대진표 데이터가 아직 준비되지 않았습니다.');
    return;
  }

  const rawQ = (searchQuery || '').trim();
  const q = rawQ.toLowerCase();
  const isTeamFilter = !q || q === '거제몽꾸' || q === '거제야르' || q === '우리팀 전체' || q === '우리팀';
  const modeLabel = rawQ ? `${rawQ} 대진표` : '전체 대진표';
  showToast(`🖼️ ${modeLabel} 이미지를 생성하고 있습니다...`);

  const allRaces = calculatedSchedule.races;
  const allBreaks = Array.isArray(calculatedSchedule.breaks) ? calculatedSchedule.breaks : [];

  const breaksByAfterIdx = new Map();
  allBreaks.forEach(b => {
    const idx = Number(b.after_race_index) || 1;
    if (!breaksByAfterIdx.has(idx)) breaksByAfterIdx.set(idx, []);
    breaksByAfterIdx.get(idx).push(b);
  });

  // 현재 화면 필터(searchQuery)와 동일하게 경기 + 휴식 항목 구성
  const renderItems = [];
  let targetRaceCount = 0;

  for (const race of allRaces) {
    const laneDataByNo = { 1: [], 2: [], 3: [], 4: [] };
    (race.lanes || []).forEach(l => {
      const ln = Number(l.lane);
      if (ln >= 1 && ln <= 4) {
        laneDataByNo[ln].push({
          ...l,
          relaySwimmers: getOurRelaySwimmers(race, l.team)
        });
      }
    });

    const isMatched = doesRaceMatchQuery(race, laneDataByNo, q);
    if (isMatched) {
      renderItems.push({ type: 'race', race });
      targetRaceCount++;
    }
    const attachedBreaks = breaksByAfterIdx.get(race.race_index) || [];
    if (isMatched || isTeamFilter) {
      for (const brk of attachedBreaks) {
        renderItems.push({ type: 'break', brk, afterRace: race });
      }
    }
  }

  if (targetRaceCount === 0) {
    showToast('저장할 출전 경기가 없습니다.');
    return;
  }

  // PC와 모바일 어디서든 동일한 최적 비율(480px)로 렌더링하여 글자 크기와 여백을 일관되게 유지
  const canvasW = 480;
  const fontStack = '"Pretendard", -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
  const padX = 6;
  const headerH = 62;
  const footerH = 24;
  const gapY = 4;

  const itemHeights = renderItems.map(item => {
    if (item.type === 'break') return 34;
    if (item.race.is_relay) {
      const hasMultiSwimmers = (item.race.lanes || []).some(l => {
        const sw = getOurRelaySwimmers(item.race, l.team);
        return Array.isArray(sw) && sw.length > 2;
      });
      return hasMultiSwimmers ? 68 : 56;
    }
    return 56;
  });

  const contentH = itemHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, renderItems.length - 1) * gapY;
  const canvasH = headerH + contentH + footerH;

  // 모바일/데스크톱 최대 캔버스 높이(16,384px) 및 면적(1,600만px) 한계 안에서 고해상도 배율 결정
  const maxByHeight = Math.floor((16000 / canvasH) * 100) / 100;
  const maxByArea = Math.floor(Math.sqrt(16000000 / (canvasW * canvasH)) * 100) / 100;
  const scale = Math.max(1, Math.min(2.5, maxByHeight, maxByArea));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(canvasW * scale);
  canvas.height = Math.round(canvasH * scale);

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 1. 전체 배경
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 2. 상단 콤팩트 헤더 배너
  const cardW = canvasW - padX * 2;
  drawRoundedRect(ctx, padX, 6, cardW, 50, 9);
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  const divTitle = currentDivision === 'student' ? '학생부(10/24 토)' : '성인부(10/25 일)';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 15.5px ${fontStack}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(`🏊 2026 거제시장배 ${divTitle} ${modeLabel} (${targetRaceCount}경기)`, padX + 10, 22);

  // 2행: 시작 시각 안내 + 우측 컬러 범례 배지
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `700 11.5px ${fontStack}`;
  ctx.fillText('08:30 시작 · 예정휴식 반영', padX + 10, 42);

  const legendItems = [
    { label: '거제몽꾸', bg: '#ffedd5', border: '#f97316', text: '#9a3412' },
    { label: '거제야르', bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    { label: '휴식', bg: '#dcfce7', border: '#10b981', text: '#065f46' }
  ];
  let legX = padX + cardW - 8;
  for (let i = legendItems.length - 1; i >= 0; i--) {
    const lg = legendItems[i];
    ctx.font = `800 11px ${fontStack}`;
    const tw = ctx.measureText(lg.label).width + 12;
    legX -= tw;
    drawRoundedRect(ctx, legX, 33, tw, 18, 4);
    ctx.fillStyle = lg.bg;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = lg.border;
    ctx.stroke();
    ctx.fillStyle = lg.text;
    ctx.fillText(lg.label, legX + 6, 42);
    legX -= 5;
  }

  // 3. 각 경기 카드 및 휴식 카드 렌더링 (여백 최소화 & 글자 크기 확대)
  let curY = headerH;

  for (let idx = 0; idx < renderItems.length; idx++) {
    const item = renderItems[idx];
    const cardH = itemHeights[idx];

    if (item.type === 'break') {
      const brk = item.brk;
      const afterRace = item.afterRace;
      drawRoundedRect(ctx, padX, curY, cardW, cardH, 7);
      ctx.fillStyle = '#ecfdf5';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#10b981';
      ctx.stroke();

      const schedSec = brk.duration_sec || brk.scheduled_duration_sec || 600;
      const schedMin = Math.round(schedSec / 60);
      const badgeText = brk.state === 'scheduled'
        ? `☕ 휴식 ${schedMin}분`
        : (brk.state === 'running' ? '☕ 휴게 중' : `☕ 휴게 ${formatMMSS(schedSec)}`);

      const midY = curY + cardH / 2;
      ctx.font = `900 12px ${fontStack}`;
      const bdgW = ctx.measureText(badgeText).width + 12;
      drawRoundedRect(ctx, padX + 6, curY + 5, bdgW, cardH - 10, 5);
      ctx.fillStyle = '#0d9488';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(badgeText, padX + 12, midY);

      let timeRightStr = '';
      if (brk.state === 'scheduled') {
        const estS = brk.estimated_started_at ? new Date(brk.estimated_started_at) : null;
        const estE = brk.estimated_finished_at ? new Date(brk.estimated_finished_at) : null;
        timeRightStr = estS ? (estE ? `${formatTimeHM(estS)}~${formatTimeHM(estE)}` : formatTimeHM(estS)) : `${schedMin}분`;
      } else if (brk.started_at) {
        timeRightStr = formatTimeHM(new Date(brk.started_at), true);
      }

      let trW = 0;
      if (timeRightStr) {
        ctx.font = `800 12px monospace`;
        trW = ctx.measureText(timeRightStr).width + 10;
        drawRoundedRect(ctx, padX + cardW - trW - 6, curY + 5, trW, cardH - 10, 4);
        ctx.fillStyle = '#d1fae5';
        ctx.fill();
        ctx.fillStyle = '#047857';
        ctx.fillText(timeRightStr, padX + cardW - trW - 1, midY);
      }

      const titleStr = `#${afterRace.race_index}(${afterRace.primary_match_no}번) 다음 · ${brk.label || `휴식 ${schedMin}분`}`;
      ctx.fillStyle = '#065f46';
      ctx.font = `800 12.5px ${fontStack}`;
      const maxBreakTitleW = cardW - bdgW - trW - 26;
      ctx.fillText(truncateCanvasText(ctx, titleStr, maxBreakTitleW), padX + 12 + bdgW, midY);

      curY += cardH + gapY;
      continue;
    }

    const race = item.race;
    drawRoundedRect(ctx, padX, curY, cardW, cardH, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    // 1열: [#순번] [경기번호] [성별] [종목명] ... [예상/실제 시간]
    const row1Y = curY + 14;
    let cursorX = padX + 6;

    // #순번
    const idxText = `#${race.race_index}`;
    ctx.font = `800 12px monospace`;
    const idxW = Math.max(30, ctx.measureText(idxText).width + 8);
    drawRoundedRect(ctx, cursorX, curY + 4, idxW, 20, 4);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.fillText(idxText, cursorX + 4, row1Y);
    cursorX += idxW + 4;

    // 경기번호
    const noText = String(race.primary_match_no || '');
    ctx.font = `900 12.5px ${fontStack}`;
    const noW = Math.max(28, ctx.measureText(noText).width + 10);
    drawRoundedRect(ctx, cursorX, curY + 4, noW, 20, 4);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(noText, cursorX + 5, row1Y);
    cursorX += noW + 4;

    // 성별 배지
    const genText = race.gender || '-';
    ctx.font = `800 12px ${fontStack}`;
    const genW = ctx.measureText(genText).width + 10;
    drawRoundedRect(ctx, cursorX, curY + 4, genW, 20, 4);
    if (genText === '남자') {
      ctx.fillStyle = '#eff6ff';
      ctx.fill();
      ctx.fillStyle = '#2563eb';
    } else if (genText === '여자') {
      ctx.fillStyle = '#fff1f2';
      ctx.fill();
      ctx.fillStyle = '#e11d48';
    } else {
      ctx.fillStyle = '#f3e8ff';
      ctx.fill();
      ctx.fillStyle = '#7c3aed';
    }
    ctx.fillText(genText, cursorX + 5, row1Y);
    cursorX += genW + 5;

    // 우측 예상/실제 시작 시각 먼저 계산하여 종목명 최대 폭 확보
    const timeStr = race.display_time || '';
    let timeW = 0;
    if (timeStr) {
      ctx.font = `800 12px monospace`;
      timeW = ctx.measureText(timeStr).width + 10;
      drawRoundedRect(ctx, padX + cardW - timeW - 6, curY + 4, timeW, 20, 4);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.fillText(timeStr, padX + cardW - timeW - 1, row1Y);
    }

    // 종목명 (큰 글씨 + 여백 없이 꽉 차게 표시)
    const compactEvent = formatCompactEventTitle(race);
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 13.5px ${fontStack}`;
    const maxEventW = Math.max(60, (padX + cardW - timeW - 10) - cursorX);
    ctx.fillText(truncateCanvasText(ctx, compactEvent, maxEventW), cursorX, row1Y);

    // 2열: 1~4레인 셀 (팀명 생략, 선수명 크게 표시, 단체전 영자 2줄 자동 줄바꿈)
    const laneDataByNo = { 1: [], 2: [], 3: [], 4: [] };
    (race.lanes || []).forEach(l => {
      const ln = Number(l.lane);
      if (ln >= 1 && ln <= 4) {
        laneDataByNo[ln].push({
          ...l,
          relaySwimmers: getOurRelaySwimmers(race, l.team)
        });
      }
    });

    const laneGap = 4;
    const totalLaneW = cardW - 12;
    const singleLaneW = (totalLaneW - laneGap * 3) / 4;
    const laneY = curY + 27;
    const laneH = cardH - 31;

    for (let laneNo = 1; laneNo <= 4; laneNo++) {
      const lx = padX + 6 + (laneNo - 1) * (singleLaneW + laneGap);
      const entries = laneDataByNo[laneNo];
      const hasMongkku = entries.some(e => e.team === '거제몽꾸');
      const hasYareu = entries.some(e => e.team === '거제야르');

      drawRoundedRect(ctx, lx, laneY, singleLaneW, laneH, 5);
      if (hasMongkku) {
        ctx.fillStyle = '#ffedd5';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#f97316';
        ctx.stroke();
      } else if (hasYareu) {
        ctx.fillStyle = '#dbeafe';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#3b82f6';
        ctx.stroke();
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#e2e8f0';
        ctx.stroke();
      }

      // 레인 번호
      ctx.font = `800 11.5px ${fontStack}`;
      ctx.fillStyle = hasMongkku ? '#ea580c' : (hasYareu ? '#2563eb' : '#94a3b8');
      ctx.fillText(String(laneNo), lx + 4, laneY + laneH / 2);

      const textStartX = lx + 14;
      const maxTextW = singleLaneW - 17;
      ctx.fillStyle = hasMongkku ? '#9a3412' : (hasYareu ? '#1e40af' : (entries.length > 0 ? '#334155' : '#cbd5e1'));

      // 단체전이고 우리팀 영자 명단이 있는 경우 2줄로 나누어 또렷하게 표시 (팀명 제외)
      const relayEntryWithSwimmers = race.is_relay
        ? entries.find(e => Array.isArray(e.relaySwimmers) && e.relaySwimmers.length > 0)
        : null;

      if (relayEntryWithSwimmers) {
        const swList = relayEntryWithSwimmers.relaySwimmers;
        const half = Math.ceil(swList.length / 2);
        const line1 = swList.slice(0, half).join(' ');
        const line2 = swList.slice(half).join(' ');
        ctx.font = `800 12px ${fontStack}`;
        if (line2) {
          ctx.fillText(truncateCanvasText(ctx, line1, maxTextW), textStartX, laneY + laneH * 0.32);
          ctx.fillText(truncateCanvasText(ctx, line2, maxTextW), textStartX, laneY + laneH * 0.72);
        } else {
          ctx.fillText(truncateCanvasText(ctx, line1, maxTextW), textStartX, laneY + laneH / 2);
        }
      } else {
        // 개인전은 선수 이름만 표시하고, 타팀 단체전은 화면과 동일하게 '-' 표시
        let displayNames = '-';
        if (entries.length > 0 && !race.is_relay) {
          displayNames = entries.map(e => e.name || '-').join('/');
        }
        ctx.font = (hasMongkku || hasYareu)
          ? `800 14px ${fontStack}`
          : `700 13.5px ${fontStack}`;
        ctx.fillText(truncateCanvasText(ctx, displayNames, maxTextW), textStartX, laneY + laneH / 2);
      }
    }

    curY += cardH + gapY;
  }

  // 4. 하단 푸터
  ctx.fillStyle = '#64748b';
  ctx.font = `700 10.5px ${fontStack}`;
  ctx.fillText(
    `저장: ${new Date().toLocaleString('ko-KR')} · 거제몽꾸 & 거제야르`,
    padX + 2,
    canvasH - 11
  );

  // 5. PNG 파일 다운로드 실행
  const safeSuffix = rawQ ? rawQ.replace(/[\\/:*?"<>|\s]+/g, '_') + '_대진표' : '전체대진표';
  const fileName = `2026_거제시장배_${currentDivision === 'student' ? '학생부(24일)' : '성인부(25일)'}_${safeSuffix}.png`;
  const triggerDownload = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (canvas.toBlob) {
    canvas.toBlob((blob) => {
      if (!blob) {
        triggerDownload(canvas.toDataURL('image/png'));
        return;
      }
      const blobUrl = URL.createObjectURL(blob);
      triggerDownload(blobUrl);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      showToast(`✅ ${modeLabel} 이미지(${targetRaceCount}경기) 다운로드가 완료되었습니다.`);
    }, 'image/png');
  } else {
    triggerDownload(canvas.toDataURL('image/png'));
    showToast(`✅ ${modeLabel} 이미지(${targetRaceCount}경기) 다운로드가 완료되었습니다.`);
  }
}

function bindEvents() {
  // 상단 [🖼️ 대진표 저장] 버튼 클릭 (현재 검색·필터 상태 기준으로 저장)
  if (elBtnDownloadScheduleImage) {
    elBtnDownloadScheduleImage.addEventListener('click', () => downloadScheduleImage());
  }

  // 상단 [현재순번] 및 [📍 현재 경기] 버튼 클릭 시 현재 진행 중인 카드로 스크롤 이동
  if (elCtrlCurrentNo) {
    elCtrlCurrentNo.addEventListener('click', scrollToCurrentRace);
  }
  if (elBtnScrollCurrentRace) {
    elBtnScrollCurrentRace.addEventListener('click', scrollToCurrentRace);
  }

  // [☕ 휴게 시작] 버튼 클릭 (DB 응답 대기 없이 웹 화면에 즉시 반영 후 백그라운드 동기화)
  if (elBtnStartBreak) {
    elBtnStartBreak.addEventListener('click', async () => {
      const existingBreak = Array.isArray(liveStatus?.breaks)
        ? liveStatus.breaks.find(b => b.state === 'running')
        : null;
      if (existingBreak) {
        scrollToCurrentRace();
        showToast('이미 휴게가 진행 중입니다.');
        return;
      }

      try {
        countdownRemaining = 10;
        if (isAutoRefresh && elCountdownBadge) elCountdownBadge.textContent = '10s';
        liveStatus = await startBreak(currentDivision, liveStatus);
        updateUI();
        scrollToCurrentRace();
        showToast('☕ 현재 순서 다음에 휴게가 시작되었습니다.');
      } catch (err) {
        console.error('startBreak error:', err);
        showToast('휴게 시작 처리 중 오류가 발생했습니다.');
      }
    });
  }

  // [자동갱신여부] 아이콘 토글
  if (elBtnAutoRefreshToggle) {
    elBtnAutoRefreshToggle.addEventListener('click', () => {
      isAutoRefresh = !isAutoRefresh;
      elBtnAutoRefreshToggle.classList.toggle('active', isAutoRefresh);
      if (elCountdownBadge) {
        elCountdownBadge.classList.toggle('off', !isAutoRefresh);
        if (isAutoRefresh) {
          countdownRemaining = 10;
          elCountdownBadge.textContent = '10s';
        } else {
          elCountdownBadge.textContent = 'OFF';
        }
      }
    });
  }

  // [즉시 새로고침 아이콘]
  if (elBtnManualRefresh) {
    elBtnManualRefresh.addEventListener('click', async () => {
      countdownRemaining = 10;
      if (isAutoRefresh && elCountdownBadge) elCountdownBadge.textContent = '10s';
      liveStatus = await fetchLiveStatus(currentDivision);
      updateUI();
      showToast('최신 진행 상태를 새로고침했습니다.');
    });
  }

  // 검색창 포커스 / 클릭 / 입력 / 추천 선수 클릭 / 닫기
  if (elInputSearch) {
    elInputSearch.addEventListener('focus', () => {
      renderSwimmerSuggestions(elInputSearch.value);
    });

    elInputSearch.addEventListener('click', () => {
      if (elSwimmerSuggestDropdown && elSwimmerSuggestDropdown.style.display === 'none') {
        renderSwimmerSuggestions(elInputSearch.value);
      }
    });

    elInputSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        if (elSwimmerSuggestDropdown) elSwimmerSuggestDropdown.style.display = 'none';
        elInputSearch.blur();
      }
    });

    elInputSearch.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (elBtnClearSearch) elBtnClearSearch.style.display = val ? 'block' : 'none';
      searchQuery = val;
      renderSwimmerSuggestions(val);
      updateUI();
    });
  }

  if (elBtnClearSearch) {
    elBtnClearSearch.addEventListener('click', () => {
      if (elInputSearch) elInputSearch.value = '';
      elBtnClearSearch.style.display = 'none';
      searchQuery = '';
      if (elSwimmerSuggestDropdown) elSwimmerSuggestDropdown.style.display = 'none';
      updateUI();
    });
  }

  if (elSwimmerSuggestDropdown) {
    elSwimmerSuggestDropdown.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-action="close-suggest"]');
      if (closeBtn) {
        e.stopPropagation();
        elSwimmerSuggestDropdown.style.display = 'none';
        if (elInputSearch) elInputSearch.blur();
        return;
      }

      const chip = e.target.closest('[data-suggest-name]');
      if (!chip) return;
      const name = chip.getAttribute('data-suggest-name');
      if (elInputSearch) elInputSearch.value = name;
      if (elBtnClearSearch) elBtnClearSearch.style.display = 'block';
      searchQuery = name;
      elSwimmerSuggestDropdown.style.display = 'none';
      updateUI();
    });
  }

  // 검색창 외부 클릭 시 추천 드롭다운 닫기
  document.addEventListener('click', (e) => {
    if (elCtrlSearchBox && !elCtrlSearchBox.contains(e.target)) {
      if (elSwimmerSuggestDropdown) elSwimmerSuggestDropdown.style.display = 'none';
    }
  });

  // race-card 내부 클릭 위임: [시작 아이콘], [시작 취소 아이콘], 학생 이름 클릭
  if (elRacesContainer) {
    elRacesContainer.addEventListener('click', async (e) => {
      // 1. 학생 이름 클릭 -> 사진 & 전화번호 모달
      const studentEl = e.target.closest('.student-clickable');
      if (studentEl) {
        const studentName = studentEl.getAttribute('data-student-name');
        if (studentName) openStudentModal(studentName);
        return;
      }

      // 2. [시작 아이콘] 클릭 (DB 통신 대기 없이 0초 즉시 반영 + 주황색 미동기화 힌트 표시)
      const startBtn = e.target.closest('[data-action="start-race"]');
      if (startBtn) {
        const raceIdx = Number(startBtn.getAttribute('data-index'));
        const raceObj = currentRaces[raceIdx - 1];
        if (!raceObj) return;

        // 클릭한 race-card 높이(+간격 6px) 측정 후 시작 처리 시 그 높이만큼 자동 스크롤
        const clickedCard = startBtn.closest('.race-card');
        const scrollStep = clickedCard ? clickedCard.offsetHeight + 6 : 66;

        try {
          countdownRemaining = 10;
          if (isAutoRefresh && elCountdownBadge) elCountdownBadge.textContent = '10s';
          liveStatus = await startRaceAt(currentDivision, raceIdx, liveStatus);
          updateUI();
          window.scrollBy({ top: scrollStep, behavior: 'smooth' });
          showToast(`[${raceObj.primary_match_no}번] 경기가 시작되었습니다.`);
        } catch (err) {
          console.error('startRaceAt error:', err);
          showToast('경기 시작 처리 중 오류가 발생했습니다.');
        }
        return;
      }

      // 3. [시작 취소 아이콘] 클릭
      const cancelBtn = e.target.closest('[data-action="cancel-race"]');
      if (cancelBtn && !cancelBtn.disabled) {
        const raceIdx = Number(cancelBtn.getAttribute('data-index'));
        const raceObj = currentRaces[raceIdx - 1];
        if (!raceObj) return;

        try {
          countdownRemaining = 10;
          if (isAutoRefresh && elCountdownBadge) elCountdownBadge.textContent = '10s';
          liveStatus = await cancelRaceAt(currentDivision, raceIdx, liveStatus);
          updateUI();
          showToast(`[${raceObj.primary_match_no}번] 경기 시작이 취소되었습니다.`);
        } catch (err) {
          console.error('cancelRaceAt error:', err);
          showToast('시작 취소 처리 중 오류가 발생했습니다.');
        }
        return;
      }

      // 3-2. 예정 휴식 카드의 [▶ 휴게 시작] 버튼 클릭
      const startSchedBreakBtn = e.target.closest('[data-action="start-scheduled-break"]');
      if (startSchedBreakBtn) {
        const breakId = startSchedBreakBtn.getAttribute('data-break-id');

        try {
          countdownRemaining = 10;
          if (isAutoRefresh && elCountdownBadge) elCountdownBadge.textContent = '10s';
          liveStatus = await startBreak(currentDivision, liveStatus, breakId);
          updateUI();
          scrollToCurrentRace();
          showToast('☕ 예정된 휴식이 시작되었습니다.');
        } catch (err) {
          console.error('startScheduledBreak error:', err);
          showToast('예정 휴식 시작 처리 중 오류가 발생했습니다.');
        }
        return;
      }

      // 4. [휴게 종료] 버튼 클릭
      const endBreakBtn = e.target.closest('[data-action="end-break"]');
      if (endBreakBtn && !endBreakBtn.disabled) {
        const breakId = endBreakBtn.getAttribute('data-break-id');

        try {
          countdownRemaining = 10;
          if (isAutoRefresh && elCountdownBadge) elCountdownBadge.textContent = '10s';
          liveStatus = await endBreak(currentDivision, breakId, liveStatus);
          updateUI();
          const nextRace = currentRaces[(liveStatus.current_race_index || 1) - 1];
          showToast(
            nextRace
              ? `☕ 휴게가 종료되고 [#${nextRace.race_index} · ${nextRace.primary_match_no}번] 경기가 시작되었습니다.`
              : '☕ 휴게가 종료되었습니다.'
          );
        } catch (err) {
          console.error('endBreak error:', err);
          showToast('휴게 종료 처리 중 오류가 발생했습니다.');
        }
        return;
      }

      // 5. [휴게 취소] 버튼 클릭
      const cancelBreakBtn = e.target.closest('[data-action="cancel-break"]');
      if (cancelBreakBtn) {
        const breakId = cancelBreakBtn.getAttribute('data-break-id');

        try {
          countdownRemaining = 10;
          if (isAutoRefresh && elCountdownBadge) elCountdownBadge.textContent = '10s';
          liveStatus = await cancelBreak(currentDivision, breakId, liveStatus);
          updateUI();
          showToast('휴게 카드가 삭제되었습니다.');
        } catch (err) {
          console.error('cancelBreak error:', err);
          showToast('휴게 취소 처리 중 오류가 발생했습니다.');
        }
        return;
      }

      // 6. 마지막 경기 이후 [🏁 경기종료] 버튼 클릭
      const finishAllBtn = e.target.closest('[data-action="finish-all-races"]');
      if (finishAllBtn && !finishAllBtn.disabled) {
        try {
          countdownRemaining = 10;
          if (isAutoRefresh && elCountdownBadge) elCountdownBadge.textContent = '10s';
          liveStatus = await finishAllRaces(currentDivision, liveStatus);
          updateUI();
          showToast('🏁 모든 경기가 종료 처리되었습니다. 수고하셨습니다!');
        } catch (err) {
          console.error('finishAllRaces error:', err);
          showToast('경기 종료 처리 중 오류가 발생했습니다.');
        }
        return;
      }

      // 7. 마지막 경기 이후 [↩ 종료 취소] 버튼 클릭
      const cancelFinishAllBtn = e.target.closest('[data-action="cancel-finish-all"]');
      if (cancelFinishAllBtn && !cancelFinishAllBtn.disabled) {
        try {
          countdownRemaining = 10;
          if (isAutoRefresh && elCountdownBadge) elCountdownBadge.textContent = '10s';
          liveStatus = await cancelFinishAllRaces(currentDivision, liveStatus);
          updateUI();
          showToast('↩ 경기 종료 처리가 취소되어 마지막 경기 진행 중 상태로 복귀했습니다.');
        } catch (err) {
          console.error('cancelFinishAllRaces error:', err);
          showToast('경기 종료 취소 처리 중 오류가 발생했습니다.');
        }
      }
    });
  }

  // 학생 모달 이벤트
  if (elBtnCloseStudentModal) {
    elBtnCloseStudentModal.addEventListener('click', closeStudentModal);
  }
  if (elStudentModal) {
    elStudentModal.addEventListener('click', (e) => {
      if (e.target === elStudentModal) closeStudentModal();
    });
  }
  if (elBtnCopyStudentPhone) {
    elBtnCopyStudentPhone.addEventListener('click', copyStudentPhone);
  }

  // 스크롤 시 하단 플로팅 전체 종목 순서 바 표시 및 업데이트
  window.addEventListener('scroll', () => {
    const curY = window.scrollY || document.documentElement.scrollTop || 0;
    if (fsbClosedAtScrollY !== null && Math.abs(curY - fsbClosedAtScrollY) < 24) {
      return;
    }
    fsbClosedAtScrollY = null;
    if (fsbScrollRafId) return;
    fsbScrollRafId = requestAnimationFrame(() => {
      fsbScrollRafId = null;
      updateFloatingStrokeOrderBar(true);
    });
  }, { passive: true });

  if (elBtnToggleFsbVertical) {
    elBtnToggleFsbVertical.addEventListener('click', () => {
      isFsbExpanded = !isFsbExpanded;
      fsbLastActiveStepKey = null;
      updateFloatingStrokeOrderBar(false);
    });
  }

  if (elBtnCloseFloatingStrokeBar) {
    elBtnCloseFloatingStrokeBar.addEventListener('click', () => {
      fsbClosedAtScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      isFsbExpanded = false;
      if (elFloatingStrokeBar) {
        elFloatingStrokeBar.classList.remove('is-expanded');
        elFloatingStrokeBar.style.display = 'none';
      }
    });
  }

  if (elFloatingStrokeBar) {
    elFloatingStrokeBar.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-fsb-first-race]');
      if (!chip) return;
      const targetRaceIdx = Number(chip.getAttribute('data-fsb-first-race')) || 1;
      const stepKey = chip.getAttribute('data-fsb-step-key');
      if (stepKey) {
        fsbForcedStepKey = stepKey;
        fsbForcedStepUntil = Date.now() + 900;
        fsbLastActiveStepKey = null;
        updateFloatingStrokeOrderBar(false);
      }
      let targetEl = document.getElementById(`race-card-${targetRaceIdx}`);
      if (!targetEl && searchQuery) {
        if (elInputSearch) elInputSearch.value = '';
        if (elBtnClearSearch) elBtnClearSearch.style.display = 'none';
        searchQuery = '';
        updateUI();
        targetEl = document.getElementById(`race-card-${targetRaceIdx}`);
      }
      if (targetEl) {
        const ctrlBottom = elLiveControllerCard ? elLiveControllerCard.getBoundingClientRect().bottom : 80;
        const rect = targetEl.getBoundingClientRect();
        const targetY = Math.max(0, (window.scrollY || document.documentElement.scrollTop || 0) + rect.top - ctrlBottom - 12);
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    });
  }
}

function getViewportFocusedRace() {
  if (!elRacesContainer || !Array.isArray(currentRaces) || currentRaces.length === 0) {
    return currentRaces[0] || null;
  }
  const cards = elRacesContainer.querySelectorAll('.race-card[data-race-index]');
  if (!cards.length) return currentRaces[0] || null;

  const ctrlBottom = elLiveControllerCard ? elLiveControllerCard.getBoundingClientRect().bottom : 80;
  const focalY = ctrlBottom + 36;

  let bestCard = cards[0];
  let bestDist = Infinity;
  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    const centerY = (rect.top + rect.bottom) * 0.5;
    const dist = Math.abs(centerY - focalY);
    if (dist < bestDist) {
      bestDist = dist;
      bestCard = card;
    }
  }
  const rIdx = Number(bestCard.getAttribute('data-race-index')) || 1;
  return currentRaces[rIdx - 1] || currentRaces[0] || null;
}

function updateFloatingStrokeOrderBar(showIfHidden = false) {
  if (!elFloatingStrokeBar || !elFsbStepsTrack) return;
  if (showIfHidden && elFloatingStrokeBar.style.display === 'none') {
    elFloatingStrokeBar.style.display = 'block';
  }
  if (elFloatingStrokeBar.style.display === 'none') return;

  const steps = DIVISION_STROKE_STEPS[currentDivision] || DIVISION_STROKE_STEPS.adult;
  const focusedRace = getViewportFocusedRace();
  if (!focusedRace) return;

  const currentStrokeKey = (fsbForcedStepKey && Date.now() < fsbForcedStepUntil)
    ? fsbForcedStepKey
    : focusedRace.stroke;
  const activeIdx = Math.max(0, steps.findIndex(s => s.key === currentStrokeKey));
  const activeStep = steps[activeIdx] || steps[0];

  elFloatingStrokeBar.classList.toggle('is-expanded', isFsbExpanded);
  if (elBtnToggleFsbVertical) {
    elBtnToggleFsbVertical.classList.toggle('is-open', isFsbExpanded);
    elBtnToggleFsbVertical.setAttribute('aria-expanded', String(isFsbExpanded));
    elBtnToggleFsbVertical.textContent = isFsbExpanded ? '전체순서접기 ▼' : '전체순서보기 ▲';
  }

  if (fsbLastDivision !== currentDivision) {
    fsbLastDivision = currentDivision;
    fsbLastActiveStepKey = null;
    elFsbStepsTrack.innerHTML = steps.map((st, idx) => {
      const sep = idx > 0 ? `<span class="fsb-step-sep">-</span>` : '';
      return `${sep}<button type="button" class="fsb-step-chip" data-fsb-step-key="${escapeHtml(st.key)}" data-fsb-first-race="${st.firstRaceIndex}" title="${escapeHtml(st.fullLabel)} 위치로 바로 이동">${escapeHtml(st.shortLabel)}</button>`;
    }).join('');
  }

  if (elFsbVerticalPanel) {
    const divTitle = currentDivision === 'adult' ? '성인부(25일) 전체 경기 순서' : '학생부(24일) 전체 경기 순서';
    elFsbVerticalPanel.innerHTML = `
      <div class="fsb-vert-header">
        <span>📋 ${escapeHtml(divTitle)} (${steps.length}종목)</span>
        <span style="font-size:11px; color:#94a3b8; font-weight:700;">클릭 시 해당 종목 이동</span>
      </div>
      ${steps.map((st, idx) => {
        const isAct = idx === activeIdx;
        return `
          <button type="button" class="fsb-vert-step ${isAct ? 'is-active' : ''}" data-fsb-step-key="${escapeHtml(st.key)}" data-fsb-first-race="${st.firstRaceIndex}">
            <span class="fsb-vert-step-left">
              <span class="fsb-vert-num">${idx + 1}</span>
              <span class="fsb-vert-title">${escapeHtml(st.fullLabel.replace(/^\d+\.\s*/, ''))}</span>
            </span>
          </button>
        `;
      }).join('')}
    `;
  }

  if (fsbLastActiveStepKey !== activeStep.key) {
    fsbLastActiveStepKey = activeStep.key;
    const chips = elFsbStepsTrack.querySelectorAll('.fsb-step-chip');
    chips.forEach((chip, idx) => {
      const isAct = idx === activeIdx;
      const isPassed = idx < activeIdx;
      chip.classList.toggle('is-active', isAct);
      chip.classList.toggle('is-passed', isPassed);
      const st = steps[idx];
      if (st) {
        chip.textContent = st.shortLabel;
      }
      if (isAct && typeof chip.scrollIntoView === 'function') {
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }
}

/**
 * 1초마다 자동 갱신 카운트다운 동작
 */
function startCountdownTimer() {
  setInterval(async () => {
    if (calculatedSchedule?.activeBreak && !isActionInFlight) {
      updateUI();
    }
    if (!isAutoRefresh || isActionInFlight) return;
    countdownRemaining--;
    if (countdownRemaining <= 0) {
      countdownRemaining = 10;
      liveStatus = await fetchLiveStatus(currentDivision);
      updateUI();
    }
    if (elCountdownBadge) {
      elCountdownBadge.textContent = `${countdownRemaining}s`;
    }
  }, 1000);
}

function showToast(msg) {
  if (!elLiveToastBar || !elToastMessage) return;
  clearTimeout(toastTimeoutId);
  elToastMessage.textContent = msg;
  elLiveToastBar.style.display = 'block';
  toastTimeoutId = setTimeout(() => {
    elLiveToastBar.style.display = 'none';
  }, 3000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
