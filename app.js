/**
 * GMDC 수영 기록 및 대회 출전 관리 시스템
 * Firebase Cloud Firestore 실시간 연동, 계영 최적 조합 연산, 출전 종목 현황 매트릭스
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, getDoc, getDocs, collection, addDoc, deleteDoc, updateDoc, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initAuth, isAdmin, canEditRecords, isDeadlineExpired, loginWithGoogle, logoutUser, getCurrentUser, formatUserDisplayName } from "./auth.js";

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
const SNAPSHOT_COL_NAME = "gmdc_swim_snapshots";

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  DOC_REF = doc(db, "gmdc_swim_club", "records_2026_01_01");
} catch (err) {
  console.error("Firebase 초기화 에러:", err);
}

const APP_VERSION = 'v2026.08.19.06';
let isScenarioMode = false;
let isInitialSyncCompleted = false;
let serverRecordsCache = null;

const STORAGE_KEY = 'gmdc_swim_records_v1';
const STICKY_STORAGE_KEY = 'gmdc_pinned_card_id';
const MODAL_STORAGE_KEY = 'gmdc_hide_notice_modal_date';
const EVENTS_MODE_KEY = 'gmdc_events_view_mode';
const RECORDS_MODE_KEY = 'gmdc_records_view_mode';
const ADULT_TEAM_KEY = 'gmdc_adult_team';

let currentAdultTeam = localStorage.getItem(ADULT_TEAM_KEY) || 'A';

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

// 2025년 출전자 분포 데이터 (작년 비교용)
const PREV_YEAR_DISTRIBUTION = {
  '남': {
    '1그룹': { '핀자유형 50': 0, '핀접영 50': 1, '자유형 50': 3, '배영 50': 1, '평영 50': 1, '접영 50': 3, total: 9 },
    '2그룹': { '핀자유형 50': 0, '핀접영 50': 0, '자유형 50': 0, '배영 50': 0, '평영 50': 0, '접영 50': 0, total: 0 },
    '3그룹': { '핀자유형 50': 2, '핀접영 50': 2, '자유형 50': 8, '배영 50': 1, '평영 50': 4, '접영 50': 5, total: 22 },
    '4그룹': { '핀자유형 50': 14, '핀접영 50': 19, '자유형 50': 25, '배영 50': 9, '평영 50': 19, '접영 50': 11, total: 97 },
    '5그룹': { '핀자유형 50': 13, '핀접영 50': 8, '자유형 50': 5, '배영 50': 1, '평영 50': 11, '접영 50': 6, total: 44 },
    '6그룹': { '핀자유형 50': 7, '핀접영 50': 7, '자유형 50': 5, '배영 50': 3, '평영 50': 6, '접영 50': 3, total: 31 },
  },
  '여': {
    '1그룹': { '핀자유형 50': 0, '핀접영 50': 0, '자유형 50': 4, '배영 50': 1, '평영 50': 2, '접영 50': 2, total: 9 },
    '2그룹': { '핀자유형 50': 0, '핀접영 50': 0, '자유형 50': 0, '배영 50': 0, '평영 50': 0, '접영 50': 0, total: 0 },
    '3그룹': { '핀자유형 50': 3, '핀접영 50': 4, '자유형 50': 5, '배영 50': 5, '평영 50': 3, '접영 50': 3, total: 23 },
    '4그룹': { '핀자유형 50': 14, '핀접영 50': 11, '자유형 50': 18, '배영 50': 10, '평영 50': 15, '접영 50': 4, total: 72 },
    '5그룹': { '핀자유형 50': 5, '핀접영 50': 4, '자유형 50': 8, '배영 50': 8, '평영 50': 2, '접영 50': 2, total: 29 },
    '6그룹': { '핀자유형 50': 2, '핀접영 50': 4, '자유형 50': 4, '배영 50': 4, '평영 50': 1, '접영 50': 0, total: 15 },
  }
};

let isMatrixCompareMode = localStorage.getItem('gmdc_matrix_compare_mode') === 'true';

// Initial 40 Swimmer Records (A팀: 30명, B팀: 10명)
const DEFAULT_RECORDS = [
  { id: 1, age: '15', group: '1그룹', gender: '남', name: '박슬우', birthId: '20100223-3', phone: '010-2558-7116', club: 'GMDC', depositor: 'GMDC', address: '거제시 문동 1길, 42, 문동푸르지오 104동 2104호', team: 'A', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '25.13', back: '31', breast: '34', fly: '28.28' },
  { id: 2, age: '15', group: '1그룹', gender: '남', name: '이지훈', birthId: '20100908-3', phone: '010-4176-0239', club: 'GMDC', depositor: 'GMDC', address: '거제시 옥포동 308 거제엘크루랜드마크 아파트 104동 2302호', team: 'A', event1: '핀자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 3, age: '16', group: '1그룹', gender: '남', name: '이채율', birthId: '20090814-3', phone: '010-7637-9313', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 연초면 거제북로57 연초일성유수안 104동 2302호', team: 'B', event1: '핀자유형 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 4, age: '17', group: '1그룹', gender: '남', name: '조성찬', birthId: '20080718-3', phone: '010-6681-9874', club: 'GMDC', depositor: 'GMDC', address: '거제시 소동8길 11 스타힐스오션시티 105동 703호', team: 'A', event1: '자유형 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 5, age: '17', group: '1그룹', gender: '여', name: '이지호', birthId: '20080506-4', phone: '010-6451-0229', club: 'GMDC', depositor: 'GMDC', address: '거제시 옥포동 308 거제엘크루랜드마크 아파트 104동 2302호', team: 'A', event1: '핀자유형 50', event2: '접영 50', finFly: '', finFree: '31.07', free: '36.78', back: '', breast: '', fly: '' },
  { id: 6, age: '24', group: '2그룹', gender: '여', name: '추성비', birthId: '20010521-4', phone: '010-2818-2055', club: 'GMDC', depositor: 'GMDC', address: '거제시 능포로 4길5 동헌하이츠 802호', team: 'A', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '40.48', back: '', breast: '', fly: '47.99' },
  { id: 7, age: '24', group: '2그룹', gender: '여', name: '이영경', birthId: '20011204-4', phone: '010-6327-7828', club: 'GMDC', depositor: 'GMDC', address: '거제시 장평1로 86, 삼성S빌리지 B동 1005호', team: 'A', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 8, age: '33', group: '3그룹', gender: '남', name: '안재홍', birthId: '19920211-1', phone: '010-7199-7719', club: 'GMDC', depositor: 'GMDC', address: '거제시 아주로 100-10 111동 501호', team: 'A', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 9, age: '38', group: '3그룹', gender: '여', name: '노언영', birthId: '19870712-2', phone: '010-3833-3074', club: 'GMDC', depositor: 'GMDC', address: '거제시 제산로86, 더샵 101동 406호', team: 'A', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 10, age: '37', group: '3그룹', gender: '여', name: '최이슬', birthId: '19881213-2', phone: '010-2398-6484', club: 'GMDC', depositor: 'GMDC', address: '거제시 아주로73 석호해와루아파트 106동 403호', team: 'A', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 11, age: '43', group: '4그룹', gender: '남', name: '고석보', birthId: '19821227-1', phone: '010-4040-6987', club: 'GMDC', depositor: 'GMDC', address: '거제시 능포로 218 나동 503호', team: 'A', event1: '핀접영 50', event2: '자유형 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 12, age: '44', group: '4그룹', gender: '남', name: '김기용', birthId: '19810929-1', phone: '010-4018-3188', club: 'GMDC', depositor: 'GMDC', address: '거제시 아주로 63 미진이지비아 103동 704호', team: 'A', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '', free: '35.69', back: '', breast: '41.65', fly: '' },
  { id: 40, age: '44', group: '4그룹', gender: '남', name: '김승주', birthId: '19811211-1', phone: '010-4442-7682', club: 'GMDC', depositor: 'GMDC', address: '거제시 고현항2로51 유로아일랜드 102동 2603호', team: 'A', event1: '자유형 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 13, age: '42', group: '4그룹', gender: '남', name: '김준영', birthId: '19830201-1', phone: '010-4572-7285', club: 'GMDC', depositor: 'GMDC', address: '거제시 고현항2로 51, 202동 1804호', team: 'A', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 14, age: '44', group: '4그룹', gender: '남', name: '손철수', birthId: '19810217-1', phone: '010-7142-8269', club: 'GMDC', depositor: 'GMDC', address: '거제시 고현항2로51 207동 3002호', team: 'A', event1: '핀자유형 50', event2: '자유형 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 15, age: '44', group: '4그룹', gender: '남', name: '안상준', birthId: '19811115-1', phone: '010-4005-7171', club: 'GMDC', depositor: 'GMDC', address: '거제시 아주2로 138, 102동 1801호', team: 'A', event1: '자유형 50', event2: '접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 16, age: '41', group: '4그룹', gender: '남', name: '양승진', birthId: '19840221-1', phone: '010-4252-4589', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 장평2로19 103동 402호', team: 'B', event1: '자유형 50', event2: '', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 17, age: '44', group: '4그룹', gender: '남', name: '이도형', birthId: '19810823-1', phone: '010-5155-2728', club: 'GMDC', depositor: 'GMDC', address: '거제시 장평1로 86, 삼성S빌리지 B동 202호', team: 'A', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 18, age: '42', group: '4그룹', gender: '남', name: '정서현', birthId: '19830903-1', phone: '010-4266-4766', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 상동5길 117-16, 206동 402호', team: 'B', event1: '평영 50', event2: '배영 50', finFly: '', finFree: '27.92', free: '33.59', back: '', breast: '', fly: '' },
  { id: 19, age: '47', group: '4그룹', gender: '여', name: '김상희', birthId: '19780602-2', phone: '010-6880-5472', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 제산로 2-5 삼성쉐르빌APT 105동 904호', team: 'B', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 20, age: '43', group: '4그룹', gender: '여', name: '박다유', birthId: '19820825-2', phone: '010-8234-5210', club: 'GMDC', depositor: 'GMDC', address: '거제시 장평1로 86, 삼성S빌리지 B동 202호', team: 'A', event1: '자유형 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 21, age: '48', group: '4그룹', gender: '여', name: '손혜정', birthId: '19770415-2', phone: '010-8603-9827', club: 'GMDC', depositor: 'GMDC', address: '거제시 일운면 소동8길 11, 서희 108동 303호', team: 'A', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 22, age: '40', group: '4그룹', gender: '여', name: '심민경', birthId: '19850520-2', phone: '010-9611-8332', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 거제 중앙로3길 15, 102동 1003호', team: 'B', event1: '자유형 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 23, age: '42', group: '4그룹', gender: '여', name: '여수연', birthId: '19830209-2', phone: '010-3723-8453', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 용소1길 17-17, 푸르지오 108동 203호', team: 'B', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 24, age: '44', group: '4그룹', gender: '여', name: '이미영', birthId: '19811014-2', phone: '010-9688-1754', club: 'GMDC', depositor: 'GMDC', address: '거제시 아주로 63 미진이지비아 103동 704호', team: 'A', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '30.42', free: '', back: '', breast: '', fly: '57.17' },
  { id: 25, age: '41', group: '4그룹', gender: '여', name: '이은희', birthId: '19840528-2', phone: '010-7456-1512', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 상동1길 15-9, 302동 104호', team: 'B', event1: '배영 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 26, age: '50', group: '5그룹', gender: '남', name: '박재홍', birthId: '19750715-1', phone: '010-8707-5940', club: 'GMDC', depositor: 'GMDC', address: '거재시 아주로 100-11 204동 602호', team: 'A', event1: '핀자유형 50', event2: '핀접영 50', finFly: '30.29', finFree: '28.08', free: '', back: '', breast: '', fly: '' },
  { id: 27, age: '57', group: '5그룹', gender: '남', name: '박진홍', birthId: '19681220-1', phone: '010-2517-9826', club: 'GMDC', depositor: 'GMDC', address: '거제시 일운면 소동8길 11, 서희 108동 303호', team: 'A', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 28, age: '50', group: '5그룹', gender: '남', name: '서충근', birthId: '19750724-1', phone: '010-5566-3542', club: 'GMDC', depositor: 'GMDC', address: '거제시 성산로42 옥포이편한세상', team: 'A', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '27.43', free: '', back: '', breast: '', fly: '99.99' },
  { id: 29, age: '50', group: '5그룹', gender: '남', name: '성지경', birthId: '19750223-1', phone: '010-2587-7399', club: 'GMDC', depositor: 'GMDC', address: '거제시 상동5길 117-50, 303동 204호', team: 'A', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 30, age: '51', group: '5그룹', gender: '남', name: '이경열', birthId: '19740501-1', phone: '010-5065-8643', club: 'GMDC', depositor: 'GMDC', address: '거제시 아주로 73, 석호해와루아파트 103동 603호', team: 'A', event1: '핀자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '43.51', fly: '' },
  { id: 31, age: '53', group: '5그룹', gender: '여', name: '김애란', birthId: '19720727-2', phone: '010-5146-9873', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 소동8길 11 스타힐스오션시티 105동 703호', team: 'B', event1: '자유형 50', event2: '배영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 32, age: '58', group: '5그룹', gender: '여', name: '박선화', birthId: '19671212-2', phone: '010-2599-6441', club: 'GMDC', depositor: 'GMDC', address: '거제시 옥수로6길160 조각공원빌 501호', team: 'A', event1: '핀자유형 50', event2: '평영 50', finFly: '', finFree: '33.64', free: '46.66', back: '', breast: '', fly: '' },
  { id: 33, age: '56', group: '5그룹', gender: '여', name: '전경미', birthId: '19690201-2', phone: '010-6332-4009', club: 'GMDC', depositor: 'GMDC', address: '거제시 아주2로 2길 10 코오랑하늘채 102동 302호', team: 'A', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '32.42', free: '', back: '55.88', breast: '', fly: '' },
  { id: 34, age: '62', group: '6그룹', gender: '남', name: '박봉권', birthId: '19630807-1', phone: '010-9669-5629', club: 'GMDC', depositor: 'GMDC', address: '거제시 장승포로 16번  1호', team: 'A', event1: '배영 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 35, age: '63', group: '6그룹', gender: '남', name: '성환용', birthId: '19620713-1', phone: '010-9689-2830', club: 'GMDC', depositor: 'GMDC', address: '거제시 능포로2길 38, 옥명대우아파트 105동 1203호', team: 'A', event1: '핀자유형 50', event2: '핀접영 50', finFly: '', finFree: '99.99', free: '', back: '', breast: '', fly: '' },
  { id: 36, age: '59', group: '6그룹', gender: '여', name: '송원자', birthId: '19660325-2', phone: '010-2854-3715', club: 'GMDC', depositor: 'GMDC', address: '거제시 능포로2길62 롯데캐슬 302동 801호', team: 'A', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 37, age: '62', group: '6그룹', gender: '여', name: '최지희', birthId: '19630705-2', phone: '010-3560-6375', club: 'GMDC', depositor: 'GMDC', address: '거제시 상동7길30, 대동다숲 124동 1406호', team: 'A', event1: '자유형 50', event2: '핀자유형 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 38, age: '61', group: '6그룹', gender: '남', name: '권순용', birthId: '19650101-1', phone: '010-5890-7052', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 동부면 거제남서로 3136', team: 'B', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 39, age: '27', group: '2그룹', gender: '남', name: '정성민', birthId: '19990101-1', phone: '010-9989-7218', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 동부면 산양리 671-1', team: 'B', event1: '자유형 50', event2: '평영 50', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' },
  { id: 41, age: '17', group: '1그룹', gender: '남', name: '이동규', birthId: '20080508-3', phone: '010-8301-1709', club: 'GMDC', depositor: 'GMDC야호', address: '거제시 문동1길 42, 110동 1202호', team: 'B', event1: '', event2: '', finFly: '', finFree: '', free: '', back: '', breast: '', fly: '' }
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
let currentFilter = 'all'; // 'all', '남', '여'
let currentTeamFilter = 'all'; // 'all', 'A', 'B'
let currentGroupFilter = 'all'; // 'all', '1그룹' ~ '6그룹'
let sortColumn = null;
let sortDirection = 'asc';
let recordsViewMode = 'detailed'; // 'detailed' (기본) | 'simple'

// Events View State
let eventsSearchQuery = '';
let eventsGenderFilter = 'all';
let eventsTeamFilter = 'all';
let eventsGroupFilter = 'all';
let eventsViewMode = 'simple'; // 'simple' (기본) | 'detailed'

let pinnedComboCardId = null; // 고정된 조합 카드 ID (최대 1개)
let saveTimeout = null;

// ==========================================
// PINNED RELAY SELECTIONS (개인별 단체전 선발 고정)
// ==========================================
const PINNED_RELAYS_STORAGE_KEY = "gmdc_pinned_relays_v2";

const RELAY_TITLES = {
  combo1: '혼성 핀계영 300m',
  combo2: '남자 계영 200m',
  combo3: '여자 계영 200m',
  combo4: '남자 혼계영 200m',
  combo5: '여자 혼계영 200m'
};

const DEFAULT_PINNED_RELAYS = {
  A: {
    combo1: ['이지훈', '서충근', '박재홍', '이지호', '전경미', '박선화'],
    combo2: ['박슬우', '안상준', '김기용', '박봉권'],
    combo3: ['이영경', '손혜정', '이미영', '박선화'],
    combo4: { back: '조성찬', breast: '이경열', fly: '박재홍', free: '안상준' },
    combo5: { back: '전경미', breast: '이지호', fly: '이미영', free: '손혜정' }
  },
  B: {
    combo1: ['이채율', '정서현', '권순용', '김애란', '이은희', '김상희'],
    combo2: ['이채율', '정서현', '양승진', '권순용'],
    combo3: ['이은희', '김애란', '김상희', '심민경'],
    combo4: { back: '이채율', breast: '권순용', fly: '정서현', free: '양승진' },
    combo5: { back: '심민경', breast: '이은희', fly: '김애란', free: '김상희' }
  }
};

let pinnedRelaysState = JSON.parse(JSON.stringify(DEFAULT_PINNED_RELAYS));

function loadPinnedRelays() {
  try {
    const saved = localStorage.getItem(PINNED_RELAYS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.A && parsed.B) {
        pinnedRelaysState = {
          A: { ...DEFAULT_PINNED_RELAYS.A, ...parsed.A },
          B: { ...DEFAULT_PINNED_RELAYS.B, ...parsed.B }
        };
        ['combo1', 'combo2', 'combo3'].forEach(key => {
          if (!pinnedRelaysState.B[key] || pinnedRelaysState.B[key].length === 0) {
            pinnedRelaysState.B[key] = [...DEFAULT_PINNED_RELAYS.B[key]];
          }
        });
        ['combo4', 'combo5'].forEach(key => {
          if (!pinnedRelaysState.B[key] || Object.values(pinnedRelaysState.B[key]).filter(Boolean).length === 0) {
            pinnedRelaysState.B[key] = { ...DEFAULT_PINNED_RELAYS.B[key] };
          }
        });
        return;
      }
    }
  } catch (e) {
    console.warn("Failed to load pinned relays:", e);
  }
  pinnedRelaysState = JSON.parse(JSON.stringify(DEFAULT_PINNED_RELAYS));
}

function savePinnedRelays() {
  try {
    localStorage.setItem(PINNED_RELAYS_STORAGE_KEY, JSON.stringify(pinnedRelaysState));
    if (db && DOC_REF && !isScenarioMode) {
      setDoc(DOC_REF, {
        pinnedRelays: pinnedRelaysState,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => console.warn('Firestore pinnedRelays 저장 실패:', err));
    }
  } catch (e) {
    console.warn("Failed to save pinned relays:", e);
  }
}

function getSwimmerRelayAssignments(swimmerName) {
  if (!swimmerName) return [];
  const assignments = [];
  ['A', 'B'].forEach(team => {
    const teamPins = pinnedRelaysState[team];
    if (!teamPins) return;
    
    // Combo 1: 혼성 핀계영
    if (Array.isArray(teamPins.combo1) && teamPins.combo1.includes(swimmerName)) {
      assignments.push({ team, key: 'combo1', label: '혼성핀', strokeName: '핀자유' });
    }
    // Combo 2: 남계영
    if (Array.isArray(teamPins.combo2) && teamPins.combo2.includes(swimmerName)) {
      assignments.push({ team, key: 'combo2', label: '남계영', strokeName: '자유형' });
    }
    // Combo 3: 여계영
    if (Array.isArray(teamPins.combo3) && teamPins.combo3.includes(swimmerName)) {
      assignments.push({ team, key: 'combo3', label: '여계영', strokeName: '자유형' });
    }
    // Combo 4: 남혼계
    if (teamPins.combo4 && typeof teamPins.combo4 === 'object') {
      for (const [st, name] of Object.entries(teamPins.combo4)) {
        if (name === swimmerName) {
          const stName = STROKE_NAMES[st] || st;
          assignments.push({ team, key: 'combo4', label: `남혼계(${stName.slice(0, 1)})`, strokeName: stName });
        }
      }
    }
    // Combo 5: 여혼계
    if (teamPins.combo5 && typeof teamPins.combo5 === 'object') {
      for (const [st, name] of Object.entries(teamPins.combo5)) {
        if (name === swimmerName) {
          const stName = STROKE_NAMES[st] || st;
          assignments.push({ team, key: 'combo5', label: `여혼계(${stName.slice(0, 1)})`, strokeName: stName });
        }
      }
    }
  });
  return assignments;
}

function toggleMemberPin(comboKey, team, swimmerName, strokeField = null) {
  if (!pinnedRelaysState[team]) pinnedRelaysState[team] = {};
  const relayTitle = RELAY_TITLES[comboKey] || comboKey;

  if (comboKey === 'combo4' || comboKey === 'combo5') {
    if (!pinnedRelaysState[team][comboKey]) {
      pinnedRelaysState[team][comboKey] = { back: null, breast: null, fly: null, free: null };
    }
    const current = pinnedRelaysState[team][comboKey][strokeField];
    const isCurrentlyPinned = current === swimmerName;
    const stName = STROKE_NAMES[strokeField] || strokeField;

    if (isCurrentlyPinned) {
      pinnedRelaysState[team][comboKey][strokeField] = null;
      showToast(`⚡ [${relayTitle}] ${swimmerName} (${stName}) 선수 고정이 해제되었습니다.`);
      logChangeHistory('PIN', swimmerName, `relay_pin_${team}_${comboKey}_${strokeField}`, `단체전 선발 [${team}팀 ${relayTitle} - ${stName}]`, `${stName} 고정`, '미고정 (자동추천)', `[${team}팀 ${relayTitle}] ${swimmerName} (${stName}) 고정 해제`, { team, comboKey, strokeField });
    } else {
      pinnedRelaysState[team][comboKey][strokeField] = swimmerName;
      showToast(`📌 [${relayTitle}] ${swimmerName} (${stName}) 선수가 필수로 고정되었습니다.`);
      logChangeHistory('PIN', swimmerName, `relay_pin_${team}_${comboKey}_${strokeField}`, `단체전 선발 [${team}팀 ${relayTitle} - ${stName}]`, '미고정 (자동추천)', `${stName} 고정`, `[${team}팀 ${relayTitle}] ${swimmerName} (${stName}) 선발 고정`, { team, comboKey, strokeField });
    }
  } else {
    if (!Array.isArray(pinnedRelaysState[team][comboKey])) {
      pinnedRelaysState[team][comboKey] = [];
    }
    const list = pinnedRelaysState[team][comboKey];
    const idx = list.indexOf(swimmerName);
    if (idx >= 0) {
      list.splice(idx, 1);
      showToast(`⚡ [${relayTitle}] ${swimmerName} 선수 고정이 해제되었습니다.`);
      logChangeHistory('PIN', swimmerName, `relay_pin_${team}_${comboKey}`, `단체전 선발 [${team}팀 ${relayTitle}]`, '선발 고정됨', '미고정 (자동추천)', `[${team}팀 ${relayTitle}] ${swimmerName} 고정 해제`, { team, comboKey });
    } else {
      list.push(swimmerName);
      const totalReq = comboKey === 'combo1' ? 6 : 4;
      const remaining = Math.max(0, totalReq - list.length);
      showToast(`📌 [${relayTitle}] ${swimmerName} 선수가 필수로 고정되었습니다. (나머지 ${remaining}명 자동 최적화)`);
      logChangeHistory('PIN', swimmerName, `relay_pin_${team}_${comboKey}`, `단체전 선발 [${team}팀 ${relayTitle}]`, '미고정 (자동추천)', '선발 고정됨', `[${team}팀 ${relayTitle}] ${swimmerName} 선발 고정`, { team, comboKey });
    }
  }

  savePinnedRelays();
  updateStats();
  renderTable();
  renderEventsTable();
}

function toggleTeamRelayAllPins(comboKey, team) {
  if (!pinnedRelaysState[team]) pinnedRelaysState[team] = {};
  const relayTitle = RELAY_TITLES[comboKey] || comboKey;
  const currentCombos = calculateRelayCombinations(team);
  const result = currentCombos[comboKey];

  if (!result || !result.members) return;

  const isMedley = comboKey === 'combo4' || comboKey === 'combo5';
  let hasAnyPinned = false;

  if (isMedley) {
    const pins = pinnedRelaysState[team][comboKey] || {};
    hasAnyPinned = Object.values(pins).some(Boolean);
  } else {
    const pins = pinnedRelaysState[team][comboKey] || [];
    hasAnyPinned = pins.length > 0;
  }

  if (hasAnyPinned) {
    // Unpin all
    if (isMedley) {
      const prevPins = { ...pinnedRelaysState[team][comboKey] };
      pinnedRelaysState[team][comboKey] = { back: null, breast: null, fly: null, free: null };
      Object.entries(prevPins).forEach(([st, name]) => {
        if (name) {
          const stName = STROKE_NAMES[st] || st;
          logChangeHistory('PIN', name, `relay_pin_${team}_${comboKey}_${st}`, `단체전 선발 [${team}팀 ${relayTitle} - ${stName}]`, `${stName} 고정`, '미고정 (자동추천)', `[${team}팀 ${relayTitle}] ${name} (${stName}) 고정 해제`, { team, comboKey, strokeField: st });
        }
      });
    } else {
      const prevList = [...(pinnedRelaysState[team][comboKey] || [])];
      pinnedRelaysState[team][comboKey] = [];
      prevList.forEach(name => {
        logChangeHistory('PIN', name, `relay_pin_${team}_${comboKey}`, `단체전 선발 [${team}팀 ${relayTitle}]`, '선발 고정됨', '미고정 (자동추천)', `[${team}팀 ${relayTitle}] ${name} 고정 해제`, { team, comboKey });
      });
    }
    showToast(`⚡ ${team}팀 [${relayTitle}] 모든 선수 고정이 해제되어 실시간 자동 추천 모드로 전환되었습니다.`);
  } else {
    // Pin all current members
    if (isMedley) {
      pinnedRelaysState[team][comboKey] = {};
      result.members.forEach(m => {
        if (m.strokeField) {
          pinnedRelaysState[team][comboKey][m.strokeField] = m.name;
          const stName = STROKE_NAMES[m.strokeField] || m.strokeField;
          logChangeHistory('PIN', m.name, `relay_pin_${team}_${comboKey}_${m.strokeField}`, `단체전 선발 [${team}팀 ${relayTitle} - ${stName}]`, '미고정 (자동추천)', `${stName} 고정`, `[${team}팀 ${relayTitle}] ${m.name} (${stName}) 선발 고정`, { team, comboKey, strokeField: m.strokeField });
        }
      });
    } else {
      pinnedRelaysState[team][comboKey] = result.members.map(m => m.name);
      result.members.forEach(m => {
        logChangeHistory('PIN', m.name, `relay_pin_${team}_${comboKey}`, `단체전 선발 [${team}팀 ${relayTitle}]`, '미고정 (자동추천)', '선발 고정됨', `[${team}팀 ${relayTitle}] ${m.name} 선발 고정`, { team, comboKey });
      });
    }
    showToast(`📌 ${team}팀 [${relayTitle}] 현재 선발 ${result.members.length}명이 모두 고정되었습니다.`);
  }

  savePinnedRelays();
  updateStats();
  renderTable();
  renderEventsTable();
}

// Header Toggle Buttons & View Containers
const btnToggleRecords = document.getElementById('btnToggleRecords');
const btnToggleEvents = document.getElementById('btnToggleEvents');
const viewRecords = document.getElementById('viewRecords');
const viewEvents = document.getElementById('viewEvents');

// Records View DOM
const tableBody = document.getElementById('tableBody');
const recordTable = document.getElementById('recordTable');
const filterGenderSelect = document.getElementById('filterGenderSelect');
const filterTeamSelect = document.getElementById('filterTeamSelect');
const filterGroupSelect = document.getElementById('filterGroupSelect');
const recordsModeSelect = document.getElementById('recordsModeSelect');
const chkScenarioMode = document.getElementById('chkScenarioMode');
const searchInput = document.getElementById('searchInput');
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

const eventsGenderSelect = document.getElementById('eventsGenderSelect');
const eventsTeamSelect = document.getElementById('eventsTeamSelect');
const eventsGroupSelect = document.getElementById('eventsGroupSelect');
const eventsModeSelect = document.getElementById('eventsModeSelect');
const eventsDetailTable = document.getElementById('eventsDetailTable');
const eventsSearchInput = document.getElementById('eventsSearchInput');
const eventsTableBody = document.getElementById('eventsTableBody');
const eventsFilteredCount = document.getElementById('eventsFilteredCount');

// Init application
function init() {
  window.__GMDC_VERSION__ = APP_VERSION;
  console.log(`%c[GMDC Swim] App Version: ${APP_VERSION}`, 'color: #0284c7; font-weight: bold; font-size: 12px;');
  initAuth({
    showToast: showToast,
    onAuthChange: () => {
      renderTable();
      renderEventsTable();
    }
  });
  loadPinnedRelays();
  initStickyPreference();
  initNoticeModal();
  initAuditModal();
  initSnapshotModal();
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

function initDeadlineCountdown() {
  updateDeadlineCountdown();
  setInterval(updateDeadlineCountdown, 1000);
}

function updateDeadlineCountdown() {
  const badge = document.getElementById('tableDateBadge');
  if (!badge) return;

  badge.className = 'header-date';
  badge.innerHTML = `기준일: 2026-01-01`;
  badge.title = '기준일: 2026-01-01';
}

function initScenarioMode() {
  const chk = document.getElementById('chkScenarioMode');
  if (chk) {
    chk.checked = isScenarioMode;
    chk.addEventListener('change', handleScenarioToggle);
  }
}

function handleScenarioToggle(e) {
  const chk = e.target;
  if (chk.checked) {
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
    } else {
      chk.checked = true; // 취소 시 체크박스 ON 상태 유지
    }
  }
}

function updateScenarioModeUI(isOn) {
  const chk = document.getElementById('chkScenarioMode');
  if (chk) chk.checked = isOn;

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
// (최후 스냅샷으로부터 히스토리를 시간순 재현하여 현재 DB와 정합성 검증)
// ============================================================
let lastAuditDiscrepancies = [];

function initAuditModal() {
  const btnAudit = document.getElementById('btnAuditHistory');
  const modal = document.getElementById('auditModal');
  const btnCloseX = document.getElementById('btnAuditModalCloseX');
  const btnConfirm = document.getElementById('btnAuditModalConfirm');
  const body = document.getElementById('auditModalBody');

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

  if (body) {
    body.addEventListener('click', async (e) => {
      // 1. Delete specific history log
      const delBtn = e.target.closest('.btn-delete-log');
      if (delBtn) {
        const logId = delBtn.dataset.logId;
        const logSummary = delBtn.dataset.logSummary || '';
        await deleteHistoryLog(logId, logSummary);
        return;
      }

      // 1-1. Unapply specific history log
      const unapplyBtn = e.target.closest('.btn-unapply-log');
      if (unapplyBtn) {
        const logId = unapplyBtn.dataset.logId;
        const logSummary = unapplyBtn.dataset.logSummary || '';
        await unapplyHistoryLog(logId, logSummary);
        return;
      }

      // 1-2. Reactivate specific unapplied log
      const reactBtn = e.target.closest('.btn-reactivate-log');
      if (reactBtn) {
        const logId = reactBtn.dataset.logId;
        const logSummary = reactBtn.dataset.logSummary || '';
        await reactivateHistoryLog(logId, logSummary);
        return;
      }

      // 1-3. Unapply all recent logs button
      const unapplyAllBtn = e.target.closest('#btnUnapplyAllRecentLogs');
      if (unapplyAllBtn) {
        await unapplyAllRecentLogs(window._lastRecentLogs || []);
        return;
      }

      // 1-4. History Tab Switching
      const tabBtn = e.target.closest('.audit-tab-btn');
      if (tabBtn) {
        const tabName = tabBtn.dataset.tab;
        body.querySelectorAll('.audit-tab-btn').forEach(b => b.classList.toggle('active', b === tabBtn));
        const paneActive = body.querySelector('#auditTabPaneActive');
        const paneUnapplied = body.querySelector('#auditTabPaneUnapplied');
        if (paneActive && paneUnapplied) {
          paneActive.style.display = tabName === 'active' ? 'block' : 'none';
          paneUnapplied.style.display = tabName === 'unapplied' ? 'block' : 'none';
        }
        return;
      }

      // 2. Bulk select all current
      const btnAllCurrent = e.target.closest('#btnSelectAllCurrent');
      if (btnAllCurrent) {
        body.querySelectorAll('.discrepancy-choice-group').forEach(group => {
          const radioCurrent = group.querySelector('input[value="current"]');
          if (radioCurrent) radioCurrent.checked = true;
          group.querySelectorAll('.choice-label').forEach(lbl => {
            lbl.classList.toggle('is-selected-current', lbl.dataset.choice === 'current');
            lbl.classList.toggle('is-selected-history', lbl.dataset.choice === 'history' && !radioCurrent.checked);
          });
        });
        return;
      }

      // 3. Bulk select all history
      const btnAllHistory = e.target.closest('#btnSelectAllHistory');
      if (btnAllHistory) {
        body.querySelectorAll('.discrepancy-choice-group').forEach(group => {
          const radioHistory = group.querySelector('input[value="history"]');
          if (radioHistory) radioHistory.checked = true;
          group.querySelectorAll('.choice-label').forEach(lbl => {
            lbl.classList.toggle('is-selected-history', lbl.dataset.choice === 'history');
            lbl.classList.toggle('is-selected-current', lbl.dataset.choice === 'current' && !radioHistory.checked);
          });
        });
        return;
      }

      // 4. Apply selected decisions
      const btnApply = e.target.closest('#btnApplyDiscrepancyDecisions');
      if (btnApply) {
        const decisions = lastAuditDiscrepancies.map((d, idx) => {
          const radio = body.querySelector(`input[name="disc_choice_${idx}"]:checked`);
          const action = radio ? radio.value : 'current';
          return { discrepancy: d, action };
        });
        await applyDiscrepancyDecisions(decisions);
        return;
      }
    });

    body.addEventListener('change', (e) => {
      const radio = e.target.closest('input[type="radio"]');
      if (radio && radio.name && radio.name.startsWith('disc_choice_')) {
        const group = radio.closest('.discrepancy-choice-group');
        if (group) {
          group.querySelectorAll('.choice-label').forEach(lbl => {
            const isCurr = radio.value === 'current' && lbl.dataset.choice === 'current';
            const isHist = radio.value === 'history' && lbl.dataset.choice === 'history';
            lbl.classList.toggle('is-selected-current', isCurr);
            lbl.classList.toggle('is-selected-history', isHist);
          });
        }
      }
    });
  }

  window.compareHistoryWithCurrentRecords = compareHistoryWithCurrentRecords;
  window.openAuditModal = openAuditModal;
}

async function deleteHistoryLog(logId, logSummary) {
  if (!logId) return;
  const ok = confirm(`해당 히스토리 로그 [${logSummary}] 를 완전히 영구 삭제하시겠습니까?\n\n※ 삭제된 히스토리는 서버 DB에서도 완전히 제거됩니다.`);
  if (!ok) return;

  try {
    await deleteDoc(doc(db, HISTORY_COL_NAME, logId));
    showToast(`🗑️ 히스토리 로그가 영구 삭제되었습니다.`);
    openAuditModal(); // Refresh audit modal
  } catch (err) {
    console.error('히스토리 삭제 실패:', err);
    showToast(`⚠️ 히스토리 삭제 실패: ${err.message || err}`);
  }
}

async function unapplyHistoryLog(logId, logSummary) {
  if (!logId) return;
  const ok = confirm(`해당 히스토리 로그 [${logSummary}] 를 [미적용] 상태로 전환하시겠습니까?\n\n※ 서버에는 영구 보존되며, 정합성 검증 및 재현 계산에서만 제외됩니다.`);
  if (!ok) return;

  try {
    await updateDoc(doc(db, HISTORY_COL_NAME, logId), {
      isApplied: false,
      unappliedAt: new Date().toISOString(),
      unapplyReason: '사용자 개별 미적용 처리'
    });
    showToast(`⏸️ 히스토리 로그가 [미적용] 보존 상태로 전환되었습니다.`);
    openAuditModal();
  } catch (err) {
    console.error('히스토리 미적용 실패:', err);
    showToast(`⚠️ 처리 실패: ${err.message || err}`);
  }
}

async function reactivateHistoryLog(logId, logSummary) {
  if (!logId) return;
  const ok = confirm(`해당 히스토리 로그 [${logSummary}] 를 다시 [적용] 상태로 활성화하시겠습니까?`);
  if (!ok) return;

  try {
    await updateDoc(doc(db, HISTORY_COL_NAME, logId), {
      isApplied: true,
      reactivatedAt: new Date().toISOString()
    });
    showToast(`▶️ 히스토리 로그가 다시 [적용] 상태로 활성화되었습니다.`);
    openAuditModal();
  } catch (err) {
    console.error('히스토리 재활성화 실패:', err);
    showToast(`⚠️ 처리 실패: ${err.message || err}`);
  }
}

async function unapplyAllRecentLogs(activeLogs) {
  if (!activeLogs || activeLogs.length === 0) return;
  const ok = confirm(`최후 스냅샷 이후의 모든 활성 히스토리 (${activeLogs.length}건)를 [미적용] 상태로 일괄 전환하시겠습니까?\n\n※ 서버에는 영구 보존되며, 정합성 검증 일치율은 즉시 100%가 됩니다.`);
  if (!ok) return;

  try {
    const nowIso = new Date().toISOString();
    for (const log of activeLogs) {
      if (log.id) {
        await updateDoc(doc(db, HISTORY_COL_NAME, log.id), {
          isApplied: false,
          unappliedAt: nowIso,
          unapplyReason: '스냅샷 기준 일괄 미적용 정리'
        });
      }
    }
    showToast(`🎉 ${activeLogs.length}건의 히스토리가 [미적용]으로 안전하게 보존 정리되었습니다!`);
    openAuditModal();
  } catch (err) {
    console.error('일괄 미적용 실패:', err);
    showToast(`⚠️ 처리 실패: ${err.message || err}`);
  }
}

async function applyDiscrepancyDecisions(decisions) {
  if (!decisions || decisions.length === 0) return;

  const applyCurrentCount = decisions.filter(d => d.action === 'current').length;
  const applyHistoryCount = decisions.filter(d => d.action === 'history').length;

  const ok = confirm(
    `총 ${decisions.length}건의 불일치 항목에 대해 선택하신 결정을 적용하시겠습니까?\n\n` +
    `• 📝 현재값 적용 (히스토리 보정 등록): ${applyCurrentCount}건\n` +
    `• ↩️ 히스토리값으로 원상복구 (실시간 DB 롤백): ${applyHistoryCount}건\n\n` +
    `적용 후 스냅샷+히스토리 재현 결과와 현재 DB 정합성은 100% 완벽 일치하게 됩니다.`
  );
  if (!ok) return;

  try {
    const histCol = collection(db, HISTORY_COL_NAME);
    const nowIso = new Date().toISOString();
    let dbModified = false;

    for (const item of decisions) {
      const d = item.discrepancy;
      const action = item.action;

      if (d.isPinDiscrepancy) {
        if (action === 'current') {
          // Save PIN log matching current live state
          const logData = {
            timestamp: nowIso,
            type: 'PIN',
            swimmer: d.name,
            swimmerName: d.name,
            team: d.team,
            comboKey: d.comboKey,
            strokeField: d.strokeField || null,
            field: `relay_pin_${d.team}_${d.comboKey}${d.strokeField ? `_${d.strokeField}` : ''}`,
            fieldName: d.fieldName,
            label: `${d.fieldName} (정합성 보정)`,
            prevVal: d.replayedVal,
            newVal: d.currentVal
          };
          await addDoc(histCol, logData);
        } else if (action === 'history') {
          // Revert pinnedRelaysState to replayed value
          dbModified = true;
          const isMedley = d.comboKey === 'combo4' || d.comboKey === 'combo5';
          if (!pinnedRelaysState[d.team]) pinnedRelaysState[d.team] = {};

          if (isMedley && d.strokeField) {
            if (!pinnedRelaysState[d.team][d.comboKey]) pinnedRelaysState[d.team][d.comboKey] = {};
            pinnedRelaysState[d.team][d.comboKey][d.strokeField] = d.repName || null;
          } else if (!isMedley) {
            if (!Array.isArray(pinnedRelaysState[d.team][d.comboKey])) pinnedRelaysState[d.team][d.comboKey] = [];
            const list = pinnedRelaysState[d.team][d.comboKey];
            if (d.replayedVal === '선발 고정됨') {
              if (!list.includes(d.name)) list.push(d.name);
            } else {
              const idx = list.indexOf(d.name);
              if (idx >= 0) list.splice(idx, 1);
            }
          }
          savePinnedRelays();
        }
        continue;
      }

      if (action === 'current') {
        // Option 1: Apply current live DB value -> Add history log
        let logData;
        if (d.field === 'member') {
          logData = {
            timestamp: nowIso,
            type: 'MEMBER',
            swimmer: d.name,
            field: 'member',
            label: '신규 회원 등록 (정합성 보정)',
            prevVal: '',
            newVal: d.currentVal
          };
        } else if (d.field === 'member_deleted') {
          logData = {
            timestamp: nowIso,
            type: 'DELETE',
            swimmer: d.name,
            field: 'member',
            label: '회원 삭제 (정합성 보정)',
            prevVal: d.replayedVal,
            newVal: '삭제됨'
          };
        } else {
          logData = {
            timestamp: nowIso,
            type: 'INFO',
            swimmer: d.name,
            field: d.field,
            label: `${d.fieldName} (정합성 보정)`,
            prevVal: d.replayedVal === '(빈값)' ? '' : d.replayedVal,
            newVal: d.currentVal === '(빈값)' ? '' : d.currentVal
          };
        }
        await addDoc(histCol, logData);
      } else if (action === 'history') {
        // Option 2: Revert DB value back to history replayed value
        dbModified = true;
        if (d.field === 'member') {
          // Member didn't exist in history -> delete from live DB
          records = records.filter(r => r.name !== d.name && r.id !== d.id);
        } else if (d.field === 'member_deleted') {
          // Member existed in history -> restore to live DB
          if (d.recordObj) {
            records.push(JSON.parse(JSON.stringify(d.recordObj)));
          }
        } else {
          const rec = records.find(r => r.name === d.name || r.id === d.id);
          if (rec) {
            rec[d.field] = (d.replayedVal === '(빈값)' || d.replayedVal === '(미존재)') ? '' : d.replayedVal;
          }
        }
      }
    }

    if (dbModified) {
      saveData();
      renderAll();
    }

    showToast(`🎉 총 ${decisions.length}건의 정합성 결정이 적용되어 100% 일치되었습니다!`);
    openAuditModal(); // Refresh audit modal
  } catch (err) {
    console.error('정합성 결정 적용 실패:', err);
    showToast(`⚠️ 적용 실패: ${err.message || err}`);
  }
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
      <div style="font-size:14px; font-weight:700; color:var(--text-main);">최후 스냅샷 및 히스토리 로그 분석 중...</div>
      <div style="font-size:12px; margin-top:5px;">클라우드 최후 스냅샷 이후의 변경 이력을 시간순으로 재현 및 검증하고 있습니다.</div>
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

    lastAuditDiscrepancies = result.discrepancies || [];
    window._lastReplayedRecords = result.replayedRecords;
    window._lastRecentLogs = result.recentLogs || [];

    let matchSectionHtml = '';
    if (result.isPerfectMatch) {
      matchSectionHtml = `
        <div style="background:#ecfdf5; border:1px solid #6ee7b7; border-radius:10px; padding:16px; margin-bottom:14px;">
          <div style="display:flex; align-items:center; gap:8px; color:#065f46; font-weight:800; font-size:15px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>스냅샷 및 이후 히스토리가 현재 DB와 100% 완벽히 일치합니다!</span>
          </div>
          <p style="margin-top:6px; font-size:12.5px; color:#047857; line-height:1.45;">
            최후 스냅샷으로부터 적용 중인 총 <strong>${result.recentLogs.length}건</strong>의 변경 히스토리를 순차 적용한 결과, 현재 실시간 DB와 오차 없이 100% 완벽하게 일치함을 검증하였습니다.
            ${result.unappliedLogs.length > 0 ? ` (※ 미적용 보존 히스토리: <strong>${result.unappliedLogs.length}건</strong>)` : ''}
          </p>
        </div>
      `;
    } else {
      matchSectionHtml = `
        <div class="discrepancy-box">
          <div class="discrepancy-header">
            <div style="display:flex; align-items:center; gap:8px; color:#92400e; font-weight:800; font-size:15px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <span>총 ${result.discrepancyCount}건의 내용 불일치 항목 (일치율: ${result.matchRate})</span>
            </div>
            <div class="bulk-select-group">
              <span style="font-size:11.5px; color:var(--text-muted); font-weight:600;">일괄 선택:</span>
              <button type="button" class="btn-bulk-select" id="btnSelectAllHistory">모두 미적용</button>
              <button type="button" class="btn-bulk-select" id="btnSelectAllCurrent">모두 반영</button>
            </div>
          </div>
          <p style="font-size:12px; color:#b45309; margin-bottom:12px;">
            각 항목별로 <strong>[미적용 (과거 히스토리값으로 DB 원상복구)]</strong> 또는 <strong>[반영 (현재 DB 내용 적용 및 히스토리 보정)]</strong>을 선택한 후 하단의 적용 버튼을 누르시면 다음에 검증할 때 100% 일치하게 됩니다.
          </p>

          <div style="max-height: 260px; overflow-y: auto; border-radius: 8px;">
            <table class="discrepancy-table">
              <thead>
                <tr>
                  <th style="width:75px;">선수명</th>
                  <th style="width:95px;">항목</th>
                  <th style="width:100px;">변경시기</th>
                  <th>과거</th>
                  <th>현재</th>
                  <th style="width:160px; text-align:center;">선택</th>
                </tr>
              </thead>
              <tbody>
                ${result.discrepancies.map((d, idx) => `
                  <tr>
                    <td style="font-weight:700;">${escapeHtml(d.name)}</td>
                    <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;">${escapeHtml(d.fieldName || d.field)}</span></td>
                    <td style="color:var(--text-muted); font-size:11.5px; white-space:nowrap;">${escapeHtml(d.changeTime || '-')}</td>
                    <td style="color:#2563eb; font-weight:700;">${escapeHtml(d.replayedVal)}</td>
                    <td style="color:#dc2626; font-weight:700;">${escapeHtml(d.currentVal)}</td>
                    <td>
                      <div class="discrepancy-choice-group" data-disc-idx="${idx}">
                        <label class="choice-label" data-choice="history" title="과거 히스토리값으로 DB를 원상복구합니다 (미적용)">
                          <input type="radio" name="disc_choice_${idx}" value="history" />
                          <span>미적용</span>
                        </label>
                        <label class="choice-label is-selected-current" data-choice="current" title="현재 DB값을 유지하고 히스토리에 반영합니다">
                          <input type="radio" name="disc_choice_${idx}" value="current" checked />
                          <span>반영</span>
                        </label>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="discrepancy-footer-actions">
            <div style="font-size:12px; color:#6b7280;">
              💡 결정 적용 시 Firestore 히스토리 및 실시간 DB가 즉시 상호 동기화됩니다.
            </div>
            <button type="button" id="btnApplyDiscrepancyDecisions" class="btn-apply-disc-decisions">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>선택한 결정 적용 (100% 정합성 완료)</span>
            </button>
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <!-- 1. Latest Snapshot Header Card -->
      <div class="audit-snapshot-header">
        <div class="snap-title">
          <span>📷 최후 기준 스냅샷: <strong>${escapeHtml(result.baseTitle)}</strong></span>
          <span style="font-size:11px; background:#f1f5f9; padding:2px 8px; border-radius:12px; color:#475569; font-weight:600;">${result.baseRecordsCount}명 기준</span>
        </div>
        <div class="snap-meta">
          <span>기준 시각: <strong>${escapeHtml(result.baseTimeFormatted)}</strong></span>
          <span>적용 히스토리: <strong>${result.recentLogs.length}건</strong></span>
          <span>미적용 보존: <strong>${result.unappliedLogs.length}건</strong></span>
          <span>검증 필드수: <strong>${result.totalFieldChecks}개</strong></span>
        </div>
      </div>

      <!-- 2. Match Summary & Discrepancies (with Per-Item Decision Controls) -->
      ${matchSectionHtml}

      <!-- 3. Chronological History Logs Box with Tabs & Unapply / Reactivate Controls -->
      <div class="audit-history-box">
        <div class="audit-history-header">
          <div style="display:flex; align-items:center; gap:6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>스냅샷 이후 히스토리 (총 ${result.totalRecentCount}건)</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${result.recentLogs.length > 0 ? `
              <button type="button" class="btn-bulk-select" id="btnUnapplyAllRecentLogs" title="스냅샷 이후 활성 히스토리를 모두 [미적용]으로 정리하고 100% 일치시킵니다">
                ⏸️ 활성 히스토리 일괄 미적용
              </button>
            ` : ''}
          </div>
        </div>

        <div class="audit-history-tabs">
          <button type="button" class="audit-tab-btn active" data-tab="active">
            <span>적용 중인 히스토리 (${result.recentLogs.length}건)</span>
          </button>
          <button type="button" class="audit-tab-btn" data-tab="unapplied">
            <span>미적용 보존 히스토리 (${result.unappliedLogs.length}건)</span>
          </button>
        </div>

        <!-- Active Tab Pane -->
        <div id="auditTabPaneActive" class="audit-tab-pane">
          ${result.recentLogs.length === 0 ? `
            <div style="padding:24px; text-align:center; color:var(--text-muted); font-size:12.5px;">
              스냅샷 생성 시점 이후 활성화된 변경 히스토리가 없습니다.
            </div>
          ` : `
            <div style="max-height: 220px; overflow-y: auto;">
              <table class="audit-history-table">
                <thead>
                  <tr>
                    <th style="width:110px;">기록 시각</th>
                    <th style="width:80px;">선수명</th>
                    <th style="width:110px;">변경 항목</th>
                    <th>변경 내용 (이전 ➔ 이후)</th>
                    <th style="width:110px; text-align:center;">관리</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.recentLogs.map(log => {
                    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '-';
                    const swimmer = log.swimmer || log.swimmerName || '-';
                    const label = log.label || log.field || '-';
                    const changeStr = `${log.prevVal ? escapeHtml(log.prevVal) : '(빈값)'} ➔ <strong style="color:var(--primary);">${log.newVal ? escapeHtml(log.newVal) : '(빈값)'}</strong>`;
                    return `
                      <tr>
                        <td style="color:var(--text-muted); font-size:11.5px;">${timeStr}</td>
                        <td style="font-weight:700;">${escapeHtml(swimmer)}</td>
                        <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;">${escapeHtml(label)}</span></td>
                        <td>${changeStr}</td>
                        <td style="text-align:center;">
                          <div style="display:inline-flex; gap:4px;">
                            <button type="button" class="btn-unapply-log" data-log-id="${log.id}" data-log-summary="${escapeHtml(swimmer)} - ${escapeHtml(label)}" title="이 히스토리를 미적용 상태로 전환 (서버에는 보존됨)">
                              <span>⏸️ 미적용</span>
                            </button>
                            <button type="button" class="btn-delete-log" data-log-id="${log.id}" data-log-summary="${escapeHtml(swimmer)} - ${escapeHtml(label)}" title="이 히스토리 영구 삭제">
                              <span>🗑️</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Unapplied Tab Pane -->
        <div id="auditTabPaneUnapplied" class="audit-tab-pane" style="display:none;">
          ${result.unappliedLogs.length === 0 ? `
            <div style="padding:24px; text-align:center; color:var(--text-muted); font-size:12.5px;">
              미적용으로 보존된 히스토리가 없습니다.
            </div>
          ` : `
            <div style="max-height: 220px; overflow-y: auto;">
              <table class="audit-history-table">
                <thead>
                  <tr>
                    <th style="width:110px;">기록 시각</th>
                    <th style="width:80px;">선수명</th>
                    <th style="width:110px;">변경 항목</th>
                    <th>변경 내용</th>
                    <th style="width:140px;">상태 / 사유</th>
                    <th style="width:110px; text-align:center;">관리</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.unappliedLogs.map(log => {
                    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '-';
                    const swimmer = log.swimmer || log.swimmerName || '-';
                    const label = log.label || log.field || '-';
                    const changeStr = `<span style="text-decoration:line-through; color:var(--text-muted);">${log.prevVal ? escapeHtml(log.prevVal) : '(빈값)'} ➔ ${log.newVal ? escapeHtml(log.newVal) : '(빈값)'}</span>`;
                    const reason = log.unapplyReason || '미적용 처리됨';
                    return `
                      <tr style="opacity: 0.85;">
                        <td style="color:var(--text-muted); font-size:11.5px;">${timeStr}</td>
                        <td style="font-weight:700; color:var(--text-muted);">${escapeHtml(swimmer)}</td>
                        <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600; color:var(--text-muted);">${escapeHtml(label)}</span></td>
                        <td>${changeStr}</td>
                        <td><span class="badge-unapplied" title="${escapeHtml(reason)}">⏸️ ${escapeHtml(reason)}</span></td>
                        <td style="text-align:center;">
                          <div style="display:inline-flex; gap:4px;">
                            <button type="button" class="btn-reactivate-log" data-log-id="${log.id}" data-log-summary="${escapeHtml(swimmer)} - ${escapeHtml(label)}" title="이 히스토리를 다시 적용 활성화">
                              <span>▶️ 다시 적용</span>
                            </button>
                            <button type="button" class="btn-delete-log" data-log-id="${log.id}" data-log-summary="${escapeHtml(swimmer)} - ${escapeHtml(label)}" title="이 히스토리 영구 삭제">
                              <span>🗑️</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  }, 100);
}

function closeAuditModal() {
  const modal = document.getElementById('auditModal');
  if (modal) modal.classList.remove('show');
}

// ============================================================
// FIRESTORE DB SNAPSHOT & VERSION RESTORE ENGINE
// ============================================================
function initSnapshotModal() {
  const btnOpen = document.getElementById('btnOpenSnapshotModal');
  const modal = document.getElementById('snapshotModal');
  const btnCloseX = document.getElementById('btnSnapshotModalCloseX');
  const btnCloseFooter = document.getElementById('btnSnapshotModalClose');
  const btnCreate = document.getElementById('btnCreateSnapshot');
  const btnRefresh = document.getElementById('btnRefreshSnapshots');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      openSnapshotModal();
    });
  }

  if (btnCloseX) btnCloseX.addEventListener('click', closeSnapshotModal);
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeSnapshotModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSnapshotModal();
    });
  }

  if (btnCreate) {
    btnCreate.addEventListener('click', async () => {
      const inputTitle = document.getElementById('snapshotTitleInput');
      const inputMemo = document.getElementById('snapshotMemoInput');
      const title = inputTitle ? inputTitle.value.trim() : '';
      const memo = inputMemo ? inputMemo.value.trim() : '';
      
      btnCreate.disabled = true;
      btnCreate.innerHTML = '<span>⏳ 저장 중...</span>';
      try {
        await createDbSnapshot(title, memo);
        if (inputTitle) inputTitle.value = '';
        if (inputMemo) inputMemo.value = '';
        await loadSnapshotsList();
      } finally {
        btnCreate.disabled = false;
        btnCreate.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
          <span>스냅샷 저장</span>
        `;
      }
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadSnapshotsList();
    });
  }

  window.openSnapshotModal = openSnapshotModal;
  window.closeSnapshotModal = closeSnapshotModal;
  window.createDbSnapshot = createDbSnapshot;
}

async function openSnapshotModal() {
  const modal = document.getElementById('snapshotModal');
  if (!modal) return;
  modal.classList.add('show');
  
  const inputTitle = document.getElementById('snapshotTitleInput');
  if (inputTitle && !inputTitle.value) {
    const now = new Date();
    const defaultName = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} 스냅샷`;
    inputTitle.placeholder = `예: ${defaultName}`;
  }

  const currentCountBadge = document.getElementById('snapshotCurrentCountBadge');
  if (currentCountBadge) {
    const teamA = records.filter(r => (r.team || 'A') === 'A').length;
    const teamB = records.filter(r => (r.team || 'A') === 'B').length;
    currentCountBadge.textContent = `현재 등록 인원: 총 ${records.length}명 (A팀 ${teamA}명, B팀 ${teamB}명)`;
  }

  await loadSnapshotsList();
}

function closeSnapshotModal() {
  const modal = document.getElementById('snapshotModal');
  if (modal) modal.classList.remove('show');
}

async function createDbSnapshot(customTitle, memo = '') {
  if (!db) {
    showToast('⚠️ Firebase 연결이 필요합니다.');
    return;
  }

  const now = new Date();
  const timeFormatted = now.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const teamACount = records.filter(r => (r.team || 'A') === 'A').length;
  const teamB = records.filter(r => (r.team || 'A') === 'B').length;
  const autoTitle = customTitle || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} 스냅샷`;

  const snapshotData = {
    title: autoTitle,
    memo: memo || '',
    division: 'adult',
    records: JSON.parse(JSON.stringify(records)),
    pinnedRelays: JSON.parse(JSON.stringify(pinnedRelaysState)),
    recordCount: records.length,
    teamACount: teamACount,
    teamBCount: teamB,
    createdAt: now.toISOString(),
    createdAtFormatted: timeFormatted,
    device: navigator.userAgent.includes('Mobile') ? '모바일' : 'PC'
  };

  try {
    const colRef = collection(db, SNAPSHOT_COL_NAME);
    const docRef = await addDoc(colRef, snapshotData);
    showToast(`📸 스냅샷이 성공적으로 저장되었습니다! (${autoTitle})`);
    return docRef.id;
  } catch (err) {
    console.error('스냅샷 저장 실패:', err);
    showToast(`⚠️ 스냅샷 저장 실패: ${err.message || err}`);
    throw err;
  }
}

async function loadSnapshotsList() {
  const listContainer = document.getElementById('snapshotListContainer');
  if (!listContainer) return;

  if (!db) {
    listContainer.innerHTML = `
      <div style="text-align:center; padding:30px; color:#ef4444;">
        ⚠️ Firebase 클라우드에 연결되지 않아 스냅샷 목록을 조회할 수 없습니다.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = `
    <div style="text-align:center; padding:30px; color:var(--text-muted);">
      <div style="font-size:24px; margin-bottom:8px; animation:spin 1s infinite linear;">⏳</div>
      <div>스냅샷 목록 불러오는 중...</div>
    </div>
  `;

  try {
    const colRef = collection(db, SNAPSHOT_COL_NAME);
    const q = query(colRef, orderBy("createdAt", "desc"), limit(50));
    const querySnapshot = await getDocs(q);

    const snapshots = [];
    querySnapshot.forEach(docSnap => {
      snapshots.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (snapshots.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding:36px 20px; color:var(--text-muted); background:var(--bg-page); border-radius:8px; border:1px dashed var(--border-dark);">
          <div style="font-size:28px; margin-bottom:6px;">📷</div>
          <div style="font-weight:700; color:var(--text-main); font-size:14px;">저장된 스냅샷이 없습니다.</div>
          <div style="font-size:12px; margin-top:4px;">위 입력창에서 [스냅샷 저장]을 눌러 첫 스냅샷을 생성해보세요.</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = snapshots.map(s => {
      const recordsArr = Array.isArray(s.records) ? s.records : [];
      const count = s.recordCount || recordsArr.length;
      const countA = s.teamACount !== undefined ? s.teamACount : recordsArr.filter(r => (r.team || 'A') === 'A').length;
      const countB = s.teamBCount !== undefined ? s.teamBCount : recordsArr.filter(r => (r.team || 'A') === 'B').length;
      const timeStr = s.createdAtFormatted || (s.createdAt ? new Date(s.createdAt).toLocaleString('ko-KR') : '');

      return `
        <div class="snapshot-item" data-snapshot-id="${escapeHtml(s.id)}">
          <div class="snapshot-item-top">
            <div>
              <div class="snapshot-title">${escapeHtml(s.title || '이름 없는 스냅샷')}</div>
              ${s.memo ? `<div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${escapeHtml(s.memo)}</div>` : ''}
              <div class="snapshot-time">🕒 ${escapeHtml(timeStr)} ${s.device ? `· ${escapeHtml(s.device)}` : ''}</div>
            </div>
            <div class="snapshot-meta-badges">
              <span class="snapshot-badge">총 ${count}명</span>
              <span class="snapshot-badge team-a">A팀 ${countA}명</span>
              <span class="snapshot-badge team-b">B팀 ${countB}명</span>
            </div>
          </div>
          <div class="snapshot-actions">
            <button type="button" class="btn-snapshot-action restore" data-action="restore" data-id="${escapeHtml(s.id)}" data-title="${escapeHtml(s.title || '')}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>
              <span>이 스냅샷으로 DB 복원</span>
            </button>
            <button type="button" class="btn-snapshot-action" data-action="copy" data-id="${escapeHtml(s.id)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>JSON 복사</span>
            </button>
            <button type="button" class="btn-snapshot-action delete" data-action="delete" data-id="${escapeHtml(s.id)}" data-title="${escapeHtml(s.title || '')}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span>삭제</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach button events
    listContainer.querySelectorAll('[data-action="restore"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const snapId = btn.dataset.id;
        const snapTitle = btn.dataset.title;
        const targetSnap = snapshots.find(s => s.id === snapId);
        if (!targetSnap || !Array.isArray(targetSnap.records)) {
          showToast('⚠️ 스냅샷 데이터를 찾을 수 없습니다.');
          return;
        }

        if (!confirm(`정말로 [${snapTitle}] 스냅샷(${targetSnap.records.length}명)으로 현재 DB 데이터를 복원하시겠습니까?\n\n※ [스냅샷 복원] 이력이 히스토리에 자동 기록되며, 새로운 정합성 기준점으로 설정되어 100% 일치 상태가 됩니다.`)) {
          return;
        }

        records = JSON.parse(JSON.stringify(targetSnap.records));
        if (targetSnap.pinnedRelays && typeof targetSnap.pinnedRelays === 'object') {
          pinnedRelaysState = JSON.parse(JSON.stringify(targetSnap.pinnedRelays));
          savePinnedRelays();
        }
        saveData();
        renderAll();

        // 1. Record RESTORE event into Firestore history as the new baseline anchor
        await logChangeHistory(
          'RESTORE',
          '(전체 명단)',
          'snapshot_restore',
          '스냅샷 복원',
          '',
          snapTitle,
          `[스냅샷 복원] ${snapTitle} (${targetSnap.records.length}명)`,
          {
            snapshotId: snapId,
            snapshotTitle: snapTitle,
            snapshotCreatedAt: targetSnap.createdAt || targetSnap.savedAt || ''
          }
        );

        showToast(`🎉 [${snapTitle}] 스냅샷으로 DB가 성공적으로 복원되었습니다! (복원 이력 기록 완료)`);
        closeSnapshotModal();
      });
    });

    listContainer.querySelectorAll('[data-action="copy"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const snapId = btn.dataset.id;
        const targetSnap = snapshots.find(s => s.id === snapId);
        if (!targetSnap) return;
        const jsonStr = JSON.stringify(targetSnap.records, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(jsonStr).then(() => {
            showToast('📋 스냅샷 JSON 데이터가 클립보드에 복사되었습니다.');
          }).catch(() => fallbackCopyText(jsonStr, targetSnap.records.length));
        } else {
          fallbackCopyText(jsonStr, targetSnap.records.length);
        }
      });
    });

    listContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const snapId = btn.dataset.id;
        const snapTitle = btn.dataset.title;
        if (confirm(`[${snapTitle}] 스냅샷을 삭제하시겠습니까? (삭제 후 복구 불가)`)) {
          try {
            await deleteDoc(doc(db, SNAPSHOT_COL_NAME, snapId));
            showToast('🗑️ 스냅샷이 삭제되었습니다.');
            await loadSnapshotsList();
          } catch (err) {
            console.error('스냅샷 삭제 에러:', err);
            showToast('⚠️ 스냅샷 삭제 실패: ' + err.message);
          }
        }
      });
    });

  } catch (err) {
    console.error('스냅샷 목록 로딩 실패:', err);
    listContainer.innerHTML = `
      <div style="background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; padding:16px; color:#991b1b;">
        <div style="font-weight:700;">⚠️ 스냅샷 목록 로딩 실패</div>
        <div style="font-size:12px; margin-top:4px;">${escapeHtml(err.message || err)}</div>
      </div>
    `;
  }
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
    // 1. Fetch latest snapshot (limit 1)
    let latestSnapshot = null;
    try {
      const snapColRef = collection(db, SNAPSHOT_COL_NAME);
      const snapQ = query(snapColRef, orderBy("createdAt", "desc"), limit(1));
      const snapRes = await getDocs(snapQ);
      if (!snapRes.empty) {
        const snapDoc = snapRes.docs[0];
        latestSnapshot = { id: snapDoc.id, ...snapDoc.data() };
      }
    } catch (snapErr) {
      console.warn('스냅샷 컬렉션 조회 실패/없음:', snapErr);
    }

    // 2. Fetch recent 50 history logs (descending) for ultra-lightweight query
    const colRef = collection(db, HISTORY_COL_NAME);
    const q = query(colRef, orderBy("timestamp", "desc"), limit(50));
    const querySnapshot = await getDocs(q);

    const recentHistoryLogs = [];
    querySnapshot.forEach(docSnap => {
      recentHistoryLogs.push({ id: docSnap.id, ...docSnap.data() });
    });

    // 3. Find latest RESTORE event vs latest Snapshot created
    const latestRestoreLog = recentHistoryLogs.find(l => l.type === 'RESTORE' && l.snapshotId);
    const snapCreated = latestSnapshot ? (latestSnapshot.createdAt || latestSnapshot.savedAt || '') : '';
    const restoreTime = latestRestoreLog ? (latestRestoreLog.timestamp || '') : '';
    const isRestoreAnchor = Boolean(latestRestoreLog && (!snapCreated || restoreTime >= snapCreated));

    let baseRecords = [];
    let basePinnedRelays = JSON.parse(JSON.stringify(DEFAULT_PINNED_RELAYS));
    let baseTimestamp = '1970-01-01T00:00:00.000Z';
    let baseTitle = '최초 기본 데이터 (DEFAULT_RECORDS)';
    let baseTimeFormatted = '2026-01-01';

    if (isRestoreAnchor) {
      let restoredSnap = null;
      if (latestSnapshot && latestSnapshot.id === latestRestoreLog.snapshotId) {
        restoredSnap = latestSnapshot;
      } else {
        try {
          const sDoc = await getDoc(doc(db, SNAPSHOT_COL_NAME, latestRestoreLog.snapshotId));
          if (sDoc.exists()) restoredSnap = { id: sDoc.id, ...sDoc.data() };
        } catch (e) {
          console.warn('복원된 스냅샷 조회 실패:', e);
        }
      }

      if (restoredSnap && Array.isArray(restoredSnap.records)) {
        baseRecords = JSON.parse(JSON.stringify(restoredSnap.records));
        if (restoredSnap.pinnedRelays && typeof restoredSnap.pinnedRelays === 'object') {
          basePinnedRelays = JSON.parse(JSON.stringify(restoredSnap.pinnedRelays));
        }
      } else {
        baseRecords = JSON.parse(JSON.stringify(DEFAULT_RECORDS));
      }

      baseTimestamp = latestRestoreLog.timestamp;
      baseTitle = `[스냅샷 복원] ${latestRestoreLog.snapshotTitle || latestRestoreLog.newVal || '스냅샷'}`;
      baseTimeFormatted = latestRestoreLog.timeFormatted || (new Date(latestRestoreLog.timestamp).toLocaleString('ko-KR'));
    } else if (latestSnapshot && Array.isArray(latestSnapshot.records) && latestSnapshot.records.length > 0) {
      baseRecords = JSON.parse(JSON.stringify(latestSnapshot.records));
      if (latestSnapshot.pinnedRelays && typeof latestSnapshot.pinnedRelays === 'object') {
        basePinnedRelays = JSON.parse(JSON.stringify(latestSnapshot.pinnedRelays));
      }
      baseTimestamp = snapCreated || '1970-01-01T00:00:00.000Z';
      baseTitle = latestSnapshot.title || `스냅샷 (${latestSnapshot.createdAtFormatted || snapCreated})`;
      baseTimeFormatted = latestSnapshot.createdAtFormatted || (latestSnapshot.createdAt ? new Date(latestSnapshot.createdAt).toLocaleString('ko-KR') : '-');
    } else {
      baseRecords = JSON.parse(JSON.stringify(DEFAULT_RECORDS));
    }

    // 4. Filter logs that occurred strictly AFTER baseTimestamp (chronological order)
    const recentLogs = recentHistoryLogs
      .filter(l => (l.timestamp || '') > baseTimestamp && l.type !== 'RESTORE')
      .reverse();

    // 5. Replay forward from baseRecords & basePinnedRelays
    let replayed = JSON.parse(JSON.stringify(baseRecords));
    let replayedPins = JSON.parse(JSON.stringify(basePinnedRelays));

    recentLogs.forEach(log => {
      const { type, swimmer, swimmerName, field, newVal, team, comboKey, strokeField } = log;
      const targetName = swimmer || swimmerName;
      if (!targetName) return;

      if (type === 'PIN') {
        if (team && comboKey) {
          if (!replayedPins[team]) replayedPins[team] = {};
          const isMedley = comboKey === 'combo4' || comboKey === 'combo5';
          const isUnpin = newVal === '미고정 (자동추천)' || newVal === '해제' || newVal === '(빈값)' || !newVal;

          if (isMedley && strokeField) {
            if (!replayedPins[team][comboKey]) replayedPins[team][comboKey] = {};
            replayedPins[team][comboKey][strokeField] = isUnpin ? null : targetName;
          } else if (!isMedley) {
            if (!Array.isArray(replayedPins[team][comboKey])) replayedPins[team][comboKey] = [];
            const list = replayedPins[team][comboKey];
            const idx = list.indexOf(targetName);
            if (isUnpin && idx >= 0) {
              list.splice(idx, 1);
            } else if (!isUnpin && idx < 0) {
              list.push(targetName);
            }
          }
        }
        return;
      }

      let target = replayed.find(r => r.name === targetName || (field === 'name' && log.prevVal && r.name === log.prevVal) || (log.swimmerId && r.id === log.swimmerId));

      if (type === 'MEMBER') {
        if (!target) {
          const newId = replayed.length > 0 ? Math.max(...replayed.map(r => r.id)) + 1 : 1;
          target = {
            id: newId,
            age: '',
            group: '1그룹',
            gender: '남',
            name: targetName,
            birthId: '',
            team: 'A',
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
        replayed = replayed.filter(r => r.name !== targetName && (!log.prevVal || r.name !== log.prevVal));
        return;
      }

      if (target && field && field !== 'member' && !field.startsWith('relay_pin')) {
        target[field] = newVal !== undefined && newVal !== null ? String(newVal) : '';
      }
    });

    // 5. Compare replayed with current records (serverRecordsCache or records)
    const currentList = serverRecordsCache || records;
    const discrepancies = [];
    const fieldsToCheck = ['team', 'group', 'age', 'gender', 'name', 'event1', 'event2', 'finFly', 'finFree', 'free', 'back', 'breast', 'fly'];

    let totalFieldChecks = 0;
    let matchingFieldChecks = 0;

    currentList.forEach(curr => {
      const rep = replayed.find(r => r.name === curr.name);
      if (!rep) {
        const matchingLog = recentHistoryLogs.find(l => 
          (l.swimmer === curr.name || l.swimmerName === curr.name) && l.type === 'MEMBER'
        );
        const changeTime = matchingLog 
          ? (matchingLog.timeFormatted || (matchingLog.timestamp ? new Date(matchingLog.timestamp).toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }) : '-'))
          : '신규';

        discrepancies.push({
          id: curr.id,
          name: curr.name,
          field: 'member',
          fieldName: '회원 신규 등록',
          changeTime,
          replayedVal: '(미존재)',
          currentVal: `번호 ${curr.id} (${curr.team || 'A'}팀, ${curr.group || ''}, ${curr.gender || ''})`,
          status: '히스토리 미기록',
          recordObj: curr
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
          const matchingLog = recentHistoryLogs.find(l => 
            (l.swimmer === curr.name || l.swimmerName === curr.name) && (l.field === f || l.fieldName === f)
          );
          const changeTime = matchingLog 
            ? (matchingLog.timeFormatted || (matchingLog.timestamp ? new Date(matchingLog.timestamp).toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }) : '-'))
            : '최근';

          discrepancies.push({
            id: curr.id,
            name: curr.name,
            field: f,
            fieldName: STROKE_NAMES[f] || (f === 'team' ? '소속팀' : f === 'group' ? '그룹' : f === 'age' ? '만나이' : f === 'gender' ? '성별' : f === 'name' ? '이름' : f),
            changeTime,
            replayedVal: repVal || '(빈값)',
            currentVal: currVal || '(빈값)',
            status: '내용 불일치',
            recordObj: curr
          });
        }
      });
    });

    // Check deleted in current
    replayed.forEach(rep => {
      const curr = currentList.find(r => r.name === rep.name);
      if (!curr) {
        const matchingLog = recentHistoryLogs.find(l => 
          (l.swimmer === rep.name || l.swimmerName === rep.name) && l.type === 'DELETE'
        );
        const changeTime = matchingLog 
          ? (matchingLog.timeFormatted || (matchingLog.timestamp ? new Date(matchingLog.timestamp).toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }) : '-'))
          : '삭제';

        discrepancies.push({
          id: rep.id,
          name: rep.name,
          field: 'member_deleted',
          fieldName: '회원 삭제',
          changeTime,
          replayedVal: `존재함 (번호 ${rep.id})`,
          currentVal: '(삭제됨)',
          status: '삭제 히스토리 누락',
          recordObj: rep
        });
      }
    });

    // 6. Compare replayedPinnedRelays with current pinnedRelaysState
    ['A', 'B'].forEach(team => {
      const curTeamPins = pinnedRelaysState[team] || {};
      const repTeamPins = replayedPins[team] || {};

      ['combo1', 'combo2', 'combo3'].forEach(comboKey => {
        const curList = Array.isArray(curTeamPins[comboKey]) ? curTeamPins[comboKey] : [];
        const repList = Array.isArray(repTeamPins[comboKey]) ? repTeamPins[comboKey] : [];
        const relayTitle = RELAY_TITLES[comboKey] || comboKey;

        const allSwimmers = Array.from(new Set([...curList, ...repList]));
        allSwimmers.forEach(name => {
          totalFieldChecks++;
          const inCur = curList.includes(name);
          const inRep = repList.includes(name);

          if (inCur === inRep) {
            matchingFieldChecks++;
          } else {
            const matchingPinLog = recentHistoryLogs.find(l => 
              (l.swimmer === name || l.swimmerName === name) && 
              l.type === 'PIN' && 
              l.comboKey === comboKey && 
              l.team === team
            );
            const changeTime = matchingPinLog 
              ? (matchingPinLog.timeFormatted || (matchingPinLog.timestamp ? new Date(matchingPinLog.timestamp).toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }) : '-'))
              : '선발수정';

            discrepancies.push({
              id: `pin_${team}_${comboKey}_${name}`,
              name: name,
              field: 'relay_pin',
              fieldName: `단체전 선발 [${team}팀 ${relayTitle}]`,
              changeTime,
              replayedVal: inRep ? '선발 고정됨' : '미고정 (자동추천)',
              currentVal: inCur ? '선발 고정됨' : '미고정 (자동추천)',
              status: '선발 고정 불일치',
              team,
              comboKey,
              strokeField: null,
              isPinDiscrepancy: true
            });
          }
        });
      });

      ['combo4', 'combo5'].forEach(comboKey => {
        const curMedley = curTeamPins[comboKey] || {};
        const repMedley = repTeamPins[comboKey] || {};
        const relayTitle = RELAY_TITLES[comboKey] || comboKey;

        ['back', 'breast', 'fly', 'free'].forEach(st => {
          totalFieldChecks++;
          const curName = curMedley[st] || '';
          const repName = repMedley[st] || '';
          const stName = STROKE_NAMES[st] || st;

          if (curName === repName) {
            matchingFieldChecks++;
          } else {
            const matchingPinLog = recentHistoryLogs.find(l => 
              l.type === 'PIN' && 
              l.comboKey === comboKey && 
              l.team === team && 
              l.strokeField === st
            );
            const changeTime = matchingPinLog 
              ? (matchingPinLog.timeFormatted || (matchingPinLog.timestamp ? new Date(matchingPinLog.timestamp).toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }) : '-'))
              : '선발수정';

            discrepancies.push({
              id: `pin_${team}_${comboKey}_${st}`,
              name: curName || repName || '(선수 미정)',
              field: 'relay_pin',
              fieldName: `단체전 선발 [${team}팀 ${relayTitle} - ${stName}]`,
              changeTime,
              replayedVal: repName ? `${repName} (${stName} 고정)` : '미고정 (자동추천)',
              currentVal: curName ? `${curName} (${stName} 고정)` : '미고정 (자동추천)',
              status: '선발 고정 불일치',
              team,
              comboKey,
              strokeField: st,
              curName,
              repName,
              isPinDiscrepancy: true
            });
          }
        });
      });
    });

    const matchRate = totalFieldChecks > 0 ? ((matchingFieldChecks / totalFieldChecks) * 100).toFixed(1) : '100.0';
    const result = {
      success: true,
      baseTitle,
      baseTimeFormatted,
      baseRecordsCount: baseRecords.length,
      recentLogs,
      unappliedLogs: [],
      totalRecentCount: recentLogs.length,
      totalLogs: recentHistoryLogs.length,
      totalFieldChecks,
      matchingFieldChecks,
      matchRate: `${matchRate}%`,
      discrepancyCount: discrepancies.length,
      discrepancies,
      replayedRecords: replayed,
      replayedPins: replayedPins,
      isPerfectMatch: discrepancies.length === 0,
      timestamp: new Date().toISOString()
    };

    console.group(`🔍 [GMDC] 최후 스냅샷 기준 히스토리 정합성 검증 (${new Date().toLocaleTimeString('ko-KR')})`);
    console.log(`📷 기준 스냅샷: ${baseTitle} (${baseRecords.length}명)`);
    console.log(`📜 스냅샷 이후 히스토리 로그: ${recentLogs.length}건`);
    console.log(`🎯 데이터 일치율: ${matchRate}% (${matchingFieldChecks}/${totalFieldChecks}개 필드 일치)`);
    if (result.isPerfectMatch) {
      console.log(`%c✅ 완벽 일치: 최후 스냅샷과 이후 히스토리가 현재 DB와 100% 일치합니다.`, 'color: #10b981; font-weight: bold;');
    } else {
      console.warn(`⚠️ 불일치 항목 ${discrepancies.length}건 발견:`, discrepancies);
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
  recordsViewMode = saved ? saved : 'detailed'; // 기본: 자세히 (detailed)
  applyRecordsViewMode(recordsViewMode);
}

function applyRecordsViewMode(mode) {
  recordsViewMode = mode;
  const select = document.getElementById('recordsModeSelect');
  if (select) select.value = mode;
  if (recordTable) recordTable.classList.toggle('is-simple', mode === 'simple');
}

function initEventsViewMode() {
  const saved = localStorage.getItem(EVENTS_MODE_KEY);
  eventsViewMode = (saved === 'detailed') ? 'detailed' : 'simple'; // 기본: simple
  applyEventsViewMode(eventsViewMode);
}

function applyEventsViewMode(mode) {
  eventsViewMode = mode;
  const select = document.getElementById('eventsModeSelect');
  if (select) select.value = mode;
  if (eventsDetailTable) eventsDetailTable.classList.toggle('is-simple', mode === 'simple');
  const btnCopyEvents = document.getElementById('btnCopyEventsTsv');
  if (btnCopyEvents) {
    btnCopyEvents.style.display = (mode === 'detailed') ? 'inline-flex' : 'none';
  }
}

async function logChangeHistory(type, swimmerName, field, fieldName, oldVal, newVal, customMsg = '', extraProps = {}) {
  if (isScenarioMode) return;
  if (oldVal === newVal && type !== 'MEMBER' && type !== 'DELETE') return;

  const typeLabels = {
    RECORD: '기록 수정',
    EVENT: '종목 변경',
    INFO: '정보 수정',
    MEMBER: '회원 추가',
    DELETE: '회원 삭제',
    PIN: '선발 고정/해제',
    RESTORE: '스냅샷 복원'
  };

  let msg = customMsg;
  if (!msg) {
    if (type === 'RECORD') {
      msg = `${swimmerName}: ${fieldName} 기록 (${oldVal || '빈값'} ➔ ${newVal || '삭제'})`;
    } else if (type === 'EVENT') {
      msg = `${swimmerName}: ${fieldName} (${oldVal || '미신청'} ➔ ${newVal || '미신청'})`;
    } else if (type === 'INFO') {
      msg = `${swimmerName}: ${fieldName} (${oldVal} ➔ ${newVal})`;
    } else if (type === 'PIN') {
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
    swimmer: swimmerName || '무명',
    swimmerName: swimmerName || '무명',
    field: field || '',
    fieldName: fieldName || '',
    label: customMsg || (fieldName ? `${fieldName}` : ''),
    prevVal: oldVal !== undefined ? String(oldVal) : '',
    newVal: newVal !== undefined ? String(newVal) : '',
    message: msg,
    timestamp: now.toISOString(),
    timeFormatted: timeStr,
    isApplied: true,
    device: navigator.userAgent.includes('Mobile') ? '모바일' : 'PC',
    ...extraProps
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

function cleanAddress(addr) {
  if (!addr) return '';
  return String(addr).replace(/경상남도/g, '').trim();
}

// Merge helper to guarantee group, birthId, team, event1, event2, phone, address are preserved
function mergeWithDefaultData(remoteList) {
  if (!Array.isArray(remoteList)) return JSON.parse(JSON.stringify(DEFAULT_RECORDS));

  const list = remoteList.map(item => {
    const def = DEFAULT_RECORDS.find(d => d.id === item.id || d.name === item.name) || {};
    return {
      id: item.id || def.id || 0,
      age: item.age !== undefined ? item.age : (def.age || ''),
      group: item.group || def.group || '1그룹',
      gender: item.gender || def.gender || '남',
      name: item.name || def.name || '',
      birthId: item.birthId || def.birthId || '',
      team: item.team !== undefined ? item.team : (def.team || 'A'),
      phone: (item.phone && String(item.phone).trim() !== '') ? item.phone : (def.phone || ''),
      address: cleanAddress((item.address && String(item.address).trim() !== '') ? item.address : (def.address || '')),
      club: (item.club && String(item.club).trim() !== '') ? item.club : (def.club || 'GMDC'),
      depositor: (item.depositor && String(item.depositor).trim() !== '') ? item.depositor : 'GMDC',
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

  // Ensure any new members in DEFAULT_RECORDS (e.g. ID 38 권순용, ID 39 이석민) are appended if missing
  DEFAULT_RECORDS.forEach(def => {
    if (!list.some(r => r.id === def.id || r.name === def.name)) {
      list.push(JSON.parse(JSON.stringify(def)));
    }
  });

  return list;
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
  const currentScroll = window.scrollY;
  currentView = viewName;

  // Synchronize all view-toggle-btn buttons (header + toolbars)
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (viewName === 'events') {
    if (viewRecords) viewRecords.classList.remove('active');
    if (viewEvents) viewEvents.classList.add('active');
    if (window.location.hash !== '#events') {
      history.replaceState(null, null, '#events');
    }
    renderSummaryMatrices();
    renderEventsTable();
  } else {
    if (viewRecords) viewRecords.classList.add('active');
    if (viewEvents) viewEvents.classList.remove('active');
    if (window.location.hash !== '' && window.location.hash !== '#records') {
      history.replaceState(null, null, '#records');
    }
    renderTable();
    updateStats();
  }

  if (currentScroll > 0) {
    window.scrollTo({ top: currentScroll, behavior: 'instant' });
  }
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

// Initialize Sticky Panel Preference (최대 1개 패널 고정 & 나머지 숨김)
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

// Default sorting comparator: 1. Group asc, 2. Gender asc ('남' -> '여'), 3. Name asc ('가나다순')
function defaultRecordComparator(a, b) {
  // 1. Group ascending (1그룹, 2그룹, ...)
  const groupA = a.group || '';
  const groupB = b.group || '';
  const groupCmp = groupA.localeCompare(groupB, 'ko', { numeric: true });
  if (groupCmp !== 0) return groupCmp;

  // 2. Gender ascending ('남' before '여')
  const genderA = a.gender || '';
  const genderB = b.gender || '';
  const genderCmp = genderA.localeCompare(genderB, 'ko');
  if (genderCmp !== 0) return genderCmp;

  // 3. Name ascending ('가나다순')
  const nameA = a.name || '';
  const nameB = b.name || '';
  return nameA.localeCompare(nameB, 'ko');
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
  }

  if (currentTeamFilter === 'A') {
    list = list.filter(item => (item.team || 'A') === 'A');
  } else if (currentTeamFilter === 'B') {
    list = list.filter(item => (item.team || 'A') === 'B');
  }

  if (currentGroupFilter && currentGroupFilter !== 'all') {
    list = list.filter(item => item.group === currentGroupFilter);
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

      if (sortColumn === 'team') {
        valA = a.team || 'A';
        valB = b.team || 'A';
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
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
  } else {
    list.sort(defaultRecordComparator);
  }

  return list;
}

// Render PB Records Table
function renderTable() {
  const processed = getProcessedRecords();
  tableBody.innerHTML = '';

  const recordsDetailTitle = document.getElementById('recordsDetailTitle');
  if (recordsDetailTitle) {
    recordsDetailTitle.textContent = `📋 개인 PB 기록 명단 (${processed.length}명 표시 중 / 총 ${records.length}명)`;
  }

  if (processed.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="13" style="padding: 40px; color: var(--text-muted); font-size: 14px; text-align: center;">
        일치하는 데이터가 없습니다.
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }

  processed.forEach((item) => {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;

    // Events summary tags (Individual events only)
    const eventsList = [item.event1, item.event2].filter(Boolean);
    let eventsTagsHtml = '';
    if (eventsList.length > 0) {
      eventsTagsHtml = eventsList.map(e => `<span class="pb-event-chip">${escapeHtml(e)}</span>`).join('');
    } else {
      eventsTagsHtml = `<span class="pb-event-chip empty">미신청</span>`;
    }
    const eventsTagHtml = `<div class="pb-events-tag-container">${eventsTagsHtml}</div>`;

    // Relay assignments (Team relay entries)
    const relayAssignments = getSwimmerRelayAssignments(item.name);
    let relayTagsHtml = '';
    if (relayAssignments.length > 0) {
      relayTagsHtml = relayAssignments.map(a => `
        <span class="relay-chip relay-${a.team.toLowerCase()}" title="${a.team}팀 ${a.label} 출전 고정 (${a.strokeName})">
          🔒 ${a.team === 'B' ? 'B-' : ''}${a.label}
        </span>
      `).join('');
    } else {
      relayTagsHtml = `<span class="relay-chip empty">-</span>`;
    }
    const relayTagHtml = `<div class="pb-events-tag-container">${relayTagsHtml}</div>`;

    const canEdit = canEditRecords();
    const admin = isAdmin();
    const readonlyAttr = !canEdit ? 'readonly tabindex="-1"' : '';
    const disabledStyle = !canEdit ? 'style="pointer-events:none; cursor:default;"' : '';

    tr.innerHTML = `
      <td class="col-team" style="text-align:center;">
        <button 
          type="button" 
          class="btn-team-toggle team-${item.team || 'A'}" 
          data-team-id="${item.id}" 
          ${disabledStyle}
          title="${canEdit ? `클릭하여 소속팀 변경 (현재: ${item.team || 'A'}팀)` : `소속팀: ${item.team || 'A'}팀`}"
        >
          ${item.team || 'A'}팀
        </button>
      </td>
      <td class="col-no col-pb-detail">${item.id}</td>
      <td class="col-group col-pb-detail">
        <span class="group-badge">${escapeHtml(item.group || '-')}</span>
      </td>
      <td class="col-age col-pb-detail">
        <input type="text" class="cell-input age-input" data-id="${item.id}" data-field="age" value="${escapeHtml(item.age || '')}" placeholder="만나이" inputmode="numeric" ${readonlyAttr} />
      </td>
      <td class="col-gender col-pb-detail">
        <span class="gender-badge ${item.gender === '남' ? 'male' : 'female'}" data-id="${item.id}" data-field="gender" ${disabledStyle} title="${canEdit ? '클릭하여 성별 전환' : `성별: ${item.gender || '남'}`}">
          ${item.gender || '남'}
        </span>
      </td>
      <td class="col-name">
        <input type="text" class="cell-input name-input" data-id="${item.id}" data-field="name" value="${escapeHtml(item.name || '')}" placeholder="이름" ${readonlyAttr} title="${canEdit ? '클릭하여 이름 수정' : escapeHtml(item.name || '')}" />
      </td>
      <td class="col-relay-summary col-pb-detail" style="text-align:center;">
        ${relayTagHtml}
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
                ${readonlyAttr}
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

function initMatrixCompareMode() {
  const chkMale = document.getElementById('chkCompareMaleMatrix');
  const chkFemale = document.getElementById('chkCompareFemaleMatrix');

  function updateCheckboxes() {
    if (chkMale) chkMale.checked = isMatrixCompareMode;
    if (chkFemale) chkFemale.checked = isMatrixCompareMode;
  }

  function handleToggle(e) {
    isMatrixCompareMode = e.target.checked;
    localStorage.setItem('gmdc_matrix_compare_mode', isMatrixCompareMode);
    updateCheckboxes();
    renderSummaryMatrices();
  }

  if (chkMale) chkMale.addEventListener('change', handleToggle);
  if (chkFemale) chkFemale.addEventListener('change', handleToggle);
  updateCheckboxes();
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

  const colTotalsA = {
    '핀자유형 50': 0,
    '핀접영 50': 0,
    '자유형 50': 0,
    '배영 50': 0,
    '평영 50': 0,
    '접영 50': 0
  };
  const colTotalsB = {
    '핀자유형 50': 0,
    '핀접영 50': 0,
    '자유형 50': 0,
    '배영 50': 0,
    '평영 50': 0,
    '접영 50': 0
  };
  let grandTotalA = 0;
  let grandTotalB = 0;

  GROUPS.forEach(groupName => {
    const groupMembers = filteredList.filter(r => r.group === groupName);
    let groupRowTotalA = 0;
    let groupRowTotalB = 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="matrix-cell-group">${groupName}</td>`;

    EVENT_OPTIONS.forEach(eventName => {
      const eventSwimmers = groupMembers.filter(r => r.event1 === eventName || r.event2 === eventName);
      const countA = eventSwimmers.filter(r => (r.team || 'A') === 'A').length;
      const countB = eventSwimmers.filter(r => (r.team || 'A') === 'B').length;
      const totalCount = countA + countB;
      const prevCount = PREV_YEAR_DISTRIBUTION[gender]?.[groupName]?.[eventName] ?? 0;

      groupRowTotalA += countA;
      groupRowTotalB += countB;
      colTotalsA[eventName] += countA;
      colTotalsB[eventName] += countB;

      if (isMatrixCompareMode) {
        const titleText = totalCount > 0
          ? `${groupName} · ${eventName} (올해 ${countA}+${countB}명 / 작년 ${prevCount}명): ${eventSwimmers.map(s => `[${s.team || 'A'}팀] ${s.name}`).join(', ')}`
          : `${groupName} · ${eventName} (올해 0명 / 작년 ${prevCount}명)`;

        tr.innerHTML += `
          <td class="matrix-cell is-compared ${totalCount > 0 ? 'has-count' : 'is-empty'}" title="${titleText}">
            <span class="matrix-num-compare">
              <span class="${totalCount > 0 ? 'num-curr' : 'num-curr-zero'}">${totalCount > 0 ? `${countA}+${countB}` : '0'}</span>
              <span class="num-slash">/</span>
              <span class="num-prev">(${prevCount})</span>
            </span>
            ${totalCount > 0 ? `
              <div class="matrix-hover-tooltip">
                <div class="tooltip-header">${groupName} · ${eventName} (총 ${totalCount}명: A팀 ${countA} + B팀 ${countB})</div>
                <div class="tooltip-list">
                  ${eventSwimmers.map(s => `
                    <span class="tooltip-chip ${gender === '남' ? 'male' : 'female'}">[${s.team || 'A'}팀] ${escapeHtml(s.name)}</span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </td>
        `;
      } else {
        if (totalCount > 0) {
          const namesList = eventSwimmers.map(s => `[${s.team || 'A'}팀] ${s.name}`).join(', ');
          tr.innerHTML += `
            <td class="matrix-cell has-count" title="${groupName} · ${eventName} (${countA}+${countB}명): ${namesList}">
              <span class="matrix-num">${countA}+${countB}</span>
              <div class="matrix-hover-tooltip">
                <div class="tooltip-header">${groupName} · ${eventName} (총 ${totalCount}명: A팀 ${countA} + B팀 ${countB})</div>
                <div class="tooltip-list">
                  ${eventSwimmers.map(s => `
                    <span class="tooltip-chip ${gender === '남' ? 'male' : 'female'}">[${s.team || 'A'}팀] ${escapeHtml(s.name)}</span>
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
      }
    });

    grandTotalA += groupRowTotalA;
    grandTotalB += groupRowTotalB;
    const groupRowGrandTotal = groupRowTotalA + groupRowTotalB;
    const prevGroupTotal = PREV_YEAR_DISTRIBUTION[gender]?.[groupName]?.total ?? 0;

    if (isMatrixCompareMode) {
      tr.innerHTML += `
        <td class="matrix-cell is-compared" style="font-weight:800; background:#f8fafc; color:var(--secondary);">
          <span class="matrix-num-compare">
            <span class="${groupRowGrandTotal > 0 ? 'num-curr' : 'num-curr-zero'}">${groupRowGrandTotal > 0 ? `${groupRowTotalA}+${groupRowTotalB}` : '0'}</span>
            <span class="num-slash">/</span>
            <span class="num-prev">(${prevGroupTotal})</span>
          </span>
        </td>
      `;
    } else {
      tr.innerHTML += `
        <td class="matrix-cell" style="font-weight:800; background:#f8fafc; color:var(--secondary);">
          ${groupRowGrandTotal > 0 ? `${groupRowTotalA}+${groupRowTotalB}` : '-'}
        </td>
      `;
    }
    bodyEl.appendChild(tr);
  });

  // Footer Row
  const grandTotal = grandTotalA + grandTotalB;
  const prevGrandTotal = GROUPS.reduce((sum, g) => sum + (PREV_YEAR_DISTRIBUTION[gender]?.[g]?.total ?? 0), 0);

  footEl.innerHTML = `
    <tr>
      <th>계</th>
      ${EVENT_OPTIONS.map(ev => {
        const colTotalA = colTotalsA[ev];
        const colTotalB = colTotalsB[ev];
        const colTotal = colTotalA + colTotalB;
        const prevColTotal = GROUPS.reduce((sum, g) => sum + (PREV_YEAR_DISTRIBUTION[gender]?.[g]?.[ev] ?? 0), 0);
        if (isMatrixCompareMode) {
          return `
            <td>
              <span class="matrix-num-compare">
                <span class="${colTotal > 0 ? 'num-curr' : 'num-curr-zero'}">${colTotal > 0 ? `${colTotalA}+${colTotalB}` : '0'}</span>
                <span class="num-slash">/</span>
                <span class="num-prev">(${prevColTotal})</span>
              </span>
            </td>
          `;
        } else {
          return `<td>${colTotal > 0 ? `${colTotalA}+${colTotalB}` : '-'}</td>`;
        }
      }).join('')}
      <td style="color:${gender === '남' ? '#0284c7' : '#e11d48'}; font-weight:900;">
        ${isMatrixCompareMode ? `
          <span class="matrix-num-compare">
            <span class="num-curr">${grandTotalA}+${grandTotalB}</span>
            <span class="num-slash">/</span>
            <span class="num-prev">(${prevGrandTotal})</span>
          </span>
        ` : `${grandTotalA}+${grandTotalB}`}
      </td>
    </tr>
  `;
}

// ============================================================
// EVENTS DETAIL TABLE SECTION (출전 선수별 상세 명단)
// ============================================================
function getFilteredEventsList() {
  let list = [...records];

  // Search filter
  if (eventsSearchQuery.trim()) {
    const q = eventsSearchQuery.trim().toLowerCase();
    list = list.filter(item => 
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.group && item.group.toLowerCase().includes(q)) ||
      (item.age && String(item.age).includes(q)) ||
      (item.birthId && item.birthId.toLowerCase().includes(q)) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.address && item.address.toLowerCase().includes(q))
    );
  }

  // Gender filter
  if (eventsGenderFilter === '남') {
    list = list.filter(item => item.gender === '남');
  } else if (eventsGenderFilter === '여') {
    list = list.filter(item => item.gender === '여');
  }

  // Team filter
  if (eventsTeamFilter === 'A') {
    list = list.filter(item => (item.team || 'A') === 'A');
  } else if (eventsTeamFilter === 'B') {
    list = list.filter(item => (item.team || 'A') === 'B');
  }

  // Group filter
  if (eventsGroupFilter !== 'all') {
    list = list.filter(item => item.group === eventsGroupFilter);
  }

  // Default sorting: 1. Group asc, 2. Gender asc, 3. Name asc
  list.sort(defaultRecordComparator);

  return list;
}

function renderEventsTable() {
  if (!eventsTableBody) return;

  const list = getFilteredEventsList();

  const eventsDetailTitle = document.getElementById('eventsDetailTitle');
  if (eventsDetailTitle) {
    eventsDetailTitle.textContent = `📋 출전 선수별 명단 (${list.length}명 표시 중 / 총 ${records.length}명)`;
  }

  if (eventsFilteredCount) {
    eventsFilteredCount.textContent = `${list.length}명 표시 중 (총 ${records.length}명)`;
  }

  eventsTableBody.innerHTML = '';

  if (list.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="12" style="padding: 36px; color: var(--text-muted); font-size: 14px; text-align: center;">
        일치하는 출전 선수가 없습니다.
      </td>
    `;
    eventsTableBody.appendChild(emptyRow);
    return;
  }

  list.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;

    const relayAssignments = getSwimmerRelayAssignments(item.name);
    const relayTagsHtml = relayAssignments.length > 0
      ? `<div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center;">${relayAssignments.map(a => `
          <span class="relay-chip relay-${a.team.toLowerCase()}" title="${a.team}팀 ${a.label} 출전 고정 (${a.strokeName})">
            🔒 ${a.team === 'B' ? 'B-' : ''}${a.label}
          </span>
        `).join('')}</div>`
      : '<span class="relay-chip empty">-</span>';

    tr.innerHTML = `
      <td class="col-team" style="text-align:center;">
        <button 
          type="button"
          class="btn-team-toggle team-${item.team || 'A'}" 
          data-team-id="${item.id}" 
          title="클릭하여 소속팀 변경 (현재: ${item.team || 'A'}팀)"
        >
          ${item.team || 'A'}팀
        </button>
      </td>
      <td class="col-no col-detail" style="text-align:center;">${idx + 1}</td>
      <td class="col-group col-detail" style="text-align:center;">
        <span class="group-badge">${escapeHtml(item.group || '-')}</span>
      </td>
      <td class="col-gender col-detail" style="text-align:center;">
        <span class="gender-badge ${item.gender === '남' ? 'male' : 'female'}">${item.gender || '남'}</span>
      </td>
      <td class="col-name" style="font-weight:700;">
        ${escapeHtml(item.name || '무명')}
      </td>
      <td class="col-relay" style="text-align:center;">
        ${relayTagsHtml}
      </td>
      <td class="col-age col-simple" style="text-align:center; font-weight:600; color:var(--text-main);">
        ${item.age ? `${item.age}세` : '-'}
      </td>
      <td class="col-birth col-detail" style="text-align:center;">
        <span class="birth-code">${escapeHtml(item.birthId || '-')}</span>
      </td>
      <td class="col-event">
        <select class="event-select ${item.event1 ? 'has-event' : ''}" data-id="${item.id}" data-field="event1">
          <option value="">(미신청)</option>
          ${EVENT_OPTIONS.map(opt => `
            <option value="${opt}" ${item.event1 === opt ? 'selected' : ''}>${opt}</option>
          `).join('')}
        </select>
      </td>
      <td class="col-event">
        <select class="event-select ${item.event2 ? 'has-event' : ''}" data-id="${item.id}" data-field="event2">
          <option value="">(미신청)</option>
          ${EVENT_OPTIONS.map(opt => `
            <option value="${opt}" ${item.event2 === opt ? 'selected' : ''}>${opt}</option>
          `).join('')}
        </select>
      </td>
      <td class="col-detail" style="text-align:center; font-size:12px; color:var(--text-muted); font-variant-numeric:tabular-nums;">
        ${escapeHtml(item.phone || '-')}
      </td>
      <td class="col-detail" style="text-align:center; font-size:12px; font-weight:600; color:var(--text-main);">
        ${escapeHtml(item.depositor || 'GMDC')}
      </td>
      <td class="col-detail" style="text-align:left; font-size:12px; color:var(--text-muted); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(item.address || '')}">
        ${escapeHtml(item.address || '-')}
      </td>
    `;

    eventsTableBody.appendChild(tr);
  });
}

function copyEventsToClipboard() {
  const list = getFilteredEventsList();
  if (!list || list.length === 0) {
    showToast('⚠️ 복사할 출전 선수 명단이 없습니다.');
    return;
  }

  // Omit <th> headers and team; copy sequence (1-based), group, gender, name, birthId, event1, event2, phone, depositor, address
  const rows = list.map((item, idx) => {
    return [
      idx + 1,
      item.group || '',
      item.gender || '',
      item.name || '',
      item.birthId || '',
      item.event1 || '',
      item.event2 || '',
      item.phone || '',
      item.depositor || 'GMDC',
      item.address || ''
    ].join('\t');
  });

  const tsvText = rows.join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tsvText).then(() => {
      showToast(`📋 ${list.length}명의 성인부 명단이 클립보드에 복사되었습니다. (엑셀에 바로 붙여넣기 가능)`);
    }).catch(() => {
      fallbackCopyText(tsvText, list.length);
    });
  } else {
    fallbackCopyText(tsvText, list.length);
  }
}

function fallbackCopyText(text, count) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast(`📋 ${count}명의 명단이 클립보드에 복사되었습니다.`);
  } catch (err) {
    showToast('⚠️ 클립보드 복사에 실패했습니다.');
  }
  document.body.removeChild(textarea);
}

// Copy Selected Team Combination Members to Clipboard
// Format: 그룹, 성별, 성명, 생년월일, 나이, 단체전종목, 세부영법, 전화번호, 소속, 입금자명
function copyComboTeamToClipboard(comboKey, team) {
  const combos = calculateRelayCombinations(team);
  const result = combos[comboKey];

  if (!result || !result.members || result.members.length === 0) {
    showToast('⚠️ 선발된 팀 멤버 명단이 없습니다.');
    return;
  }

  const relayTitle = RELAY_TITLES[comboKey] || comboKey;

  const rows = result.members.map(m => {
    const swimmer = records.find(r => r.name === m.name) || records.find(r => r.id === m.id) || {};
    return [
      swimmer.group || m.group || '',
      swimmer.gender || m.gender || '',
      swimmer.name || m.name || '',
      swimmer.birthId || '',
      swimmer.age || m.age || '',
      relayTitle,
      m.strokeName ? `${m.strokeName} 50` : '',
      swimmer.phone || '',
      swimmer.club || (team === 'B' ? 'GMDC야호' : 'GMDC'),
      swimmer.depositor || 'GMDC'
    ].join('\t');
  });

  const tsvText = rows.join('\n');
  const teamLabel = `${team}팀`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tsvText).then(() => {
      showToast(`📋 ${teamLabel} [${relayTitle}] 선발 명단(${result.members.length}명)이 복사되었습니다.`);
    }).catch(() => {
      fallbackCopyText(tsvText, result.members.length);
    });
  } else {
    fallbackCopyText(tsvText, result.members.length);
  }
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

// Get rank optimization score for a swimmer
function getRankTime(swimmer, strokeField) {
  if (!swimmer) return 99.99;
  const val = parseFloat(swimmer[strokeField]);
  if (!isNaN(val) && val > 0) return val;
  if (strokeField === 'finFree') {
    const freeVal = parseFloat(swimmer.free);
    if (!isNaN(freeVal) && freeVal > 0) return freeVal;
  }
  return 99.99;
}

// 1. 혼성 핀계영 300m (남3, 여3, 도합 >= 240세)
function computeFinRelay(team = 'A', records, pinnedList = [], excludeSwimmerNames = new Set()) {
  const teamRecords = records.filter(r => (r.team || 'A') === team && !excludeSwimmerNames.has(r.name));

  const pinnedMen = [];
  const pinnedWomen = [];
  pinnedList.forEach(name => {
    const s = teamRecords.find(r => r.name === name) || records.find(r => r.name === name);
    if (s) {
      if (s.gender === '남') pinnedMen.push(s);
      else if (s.gender === '여') pinnedWomen.push(s);
    }
  });

  const neededMen = 3 - pinnedMen.length;
  const neededWomen = 3 - pinnedWomen.length;

  if (neededMen < 0 || neededWomen < 0) {
    return { status: 'ERROR', message: '고정 인원이 성별 정원(3명)을 초과했습니다.' };
  }

  const pinnedMenNames = new Set(pinnedMen.map(s => s.name));
  const pinnedWomenNames = new Set(pinnedWomen.map(s => s.name));

  const availableMen = teamRecords.filter(r => r.gender === '남' && parseFloat(r.age) > 0 && !pinnedMenNames.has(r.name));
  const availableWomen = teamRecords.filter(r => r.gender === '여' && parseFloat(r.age) > 0 && !pinnedWomenNames.has(r.name));

  if (availableMen.length < neededMen || availableWomen.length < neededWomen) {
    return { status: 'NOT_ENOUGH', message: `핀자유 후보 인원 부족 (남 필요: ${neededMen}, 여 필요: ${neededWomen})` };
  }

  const menCombos = neededMen === 0 ? [[]] : getCombinations(availableMen, neededMen);
  const womenCombos = neededWomen === 0 ? [[]] : getCombinations(availableWomen, neededWomen);

  const pinnedMenAge = pinnedMen.reduce((sum, r) => sum + (parseFloat(r.age) || 0), 0);
  const pinnedMenScore = pinnedMen.reduce((sum, r) => sum + getRankTime(r, 'finFree'), 0);
  const pinnedWomenAge = pinnedWomen.reduce((sum, r) => sum + (parseFloat(r.age) || 0), 0);
  const pinnedWomenScore = pinnedWomen.reduce((sum, r) => sum + getRankTime(r, 'finFree'), 0);

  let bestScore = Infinity;
  let bestAge = 0;
  let bestMenGroup = null;
  let bestWomenGroup = null;
  let maxAgeFound = 0;

  for (const mSub of menCombos) {
    const mAge = pinnedMenAge + mSub.reduce((sum, r) => sum + parseFloat(r.age), 0);
    const mScore = pinnedMenScore + mSub.reduce((sum, r) => sum + getRankTime(r, 'finFree'), 0);

    for (const wSub of womenCombos) {
      const wAge = pinnedWomenAge + wSub.reduce((sum, r) => sum + parseFloat(r.age), 0);
      const totalAge = mAge + wAge;
      if (totalAge > maxAgeFound) maxAgeFound = totalAge;

      if (totalAge >= 240) {
        const wScore = pinnedWomenScore + wSub.reduce((sum, r) => sum + getRankTime(r, 'finFree'), 0);
        const totalScore = mScore + wScore;

        if (totalScore < bestScore) {
          bestScore = totalScore;
          bestAge = totalAge;
          bestMenGroup = mSub;
          bestWomenGroup = wSub;
        }
      }
    }
  }

  if (bestMenGroup && bestWomenGroup) {
    const allMembers = [
      ...pinnedMen.map(r => {
        const t = parseFloat(r.finFree);
        const valid = !isNaN(t) && t > 0;
        return { id: r.id, strokeField: 'finFree', strokeName: '핀자유', name: r.name, age: parseFloat(r.age) || 0, time: valid ? t : 0, hasTime: valid, gender: '남', isPinned: true };
      }),
      ...bestMenGroup.map(r => {
        const t = parseFloat(r.finFree) || parseFloat(r.free);
        const valid = !isNaN(t) && t > 0;
        return { id: r.id, strokeField: 'finFree', strokeName: '핀자유', name: r.name, age: parseFloat(r.age) || 0, time: valid ? t : 0, hasTime: valid, gender: '남', isPinned: false };
      }),
      ...pinnedWomen.map(r => {
        const t = parseFloat(r.finFree);
        const valid = !isNaN(t) && t > 0;
        return { id: r.id, strokeField: 'finFree', strokeName: '핀자유', name: r.name, age: parseFloat(r.age) || 0, time: valid ? t : 0, hasTime: valid, gender: '여', isPinned: true };
      }),
      ...bestWomenGroup.map(r => {
        const t = parseFloat(r.finFree) || parseFloat(r.free);
        const valid = !isNaN(t) && t > 0;
        return { id: r.id, strokeField: 'finFree', strokeName: '핀자유', name: r.name, age: parseFloat(r.age) || 0, time: valid ? t : 0, hasTime: valid, gender: '여', isPinned: false };
      })
    ];

    let actualTotalTime = 0;
    let hasMissingTime = false;
    let validCount = 0;
    allMembers.forEach(m => {
      if (m.hasTime) {
        actualTotalTime += m.time;
        validCount++;
      } else {
        hasMissingTime = true;
      }
    });

    return {
      status: 'SUCCESS',
      totalTime: actualTotalTime,
      hasMissingTime,
      validCount,
      totalMembers: 6,
      totalAge: bestAge,
      minAge: 240,
      pinnedCount: pinnedMen.length + pinnedWomen.length,
      members: allMembers
    };
  } else {
    return {
      status: 'AGE_NOT_MET',
      message: `나이 부족: 고정 선수 포함 도합 240세 이상 조합 없음 (최대 ${maxAgeFound}세)`
    };
  }
}

// 2 & 3. 자유형 계영 200m (4명, 도합 >= 160세)
function computeFreestyleRelay(gender, team = 'A', records, pinnedList = [], excludeSwimmerNames = new Set()) {
  const teamRecords = records.filter(r => (r.team || 'A') === team && !excludeSwimmerNames.has(r.name));

  const pinnedSwimmers = [];
  pinnedList.forEach(name => {
    const s = teamRecords.find(r => r.name === name) || records.find(r => r.name === name);
    if (s && s.gender === gender) pinnedSwimmers.push(s);
  });

  const needed = 4 - pinnedSwimmers.length;
  if (needed < 0) return { status: 'ERROR', message: '고정 인원이 4명을 초과했습니다.' };

  const pinnedNames = new Set(pinnedSwimmers.map(s => s.name));
  const available = teamRecords.filter(r => r.gender === gender && parseFloat(r.age) > 0 && !pinnedNames.has(r.name));

  if (available.length < needed) {
    return { status: 'NOT_ENOUGH', message: `자유형 인원 부족 (${gender} 필요: ${needed}, 후보: ${available.length})` };
  }

  const combos = needed === 0 ? [[]] : getCombinations(available, needed);
  const pinnedAge = pinnedSwimmers.reduce((sum, r) => sum + (parseFloat(r.age) || 0), 0);
  const pinnedScore = pinnedSwimmers.reduce((sum, r) => sum + getRankTime(r, 'free'), 0);

  let bestScore = Infinity;
  let bestAge = 0;
  let bestAutoGroup = null;
  let maxAgeFound = 0;

  for (const sub of combos) {
    const subAge = sub.reduce((sum, r) => sum + parseFloat(r.age), 0);
    const totalAge = pinnedAge + subAge;
    if (totalAge > maxAgeFound) maxAgeFound = totalAge;

    if (totalAge >= 160) {
      const subScore = sub.reduce((sum, r) => sum + getRankTime(r, 'free'), 0);
      const totalScore = pinnedScore + subScore;

      if (totalScore < bestScore) {
        bestScore = totalScore;
        bestAge = totalAge;
        bestAutoGroup = sub;
      }
    }
  }

  if (bestAutoGroup) {
    const allMembers = [
      ...pinnedSwimmers.map(r => {
        const t = parseFloat(r.free);
        const valid = !isNaN(t) && t > 0;
        return { id: r.id, strokeField: 'free', strokeName: '자유형', name: r.name, age: parseFloat(r.age) || 0, time: valid ? t : 0, hasTime: valid, gender: r.gender, isPinned: true };
      }),
      ...bestAutoGroup.map(r => {
        const t = parseFloat(r.free);
        const valid = !isNaN(t) && t > 0;
        return { id: r.id, strokeField: 'free', strokeName: '자유형', name: r.name, age: parseFloat(r.age) || 0, time: valid ? t : 0, hasTime: valid, gender: r.gender, isPinned: false };
      })
    ];

    let actualTotalTime = 0;
    let hasMissingTime = false;
    let validCount = 0;
    allMembers.forEach(m => {
      if (m.hasTime) {
        actualTotalTime += m.time;
        validCount++;
      } else {
        hasMissingTime = true;
      }
    });

    return {
      status: 'SUCCESS',
      totalTime: actualTotalTime,
      hasMissingTime,
      validCount,
      totalMembers: 4,
      totalAge: bestAge,
      minAge: 160,
      pinnedCount: pinnedSwimmers.length,
      members: allMembers
    };
  } else {
    return {
      status: 'AGE_NOT_MET',
      message: `나이 부족: 고정 선수 포함 도합 160세 이상 조합 없음 (최대 ${maxAgeFound}세)`
    };
  }
}

// 4 & 5. 혼계영 200m (배영, 평영, 접영, 자유형 각 1명, 4명 고유, 도합 >= 160세)
function computeMedleyRelay(gender, team = 'A', records, pinnedMap = {}, excludeSwimmerNames = new Set()) {
  const teamRecords = records.filter(r => (r.team || 'A') === team && !excludeSwimmerNames.has(r.name));
  const pool = teamRecords.filter(r => r.gender === gender && parseFloat(r.age) > 0);

  const strokes = ['back', 'breast', 'fly', 'free'];

  // Identify pinned swimmers
  const pinnedMembers = {};
  const pinnedNames = new Set();
  strokes.forEach(st => {
    const name = pinnedMap[st];
    if (name) {
      const s = teamRecords.find(r => r.name === name) || records.find(r => r.name === name);
      if (s) {
        pinnedMembers[st] = s;
        pinnedNames.add(s.name);
      }
    }
  });

  // Candidate lists per stroke
  const candidates = {};
  strokes.forEach(st => {
    if (pinnedMembers[st]) {
      candidates[st] = [pinnedMembers[st]];
    } else {
      candidates[st] = pool.filter(r => !pinnedNames.has(r.name));
    }
  });

  let bestScore = Infinity;
  let bestAge = 0;
  let bestAssignment = null;
  let maxAgeFound = 0;

  for (const sBack of candidates.back) {
    const ageBack = parseFloat(sBack.age) || 0;
    const scoreBack = getRankTime(sBack, 'back');

    for (const sBreast of candidates.breast) {
      if (sBreast.name === sBack.name) continue;
      const ageBreast = parseFloat(sBreast.age) || 0;
      const scoreBreast = getRankTime(sBreast, 'breast');

      for (const sFly of candidates.fly) {
        if (sFly.name === sBack.name || sFly.name === sBreast.name) continue;
        const ageFly = parseFloat(sFly.age) || 0;
        const scoreFly = getRankTime(sFly, 'fly');

        for (const sFree of candidates.free) {
          if (sFree.name === sBack.name || sFree.name === sBreast.name || sFree.name === sFly.name) continue;
          const ageFree = parseFloat(sFree.age) || 0;
          const scoreFree = getRankTime(sFree, 'free');

          const totalAge = ageBack + ageBreast + ageFly + ageFree;
          if (totalAge > maxAgeFound) maxAgeFound = totalAge;

          if (totalAge >= 160) {
            const totalScore = scoreBack + scoreBreast + scoreFly + scoreFree;
            if (totalScore < bestScore) {
              bestScore = totalScore;
              bestAge = totalAge;
              bestAssignment = [
                { id: sBack.id, strokeField: 'back', strokeName: '배영', name: sBack.name, age: ageBack, time: parseFloat(sBack.back) || 0, hasTime: !isNaN(parseFloat(sBack.back)) && parseFloat(sBack.back) > 0, gender: sBack.gender, isPinned: !!pinnedMembers.back },
                { id: sBreast.id, strokeField: 'breast', strokeName: '평영', name: sBreast.name, age: ageBreast, time: parseFloat(sBreast.breast) || 0, hasTime: !isNaN(parseFloat(sBreast.breast)) && parseFloat(sBreast.breast) > 0, gender: sBreast.gender, isPinned: !!pinnedMembers.breast },
                { id: sFly.id, strokeField: 'fly', strokeName: '접영', name: sFly.name, age: ageFly, time: parseFloat(sFly.fly) || 0, hasTime: !isNaN(parseFloat(sFly.fly)) && parseFloat(sFly.fly) > 0, gender: sFly.gender, isPinned: !!pinnedMembers.fly },
                { id: sFree.id, strokeField: 'free', strokeName: '자유형', name: sFree.name, age: ageFree, time: parseFloat(sFree.free) || 0, hasTime: !isNaN(parseFloat(sFree.free)) && parseFloat(sFree.free) > 0, gender: sFree.gender, isPinned: !!pinnedMembers.free }
              ];
            }
          }
        }
      }
    }
  }

  if (bestAssignment) {
    let actualTotalTime = 0;
    let hasMissingTime = false;
    let validCount = 0;
    bestAssignment.forEach(m => {
      if (m.hasTime) {
        actualTotalTime += m.time;
        validCount++;
      } else {
        hasMissingTime = true;
      }
    });

    return {
      status: 'SUCCESS',
      totalTime: actualTotalTime,
      hasMissingTime,
      validCount,
      totalMembers: 4,
      totalAge: bestAge,
      minAge: 160,
      pinnedCount: Object.keys(pinnedMembers).length,
      members: bestAssignment
    };
  } else {
    return {
      status: 'AGE_NOT_MET',
      message: `나이 부족: 고정 선수 포함 도합 160세 이상 조합 없음 (최대 ${maxAgeFound}세)`
    };
  }
}

// Compute Optimal Relay Combinations (5 Combinations) for a given team
function calculateRelayCombinations(team = 'A') {
  const teamPins = pinnedRelaysState[team] || {};

  // Helper: In scenario mode, collect pinned swimmers from other relays to exclude
  const getExcludeSwimmerNames = (currentKey) => {
    const exclude = new Set();
    if (isScenarioMode && pinnedRelaysState[team]) {
      for (const [key, pins] of Object.entries(pinnedRelaysState[team])) {
        if (key !== currentKey && pins) {
          if (Array.isArray(pins)) {
            pins.forEach(n => exclude.add(n));
          } else if (typeof pins === 'object') {
            Object.values(pins).forEach(n => { if (n) exclude.add(n); });
          }
        }
      }
    }
    return exclude;
  };

  return {
    combo1: computeFinRelay(team, records, teamPins.combo1 || [], getExcludeSwimmerNames('combo1')),
    combo2: computeFreestyleRelay('남', team, records, teamPins.combo2 || [], getExcludeSwimmerNames('combo2')),
    combo3: computeFreestyleRelay('여', team, records, teamPins.combo3 || [], getExcludeSwimmerNames('combo3')),
    combo4: computeMedleyRelay('남', team, records, teamPins.combo4 || {}, getExcludeSwimmerNames('combo4')),
    combo5: computeMedleyRelay('여', team, records, teamPins.combo5 || {}, getExcludeSwimmerNames('combo5'))
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

// Update Top Dashboard Combination Panels for both A and B teams
function updateStats() {
  const combosA = calculateRelayCombinations('A');
  const combosB = calculateRelayCombinations('B');

  ['combo1', 'combo2', 'combo3', 'combo4', 'combo5'].forEach((prefix, idx) => {
    const isMedley = idx >= 3;
    renderComboCardTeam(prefix, 'A', combosA[prefix], isMedley);
    renderComboCardTeam(prefix, 'B', combosB[prefix], isMedley);
  });
}

function renderComboCardTeam(prefix, team, result, isMedley = false) {
  const timeEl = document.getElementById(`${prefix}${team}Time`);
  const ageEl = document.getElementById(`${prefix}${team}Age`);
  const membersEl = document.getElementById(`${prefix}${team}Members`);
  const blockEl = document.getElementById(`${prefix}${team}Block`);
  const lockBtn = document.querySelector(`.btn-lock-combo-team[data-combo="${prefix}"][data-team="${team}"]`);

  if (!timeEl || !ageEl || !membersEl) return;

  const pinnedCount = result ? (result.pinnedCount || 0) : 0;
  const isAnyPinned = pinnedCount > 0;

  if (blockEl) {
    blockEl.classList.toggle('is-fixed-block', isAnyPinned);
  }

  if (lockBtn) {
    if (isAnyPinned) {
      lockBtn.classList.add('is-fixed');
      lockBtn.innerHTML = `<span class="lock-icon">📌</span><span class="lock-label">${pinnedCount}명 고정</span>`;
      lockBtn.title = `${team}팀 ${pinnedCount}명 고정됨 (클릭 시 모든 고정 해제)`;
    } else {
      lockBtn.classList.remove('is-fixed');
      lockBtn.innerHTML = '<span class="lock-icon">⚡</span><span class="lock-label">자동 추천</span>';
      lockBtn.title = `${team}팀 자동 추천 모드 (클릭 시 현재 선발 전체 고정)`;
    }
  }

  if (!result || result.status !== 'SUCCESS') {
    timeEl.textContent = '-';
    timeEl.classList.remove('time-highlight');
    ageEl.textContent = '-';
    membersEl.innerHTML = `<span class="combo-empty-msg">${result ? result.message : '기록 부족'}</span>`;
    return;
  }

  // Time display
  if (result.hasMissingTime) {
    if (result.validCount > 0) {
      timeEl.textContent = `${formatRelayTime(result.totalTime)} (${result.validCount}/${result.totalMembers}명)`;
      timeEl.classList.add('time-highlight');
    } else {
      timeEl.textContent = '기록 미입력';
      timeEl.classList.remove('time-highlight');
    }
  } else {
    timeEl.textContent = formatRelayTime(result.totalTime);
    timeEl.classList.add('time-highlight');
  }

  const ageOk = result.totalAge >= (result.minAge || 160);
  ageEl.textContent = `${result.totalAge}세 ${ageOk ? '✅' : '⚠️'}`;
  ageEl.title = `최소 기준: ${result.minAge || 160}세 이상 (현재: ${result.totalAge}세)`;

  if (!result.members || result.members.length === 0) {
    membersEl.innerHTML = `<span class="combo-empty-msg">선발 인원 없음</span>`;
    return;
  }

  membersEl.innerHTML = result.members.map(m => {
    const orig = getLastYearRecord(m.id, m.strokeField);
    const isLastYear = orig !== '' && (parseFloat(orig) === m.time);
    const timeClass = isLastYear ? 'is-last-year' : 'is-target';
    const hasTime = m.hasTime !== undefined ? m.hasTime : (m.time > 0);

    const timeDisplayHtml = hasTime
      ? `<span class="member-time ${timeClass}">${m.time.toFixed(2)}s</span>`
      : `<span class="member-time is-empty" title="PB 기록 미입력">-</span>`;

    const pinBtnHtml = `
      <button 
        type="button" 
        class="btn-pin-member ${m.isPinned ? 'is-pinned' : ''}" 
        data-combo="${prefix}" 
        data-team="${team}" 
        data-name="${escapeHtml(m.name)}" 
        data-stroke="${m.strokeField || ''}" 
        title="${m.isPinned ? `${m.name} 선수 고정됨 (클릭 시 고정 해제)` : `${m.name} 선수 고정 (클릭 시 이 선수를 필수로 포함하여 최적 조합 계산)`}"
      >
        ${m.isPinned ? '📌' : '📍'}
      </button>
    `;

    return `
      <div class="member-pill ${m.isPinned ? 'is-pinned' : ''}">
        ${isMedley 
          ? `<span class="stroke-badge ${m.strokeName}">${m.strokeName}</span>` 
          : `<span class="member-gender ${m.gender === '남' ? 'male' : 'female'}">${m.gender}</span>`
        }
        <span>${escapeHtml(m.name || '무명')}</span>
        <span style="color:var(--text-subtle);font-size:11px;">(${m.age}세)</span>
        ${timeDisplayHtml}
        ${pinBtnHtml}
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
  // View Toggle Buttons (Synchronize both header and toolbar buttons)
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = btn.dataset.view;
      if (targetView) switchView(targetView);
    });
  });

  // Adult Team Sub Tabs (A팀 vs B팀)


  // Toolbar Filter & Mode Selects
  if (filterGenderSelect) {
    filterGenderSelect.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      renderTable();
    });
  }

  if (filterTeamSelect) {
    filterTeamSelect.addEventListener('change', (e) => {
      currentTeamFilter = e.target.value;
      if (e.target.value !== 'all') {
        currentAdultTeam = e.target.value;
        localStorage.setItem(ADULT_TEAM_KEY, e.target.value);
      }
      renderAll();
    });
  }

  if (filterGroupSelect) {
    filterGroupSelect.addEventListener('change', (e) => {
      currentGroupFilter = e.target.value;
      renderTable();
    });
  }

  if (recordsModeSelect) {
    recordsModeSelect.addEventListener('change', (e) => {
      applyRecordsViewMode(e.target.value);
      localStorage.setItem(RECORDS_MODE_KEY, e.target.value);
      showToast(e.target.value === 'detailed' ? '📋 단체전 자세히 보기 모드로 전환되었습니다.' : '📋 단체전 간단히 보기 모드로 전환되었습니다.');
    });
  }



  // Events Table Dropdown Change & Click Delegation
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

    // Team toggle button & Jump to PB delegation
    eventsTableBody.addEventListener('click', (e) => {
      const teamBtn = e.target.closest('[data-team-id]');
      if (teamBtn) {
        const id = parseInt(teamBtn.dataset.teamId, 10);
        const record = records.find(r => r.id === id);
        if (!record) return;

        const currentTeam = record.team || 'A';
        const targetTeam = currentTeam === 'A' ? 'B' : 'A';

        const ok = confirm(`'${record.name}' 선수의 소속팀을 [${targetTeam}팀]으로 변경하시겠습니까?`);
        if (!ok) return;

        const prevTeam = currentTeam;
        record.team = targetTeam;

        // Log to server history
        logChangeHistory('INFO', record.name, 'team', '소속팀', `${prevTeam}팀`, `${targetTeam}팀`);

        saveData();
        renderAll();
        showToast(`'${record.name}' 선수가 [${targetTeam}팀]으로 변경되었습니다.`);
        return;
      }

      const jumpBtn = e.target.closest('[data-jump-id]');
      if (jumpBtn) {
        const id = parseInt(jumpBtn.dataset.jumpId, 10);
        jumpToSwimmerPB(id);
      }
    });
  }

  // Events Toolbar Filters
  if (eventsSearchInput) {
    eventsSearchInput.addEventListener('input', (e) => {
      eventsSearchQuery = e.target.value;
      renderEventsTable();
    });
  }

  if (eventsGenderSelect) {
    eventsGenderSelect.addEventListener('change', (e) => {
      eventsGenderFilter = e.target.value;
      renderEventsTable();
    });
  }

  if (eventsTeamSelect) {
    eventsTeamSelect.addEventListener('change', (e) => {
      eventsTeamFilter = e.target.value;
      renderEventsTable();
    });
  }

  if (eventsGroupSelect) {
    eventsGroupSelect.addEventListener('change', (e) => {
      eventsGroupFilter = e.target.value;
      renderEventsTable();
    });
  }

  if (eventsModeSelect) {
    eventsModeSelect.addEventListener('change', (e) => {
      applyEventsViewMode(e.target.value);
      localStorage.setItem(EVENTS_MODE_KEY, e.target.value);
      showToast(e.target.value === 'detailed' ? '📋 개인전 자세히 보기 모드로 전환되었습니다.' : '📋 개인전 간단히 보기 모드로 전환되었습니다.');
    });
  }

  // Copy events list to clipboard button
  const btnCopyEvents = document.getElementById('btnCopyEventsTsv');
  if (btnCopyEvents) {
    btnCopyEvents.addEventListener('click', copyEventsToClipboard);
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

  // Table click events (Team toggle, Gender toggle, Delete button)
  tableBody.addEventListener('click', (e) => {
    const teamBtn = e.target.closest('[data-team-id]');
    if (teamBtn) {
      if (!canEditRecords()) {
        showToast('⏳ 수정 가능 기간이 종료되었습니다. (관리자만 수정 가능)');
        return;
      }
      const id = parseInt(teamBtn.dataset.teamId, 10);
      const record = records.find(r => r.id === id);
      if (!record) return;

      const currentTeam = record.team || 'A';
      const targetTeam = currentTeam === 'A' ? 'B' : 'A';

      const ok = confirm(`'${record.name}' 선수의 소속팀을 [${targetTeam}팀]으로 변경하시겠습니까?`);
      if (!ok) return;

      const prevTeam = currentTeam;
      record.team = targetTeam;

      // Log to server history
      logChangeHistory('INFO', record.name, 'team', '소속팀', `${prevTeam}팀`, `${targetTeam}팀`);

      saveData();
      renderAll();
      showToast(`'${record.name}' 선수가 [${targetTeam}팀]으로 변경되었습니다.`);
      return;
    }

    const genderBadge = e.target.closest('.gender-badge');
    if (genderBadge) {
      if (!canEditRecords()) {
        showToast('⏳ 수정 가능 기간이 종료되었습니다. (관리자만 수정 가능)');
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
      if (!canEditRecords()) {
        showToast('⏳ 수정 가능 기간이 종료되었습니다. (관리자만 삭제 가능)');
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
  tableBody.addEventListener('paste', (e) => {
    if (!canEditRecords()) {
      showToast('⏳ 수정 가능 기간이 종료되었습니다. (관리자만 수정 가능)');
      return;
    }
    handleTablePaste(e);
  });

  // Search input in PB table
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTable();
  });

  // Add Row Button (If element exists)
  if (btnAddRow) {
    btnAddRow.addEventListener('click', () => {
      if (!canEditRecords()) {
        showToast('⏳ 수정 가능 기간이 종료되었습니다. (관리자만 추가 가능)');
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
        team: currentAdultTeam || 'A',
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

  // Individual Member Pin Click & Team Lock Toggle (Delegated on comboGrid)
  if (comboGrid) {
    comboGrid.addEventListener('click', (e) => {
      const pinBtn = e.target.closest('.btn-pin-member');
      if (pinBtn) {
        e.stopPropagation();
        if (!isAdmin()) {
          showToast('🔒 관리자 로그인 후 선발 고정을 변경할 수 있습니다.');
          return;
        }
        const comboKey = pinBtn.dataset.combo;
        const team = pinBtn.dataset.team || 'A';
        const name = pinBtn.dataset.name;
        const stroke = pinBtn.dataset.stroke;
        toggleMemberPin(comboKey, team, name, stroke);
        return;
      }

      const lockBtn = e.target.closest('.btn-lock-combo-team');
      if (lockBtn) {
        e.stopPropagation();
        if (!isAdmin()) {
          showToast('🔒 관리자 로그인 후 선발 고정을 변경할 수 있습니다.');
          return;
        }
        const comboKey = lockBtn.dataset.combo;
        const team = lockBtn.dataset.team || 'A';
        toggleTeamRelayAllPins(comboKey, team);
        return;
      }
    });
  }

  // Combo Team Roster Copy Buttons
  document.querySelectorAll('.btn-copy-combo-team').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAdmin()) {
        showToast('🔒 관리자 로그인 후 명단 복사가 가능합니다.');
        return;
      }
      const comboKey = btn.dataset.combo;
      const team = btn.dataset.team || 'A';
      copyComboTeamToClipboard(comboKey, team);
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
  const headers = ['번호', '그룹', '성별', '이름', '생년월일', '출전 종목 1', '출전 종목 2', '나이', '핀접영', '핀자유', '자유형', '배영', '평영', '접영'];
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
