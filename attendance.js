// ==========================================================================
// GMDC Swim Club - Training Attendance Module (훈련 출석부)
// View & Controller logic coordinating UI, Firebase Realtime Sync, and Modals.
// ==========================================================================

import { firebaseApp } from "./firebase-config.js";
import { ATTENDANCE_DATES, OFFICIAL_MATCH_SCHEDULE, STORAGE_KEYS } from "./constants.js";
import { 
  formatBirthDisplay, 
  isSwimmerActive, 
  getSwimmerKey, 
  compressIndividualEvents, 
  getSwimmerRelays as _getSwimmerRelays, 
  renderSwimmerEvents as _renderSwimmerEvents, 
  checkSwimmerMatchParticipation as _checkSwimmerMatchParticipation,
  filterSwimmers,
  loadSwimmerRosterFromStorage
} from "./swimmerService.js";
import { 
  exportRosterAsTxt as _exportRosterAsTxt,
  exportRosterAsExcel as _exportRosterAsExcel,
  exportRosterAsPdf as _exportRosterAsPdf,
  captureTableAsImage,
  exportRosterAsJpg as _exportRosterAsJpg,
  exportRosterAsPng as _exportRosterAsPng
} from "./exportService.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initAuth, isAdmin, getCurrentUser } from "./auth.js";
import { openRulesModal } from "./prospectus.js";

// Re-export for backward compatibility
export { ATTENDANCE_DATES, OFFICIAL_MATCH_SCHEDULE, formatBirthDisplay, isSwimmerActive, compressIndividualEvents };

const STORAGE_CACHE_KEY = 'gmdc_attendance_cache_v1';
const STORAGE_LAST_UPDATED_KEY = 'gmdc_attendance_last_updated_v1';
const STORAGE_VIEW_MODE_KEY = 'gmdc_attendance_view_mode';
const STORAGE_EVENTS_MODE_KEY = 'gmdc_attendance_events_mode';

// Baseline Swimmers (Adult & Student Defaults)
const ADULT_FALLBACK = [
  {"id": 1, "division": "adult", "age": "15", "group": "1그룹", "gender": "남", "name": "박슬우", "birthId": "20100223-3", "team": "A", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 2, "division": "adult", "age": "15", "group": "1그룹", "gender": "남", "name": "이지훈", "birthId": "20100908-3", "team": "A", "event1": "핀자유형 50", "event2": "접영 50"},
  {"id": 3, "division": "adult", "age": "16", "group": "1그룹", "gender": "남", "name": "이채율", "disabled": true, "birthId": "20090814-3", "team": "B", "event1": "핀자유형 50", "event2": "배영 50"},
  {"id": 4, "division": "adult", "age": "17", "group": "1그룹", "gender": "남", "name": "조성찬", "birthId": "20080718-3", "team": "A", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 5, "division": "adult", "age": "17", "group": "1그룹", "gender": "여", "name": "이지호", "birthId": "20080506-4", "team": "A", "event1": "핀자유형 50", "event2": "접영 50"},
  {"id": 6, "division": "adult", "age": "24", "group": "2그룹", "gender": "여", "name": "추성비", "birthId": "20010521-4", "team": "A", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 7, "division": "adult", "age": "24", "group": "2그룹", "gender": "여", "name": "이영경", "birthId": "20011204-4", "team": "A", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 8, "division": "adult", "age": "33", "group": "3그룹", "gender": "남", "name": "안재홍", "birthId": "19920211-1", "team": "A", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 9, "division": "adult", "age": "38", "group": "3그룹", "gender": "여", "name": "노언영", "birthId": "19870712-2", "team": "A", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 10, "division": "adult", "age": "37", "group": "3그룹", "gender": "여", "name": "최이슬", "birthId": "19881213-2", "team": "A", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 11, "division": "adult", "age": "43", "group": "4그룹", "gender": "남", "name": "고석보", "birthId": "19821227-1", "team": "A", "event1": "핀접영 50", "event2": "자유형 50"},
  {"id": 12, "division": "adult", "age": "44", "group": "4그룹", "gender": "남", "name": "김기용", "birthId": "19810929-1", "team": "A", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 13, "division": "adult", "age": "42", "group": "4그룹", "gender": "남", "name": "김준영", "birthId": "19830201-1", "team": "A", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 14, "division": "adult", "age": "44", "group": "4그룹", "gender": "남", "name": "손철수", "birthId": "19810217-1", "team": "A", "event1": "핀자유형 50", "event2": "자유형 50"},
  {"id": 15, "division": "adult", "age": "44", "group": "4그룹", "gender": "남", "name": "안상준", "birthId": "19811115-1", "team": "A", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 16, "division": "adult", "age": "41", "group": "4그룹", "gender": "남", "name": "양승진", "birthId": "19840221-1", "team": "B", "event1": "자유형 50", "event2": ""},
  {"id": 17, "division": "adult", "age": "44", "group": "4그룹", "gender": "남", "name": "이도형", "birthId": "19810823-1", "team": "B", "event1": "자유형 50", "event2": "핀자유형 50"},
  {"id": 18, "division": "adult", "age": "42", "group": "4그룹", "gender": "남", "name": "정서현", "birthId": "19830903-1", "team": "B", "event1": "배영 50", "event2": "평영 50"},
  {"id": 19, "division": "adult", "age": "47", "group": "4그룹", "gender": "여", "name": "김상희", "birthId": "19780602-2", "team": "B", "event1": "핀자유형 50", "event2": "자유형 50"},
  {"id": 20, "division": "adult", "age": "43", "group": "4그룹", "gender": "여", "name": "박다유", "birthId": "19820825-2", "team": "A", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 21, "division": "adult", "age": "48", "group": "4그룹", "gender": "여", "name": "손혜정", "birthId": "19770415-2", "team": "A", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 22, "division": "adult", "age": "40", "group": "4그룹", "gender": "여", "name": "심민경", "birthId": "19850520-2", "team": "B", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 23, "division": "adult", "age": "42", "group": "4그룹", "gender": "여", "name": "여수연", "birthId": "19830209-2", "team": "B", "event1": "핀자유형 50", "event2": ""},
  {"id": 24, "division": "adult", "age": "44", "group": "4그룹", "gender": "여", "name": "이미영", "birthId": "19811014-2", "team": "A", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 25, "division": "adult", "age": "41", "group": "4그룹", "gender": "여", "name": "이은희", "birthId": "19840528-2", "team": "B", "event1": "배영 50", "event2": "평영 50"},
  {"id": 26, "division": "adult", "age": "50", "group": "5그룹", "gender": "남", "name": "박재홍", "birthId": "19750715-1", "team": "A", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 27, "division": "adult", "age": "57", "group": "5그룹", "gender": "남", "name": "박진홍", "birthId": "19681220-1", "team": "A", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 28, "division": "adult", "age": "50", "group": "5그룹", "gender": "남", "name": "서충근", "birthId": "19750724-1", "team": "A", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 29, "division": "adult", "age": "50", "group": "5그룹", "gender": "남", "name": "성지경", "birthId": "19750223-1", "team": "A", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 30, "division": "adult", "age": "51", "group": "5그룹", "gender": "남", "name": "이경열", "birthId": "19740501-1", "team": "A", "event1": "핀자유형 50", "event2": "평영 50"},
  {"id": 31, "division": "adult", "age": "53", "group": "5그룹", "gender": "여", "name": "김애란", "birthId": "19720727-2", "team": "B", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 32, "division": "adult", "age": "58", "group": "5그룹", "gender": "여", "name": "박선화", "birthId": "19671212-2", "team": "A", "event1": "핀자유형 50", "event2": "평영 50"},
  {"id": 33, "division": "adult", "age": "56", "group": "5그룹", "gender": "여", "name": "전경미", "birthId": "19690201-2", "team": "A", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 34, "division": "adult", "age": "62", "group": "6그룹", "gender": "남", "name": "박봉권", "birthId": "19630807-1", "team": "A", "event1": "배영 50", "event2": "평영 50"},
  {"id": 35, "division": "adult", "age": "63", "group": "6그룹", "gender": "남", "name": "성환용", "birthId": "19620713-1", "team": "A", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 36, "division": "adult", "age": "59", "group": "6그룹", "gender": "여", "name": "송원자", "birthId": "19660325-2", "team": "A", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 37, "division": "adult", "age": "62", "group": "6그룹", "gender": "여", "name": "최지희", "birthId": "19630705-2", "team": "A", "event1": "자유형 50", "event2": "핀자유형 50"},
  {"id": 38, "division": "adult", "age": "61", "group": "6그룹", "gender": "남", "name": "권순용", "birthId": "19650101-1", "team": "B", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 39, "division": "adult", "age": "27", "group": "2그룹", "gender": "남", "name": "정성민", "birthId": "19990101-1", "team": "B", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 41, "division": "adult", "age": "17", "group": "1그룹", "gender": "남", "name": "이동규", "disabled": true, "birthId": "20080508-3", "team": "A", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 42, "division": "adult", "age": "56", "group": "5그룹", "gender": "남", "name": "서정찬", "birthId": "19700310-1", "team": "A", "event1": "핀접영 50", "event2": "평영 50"},
  {"id": 43, "division": "adult", "age": "47", "group": "4그룹", "gender": "남", "name": "윤주권", "birthId": "19790522-1", "team": "B", "event1": "핀자유형 50", "event2": "핀접영 50"}
];

