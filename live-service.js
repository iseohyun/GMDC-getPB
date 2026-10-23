// ==========================================================================
// GMDC Swim Club - Real-time Competition Live Service & Estimation Engine
// 누구나 조작 가능한 대회 당일 실시간 경기 순서 및 예상 시작 시간 추론 시스템
// ==========================================================================

import { firebaseApp } from "./firebase-config.js?v=20261023_03";
import { 
  getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ADULT_RACES_DATA, STUDENT_RACES_DATA } from "./races-data.js?v=20261023_03";

const db = getFirestore(firebaseApp);

export const LIVE_COL_NAME = "competition_live_status";

/**
 * 기본 상태 객체 팩토리
 */
export function getDefaultLiveStatus(division = 'adult') {
  return {
    division, // 'adult' | 'student'
    status: 'ready', // 'ready' | 'running' | 'paused' | 'finished'
    current_race_index: 0, // 0: 시작 전, 1: 1조 진행 중...
    started_at: null, // ISO 문자열 또는 hh:mm:ss
    current_race_started_at: null,
    is_paused: false,
    pause_started_at: null,
    total_paused_sec: 0,
    history: [], // [{ race_index: 1, started_at: '08:30:15', duration_sec: 72 }, ...]
    updated_at: new Date().toISOString(),
    updated_by: '현장 운영'
  };
}

/**
 * 현재 시간을 "HH:mm:ss" 형식으로 반환
 */
export function getCurrentTimeStr(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * "HH:mm:ss" 또는 ISO 문자열을 Date 객체로 파싱 (오늘 날짜 기준)
 */
export function parseTimeToDate(timeStr) {
  if (!timeStr) return null;
  if (timeStr.includes('T')) {
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? null : d;
  }
  const parts = timeStr.split(':').map(Number);
  if (parts.length >= 2) {
    const d = new Date();
    d.setHours(parts[0], parts[1], parts[2] || 0, 0);
    return d;
  }
  return null;
}

/**
 * Date 객체를 "HH:mm" 또는 "HH:mm:ss"로 포맷
 */
export function formatTimeHM(date, includeSeconds = false) {
  if (!date) return '-';
  const pad = n => String(n).padStart(2, '0');
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  if (includeSeconds) {
    return `${h}:${m}:${pad(date.getSeconds())}`;
  }
  return `${h}:${m}`;
}

/**
 * 초 단위 숫자를 "M분 S초" 또는 "HH:MM:SS"로 포맷
 */
export function formatDuration(sec) {
  if (!sec || sec < 0) sec = 0;
  sec = Math.round(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}

/**
 * 실시간 상태 리스너 구독
 * @param {string} division 'adult' | 'student'
 * @param {function} callback (status) => void
 * @returns {function} unsubscribe
 */
export function subscribeLiveStatus(division, callback) {
  const docRef = doc(db, LIVE_COL_NAME, `${division}_2026`);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    } else {
      const defaultState = getDefaultLiveStatus(division);
      callback(defaultState);
    }
  }, (err) => {
    console.warn(`[LiveStatus] Snapshot warning (${division}):`, err);
  });
}

/**
 * Firestore에서 1회 상태 조회 (폴링용)
 */
