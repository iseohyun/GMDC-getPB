// ==========================================================================
// GMDC Swim Club - Real-time Competition Live Service & Estimation Engine
// 대회 당일 실시간 경기 순서, 시간 추론 및 명부(DB) 연동 서비스
// ==========================================================================

import { firebaseApp } from "./firebase-config.js?v=20261024_02";
import { 
  getFirestore, doc, getDoc, setDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ADULT_RACES_DATA, STUDENT_RACES_DATA } from "./races-data.js?v=20261024_02";

const db = getFirestore(firebaseApp);

// 배포된 Firestore 보안 규칙(match /attendance/{docId})과 즉시 호환되도록 attendance 컬렉션 내 전용 문서 사용
export const LIVE_COL_NAME = "attendance";

function getLiveDocId(division = 'adult') {
  return `live_status_${division}_2026`;
}

function getLocalCacheKey(division = 'adult') {
  return `gmdc_live_status_${division}_2026`;
}

function readLocalCache(division = 'adult') {
  try {
    const raw = localStorage.getItem(getLocalCacheKey(division));
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[LiveStatus] localStorage read warning:", e);
  }
  return null;
}

function writeLocalCache(division = 'adult', statusObj) {
  try {
    if (statusObj) {
      localStorage.setItem(getLocalCacheKey(division), JSON.stringify(statusObj));
    }
  } catch (e) {
    console.warn("[LiveStatus] localStorage write warning:", e);
  }
}

/**
 * 기본 상태 객체 팩토리
 */
export function getDefaultLiveStatus(division = 'adult') {
  return {
    division, // 'adult' | 'student'
    status: 'ready', // 'ready' | 'running' | 'paused' | 'finished'
    current_race_index: 0, // 0: 시작 전, 1: 1조 진행 중...
    started_at: null,
    current_race_started_at: null,
    is_paused: false,
    pause_started_at: null,
    total_paused_sec: 0,
    history: [], // [{ race_index: 1, started_at: ISO, finished_at: ISO, duration_sec: 72 }, ...]
    breaks: [],  // [{ id, after_race_index, started_at, finished_at, duration_sec, state: 'running'|'finished' }]
    updated_at: new Date().toISOString(),
    updated_by: '현장 운영'
  };
}

/**
 * 초 단위 숫자를 "mm:ss" 형식으로 포맷
 */
export function formatMMSS(sec) {
  if (!sec || sec < 0) sec = 0;
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 현재 시간을 "HH:mm:ss" 형식으로 반환
 */
export function getCurrentTimeStr(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
 * 초 단위 숫자를 "M분 S초"로 포맷
 */
export function formatDuration(sec) {
  if (!sec || sec < 0) sec = 0;
  sec = Math.round(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}

function pickNewerStatus(remoteData, localData) {
  if (!remoteData && !localData) return null;
  if (!remoteData) return localData;
  if (!localData) return remoteData;

  const remoteTime = remoteData.updated_at ? new Date(remoteData.updated_at).getTime() : 0;
  const localTime = localData.updated_at ? new Date(localData.updated_at).getTime() : 0;
  return localTime > remoteTime ? localData : remoteData;
}

/**
 * 실시간 상태 리스너 구독
 */
export function subscribeLiveStatus(division, callback) {
  const docRef = doc(db, LIVE_COL_NAME, getLiveDocId(division));
  return onSnapshot(docRef, (snap) => {
    const localData = readLocalCache(division);
    if (snap.exists()) {
      const merged = pickNewerStatus(snap.data(), localData);
      writeLocalCache(division, merged);
      callback(merged);
    } else {
      callback(localData || getDefaultLiveStatus(division));
    }
  }, (err) => {
    console.warn(`[LiveStatus] Snapshot warning (${division}):`, err);
    callback(readLocalCache(division) || getDefaultLiveStatus(division));
  });
}

/**
 * 명부(DB) 실시간 구독 (성인부: records_2026_01_01, 학생부: records_student_2026_01_01)
 */
export function subscribeRosterDoc(division, callback) {
  const docName = division === 'student' ? 'records_student_2026_01_01' : 'records_2026_01_01';
  const docRef = doc(db, 'gmdc_swim_club', docName);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    }
  }, (err) => {
    console.warn(`[RosterDoc] Snapshot warning (${division}):`, err);
  });
}