const STUDENT_FALLBACK = [
  {"id": 1, "division": "student", "age": "8", "group": "2그룹", "gender": "남", "name": "배건우", "birthId": "20181207-3", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 2, "division": "student", "age": "9", "group": "3그룹", "gender": "남", "name": "김예준", "birthId": "20170519-3", "team": "학생", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 3, "division": "student", "age": "9", "group": "3그룹", "gender": "남", "name": "한고준", "birthId": "20171019-3", "team": "학생", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 4, "division": "student", "age": "10", "group": "4그룹", "gender": "남", "name": "손민재", "birthId": "20160610-3", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 5, "division": "student", "age": "10", "group": "4그룹", "gender": "여", "name": "이유빈", "birthId": "20160308-4", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 20, "division": "student", "age": "11", "group": "5그룹", "gender": "남", "name": "김하준", "birthId": "20150423-3", "team": "학생", "event1": "배영 50", "event2": "평영 50"},
  {"id": 6, "division": "student", "age": "11", "group": "5그룹", "gender": "남", "name": "양서진", "birthId": "20151030-3", "team": "학생", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 7, "division": "student", "age": "11", "group": "5그룹", "gender": "남", "name": "이우리", "birthId": "20150603-3", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 8, "division": "student", "age": "11", "group": "5그룹", "gender": "여", "name": "김서윤", "birthId": "20150115-4", "team": "학생", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 9, "division": "student", "age": "11", "group": "5그룹", "gender": "여", "name": "류다윤", "birthId": "20151002-4", "team": "학생", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 10, "division": "student", "age": "11", "group": "5그룹", "gender": "여", "name": "이나라", "birthId": "20150603-4", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 11, "division": "student", "age": "11", "group": "5그룹", "gender": "여", "name": "이은서", "birthId": "20150915-4", "team": "학생", "event1": "배영 50", "event2": "접영 50"},
  {"id": 12, "division": "student", "age": "11", "group": "5그룹", "gender": "여", "name": "지혜람", "birthId": "20150108-4", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 13, "division": "student", "age": "11", "group": "5그룹", "gender": "여", "name": "한예진", "birthId": "20150316-4", "team": "학생", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 14, "division": "student", "age": "12", "group": "6그룹", "gender": "남", "name": "김루민", "birthId": "20140724-3", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 15, "division": "student", "age": "12", "group": "6그룹", "gender": "남", "name": "오태훈", "birthId": "20141109-3", "team": "학생", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 16, "division": "student", "age": "15", "group": "7그룹", "gender": "남", "name": "박현민", "birthId": "20110608-3", "team": "학생", "event1": "평영 50", "event2": "접영 50"},
  {"id": 17, "division": "student", "age": "13", "group": "7그룹", "gender": "남", "name": "이선우", "birthId": "20130829-3", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 18, "division": "student", "age": "13", "group": "7그룹", "gender": "여", "name": "안서윤", "birthId": "20130806-4", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 19, "division": "student", "age": "14", "group": "7그룹", "gender": "여", "name": "정채윤", "birthId": "20120321-4", "team": "학생", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 21, "division": "student", "age": "8", "group": "2그룹", "gender": "여", "name": "이설하", "birthId": "20180316-4", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 22, "division": "student", "age": "8", "group": "2그룹", "gender": "여", "name": "지상희", "birthId": "20181211-4", "team": "학생", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 23, "division": "student", "age": "10", "group": "4그룹", "gender": "남", "name": "이승후", "birthId": "20160329-3", "team": "학생", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 24, "division": "student", "age": "8", "group": "2그룹", "gender": "남", "name": "이서빈", "birthId": "20180102-3", "team": "학생", "event1": "자유형 50", "event2": "접영 50"}
];

// Pinned Relay Defaults (Adults & Students)
const ADULT_DEFAULT_PINNED_RELAYS = {
  A: {
    combo1: ['이지훈', '서충근', '박재홍', '이지호', '전경미', '박선화'],
    combo2: ['박슬우', '안상준', '김기용', '박봉권'],
    combo3: ['이영경', '손혜정', '이미영', '박선화'],
    combo4: { back: '조성찬', breast: '이경열', fly: '박재홍', free: '안상준' },
    combo5: { back: '전경미', breast: '이지호', fly: '이미영', free: '손혜정' }
  },
  B: {
    combo1: ['윤주권', '정서현', '권순용', '김애란', '이은희', '김상희'],
    combo2: ['양승진', '정서현', '윤주권', '권순용'],
    combo3: ['이은희', '김애란', '김상희', '심민경'],
    combo4: { back: '윤주권', breast: '권순용', fly: '정서현', free: '양승진' },
    combo5: { back: '심민경', breast: '이은희', fly: '김애란', free: '김상희' }
  }
};

const STUDENT_DEFAULT_PINNED_RELAYS = {
  combo1: ['배건우', '손민재', '양서진', '김루민'],
  combo2: [],
  combo3: { back: '김하준', breast: '김예준', fly: '양서진', free: '배건우' },
  combo4: { back: null, breast: null, fly: null, free: null }
};

