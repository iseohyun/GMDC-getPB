// ==========================================================================
// GMDC Swim Club - Real-time Competition Live Service & Estimation Engine
// 대회 당일 실시간 경기 순서, 시간 추론 및 명부(DB) 연동 서비스
// ==========================================================================

import { firebaseApp } from "./firebase-config.js?v=20261024_02";
import { 
  getFirestore, doc, getDoc, setDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ADULT_RACES_DATA, STUDENT_RACES_DATA } from "./races-data.js?v=20261024_02";
import { RESTORED_STUDENT_LIVE_STATUS_2026 } from "./student-live-restored-2026.js?v=20261024_10";

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
 * 감독자 회의자료(4. 경기 스케줄) 기준 성인부(10/25 일) 공식 예정 휴식 2회:
 * 1) 접영 50m 종료 직후 (#59, 33-2번 다음 / #60 핀자유형 50m 전): 20분 휴식 (1,200초)
 * 2) 자유형 50m 종료 직후 (#139, 68번 다음 / #140 혼성 핀계영 300m 전): 10분 휴식 (600초)
 */
export const DEFAULT_ADULT_SCHEDULED_BREAKS = [
  {
    id: 'sched_brk_adult_59',
    after_race_index: 59,
    started_at: null,
    finished_at: null,
    duration_sec: 1200,
    scheduled_duration_sec: 1200,
    state: 'scheduled',
    label: '감독자회의 예정 휴식 (20분 · 접영 50m 종료 후)'
  },
  {
    id: 'sched_brk_adult_139',
    after_race_index: 139,
    started_at: null,
    finished_at: null,
    duration_sec: 600,
    scheduled_duration_sec: 600,
    state: 'scheduled',
    label: '감독자회의 예정 휴식 (10분 · 자유형 50m 종료 후)'
  }
];

function ensureAdultScheduledBreaks(statusObj) {
  if (!statusObj || statusObj.division !== 'adult') return statusObj;
  const existing = Array.isArray(statusObj.breaks) ? [...statusObj.breaks] : [];
  const removedIds = Array.isArray(statusObj.removed_scheduled_break_ids) ? statusObj.removed_scheduled_break_ids : [];

  for (const defBrk of DEFAULT_ADULT_SCHEDULED_BREAKS) {
    if (removedIds.includes(defBrk.id)) continue;
    const alreadyHas = existing.some(
      b => b && (b.id === defBrk.id || Number(b.after_race_index) === defBrk.after_race_index)
    );
    if (!alreadyHas) {
      existing.push({ ...defBrk });
    }
  }

  existing.sort((a, b) => (Number(a.after_race_index) || 0) - (Number(b.after_race_index) || 0));
  return {
    ...statusObj,
    breaks: existing
  };
}

/**
 * 기본 상태 객체 팩토리
 */
export function getDefaultLiveStatus(division = 'adult') {
  if (division === 'student') {
    return JSON.parse(JSON.stringify(RESTORED_STUDENT_LIVE_STATUS_2026));
  }
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
    breaks: DEFAULT_ADULT_SCHEDULED_BREAKS.map(b => ({ ...b })),
    removed_scheduled_break_ids: [],
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
      let merged = pickNewerStatus(snap.data(), localData);
      if (division === 'student' && (!Array.isArray(merged?.history) || merged.history.length < 232)) {
        merged = getDefaultLiveStatus('student');
        saveLiveStatus('student', merged);
      } else if (division === 'adult') {
        merged = ensureAdultScheduledBreaks(merged);
      }
      writeLocalCache(division, merged);
      callback(merged);
    } else {
      let fallback = division === 'student'
        ? getDefaultLiveStatus('student')
        : (localData || getDefaultLiveStatus(division));
      if (division === 'adult') fallback = ensureAdultScheduledBreaks(fallback);
      callback(fallback);
    }
  }, (err) => {
    console.warn(`[LiveStatus] Snapshot warning (${division}):`, err);
    const localData = readLocalCache(division);
    let fallback = (division === 'student' && (!Array.isArray(localData?.history) || localData.history.length < 232))
      ? getDefaultLiveStatus('student')
      : (localData || getDefaultLiveStatus(division));
    if (division === 'adult') fallback = ensureAdultScheduledBreaks(fallback);
    callback(fallback);
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
      let merged = pickNewerStatus(snap.data(), localData);
      if (division === 'student' && (!Array.isArray(merged?.history) || merged.history.length < 232)) {
        merged = getDefaultLiveStatus('student');
      } else if (division === 'adult') {
        merged = ensureAdultScheduledBreaks(merged);
      }
      writeLocalCache(division, merged);
      return merged;
    }
  } catch (err) {
    console.warn("[LiveStatus] fetchLiveStatus error:", err);
  }
  if (division === 'student' && (!Array.isArray(localData?.history) || localData.history.length < 232)) {
    return getDefaultLiveStatus('student');
  }
  const fallback = localData || getDefaultLiveStatus(division);
  return division === 'adult' ? ensureAdultScheduledBreaks(fallback) : fallback;
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

  // 직전 진행 중이던 조가 있고, 그 다음/이후 조를 시작한 경우 직전(및 건너뛴 중간) 조 소요시간을 비례 배분하여 모두 기록
  if (current.status === 'running' && current.current_race_index > 0 && current.current_race_index < validIndex) {
    const startIdx = current.current_race_index;
    const endIdx = validIndex - 1;
    const prevStart = current.current_race_started_at ? new Date(current.current_race_started_at) : new Date(now.getTime() - (endIdx - startIdx + 1) * 75000);
    const totalElapsedSec = Math.max(endIdx - startIdx + 1, Math.round((now - prevStart) / 1000));

    history = history.filter(h => h.race_index < startIdx || h.race_index > endIdx);

    const spanIndices = [];
    for (let rIdx = startIdx; rIdx <= endIdx; rIdx++) spanIndices.push(rIdx);
    const weights = spanIndices.map(rIdx => {
      const rObj = races[rIdx - 1];
      return rObj ? (rObj.base_duration_sec || (rObj.is_relay ? 210 : 85)) : 85;
    });
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
    let allocated = weights.map(w => Math.max(1, Math.round((totalElapsedSec * w) / weightSum)));
    const diff = totalElapsedSec - allocated.reduce((a, b) => a + b, 0);
    allocated[allocated.length - 1] = Math.max(1, allocated[allocated.length - 1] + diff);

    let cursorMs = prevStart.getTime();
    spanIndices.forEach((rIdx, i) => {
      const dur = allocated[i];
      const sIso = new Date(cursorMs).toISOString();
      const fIso = (i === spanIndices.length - 1) ? nowStr : new Date(cursorMs + dur * 1000).toISOString();
      history.push({
        race_index: rIdx,
        started_at: sIso,
        finished_at: fIso,
        duration_sec: dur
      });
      cursorMs += dur * 1000;
    });
  } else if (current.current_race_index === 0 && validIndex > 1) {
    // 첫 클릭이 1조가 아닌 중간 조에서 시작된 경우: 공식 시작(08:30)부터 건너뛴 1~(validIndex-1)조까지 비례 보간하여 자동 복원
    const officialStart = new Date(now.getTime());
    officialStart.setHours(8, 30, 0, 0);
    const spanCount = validIndex - 1;
    const baseStartMs = officialStart.getTime() < now.getTime() - spanCount * 30000
      ? officialStart.getTime()
      : now.getTime() - spanCount * 85000;
    const totalElapsedSec = Math.max(spanCount, Math.round((now.getTime() - baseStartMs) / 1000));

    history = history.filter(h => h.race_index >= validIndex);
    const spanIndices = [];
    for (let rIdx = 1; rIdx < validIndex; rIdx++) spanIndices.push(rIdx);
    const weights = spanIndices.map(rIdx => {
      const rObj = races[rIdx - 1];
      return rObj ? (rObj.base_duration_sec || (rObj.is_relay ? 210 : 85)) : 85;
    });
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
    let allocated = weights.map(w => Math.max(1, Math.round((totalElapsedSec * w) / weightSum)));
    const diff = totalElapsedSec - allocated.reduce((a, b) => a + b, 0);
    allocated[allocated.length - 1] = Math.max(1, allocated[allocated.length - 1] + diff);

    let cursorMs = baseStartMs;
    spanIndices.forEach((rIdx, i) => {
      const dur = allocated[i];
      const sIso = new Date(cursorMs).toISOString();
      const fIso = (i === spanIndices.length - 1) ? nowStr : new Date(cursorMs + dur * 1000).toISOString();
      history.push({
        race_index: rIdx,
        started_at: sIso,
        finished_at: fIso,
        duration_sec: dur
      });
      cursorMs += dur * 1000;
    });
  }

  // targetRaceIndex 이후의 기존 히스토리는 정리
  history = history.filter(h => h.race_index < validIndex);

  // 진행 중이던 휴게가 있으면 종료 처리하고, validIndex 이후의 비예정(running/finished) 휴게는 정리하되 예정 휴식(scheduled)은 보존
  let breaks = Array.isArray(current.breaks) ? [...current.breaks] : [];
  breaks = breaks
    .filter(b => b.after_race_index < validIndex || b.state === 'scheduled')
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

  // 취소한 조 이상은 히스토리에서 제거하고 직전 조(validIndex - 1)로 복귀 (예정 휴식은 유지하거나 예정 상태로 복귀)
  const prevIndex = validIndex - 1;
  const prevHistoryItem = history.find(h => h.race_index === prevIndex);
  history = history.filter(h => h.race_index < prevIndex);
  breaks = breaks
    .filter(b => b.after_race_index < prevIndex || b.state === 'scheduled' || String(b.id || '').startsWith('sched_brk_'))
    .map(b => {
      if (b.after_race_index >= prevIndex && String(b.id || '').startsWith('sched_brk_')) {
        return {
          ...b,
          state: 'scheduled',
          started_at: null,
          finished_at: null,
          duration_sec: b.scheduled_duration_sec || b.duration_sec || 600
        };
      }
      return b;
    });

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
 * [휴게 시작] 버튼 클릭 시: 현재 진행 순서 다음(또는 클릭한 예정 휴식 카드)에 녹색 휴게 시작
 */
