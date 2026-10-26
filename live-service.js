// ==========================================================================
// GMDC Swim Club - Real-time Competition Live Service & Estimation Engine
// 대회 당일 실시간 경기 순서, 시간 추론, 로컬 우선(Offline-First) & 스마트 병합 서비스
// ==========================================================================

import { ADULT_RACES_DATA, STUDENT_RACES_DATA } from "./races-data.js?v=20261026_03";
import { RESTORED_STUDENT_LIVE_STATUS_2026 } from "./student-live-restored-2026.js?v=20261026_03";
import { RESTORED_ADULT_LIVE_STATUS_2026 } from "./adult-live-restored-2026.js?v=20261026_03";

// 배포된 Firestore 보안 규칙(match /attendance/{docId})과 즉시 호환되도록 attendance 컬렉션 내 전용 문서 사용
export const LIVE_COL_NAME = "attendance";

// ─── 비동기 지연 로딩(Lazy Loading) Firebase 컨텍스트 ────────────────────────
// 느린 인터넷 환경에서도 대진표 화면 렌더링이 절대 차단되지 않도록 Firebase SDK는 백그라운드에서 비동기 로드
let firestoreDepsPromise = null;

async function getFirestoreDeps() {
  if (!firestoreDepsPromise) {
    firestoreDepsPromise = Promise.all([
      import("./firebase-config.js?v=20261024_19"),
      import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js")
    ]).then(([cfgMod, fsMod]) => {
      const db = fsMod.getFirestore(cfgMod.firebaseApp);
      return {
        db,
        doc: fsMod.doc,
        getDoc: fsMod.getDoc,
        setDoc: fsMod.setDoc,
        onSnapshot: fsMod.onSnapshot
      };
    }).catch((err) => {
      firestoreDepsPromise = null;
      throw err;
    });
  }
  return firestoreDepsPromise;
}