let adultPinnedRelays = JSON.parse(JSON.stringify(ADULT_DEFAULT_PINNED_RELAYS));
let studentPinnedRelays = JSON.parse(JSON.stringify(STUDENT_DEFAULT_PINNED_RELAYS));


// Firestore references (App singleton provided by firebase-config.js)
let db, docAttendanceRef, docAdultRecordsRef, docStudentRecordsRef;
try {
  db = getFirestore(firebaseApp);
  docAttendanceRef = doc(db, "attendance", "gmdc_main");
  docAdultRecordsRef = doc(db, "gmdc_swim_club", "records_2026_01_01");
  docStudentRecordsRef = doc(db, "gmdc_swim_club", "records_student_2026_01_01");
} catch (e) {
  console.error("Firebase init error in attendance.js:", e);
}

// Attendance State
let attendanceMap = {}; // { swimmerKey: { dateKey: "08:30" } }
export let allSwimmers = [];
export let viewMode = localStorage.getItem(STORAGE_VIEW_MODE_KEY) || 'simple'; // 'simple' or 'detailed'
export function setViewMode(mode) {
  viewMode = mode;
}
let eventsMode = localStorage.getItem(STORAGE_EVENTS_MODE_KEY) || 'simple'; // 'simple' (간략히: 자/평, 핀혼성) or 'detailed' (자세히: 자유형 50, 혼성 핀계영)
let searchQuery = '';
let divisionFilter = 'all'; // 'all', 'adult', 'student'
let teamFilter = 'all'; // 'all', 'A', 'B'

// Active modal state
let activeModalSwimmer = null;
let activeModalDate = null;

/**
 * Returns the nearest upcoming training date relative to current time
 */
export function getNearestTrainingDate() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = ATTENDANCE_DATES.find(d => d.key >= todayStr);
  if (upcoming) return upcoming;
  return ATTENDANCE_DATES[0];
}


/**
 * Loads Pinned Relays for Adults & Students
 */
function loadPinnedRelaysState() {
  try {
    const savedAdult = localStorage.getItem('gmdc_pinned_relays_v2');
    if (savedAdult) {
      const parsed = JSON.parse(savedAdult);
      if (parsed && parsed.A && parsed.B) {
        adultPinnedRelays = parsed;
      }
    }
  } catch (e) {}

  try {
    const savedStudent = localStorage.getItem('gmdc_student_pinned_relays_v1');
    if (savedStudent) {
      const parsedSt = JSON.parse(savedStudent);
      if (parsedSt) {
        studentPinnedRelays = parsedSt;
      }
    }
  } catch (e) {}
}

/**
 * Gets relay assignments for a swimmer (delegated to swimmerService)
 */
export function getSwimmerRelays(swimmer) {
  return _getSwimmerRelays(swimmer, adultPinnedRelays, studentPinnedRelays);
}

/**
 * Renders Swimmer Events Cell HTML (delegated to swimmerService)
 */
export function renderSwimmerEvents(s, mode = eventsMode) {
  return _renderSwimmerEvents(s, mode, adultPinnedRelays, studentPinnedRelays);
}

/**
 * Checks swimmer's participation in a specific match event (delegated to swimmerService)
 */
export function checkSwimmerMatchParticipation(swimmer, matchEvent) {
  return _checkSwimmerMatchParticipation(swimmer, matchEvent, adultPinnedRelays, studentPinnedRelays);
}

/**
 * Creates or retrieves Swimmer Match Schedule Modal
 */
export function ensureSwimmerScheduleModal() {
  let modal = document.getElementById('swimmerScheduleModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'swimmerScheduleModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div class="modal-card swimmer-schedule-modal-card">
        <div class="modal-header" style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:22px;">🏊</span>
            <div>
              <h3 id="scheduleModalSwimmerTitle" style="font-size:16px; font-weight:800; color:#0f172a; margin:0;">
                선수 경기 출전 일정표
              </h3>
              <span id="scheduleModalDaySubtitle" style="font-size:12px; color:#64748b; font-weight:600;">
                대회 일정 및 워밍업 안내
              </span>
            </div>
          </div>
          <button id="btnSwimmerScheduleCloseX" class="modal-close-btn" title="닫기" aria-label="닫기">&times;</button>
        </div>

        <div class="modal-body" style="padding:16px 20px; max-height:calc(85vh - 130px); overflow-y:auto;">
          <!-- Match Schedule Timeline List -->
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="margin:0; font-size:14px; font-weight:800; color:#1e293b; display:flex; align-items:center; gap:6px;">
                <span>⏱️ 공식 경기 순서 및 출전 경기</span>
                <span id="scheduleParticipatingCountBadge" class="badge-participating-count">0개 경기 출전</span>
              </h4>
              <span style="font-size:11.5px; color:#64748b;">(요강 제5항 최신 개정본)</span>
            </div>

            <div id="scheduleTimelineList" class="schedule-timeline-list"></div>
          </div>
        </div>

        <div class="modal-footer" style="padding:12px 20px; border-top:1px solid #e2e8f0; background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
          <button type="button" id="btnScheduleOpenFullRules" class="btn btn-secondary" style="font-size:12px; display:inline-flex; align-items:center; gap:5px; padding:6px 12px;">
            <span>📖 전체 대회요강 보기</span>
          </button>
          <button type="button" id="btnSwimmerScheduleClose" class="btn btn-primary" style="padding:6px 18px; font-weight:700;">
            확인
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Modal Close Events
    const closeBtnX = modal.querySelector('#btnSwimmerScheduleCloseX');
    const closeBtn = modal.querySelector('#btnSwimmerScheduleClose');
    const fullRulesBtn = modal.querySelector('#btnScheduleOpenFullRules');

    if (closeBtnX) closeBtnX.onclick = closeSwimmerScheduleModal;
    if (closeBtn) closeBtn.onclick = closeSwimmerScheduleModal;
    if (fullRulesBtn) {
      fullRulesBtn.onclick = () => {
        closeSwimmerScheduleModal();
        openRulesModal();
      };
    }

    modal.onclick = (e) => {
      if (e.target === modal) closeSwimmerScheduleModal();
    };
  }
  return modal;
}

export function closeSwimmerScheduleModal() {
  const modal = document.getElementById('swimmerScheduleModal');
  if (modal) modal.classList.remove('show');
}

