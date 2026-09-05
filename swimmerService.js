// ==========================================================================
// GMDC Swim Club - Swimmer Domain Service (선수 데이터 및 도메인 로직)
// Pure domain functions for swimmer normalization, filtering, relay mapping,
// and match participation check. No direct DOM dependencies.
// ==========================================================================

/**
 * Formats birthId e.g. "19840221-1" -> "84.02.21"
 * @param {string|number} birthId
 * @returns {string}
 */
export function formatBirthDisplay(birthId) {
  if (!birthId) return '-';
  const digits = String(birthId).replace(/[^0-9]/g, '');
  if (digits.length >= 6) {
    const yy = digits.length >= 8 ? digits.slice(2, 4) : digits.slice(0, 2);
    const mm = digits.length >= 8 ? digits.slice(4, 6) : digits.slice(2, 4);
    const dd = digits.length >= 8 ? digits.slice(6, 8) : digits.slice(4, 6);
    return `${yy}.${mm}.${dd}`;
  }
  return String(birthId);
}

/**
 * Checks if a swimmer is active (relies solely on the 'disabled' data flag)
 * @param {Object} s - Swimmer object
 * @returns {boolean}
 */
export function isSwimmerActive(s) {
  if (!s) return false;
  if (s.disabled === true || s.disabled === 'true') return false;
  return true;
}

/**
 * Gets unique swimmer key for map lookups and state management
 * @param {Object} s - Swimmer object
 * @returns {string}
 */
export function getSwimmerKey(s) {
  return `${s.division}_${s.id}_${s.name}`;
}

/**
 * Compresses individual strokes e.g. ["자유형 50", "평영 50"] -> "자/평"
 * @param {string[]} events
 * @returns {string}
 */
export function compressIndividualEvents(events) {
  if (!events || events.length === 0) return '';
  const map = {
    '자유형 50': '자',
    '배영 50': '배',
    '평영 50': '평',
    '접영 50': '접',
    '핀자유형 50': '핀자',
    '핀접영 50': '핀접',
    '자유형': '자',
    '배영': '배',
    '평영': '평',
    '접영': '접',
    '핀자유형': '핀자',
    '핀접영': '핀접'
  };
  const list = events.map(e => {
    const trimmed = (e || '').trim();
    return map[trimmed] || trimmed;
  }).filter(Boolean);
  return list.join('/');
}

/**
 * Gets relay assignments for a swimmer based on pinned relay states
 * @param {Object} swimmer
 * @param {Object} adultPinnedRelays
 * @param {Object} studentPinnedRelays
 * @returns {Array<{ simple: string, detailed: string }>}
 */
export function getSwimmerRelays(swimmer, adultPinnedRelays = {}, studentPinnedRelays = {}) {
  const relays = [];
  const name = (swimmer.name || '').trim();
  if (!name) return relays;

  if (swimmer.division === 'adult') {
    const team = swimmer.team || 'A';
    const teamPins = adultPinnedRelays[team] || adultPinnedRelays['A'];
    if (teamPins) {
      // combo1: 혼성 핀계영 300m -> 핀혼성
      if (Array.isArray(teamPins.combo1) && teamPins.combo1.includes(name)) {
        relays.push({ simple: '핀혼성', detailed: '혼성 핀계영' });
      }
      // combo2: 남자 계영 200m -> 남계
      if (Array.isArray(teamPins.combo2) && teamPins.combo2.includes(name)) {
        relays.push({ simple: '남계', detailed: '남 계영' });
      }
      // combo3: 여자 계영 200m -> 여계
      if (Array.isArray(teamPins.combo3) && teamPins.combo3.includes(name)) {
        relays.push({ simple: '여계', detailed: '여 계영' });
      }
      // combo4: 남자 혼계영 200m -> 남혼계(배)
      if (teamPins.combo4 && typeof teamPins.combo4 === 'object') {
        const strokeNames = { back: '배', breast: '평', fly: '접', free: '자' };
        const fullStrokeNames = { back: '배영', breast: '평영', fly: '접영', free: '자유형' };
        for (const [st, pName] of Object.entries(teamPins.combo4)) {
          if (pName === name) {
            const shortSt = strokeNames[st] || st;
            const fullSt = fullStrokeNames[st] || st;
            relays.push({ simple: `남혼계(${shortSt})`, detailed: `남 혼계영(${fullSt})` });
          }
        }
      }
      // combo5: 여자 혼계영 200m -> 여혼계(배)
      if (teamPins.combo5 && typeof teamPins.combo5 === 'object') {
        const strokeNames = { back: '배', breast: '평', fly: '접', free: '자' };
        const fullStrokeNames = { back: '배영', breast: '평영', fly: '접영', free: '자유형' };
        for (const [st, pName] of Object.entries(teamPins.combo5)) {
          if (pName === name) {
            const shortSt = strokeNames[st] || st;
            const fullSt = fullStrokeNames[st] || st;
            relays.push({ simple: `여혼계(${shortSt})`, detailed: `여 혼계영(${fullSt})` });
          }
        }
      }
    }
  } else if (swimmer.division === 'student') {
    const pins = studentPinnedRelays;
    if (pins) {
      // combo1: 남학생 계영 -> 남계
      if (Array.isArray(pins.combo1) && pins.combo1.includes(name)) {
        relays.push({ simple: '남계', detailed: '남학생 계영' });
      }
      // combo2: 여학생 계영 -> 여계
      if (Array.isArray(pins.combo2) && pins.combo2.includes(name)) {
        relays.push({ simple: '여계', detailed: '여학생 계영' });
      }
      // combo3: 남학생 혼계영 -> 남혼계(배)
      if (pins.combo3 && typeof pins.combo3 === 'object') {
        const strokeNames = { back: '배', breast: '평', fly: '접', free: '자' };
        const fullStrokeNames = { back: '배영', breast: '평영', fly: '접영', free: '자유형' };
        for (const [st, pName] of Object.entries(pins.combo3)) {
          if (pName === name) {
            const shortSt = strokeNames[st] || st;
            const fullSt = fullStrokeNames[st] || st;
            relays.push({ simple: `남혼계(${shortSt})`, detailed: `남학생 혼계영(${fullSt})` });
          }
        }
      }
      // combo4: 여학생 혼계영 -> 여혼계(배)
      if (pins.combo4 && typeof pins.combo4 === 'object') {
        const strokeNames = { back: '배', breast: '평', fly: '접', free: '자' };
        const fullStrokeNames = { back: '배영', breast: '평영', fly: '접영', free: '자유형' };
        for (const [st, pName] of Object.entries(pins.combo4)) {
          if (pName === name) {
            const shortSt = strokeNames[st] || st;
            const fullSt = fullStrokeNames[st] || st;
            relays.push({ simple: `여혼계(${shortSt})`, detailed: `여학생 혼계영(${fullSt})` });
          }
        }
      }
    }
  }

  return relays;
}