function withTimeout(promise, ms = 4500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`FIRESTORE_TIMEOUT_${ms}MS`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

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

// ─── 상태 변경 리스너 레지스트리 및 백그라운드 동기화 큐 상태 ─────────────────
const statusListeners = {
  adult: new Set(),
  student: new Set()
};

const hasEverFetchedRemote = {
  adult: false,
  student: false
};

const syncTimers = {
  adult: null,
  student: null
};

const isSyncingNow = {
  adult: false,
  student: false
};

function notifyStatusListeners(division, statusObj) {
  const set = statusListeners[division];
  if (!set) return;
  for (const cb of set) {
    try {
      cb(statusObj);
    } catch (e) {
      console.warn("[LiveStatus] listener error:", e);
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    ['adult', 'student'].forEach(div => {
      const local = readLocalCache(div);
      if (local && local.pending_sync) {
        scheduleBackgroundSync(div, 100);
      }
    });
  });
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
  if (division === 'adult') {
    return JSON.parse(JSON.stringify(RESTORED_ADULT_LIVE_STATUS_2026));
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
    pending_sync: false,
    updated_at: new Date().toISOString(),
    updated_by: '현장 운영'
  };
}

/**
 * 페이지 로드 직후 네트워크 대기 없이 즉시 사용할 초기 상태 반환
 * 브라우저 localStorage에 이전 시작 정보가 있으면 이를 우선 복원
 */
export function getInitialLiveStatus(division = 'adult') {
  const localData = readLocalCache(division);
  if (division === 'student') {
    if (localData && Array.isArray(localData.history) && localData.history.length >= 232 && localData.status === 'finished') {
      return localData;
    }
    const restored = getDefaultLiveStatus('student');
    writeLocalCache('student', restored);
    return restored;
  }

  if (division === 'adult') {
    if (localData && Array.isArray(localData.history) && localData.history.length >= 141 && localData.status === 'finished') {
      return localData;
    }
    const restored = getDefaultLiveStatus('adult');
    writeLocalCache('adult', restored);
    return restored;
  }

  if (localData && typeof localData === 'object') {
    const ensured = ensureAdultScheduledBreaks(localData);
    if (ensured.pending_sync) {
      scheduleBackgroundSync(division, 300);
    }
    return ensured;
  }

  return getDefaultLiveStatus(division);
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

// ──────────────────────────────────────────────────────────────────────────
// 🔄 경기별 타임스탬프 스마트 병합 (Smart Merge Engine)
// 이전 정보가 로딩되지 않은 상태에서 다음 경기 시작을 먼저 기록했더라도,
// 추후 DB에서 도착한 이전 경기 시작 기록과 현재 로컬 기록을 경기 순번(race_index)별로 병합
// ──────────────────────────────────────────────────────────────────────────

function interpolateSpanHistory(races, startIdx, endIdx, startMs, endMs, isInterpolated = true) {
  if (startIdx > endIdx) return [];
  const totalElapsedSec = Math.max(endIdx - startIdx + 1, Math.round((endMs - startMs) / 1000));
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

  const items = [];
  let cursorMs = startMs;
  const endIso = new Date(endMs).toISOString();
  spanIndices.forEach((rIdx, i) => {
    const dur = allocated[i];
    const sIso = new Date(cursorMs).toISOString();
    const fIso = (i === spanIndices.length - 1) ? endIso : new Date(cursorMs + dur * 1000).toISOString();
    items.push({
      race_index: rIdx,
      started_at: sIso,
      finished_at: fIso,
      duration_sec: dur,
      is_interpolated: isInterpolated
    });
    cursorMs += dur * 1000;
  });
  return items;
}

export function mergeLiveStatuses(remoteData, localData, division = 'adult') {
  if (!remoteData && !localData) return getDefaultLiveStatus(division);
  if (!remoteData) return division === 'adult' ? ensureAdultScheduledBreaks(localData) : localData;
  if (!localData) return division === 'adult' ? ensureAdultScheduledBreaks(remoteData) : remoteData;

  const races = division === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;
  const remoteTime = remoteData.updated_at ? new Date(remoteData.updated_at).getTime() : 0;
  const localTime = localData.updated_at ? new Date(localData.updated_at).getTime() : 0;

  // 로컬에 아직 DB에 반영되지 않은 조작(pending_sync)이 있거나 로컬이 더 최신이면 로컬 액션이 우선
  const localIsPrimary = Boolean(localData.pending_sync) || (localTime >= remoteTime);
  const primary = localIsPrimary ? localData : remoteData;
  const secondary = localIsPrimary ? remoteData : localData;

  // 전체 초기화(1조 취소) 액션이 로컬에서 방금 발생한 경우 그대로 반환
  if (localIsPrimary && localData.last_action_type === 'reset' && localData.status === 'ready') {
    const resetResult = {
      ...localData,
      division
    };
    return division === 'adult' ? ensureAdultScheduledBreaks(resetResult) : resetResult;
  }

  // 유효한 완료 히스토리 상한선 결정 (취소 액션인 경우 primary.current_race_index 미만까지만 허용)
  const maxCompletedIdx = primary.status === 'finished'
    ? races.length
    : Math.max(0, (primary.current_race_index || 0) - (primary.status === 'paused' ? 0 : 1));

  // 1. race_index 기준 히스토리 병합 (실측 기록 > 추정 보간 기록 우선)
  const histMap = new Map();

  const addHistoryList = (list, isFromPrimary) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || typeof item.race_index !== 'number') continue;
      if (item.race_index < 1 || item.race_index > maxCompletedIdx) continue;

      const existing = histMap.get(item.race_index);
      if (!existing) {
        histMap.set(item.race_index, { ...item });
      } else {
        // 기존 항목이 추정 보간(is_interpolated)이고 새 항목이 실측 기록이면 실측 기록으로 교체
        if (existing.is_interpolated && !item.is_interpolated) {
          histMap.set(item.race_index, { ...item });
        } else if (!existing.is_interpolated && item.is_interpolated) {
          // 실측 기록 유지
        } else if (isFromPrimary) {
          histMap.set(item.race_index, { ...item });
        }
      }
    }
  };

  addHistoryList(secondary.history, false);
  addHistoryList(primary.history, true);

  // 2. 핵심 시나리오: DB의 이전 정보(예: R조 진행 중)가 로딩되기 전에 로컬에서 다음 경기(L조, L > R) 시작을 먼저 누른 경우!
  // DB가 갖고 있던 R조의 실제 시작 시각(T_R)과 로컬에서 누른 L조의 시작 시각(T_L)을 연결하여 R~(L-1)조 소요시간을 정밀 산출
  const remIdx = Number(remoteData.current_race_index) || 0;
  const locIdx = Number(localData.current_race_index) || 0;
  if (
    localIsPrimary &&
    remIdx > 0 &&
    locIdx > remIdx &&
    remoteData.current_race_started_at &&
    localData.current_race_started_at
  ) {
    const remStartMs = new Date(remoteData.current_race_started_at).getTime();
    const locStartMs = new Date(localData.current_race_started_at).getTime();
    if (locStartMs > remStartMs) {
      const bridgedItems = interpolateSpanHistory(
        races,
        remIdx,
        locIdx - 1,
        remStartMs,
        locStartMs,
        locIdx - remIdx > 1
      );
      for (const bItem of bridgedItems) {
        const cur = histMap.get(bItem.race_index);
        if (!cur || cur.is_interpolated) {
          histMap.set(bItem.race_index, bItem);
        }
      }
    }
  }

  const mergedHistory = Array.from(histMap.values()).sort((a, b) => a.race_index - b.race_index);

  // 3. 휴게(breaks) 병합
  const breakMap = new Map();
  const removedIds = Array.from(new Set([
    ...(Array.isArray(remoteData.removed_scheduled_break_ids) ? remoteData.removed_scheduled_break_ids : []),
    ...(Array.isArray(localData.removed_scheduled_break_ids) ? localData.removed_scheduled_break_ids : [])
  ]));

  const stateRank = { scheduled: 1, running: 2, finished: 3 };
  const mergeBreakList = (list, isFromPrimary) => {
    if (!Array.isArray(list)) return;
    for (const brk of list) {
      if (!brk || !brk.id) continue;
      if (removedIds.includes(brk.id)) continue;
      const existing = breakMap.get(brk.id);
      if (!existing) {
        breakMap.set(brk.id, { ...brk });
      } else {
        const rExist = stateRank[existing.state] || 0;
        const rNew = stateRank[brk.state] || 0;
        if (isFromPrimary || rNew > rExist) {
          breakMap.set(brk.id, { ...brk });
        }
      }
    }
  };

  mergeBreakList(secondary.breaks, false);
  mergeBreakList(primary.breaks, true);

  let mergedBreaks = Array.from(breakMap.values()).sort(
    (a, b) => (Number(a.after_race_index) || 0) - (Number(b.after_race_index) || 0)
  );

  // 취소 액션이 있었던 경우 취소된 순번 이후의 비예정 휴게 정리
  if (localIsPrimary && localData.last_action_type === 'cancel') {
    const curIdx = primary.current_race_index || 1;
    mergedBreaks = mergedBreaks.filter(
      b => b.after_race_index < curIdx || b.state === 'scheduled' || String(b.id || '').startsWith('sched_brk_')
    );
  }

  const merged = {
    ...secondary,
    ...primary,
    division,
    started_at: primary.started_at || secondary.started_at || mergedHistory[0]?.started_at || null,
    history: mergedHistory,
    breaks: mergedBreaks,
    removed_scheduled_break_ids: removedIds,
    pending_sync: Boolean(localData.pending_sync),
    has_unmerged_interpolation: false,
    updated_at: primary.updated_at || new Date().toISOString()
  };

  return division === 'adult' ? ensureAdultScheduledBreaks(merged) : merged;
}