/**
 * Firestore에서 1회 상태 조회 (폴링/수동 새로고침용)
 */
export async function fetchLiveStatus(division) {
  const localData = readLocalCache(division);
  try {
    const docRef = doc(db, LIVE_COL_NAME, getLiveDocId(division));
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const merged = pickNewerStatus(snap.data(), localData);
      writeLocalCache(division, merged);
      return merged;
    }
  } catch (err) {
    console.warn("[LiveStatus] fetchLiveStatus error:", err);
  }
  return localData || getDefaultLiveStatus(division);
}

/**
 * Firestore 및 로컬 캐시에 상태 저장
 */
export async function saveLiveStatus(division, newStatus) {
  const payload = {
    ...newStatus,
    updated_at: new Date().toISOString()
  };
  writeLocalCache(division, payload);

  try {
    const docRef = doc(db, LIVE_COL_NAME, getLiveDocId(division));
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn("[LiveStatus] saveLiveStatus Firestore warning (local cache saved):", err);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 🚀 개별 경기 카드 [시작 아이콘] / [시작 취소 아이콘] 조작 함수
// ──────────────────────────────────────────────────────────────────────────

/**
 * 특정 경기 카드의 [시작 아이콘] 클릭 시 해당 조 시작 처리
 */
export async function startRaceAt(division, targetRaceIndex, fallbackStatus = null) {
  const fetched = await fetchLiveStatus(division);
  const current = pickNewerStatus(fetched, fallbackStatus) || getDefaultLiveStatus(division);
  const races = division === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;
  const validIndex = Math.max(1, Math.min(races.length, Number(targetRaceIndex)));
  const now = new Date();
  const nowStr = now.toISOString();

  let history = Array.isArray(current.history) ? [...current.history] : [];

  // 직전 진행 중이던 조가 있고, 그 다음/이후 조를 시작한 경우 직전 조 소요시간 기록
  if (current.status === 'running' && current.current_race_index > 0 && current.current_race_index < validIndex) {
    let prevDuration = 75;
    if (current.current_race_started_at) {
      const prevStart = new Date(current.current_race_started_at);
      prevDuration = Math.max(1, Math.round((now - prevStart) / 1000));
    }
    history = history.filter(h => h.race_index !== current.current_race_index);
    history.push({
      race_index: current.current_race_index,
      started_at: current.current_race_started_at || nowStr,
      finished_at: nowStr,
      duration_sec: prevDuration
    });
  }

  // targetRaceIndex 이후의 기존 히스토리는 정리
  history = history.filter(h => h.race_index < validIndex);

  // 진행 중이던 휴게가 있으면 종료 처리하고, validIndex 이후의 휴게는 정리
  let breaks = Array.isArray(current.breaks) ? [...current.breaks] : [];
  breaks = breaks
    .filter(b => b.after_race_index < validIndex)
    .map(b => {
      if (b.state === 'running') {
        const bStart = b.started_at ? new Date(b.started_at) : now;
        return {
          ...b,
          state: 'finished',
          finished_at: nowStr,
          duration_sec: Math.max(1, Math.round((now - bStart) / 1000))
        };
      }
      return b;
    });

  const newStatus = {
    ...current,
    division,
    status: 'running',
    current_race_index: validIndex,
    started_at: current.started_at || nowStr,
    current_race_started_at: nowStr,
    is_paused: false,
    pause_started_at: null,
    history,
    breaks,
    updated_at: nowStr
  };

  await saveLiveStatus(division, newStatus);
  return newStatus;
}

/**
 * 특정 경기 카드의 [시작 취소 아이콘] 클릭 시 해당 조 시작 취소 처리
 */
export async function cancelRaceAt(division, targetRaceIndex, fallbackStatus = null) {
  const fetched = await fetchLiveStatus(division);
  const current = pickNewerStatus(fetched, fallbackStatus) || getDefaultLiveStatus(division);
  const validIndex = Number(targetRaceIndex);
  const nowStr = new Date().toISOString();

  let history = Array.isArray(current.history) ? [...current.history] : [];
  let breaks = Array.isArray(current.breaks) ? [...current.breaks] : [];

  // 1조이거나 아직 시작 전이면 전체 대기 상태(ready)로 초기화
  if (validIndex <= 1 || current.current_race_index <= 1) {
    const resetState = {
      ...getDefaultLiveStatus(division),
      updated_at: nowStr
    };
    await saveLiveStatus(division, resetState);
    return resetState;
  }

  // 취소한 조 이상은 히스토리에서 제거하고 직전 조(validIndex - 1)로 복귀
  const prevIndex = validIndex - 1;
  const prevHistoryItem = history.find(h => h.race_index === prevIndex);
  history = history.filter(h => h.race_index < prevIndex);
  breaks = breaks.filter(b => b.after_race_index < prevIndex);

  const newStatus = {
    ...current,
    division,
    status: 'running',
    current_race_index: prevIndex,
    current_race_started_at: prevHistoryItem?.started_at || current.current_race_started_at || nowStr,
    is_paused: false,
    pause_started_at: null,
    history,
    breaks,
    updated_at: nowStr
  };

  await saveLiveStatus(division, newStatus);
  return newStatus;
}

/**
 * [휴게 시작] 버튼 클릭 시: 현재 진행 순서 다음에 녹색 휴게 카드 삽입 및 휴게 시작
 */
export async function startBreak(division, fallbackStatus = null) {
  const fetched = await fetchLiveStatus(division);
  const current = pickNewerStatus(fetched, fallbackStatus) || getDefaultLiveStatus(division);
  const now = new Date();
  const nowStr = now.toISOString();

  let history = Array.isArray(current.history) ? [...current.history] : [];
  let breaks = Array.isArray(current.breaks) ? [...current.breaks] : [];

  // 이미 진행 중인 휴게가 있으면 그대로 반환
  if (breaks.some(b => b.state === 'running')) {
    return current;
  }

  const afterIndex = current.current_race_index > 0 ? current.current_race_index : 1;

  // 현재 경기가 진행 중이었다면 해당 경기를 완료 처리하여 히스토리에 기록
  if (current.status === 'running' && current.current_race_index > 0) {
    let prevDuration = 75;
    if (current.current_race_started_at) {
      const prevStart = new Date(current.current_race_started_at);
      prevDuration = Math.max(1, Math.round((now - prevStart) / 1000));
    }
    history = history.filter(h => h.race_index !== current.current_race_index);
    history.push({
      race_index: current.current_race_index,
      started_at: current.current_race_started_at || nowStr,
      finished_at: nowStr,
      duration_sec: prevDuration
    });
  }

  const breakItem = {
    id: `brk_${Date.now()}`,
    after_race_index: afterIndex,
    started_at: nowStr,
    finished_at: null,
    duration_sec: 0,
    state: 'running'
  };

  breaks.push(breakItem);

  const newStatus = {
    ...current,
    division,
    status: 'paused',
    current_race_index: afterIndex,
    started_at: current.started_at || nowStr,
    is_paused: true,
    pause_started_at: nowStr,
    history,
    breaks,
    updated_at: nowStr
  };

  await saveLiveStatus(division, newStatus);
  return newStatus;
}

/**
 * [휴게 종료] 버튼 클릭 시: 휴게 카드를 완료 기록으로 남기고 바로 다음 순번 경기를 자동 시작
 */
export async function endBreak(division, breakId, fallbackStatus = null) {
  const fetched = await fetchLiveStatus(division);
  const current = pickNewerStatus(fetched, fallbackStatus) || getDefaultLiveStatus(division);
  const races = division === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;
  const now = new Date();
  const nowStr = now.toISOString();

  let breaks = Array.isArray(current.breaks) ? [...current.breaks] : [];
  let targetAfterIndex = current.current_race_index || 1;

  breaks = breaks.map(b => {
    if ((breakId && b.id === breakId) || (!breakId && b.state === 'running')) {
      targetAfterIndex = b.after_race_index || targetAfterIndex;
      const bStart = b.started_at ? new Date(b.started_at) : now;
      const dur = Math.max(1, Math.round((now - bStart) / 1000));
      return {
        ...b,
        state: 'finished',
        finished_at: nowStr,
        duration_sec: dur
      };
    }
    return b;
  });

  const nextRaceIndex = Math.min(races.length, targetAfterIndex + 1);

  const newStatus = {
    ...current,
    division,
    status: 'running',
    current_race_index: nextRaceIndex,
    started_at: current.started_at || nowStr,
    current_race_started_at: nowStr,
    is_paused: false,
    pause_started_at: null,
    breaks,
    updated_at: nowStr
  };

  await saveLiveStatus(division, newStatus);
  return newStatus;
}

/**
 * [휴게 취소] 버튼 클릭 시: 해당 휴게 카드를 삭제하고 이전 상태로 복귀
 */
export async function cancelBreak(division, breakId, fallbackStatus = null) {
  const fetched = await fetchLiveStatus(division);
  const current = pickNewerStatus(fetched, fallbackStatus) || getDefaultLiveStatus(division);
  const nowStr = new Date().toISOString();

  let breaks = Array.isArray(current.breaks) ? [...current.breaks] : [];
  const targetBreak = breaks.find(b => (breakId && b.id === breakId) || (!breakId && b.state === 'running'));
  breaks = breaks.filter(b => b !== targetBreak);

  const stillHasRunningBreak = breaks.some(b => b.state === 'running');
  const nextStatus = stillHasRunningBreak
    ? 'paused'
    : (current.current_race_index > 0 ? 'running' : 'ready');

  const newStatus = {
    ...current,
    division,
    status: nextStatus,
    is_paused: stillHasRunningBreak,
    pause_started_at: stillHasRunningBreak ? current.pause_started_at : null,
    breaks,
    updated_at: nowStr
  };

  await saveLiveStatus(division, newStatus);
  return newStatus;
}

// ──────────────────────────────────────────────────────────────────────────
// 🧠 실시간 시간 추론 엔진 (Pace-Adaptive Real-time Estimation)
// ──────────────────────────────────────────────────────────────────────────

export function calculateScheduleEstimates(races, status, referenceTime = new Date()) {
  const currentIndex = status.current_race_index || 0;
  const isStarted = status.status === 'running' || status.status === 'paused' || status.status === 'finished';
  const history = status.history || [];
  const breaks = Array.isArray(status.breaks) ? status.breaks : [];
  const activeBreak = breaks.find(b => b.state === 'running') || null;

  // 1. 히스토리 매핑: race_index -> history item
  const historyMap = new Map();
  for (const h of history) {
    historyMap.set(h.race_index, h);
  }

  // 2. 개인전 / 단체전 평균 경기 진행속도 계산 (완료 기록 없을 시 기본 예상치: 개인 75초=01:15, 단체 180초=03:00)
  const indivDurations = [];
  const relayDurations = [];
  for (const h of history) {
    if (!h || typeof h.duration_sec !== 'number' || h.duration_sec <= 0) continue;
    const r = races[h.race_index - 1];
    if (r && r.is_relay) {
      relayDurations.push(h.duration_sec);
    } else {
      indivDurations.push(h.duration_sec);
    }
  }

  const avgIndivSec = indivDurations.length > 0
    ? Math.round(indivDurations.reduce((a, b) => a + b, 0) / indivDurations.length)
    : 75;
  const avgRelaySec = relayDurations.length > 0
    ? Math.round(relayDurations.reduce((a, b) => a + b, 0) / relayDurations.length)
    : 180;

  // 3. 동적 속도 계수(Pace Factor) 계산 (최근 5개 완료 조 기준)
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
      paceFactor = Math.min(2.0, Math.max(0.6, paceFactor));
    }
  }

  // 4. 현재 조 경과 시간 및 남은 예상 시간 계산
  let currentRaceElapsed = 0;
  let currentRaceRemaining = 0;
  if (!activeBreak && isStarted && currentIndex > 0 && currentIndex <= races.length && status.current_race_started_at) {
    const curStart = new Date(status.current_race_started_at);
    currentRaceElapsed = Math.max(0, Math.round((referenceTime - curStart) / 1000));
    const currentBase = (races[currentIndex - 1]?.base_duration_sec || 75) * paceFactor;
    currentRaceRemaining = Math.max(10, Math.round(currentBase - currentRaceElapsed));
  }

  // 5. 미래 예상 누적 시각 초기화 (대회 시작 전에는 공식 시작 시각 08:30 기준)
  const officialStartDate = new Date(referenceTime.getTime());
  officialStartDate.setHours(8, 30, 0, 0);

  let futureAccumDate;
  if (!isStarted || currentIndex === 0) {
    futureAccumDate = new Date(officialStartDate.getTime());
  } else {
    futureAccumDate = new Date(referenceTime.getTime());
    if (currentRaceRemaining > 0) {
      futureAccumDate.setSeconds(futureAccumDate.getSeconds() + currentRaceRemaining);
    }
  }

  const result = [];
  for (let i = 0; i < races.length; i++) {
    const race = races[i];
    const raceIdx = race.race_index;

    if (!isStarted || currentIndex === 0) {
      const thisEstimatedStart = new Date(futureAccumDate.getTime());
      result.push({
        ...race,
        state: 'waiting',
        actual_started_at: null,
        estimated_start_time: thisEstimatedStart,
        display_time: `예상 ${formatTimeHM(thisEstimatedStart)}`,
        is_current: false
      });

      const thisBaseDuration = (race.base_duration_sec || 75) * paceFactor;
      futureAccumDate.setSeconds(futureAccumDate.getSeconds() + Math.round(thisBaseDuration));
    } else if (raceIdx < currentIndex || (activeBreak && raceIdx <= activeBreak.after_race_index)) {
      const h = historyMap.get(raceIdx);
      const startD = h && h.started_at ? new Date(h.started_at) : null;
      const durSec = h && typeof h.duration_sec === 'number' ? h.duration_sec : null;
      const timeWithDur = startD
        ? (durSec !== null ? `${formatTimeHM(startD, true)}(${formatMMSS(durSec)})` : formatTimeHM(startD, true))
        : '완료';
      result.push({
        ...race,
        state: 'finished',
        actual_started_at: h ? h.started_at : null,
        estimated_start_time: startD,
        display_time: timeWithDur,
        is_current: false
      });
    } else if (raceIdx === currentIndex && !activeBreak) {
      const startD = status.current_race_started_at ? new Date(status.current_race_started_at) : referenceTime;
      result.push({
        ...race,
        state: status.is_paused ? 'paused' : 'running',
        actual_started_at: status.current_race_started_at,
        estimated_start_time: startD,
        display_time: formatTimeHM(startD, true),
        elapsed_sec: currentRaceElapsed,
        is_current: true
      });
    } else {
      const thisEstimatedStart = new Date(futureAccumDate.getTime());
      result.push({
        ...race,
        state: 'waiting',
        actual_started_at: null,
        estimated_start_time: thisEstimatedStart,
        display_time: `예상 ${formatTimeHM(thisEstimatedStart)}`,
        is_current: false
      });

      const thisBaseDuration = (race.base_duration_sec || 75) * paceFactor;
      futureAccumDate.setSeconds(futureAccumDate.getSeconds() + Math.round(thisBaseDuration));
    }
  }

  return {
    races: result,
    currentIndex,
    paceFactor,
    currentRaceElapsed,
    avgIndivSec,
    avgRelaySec,
    breaks,
    activeBreak
  };
}