export async function startBreak(division, fallbackStatus = null, targetBreakId = null) {
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

  const scheduledMatch = targetBreakId
    ? breaks.find(b => b.id === targetBreakId)
    : breaks.find(b => b.state === 'scheduled' && Number(b.after_race_index) === (current.current_race_index > 0 ? current.current_race_index : 1));

  const afterIndex = scheduledMatch
    ? Number(scheduledMatch.after_race_index)
    : (current.current_race_index > 0 ? current.current_race_index : 1);

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

  if (scheduledMatch) {
    breaks = breaks.map(b => b.id === scheduledMatch.id ? {
      ...b,
      started_at: nowStr,
      finished_at: null,
      state: 'running'
    } : b);
  } else {
    const breakItem = {
      id: `brk_${Date.now()}`,
      after_race_index: afterIndex,
      started_at: nowStr,
      finished_at: null,
      duration_sec: 0,
      state: 'running'
    };
    breaks.push(breakItem);
  }

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
  let removedScheduledIds = Array.isArray(current.removed_scheduled_break_ids)
    ? [...current.removed_scheduled_break_ids]
    : [];
  const targetBreak = breaks.find(b => (breakId && b.id === breakId) || (!breakId && b.state === 'running'));

  if (targetBreak && String(targetBreak.id || '').startsWith('sched_brk_') && targetBreak.state !== 'scheduled') {
    // 예정 휴식이 진행 중이거나 완료된 상태에서 취소 시 다시 예정(scheduled) 상태로 복귀
    breaks = breaks.map(b => b === targetBreak ? {
      ...b,
      state: 'scheduled',
      started_at: null,
      finished_at: null,
      duration_sec: b.scheduled_duration_sec || b.duration_sec || 600
    } : b);
  } else {
    if (targetBreak && String(targetBreak.id || '').startsWith('sched_brk_')) {
      if (!removedScheduledIds.includes(targetBreak.id)) {
        removedScheduledIds.push(targetBreak.id);
      }
    }
    breaks = breaks.filter(b => b !== targetBreak);
  }

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
    removed_scheduled_break_ids: removedScheduledIds,
    updated_at: nowStr
  };

  await saveLiveStatus(division, newStatus);
  return newStatus;
}