// ──────────────────────────────────────────────────────────────────────────
// 🔁 백그라운드 자동 재시도 동기화 큐 (Non-blocking Retry Sync Queue)
// ──────────────────────────────────────────────────────────────────────────

export function scheduleBackgroundSync(division = 'adult', delayMs = 0) {
  if (syncTimers[division]) {
    clearTimeout(syncTimers[division]);
    syncTimers[division] = null;
  }
  syncTimers[division] = setTimeout(() => {
    syncTimers[division] = null;
    runBackgroundSync(division);
  }, delayMs);
}

async function runBackgroundSync(division = 'adult') {
  if (isSyncingNow[division]) return;
  const localBefore = readLocalCache(division);
  if (!localBefore || !localBefore.pending_sync) return;

  isSyncingNow[division] = true;
  try {
    const { db, doc, getDoc, setDoc } = await withTimeout(getFirestoreDeps(), 5000);
    const docRef = doc(db, LIVE_COL_NAME, getLiveDocId(division));

    // 1. 서버의 이전 경기 시작 정보가 아직 로컬에 병합되지 않았다면 먼저 조회하여 스마트 병합 수행
    let remoteData = null;
    let getDocSucceeded = false;
    try {
      const snap = await withTimeout(getDoc(docRef), 4500);
      getDocSucceeded = true;
      hasEverFetchedRemote[division] = true;
      if (snap.exists()) {
        remoteData = snap.data();
      }
    } catch (readErr) {
      console.warn(`[LiveSync] getDoc delayed (${division}):`, readErr.message || readErr);
    }

    // 만약 브라우저를 처음 켜서 아직 DB의 이전 경기 기록을 한 번도 못 가져왔는데 중간 조를 눌러 보간된 데이터가 있다면,
    // 서버의 이전 기록을 덮어쓰지 않도록 getDoc이 성공할 때까지 재시도 대기
    const latestLocal = readLocalCache(division) || localBefore;
    if (!getDocSucceeded && !hasEverFetchedRemote[division] && latestLocal.has_unmerged_interpolation) {
      scheduleBackgroundSync(division, 3000);
      return;
    }

    // 2. 서버 데이터와 최신 로컬 데이터를 스마트 병합
    const mergedToSave = remoteData
      ? mergeLiveStatuses(remoteData, latestLocal, division)
      : { ...latestLocal };

    const syncedPayload = {
      ...mergedToSave,
      pending_sync: false,
      has_unmerged_interpolation: false,
      updated_at: new Date().toISOString()
    };

    // 3. Firestore에 병합본 저장 시도
    await withTimeout(setDoc(docRef, syncedPayload, { merge: true }), 4500);

    // 4. 저장 도중 사용자가 또 다른 버튼을 누르지 않았는지 확인 후 동기화 완료(파란색 전환) 처리
    const currentLocalAfterWrite = readLocalCache(division);
    if (
      !currentLocalAfterWrite ||
      currentLocalAfterWrite.local_action_id === latestLocal.local_action_id
    ) {
      writeLocalCache(division, syncedPayload);
      notifyStatusListeners(division, syncedPayload);
    } else {
      // 저장하는 사이에 새로운 로컬 클릭이 발생했다면 즉시 다음 동기화 예약
      scheduleBackgroundSync(division, 300);
    }
  } catch (err) {
    console.warn(`[LiveSync] Background sync retry scheduled (${division}):`, err.message || err);
    scheduleBackgroundSync(division, 3500);
  } finally {
    isSyncingNow[division] = false;
  }
}