export function openSwimmerScheduleModal(swimmer) {
  if (!swimmer) return;
  const modal = ensureSwimmerScheduleModal();

  const isStudent = swimmer.division === 'student';
  const divisionKey = isStudent ? 'student' : 'adult';
  const scheduleData = OFFICIAL_MATCH_SCHEDULE[divisionKey];

  // Header Title
  const titleEl = document.getElementById('scheduleModalSwimmerTitle');
  const subTitleEl = document.getElementById('scheduleModalDaySubtitle');
  if (titleEl) {
    const divOrGroup = swimmer.group || (isStudent ? '학생부' : '성인부');
    const teamText = swimmer.team ? ` · ${swimmer.team}팀` : '';
    titleEl.innerHTML = `<strong>${swimmer.name}</strong> <span style="font-size:13px; font-weight:600; color:#64748b;">(${divOrGroup}${teamText})</span> 선수 경기 출전 일정표`;
  }
  if (subTitleEl) {
    subTitleEl.textContent = `📅 ${scheduleData.dayLabel} · ⏱️ 워밍업 ${scheduleData.warmup} · 대회 시작 ${scheduleData.startTime}`;
  }



  // Render Timeline with Highlights
  const timelineList = document.getElementById('scheduleTimelineList');
  const countBadge = document.getElementById('scheduleParticipatingCountBadge');
  if (timelineList) {
    let participatingCount = 0;
    timelineList.innerHTML = '';

    scheduleData.events.forEach(evt => {
      const matchResult = checkSwimmerMatchParticipation(swimmer, evt);
      const isPart = matchResult.isParticipating;
      if (isPart) participatingCount++;

      const itemDiv = document.createElement('div');
      itemDiv.className = `schedule-timeline-item ${isPart ? 'is-participating' : 'is-dimmed'}`;

      if (isPart) {
        itemDiv.innerHTML = `
          <div class="timeline-left">
            <div class="timeline-order-badge">${evt.order}</div>
            <div class="timeline-event-title">${evt.name}</div>
          </div>
          <div class="timeline-right" style="text-align:right;">
            ${matchResult.detail ? `<span class="timeline-match-detail">${matchResult.detail}</span>` : ''}
          </div>
        `;
      } else {
        itemDiv.innerHTML = `
          <div class="timeline-left">
            <div class="timeline-order-badge">${evt.order}</div>
            <div class="timeline-event-title">${evt.name}</div>
          </div>
          <div class="timeline-right"></div>
        `;
      }

      timelineList.appendChild(itemDiv);
    });

    if (countBadge) {
      countBadge.textContent = `총 ${participatingCount}개 경기 출전`;
      countBadge.style.background = participatingCount > 0 ? '#10b981' : '#64748b';
    }
  }

  modal.classList.add('show');
}

/**
 * Creates or retrieves Roster Export Modal (TXT, PDF, Excel, JPG, PNG)
 */
export function ensureRosterExportModal() {
  let modal = document.getElementById('rosterExportModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rosterExportModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div class="modal-card roster-export-modal-card">
        <div class="modal-header" style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:22px;">📤</span>
            <div>
              <h3 style="font-size:16px; font-weight:800; color:#0f172a; margin:0;">
                출석 명단 출력 및 저장
              </h3>
              <span id="exportModalSubtitle" style="font-size:12px; color:#64748b; font-weight:600;">
                현재 표시 중인 명단을 원하는 형식으로 내보냅니다.
              </span>
            </div>
          </div>
          <button id="btnExportModalCloseX" class="modal-close-btn" title="닫기" aria-label="닫기">&times;</button>
        </div>

        <div class="modal-body" style="padding:20px;">
          <div id="exportTargetSummaryBox" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:10px 14px; margin-bottom:16px; font-size:12.5px; color:#334155;">
            <!-- Injected dynamically -->
          </div>

          <div style="font-size:13px; font-weight:750; color:#0f172a; margin-bottom:10px;">
            출력 형식을 선택하세요:
          </div>

          <div class="export-options-grid">
            <!-- TXT -->
            <button type="button" class="btn-export-option" data-format="txt">
              <div class="export-icon-box" style="background:#f1f5f9; color:#475569;">📝</div>
              <div class="export-info">
                <div class="export-name">텍스트 파일 (.txt)</div>
                <div class="export-desc">정돈된 UTF-8 텍스트 명단 다운로드</div>
              </div>
            </button>

            <!-- PDF -->
            <button type="button" class="btn-export-option" data-format="pdf">
              <div class="export-icon-box" style="background:#fee2e2; color:#dc2626;">📄</div>
              <div class="export-info">
                <div class="export-name">PDF 인쇄 / 저장 (.pdf)</div>
                <div class="export-desc">인쇄용 A4 표준 문서 출력</div>
              </div>
            </button>

            <!-- Excel -->
            <button type="button" class="btn-export-option" data-format="excel">
              <div class="export-icon-box" style="background:#dcfce7; color:#16a34a;">📊</div>
              <div class="export-info">
                <div class="export-name">엑셀 파일 (.csv)</div>
                <div class="export-desc">한글 깨짐 없는 스프레드시트 데이터 다운로드</div>
              </div>
            </button>

            <!-- JPG -->
            <button type="button" class="btn-export-option" data-format="jpg">
              <div class="export-icon-box" style="background:#fef3c7; color:#d97706;">🖼️</div>
              <div class="export-info">
                <div class="export-name">JPG 이미지 (.jpg)</div>
                <div class="export-desc">출석부 표 고화질 사진 저장</div>
              </div>
            </button>

            <!-- PNG -->
            <button type="button" class="btn-export-option" data-format="png">
              <div class="export-icon-box" style="background:#e0f2fe; color:#0284c7;">🎨</div>
              <div class="export-info">
                <div class="export-name">PNG 이미지 (.png)</div>
                <div class="export-desc">무손실 고해상도 그래픽 이미지 저장</div>
              </div>
            </button>
          </div>
        </div>

        <div class="modal-footer" style="padding:12px 20px; border-top:1px solid #e2e8f0; background:#f8fafc; display:flex; justify-content:flex-end;">
          <button type="button" id="btnExportModalClose" class="btn btn-secondary" style="padding:6px 16px;">
            닫기
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event Handlers
    const closeBtnX = modal.querySelector('#btnExportModalCloseX');
    const closeBtn = modal.querySelector('#btnExportModalClose');

    if (closeBtnX) closeBtnX.onclick = closeRosterExportModal;
    if (closeBtn) closeBtn.onclick = closeRosterExportModal;

    modal.onclick = (e) => {
      if (e.target === modal) closeRosterExportModal();
    };

    // Format click delegation
    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-export-option');
      if (!btn) return;
      const fmt = btn.dataset.format;
      handleRosterExport(fmt);
    });
  }
  return modal;
}

export function closeRosterExportModal() {
  const modal = document.getElementById('rosterExportModal');
  if (modal) modal.classList.remove('show');
}

export function openRosterExportModal() {
  const modal = ensureRosterExportModal();
  const list = getFilteredSwimmers();
  const nearest = getNearestTrainingDate();

  const summaryBox = document.getElementById('exportTargetSummaryBox');
  if (summaryBox) {
    const divText = divisionFilter === 'adult' ? '성인부만' : (divisionFilter === 'student' ? '학생부만' : '성인+학생 전체');
    const teamText = teamFilter === 'A' ? 'A팀(거제오션)' : (teamFilter === 'B' ? 'B팀(거제야르)' : '전체 팀');
    const modeText = viewMode === 'simple' ? `간단히 보기 (${nearest.label} 기준)` : '자세히 보기 (전체 종목 & 4회차 일정)';
    const searchText = searchQuery.trim() ? ` · 검색어: "${searchQuery.trim()}"` : '';

    summaryBox.innerHTML = `
      <div style="font-weight:750; color:#0f172a; margin-bottom:4px; font-size:13px;">
        🎯 대상 인원: <strong>총 ${list.length}명</strong> (${modeText})
      </div>
      <div style="font-size:11.5px; color:#475569; line-height:1.4;">
        • 필터 조건: [구분: ${divText}] · [소속: ${teamText}]${searchText}<br>
        • 현재 설정된 보기 모드(<strong>${viewMode === 'simple' ? '간단히' : '자세히'}</strong>)에 맞춰 파일이 생성됩니다.
      </div>
    `;
  }

  modal.classList.add('show');
}

