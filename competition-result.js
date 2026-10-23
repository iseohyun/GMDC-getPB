// ==========================================================================
// GMDC Swim Club - 2026 거제시장배 전국마스터즈 수영대회 전력 분석 & 전체 출전선수 현황
// 대진표(공지용).xlsx 기반 타팀 전력(연령대/그룹, 성별, 종목 그래프·표) 및 전체 출전선수 명단
// ==========================================================================

import { ADULT_RACES_DATA, STUDENT_RACES_DATA } from "./races-data.js?v=20261024_09";

const ADULT_GROUPS = ["1그룹", "2그룹", "3그룹", "4그룹", "5그룹", "6그룹"];
const STUDENT_GROUPS = ["1그룹", "2그룹", "3그룹", "4그룹", "5그룹", "6그룹", "7그룹"];

const ADULT_STROKES = [
  { key: "핀자유형", label: "핀자유형 50m", shortLabel: "핀자유", cls: "seg-fin-free", swatchCls: "swatch-fin-free" },
  { key: "핀접영",   label: "핀접영 50m",   shortLabel: "핀접영", cls: "seg-fin-fly",  swatchCls: "swatch-fin-fly" },
  { key: "자유형",   label: "자유형 50m",   shortLabel: "자유형", cls: "seg-free",     swatchCls: "swatch-free" },
  { key: "배영",     label: "배영 50m",     shortLabel: "배영",   cls: "seg-back",     swatchCls: "swatch-back" },
  { key: "평영",     label: "평영 50m",     shortLabel: "평영",   cls: "seg-breast",   swatchCls: "swatch-breast" },
  { key: "접영",     label: "접영 50m",     shortLabel: "접영",   cls: "seg-fly",      swatchCls: "swatch-fly" }
];

const STUDENT_STROKES = [
  { key: "자유형", label: "자유형 50m", shortLabel: "자유형", cls: "seg-free",   swatchCls: "swatch-free" },
  { key: "배영",   label: "배영 50m",   shortLabel: "배영",   cls: "seg-back",   swatchCls: "swatch-back" },
  { key: "평영",   label: "평영 50m",   shortLabel: "평영",   cls: "seg-breast", swatchCls: "swatch-breast" },
  { key: "접영",   label: "접영 50m",   shortLabel: "접영",   cls: "seg-fly",    swatchCls: "swatch-fly" }
];

const OUR_TEAMS = new Set(["거제몽꾸", "거제야르"]);

// State
let currentDivision = "adult"; // 'adult' | 'student'
let summaryViewMode = "chart"; // 'chart' (기본) | 'table'
let selectedTeamFilter = "all"; // 'all' | 'other_all' | 특정 팀명
let selectedGenderFilter = "all"; // 'all' | '남' | '여'
let selectedGroupFilter = "all"; // 'all' | '1그룹' ...
let selectedStrokeFilter = "all"; // 'all' | '자유형' ...
let searchQuery = "";