/**
 * 실시간 상태 리스너 구독 (로컬 캐시 즉시 반환 + 백그라운드 Firestore 실시간 연동)
 */
export function subscribeLiveStatus(division, callback) {
  if (!statusListeners[division]) {
    statusListeners[division] = new Set();
  }
  statusListeners[division].add(callback);

  // 1. 네트워크를 기다리지 않고 브라우저가 기억하는 최신 상태를 0ms 만에 즉시 전달
  const initialStatus = getInitialLiveStatus(division);
  callback(initialStatus);

  let unsubFirestore = null;
  let isCancelled = false;

  // 2. 백그라운드에서 Firestore 실시간 구독 연결
  getFirestoreDeps()
    .then(({ db, doc, setDoc, onSnapshot }) => {
      if (isCancelled) return;
      const docRef = doc(db, LIVE_COL_NAME, getLiveDocId(division));
      unsubFirestore = onSnapshot(docRef, (snap) => {
        hasEverFetchedRemote[division] = true;
        const localData = readLocalCache(division);

        if (snap.exists()) {
          const remoteData = snap.data();
          let merged = mergeLiveStatuses(remoteData, localData, division);
          if (division === 'student' && (!Array.isArray(merged?.history) || merged.history.length < 232 || merged.status !== 'finished')) {
            merged = getDefaultLiveStatus('student');
          }
          if (division === 'adult' && (!Array.isArray(merged?.history) || merged.history.length < 141 || merged.status !== 'finished')) {
            merged = getDefaultLiveStatus('adult');
            if (!Array.isArray(remoteData?.history) || remoteData.history.length < 141 || remoteData.status !== 'finished') {
              setDoc(docRef, merged, { merge: true }).catch(() => {});
            }
          }
          writeLocalCache(division, merged);
          notifyStatusListeners(division, merged);

          // 로컬에 미동기화 상태가 남아 있었다면 방금 받은 서버 데이터와 합쳐 즉시 DB 반영
          if (merged.pending_sync) {
            scheduleBackgroundSync(division, 100);
          }
        } else {
          const fallback = getInitialLiveStatus(division);
          notifyStatusListeners(division, fallback);
          if (fallback.pending_sync) {
            scheduleBackgroundSync(division, 100);
          }
        }
      }, (err) => {
        console.warn(`[LiveStatus] Snapshot warning (${division}):`, err);
        notifyStatusListeners(division, getInitialLiveStatus(division));
      });
    })
    .catch((err) => {
      console.warn(`[LiveStatus] Firestore init delayed (${division}):`, err);
    });

  return () => {
    isCancelled = true;
    statusListeners[division]?.delete(callback);
    if (typeof unsubFirestore === 'function') {
      unsubFirestore();
    }
  };
}