/**
 * Handles format-specific roster export
 */
export function handleRosterExport(format) {
  const list = getFilteredSwimmers();
  if (list.length === 0) {
    showToast('⚠️ 현재 조건에 일치하는 선수가 없습니다.');
    return;
  }

  switch (format) {
    case 'txt':
      closeRosterExportModal();
      exportRosterAsTxt(list);
      break;
    case 'pdf':
      exportRosterAsPdf();
      break;
    case 'excel':
      closeRosterExportModal();
      exportRosterAsExcel(list);
      break;
    case 'jpg':
      exportRosterAsJpg();
      break;
    case 'png':
      exportRosterAsPng();
      break;
    default:
      showToast('⚠️ 지원하지 않는 형식입니다.');
  }
}

/**
 * Exports currently filtered roster as formatted Text file (.txt)
 */
export function exportRosterAsTxt(list) {
  return _exportRosterAsTxt({
    list,
    viewMode,
    attendanceMap,
    nearestDate: getNearestTrainingDate(),
    attendanceDates: ATTENDANCE_DATES,
    getSwimmerRelaysFn: getSwimmerRelays,
    showToast
  });
}

/**
 * Exports currently filtered roster as PDF via window.print
 */
export function exportRosterAsPdf() {
  return _exportRosterAsPdf({
    viewMode,
    showToast,
    onClose: closeRosterExportModal
  });
}

/**
 * Exports currently filtered roster as Excel CSV file (.csv) with UTF-8 BOM
 */
export function exportRosterAsExcel(list) {
  return _exportRosterAsExcel({
    list,
    viewMode,
    attendanceMap,
    nearestDate: getNearestTrainingDate(),
    attendanceDates: ATTENDANCE_DATES,
    getSwimmerRelaysFn: getSwimmerRelays,
    showToast
  });
}

/** Exports table as JPG image (.jpg) */
export function exportRosterAsJpg() {
  return _exportRosterAsJpg({
    viewMode,
    showToast,
    onClose: closeRosterExportModal
  });
}

/** Exports table as PNG image (.png) */
export function exportRosterAsPng() {
  return _exportRosterAsPng({
    viewMode,
    showToast,
    onClose: closeRosterExportModal
  });
}

/**
 * Loads Swimmer Rosters (delegated to swimmerService)
 */
function loadSwimmerRoster() {
  allSwimmers = loadSwimmerRosterFromStorage({
    adultFallback: ADULT_FALLBACK,
    studentFallback: STUDENT_FALLBACK,
    adultStorageKey: 'gmdc_swim_records_v1',
    studentStorageKey: 'gmdc_student_records_v1'
  });
}

/**
 * Local Cache Management
 */
function loadLocalAttendanceCache() {
  try {
    const saved = localStorage.getItem(STORAGE_CACHE_KEY);
    if (saved) {
      attendanceMap = JSON.parse(saved) || {};
    }
  } catch (e) {
    attendanceMap = {};
  }
}

function saveLocalAttendanceCache(newMap, updatedAt) {
  attendanceMap = newMap;
  try {
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(attendanceMap));
    if (updatedAt) {
      localStorage.setItem(STORAGE_LAST_UPDATED_KEY, String(updatedAt));
    }
  } catch (e) {}
}

/**
 * Renders Attendance Counts into Table Header Date Cells (성인/학생/총원)
 */
export function renderDateHeaderCounts() {
  const activeAdults = allSwimmers.filter(s => s.division === 'adult' && isSwimmerActive(s));
  const activeStudents = allSwimmers.filter(s => s.division === 'student' && isSwimmerActive(s));

  ATTENDANCE_DATES.forEach(d => {
    let adultAtt = 0;
    activeAdults.forEach(s => {
      const key = getSwimmerKey(s);
      if (attendanceMap[key] && attendanceMap[key][d.key]) {
        adultAtt++;
      }
    });

    let studentAtt = 0;
    activeStudents.forEach(s => {
      const key = getSwimmerKey(s);
      if (attendanceMap[key] && attendanceMap[key][d.key]) {
        studentAtt++;
      }
    });

    const totalAtt = adultAtt + studentAtt;
    const countEl = document.getElementById(`thCount_${d.key}`);
    if (countEl) {
      countEl.textContent = `${adultAtt}/${studentAtt}/${totalAtt}`;
      countEl.title = `${d.label} 출석: 성인 ${adultAtt}명 / 학생 ${studentAtt}명 / 총 ${totalAtt}명`;
    }
  });
}

/**
 * Firestore Real-time Sync & Cache Invalidation
 */
function initAttendanceSync() {
  const syncStatusEl = document.getElementById('attendanceSyncStatus');
  if (syncStatusEl) {
    syncStatusEl.innerHTML = `<span class="status-dot"></span><span>로컬 캐시 즉시 로드 완료</span>`;
  }

  // 1. Attendance Sync
  if (docAttendanceRef) {
    onSnapshot(docAttendanceRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.records) {
          const remoteUpdatedAt = data.updatedAt || 0;
          const localUpdatedAt = parseInt(localStorage.getItem(STORAGE_LAST_UPDATED_KEY) || '0', 10);

          if (remoteUpdatedAt > localUpdatedAt || Object.keys(attendanceMap).length === 0) {
            saveLocalAttendanceCache(data.records, remoteUpdatedAt);
            renderAttendanceTable();
            renderDateHeaderCounts();
          }
        }
        if (syncStatusEl) {
          syncStatusEl.innerHTML = `<span class="status-dot"></span><span>Firebase 클라우드 동기화 (${new Date().toLocaleTimeString('ko-KR')})</span>`;
        }
      }
    }, (err) => {
      console.warn('Attendance sync error:', err);
    });
  }

  // 2. Swimmer Roster Sync (Adults)
  if (docAdultRecordsRef) {
    onSnapshot(docAdultRecordsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.records) && data.records.length > 0) {
          localStorage.setItem('gmdc_swim_records_v1', JSON.stringify(data.records));
          if (data.pinnedRelays) {
            adultPinnedRelays = data.pinnedRelays;
            localStorage.setItem('gmdc_pinned_relays_v2', JSON.stringify(data.pinnedRelays));
          }
          loadSwimmerRoster();
          renderAttendanceTable();
          renderDateHeaderCounts();
        }
      }
    }, (err) => console.warn('Adult records sync error in attendance:', err));
  }

  // 3. Swimmer Roster Sync (Students)
  if (docStudentRecordsRef) {
    onSnapshot(docStudentRecordsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.records) && data.records.length > 0) {
          localStorage.setItem('gmdc_student_records_v1', JSON.stringify(data.records));
          if (data.pinnedRelays) {
            studentPinnedRelays = data.pinnedRelays;
            localStorage.setItem('gmdc_student_pinned_relays_v1', JSON.stringify(data.pinnedRelays));
          }
          loadSwimmerRoster();
          renderAttendanceTable();
          renderDateHeaderCounts();
        }
      }
    }, (err) => console.warn('Student records sync error in attendance:', err));
  }
}

/**
 * Saves attendance record to LocalStorage and Firestore
 */