/**
 * 마지막 경기 이후 [🏁 경기종료] 버튼 클릭 시:
 * 현재 진행 중인 마지막 조(또는 남은 조들)의 소요시간을 기록하고 전체 대회를 완료(finished) 상태로 전환
 */
export async function finishAllRaces(division, fallbackStatus = null) {
  const fetched = await fetchLiveStatus(division);
  const current = pickNewerStatus(fetched, fallbackStatus) || getDefaultLiveStatus(division);
  const races = division === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;
  const totalRaces = races.length;
  const now = new Date();
  const nowStr = now.toISOString();

  let history = Array.isArray(current.history) ? [...current.history] : [];
  let breaks = Array.isArray(current.breaks) ? [...current.breaks] : [];

  const startIdx = current.current_race_index > 0 ? current.current_race_index : 1;
  const endIdx = totalRaces;

  if (startIdx <= endIdx) {
    const prevStart = current.current_race_started_at
      ? new Date(current.current_race_started_at)
      : new Date(now.getTime() - (endIdx - startIdx + 1) * 75000);
    const totalElapsedSec = Math.max(endIdx - startIdx + 1, Math.round((now - prevStart) / 1000));

    history = history.filter(h => h.race_index < startIdx || h.race_index > endIdx);

    const spanIndices = [];
    for (let rIdx = startIdx; rIdx <= endIdx; rIdx++) spanIndices.push(rIdx);
    const weights = spanIndices.map(rIdx => {
      const rObj = races[rIdx - 1];
      return rObj ? (rObj.base_duration_sec || (rObj.is_relay ? 210 : 85)) : 85;
    });
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
    const allocated = weights.map(w => Math.max(1, Math.round((totalElapsedSec * w) / weightSum)));
    const diff = totalElapsedSec - allocated.reduce((a, b) => a + b, 0);
    allocated[allocated.length - 1] = Math.max(1, allocated[allocated.length - 1] + diff);

    let cursorMs = prevStart.getTime();
    spanIndices.forEach((rIdx, i) => {
      const dur = allocated[i];
      const sIso = new Date(cursorMs).toISOString();
      const fIso = (i === spanIndices.length - 1) ? nowStr : new Date(cursorMs + dur * 1000).toISOString();
      history.push({
        race_index: rIdx,
        started_at: sIso,
        finished_at: fIso,
        duration_sec: dur
      });
      cursorMs += dur * 1000;
    });
  }

  // 진행 중이던 휴게가 있으면 완료 처리
  breaks = breaks.map(b => {
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

  const lastHistoryItem = history.find(h => h.race_index === totalRaces);

  const newStatus = {
    ...current,
    division,
    status: 'finished',
    current_race_index: totalRaces,
    started_at: current.started_at || history[0]?.started_at || nowStr,
    current_race_started_at: lastHistoryItem?.started_at || current.current_race_started_at || nowStr,
    finished_at: nowStr,
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
 * [↩ 경기종료 취소] 버튼 클릭 시:
 * 전 경기 종료(finished) 상태를 해제하고 마지막 조(totalRaces) 진행 중(running) 상태로 복귀
 */
export async function cancelFinishAllRaces(division, fallbackStatus = null) {
  const fetched = await fetchLiveStatus(division);
  const current = pickNewerStatus(fetched, fallbackStatus) || getDefaultLiveStatus(division);
  const races = division === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;
  const totalRaces = races.length;
  const nowStr = new Date().toISOString();

  let history = Array.isArray(current.history) ? [...current.history] : [];
  const lastHistoryItem = history.find(h => h.race_index === totalRaces);
  history = history.filter(h => h.race_index < totalRaces);

  const newStatus = {
    ...current,
    division,
    status: 'running',
    current_race_index: totalRaces,
    current_race_started_at: lastHistoryItem?.started_at || current.current_race_started_at || nowStr,
    finished_at: null,
    is_paused: false,
    pause_started_at: null,
    history,
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

  const breaksByAfterMap = new Map();
  const computedBreaks = breaks.map(b => ({ ...b }));
  for (const b of computedBreaks) {
    const aIdx = Number(b.after_race_index) || 1;
    if (!breaksByAfterMap.has(aIdx)) breaksByAfterMap.set(aIdx, []);
    breaksByAfterMap.get(aIdx).push(b);
  }

  const advanceForAttachedBreaks = (raceIdx, isFutureOrCurrent) => {
    const list = breaksByAfterMap.get(raceIdx);
    if (!list || list.length === 0) return;
    for (const b of list) {
      if (b.state === 'scheduled') {
        if (isFutureOrCurrent) {
          const estStart = new Date(futureAccumDate.getTime());
          b.estimated_started_at = estStart.toISOString();
          const dur = Number(b.duration_sec || b.scheduled_duration_sec || 600);
          futureAccumDate.setSeconds(futureAccumDate.getSeconds() + dur);
          b.estimated_finished_at = new Date(futureAccumDate.getTime()).toISOString();
        } else {
          const h = historyMap.get(raceIdx);
          if (h && h.finished_at) {
            b.estimated_started_at = h.finished_at;
          }
        }
      } else if (b.state === 'running' && isFutureOrCurrent) {
        const bStart = b.started_at ? new Date(b.started_at) : referenceTime;
        const elapsed = Math.max(0, Math.round((referenceTime - bStart) / 1000));
        const expectedTotal = Number(b.scheduled_duration_sec || b.duration_sec || 0);
        const remain = Math.max(0, expectedTotal - elapsed);
        if (remain > 0) {
          futureAccumDate.setSeconds(futureAccumDate.getSeconds() + remain);
        }
      }
    }
  };

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
      advanceForAttachedBreaks(raceIdx, true);
    } else if (
      raceIdx < currentIndex ||
      (status.status === 'finished' && raceIdx <= currentIndex) ||
      (activeBreak && raceIdx <= activeBreak.after_race_index)
    ) {
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
      advanceForAttachedBreaks(raceIdx, activeBreak && raceIdx === activeBreak.after_race_index);
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
      advanceForAttachedBreaks(raceIdx, true);
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
      advanceForAttachedBreaks(raceIdx, true);
    }
  }

  return {
    races: result,
    currentIndex,
    paceFactor,
    currentRaceElapsed,
    avgIndivSec,
    avgRelaySec,
    breaks: computedBreaks,
    activeBreak
  };
}