/**
 * 명부(DB) 실시간 구독 (로컬 캐시 우선 복원 + 백그라운드 구독)
 */
export function subscribeRosterDoc(division, callback) {
  const rosterCacheKey = `gmdc_roster_cache_${division}_2026`;
  try {
    const cachedRaw = localStorage.getItem(rosterCacheKey);
    if (cachedRaw) {
      callback(JSON.parse(cachedRaw));
    }
  } catch (e) {
    // ignore localStorage error
  }

  let unsubFirestore = null;
  let isCancelled = false;

  getFirestoreDeps()
    .then(({ db, doc, onSnapshot }) => {
      if (isCancelled) return;
      const docName = division === 'student' ? 'records_student_2026_01_01' : 'records_2026_01_01';
      const docRef = doc(db, 'gmdc_swim_club', docName);
      unsubFirestore = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          try {
            localStorage.setItem(rosterCacheKey, JSON.stringify(data));
          } catch (e) {
            // ignore
          }
          callback(data);
        }
      }, (err) => {
        console.warn(`[RosterDoc] Snapshot warning (${division}):`, err);
      });
    })
    .catch((err) => {
      console.warn(`[RosterDoc] Firestore init delayed (${division}):`, err);
    });

  return () => {
    isCancelled = true;
    if (typeof unsubFirestore === 'function') {
      unsubFirestore();
    }
  };
}

/**
 * Firestore에서 1회 상태 조회 (폴링/수동 새로고침용 — 타임아웃 적용으로 블로킹 방지)
 */
export async function fetchLiveStatus(division) {
  const localData = readLocalCache(division);
  if (localData && localData.pending_sync) {
    scheduleBackgroundSync(division, 0);
  }

  try {
    const { db, doc, getDoc } = await withTimeout(getFirestoreDeps(), 4000);
    const docRef = doc(db, LIVE_COL_NAME, getLiveDocId(division));
    const snap = await withTimeout(getDoc(docRef), 4000);
    hasEverFetchedRemote[division] = true;
    if (snap.exists()) {
      let merged = mergeLiveStatuses(snap.data(), readLocalCache(division) || localData, division);
      if (division === 'student' && (!Array.isArray(merged?.history) || merged.history.length < 232 || merged.status !== 'finished')) {
        merged = getDefaultLiveStatus('student');
      }
      if (division === 'adult' && (!Array.isArray(merged?.history) || merged.history.length < 141 || merged.status !== 'finished')) {
        merged = getDefaultLiveStatus('adult');
      }
      writeLocalCache(division, merged);
      notifyStatusListeners(division, merged);
      return merged;
    }
  } catch (err) {
    console.warn("[LiveStatus] fetchLiveStatus warning (using local cache):", err.message || err);
  }

  return getInitialLiveStatus(division);
}

/**
 * 로컬 캐시에 즉시 저장하고 백그라운드 DB 동기화 큐에 등록
 */
export async function saveLiveStatus(division, newStatus) {
  const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const payload = {
    ...newStatus,
    pending_sync: true,
    local_action_id: actionId,
    updated_at: new Date().toISOString()
  };
  writeLocalCache(division, payload);
  notifyStatusListeners(division, payload);
  scheduleBackgroundSync(division, 0);
  return payload;
}