async function recordAttendanceTime(swimmerKey, dateKey, timeStr) {
  const updatedMap = { ...attendanceMap };
  if (!updatedMap[swimmerKey]) {
    updatedMap[swimmerKey] = {};
  }

  if (timeStr) {
    updatedMap[swimmerKey][dateKey] = timeStr;
  } else {
    delete updatedMap[swimmerKey][dateKey];
    if (Object.keys(updatedMap[swimmerKey]).length === 0) {
      delete updatedMap[swimmerKey];
    }
  }

  const now = Date.now();
  saveLocalAttendanceCache(updatedMap, now);
  renderAttendanceTable();
  renderDateHeaderCounts();

  if (docAttendanceRef) {
    try {
      await setDoc(docAttendanceRef, {
        updatedAt: now,
        records: updatedMap,
        lastEditor: getCurrentUser() ? getCurrentUser().email : 'admin'
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync attendance to Firestore:', e);
    }
  }
}

/**
 * Filters swimmers based on UI controls (delegated to swimmerService)
 */
function getFilteredSwimmers() {
  return filterSwimmers(allSwimmers, { divisionFilter, teamFilter, searchQuery });
}

/**
 * Renders Table Header based on View Mode ('simple' vs 'detailed')
 */
export function renderAttendanceHeader() {
  const thead = document.getElementById('attendanceTableHead');
  if (!thead) return;

  if (viewMode === 'simple') {
    const nearest = getNearestTrainingDate();
    thead.innerHTML = `
      <tr>
        <th class="col-name-header" style="min-width: 120px; text-align:left;">선수명</th>
        <th class="col-birth-header" style="width: 100px; text-align:center;">생년월일</th>
        <th class="th-date-col" data-date-key="${nearest.key}" style="min-width: 100px; text-align:center;">
          <div class="th-date-label">${nearest.label}</div>
          <div class="th-date-count" id="thCount_${nearest.key}" title="성인 / 학생 / 총 출석인원">0/0/0</div>
        </th>
      </tr>
    `;
  } else {
    // Detailed Mode (with Clickable Events Header for simple/detailed toggle)
    thead.innerHTML = `
      <tr>
        <th class="col-division" style="width: 55px; text-align:center; white-space: nowrap;">구분</th>
        <th class="col-team" style="width: 65px; text-align:center; white-space: nowrap;">소속팀</th>
        <th class="col-name-header" style="min-width: 110px; text-align:left;">선수명</th>
        <th class="col-birth-header" style="width: 90px; text-align:center;">생년월일</th>
        <th id="thStrokeHeader" class="th-clickable-events" style="min-width: 100px; text-align:center; cursor:pointer;" title="클릭하여 간략히/자세히 전환">
          <div>신청종목</div>
          <div class="events-mode-badge" style="margin-top:2px; display:inline-block;">${eventsMode === 'simple' ? '간략히' : '자세히'}</div>
        </th>
        ${ATTENDANCE_DATES.map(d => `
          <th class="th-date-col" data-date-key="${d.key}" style="min-width: 95px; text-align:center;">
            <div class="th-date-label">${d.label}</div>
            <div class="th-date-count" id="thCount_${d.key}" title="성인 / 학생 / 총 출석인원">0/0/0</div>
          </th>
        `).join('')}
      </tr>
    `;
  }
}

/**
 * Renders Attendance Table Rows
 */
export function renderAttendanceTable() {
  renderAttendanceHeader();

  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;

  const list = getFilteredSwimmers();
  const totalCountEl = document.getElementById('attendanceTotalCount');
  if (totalCountEl) {
    totalCountEl.textContent = `📋 출석 명단 (총 ${list.length}명)`;
  }

  tbody.innerHTML = '';

  const isSimple = viewMode === 'simple';
  const nearestDate = getNearestTrainingDate();

  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${isSimple ? 3 : 9}" style="padding: 40px; text-align: center; color: var(--text-muted);">일치하는 선수가 없습니다.</td>`;
    tbody.appendChild(tr);
    return;
  }

  list.forEach((s) => {
    const tr = document.createElement('tr');
    const key = getSwimmerKey(s);
    const swimmerAtt = attendanceMap[key] || {};

    const isStudent = s.division === 'student';
    const divisionBadge = isStudent 
      ? `<span class="division-badge student" style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-weight:700; font-size:11px;">학생</span>` 
      : `<span class="division-badge adult" style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:700; font-size:11px;">성인</span>`;

    const teamBadge = s.team === 'B'
      ? `<span class="relay-chip relay-b" style="font-size:11px; padding:2px 6px;">B팀</span>`
      : (s.team === 'A' ? `<span class="relay-chip relay-a" style="font-size:11px; padding:2px 6px;">A팀</span>` : `<span style="color:var(--text-muted); font-size:11px;">-</span>`);

    const birthFormatted = formatBirthDisplay(s.birthId || s.birth);

    if (isSimple) {
      // Simple Mode: [선수명, 생년월일, 가장 가까운 훈련일]
      const timeVal = swimmerAtt[nearestDate.key] || '';
      const isAtt = Boolean(timeVal);

      tr.innerHTML = `
        <td class="col-name col-name-cell" data-swimmer-key="${key}" style="cursor:pointer;" title="클릭하여 ${s.name} 선수의 경기 출전 순서 및 요강 일정 확인">
          <div style="display:flex; align-items:center; gap:4px;">
            <strong class="swimmer-name-text">${s.name}</strong>
          </div>
        </td>
        <td class="col-birth" style="text-align:center; color:var(--text-muted); font-size:12px; font-weight:500;">
          ${birthFormatted}
        </td>
        <td 
          class="cell-attendance ${isAtt ? 'is-attended' : 'empty'}" 
          data-swimmer-key="${key}" 
          data-swimmer-name="${s.name}" 
          data-date-key="${nearestDate.key}" 
          data-date-label="${nearestDate.label}"
          title="${isAdmin() ? `클릭하여 ${s.name}의 ${nearestDate.label} 출퇴장 시간 수정` : `${s.name} - ${nearestDate.label}: ${isAtt ? timeVal : '미출석'}`}"
        >
          ${renderAttendanceCellContent(timeVal)}
        </td>
      `;
    } else {
      // Detailed Mode: [구분, 소속팀, 선수명, 생년월일, 신청종목, 4개 훈련일자]
      const eventsHtml = renderSwimmerEvents(s, eventsMode);

      tr.innerHTML = `
        <td class="col-division" style="text-align:center; white-space:nowrap;">${divisionBadge}</td>
        <td class="col-team" style="text-align:center; white-space:nowrap;">${teamBadge}</td>
        <td class="col-name col-name-cell">
          <div style="display:flex; align-items:center; gap:4px;">
            <strong class="swimmer-name-text">${s.name}</strong>
          </div>
        </td>
        <td class="col-birth" style="text-align:center; color:var(--text-muted); font-size:12px; font-weight:500;">
          ${birthFormatted}
        </td>
        <td class="col-strokes" data-swimmer-key="${key}" style="text-align:center;" title="클릭하여 ${s.name} 선수의 경기 출전 순서 및 요강 일정 확인">
          ${eventsHtml}
        </td>
        ${ATTENDANCE_DATES.map(d => {
          const timeVal = swimmerAtt[d.key] || '';
          const isAtt = Boolean(timeVal);
          return `
            <td 
              class="cell-attendance ${isAtt ? 'is-attended' : 'empty'}" 
              data-swimmer-key="${key}" 
              data-swimmer-name="${s.name}" 
              data-date-key="${d.key}" 
              data-date-label="${d.label}"
              title="${isAdmin() ? `클릭하여 ${s.name}의 ${d.label} 출퇴장 시간 수정` : `${s.name} - ${d.label}: ${isAtt ? timeVal : '미출석'}`}"
            >
              ${renderAttendanceCellContent(timeVal)}
            </td>
          `;
        }).join('')}
      `;
    }

    tbody.appendChild(tr);
  });

  renderDateHeaderCounts();
}

/**
 * Formats attendance time display for table cells
 */
function renderAttendanceCellContent(timeVal) {
  if (!timeVal) return '-';
  if (timeVal.includes('~')) {
    const [inT, outT] = timeVal.split('~').map(t => t.trim());
    return `<div class="att-time-range"><span class="att-in">${inT}</span><span class="att-sep">~</span><span class="att-out">${outT}</span></div>`;
  }
  return timeVal;
}

/**
 * Parses attendance time string into { inTime, outTime }
 */
function parseAttendanceTime(str) {
  if (!str) return { inTime: '', outTime: '' };
  if (str.includes('~')) {
    const parts = str.split('~').map(s => s.trim());
    return { inTime: parts[0] || '', outTime: parts[1] || '' };
  }
  return { inTime: str.trim(), outTime: '' };
}

/**
 * Formats entry and exit time into combined storage string
 */
function formatAttendanceTime(inTime, outTime) {
  const i = (inTime || '').trim();
  const o = (outTime || '').trim();
  if (!i && !o) return '';
  if (i && o) return `${i} ~ ${o}`;
  return i || o;
}

/**
 * Time Picker Modal Logic (2-Slot: Entry & Exit Management)
 */
function setupTimePickerModal() {
  const modal = document.getElementById('timePickerModal');
  const closeBtn = document.getElementById('btnTimePickerClose');
  const cancelBtn = document.getElementById('btnTimePickerCancel');
  const saveBtn = document.getElementById('btnTimePickerSave');
  const deleteBtn = document.getElementById('btnTimePickerDelete');

  const slotInBtn = document.getElementById('slotInBtn');
  const slotOutBtn = document.getElementById('slotOutBtn');
  const slotInValText = document.getElementById('slotInValText');
  const slotOutValText = document.getElementById('slotOutValText');
  const slotEditingIndicator = document.getElementById('slotEditingIndicator');
  const btnSetNowTime = document.getElementById('btnSetNowTime');
  const btnClearOutTime = document.getElementById('btnClearOutTime');

  const hourInput = document.getElementById('timePickerHour');
  const minInput = document.getElementById('timePickerMin');
  const btnHourUp = document.getElementById('btnHourUp');
  const btnHourDown = document.getElementById('btnHourDown');
  const btnMinUp = document.getElementById('btnMinUp');
  const btnMinDown = document.getElementById('btnMinDown');
  const titleEl = document.getElementById('timePickerTitle');

  // Modal State
  let modalInTime = '08:30';
  let modalOutTime = '';
  let activeSlot = 'in'; // 'in' | 'out'

  function pad(num) {
    return String(num).padStart(2, '0');
  }

  function syncActiveSlotFromInputs() {
    const h = pad(parseInt(hourInput.value || '0', 10));
    const m = pad(parseInt(minInput.value || '0', 10));
    const timeStr = `${h}:${m}`;
    if (activeSlot === 'in') {
      modalInTime = timeStr;
      if (slotInValText) slotInValText.textContent = timeStr;
    } else {
      modalOutTime = timeStr;
      if (slotOutValText) slotOutValText.textContent = timeStr;
      if (btnClearOutTime) btnClearOutTime.style.display = 'inline-flex';
    }
  }

  function updateSlotUI() {
    if (slotInValText) slotInValText.textContent = modalInTime || '미입력';
    if (slotOutValText) slotOutValText.textContent = modalOutTime || '미입력';

    if (slotInBtn) slotInBtn.classList.toggle('active', activeSlot === 'in');
    if (slotOutBtn) slotOutBtn.classList.toggle('active', activeSlot === 'out');

    if (slotEditingIndicator) {
      if (activeSlot === 'in') {
        slotEditingIndicator.innerHTML = '🚪 <strong>입장 시간</strong>을 조절하고 있습니다';
      } else {
        slotEditingIndicator.innerHTML = '🏃 <strong>퇴장 시간</strong>을 조절하고 있습니다';
      }
    }

    const currentTime = activeSlot === 'in' ? modalInTime : modalOutTime;
    if (currentTime && currentTime.includes(':')) {
      const [h, m] = currentTime.split(':');
      if (hourInput) hourInput.value = h;
      if (minInput) minInput.value = m;
    } else {
      const now = new Date();
      if (hourInput) hourInput.value = pad(now.getHours());
      if (minInput) minInput.value = pad(now.getMinutes());
      if (activeSlot === 'out') {
        modalOutTime = `${hourInput.value}:${minInput.value}`;
        if (slotOutValText) slotOutValText.textContent = modalOutTime;
      }
    }

    if (btnClearOutTime) {
      btnClearOutTime.style.display = (activeSlot === 'out' && modalOutTime) ? 'inline-flex' : 'none';
    }
  }

  function adjustHour(delta) {
    let val = parseInt(hourInput.value || '0', 10) + delta;
    if (val < 0) val = 23;
    if (val > 23) val = 0;
    hourInput.value = pad(val);
    syncActiveSlotFromInputs();
  }

  function adjustMin(delta) {
    let val = parseInt(minInput.value || '0', 10) + delta;
    if (val < 0) val = 59;
    if (val > 59) val = 0;
    minInput.value = pad(val);
    syncActiveSlotFromInputs();
  }

  function setCurrentTime() {
    const now = new Date();
    const h = pad(now.getHours());
    const m = pad(now.getMinutes());
    if (hourInput) hourInput.value = h;
    if (minInput) minInput.value = m;
    syncActiveSlotFromInputs();
  }

  function closeModal() {
    if (modal) modal.classList.remove('show');
    activeModalSwimmer = null;
    activeModalDate = null;
  }

  // Slot Switching Buttons
  if (slotInBtn) {
    slotInBtn.onclick = () => {
      if (activeSlot !== 'in') {
        syncActiveSlotFromInputs();
        activeSlot = 'in';
        updateSlotUI();
      }
    };
  }

  if (slotOutBtn) {
    slotOutBtn.onclick = () => {
      if (activeSlot !== 'out') {
        syncActiveSlotFromInputs();
        activeSlot = 'out';
        updateSlotUI();
      }
    };
  }

  // Spin button events
  if (btnHourUp) btnHourUp.onclick = () => adjustHour(1);
  if (btnHourDown) btnHourDown.onclick = () => adjustHour(-1);
  if (btnMinUp) btnMinUp.onclick = () => adjustMin(1);
  if (btnMinDown) btnMinDown.onclick = () => adjustMin(-1);

  // Mouse wheel scroll adjustments
  if (hourInput) {
    hourInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      adjustHour(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }

  if (minInput) {
    minInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      adjustMin(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }

  // Set Current Time Button
  if (btnSetNowTime) {
    btnSetNowTime.onclick = () => {
      setCurrentTime();
    };
  }

  // Clear Exit Time Button
  if (btnClearOutTime) {
    btnClearOutTime.onclick = () => {
      modalOutTime = '';
      if (slotOutValText) slotOutValText.textContent = '미입력';
      btnClearOutTime.style.display = 'none';
      if (window.showToast) {
        window.showToast('🏃 퇴장 시간이 제외되었습니다. (입장 시간만 저장됩니다)');
      }
    };
  }

  // Save button
  if (saveBtn) {
    saveBtn.onclick = async () => {
      if (!activeModalSwimmer || !activeModalDate) return;
      syncActiveSlotFromInputs();
      const finalTimeStr = formatAttendanceTime(modalInTime, modalOutTime);
      await recordAttendanceTime(activeModalSwimmer.key, activeModalDate.key, finalTimeStr);
      showToast(`💾 [${activeModalSwimmer.name}] ${activeModalDate.label} 출퇴장 (${finalTimeStr}) 저장되었습니다.`);
      closeModal();
    };
  }

  // Delete button
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!activeModalSwimmer || !activeModalDate) return;
      await recordAttendanceTime(activeModalSwimmer.key, activeModalDate.key, '');
      showToast(`🗑️ [${activeModalSwimmer.name}] ${activeModalDate.label} 출석 전체가 취소(삭제)되었습니다.`);
      closeModal();
    };
  }

  // Close & Cancel buttons
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  // Delegate attendance cell click
  document.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell-attendance');
    if (!cell) return;

    if (!isAdmin()) {
      if (window.showToast) {
        window.showToast('⚠️ 훈련 출석 체크는 관리자 계정으로 로그인 후 수정할 수 있습니다.');
      }
      return;
    }

    const swimmerKey = cell.dataset.swimmerKey;
    const swimmerName = cell.dataset.swimmerName;
    const dateKey = cell.dataset.dateKey;
    const dateLabel = cell.dataset.dateLabel;

    activeModalSwimmer = { key: swimmerKey, name: swimmerName };
    activeModalDate = { key: dateKey, label: dateLabel };

    if (titleEl) {
      titleEl.innerHTML = `<strong>${swimmerName}</strong> · ${dateLabel} 훈련 출석`;
    }

    const currentVal = (attendanceMap[swimmerKey] && attendanceMap[swimmerKey][dateKey]) || '';
    const parsed = parseAttendanceTime(currentVal);

    modalInTime = parsed.inTime;
    modalOutTime = parsed.outTime;

    const now = new Date();
    const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (modalInTime) {
      // 이미 출석이 되어 있는 인원: 퇴장 시간 슬롯을 기본 활성화하여 빠른 퇴장 입력 유도!
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
      activeSlot = 'out';
      if (!modalOutTime) {
        modalOutTime = nowStr;
      }
    } else {
      // 미출석 인원: 입장 시간 슬롯 기본 활성화
      if (deleteBtn) deleteBtn.style.display = 'none';
      activeSlot = 'in';
      modalInTime = nowStr;
      modalOutTime = '';
    }

    updateSlotUI();

    if (modal) modal.classList.add('show');
  });
}