export async function fetchLiveStatus(division) {
  try {
    const docRef = doc(db, LIVE_COL_NAME, `${division}_2026`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn("[LiveStatus] fetchLiveStatus error:", err);
  }
  return getDefaultLiveStatus(division);
}

/**
 * Firestore에 상태 저장
 */
export async function saveLiveStatus(division, newStatus) {
  const docRef = doc(db, LIVE_COL_NAME, `${division}_2026`);
  const payload = {
    ...newStatus,
    updated_at: new Date().toISOString()
  };
  await setDoc(docRef, payload, { merge: true });
}

// ──────────────────────────────────────────────────────────────────────────
// 🚀 대회 현장 조작 함수들 (누구나 조작 가능)
// ──────────────────────────────────────────────────────────────────────────

/**
 * 대회 시작 (1조 출발)
 */
export async function startCompetition(division) {
  const races = division === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;
  const now = new Date();
  const nowStr = now.toISOString();

  const newStatus = {
    division,
    status: 'running',
    current_race_index: 1,
    started_at: nowStr,
    current_race_started_at: nowStr,
    is_paused: false,
    pause_started_at: null,
    total_paused_sec: 0,
    history: [],
    updated_at: nowStr,
    updated_by: '현장 운영자'
  };

  await saveLiveStatus(division, newStatus);
  return newStatus;
}

/**
 * 다음 조 시작 (Next Race)
 */
export async function nextRace(division) {
  const current = await fetchLiveStatus(division);
  const races = division === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;
  const now = new Date();
  const nowStr = now.toISOString();

  // 아직 시작 안 했으면 시작 처리
  if (current.status === 'ready' || current.current_race_index === 0) {
    return await startCompetition(division);
  }

  // 이전 조 소요 시간 계산
  let prevDuration = 75; // 기본 75초
  if (current.current_race_started_at) {
    const prevStart = new Date(current.current_race_started_at);
    prevDuration = Math.max(15, Math.round((now - prevStart) / 1000));
  }

  const prevHistoryItem = {
    race_index: current.current_race_index,
    started_at: current.current_race_started_at,
    finished_at: nowStr,
    duration_sec: prevDuration
  };

  const nextIndex = current.current_race_index + 1;
  const isFinished = nextIndex > races.length;

  const newStatus = {
    ...current,
    status: isFinished ? 'finished' : 'running',
    current_race_index: isFinished ? races.length : nextIndex,
    current_race_started_at: isFinished ? null : nowStr,
    is_paused: false,
    pause_started_at: null,
    history: [...(current.history || []), prevHistoryItem],
    updated_at: nowStr
  };

  await saveLiveStatus(division, newStatus);
  return newStatus;
}

/**
 * 휴게 시작 / 종료 토글 (Pause Toggle)
 */
export async function togglePause(division) {
  const current = await fetchLiveStatus(division);
  const now = new Date();
  const nowStr = now.toISOString();

  if (!current.is_paused) {
    // 휴게 시작
    const newStatus = {
      ...current,
      status: 'paused',
      is_paused: true,
      pause_started_at: nowStr,
      updated_at: nowStr
    };
    await saveLiveStatus(division, newStatus);
    return newStatus;
  } else {
    // 휴게 종료
    let pauseDuration = 0;
    if (current.pause_started_at) {
      const pStart = new Date(current.pause_started_at);
      pauseDuration = Math.max(0, Math.round((now - pStart) / 1000));
    }
    const newStatus = {
      ...current,
      status: 'running',
      is_paused: false,
      pause_started_at: null,
      total_paused_sec: (current.total_paused_sec || 0) + pauseDuration,
      updated_at: nowStr
    };
    await saveLiveStatus(division, newStatus);
    return newStatus;
  }
}

/**
 * 직전 조작 취소 (Undo / 이전 조로 되돌리기)
 */
export async function undoLastAction(division) {
  const current = await fetchLiveStatus(division);
  const history = current.history || [];

  if (history.length === 0) {
    // 되돌릴 히스토리가 없음 -> 1조 시작 전(ready)으로 초기화
    const reset = getDefaultLiveStatus(division);
    await saveLiveStatus(division, reset);
    return reset;
  }

  const lastItem = history[history.length - 1];
  const newHistory = history.slice(0, -1);

  const newStatus = {
    ...current,
    status: 'running',
    current_race_index: lastItem.race_index,
    current_race_started_at: lastItem.started_at,
    is_paused: false,
    pause_started_at: null,
    history: newHistory,
    updated_at: new Date().toISOString()
  };

  await saveLiveStatus(division, newStatus);
  return newStatus;
}

/**
 * 특정 조 번호로 강제 점프 (Jump to Race)
 */
export async function jumpToRace(division, targetRaceIndex) {
  const current = await fetchLiveStatus(division);
  const races = division === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;
  const nowStr = new Date().toISOString();

  const validIndex = Math.max(1, Math.min(races.length, targetRaceIndex));

  const newStatus = {
    ...current,
    status: 'running',
    current_race_index: validIndex,
    current_race_started_at: nowStr,
    is_paused: false,
    pause_started_at: null,
    updated_at: nowStr
  };

  await saveLiveStatus(division, newStatus);
  return newStatus;
}

/**
 * 대회 완전 초기화 (Reset)
 */
export async function resetCompetition(division) {
  const def = getDefaultLiveStatus(division);
  await saveLiveStatus(division, def);
  return def;
}

// ──────────────────────────────────────────────────────────────────────────
// 🧠 실시간 시간 추론 엔진 (Pace-Adaptive Real-time Estimation)
// ──────────────────────────────────────────────────────────────────────────

/**
 * 대진표 레이스 배열과 현재 진행 상태를 기반으로,
 * 모든 조의 실제 시작 시각 및 미래 예상 시작 시각을 계산하여 반환
 * 
 * @param {Array} races 전체 레이스 배열 (141개 or 232개)
 * @param {Object} status 현재 live_status 객체
 * @param {Date} referenceTime 기준 시간 (기본값: 현재 시간)
 * @returns {Array} 계산된 레이스 상세 배열
 */
export function calculateScheduleEstimates(races, status, referenceTime = new Date()) {
  const currentIndex = status.current_race_index || 0;
  const isStarted = status.status === 'running' || status.status === 'paused' || status.status === 'finished';
  const history = status.history || [];

  // 1. 히스토리 매핑: race_index -> history item
  const historyMap = new Map();
  for (const h of history) {
    historyMap.set(h.race_index, h);
  }

  // 2. 동적 속도 계수(Pace Factor) 계산 (최근 5개 완료 조 기준)
  let paceFactor = 1.0;
  if (history.length > 0) {
    const recentHistory = history.slice(-5);
    let actualSum = 0;
    let baseSum = 0;

    for (const h of recentHistory) {
      actualSum += h.duration_sec;
      const race = races[h.race_index - 1];
      baseSum += (race ? race.base_duration_sec : 75);
    }

    if (baseSum > 0 && actualSum > 0) {
      paceFactor = actualSum / baseSum;
      // 극단적 이상치 완충 (0.6x ~ 2.0x)
      paceFactor = Math.min(2.0, Math.max(0.6, paceFactor));
    }
  }

  // 3. 현재 휴게 중인지 확인 및 추가 대기 시간
  let currentPauseSec = 0;
  if (status.is_paused && status.pause_started_at) {
    const pStart = new Date(status.pause_started_at);
    currentPauseSec = Math.max(0, Math.round((referenceTime - pStart) / 1000));
  }

  // 4. 각 레이스별 상태 및 시각 계산
  const result = [];
  let cumulativeTime = referenceTime ? new Date(referenceTime.getTime()) : new Date();

  // 만약 현재 조가 진행 중이면, 현재 조가 시작된 후 경과된 시간 계산
  let currentRaceElapsed = 0;
  let currentRaceRemaining = 0;
  if (isStarted && currentIndex > 0 && currentIndex <= races.length && status.current_race_started_at) {
    const curStart = new Date(status.current_race_started_at);
    currentRaceElapsed = Math.max(0, Math.round((referenceTime - curStart) / 1000));
    const currentBase = races[currentIndex - 1].base_duration_sec * paceFactor;
    currentRaceRemaining = Math.max(10, Math.round(currentBase - currentRaceElapsed));
  }

  // 미래 예상 누적 시각 초기화
  let futureAccumDate = new Date(referenceTime.getTime());
  if (currentRaceRemaining > 0) {
    futureAccumDate.setSeconds(futureAccumDate.getSeconds() + currentRaceRemaining);
  }
  if (status.is_paused) {
    // 휴게 중이면 휴게 대기시간 가산
    futureAccumDate.setSeconds(futureAccumDate.getSeconds() + 60); // 최소 1분 대기 추정
  }

  for (let i = 0; i < races.length; i++) {
    const race = races[i];
    const raceIdx = race.race_index; // 1-based

    if (!isStarted || currentIndex === 0) {
      // 대회 시작 전 (대기)
      result.push({
        ...race,
        state: 'waiting',
        actual_started_at: null,
        estimated_start_time: null,
        estimated_start_hm: '시작 대기',
        time_diff_text: '대기 중',
        is_current: false
      });
    } else if (raceIdx < currentIndex) {
      // 이미 완료된 조
      const h = historyMap.get(raceIdx);
      const startD = h && h.started_at ? new Date(h.started_at) : null;
      result.push({
        ...race,
        state: 'finished',
        actual_started_at: h ? h.started_at : null,
        estimated_start_time: startD,
        estimated_start_hm: startD ? formatTimeHM(startD, true) : '완료',
        time_diff_text: h ? `${formatDuration(h.duration_sec)} 소요` : '완료',
        is_current: false
      });
    } else if (raceIdx === currentIndex) {
      // 현재 진행 중인 조
      const startD = status.current_race_started_at ? new Date(status.current_race_started_at) : referenceTime;
      result.push({
        ...race,
        state: status.is_paused ? 'paused' : 'running',
        actual_started_at: status.current_race_started_at,
        estimated_start_time: startD,
        estimated_start_hm: formatTimeHM(startD, true) + ' 출발',
        elapsed_sec: currentRaceElapsed,
        time_diff_text: status.is_paused ? `☕ 휴게 중 (${formatDuration(currentPauseSec)})` : `🏊 진행 중 (${formatDuration(currentRaceElapsed)} 경과)`,
        is_current: true
      });
    } else {
      // 미래 대기 중인 조 (추론 계산)
      const thisEstimatedStart = new Date(futureAccumDate.getTime());
      const diffMin = Math.round((thisEstimatedStart - referenceTime) / 60000);
      const diffText = diffMin <= 0 ? '곧 시작' : `약 ${diffMin}분 후`;

      result.push({
        ...race,
        state: 'waiting',
        actual_started_at: null,
        estimated_start_time: thisEstimatedStart,
        estimated_start_hm: formatTimeHM(thisEstimatedStart),
        time_diff_text: diffText,
        is_current: false
      });

      // 다음 조를 위해 이 조의 예상 소요시간을 누적
      const thisBaseDuration = (race.base_duration_sec || 75) * paceFactor;
      futureAccumDate.setSeconds(futureAccumDate.getSeconds() + Math.round(thisBaseDuration));
    }
  }

  return {
    races: result,
    currentIndex,
    paceFactor,
    isPaused: status.is_paused,
    currentPauseSec,
    currentRaceElapsed
  };
}