// ──────────────────────────────────────────────────────────────────────────
// 🚀 개별 경기 카드 [시작] / [취소] / [휴게] / [경기종료] 즉시 반영(Optimistic) 함수
// DB 통신을 기다리지 않고 0ms 만에 로컬 상태를 계산·반영하며, 백그라운드에서 DB와 병합·동기화
// ──────────────────────────────────────────────────────────────────────────

/**
 * 특정 경기 카드의 [시작 아이콘] 클릭 시 해당 조 즉시 시작 처리
 */
export async function startRaceAt(division, targetRaceIndex, fallbackStatus = null) {
  const localData = readLocalCache(division);
  const current = mergeLiveStatuses(fallbackStatus, localData, division) || getDefaultLiveStatus(division);
  const races = division === 'adult' ? ADULT_RACES_DATA : STUDENT_RACES_DATA;
  const validIndex = Math.max(1, Math.min(races.length, Number(targetRaceIndex)));
  const now = new Date();
  const nowStr = now.toISOString();

  let history = Array.isArray(current.history) ? [...current.history] : [];
  let hasUnmergedInterpolation = Boolean(current.has_unmerged_interpolation);

  // 직전 진행 중이던 조가 있고, 그 다음/이후 조를 시작한 경우 직전(및 건너뛴 중간) 조 소요시간을 비례 배분하여 모두 기록
  if (current.status === 'running' && current.current_race_index > 0 && current.current_race_index < validIndex) {
    const startIdx = current.current_race_index;
    const endIdx = validIndex - 1;
    const prevStart = current.current_race_started_at
      ? new Date(current.current_race_started_at)
      : new Date(now.getTime() - (endIdx - startIdx + 1) * 75000);

    history = history.filter(h => h.race_index < startIdx || h.race_index > endIdx);
    const spanItems = interpolateSpanHistory(
      races,
      startIdx,
      endIdx,
      prevStart.getTime(),
      now.getTime(),
      endIdx > startIdx
    );
    history.push(...spanItems);
  } else if (current.current_race_index === 0 && validIndex > 1) {
    // 아직 이전 경기 정보가 로딩되지 않았거나 1조가 아닌 중간 조에서 바로 시작한 경우:
    // 공식 시작(08:30)부터 건너뛴 1~(validIndex-1)조까지 임시 보간(is_interpolated: true)으로 채워두고,
    // 추후 DB에서 실제 1~(validIndex-1)조 기록이 도착하면 mergeLiveStatuses가 실제 기록으로 자동 교체!
    const officialStart = new Date(now.getTime());
    officialStart.setHours(8, 30, 0, 0);
    const spanCount = validIndex - 1;
    const baseStartMs = officialStart.getTime() < now.getTime() - spanCount * 30000
      ? officialStart.getTime()
      : now.getTime() - spanCount * 85000;

    history = history.filter(h => h.race_index >= validIndex);
    const spanItems = interpolateSpanHistory(
      races,
      1,
      validIndex - 1,
      baseStartMs,
      now.getTime(),
      true
    );
    history.push(...spanItems);
    if (!hasEverFetchedRemote[division]) {
      hasUnmergedInterpolation = true;
    }
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
    started_at: current.started_at || history[0]?.started_at || nowStr,
    current_race_started_at: nowStr,
    finished_at: null,
    is_paused: false,
    pause_started_at: null,
    history,
    breaks,
    last_action_type: 'advance',
    has_unmerged_interpolation: hasUnmergedInterpolation,
    updated_at: nowStr
  };

  return saveLiveStatus(division, newStatus);
}

/**
 * 특정 경기 카드의 [시작 취소 아이콘] 클릭 시 해당 조 시작 즉시 취소 처리
 */