// Parsed datasets cache
const parsedCache = {
  adult: null,
  student: null
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 대진표 레이스 배열로부터 선수별 출전 정보 및 팀별 전력 데이터를 추출
 */
function parseDivisionData(races, divisionKey) {
  const groups = divisionKey === "adult" ? ADULT_GROUPS : STUDENT_GROUPS;
  const strokes = divisionKey === "adult" ? ADULT_STROKES : STUDENT_STROKES;

  const swimmerMap = new Map();
  const teamStatsMap = new Map();

  function ensureTeam(teamName) {
    if (!teamStatsMap.has(teamName)) {
      const groupCounts = {};
      groups.forEach(g => { groupCounts[g] = 0; });
      const strokeCounts = {};
      strokes.forEach(s => { strokeCounts[s.key] = 0; });

      teamStatsMap.set(teamName, {
        team: teamName,
        isOurTeam: OUR_TEAMS.has(teamName),
        swimmerKeys: new Set(),
        maleSwimmerKeys: new Set(),
        femaleSwimmerKeys: new Set(),
        indivEntries: 0,
        relayEntries: 0,
        relayEvents: [],
        groupSwimmerKeys: new Map(groups.map(g => [g, new Set()])),
        groupCounts,
        strokeCounts
      });
    }
    return teamStatsMap.get(teamName);
  }

  for (const race of races) {
    // 통합조(합침)에서 각 original_match_no별 실제 그룹/성별 추출
    const headerMeta = new Map();
    for (const h of (race.original_headers || [])) {
      const m = h.match(/^(\d+(?:-\d+)?)\.\s*(.+)$/);
      if (m) {
        const no = m[1];
        const title = m[2];
        const grpMatch = title.match(/([1-7]그룹)/);
        const genMatch = title.match(/(남자|여자)/);
        headerMeta.set(no, {
          group: grpMatch ? grpMatch[1] : race.group,
          gender: genMatch ? (genMatch[1] === "남자" ? "남" : "여") : (race.gender === "남자" ? "남" : "여")
        });
      }
    }

    for (const lane of (race.lanes || [])) {
      const teamName = (lane.team || "개인").trim() || "개인";
      const tStat = ensureTeam(teamName);

      if (race.is_relay) {
        tStat.relayEntries++;
        const relayLabel = `${race.gender} ${race.stroke} ${race.distance}`.replace(/\s+/g, " ").trim();
        if (!tStat.relayEvents.includes(relayLabel)) {
          tStat.relayEvents.push(relayLabel);
        }
        continue;
      }

      const swimmerName = (lane.name || "").trim();
      if (!swimmerName) continue;

      const meta = headerMeta.get(String(lane.original_match_no)) || {
        group: race.group,
        gender: race.gender === "남자" ? "남" : "여"
      };

      const group = groups.includes(meta.group) ? meta.group : groups[0];
      const gender = meta.gender === "여" ? "여" : "남";
      const strokeKey = race.stroke;

      const swKey = `${teamName}|${swimmerName}|${gender}|${group}`;
      if (!swimmerMap.has(swKey)) {
        swimmerMap.set(swKey, {
          key: swKey,
          team: teamName,
          isOurTeam: OUR_TEAMS.has(teamName),
          name: swimmerName,
          gender,
          group,
          events: []
        });
      }

      const sw = swimmerMap.get(swKey);
      sw.events.push({
        stroke: strokeKey,
        distance: race.distance || "50m",
        matchNo: String(lane.original_match_no || race.primary_match_no),
        primaryMatchNo: String(race.primary_match_no),
        lane: lane.lane,
        record: lane.record || null,
        rank: lane.rank || null
      });

      tStat.swimmerKeys.add(swKey);
      if (gender === "남") tStat.maleSwimmerKeys.add(swKey);
      else tStat.femaleSwimmerKeys.add(swKey);

      tStat.groupSwimmerKeys.get(group)?.add(swKey);
      tStat.indivEntries++;
      if (tStat.strokeCounts[strokeKey] !== undefined) {
        tStat.strokeCounts[strokeKey]++;
      }
    }
  }

  // 그룹별 고유 선수 수 집계
  for (const tStat of teamStatsMap.values()) {
    groups.forEach(g => {
      tStat.groupCounts[g] = tStat.groupSwimmerKeys.get(g)?.size || 0;
    });
  }

  const swimmers = [...swimmerMap.values()].sort((a, b) => {
    // 소속팀 인원수 내림차순 -> 그룹 오름차순 -> 성별 -> 이름순
    const teamCountDiff = (teamStatsMap.get(b.team)?.swimmerKeys.size || 0) - (teamStatsMap.get(a.team)?.swimmerKeys.size || 0);
    if (teamCountDiff !== 0) return teamCountDiff;
    if (a.team !== b.team) return a.team.localeCompare(b.team, "ko");
    const gDiff = groups.indexOf(a.group) - groups.indexOf(b.group);
    if (gDiff !== 0) return gDiff;
    if (a.gender !== b.gender) return a.gender === "남" ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });

  const teams = [...teamStatsMap.values()].sort((a, b) => {
    if (b.swimmerKeys.size !== a.swimmerKeys.size) {
      return b.swimmerKeys.size - a.swimmerKeys.size;
    }
    if (b.indivEntries !== a.indivEntries) {
      return b.indivEntries - a.indivEntries;
    }
    return a.team.localeCompare(b.team, "ko");
  });

  return {
    divisionKey,
    groups,
    strokes,
    swimmers,
    teams,
    totalSwimmers: swimmers.length,
    totalIndivEntries: swimmers.reduce((sum, s) => sum + s.events.length, 0),
    totalRelayEntries: teams.reduce((sum, t) => sum + t.relayEntries, 0)
  };
}

function getDivisionData(divisionKey) {
  if (!parsedCache[divisionKey]) {
    const raw = divisionKey === "adult" ? ADULT_RACES_DATA : STUDENT_RACES_DATA;
    parsedCache[divisionKey] = parseDivisionData(raw, divisionKey);
  }
  return parsedCache[divisionKey];
}

/**
 * 현재 선택된 팀 필터('all' | 'other_all' | 특정 팀명)에 해당하는 선수 목록 반환
 */
function getTeamFilteredSwimmers(data) {
  if (selectedTeamFilter === "all") {
    return data.swimmers;
  }
  if (selectedTeamFilter === "other_all") {
    return data.swimmers.filter(s => !s.isOurTeam);
  }
  return data.swimmers.filter(s => s.team === selectedTeamFilter);
}

/**
 * 상단 부문 탭 및 요약 배지 업데이트
 */
function renderDivisionHeaderAndTeamChips() {
  const adultData = getDivisionData("adult");
  const studentData = getDivisionData("student");
  const data = getDivisionData(currentDivision);

  // 부문 탭 텍스트 및 활성화
  const btnAdult = document.getElementById("tabBtnAdult");
  const btnStudent = document.getElementById("tabBtnStudent");
  if (btnAdult) {
    btnAdult.classList.toggle("active", currentDivision === "adult");
    btnAdult.innerHTML = `🏊 성인부 (25일) <span class="tab-sub-badge">${adultData.teams.length}개팀 · ${adultData.totalSwimmers}명</span>`;
  }
  if (btnStudent) {
    btnStudent.classList.toggle("active", currentDivision === "student");
    btnStudent.innerHTML = `🧒 학생부 (24일) <span class="tab-sub-badge">${studentData.teams.length}개팀 · ${studentData.totalSwimmers}명</span>`;
  }

  // 팀 선택 칩 렌더링
  const chipsContainer = document.getElementById("teamFilterChips");
  if (chipsContainer) {
    const otherSwimmerCount = data.swimmers.filter(s => !s.isOurTeam).length;
    const allChipHtml = `
      <button type="button" class="team-power-chip ${selectedTeamFilter === "all" ? "active" : ""}" data-team-filter="all">
        <span>🌐 전체 대회 출전선수</span>
        <span class="chip-count">${data.totalSwimmers}명</span>
      </button>
      <button type="button" class="team-power-chip chip-other-all ${selectedTeamFilter === "other_all" ? "active" : ""}" data-team-filter="other_all">
        <span>⚔️ 타팀 전체 (우리팀 제외)</span>
        <span class="chip-count">${otherSwimmerCount}명</span>
      </button>
    `;

    const teamChipsHtml = data.teams.map(t => {
      const isSelected = selectedTeamFilter === t.team ? "active" : "";
      const ourCls = t.team === "거제몽꾸" ? "is-mongkku" : t.team === "거제야르" ? "is-yareu" : "";
      return `
        <button type="button" class="team-power-chip ${ourCls} ${isSelected}" data-team-filter="${escapeHtml(t.team)}">
          <span>${t.isOurTeam ? "🏊 " : ""}${escapeHtml(t.team)}</span>
          <span class="chip-count">${t.swimmerKeys.size}명</span>
        </button>
      `;
    }).join("");

    chipsContainer.innerHTML = allChipHtml + teamChipsHtml;
  }

  // 하단 툴바의 팀/그룹/종목 셀렉트 옵션 동기화
  const teamSelect = document.getElementById("compTeamSelect");
  if (teamSelect) {
    teamSelect.innerHTML = `
      <option value="all">🌐 전체 대회 출전선수 (${data.totalSwimmers}명)</option>
      <option value="other_all">⚔️ 타팀 전체 (${data.swimmers.filter(s => !s.isOurTeam).length}명)</option>
      ${data.teams.map(t => `<option value="${escapeHtml(t.team)}">${escapeHtml(t.team)} (${t.swimmerKeys.size}명 / ${t.indivEntries}출전)</option>`).join("")}
    `;
    teamSelect.value = selectedTeamFilter;
  }

  const groupSelect = document.getElementById("compGroupSelect");
  if (groupSelect) {
    if (selectedGroupFilter !== "all" && !data.groups.includes(selectedGroupFilter)) {
      selectedGroupFilter = "all";
    }
    groupSelect.innerHTML = `
      <option value="all">모든 연령대(그룹)</option>
      ${data.groups.map(g => `<option value="${g}">${g}</option>`).join("")}
    `;
    groupSelect.value = selectedGroupFilter;
  }

  const strokeSelect = document.getElementById("compStrokeSelect");
  if (strokeSelect) {
    if (selectedStrokeFilter !== "all" && !data.strokes.some(s => s.key === selectedStrokeFilter)) {
      selectedStrokeFilter = "all";
    }
    strokeSelect.innerHTML = `
      <option value="all">모든 종목</option>
      ${data.strokes.map(s => `<option value="${s.key}">${s.label}</option>`).join("")}
    `;
    strokeSelect.value = selectedStrokeFilter;
  }
}

/**
 * 신청서 개인 페이지와 동일한 누적 막대그래프(기본) 렌더링
 */
function renderSummaryChart() {
  const chartContainer = document.getElementById("summaryChartContainer");
  const chartLegend = document.getElementById("summaryChartLegend");
  const summaryTitle = document.getElementById("summarySectionTitle");
  const maleTitle = document.getElementById("maleMatrixTitle");
  const femaleTitle = document.getElementById("femaleMatrixTitle");
  if (!chartContainer) return;

  const data = getDivisionData(currentDivision);
  const targetSwimmers = getTeamFilteredSwimmers(data);
  const targetEntriesCount = targetSwimmers.reduce((sum, s) => sum + s.events.length, 0);

  const scopeLabel = selectedTeamFilter === "all"
    ? `전체 대회 출전선수 (${targetSwimmers.length}명 · ${targetEntriesCount}출전)`
    : selectedTeamFilter === "other_all"
      ? `타팀 전체 (${targetSwimmers.length}명 · ${targetEntriesCount}출전)`
      : `[${selectedTeamFilter}] 전력 분석 (${targetSwimmers.length}명 · ${targetEntriesCount}출전)`;

  const divTitle = currentDivision === "adult" ? "성인부" : "학생부";
  if (summaryTitle) {
    summaryTitle.textContent = `📊 ${divTitle} 연령대(그룹)·성별·종목 출전 요약 — ${scopeLabel}`;
  }
  if (maleTitle) {
    maleTitle.textContent = `👨 남성 출전 요약 (${selectedTeamFilter === "all" ? "전체" : selectedTeamFilter === "other_all" ? "타팀 전체" : selectedTeamFilter})`;
  }
  if (femaleTitle) {
    femaleTitle.textContent = `👩 여성 출전 요약 (${selectedTeamFilter === "all" ? "전체" : selectedTeamFilter === "other_all" ? "타팀 전체" : selectedTeamFilter})`;
  }

  // 범례 렌더링 (성인부 6종목 / 학생부 4종목)
  if (chartLegend) {
    chartLegend.innerHTML = `
      ${data.strokes.map(s => `<span class="chart-legend-item"><span class="chart-legend-swatch ${s.swatchCls}"></span>${escapeHtml(s.key)}</span>`).join("")}
      <span class="chart-legend-sep">|</span>
      <span class="chart-legend-note">하단: 남성 · 상단: 여성 (굵은 선 경계)</span>
    `;
    chartLegend.style.display = summaryViewMode === "chart" ? "flex" : "none";
  }

  let maxBarTotal = 0;

  const groupBarsData = data.groups.map(groupName => {
    const groupSwimmers = targetSwimmers.filter(s => s.group === groupName);

    const buildGenderSegments = (gender, genderLabel) => {
      const segs = [];
      data.strokes.forEach(stroke => {
        const matched = groupSwimmers.filter(
          s => s.gender === gender && s.events.some(ev => ev.stroke === stroke.key)
        );
        if (matched.length > 0) {
          segs.push({
            gender,
            genderLabel,
            stroke,
            count: matched.length,
            names: matched.map(s => selectedTeamFilter === s.team ? s.name : `[${s.team}] ${s.name}`)
          });
        }
      });
      return segs;
    };

    const maleSegments = buildGenderSegments("남", "남성");
    const femaleSegments = buildGenderSegments("여", "여성");
    const maleTotal = maleSegments.reduce((sum, s) => sum + s.count, 0);
    const femaleTotal = femaleSegments.reduce((sum, s) => sum + s.count, 0);
    const barTotal = maleTotal + femaleTotal;
    if (barTotal > maxBarTotal) maxBarTotal = barTotal;

    return {
      groupName,
      maleSegments,
      femaleSegments,
      maleTotal,
      femaleTotal,
      barTotal,
      uniqueSwimmerCount: groupSwimmers.length
    };
  });

  let step = 2;
  let yMax = 10;
  if (maxBarTotal <= 6) {
    step = 1;
    yMax = Math.max(4, maxBarTotal + 1);
  } else if (maxBarTotal <= 14) {
    step = 2;
    yMax = Math.ceil((maxBarTotal + 1) / 2) * 2;
  } else if (maxBarTotal <= 30) {
    step = 5;
    yMax = Math.ceil((maxBarTotal + 1) / 5) * 5;
  } else if (maxBarTotal <= 80) {
    step = 10;
    yMax = Math.ceil((maxBarTotal + 2) / 10) * 10;
  } else if (maxBarTotal <= 160) {
    step = 20;
    yMax = Math.ceil((maxBarTotal + 5) / 20) * 20;
  } else {
    step = 40;
    yMax = Math.ceil((maxBarTotal + 10) / 40) * 40;
  }

  const ticks = [];
  for (let v = 0; v <= yMax; v += step) {
    ticks.push(v);
  }

  const yAxisTicksHtml = ticks.map(v => {
    const bottomPct = (v / yMax) * 100;
    return `<span class="yaxis-tick-label" style="bottom: ${bottomPct}%;">${v}</span>`;
  }).join("");

  const gridLinesHtml = ticks.map(v => {
    const bottomPct = (v / yMax) * 100;
    return `<div class="chart-grid-line ${v === 0 ? "is-zero" : ""}" style="bottom: ${bottomPct}%;"></div>`;
  }).join("");

  const groupColsHtml = groupBarsData.map(bar => {
    const heightPct = bar.barTotal > 0 ? (bar.barTotal / yMax) * 100 : 0;
    const allSegments = [...bar.maleSegments, ...bar.femaleSegments];
    const topSeg = allSegments.length > 0 ? allSegments[allSegments.length - 1] : null;

    const renderSeg = (seg) => {
      const isTop = seg === topSeg ? "is-top-segment" : "";
      return `
        <div class="bar-segment ${seg.stroke.cls} ${isTop}" style="flex: ${seg.count} 0 0;">
          <div class="seg-tooltip">
            <div class="seg-tooltip-title">${escapeHtml(bar.groupName)} · ${seg.genderLabel} · ${escapeHtml(seg.stroke.key)} (${seg.count}명)</div>
            <div class="seg-tooltip-names">${seg.names.map(n => escapeHtml(n)).join(", ")}</div>
          </div>
        </div>
      `;
    };

    const maleHtml = bar.maleSegments.map(renderSeg).join("");
    const dividerHtml = (bar.maleTotal > 0 && bar.femaleTotal > 0)
      ? `<div class="bar-gender-divider"></div>`
      : "";
    const femaleHtml = bar.femaleSegments.map(renderSeg).join("");

    return `
      <div class="chart-group-col single-bar">
        <div class="chart-bar-wrap">
          <div class="stacked-bar-stack" style="height: ${heightPct}%;">
            ${maleHtml}
            ${dividerHtml}
            ${femaleHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");

  const xAxisHtml = groupBarsData.map(bar => `
    <div class="xaxis-group-item">
      <div class="xaxis-team-labels">
        <span class="xaxis-team-tag team-a" title="출전 건수 (남 ${bar.maleTotal} + 여 ${bar.femaleTotal})">${bar.barTotal}건 (${bar.uniqueSwimmerCount}명)</span>
      </div>
      <span class="xaxis-group-name">${escapeHtml(bar.groupName)}</span>
    </div>
  `).join("");

  chartContainer.innerHTML = `
    <div class="stacked-chart-layout">
      <div class="stacked-chart-yaxis">
        <span class="yaxis-unit">(건)</span>
        ${yAxisTicksHtml}
      </div>
      <div class="stacked-chart-main">
        <div class="stacked-chart-plot">
          ${gridLinesHtml}
          ${groupColsHtml}
        </div>
      </div>
    </div>
    <div class="stacked-chart-xaxis">
      ${xAxisHtml}
    </div>
  `;
}

/**
 * 남성 / 여성 출전 요약 매트릭스 표 렌더링 (표 모드 전환 시 표시)
 */
function renderSummaryMatrices() {
  const data = getDivisionData(currentDivision);
  const targetSwimmers = getTeamFilteredSwimmers(data);

  const maleHead = document.getElementById("maleMatrixHead");
  const femaleHead = document.getElementById("femaleMatrixHead");
  const maleBody = document.getElementById("maleMatrixBody");
  const femaleBody = document.getElementById("femaleMatrixBody");
  const maleFoot = document.getElementById("maleMatrixFoot");
  const femaleFoot = document.getElementById("femaleMatrixFoot");

  const headerRowHtml = `
    <tr>
      <th class="matrix-th-group">그룹</th>
      ${data.strokes.map(s => `<th class="matrix-th-event">${escapeHtml(s.shortLabel)}</th>`).join("")}
      <th class="matrix-th-total">계</th>
    </tr>
  `;
  if (maleHead) maleHead.innerHTML = headerRowHtml;
  if (femaleHead) femaleHead.innerHTML = headerRowHtml;

  function fillGenderMatrix(gender, bodyEl, footEl) {
    if (!bodyEl || !footEl) return;
    bodyEl.innerHTML = "";

    const genderSwimmers = targetSwimmers.filter(s => s.gender === gender);
    const colTotals = {};
    data.strokes.forEach(s => { colTotals[s.key] = 0; });
    let grandTotal = 0;

    data.groups.forEach(groupName => {
      const groupMembers = genderSwimmers.filter(s => s.group === groupName);
      let rowTotal = 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="matrix-cell-group">${escapeHtml(groupName)}</td>`;

      data.strokes.forEach(stroke => {
        const matched = groupMembers.filter(s => s.events.some(ev => ev.stroke === stroke.key));
        const count = matched.length;
        rowTotal += count;
        colTotals[stroke.key] += count;

        if (count > 0) {
          const namesText = matched.map(s => selectedTeamFilter === s.team ? s.name : `[${s.team}] ${s.name}`).join(", ");
          tr.innerHTML += `
            <td class="matrix-cell has-count" title="${escapeHtml(groupName)} · ${escapeHtml(stroke.key)} (${count}명): ${escapeHtml(namesText)}">
              <span class="matrix-num">${count}</span>
              <div class="matrix-hover-tooltip">
                <div class="tooltip-header">${escapeHtml(groupName)} · ${escapeHtml(stroke.key)} (총 ${count}명)</div>
                <div class="tooltip-list">
                  ${matched.map(s => `
                    <span class="tooltip-chip ${gender === "남" ? "male" : "female"}">${selectedTeamFilter === s.team ? "" : `[${escapeHtml(s.team)}] `}${escapeHtml(s.name)}</span>
                  `).join("")}
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
      });

      grandTotal += rowTotal;
      tr.innerHTML += `
        <td class="matrix-cell" style="font-weight:800; background:#f8fafc; color:var(--secondary);">
          ${rowTotal > 0 ? rowTotal : "-"}
        </td>
      `;
      bodyEl.appendChild(tr);
    });

    footEl.innerHTML = `
      <tr>
        <th>계</th>
        ${data.strokes.map(s => `<td>${colTotals[s.key] > 0 ? colTotals[s.key] : "-"}</td>`).join("")}
        <td class="matrix-grand-total">${grandTotal}</td>
      </tr>
    `;
  }

  fillGenderMatrix("남", maleBody, maleFoot);
  fillGenderMatrix("여", femaleBody, femaleFoot);
}

/**
 * 참가 팀별 전력 비교 표 렌더링
 */
function renderTeamPowerComparisonTable() {
  const headEl = document.getElementById("teamPowerTableHead");
  const bodyEl = document.getElementById("teamPowerTableBody");
  const countBadge = document.getElementById("teamPowerSummaryCount");
  if (!headEl || !bodyEl) return;

  const data = getDivisionData(currentDivision);
  if (countBadge) {
    countBadge.textContent = `총 ${data.teams.length}개 참가팀 · 선수 ${data.totalSwimmers}명 · 개인전 ${data.totalIndivEntries}건 · 단체전 ${data.totalRelayEntries}팀`;
  }

  headEl.innerHTML = `
    <tr>
      <th style="width: 52px;">순위</th>
      <th style="min-width: 130px; text-align: left;">소속팀 (클릭 시 필터)</th>
      <th style="width: 110px;">출전 선수 (남/여)</th>
      ${data.groups.map(g => `<th style="width: 62px;">${escapeHtml(g)}</th>`).join("")}
      <th style="width: 90px;">개인전 출전</th>
      <th style="min-width: 150px;">단체전 참가</th>
    </tr>
  `;

  bodyEl.innerHTML = data.teams.map((t, idx) => {
    const isSelected = selectedTeamFilter === t.team ? "is-selected-team-row" : "";
    const ourBadge = t.team === "거제몽꾸"
      ? `<span class="team-tag-pill mongkku">우리팀 A</span>`
      : t.team === "거제야르"
        ? `<span class="team-tag-pill yareu">우리팀 B</span>`
        : "";

    const relayHtml = t.relayEvents.length > 0
      ? `<span class="relay-count-pill">${t.relayEntries}팀</span> <span class="relay-events-sub">(${t.relayEvents.map(e => escapeHtml(e)).join(", ")})</span>`
      : `<span style="color:#94a3b8;">-</span>`;

    return `
      <tr class="team-power-row ${isSelected}" data-team-row="${escapeHtml(t.team)}" title="클릭하면 [${escapeHtml(t.team)}] 전력 그래프 및 선수 명단만 필터링합니다">
        <td style="text-align:center; font-weight:800; color:#64748b;">${idx + 1}</td>
        <td style="text-align:left; font-weight:800; color:#0f172a;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span>${escapeHtml(t.team)}</span>
            ${ourBadge}
          </div>
        </td>
        <td style="text-align:center; font-weight:800;">
          <span style="color:#0f172a;">${t.swimmerKeys.size}명</span>
          <span style="font-size:11.5px; color:#64748b; font-weight:600;">(남${t.maleSwimmerKeys.size}·여${t.femaleSwimmerKeys.size})</span>
        </td>
        ${data.groups.map(g => {
          const c = t.groupCounts[g] || 0;
          return `<td style="text-align:center; font-weight:${c > 0 ? "700" : "400"}; color:${c > 0 ? "#1e293b" : "#cbd5e1"};">${c > 0 ? `${c}명` : "-"}</td>`;
        }).join("")}
        <td style="text-align:center; font-weight:800; color:#0284c7;">${t.indivEntries}건</td>
        <td style="text-align:left; font-size:12px;">${relayHtml}</td>
      </tr>
    `;
  }).join("");
}

/**
 * 하단 전체 대회 출전선수 (및 필터링된 선수) 상세 명단 렌더링
 */
function renderSwimmersDetailTable() {
  const tbody = document.getElementById("compSwimmersTableBody");
  const titleEl = document.getElementById("compSwimmersTitle");
  if (!tbody) return;

  const data = getDivisionData(currentDivision);
  let list = getTeamFilteredSwimmers(data);

  if (selectedGenderFilter !== "all") {
    list = list.filter(s => s.gender === selectedGenderFilter);
  }
  if (selectedGroupFilter !== "all") {
    list = list.filter(s => s.group === selectedGroupFilter);
  }
  if (selectedStrokeFilter !== "all") {
    list = list.filter(s => s.events.some(ev => ev.stroke === selectedStrokeFilter));
  }
  if (searchQuery.trim() !== "") {
    const q = searchQuery.trim().toLowerCase();
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.team.toLowerCase().includes(q) ||
      s.group.toLowerCase().includes(q) ||
      s.events.some(ev => ev.stroke.toLowerCase().includes(q))
    );
  }

  if (titleEl) {
    const scopeName = selectedTeamFilter === "all"
      ? "전체 대회 출전선수"
      : selectedTeamFilter === "other_all"
        ? "타팀 전체 출전선수"
        : `[${selectedTeamFilter}] 출전선수`;
    titleEl.textContent = `📋 ${scopeName} 명단 (${list.length}명 표시 중 / 전체 ${data.totalSwimmers}명)`;
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 36px 16px; color:#64748b; font-weight:600;">
          검색 조건에 해당하는 출전 선수가 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  const strokeBadgeClass = (stroke) => {
    switch (stroke) {
      case "핀자유형": return "ev-pill-fin-free";
      case "핀접영":   return "ev-pill-fin-fly";
      case "자유형":   return "ev-pill-free";
      case "배영":     return "ev-pill-back";
      case "평영":     return "ev-pill-breast";
      case "접영":     return "ev-pill-fly";
      default:         return "";
    }
  };

  const renderEventCell = (ev) => {
    if (!ev) return `<span style="color:#cbd5e1;">-</span>`;
    return `
      <div class="comp-ev-cell">
        <span class="comp-ev-pill ${strokeBadgeClass(ev.stroke)}">${escapeHtml(ev.stroke)} ${escapeHtml(ev.distance)}</span>
        <span class="comp-ev-meta">#${escapeHtml(ev.matchNo)}경기 · ${ev.lane}레인</span>
      </div>
    `;
  };

  tbody.innerHTML = list.map((s, idx) => {
    const teamBadgeCls = s.team === "거제몽꾸"
      ? "team-badge-mongkku"
      : s.team === "거제야르"
        ? "team-badge-yareu"
        : "team-badge-other";

    const ev1 = s.events[0] || null;
    const ev2 = s.events.length > 2
      ? s.events.slice(1)
      : (s.events[1] ? [s.events[1]] : []);

    const ev2Html = ev2.length === 0
      ? `<span style="color:#cbd5e1;">-</span>`
      : ev2.map(renderEventCell).join(" ");

    return `
      <tr>
        <td style="text-align:center; color:#64748b; font-weight:700;">${idx + 1}</td>
        <td style="text-align:center;">
          <button type="button" class="comp-team-badge-btn ${teamBadgeCls}" data-team-filter-click="${escapeHtml(s.team)}" title="[${escapeHtml(s.team)}] 팀만 필터링">
            ${escapeHtml(s.team)}
          </button>
        </td>
        <td style="text-align:center;"><span class="group-badge">${escapeHtml(s.group)}</span></td>
        <td style="text-align:center;">
          <span class="gender-badge ${s.gender === "남" ? "male" : "female"}">${escapeHtml(s.gender)}</span>
        </td>
        <td style="text-align:center; font-weight:800; color:#0f172a;">${escapeHtml(s.name)}</td>
        <td style="text-align:left;">${renderEventCell(ev1)}</td>
        <td style="text-align:left;">${ev2Html}</td>
      </tr>
    `;
  }).join("");
}

function renderAll() {
  renderDivisionHeaderAndTeamChips();
  renderSummaryChart();
  renderSummaryMatrices();
  renderTeamPowerComparisonTable();
  renderSwimmersDetailTable();
}

function bindEvents() {
  // 부문 전환 (성인부 / 학생부)
  document.getElementById("tabBtnAdult")?.addEventListener("click", () => {
    if (currentDivision === "adult") return;
    currentDivision = "adult";
    selectedTeamFilter = "all";
    selectedGroupFilter = "all";
    selectedStrokeFilter = "all";
    renderAll();
  });

  document.getElementById("tabBtnStudent")?.addEventListener("click", () => {
    if (currentDivision === "student") return;
    currentDivision = "student";
    selectedTeamFilter = "all";
    selectedGroupFilter = "all";
    selectedStrokeFilter = "all";
    renderAll();
  });

  // 그래프 / 표 보기 스위치 (기본: 그래프)
  const switchWrap = document.getElementById("summaryViewSwitch");
  const chartContainer = document.getElementById("summaryChartContainer");
  const tablesContainer = document.getElementById("summaryTablesContainer");
  const chartLegend = document.getElementById("summaryChartLegend");

  switchWrap?.addEventListener("click", (e) => {
    const btn = e.target.closest(".summary-switch-btn");
    if (!btn) return;
    summaryViewMode = btn.dataset.summaryView === "table" ? "table" : "chart";
    const isChart = summaryViewMode === "chart";
    if (chartContainer) chartContainer.style.display = isChart ? "block" : "none";
    if (tablesContainer) tablesContainer.style.display = isChart ? "none" : "";
    if (chartLegend) chartLegend.style.display = isChart ? "flex" : "none";
    switchWrap.querySelectorAll(".summary-switch-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.summaryView === summaryViewMode);
    });
  });

  // 팀 선택 칩 클릭
  document.getElementById("teamFilterChips")?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-team-filter]");
    if (!chip) return;
    selectedTeamFilter = chip.dataset.teamFilter;
    renderAll();
  });

  // 팀별 전력 비교표 행 클릭 시 해당 팀 필터 토글
  document.getElementById("teamPowerTableBody")?.addEventListener("click", (e) => {
    const row = e.target.closest("[data-team-row]");
    if (!row) return;
    const team = row.dataset.teamRow;
    selectedTeamFilter = selectedTeamFilter === team ? "all" : team;
    renderAll();
  });

  // 선수 명단에서 소속팀 배지 클릭 시 해당 팀 필터
  document.getElementById("compSwimmersTableBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-team-filter-click]");
    if (!btn) return;
    const team = btn.dataset.teamFilterClick;
    selectedTeamFilter = selectedTeamFilter === team ? "all" : team;
    renderAll();
  });

  // 하단 명단 툴바 필터 이벤트
  document.getElementById("compSearchInput")?.addEventListener("input", (e) => {
    searchQuery = e.target.value || "";
    renderSwimmersDetailTable();
  });

  document.getElementById("compTeamSelect")?.addEventListener("change", (e) => {
    selectedTeamFilter = e.target.value;
    renderAll();
  });

  document.getElementById("compGenderSelect")?.addEventListener("change", (e) => {
    selectedGenderFilter = e.target.value;
    renderSwimmersDetailTable();
  });

  document.getElementById("compGroupSelect")?.addEventListener("change", (e) => {
    selectedGroupFilter = e.target.value;
    renderSwimmersDetailTable();
  });

  document.getElementById("compStrokeSelect")?.addEventListener("change", (e) => {
    selectedStrokeFilter = e.target.value;
    renderSwimmersDetailTable();
  });

  // 팀별 전력 비교표 접기/펼치기
  const btnToggleTeamTable = document.getElementById("btnToggleTeamPowerTable");
  const teamTableWrap = document.getElementById("teamPowerTableWrap");
  btnToggleTeamTable?.addEventListener("click", () => {
    if (!teamTableWrap) return;
    const isHidden = teamTableWrap.style.display === "none";
    teamTableWrap.style.display = isHidden ? "block" : "none";
    btnToggleTeamTable.textContent = isHidden ? "▲ 표 접기" : "▼ 표 펼치기";
  });
}

function initCompetitionResultPage() {
  bindEvents();
  renderAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCompetitionResultPage);
} else {
  initCompetitionResultPage();
}