/**
 * Toggles View Mode ('simple' <-> 'detailed')
 */
export function toggleViewMode() {
  viewMode = viewMode === 'simple' ? 'detailed' : 'simple';
  localStorage.setItem(STORAGE_VIEW_MODE_KEY, viewMode);
  updateViewModeUI();
  renderAttendanceTable();
}

function updateViewModeUI() {
  const btnText = document.getElementById('btnToggleViewModeText');
  const btn = document.getElementById('btnToggleViewMode');
  if (btnText) {
    btnText.textContent = viewMode === 'simple' ? '간단히' : '자세히';
  }
  if (btn) {
    btn.classList.toggle('active', viewMode === 'simple');
    btn.title = `현재 보기: ${viewMode === 'simple' ? '간단히' : '자세히'} (클릭 시 전환)`;
  }
}

/**
 * Binds Toolbar Controls & Event Delegations
 */
function bindAttendanceToolbar() {
  // Search
  let searchRaf = null;
  const searchInput = document.getElementById('attendanceSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (searchRaf) cancelAnimationFrame(searchRaf);
      searchRaf = requestAnimationFrame(() => {
        renderAttendanceTable();
      });
    });
  }

  // Division select
  const divSelect = document.getElementById('attendanceDivisionSelect');
  if (divSelect) {
    divSelect.addEventListener('change', (e) => {
      divisionFilter = e.target.value;
      renderAttendanceTable();
    });
  }

  // Team select
  const teamSelect = document.getElementById('attendanceTeamSelect');
  if (teamSelect) {
    teamSelect.addEventListener('change', (e) => {
      teamFilter = e.target.value;
      renderAttendanceTable();
    });
  }

  // View Mode Toggle Button
  const viewModeBtn = document.getElementById('btnToggleViewMode');
  if (viewModeBtn) {
    viewModeBtn.onclick = toggleViewMode;
  }

  // Click on Table Header for Events Column (Event Delegation on #attendanceTableHead)
  const thead = document.getElementById('attendanceTableHead');
  if (thead) {
    thead.addEventListener('click', (e) => {
      const thStroke = e.target.closest('#thStrokeHeader');
      if (thStroke) {
        eventsMode = eventsMode === 'simple' ? 'detailed' : 'simple';
        localStorage.setItem(STORAGE_EVENTS_MODE_KEY, eventsMode);
        renderAttendanceTable();
        showToast(`🏷️ 신청 종목 표기가 [${eventsMode === 'simple' ? '간략히 (자/평, 핀혼성 등)' : '자세히'}]로 전환되었습니다.`);
      }
    });
  }

  // Update initial view mode UI
  updateViewModeUI();

  // Export Roster Button
  const exportBtn = document.getElementById('btnExportRosterModal');
  if (exportBtn) {
    exportBtn.onclick = () => {
      openRosterExportModal();
    };
  }

  // Click on td.col-strokes or simple-mode td.col-name to open Swimmer Match Schedule Modal
  document.addEventListener('click', (e) => {
    const strokeCell = e.target.closest('.col-strokes');
    const nameCell = e.target.closest('.col-name-cell');
    const cell = strokeCell || (viewMode === 'simple' ? nameCell : null);

    if (!cell) return;

    const swimmerKey = cell.dataset.swimmerKey;
    if (swimmerKey) {
      const swimmer = allSwimmers.find(s => getSwimmerKey(s) === swimmerKey);
      if (swimmer) {
        openSwimmerScheduleModal(swimmer);
      }
    }
  });

  // ESC key to close Modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSwimmerScheduleModal();
      closeRosterExportModal();
    }
  });
}

/**
 * Toast helper
 */
export function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
}
window.showToast = showToast;

/**
 * Initialize Attendance App
 */
export function initAttendanceApp() {
  initAuth({
    showToast: showToast,
    onAuthChange: (authInfo) => {
      document.body.classList.toggle('is-readonly', !authInfo.isAdmin);
      renderAttendanceTable();
    }
  });

  loadPinnedRelaysState();
  loadSwimmerRoster();
  loadLocalAttendanceCache();
  bindAttendanceToolbar();
  setupTimePickerModal();
  ensureSwimmerScheduleModal();
  ensureRosterExportModal();

  renderAttendanceTable();
  initAttendanceSync();
}

// Auto init on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAttendanceApp);
} else {
  initAttendanceApp();
}