/**
 * Renders Swimmer Events Cell HTML (Individual + Relay, Multi-line support)
 * @param {Object} s - Swimmer
 * @param {'simple'|'detailed'} mode
 * @param {Object} adultPinnedRelays
 * @param {Object} studentPinnedRelays
 * @returns {string} HTML string
 */
export function renderSwimmerEvents(s, mode = 'simple', adultPinnedRelays = {}, studentPinnedRelays = {}) {
  const indivEvents = [s.event1, s.event2].filter(Boolean);
  const relayEvents = getSwimmerRelays(s, adultPinnedRelays, studentPinnedRelays);

  if (indivEvents.length === 0 && relayEvents.length === 0) {
    return `<span style="color:var(--text-muted); font-size:11px;">-</span>`;
  }

  const htmlParts = [];

  if (mode === 'simple') {
    // 간략히 (Compressed mode: 자/평, 핀혼성, 남계 등)
    const indivCompressed = compressIndividualEvents(indivEvents);
    if (indivCompressed) {
      htmlParts.push(`<span class="event-chip indiv-chip" title="개인: ${indivEvents.join(', ')}">${indivCompressed}</span>`);
    }
    relayEvents.forEach(r => {
      htmlParts.push(`<span class="event-chip relay-chip" title="단체전: ${r.detailed}">${r.simple}</span>`);
    });
  } else {
    // 자세히 (Detailed mode: 자유형 50, 평영 50, 혼성 핀계영 등)
    indivEvents.forEach(e => {
      htmlParts.push(`<span class="event-chip indiv-chip-detailed" title="개인종목">${e}</span>`);
    });
    relayEvents.forEach(r => {
      htmlParts.push(`<span class="event-chip relay-chip-detailed" title="단체전">${r.detailed}</span>`);
    });
  }

  return `<div class="events-chips-wrapper">${htmlParts.join('')}</div>`;
}

/**
 * Checks swimmer's participation in a specific match event
 * @param {Object} swimmer
 * @param {Object} matchEvent
 * @param {Object} adultPinnedRelays
 * @param {Object} studentPinnedRelays
 * @returns {{ isParticipating: boolean, label?: string, detail?: string }}
 */