export async function cancelRaceAt(division, targetRaceIndex, fallbackStatus = null) {
  const localData = readLocalCache(division);
  const current = mergeLiveStatuses(fallbackStatus, localData, division) || getDefaultLiveStatus(division);
  const validIndex = Number(targetRaceIndex);
  const nowStr = new Date().toISOString();

  let history = Array.isArray(current.history) ? [...current.history] : [];
  let breaks = Array.isArray(current.breaks) ? [...current.breaks] : [];

  // 1조이거나 아직 시작 전이면 전체 대기 상태(ready)로 초기화
  if (validIndex <= 1 || current.current_race_index <= 1) {
    const resetState = {
      ...getDefaultLiveStatus(division),
      last_action_type: 'reset',
      has_unmerged_interpolation: false,
      updated_at: nowStr
    };
    return saveLiveStatus(division, resetState);
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
    finished_at: null,
    is_paused: false,
    pause_started_at: null,
    history,
    breaks,
    last_action_type: 'cancel',
    updated_at: nowStr
  };

  return saveLiveStatus(division, newStatus);
}

/**
 * [휴게 시작] 버튼 클릭 시: 현재 진행 순서 다음(또는 클릭한 예정 휴식 카드)에 녹색 휴게 즉시 시작
 */
export async function startBreak(division, fallbackStatus = null, targetBreakId = null) {
  const localData = readLocalCache(division);
  const current = mergeLiveStatuses(fallbackStatus, localData, division) || getDefaultLiveStatus(division);
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
      duration_sec: prevDuration,
      is_interpolated: false
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
    last_action_type: 'break',
    updated_at: nowStr
  };

  return saveLiveStatus(division, newStatus);
}

/**
 * [휴게 종료] 버튼 클릭 시: 휴게 카드를 완료 기록으로 남기고 바로 다음 순번 경기를 자동 시작
 */
export async function endBreak(division, breakId, fallbackStatus = null) {
  const localData = readLocalCache(division);
  const current = mergeLiveStatuses(fallbackStatus, localData, division) || getDefaultLiveStatus(division);
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
    last_action_type: 'advance',
    updated_at: nowStr
  };

  return saveLiveStatus(division, newStatus);
}

/**
 * [휴게 취소] 버튼 클릭 시: 해당 휴게 카드를 삭제하고 이전 상태로 복귀
 */
export async function cancelBreak(division, breakId, fallbackStatus = null) {
  const localData = readLocalCache(division);
  const current = mergeLiveStatuses(fallbackStatus, localData, division) || getDefaultLiveStatus(division);
  const nowStr = new Date().toISOString();

  let breaks = Array.isArray(current.breaks) ? [...current.breaks] : [];
  let removedScheduledIds = Array.isArray(current.removed_scheduled_break_ids)
    ? [...current.removed_scheduled_break_ids]
    : [];
  const targetBreak = breaks.find(b => (breakId && b.id === breakId) || (!breakId && b.state === 'running'));

  if (targetBreak && String(targetBreak.id || '').startsWith('sched_brk_') && targetBreak.state !== 'scheduled') {
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
    last_action_type: 'break_cancel',
    updated_at: nowStr
  };

  return saveLiveStatus(division, newStatus);
}

/**
 * 마지막 경기 이후 [🏁 경기종료] 버튼 클릭 시:
 * 현재 진행 중인 마지막 조(또는 남은 조들)의 소요시간을 기록하고 전체 대회를 완료(finished) 상태로 전환
 */
export async function finishAllRaces(division, fallbackStatus = null) {
  const localData = readLocalCache(division);
  const current = mergeLiveStatuses(fallbackStatus, localData, division) || getDefaultLiveStatus(division);
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

    history = history.filter(h => h.race_index < startIdx || h.race_index > endIdx);
    const spanItems = interpolateSpanHistory(
      races,
      startIdx,
      endIdx,
      prevStart.getTime(),
      now.getTime(),
      endIdx > startIdx
    );
    history.push(...spanItems);
  }

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
    last_action_type: 'finish',
    updated_at: nowStr
  };

  return saveLiveStatus(division, newStatus);
}

/**
 * [↩ 경기종료 취소] 버튼 클릭 시:
 * 전 경기 종료(finished) 상태를 해제하고 마지막 조(totalRaces) 진행 중(running) 상태로 복귀
 */
export async function cancelFinishAllRaces(division, fallbackStatus = null) {
  const localData = readLocalCache(division);
  const current = mergeLiveStatuses(fallbackStatus, localData, division) || getDefaultLiveStatus(division);
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
    last_action_type: 'cancel',
    updated_at: nowStr
  };

  return saveLiveStatus(division, newStatus);
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