export function checkSwimmerMatchParticipation(swimmer, matchEvent, adultPinnedRelays = {}, studentPinnedRelays = {}) {
  const indivEvents = [swimmer.event1, swimmer.event2].filter(Boolean);
  const relayEvents = getSwimmerRelays(swimmer, adultPinnedRelays, studentPinnedRelays);
  const isStudent = swimmer.division === 'student';

  if (matchEvent.type === 'indiv') {
    for (const rawEvt of indivEvents) {
      const e = (rawEvt || '').trim();
      const groupStr = swimmer.group ? `${swimmer.group}` : '';
      const genderStr = swimmer.gender === '여' ? '여자부' : '남자부';
      const detailBadge = `${groupStr} ${genderStr}`.trim();

      if (matchEvent.stroke === '핀접영' && (e.includes('핀접영') || e === '핀접')) {
        return { isParticipating: true, label: `개인전 (${e})`, detail: detailBadge };
      }
      if (matchEvent.stroke === '핀자유형' && (e.includes('핀자유형') || e === '핀자')) {
        return { isParticipating: true, label: `개인전 (${e})`, detail: detailBadge };
      }
      if (matchEvent.stroke === '접영' && !e.includes('핀') && (e.includes('접영') || e === '접')) {
        return { isParticipating: true, label: `개인전 (${e})`, detail: detailBadge };
      }
      if (matchEvent.stroke === '자유형' && !e.includes('핀') && (e.includes('자유형') || e === '자')) {
        return { isParticipating: true, label: `개인전 (${e})`, detail: detailBadge };
      }
      if (matchEvent.stroke === '배영' && (e.includes('배영') || e === '배')) {
        return { isParticipating: true, label: `개인전 (${e})`, detail: detailBadge };
      }
      if (matchEvent.stroke === '평영' && (e.includes('평영') || e === '평')) {
        return { isParticipating: true, label: `개인전 (${e})`, detail: detailBadge };
      }
    }
  } else if (matchEvent.type === 'relay') {
    for (const r of relayEvents) {
      const det = r.detailed || '';
      const teamPrefix = !isStudent && swimmer.team ? `${swimmer.team}팀 ` : '';

      if (matchEvent.stroke === 'fin_mixed_relay') {
        if (det.includes('혼성 핀계영') || det.includes('핀혼성') || r.simple.includes('핀혼성')) {
          return { isParticipating: true, label: `단체전 출전`, detail: `${teamPrefix}${det}` };
        }
      } else if (matchEvent.stroke === 'medley_relay') {
        if (det.includes('혼계영') || r.simple.includes('혼계')) {
          return { isParticipating: true, label: `단체전 출전`, detail: `${teamPrefix}${det}` };
        }
      } else if (matchEvent.stroke === 'free_relay') {
        if ((det.includes('계영') && !det.includes('혼계영') && !det.includes('핀계영')) || (r.simple.includes('남계') || r.simple.includes('여계'))) {
          return { isParticipating: true, label: `단체전 출전`, detail: `${teamPrefix}${det}` };
        }
      }
    }
  }

  return { isParticipating: false };
}

/**
 * Filters swimmers based on UI controls (Disabled swimmers always excluded)
 * @param {Array} allSwimmers
 * @param {Object} options
 * @param {string} options.divisionFilter - 'all' | 'adult' | 'student'
 * @param {string} options.teamFilter - 'all' | 'A' | 'B'
 * @param {string} options.searchQuery
 * @returns {Array} Filtered swimmer array
 */
export function filterSwimmers(allSwimmers = [], { divisionFilter = 'all', teamFilter = 'all', searchQuery = '' } = {}) {
  return allSwimmers.filter(s => {
    // 1. Always exclude disabled / inactive swimmers
    if (!isSwimmerActive(s)) return false;

    // 2. Division filter
    if (divisionFilter === 'adult' && s.division !== 'adult') return false;
    if (divisionFilter === 'student' && s.division !== 'student') return false;

    // 3. Team filter
    if (teamFilter === 'A' && (s.team || 'A') !== 'A') return false;
    if (teamFilter === 'B' && (s.team || 'A') !== 'B') return false;

    // 4. Search query
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const groupMatch = (s.group || '').toLowerCase().includes(q);
      if (!nameMatch && !groupMatch) return false;
    }

    return true;
  });
}

/**
 * Sorts swimmers by name (Korean alphabetical order)
 * @param {Array} swimmers
 * @returns {Array} Sorted array copy
 */
export function sortSwimmersByName(swimmers = []) {
  return [...swimmers].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
}

/**
 * Normalizes and loads swimmer roster from cache / fallbacks
 * @param {Object} options
 * @param {Array} options.adultFallback
 * @param {Array} options.studentFallback
 * @param {string} options.adultStorageKey
 * @param {string} options.studentStorageKey
 * @returns {Array} Combined sorted swimmer roster (Adults first, then Students)
 */
export function loadSwimmerRosterFromStorage({ adultFallback = [], studentFallback = [], adultStorageKey, studentStorageKey }) {
  let adults = [];
  try {
    const saved = localStorage.getItem(adultStorageKey);
    if (saved) {
      adults = JSON.parse(saved);
    }
  } catch (e) {}
  if (!Array.isArray(adults) || adults.length === 0) {
    adults = adultFallback;
  }
  adults = adults.map(s => ({ ...s, division: 'adult' }));

  let students = [];
  try {
    const savedSt = localStorage.getItem(studentStorageKey);
    if (savedSt) {
      students = JSON.parse(savedSt);
    }
  } catch (e) {}
  if (!Array.isArray(students) || students.length === 0) {
    students = studentFallback;
  }
  students = students.map(s => ({ ...s, division: 'student', team: s.team || '학생' }));

  const sortedAdults = sortSwimmersByName(adults);
  const sortedStudents = sortSwimmersByName(students);

  return [...sortedAdults, ...sortedStudents];
}
