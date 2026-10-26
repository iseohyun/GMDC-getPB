// ==========================================================================
// GMDC Swim Club - 2026 거제시장배 전국마스터즈 수영대회 대회결과 통합 컨트롤러
// 구조: 대회결과 > [학생부 / 성인부] > [접수 분석 / 진행 요약 / 결과 분석]
// ==========================================================================

import { ADULT_RACES_DATA, STUDENT_RACES_DATA } from "./races-data.js?v=20261026_01";
import {
  STUDENT_SHEET_META,
  ADULT_SHEET_META,
  OUR_TEAM_STUDENT_HIGHLIGHTS,
  OUR_TEAM_ADULT_HIGHLIGHTS,
  VERIFIED_SHEET_RESULTS,
  ADULT_VERIFIED_SHEET_RESULTS,
  DEFAULT_ADULT_OFFICIAL_INPUTS
} from "./student-result-data.js?v=20261026_01";

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

// State (기본: 학생부 > 접수 분석)
let currentDivision = "student"; // 'student' | 'adult'
let currentSubTab = "entry";     // 'entry' | 'progress' | 'result'
let summaryViewMode = "chart";   // 'chart' (기본) | 'table'
let selectedTeamFilter = "all";  // 'all' | 'other_all' | 특정 팀명
let selectedGenderFilter = "all";
let selectedGroupFilter = "all";
let selectedStrokeFilter = "all";
let searchQuery = "";

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

function getRouteHash(div, tab) {
  return `#/competition-result-${div}-${tab}`;
}

function syncRouteWithParentAndUrl() {
  const targetHash = getRouteHash(currentDivision, currentSubTab);
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("div", currentDivision);
    url.searchParams.set("tab", currentSubTab);
    history.replaceState(null, "", `${url.pathname}${url.search}`);
  } catch (e) {}

  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({
        type: "GMDC_COMP_RESULT_TAB_CHANGED",
        div: currentDivision,
        tab: currentSubTab,
        hash: targetHash
      }, "*");
    } catch (e) {}
  }
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
        expectedPoints: 0,
        groupSwimmerKeys: new Map(groups.map(g => [g, new Set()])),
        groupCounts,
        strokeCounts
      });
    }
    return teamStatsMap.get(teamName);
  }

  for (const race of races) {
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

  // 종목별(성별·그룹·영법) 참가자 수 집계 및 기대 점수 계산
  // 채점 기준: 1~6위 = [7, 5, 4, 3, 2, 1]점
  // 참가자 N명일 때 기대 점수 = sum(상위 min(N,6)개 점수) / N
  const INDIV_POINT_POOL = [7, 5, 4, 3, 2, 1];
  const eventParticipantCounts = new Map();
  for (const sw of swimmerMap.values()) {
    for (const ev of sw.events) {
      const evKey = `${sw.gender}|${sw.group}|${ev.stroke}`;
      eventParticipantCounts.set(evKey, (eventParticipantCounts.get(evKey) || 0) + 1);
    }
  }

  for (const sw of swimmerMap.values()) {
    const tStat = teamStatsMap.get(sw.team);
    for (const ev of sw.events) {
      const evKey = `${sw.gender}|${sw.group}|${ev.stroke}`;
      const n = eventParticipantCounts.get(evKey) || 1;
      let poolSum = 0;
      for (let i = 0; i < Math.min(n, INDIV_POINT_POOL.length); i++) {
        poolSum += INDIV_POINT_POOL[i];
      }
      const expPt = poolSum / n;
      ev.expectedPoint = expPt;
      if (tStat) {
        tStat.expectedPoints += expPt;
      }
    }
  }

  for (const tStat of teamStatsMap.values()) {
    groups.forEach(g => {
      tStat.groupCounts[g] = tStat.groupSwimmerKeys.get(g)?.size || 0;
    });
  }

  const swimmers = [...swimmerMap.values()].sort((a, b) => {
    const teamExpDiff = (teamStatsMap.get(b.team)?.expectedPoints || 0) - (teamStatsMap.get(a.team)?.expectedPoints || 0);
    if (Math.abs(teamExpDiff) > 1e-6) return teamExpDiff;
    const teamCountDiff = (teamStatsMap.get(b.team)?.swimmerKeys.size || 0) - (teamStatsMap.get(a.team)?.swimmerKeys.size || 0);
    if (teamCountDiff !== 0) return teamCountDiff;
    if (a.team !== b.team) return a.team.localeCompare(b.team, "ko");
    const gDiff = groups.indexOf(a.group) - groups.indexOf(b.group);
    if (gDiff !== 0) return gDiff;
    if (a.gender !== b.gender) return a.gender === "남" ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });

  const teams = [...teamStatsMap.values()].sort((a, b) => {
    if (Math.abs(b.expectedPoints - a.expectedPoints) > 1e-6) {
      return b.expectedPoints - a.expectedPoints;
    }
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

function getTeamFilteredSwimmers(data) {
  if (selectedTeamFilter === "all") return data.swimmers;
  if (selectedTeamFilter === "other_all") return data.swimmers.filter(s => !s.isOurTeam);
  return data.swimmers.filter(s => s.team === selectedTeamFilter);
}

// ==========================================================================
// 🧭 상단 부문(학생부 / 성인부) & 하위 탭(접수 분석 / 진행 요약 / 결과 분석) 헤더
// ==========================================================================
function renderTopNavigationHeader() {
  const divLabel = currentDivision === "student" ? "학생부 (24일)" : "성인부 (25일)";
  const subLabelMap = {
    entry: "접수 분석",
    progress: "진행 요약",
    result: "결과 분석",
    records: "기록지DB"
  };
  const subLabel = subLabelMap[currentSubTab] || "접수 분석";

  const mainHeading = document.getElementById("pageMainHeading");
  const breadcrumb = document.getElementById("pageBreadcrumbBadge");
  if (mainHeading) {
    mainHeading.textContent = `🏆 ${divLabel} — ${subLabel}`;
  }
  if (breadcrumb) {
    breadcrumb.textContent = `대회결과 > ${currentDivision === "student" ? "학생부" : "성인부"} > ${subLabel}`;
  }

  // 기록지DB 탭에서는 전용 상단 Sticky 헤더가 표시되므로 상단 공통 헤더를 숨김
  const commonHeader = document.querySelector(".comp-analysis-header");
  if (commonHeader) {
    commonHeader.style.display = currentSubTab === "records" ? "none" : "block";
  }

  // 팀별 전력 필터 칩 박스는 '접수 분석' 페이지에서만 노출
  const entryFilterBox = document.getElementById("entryTeamFilterBox");
  if (entryFilterBox) {
    entryFilterBox.style.display = currentSubTab === "entry" ? "block" : "none";
  }

  const viewEntry = document.getElementById("viewContainerEntry");
  const viewProgress = document.getElementById("viewContainerProgress");
  const viewResult = document.getElementById("viewContainerResult");
  const viewRecords = document.getElementById("viewContainerRecords");

  if (viewEntry) viewEntry.style.display = currentSubTab === "entry" ? "block" : "none";
  if (viewProgress) viewProgress.style.display = currentSubTab === "progress" ? "block" : "none";
  if (viewResult) viewResult.style.display = currentSubTab === "result" ? "block" : "none";
  if (viewRecords) viewRecords.style.display = currentSubTab === "records" ? "block" : "none";
}

// ==========================================================================
// 📊 TAB 1: 접수 분석 (학생부 > 접수 분석 / 성인부 > 접수 분석)
// ==========================================================================
function renderEntryTeamChipsAndToolbar() {
  const data = getDivisionData(currentDivision);

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
      const groupNumOnly = String(groupName || "").replace(/[^0-9]/g, "") || "-";
      tr.innerHTML = `<td class="matrix-cell-group">${escapeHtml(groupNumOnly)}</td>`;

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
      <th style="width: 56px; text-align: center;">순위</th>
      <th style="min-width: 120px; text-align: left;">소속팀</th>
      <th style="width: 96px; text-align: center;">기대 점수</th>
      <th style="width: 105px; text-align: center; line-height: 1.3;">출전 선수<br><span style="font-size:11px; font-weight:700; color:#64748b;">(남/여)</span></th>
      <th style="width: 90px; text-align: center;">개인전 출전</th>
      <th style="width: 90px; text-align: center;">단체전 참가</th>
      <th style="min-width: 155px; text-align: center;">그룹분포</th>
    </tr>
  `;

  bodyEl.innerHTML = data.teams.map((t, idx) => {
    const isSelected = selectedTeamFilter === t.team ? "is-selected-team-row" : "";
    const ourRowClass = t.team === "거제몽꾸"
      ? "row-team-mongkku"
      : t.team === "거제야르"
        ? "row-team-yareu"
        : "";
    const teamTextColor = t.team === "거제몽꾸"
      ? "#c2410c"
      : t.team === "거제야르"
        ? "#0369a1"
        : "#0f172a";

    const groupDistStr = data.groups.map(g => t.groupCounts[g] || 0).join("/ ");

    return `
      <tr class="team-power-row ${ourRowClass} ${isSelected}" data-team-row="${escapeHtml(t.team)}" title="클릭하면 [${escapeHtml(t.team)}] 전력 그래프 및 선수 명단만 필터링합니다">
        <td style="text-align:center; font-weight:800; color:#64748b; font-variant-numeric:tabular-nums;">${idx + 1}</td>
        <td style="text-align:left; font-weight:${t.isOurTeam ? "900" : "800"}; color:${teamTextColor};">
          ${escapeHtml(t.team)}
        </td>
        <td style="text-align:center; font-weight:900; color:#0284c7; font-variant-numeric:tabular-nums;" title="기대 점수 정밀 합계: ${t.expectedPoints.toFixed(2)}점">
          ${t.expectedPoints.toFixed(1)}
        </td>
        <td style="text-align:center; font-weight:800; line-height:1.35;">
          <div style="color:#0f172a;">${t.swimmerKeys.size}명</div>
          <div style="font-size:11.5px; color:#64748b; font-weight:600;">(남${t.maleSwimmerKeys.size}·여${t.femaleSwimmerKeys.size})</div>
        </td>
        <td style="text-align:center; font-weight:800; color:#0284c7; font-variant-numeric:tabular-nums;">${t.indivEntries}건</td>
        <td style="text-align:center; font-weight:800; color:${t.relayEntries > 0 ? "#0f172a" : "#94a3b8"}; font-variant-numeric:tabular-nums;">${t.relayEntries}</td>
        <td style="text-align:center; font-weight:700; color:#334155; font-variant-numeric:tabular-nums; white-space:nowrap;">${escapeHtml(groupDistStr)}</td>
      </tr>
    `;
  }).join("");
}

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
        <span style="font-weight:700; color:#334155;">${escapeHtml(ev.stroke)} ${escapeHtml(ev.distance)}</span>
        <span class="comp-ev-meta">#${escapeHtml(ev.matchNo)}경기 · ${ev.lane}레인</span>
      </div>
    `;
  };

  tbody.innerHTML = list.map((s, idx) => {
    const isOurTeam = OUR_TEAMS.has(s.team);
    const teamColor = s.team === "거제몽꾸"
      ? "#c2410c"
      : s.team === "거제야르"
        ? "#0369a1"
        : "#334155";
    const groupNumOnly = String(s.group || "").replace(/[^0-9]/g, "") || "-";

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
        <td style="text-align:center; font-weight:${isOurTeam ? "900" : "700"}; color:${teamColor}; cursor:pointer;" data-team-filter-click="${escapeHtml(s.team)}" title="[${escapeHtml(s.team)}] 팀만 필터링">
          ${escapeHtml(s.team)}
        </td>
        <td style="text-align:center; font-weight:700; color:#334155; font-variant-numeric:tabular-nums;">${escapeHtml(groupNumOnly)}</td>
        <td style="text-align:center; font-weight:700; color:#334155;">${escapeHtml(s.gender)}</td>
        <td style="text-align:center; font-weight:800; color:#0f172a;">${escapeHtml(s.name)}</td>
        <td style="text-align:left;">${renderEventCell(ev1)}</td>
        <td style="text-align:left;">${ev2Html}</td>
      </tr>
    `;
  }).join("");
}

// ==========================================================================
// ⏱️ TAB 2: 진행 요약 (학생부: 2번, 4번, 5-2번, 5-3번 시각화·표 / 성인부: 추후 업데이트 예정)
// ==========================================================================

function renderAdultProgressSummaryView(container) {
  const fmtMMSS = (sec) => {
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  // 성인부 (2026-10-25, 141경기: 개인 131 + 단체 10) 그룹 × 영법 매트릭스
  // (#1~#2 오전 개시 대기 구간은 순수 경기 페이스 84초 기준으로 차트 스케일 보정, 전체 평균은 실측 병기)
  const adultGroupMatrixRows = [
    { group: "1그룹 (29세 이하)", races: 9,  finFly: 84,  back: 122, fly: 100, finFree: 83, breast: 80, free: 70, avg: 86.9, avgStr: "01:27", note: "#1 개시 대기 제외 순수 평균" },
    { group: "2그룹 (30~39세)",   races: 16, finFly: 80,  back: 88,  fly: 81,  finFree: null, breast: 80, free: 70, avg: 77.5, avgStr: "01:18", note: "" },
    { group: "3그룹 (40~49세)",   races: 28, finFly: 80,  back: 89,  fly: 80,  finFree: 72, breast: 80, free: 70, avg: 77.6, avgStr: "01:18", note: "#2 개시 대기 제외 순수 평균" },
    { group: "4그룹 (50~59세)",   races: 45, finFly: 82,  back: 105, fly: 78,  finFree: 81, breast: 80, free: 70, avg: 80.9, avgStr: "01:21", note: "최다 출전 그룹 (45경기)" },
    { group: "5그룹 (60~69세)",   races: 30, finFly: 92,  back: 188, fly: 88,  finFree: 95, breast: 80, free: 70, avg: 99.3, avgStr: "01:39", note: "배영 수중 입수·정렬 시간 증가" },
    { group: "6그룹 (70세 이상)", races: 3,  finFly: 80,  back: null, fly: null, finFree: null, breast: 80, free: 70, avg: 76.7, avgStr: "01:17", note: "소수 정예 (3경기)" }
  ];

  const maxStrokeSec = 190;
  const vchartColsHtml = adultGroupMatrixRows.map(r => {
    const shortGrp = r.group.split(" ")[0];
    const ageNote = r.group.replace(/^[^\s]+\s*/, "");
    const bars = [
      { label: "핀접영 50m", val: r.finFly, color: "#9333ea" },
      { label: "배영 50m",   val: r.back,   color: "#16a34a" },
      { label: "접영 50m",   val: r.fly,    color: "#e11d48" },
      { label: "핀자유형 50m", val: r.finFree, color: "#0891b2" },
      { label: "평영 50m",   val: r.breast, color: "#d97706" },
      { label: "자유형 50m", val: r.free,   color: "#2563eb" }
    ].filter(b => b.val !== null);

    const barsHtml = bars.map(b => {
      const hPct = Math.min(100, Math.max(12, Math.round((b.val / maxStrokeSec) * 100)));
      return `
        <div class="vbar-item" style="height:${hPct}%; background:${b.color};" title="${r.group} ${b.label}: ${b.val}초 (${fmtMMSS(b.val)})">
          <span class="vbar-num">${b.val}s</span>
        </div>
      `;
    }).join("");

    return `
      <div class="vchart-col">
        <div class="vchart-bars-cluster">
          ${barsHtml}
        </div>
        <div class="vchart-col-footer">
          <span class="vchart-grp-title">${escapeHtml(shortGrp)} <small style="color:#64748b;font-weight:600;">${escapeHtml(ageNote)}</small></span>
          <span class="vchart-grp-avg">평균 ${r.avg}초 (${r.avgStr})</span>
        </div>
      </div>
    `;
  }).join("");

  const renderCell = (val) => {
    if (val === null || val === undefined) {
      return `<td style="text-align:center; color:#cbd5e1;">-</td>`;
    }
    const cls = val >= 120 ? "dur-cell-slow" : (val <= 75 ? "dur-cell-fast" : "");
    return `<td class="${cls}" style="text-align:center; font-weight:700;">${val}초 <span style="color:#64748b;font-size:11.5px;">(${fmtMMSS(val)})</span></td>`;
  };

  const matrixBodyHtml = adultGroupMatrixRows.map(r => {
    const groupNumOnly = String(r.group || "").split(" ")[0].replace(/[^0-9]/g, "") || "-";
    return `
      <tr>
        <td style="text-align:center; font-weight:800; color:#334155; font-variant-numeric:tabular-nums;">${escapeHtml(groupNumOnly)}</td>
        <td style="text-align:center; font-weight:700; color:#475569;">${r.races}경기</td>
        ${renderCell(r.finFly)}
        ${renderCell(r.back)}
        ${renderCell(r.fly)}
        ${renderCell(r.finFree)}
        ${renderCell(r.breast)}
        ${renderCell(r.free)}
        <td class="dur-cell-avg" style="text-align:center;">${r.avg}초 (${r.avgStr})</td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <!-- =============================================================== -->
    <!-- 1. 성인부 전체 타임라인 요약 (08:30 ~ 13:31)                     -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>⏱️ 1. 성인부 전체 타임라인 요약 (08:30 ~ 13:31)</h3>
          <span class="progress-sec-sub">2026년 10월 25일(일) · 총 141경기 (개인전 131경기 + 단체전 10경기) 및 공식 휴게 3회 실측·일정 복원 기준</span>
        </div>
      </div>

      <div class="kpi-grid-4">
        <div class="kpi-stat-card highlight-blue">
          <span class="kpi-label">🏁 전체 대회 소요 시간</span>
          <span class="kpi-value">5시간 01분 00초</span>
          <span class="kpi-sub">08:30:00 ~ 13:31:00 (총 18,060초)</span>
        </div>
        <div class="kpi-stat-card">
          <span class="kpi-label">🏊 순수 경기 진행 시간</span>
          <span class="kpi-value">3시간 44분 44초</span>
          <span class="kpi-sub">총 13,484초 · 141경기 (경기당 평균 01:36)</span>
        </div>
        <div class="kpi-stat-card highlight-emerald">
          <span class="kpi-label">☕ 총 휴게 시간 (3회 합산)</span>
          <span class="kpi-value">1시간 16분 16초</span>
          <span class="kpi-sub">개회식 29분 49초 + 중식·휴식 31분 27초 + 혼성계영 전 15분</span>
        </div>
        <div class="kpi-stat-card">
          <span class="kpi-label">⚡ 개인전 vs 단체전 평균</span>
          <span class="kpi-value">01:31 / 02:38</span>
          <span class="kpi-sub">개인 131경기(90.9초) · 단체 10경기(158.0초)</span>
        </div>
      </div>

      <!-- 타임라인 구성 비율 바 -->
      <div class="timeline-ratio-wrap">
        <div class="timeline-ratio-title">
          <span>🕒 시간대별 진행 구성 비율 (08:30 ~ 13:31, 총 301분)</span>
          <span>순수 경기 74.7% (224.7분) · 휴게 25.3% (76.3분)</span>
        </div>
        <div class="timeline-ratio-bar">
          <div class="tl-seg seg-morning" style="width: 24.2%;" title="1부 경기 (#1~#35 핀접영·배영): 08:30:00 ~ 09:42:49 (1시간 12분 49초)">1부 #1~#35 (1h 13m)</div>
          <div class="tl-seg seg-break1" style="width: 9.9%;" title="휴게 1 (개회식): 09:42:49 ~ 10:12:38 (29분 49초)">휴게1 (30m)</div>
          <div class="tl-seg seg-afternoon" style="width: 21.9%;" title="2부 경기 (#36~#83 계영·접영·핀자유형): 10:12:38 ~ 11:18:32 (1시간 05분 54초)">2부 #36~#83 (1h 06m)</div>
          <div class="tl-seg seg-break2" style="width: 10.4%; background:#059669;" title="휴게 2 (중식·휴식): 11:18:32 ~ 11:50:00 (31분 27초)">휴게2 (31m)</div>
          <div class="tl-seg seg-morning" style="width: 25.6%; background:#1d4ed8;" title="3부 경기 (#84~#139 평영·혼계영·자유형): 11:50:00 ~ 13:07:00 (1시간 17분 00초)">3부 #84~#139 (1h 17m)</div>
          <div class="tl-seg seg-break1" style="width: 5.0%;" title="휴게 3 (혼성 핀계영 300m 준비): 13:07:00 ~ 13:22:00 (15분 00초)">휴게3</div>
          <div class="tl-seg seg-relay" style="width: 3.0%;" title="혼성 핀계영 300m (#140~#141): 13:22:00 ~ 13:31:00 (9분 00초)">피날레</div>
        </div>
        <div class="timeline-legend-row">
          <span><i class="tl-dot" style="background:#0284c7;"></i>1부 (#1~#35 핀접영·배영, 08:30~09:42)</span>
          <span><i class="tl-dot" style="background:#10b981;"></i>휴게 1·개회식 (09:42~10:12, 30분)</span>
          <span><i class="tl-dot" style="background:#2563eb;"></i>2부 (#36~#83 계영·접영·핀자유형, 10:12~11:18)</span>
          <span><i class="tl-dot" style="background:#059669;"></i>휴게 2·중식/휴식 (11:18~11:50, 31분)</span>
          <span><i class="tl-dot" style="background:#1d4ed8;"></i>3부 (#84~#139 평영·혼계영·자유형, 11:50~13:07)</span>
          <span><i class="tl-dot" style="background:#10b981;"></i>휴게 3·혼성계영 준비 (13:07~13:22, 15분)</span>
          <span><i class="tl-dot" style="background:#7c3aed;"></i>혼성 핀계영 300m (#140~#141, 13:22~13:31)</span>
        </div>
      </div>

      <!-- 전체 타임라인 요약 표 -->
      <div class="table-responsive">
        <table class="record-table">
          <thead>
            <tr>
              <th style="min-width: 185px; text-align:left;">구분</th>
              <th style="min-width: 195px; text-align:center;">시각 / 구간</th>
              <th style="min-width: 150px; text-align:center;">소요 시간</th>
              <th style="width: 100px; text-align:center;">경기 수</th>
              <th style="min-width: 135px; text-align:center;">평균 소요시간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:left; font-weight:800; color:#0f172a;">전체 대회 시간</td>
              <td style="text-align:center; font-weight:700;">08:30:00 ~ 13:31:00</td>
              <td style="text-align:center; font-weight:800; color:#0f172a;">5시간 01분 00초 (18,060초)</td>
              <td style="text-align:center; font-weight:700;">141경기 + 휴게 3회</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td style="text-align:left; font-weight:800; color:#15803d;">☕ 휴게 1 (개회식 및 정비)</td>
              <td style="text-align:center; font-weight:700;">#35 배영 종료 후 (09:42:49 ~ 10:12:38)</td>
              <td style="text-align:center; font-weight:800; color:#15803d;">29분 49초 (1,789초)</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td style="text-align:left; font-weight:800; color:#15803d;">☕ 휴게 2 (중식 및 휴식)</td>
              <td style="text-align:center; font-weight:700;">#83 핀자유형 종료 후 (11:18:32 ~ 11:50:00)</td>
              <td style="text-align:center; font-weight:800; color:#15803d;">31분 27초 (1,887초)</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td style="text-align:left; font-weight:800; color:#15803d;">☕ 휴게 3 (혼성 핀계영 300m 준비)</td>
              <td style="text-align:center; font-weight:700;">#139 자유형 종료 후 (13:07:00 ~ 13:22:00)</td>
              <td style="text-align:center; font-weight:800; color:#15803d;">15분 00초 (900초)</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
            </tr>
            <tr style="background:#f0f9ff;">
              <td style="text-align:left; font-weight:900; color:#0369a1;">🏊 순수 경기 진행 시간</td>
              <td style="text-align:center; font-weight:700;">휴게 3회 (76분 16초) 제외</td>
              <td style="text-align:center; font-weight:900; color:#0369a1;">3시간 44분 44초 (13,484초)</td>
              <td style="text-align:center; font-weight:900; color:#0369a1;">141경기</td>
              <td style="text-align:center; font-weight:900; color:#0369a1;">01:36 (95.6초)</td>
            </tr>
            <tr>
              <td style="text-align:left; padding-left:22px; font-weight:700; color:#334155;">├─ 개인전 (50m 6종목 합계)</td>
              <td style="text-align:center; color:#475569;">핀접영·배영·접영·핀자유형·평영·자유형</td>
              <td style="text-align:center; font-weight:700;">3시간 18분 24초 (11,904초)</td>
              <td style="text-align:center; font-weight:700;">131경기</td>
              <td style="text-align:center; font-weight:800; color:#0284c7;">01:31 (90.9초)</td>
            </tr>
            <tr>
              <td style="text-align:left; padding-left:22px; font-weight:700; color:#334155;">└─ 단체전 (계영·혼계영·혼성핀계영 합계)</td>
              <td style="text-align:center; color:#475569;">#36~#39 (계영) · #106~#109 (혼계영) · #140~#141 (혼성핀계영)</td>
              <td style="text-align:center; font-weight:700;">26분 20초 (1,580초)</td>
              <td style="text-align:center; font-weight:700;">10경기</td>
              <td style="text-align:center; font-weight:800; color:#7c3aed;">02:38 (158.0초)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 2. 영법별(종목별) 평균 소요시간 (막대그래프 + 상세 표)           -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>🌊 2. 영법별(종목별) 평균 소요시간</h3>
          <span class="progress-sec-sub">자유형(70.0초) &lt; 평영(80.0초) &lt; 핀자유형(83.5초) &lt; 접영(83.6초) &lt; 배영(122.8초) &lt; 핀접영(126.4초, 개시 대기 제외 시 84.1초)</span>
        </div>
      </div>

      <div class="charts-two-col">
        <div class="hbar-chart-box">
          <h4 class="hbar-chart-title">
            <span>📊 개인전 50m 6종목 평균 소요시간 비교</span>
            <span style="font-size:11.5px; color:#64748b;">개인전 전체 평균 90.9초 (01:31)</span>
          </h4>
          <div class="hbar-list">
            <div class="hbar-row">
              <span class="hbar-label">1. 자유형 50m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 55.4%; background:#2563eb;">30경기</div></div>
              <span class="hbar-val">01:10 (70.0s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">2. 평영 50m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 63.3%; background:#d97706;">22경기</div></div>
              <span class="hbar-val">01:20 (80.0s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">3. 핀자유형 50m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 66.1%; background:#0891b2;">24경기</div></div>
              <span class="hbar-val">01:23 (83.5s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">4. 접영 50m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 66.2%; background:#e11d48;">20경기</div></div>
              <span class="hbar-val">01:24 (83.6s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">5. 배영 50m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 97.2%; background:#16a34a;">15경기</div></div>
              <span class="hbar-val">02:03 (122.8s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">6. 핀접영 50m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 100%; background:#9333ea;">20경기 (#3~#20 평균 84.1s)</div></div>
              <span class="hbar-val">02:06 (126.4s)</span>
            </div>
          </div>
        </div>

        <div class="hbar-chart-box">
          <h4 class="hbar-chart-title">
            <span>🤝 단체전 3종목 평균 소요시간 비교</span>
            <span style="font-size:11.5px; color:#64748b;">단체전 전체 평균 158.0초 (02:38)</span>
          </h4>
          <div class="hbar-list">
            <div class="hbar-row">
              <span class="hbar-label">계영 200m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 35.0%; background:#0284c7;">4경기 (#36~#39)</div></div>
              <span class="hbar-val">01:10 (70.0s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">혼계영 200m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 70.4%; background:#7c3aed;">4경기 (#106~#109)</div></div>
              <span class="hbar-val">03:10 (190.0s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">혼성 핀계영 300m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 100%; background:#db2777;">2경기 (#140~#141, 6인×50m)</div></div>
              <span class="hbar-val">04:30 (270.0s)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 영법별 평균 소요시간 상세 표 -->
      <div class="table-responsive">
        <table class="record-table">
          <thead>
            <tr>
              <th style="width: 110px; text-align:center;">순위</th>
              <th style="width: 165px; text-align:left;">종목 (영법)</th>
              <th style="width: 90px; text-align:center;">경기 수</th>
              <th style="width: 140px; text-align:center;">평균 소요시간 (분:초)</th>
              <th style="width: 110px; text-align:center;">평균 (초)</th>
              <th style="min-width: 280px; text-align:left;">실측 및 일정 특성 분석</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:center; font-weight:800; color:#1d4ed8;">1 (가장 빠름)</td>
              <td style="text-align:left; font-weight:700; color:#334155;">자유형 50m</td>
              <td style="text-align:center; font-weight:700;">30경기</td>
              <td style="text-align:center; font-weight:900; color:#1d4ed8;">01:10</td>
              <td style="text-align:center; font-weight:800;">70.0초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">3부 마지막 개인전 구간(#110~#139, 12:32~13:07)으로 가장 빠른 템포로 진행</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#64748b;">2</td>
              <td style="text-align:left; font-weight:700; color:#334155;">평영 50m</td>
              <td style="text-align:center; font-weight:700;">22경기</td>
              <td style="text-align:center; font-weight:900; color:#0f172a;">01:20</td>
              <td style="text-align:center; font-weight:800;">80.0초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">11:50 휴게 종료 직후 재개 구간(#84~#105, 11:50~12:19)으로 예정 페이스(80초) 정시 진행</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#64748b;">3</td>
              <td style="text-align:left; font-weight:700; color:#334155;">핀자유형 50m</td>
              <td style="text-align:center; font-weight:700;">24경기</td>
              <td style="text-align:center; font-weight:900; color:#0f172a;">01:23</td>
              <td style="text-align:center; font-weight:800;">83.5초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">오리발 착용으로 수영 속도는 매우 빠르나 출발 전 오리발 착용·점검 시간 포함 (#60~#83 실측)</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#64748b;">4</td>
              <td style="text-align:left; font-weight:700; color:#334155;">접영 50m</td>
              <td style="text-align:center; font-weight:700;">20경기</td>
              <td style="text-align:center; font-weight:900; color:#0f172a;">01:24</td>
              <td style="text-align:center; font-weight:800;">83.6초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">2부 개인전 구간(#40~#59, 10:17~10:45) 실측 평균</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#be123c;">5</td>
              <td style="text-align:left; font-weight:700; color:#334155;">배영 50m</td>
              <td style="text-align:center; font-weight:700;">15경기</td>
              <td style="text-align:center; font-weight:900; color:#be123c;">02:03</td>
              <td style="text-align:center; font-weight:800;">122.8초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">수중 입수 출발 및 시니어(5그룹) 구간 신중한 입수·정렬로 소요시간 증가 (#21~#35 실측)</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#9333ea;">6 (개시 포함)</td>
              <td style="text-align:left; font-weight:700; color:#334155;">핀접영 50m</td>
              <td style="text-align:center; font-weight:700;">20경기</td>
              <td style="text-align:center; font-weight:900; color:#9333ea;">02:06</td>
              <td style="text-align:center; font-weight:800;">126.4초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">오전 08:30 대회 개시 정렬(#1~#2) 포함 평균이며, <strong>#3~#20 18경기 순수 실측 평균은 01:24 (84.1초)</strong></td>
            </tr>
            <tr style="background:#f0f9ff;">
              <td style="text-align:center; font-weight:800; color:#0369a1;">단체전 1</td>
              <td style="text-align:left; font-weight:800; color:#0369a1;">계영 200m (단체)</td>
              <td style="text-align:center; font-weight:700;">4경기</td>
              <td style="text-align:center; font-weight:900; color:#0369a1;">01:10</td>
              <td style="text-align:center; font-weight:800;">70.0초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">개회식 직후(#36~#39, 10:12~10:17) 사전 소집 완료 상태에서 빠르게 연속 진행</td>
            </tr>
            <tr style="background:#faf5ff;">
              <td style="text-align:center; font-weight:800; color:#7c3aed;">단체전 2</td>
              <td style="text-align:left; font-weight:800; color:#6d28d9;">혼계영 200m (단체)</td>
              <td style="text-align:center; font-weight:700;">4경기</td>
              <td style="text-align:center; font-weight:900; color:#6d28d9;">03:10</td>
              <td style="text-align:center; font-weight:800;">190.0초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">평영 종료 직후(#106~#109, 12:19~12:32) 남·여 4×50m 혼계영 진행</td>
            </tr>
            <tr style="background:#fdf2f8;">
              <td style="text-align:center; font-weight:800; color:#db2777;">단체전 3</td>
              <td style="text-align:left; font-weight:800; color:#be185d;">혼성 핀계영 300m (단체)</td>
              <td style="text-align:center; font-weight:700;">2경기</td>
              <td style="text-align:center; font-weight:900; color:#be185d;">04:30</td>
              <td style="text-align:center; font-weight:800;">270.0초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">15분 휴식 후 대회 대미를 장식한 6인×50m 혼성 단체전 (#140~#141, 13:22~13:31)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 3. 그룹 × 영법 상세 매트릭스 (연령대별 막대그래프 + 매트릭스 표) -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>🏊 3. 그룹 × 영법 상세 매트릭스 (단위: 평균 초)</h3>
          <span class="progress-sec-sub">성인부 1그룹(20대) ~ 6그룹(70대 이상) 구간별 · 6대 개인 종목 평균 소요시간 비교</span>
        </div>
      </div>

      <div class="group-stroke-vchart-wrap">
        <div class="vchart-top-bar">
          <strong style="font-size:13.5px; color:#0f172a;">📊 성인부 연령대 그룹별 · 6대 개인 종목 평균 소요시간 비교 그래프 (단위: 초)</strong>
          <div class="vchart-legend">
            <span><i class="tl-dot" style="background:#9333ea;"></i>핀접영 50m</span>
            <span><i class="tl-dot" style="background:#16a34a;"></i>배영 50m</span>
            <span><i class="tl-dot" style="background:#e11d48;"></i>접영 50m</span>
            <span><i class="tl-dot" style="background:#0891b2;"></i>핀자유형 50m</span>
            <span><i class="tl-dot" style="background:#d97706;"></i>평영 50m</span>
            <span><i class="tl-dot" style="background:#2563eb;"></i>자유형 50m</span>
          </div>
        </div>
        <div class="vchart-grid">
          ${vchartColsHtml}
        </div>
      </div>

      <div class="table-responsive">
        <table class="record-table">
          <thead>
            <tr>
              <th style="width: 90px; text-align:center;">그룹</th>
              <th style="width: 85px; text-align:center;">경기 수</th>
              <th style="min-width: 110px; text-align:center;">핀접영 50m</th>
              <th style="min-width: 110px; text-align:center;">배영 50m</th>
              <th style="min-width: 110px; text-align:center;">접영 50m</th>
              <th style="min-width: 110px; text-align:center;">핀자유형 50m</th>
              <th style="min-width: 110px; text-align:center;">평영 50m</th>
              <th style="min-width: 110px; text-align:center;">자유형 50m</th>
              <th style="min-width: 130px; text-align:center;">그룹 순수 평균</th>
            </tr>
          </thead>
          <tbody>
            ${matrixBodyHtml}
          </tbody>
          <tfoot>
            <tr style="background:#f1f5f9; font-weight:900;">
              <td style="text-align:center; color:#0f172a;">전체</td>
              <td style="text-align:center; color:#0f172a;">131경기</td>
              <td style="text-align:center; color:#7e22ce;">84.1초 (#3~#20)</td>
              <td style="text-align:center; color:#15803d;">122.8초 (02:03)</td>
              <td style="text-align:center; color:#be123c;">83.6초 (01:24)</td>
              <td style="text-align:center; color:#0e7490;">83.5초 (01:23)</td>
              <td style="text-align:center; color:#b45309;">80.0초 (01:20)</td>
              <td style="text-align:center; color:#1d4ed8;">70.0초 (01:10)</td>
              <td style="text-align:center; color:#0284c7; background:#e0f2fe;">90.9초 (01:31)</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 4. 성별 개인전 평균 소요시간 (막대그래프 + 비교 표)              -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>🚻 4. 성별 개인전 평균 소요시간</h3>
          <span class="progress-sec-sub">남자 01:31 (90.6초) vs 여자 01:31 (91.1초) — 성별 간 차이는 0.5초 이내로 완전히 동일한 템포로 진행</span>
        </div>
      </div>

      <div class="charts-two-col">
        <div class="hbar-chart-box">
          <h4 class="hbar-chart-title">
            <span>📊 성별 개인전 전체 평균 소요시간 비교</span>
            <span style="font-size:11.5px; color:#64748b;">차이 0.5초 (동일)</span>
          </h4>
          <div class="hbar-list">
            <div class="hbar-row">
              <span class="hbar-label">👨 남자 (70경기)</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 88.0%; background:#0284c7;">총 1시간 45분 45초 (6,345초)</div></div>
              <span class="hbar-val">01:31 (90.6s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">👩 여자 (61경기)</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 88.5%; background:#ec4899;">총 1시간 32분 39초 (5,559초)</div></div>
              <span class="hbar-val">01:31 (91.1s)</span>
            </div>
          </div>
        </div>

        <div class="hbar-chart-box" style="display:flex; flex-direction:column; justify-content:center; gap:8px;">
          <h4 class="hbar-chart-title" style="margin-bottom:4px;">💡 성인부 진행 핵심 결론</h4>
          <p style="margin:0; font-size:13px; color:#334155; line-height:1.6; font-weight:600;">
            • <strong>남자 (70경기)</strong>: 평균 <strong>01:31 (90.6초)</strong> / <strong>여자 (61경기)</strong>: 평균 <strong>01:31 (91.1초)</strong><br>
            • 11:50 휴게 종료 후 3부(#84~#139) 평영·혼계영·자유형 56경기가 지연 없이 정시 페이스로 진행되었으며, 13:07~13:22 15분 휴식 후 혼성 핀계영 300m 2경기를 끝으로 <strong>13:31에 전 경기가 성황리에 종료</strong>되었습니다.
          </p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="record-table">
          <thead>
            <tr>
              <th style="width: 120px; text-align:center;">성별</th>
              <th style="width: 100px; text-align:center;">개인전 경기 수</th>
              <th style="width: 170px; text-align:center;">총 소요시간</th>
              <th style="width: 140px; text-align:center;">평균 소요시간 (분:초)</th>
              <th style="width: 110px; text-align:center;">평균 (초)</th>
              <th style="min-width: 240px; text-align:left;">비고</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:center; font-weight:700; color:#334155;">남자</td>
              <td style="text-align:center; font-weight:800;">70경기</td>
              <td style="text-align:center; font-weight:700;">1시간 45분 45초 (6,345초)</td>
              <td style="text-align:center; font-weight:900; color:#0284c7;">01:31</td>
              <td style="text-align:center; font-weight:800;">90.6초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">3·4·5그룹 주력 출전, 전 종목 일정한 진행 속도 유지</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:700; color:#334155;">여자</td>
              <td style="text-align:center; font-weight:800;">61경기</td>
              <td style="text-align:center; font-weight:700;">1시간 32분 39초 (5,559초)</td>
              <td style="text-align:center; font-weight:900; color:#db2777;">01:31</td>
              <td style="text-align:center; font-weight:800;">91.1초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">남자부와 0.5초 차이로 사실상 동일한 경기 진행 템포 기록</td>
            </tr>
            <tr style="background:#f8fafc; font-weight:900;">
              <td style="text-align:center; color:#0f172a;">개인전 전체</td>
              <td style="text-align:center; color:#0f172a;">131경기</td>
              <td style="text-align:center; color:#0f172a;">3시간 18분 24초 (11,904초)</td>
              <td style="text-align:center; color:#0f172a;">01:31</td>
              <td style="text-align:center; color:#0f172a;">90.9초</td>
              <td style="text-align:left; font-size:12.5px; color:#475569;">학생부 개인전 평균(94.3초) 대비 경기당 3.4초 빠르게 진행</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderProgressSummaryView() {
  const container = document.getElementById("viewContainerProgress");
  if (!container) return;

  if (currentDivision === "adult") {
    renderAdultProgressSummaryView(container);
    return;
  }

  // 학생부 (2026-10-24, 232경기) 진행 요약: 2번, 4번, 5번(2), 5번(3) 기준 표 + 막대그래프
  const groupMatrixRows = [
    { group: "1그룹 (7세 이하)", races: 18, fly: 115, back: 125, breast: 102, free: 93, avg: 104.3, avgStr: "01:44" },
    { group: "2그룹 (8세)",      races: 31, fly: 116, back: 126, breast: 110, free: 95, avg: 110.1, avgStr: "01:50" },
    { group: "3그룹 (9세)",      races: 32, fly: 112, back: 138, breast: 106, free: 93, avg: 107.2, avgStr: "01:47" },
    { group: "4그룹 (10세)",     races: 49, fly: 92,  back: 80,  breast: 90,  free: 81, avg: 84.6,  avgStr: "01:25" },
    { group: "5그룹 (11세)",     races: 38, fly: 94,  back: 98,  breast: 92,  free: 83, avg: 90.9,  avgStr: "01:31" },
    { group: "6그룹 (12세)",     races: 31, fly: 83,  back: 116, breast: 89,  free: 69, avg: 85.9,  avgStr: "01:26" },
    { group: "7그룹 (13~16세)",  races: 21, fly: 87,  back: 90,  breast: 88,  free: 77, avg: 83.9,  avgStr: "01:24" }
  ];

  const fmtMMSS = (sec) => {
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  const maxStrokeSec = 140; // 그룹×영법 세로 차트 기준 최대값(138초)
  const vchartColsHtml = groupMatrixRows.map(r => {
    const hFly = Math.round((r.fly / maxStrokeSec) * 100);
    const hBack = Math.round((r.back / maxStrokeSec) * 100);
    const hBreast = Math.round((r.breast / maxStrokeSec) * 100);
    const hFree = Math.round((r.free / maxStrokeSec) * 100);
    const shortGrp = r.group.split(" ")[0];
    const ageNote = r.group.replace(/^[^\s]+\s*/, "");
    return `
      <div class="vchart-col">
        <div class="vchart-bars-cluster">
          <div class="vbar-item" style="height:${hFly}%; background:#e11d48;" title="${r.group} 접영 50m: ${r.fly}초 (${fmtMMSS(r.fly)})">
            <span class="vbar-num">${r.fly}s</span>
          </div>
          <div class="vbar-item" style="height:${hBack}%; background:#16a34a;" title="${r.group} 배영 50m: ${r.back}초 (${fmtMMSS(r.back)})">
            <span class="vbar-num">${r.back}s</span>
          </div>
          <div class="vbar-item" style="height:${hBreast}%; background:#d97706;" title="${r.group} 평영 50m: ${r.breast}초 (${fmtMMSS(r.breast)})">
            <span class="vbar-num">${r.breast}s</span>
          </div>
          <div class="vbar-item" style="height:${hFree}%; background:#2563eb;" title="${r.group} 자유형 50m: ${r.free}초 (${fmtMMSS(r.free)})">
            <span class="vbar-num">${r.free}s</span>
          </div>
        </div>
        <div class="vchart-col-footer">
          <span class="vchart-grp-title">${escapeHtml(shortGrp)} <small style="color:#64748b;font-weight:600;">${escapeHtml(ageNote)}</small></span>
          <span class="vchart-grp-avg">평균 ${r.avg}초 (${r.avgStr})</span>
        </div>
      </div>
    `;
  }).join("");

  const matrixBodyHtml = groupMatrixRows.map(r => {
    const cellCls = (val) => val >= 120 ? "dur-cell-slow" : (val <= 83 ? "dur-cell-fast" : "");
    const groupNumOnly = String(r.group || "").split(" ")[0].replace(/[^0-9]/g, "") || "-";
    return `
      <tr>
        <td style="text-align:center; font-weight:800; color:#334155; font-variant-numeric:tabular-nums;">${escapeHtml(groupNumOnly)}</td>
        <td style="text-align:center; font-weight:700; color:#475569;">${r.races}경기</td>
        <td class="${cellCls(r.fly)}" style="text-align:center; font-weight:700;">${r.fly}초 <span style="color:#64748b;font-size:11.5px;">(${fmtMMSS(r.fly)})</span></td>
        <td class="${cellCls(r.back)}" style="text-align:center; font-weight:700;">${r.back}초 <span style="color:#64748b;font-size:11.5px;">(${fmtMMSS(r.back)})</span></td>
        <td class="${cellCls(r.breast)}" style="text-align:center; font-weight:700;">${r.breast}초 <span style="color:#64748b;font-size:11.5px;">(${fmtMMSS(r.breast)})</span></td>
        <td class="${cellCls(r.free)}" style="text-align:center; font-weight:700;">${r.free}초 <span style="color:#64748b;font-size:11.5px;">(${fmtMMSS(r.free)})</span></td>
        <td class="dur-cell-avg" style="text-align:center;">${r.avg}초 (${r.avgStr})</td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <!-- =============================================================== -->
    <!-- 1. 학생부 전체 타임라인 요약 (08:30 ~ 17:05)                     -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>⏱️ 1. 학생부 전체 타임라인 요약 (08:30 ~ 17:05)</h3>
          <span class="progress-sec-sub">2026년 10월 24일(토) · 총 232경기 (개인전 220경기 + 단체전 12경기) 및 공식 휴게 2회 실측 기준</span>
        </div>
      </div>

      <div class="kpi-grid-4">
        <div class="kpi-stat-card highlight-blue">
          <span class="kpi-label">🏁 전체 대회 소요 시간</span>
          <span class="kpi-value">8시간 35분 00초</span>
          <span class="kpi-sub">08:30:00 ~ 17:05:00 (총 30,900초)</span>
        </div>
        <div class="kpi-stat-card">
          <span class="kpi-label">🏊 순수 경기 진행 시간</span>
          <span class="kpi-value">7시간 02분 22초</span>
          <span class="kpi-sub">총 25,342초 · 232경기 (경기당 평균 01:49)</span>
        </div>
        <div class="kpi-stat-card highlight-emerald">
          <span class="kpi-label">☕ 총 휴게 시간 (2회 합산)</span>
          <span class="kpi-value">1시간 32분 38초</span>
          <span class="kpi-sub">개회식·중식 78분 17초 + 혼계영 준비 14분 21초</span>
        </div>
        <div class="kpi-stat-card">
          <span class="kpi-label">⚡ 개인전 vs 단체전 평균</span>
          <span class="kpi-value">01:34 / 06:22</span>
          <span class="kpi-sub">개인 220경기(94.3초) · 단체 12경기(382.1초)</span>
        </div>
      </div>

      <!-- 타임라인 구성 비율 바 -->
      <div class="timeline-ratio-wrap">
        <div class="timeline-ratio-title">
          <span>🕒 시간대별 진행 구성 비율 (08:30 ~ 17:05, 총 515분)</span>
          <span>순수 경기 82.0% (422.4분) · 휴게 18.0% (92.6분)</span>
        </div>
        <div class="timeline-ratio-bar">
          <div class="tl-seg seg-morning" style="width: 25.5%;" title="오전 경기 (#1~#55): 08:30:00 ~ 10:41:17 (2시간 11분 17초)">오전 #1~#55 (2h 11m)</div>
          <div class="tl-seg seg-break1" style="width: 15.2%;" title="휴게 1 (개회식·중식): 10:41:17 ~ 11:59:34 (1시간 18분 17초)">휴게1 (1h 18m)</div>
          <div class="tl-seg seg-afternoon" style="width: 50.0%;" title="오후 개인전 (#56~#226): 11:59:34 ~ 16:17:04 (4시간 17분 30초)">오후 개인전 #56~#226 (4h 17m)</div>
          <div class="tl-seg seg-break2" style="width: 2.8%;" title="휴게 2 (혼계영 준비): 16:17:04 ~ 16:31:25 (14분 21초)">휴게2</div>
          <div class="tl-seg seg-relay" style="width: 6.5%;" title="오후 혼계영 (#227~#232): 16:31:25 ~ 17:05:00 (33분 35초)">혼계영 (34m)</div>
        </div>
        <div class="timeline-legend-row">
          <span><i class="tl-dot" style="background:#0284c7;"></i>오전 경기 (#1~#55, 08:30~10:41)</span>
          <span><i class="tl-dot" style="background:#10b981;"></i>휴게 1·개회식/중식 (10:41~11:59)</span>
          <span><i class="tl-dot" style="background:#2563eb;"></i>오후 개인전 (#56~#226, 11:59~16:17)</span>
          <span><i class="tl-dot" style="background:#059669;"></i>휴게 2·단체전 준비 (16:17~16:31)</span>
          <span><i class="tl-dot" style="background:#7c3aed;"></i>오후 혼계영 (#227~#232, 16:31~17:05)</span>
        </div>
      </div>

      <!-- 전체 타임라인 요약 표 -->
      <div class="table-responsive">
        <table class="record-table">
          <thead>
            <tr>
              <th style="min-width: 165px; text-align:left;">구분</th>
              <th style="min-width: 170px; text-align:center;">시각 / 구간</th>
              <th style="min-width: 150px; text-align:center;">소요 시간</th>
              <th style="width: 100px; text-align:center;">경기 수</th>
              <th style="min-width: 135px; text-align:center;">평균 소요시간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:left; font-weight:800; color:#0f172a;">전체 대회 시간</td>
              <td style="text-align:center; font-weight:700;">08:30:00 ~ 17:05:00</td>
              <td style="text-align:center; font-weight:800; color:#0f172a;">8시간 35분 00초 (30,900초)</td>
              <td style="text-align:center; font-weight:700;">232경기 + 휴게 2회</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td style="text-align:left; font-weight:800; color:#15803d;">☕ 휴게 1 (개회식·중식)</td>
              <td style="text-align:center; font-weight:700;">#55 종료 후 (10:41:17 ~ 11:59:34)</td>
              <td style="text-align:center; font-weight:800; color:#15803d;">1시간 18분 17초 (4,697초)</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td style="text-align:left; font-weight:800; color:#15803d;">☕ 휴게 2 (혼계영 준비)</td>
              <td style="text-align:center; font-weight:700;">#226 종료 후 (16:17:04 ~ 16:31:25)</td>
              <td style="text-align:center; font-weight:800; color:#15803d;">14분 21초 (861초)</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
              <td style="text-align:center; color:#94a3b8;">-</td>
            </tr>
            <tr style="background:#f0f9ff;">
              <td style="text-align:left; font-weight:900; color:#0369a1;">🏊 순수 경기 진행 시간</td>
              <td style="text-align:center; font-weight:700;">휴게 2회 (92분 38초) 제외</td>
              <td style="text-align:center; font-weight:900; color:#0369a1;">7시간 02분 22초 (25,342초)</td>
              <td style="text-align:center; font-weight:900; color:#0369a1;">232경기</td>
              <td style="text-align:center; font-weight:900; color:#0369a1;">01:49 (109.2초)</td>
            </tr>
            <tr>
              <td style="text-align:left; padding-left:22px; font-weight:700; color:#334155;">├─ 개인전 (50m 4종목 합계)</td>
              <td style="text-align:center; color:#475569;">#7 ~ #226 (오전·오후 개인전)</td>
              <td style="text-align:center; font-weight:700;">5시간 45분 43초 (20,743초)</td>
              <td style="text-align:center; font-weight:700;">220경기</td>
              <td style="text-align:center; font-weight:800; color:#0284c7;">01:34 (94.3초)</td>
            </tr>
            <tr>
              <td style="text-align:left; padding-left:22px; font-weight:700; color:#334155;">└─ 단체전 (계영·혼계영 200m 합계)</td>
              <td style="text-align:center; color:#475569;">#1~#6 (계영) · #227~#232 (혼계영)</td>
              <td style="text-align:center; font-weight:700;">1시간 16분 25초 (4,585초)</td>
              <td style="text-align:center; font-weight:700;">12경기</td>
              <td style="text-align:center; font-weight:800; color:#7c3aed;">06:22 (382.1초)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 2. 영법별(종목별) 평균 소요시간 (막대그래프 + 상세 표)           -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>🌊 2. 영법별(종목별) 평균 소요시간</h3>
          <span class="progress-sec-sub">자유형(83.9초) &lt; 평영(96.3초) &lt; 접영(98.3초) &lt; 배영(105.7초) — 배영은 수중 입수·손잡이 정렬로 약 15~22초 추가 소요</span>
        </div>
      </div>

      <!-- 영법별 막대그래프 (개인전 4종목 / 단체전 2종목) -->
      <div class="charts-two-col">
        <div class="hbar-chart-box">
          <h4 class="hbar-chart-title">
            <span>📊 개인전 50m 영법별 평균 소요시간 비교</span>
            <span style="font-size:11.5px; color:#64748b;">전체 평균 94.3초 (01:34)</span>
          </h4>
          <div class="hbar-list">
            <div class="hbar-row">
              <span class="hbar-label">1. 자유형 50m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 75.5%; background:#2563eb;">78경기</div></div>
              <span class="hbar-val">01:24 (83.9s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">2. 평영 50m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 86.8%; background:#d97706;">55경기</div></div>
              <span class="hbar-val">01:36 (96.3s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">3. 접영 50m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 88.6%; background:#e11d48;">40경기</div></div>
              <span class="hbar-val">01:38 (98.3s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">4. 배영 50m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 95.2%; background:#16a34a;">47경기</div></div>
              <span class="hbar-val">01:46 (105.7s)</span>
            </div>
          </div>
        </div>

        <div class="hbar-chart-box">
          <h4 class="hbar-chart-title">
            <span>🤝 단체전 200m 종목별 평균 소요시간 비교</span>
            <span style="font-size:11.5px; color:#64748b;">전체 평균 382.1초 (06:22)</span>
          </h4>
          <div class="hbar-list">
            <div class="hbar-row">
              <span class="hbar-label">혼계영 200m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 74.7%; background:#7c3aed;">오후 6경기 실측</div></div>
              <span class="hbar-val">05:36 (336.2s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">계영 200m</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 95.1%; background:#0284c7;">오전 첫 6경기</div></div>
              <span class="hbar-val">07:08 (428.0s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label" style="color:#475569;">단체전 평균</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 84.9%; background:#475569;">총 12경기</div></div>
              <span class="hbar-val">06:22 (382.1s)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 영법별 평균 소요시간 상세 표 -->
      <div class="table-responsive">
        <table class="record-table">
          <thead>
            <tr>
              <th style="width: 110px; text-align:center;">순위</th>
              <th style="width: 155px; text-align:left;">종목 (영법)</th>
              <th style="width: 90px; text-align:center;">경기 수</th>
              <th style="width: 140px; text-align:center;">평균 소요시간 (분:초)</th>
              <th style="width: 110px; text-align:center;">평균 (초)</th>
              <th style="min-width: 280px; text-align:left;">실측 체크포인트 특성 분석</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:center; font-weight:800; color:#1d4ed8;">1 (가장 빠름)</td>
              <td style="text-align:left; font-weight:700; color:#334155;">자유형 50m</td>
              <td style="text-align:center; font-weight:700;">78경기</td>
              <td style="text-align:center; font-weight:900; color:#1d4ed8;">01:24</td>
              <td style="text-align:center; font-weight:800;">83.9초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">다이빙 출발 + 가장 빠른 영법 (오후 여학생 #204~#226 23경기 순수 실측 평균 <strong>01:20 [79.8초]</strong>)</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#64748b;">2</td>
              <td style="text-align:left; font-weight:700; color:#334155;">평영 50m</td>
              <td style="text-align:center; font-weight:700;">55경기</td>
              <td style="text-align:center; font-weight:900; color:#0f172a;">01:36</td>
              <td style="text-align:center; font-weight:800;">96.3초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">다이빙 출발이나 수영 자체 소요시간이 자유형·접영보다 약 10~12초 더 소요</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#64748b;">3</td>
              <td style="text-align:left; font-weight:700; color:#334155;">접영 50m</td>
              <td style="text-align:center; font-weight:700;">40경기</td>
              <td style="text-align:center; font-weight:900; color:#0f172a;">01:38</td>
              <td style="text-align:center; font-weight:800;">98.3초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">오전 첫 개인전 종목(#7~#46)으로 진행 요원·선수 초반 적응 시간 포함</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#be123c;">4 (개인전 최장)</td>
              <td style="text-align:left; font-weight:700; color:#334155;">배영 50m</td>
              <td style="text-align:center; font-weight:700;">47경기</td>
              <td style="text-align:center; font-weight:900; color:#be123c;">01:46</td>
              <td style="text-align:center; font-weight:800;">105.7초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;"><strong>수중 입수 출발 + 백스트로크 손잡이 정렬</strong>로 인해 다이빙 종목 대비 경기당 약 <strong>15~22초</strong> 추가 소요</td>
            </tr>
            <tr style="background:#faf5ff;">
              <td style="text-align:center; font-weight:800; color:#7c3aed;">5 (단체전)</td>
              <td style="text-align:left; font-weight:800; color:#6d28d9;">혼계영 200m (단체)</td>
              <td style="text-align:center; font-weight:700;">6경기</td>
              <td style="text-align:center; font-weight:900; color:#6d28d9;">05:36</td>
              <td style="text-align:center; font-weight:800;">336.2초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">1번 영자 수중 입수(배영) + 4영법 계영 실측 평균 (#227~#232, 16:31:25~17:05:00)</td>
            </tr>
            <tr style="background:#f0f9ff;">
              <td style="text-align:center; font-weight:800; color:#0369a1;">6 (단체전)</td>
              <td style="text-align:left; font-weight:800; color:#0369a1;">계영 200m (단체)</td>
              <td style="text-align:center; font-weight:700;">6경기</td>
              <td style="text-align:center; font-weight:900; color:#0369a1;">07:08</td>
              <td style="text-align:center; font-weight:800;">428.0초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">오전 개시 직후 첫 6경기 평균 (#1~#6, 08:30 공식 시작 대기 및 초반 정렬 포함)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 3. 그룹 × 영법 상세 매트릭스 (연령대별 막대그래프 + 매트릭스 표) -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>👦👧 3. 그룹 × 영법 상세 매트릭스 (단위: 평균 초)</h3>
          <span class="progress-sec-sub">저학년(1~3그룹, 평균 104~110초) 대비 고학년·중등(4~7그룹, 평균 84~91초) 구간에서 경기당 약 20~25초 단축</span>
        </div>
      </div>

      <!-- 그룹 × 영법 세로 비교 막대그래프 -->
      <div class="group-stroke-vchart-wrap">
        <div class="vchart-top-bar">
          <strong style="font-size:13.5px; color:#0f172a;">📊 연령대 그룹별 · 4대 영법별 평균 소요시간 비교 그래프 (단위: 초)</strong>
          <div class="vchart-legend">
            <span><i class="tl-dot" style="background:#e11d48;"></i>접영 50m</span>
            <span><i class="tl-dot" style="background:#16a34a;"></i>배영 50m</span>
            <span><i class="tl-dot" style="background:#d97706;"></i>평영 50m</span>
            <span><i class="tl-dot" style="background:#2563eb;"></i>자유형 50m</span>
          </div>
        </div>
        <div class="vchart-grid">
          ${vchartColsHtml}
        </div>
      </div>

      <!-- 그룹 × 영법 상세 매트릭스 표 -->
      <div class="table-responsive">
        <table class="record-table">
          <thead>
            <tr>
              <th style="min-width: 140px; text-align:left;">그룹 (연령 기준)</th>
              <th style="width: 85px; text-align:center;">경기 수</th>
              <th style="min-width: 120px; text-align:center;">접영 50m</th>
              <th style="min-width: 120px; text-align:center;">배영 50m</th>
              <th style="min-width: 120px; text-align:center;">평영 50m</th>
              <th style="min-width: 120px; text-align:center;">자유형 50m</th>
              <th style="min-width: 135px; text-align:center;">그룹 전체 평균</th>
            </tr>
          </thead>
          <tbody>
            ${matrixBodyHtml}
          </tbody>
          <tfoot>
            <tr style="background:#f1f5f9; font-weight:900;">
              <td style="text-align:left; color:#0f172a;">전체 개인전 합계 / 평균</td>
              <td style="text-align:center; color:#0f172a;">220경기</td>
              <td style="text-align:center; color:#be123c;">98.3초 (01:38)</td>
              <td style="text-align:center; color:#15803d;">105.7초 (01:46)</td>
              <td style="text-align:center; color:#b45309;">96.3초 (01:36)</td>
              <td style="text-align:center; color:#1d4ed8;">83.9초 (01:24)</td>
              <td style="text-align:center; color:#0284c7; background:#e0f2fe;">94.3초 (01:34)</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 4. 성별 개인전 평균 소요시간 (막대그래프 + 비교 표)              -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>🚻 4. 성별 개인전 평균 소요시간</h3>
          <span class="progress-sec-sub">남자 01:35 (94.9초) vs 여자 01:34 (93.5초) — 성별 간 차이는 1.4초 이내로 동일하며 연령대와 영법이 핵심 변수</span>
        </div>
      </div>

      <div class="charts-two-col">
        <div class="hbar-chart-box">
          <h4 class="hbar-chart-title">
            <span>📊 성별 개인전 전체 평균 소요시간 비교</span>
            <span style="font-size:11.5px; color:#64748b;">차이 1.4초 (거의 동일)</span>
          </h4>
          <div class="hbar-list">
            <div class="hbar-row">
              <span class="hbar-label">👨 남자 (119경기)</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 89.5%; background:#0284c7;">총 188분 15초 (11,295초)</div></div>
              <span class="hbar-val">01:35 (94.9s)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">👩 여자 (101경기)</span>
              <div class="hbar-track"><div class="hbar-fill" style="width: 88.2%; background:#ec4899;">총 157분 28초 (9,448초)</div></div>
              <span class="hbar-val">01:34 (93.5s)</span>
            </div>
          </div>
        </div>

        <div class="hbar-chart-box" style="display:flex; flex-direction:column; justify-content:center; gap:8px;">
          <h4 class="hbar-chart-title" style="margin-bottom:4px;">💡 성별 소요시간 핵심 결론</h4>
          <p style="margin:0; font-size:13px; color:#334155; line-height:1.6; font-weight:600;">
            • <strong>남자 (119경기)</strong>: 평균 <strong>01:35 (94.9초)</strong><br>
            • <strong>여자 (101경기)</strong>: 평균 <strong>01:34 (93.5초)</strong><br>
            • 성별에 따른 진행 시간 차이는 <strong>1.4초 이내</strong>로 거의 동일하며, <strong>영법(배영 &gt; 접영·평영 &gt; 자유형)</strong>과 <strong>연령대(1~3그룹 &gt; 4~7그룹)</strong>가 경기 시간을 좌우하는 핵심 변수입니다.
          </p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="record-table">
          <thead>
            <tr>
              <th style="width: 120px; text-align:center;">성별</th>
              <th style="width: 100px; text-align:center;">개인전 경기 수</th>
              <th style="width: 160px; text-align:center;">총 소요시간</th>
              <th style="width: 140px; text-align:center;">평균 소요시간 (분:초)</th>
              <th style="width: 110px; text-align:center;">평균 (초)</th>
              <th style="min-width: 240px; text-align:left;">비고</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:center; font-weight:700; color:#334155;">남자</td>
              <td style="text-align:center; font-weight:800;">119경기</td>
              <td style="text-align:center; font-weight:700;">3시간 08분 15초 (11,295초)</td>
              <td style="text-align:center; font-weight:900; color:#0284c7;">01:35</td>
              <td style="text-align:center; font-weight:800;">94.9초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">저학년(2·3그룹) 출전 비중이 소폭 높아 1.4초 차이 발생</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:700; color:#334155;">여자</td>
              <td style="text-align:center; font-weight:800;">101경기</td>
              <td style="text-align:center; font-weight:700;">2시간 37분 28초 (9,448초)</td>
              <td style="text-align:center; font-weight:900; color:#db2777;">01:34</td>
              <td style="text-align:center; font-weight:800;">93.5초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">오후 자유형 연속 구간(#204~#226) 평균 79.8초로 빠른 진행</td>
            </tr>
            <tr style="background:#f8fafc; font-weight:900;">
              <td style="text-align:center; color:#0f172a;">개인전 전체</td>
              <td style="text-align:center; color:#0f172a;">220경기</td>
              <td style="text-align:center; color:#0f172a;">5시간 45분 43초 (20,743초)</td>
              <td style="text-align:center; color:#0f172a;">01:34</td>
              <td style="text-align:center; color:#0f172a;">94.3초</td>
              <td style="text-align:left; font-size:12.5px; color:#475569;">성별 차이 거의 없음 (영법 및 연령대 그룹이 핵심 변수)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}


// ==========================================================================
// 🏅 TAB 3: 결과 분석 (학생부 843건 · 성인부 492건 공식 기록지 100% 통합 분석)
// 공통 5대 섹션:
//   1. 팀별 점수 및 메달·우승 집계 (경기 진행 재생 가로막대그래프 + 집계표)
//   2. 우리팀 대회 결과 종합 요약 & 입상 명예의 전당
//   3. 우리팀 종목별 상세 성적표
//   4. 영법별 · 연령대 그룹별 1위 기록 추이 꺾은선 그래프
//   5. 공식 기록지 전체 데이터 조회 및 상세분석
// ==========================================================================
let ourTeamResultFilterMode = "all"; // 학생부: 'all' | 'scoring' | 'medal'
let adultPodiumFilterMode = "medal"; // 성인부 명예의전당: 'medal' | 'all' | '거제몽꾸' | '거제야르'
let adultOurTableFilterMode = "all"; // 성인부 우리팀 성적표: 'all' | '거제몽꾸' | '거제야르' | 'scoring' | 'medal'

let rawSheetStrokeFilter = "all";
let rawSheetGroupFilter = "all";
let rawSheetTeamFilter = "all";
let rawSheetRankFilter = "all";
let rawSheetSearchQuery = "";

let ourTeamRecordSortMode = "default";  // 'default' | 'record_asc' | 'record_desc'
let rawSheetRecordSortMode = "default"; // 'default' | 'record_asc' | 'record_desc'
let adultResRecordSortMode = "default"; // 'default' | 'record_asc' | 'record_desc'

function cycleRecordSortMode(mode) {
  if (mode === "default") return "record_asc";
  if (mode === "record_asc") return "record_desc";
  return "default";
}

function getRecordSortHeaderLabel(baseLabel, mode) {
  if (mode === "record_asc") return `${baseLabel} ▲`;
  if (mode === "record_desc") return `${baseLabel} ▼`;
  return `${baseLabel} ↕`;
}

function getRecordSortButtonLabel(mode) {
  if (mode === "record_asc") return "⏱️ 기록 오름차순 ▲ (적용중)";
  if (mode === "record_desc") return "⏱️ 기록 내림차순 ▼ (적용중)";
  return "⏱️ 기록 오름차순 정렬";
}

function getSortableRecordSecForSheetRow(row) {
  if (!row) return null;
  const rStr = String(row.rank ?? "").trim();
  if (rStr === "실격" || rStr === "불참") return null;
  if (isAdultNoteExcludedFromRanking(row.note, row.record)) return null;
  const sec = parseRecordToSeconds(row.record) ?? parseAdultRecordInputToSeconds(row.record);
  return (sec !== null && sec > 0) ? sec : null;
}

function sortRowsByRecordMode(rows, mode, getSecFn) {
  if (!mode || mode === "default") return rows;
  const cloned = [...rows];
  cloned.sort((a, b) => {
    const sA = getSecFn(a);
    const sB = getSecFn(b);
    const validA = sA !== null && Number.isFinite(sA) && sA > 0;
    const validB = sB !== null && Number.isFinite(sB) && sB > 0;
    if (validA && !validB) return -1;
    if (!validA && validB) return 1;
    if (!validA && !validB) {
      return (a.raceIndex || 0) - (b.raceIndex || 0) || (a.lane || 0) - (b.lane || 0);
    }
    const diff = mode === "record_asc" ? (sA - sB) : (sB - sA);
    if (Math.abs(diff) > 1e-6) return diff;
    return (a.raceIndex || 0) - (b.raceIndex || 0) || (a.lane || 0) - (b.lane || 0);
  });
  return cloned;
}

const OUR_TEAM_COLUMNS = [
  { key: "matchNo", label: "경기번호", width: "74px", align: "center" },
  { key: "stroke",  label: "종목",     width: "110px", align: "center" },
  { key: "gender",  label: "성별",     width: "58px", align: "center" },
  { key: "group",   label: "그룹",     width: "68px", align: "center" },
  { key: "lane",    label: "레인",     width: "54px", align: "center" },
  { key: "name",    label: "이름",     width: "155px", align: "left" },
  { key: "team",    label: "소속팀",   width: "105px", align: "center" },
  { key: "record",  label: "기록",     width: "96px", align: "center" },
  { key: "rank",    label: "순위",     width: "60px", align: "center" },
  { key: "points",  label: "점수",     width: "58px", align: "center" },
  { key: "note",    label: "비고",     width: "180px", align: "left" }
];

let visibleOurTeamCols = new Set(OUR_TEAM_COLUMNS.map(c => c.key));

const RAW_SHEET_COLUMNS = [
  { key: "matchNo", label: "경기번호", width: "74px", align: "center" },
  { key: "stroke",  label: "종목",     width: "110px", align: "center" },
  { key: "gender",  label: "성별",     width: "58px", align: "center" },
  { key: "group",   label: "그룹",     width: "68px", align: "center" },
  { key: "lane",    label: "레인",     width: "54px", align: "center" },
  { key: "name",    label: "이름",     width: "150px", align: "left" },
  { key: "team",    label: "단체/개인", width: "135px", align: "center" },
  { key: "record",  label: "기록",     width: "96px", align: "center" },
  { key: "rank",    label: "순위",     width: "60px", align: "center" },
  { key: "points",  label: "점수",     width: "58px", align: "center" },
  { key: "note",    label: "비고",     width: "150px", align: "left" }
];

let visibleRawSheetCols = new Set(RAW_SHEET_COLUMNS.map(c => c.key));

// 학생부 경기번호 진행에 따른 점수 변화 재생(Playback) 상태
const STUDENT_TOTAL_RACES = STUDENT_RACES_DATA.length; // 232경기
const HBAR_ROW_STRIDE = 36; // 29px row height + 7px vertical gap
const STUDENT_MS_PER_RACE = 82; // 60fps 연속 보간 재생 속도 (경기당 82ms)
let studentPlaybackRaceIndex = STUDENT_TOTAL_RACES;
let studentPlaybackProgress = STUDENT_TOTAL_RACES;
let studentPlaybackRafId = null;
let studentPlaybackLastTs = 0;
let isStudentPlaybackRunning = false;
let studentStandingsByRaceCache = null;

function parseRecordToSeconds(recordStr) {
  const s = String(recordStr || "").trim();
  if (!s || s === "99'99\"99" || s === "88'88\"88") return null;
  const m = s.match(/^(\d{2})'(\d{2})"(\d{2})$/);
  if (!m) return null;
  const mins = parseInt(m[1], 10);
  const secs = parseInt(m[2], 10);
  const hundredths = parseInt(m[3], 10);
  return mins * 60 + secs + hundredths / 100;
}

function getStrokeBadgeCls(strokeStr) {
  const s = String(strokeStr || "");
  if (s.includes("핀자유형")) return "ev-pill-fin-free";
  if (s.includes("핀접영")) return "ev-pill-fin-fly";
  if (s.includes("자유형")) return "ev-pill-free";
  if (s.includes("배영")) return "ev-pill-back";
  if (s.includes("평영")) return "ev-pill-breast";
  if (s.includes("접영")) return "ev-pill-fly";
  return "";
}

function buildOurTeamFullEntriesWithResults() {
  return VERIFIED_SHEET_RESULTS.filter(r => r.team === "거제야르").map(r => ({
    raceIndex: r.raceIndex,
    matchNo: r.matchNo,
    isRelay: Boolean(r.isRelay),
    stroke: r.stroke,
    distance: "50m",
    gender: r.gender === "여자" ? "여" : "남",
    group: r.group,
    lane: r.lane,
    name: r.name,
    team: r.team,
    isVerified: true,
    record: r.record,
    rank: r.rank,
    points: r.points,
    note: r.note || ""
  }));
}

function buildAdultOurTeamFullEntriesWithResults() {
  return ADULT_VERIFIED_SHEET_RESULTS.filter(r => OUR_TEAMS.has(r.team)).map(r => ({
    raceIndex: r.raceIndex,
    matchNo: r.matchNo,
    isRelay: Boolean(r.isRelay),
    stroke: r.stroke,
    distance: r.isRelay ? "" : "50m",
    gender: r.gender === "여자" ? "여" : (r.gender === "남자" ? "남" : "혼성"),
    group: r.group,
    lane: r.lane,
    name: r.name,
    team: r.team,
    isVerified: true,
    record: r.record,
    rank: r.rank,
    points: r.points,
    note: r.note || ""
  }));
}

/**
 * 학생부 참가 클럽별 득점 및 메달 집계 ('개인' 자격 참가자 제외, maxRaceIndex 기준)
 */
function buildClubStandingsFromVerifiedSheets(maxRaceIndex = STUDENT_TOTAL_RACES) {
  const stuDivData = getDivisionData("student");
  const map = new Map();

  for (const t of stuDivData.teams) {
    const cleanTeam = t.team.replace("(중등)", "").trim();
    if (cleanTeam === "개인") continue;
    if (!map.has(cleanTeam)) {
      map.set(cleanTeam, {
        team: cleanTeam,
        isOurTeam: cleanTeam === "거제야르",
        expectedPoints: t.expectedPoints || 0,
        entries: 0,
        completed: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        rank4to6: 0,
        top6Total: 0,
        indivWins: 0,
        relayWins: 0,
        indivPoints: 0,
        relayPoints: 0,
        totalPoints: 0
      });
    }
  }

  for (const r of VERIFIED_SHEET_RESULTS) {
    if ((r.raceIndex || 1) > maxRaceIndex) continue;
    const cleanTeam = r.team.replace("(중등)", "").trim();
    if (cleanTeam === "개인") continue;

    if (!map.has(cleanTeam)) {
      map.set(cleanTeam, {
        team: cleanTeam,
        isOurTeam: cleanTeam === "거제야르",
        expectedPoints: 0,
        entries: 0,
        completed: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        rank4to6: 0,
        top6Total: 0,
        indivWins: 0,
        relayWins: 0,
        indivPoints: 0,
        relayPoints: 0,
        totalPoints: 0
      });
    }
    const st = map.get(cleanTeam);
    st.entries++;
    if (!String(r.rank).includes("불참") && !String(r.rank).includes("실격")) {
      st.completed++;
    }
    if (r.rank === "1") {
      st.gold++;
      if (r.isRelay) st.relayWins++;
      else st.indivWins++;
    } else if (r.rank === "2") {
      st.silver++;
    } else if (r.rank === "3") {
      st.bronze++;
    } else if (["4", "5", "6"].includes(r.rank)) {
      st.rank4to6++;
    }

    if (["1", "2", "3", "4", "5", "6"].includes(r.rank)) {
      st.top6Total++;
    }
    st.totalPoints += r.points;
    if (r.isRelay) st.relayPoints += r.points;
    else st.indivPoints += r.points;
  }

  return [...map.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (b.silver !== a.silver) return b.silver - a.silver;
    if (b.bronze !== a.bronze) return b.bronze - a.bronze;
    if (b.top6Total !== a.top6Total) return b.top6Total - a.top6Total;
    return b.expectedPoints - a.expectedPoints;
  });
}

function getStudentStandingsAtRace(raceIdx) {
  if (!studentStandingsByRaceCache) {
    studentStandingsByRaceCache = new Map();
  }
  const clamped = Math.max(0, Math.min(STUDENT_TOTAL_RACES, Math.floor(Number(raceIdx) || 0)));
  if (!studentStandingsByRaceCache.has(clamped)) {
    studentStandingsByRaceCache.set(clamped, buildClubStandingsFromVerifiedSheets(clamped));
  }
  return studentStandingsByRaceCache.get(clamped);
}

function getStudentFinalMaxInfo() {
  const finalStandings = getStudentStandingsAtRace(STUDENT_TOTAL_RACES);
  let maxPts = 1;
  let topClub = "";
  for (const c of finalStandings) {
    if (c.totalPoints > maxPts) {
      maxPts = c.totalPoints;
      topClub = c.team;
    }
  }
  return { maxPts, topClub };
}

function buildInterpolatedStandings(standings0, standings1, alpha) {
  const t = Math.max(0, Math.min(1, Number(alpha) || 0));
  const smoothT = t * t * (3 - 2 * t);
  const blendT = 0.35 * smoothT + 0.65 * t;

  const map1 = new Map(standings1.map(c => [c.team, c]));
  const combined = standings0.map(c0 => {
    const c1 = map1.get(c0.team) || c0;
    const interpPoints = c0.totalPoints + (c1.totalPoints - c0.totalPoints) * blendT;
    const interpGold = c0.gold + (c1.gold - c0.gold) * blendT;
    const interpSilver = c0.silver + (c1.silver - c0.silver) * blendT;
    const interpBronze = c0.bronze + (c1.bronze - c0.bronze) * blendT;
    const interpTop6 = c0.top6Total + (c1.top6Total - c0.top6Total) * blendT;
    return {
      ...c0,
      interpPoints,
      interpGold,
      interpSilver,
      interpBronze,
      interpTop6,
      displayPoints: Math.round(interpPoints)
    };
  });

  combined.sort((a, b) => {
    if (Math.abs(b.interpPoints - a.interpPoints) > 1e-4) return b.interpPoints - a.interpPoints;
    if (Math.abs(b.interpGold - a.interpGold) > 1e-4) return b.interpGold - a.interpGold;
    if (Math.abs(b.interpSilver - a.interpSilver) > 1e-4) return b.interpSilver - a.interpSilver;
    if (Math.abs(b.interpBronze - a.interpBronze) > 1e-4) return b.interpBronze - a.interpBronze;
    if (Math.abs(b.interpTop6 - a.interpTop6) > 1e-4) return b.interpTop6 - a.interpTop6;
    if (b.expectedPoints !== a.expectedPoints) return b.expectedPoints - a.expectedPoints;
    return a.team.localeCompare(b.team, "ko");
  });

  return combined;
}

function getStudentPlaybackRaceLabel(raceIdx) {
  const idx = Math.max(0, Math.min(STUDENT_TOTAL_RACES, Math.floor(Number(raceIdx) ?? STUDENT_TOTAL_RACES)));
  if (idx === 0) {
    return `경기 시작 전 · 초기 상태 (0 / ${STUDENT_TOTAL_RACES}경기)`;
  }
  const race = STUDENT_RACES_DATA[idx - 1];
  if (!race) return `전체 완료 (${STUDENT_TOTAL_RACES} / ${STUDENT_TOTAL_RACES}경기)`;
  const shortTitle = String(race.title || "").replace(/^학생부\s*/, "");
  return `경기 #${race.primary_match_no} · ${shortTitle} (${idx} / ${STUDENT_TOTAL_RACES})`;
}

function updateStudentPlaybackControlsDOM() {
  const playBtn = document.getElementById("btnStudentPlaybackToggle");
  const prevBtn = document.getElementById("btnStudentPlaybackPrev");
  const nextBtn = document.getElementById("btnStudentPlaybackNext");
  const slider = document.getElementById("studentPlaybackSlider");
  const infoEl = document.getElementById("studentPlaybackMatchInfo");

  if (playBtn) {
    playBtn.classList.toggle("is-playing", isStudentPlaybackRunning);
    playBtn.innerHTML = isStudentPlaybackRunning ? "⏸️ 일시정지" : "▶️ 재생";
  }
  if (prevBtn) {
    prevBtn.disabled = studentPlaybackRaceIndex <= 0;
  }
  if (nextBtn) {
    nextBtn.disabled = studentPlaybackRaceIndex >= STUDENT_TOTAL_RACES;
  }
  if (slider && Number(slider.value) !== studentPlaybackRaceIndex) {
    slider.value = String(studentPlaybackRaceIndex);
  }
  if (infoEl) {
    infoEl.textContent = getStudentPlaybackRaceLabel(studentPlaybackRaceIndex);
  }
}

function stopStudentPlayback() {
  if (studentPlaybackRafId) {
    cancelAnimationFrame(studentPlaybackRafId);
    studentPlaybackRafId = null;
  }
  isStudentPlaybackRunning = false;
  const hbarBox = document.getElementById("studentTeamScoreHBarContainer");
  if (hbarBox) hbarBox.classList.remove("is-raf-playing");
  updateStudentPlaybackControlsDOM();
}

function startStudentPlayback() {
  if (studentPlaybackRafId) {
    cancelAnimationFrame(studentPlaybackRafId);
    studentPlaybackRafId = null;
  }
  if (studentPlaybackProgress >= STUDENT_TOTAL_RACES - 0.001) {
    studentPlaybackProgress = 0;
    studentPlaybackRaceIndex = 0;
  }
  isStudentPlaybackRunning = true;
  studentPlaybackLastTs = performance.now();

  const hbarBox = document.getElementById("studentTeamScoreHBarContainer");
  if (hbarBox) hbarBox.classList.add("is-raf-playing");

  updateStudentHBarChartSmooth(studentPlaybackProgress);
  renderStudentMedalTableAtRace(studentPlaybackRaceIndex);
  updateStudentPlaybackControlsDOM();

  const stepFrame = (now) => {
    if (!isStudentPlaybackRunning) return;
    const dt = Math.min(64, Math.max(0, now - studentPlaybackLastTs));
    studentPlaybackLastTs = now;

    studentPlaybackProgress = Math.min(
      STUDENT_TOTAL_RACES,
      studentPlaybackProgress + dt / STUDENT_MS_PER_RACE
    );

    const nextIntIdx = Math.floor(studentPlaybackProgress + 1e-6);
    const indexChanged = nextIntIdx !== studentPlaybackRaceIndex;
    studentPlaybackRaceIndex = nextIntIdx;

    updateStudentHBarChartSmooth(studentPlaybackProgress);
    if (indexChanged) {
      renderStudentMedalTableAtRace(studentPlaybackRaceIndex);
      updateStudentPlaybackControlsDOM();
    }

    if (studentPlaybackProgress < STUDENT_TOTAL_RACES - 1e-6) {
      studentPlaybackRafId = requestAnimationFrame(stepFrame);
    } else {
      studentPlaybackProgress = STUDENT_TOTAL_RACES;
      studentPlaybackRaceIndex = STUDENT_TOTAL_RACES;
      updateStudentHBarChartSmooth(STUDENT_TOTAL_RACES);
      renderStudentMedalTableAtRace(STUDENT_TOTAL_RACES);
      stopStudentPlayback();
    }
  };

  studentPlaybackRafId = requestAnimationFrame(stepFrame);
}

function updateStudentHBarChartSmooth(progressVal) {
  const hbarBox = document.getElementById("studentTeamScoreHBarContainer");
  if (!hbarBox) return;

  const { maxPts: finalMaxPts, topClub } = getStudentFinalMaxInfo();

  const scaleEl = document.getElementById("studentHBarScaleTicks");
  if (scaleEl && scaleEl.dataset.maxPts !== String(finalMaxPts)) {
    scaleEl.dataset.maxPts = String(finalMaxPts);
    const p25 = Math.round(finalMaxPts * 0.25);
    const p50 = Math.round(finalMaxPts * 0.5);
    const p75 = Math.round(finalMaxPts * 0.75);
    scaleEl.innerHTML = `
      <span class="adult-hbar-scale-tick is-start">0점</span>
      <span class="adult-hbar-scale-tick" style="left:25%;">${p25}점</span>
      <span class="adult-hbar-scale-tick" style="left:50%;">${p50}점</span>
      <span class="adult-hbar-scale-tick" style="left:75%;">${p75}점</span>
      <span class="adult-hbar-scale-tick is-end">최종 최대 ${finalMaxPts}점 (${escapeHtml(topClub)})</span>
    `;
  }

  const maxLabelEl = document.getElementById("studentHBarScaleMaxLabel");
  if (maxLabelEl) {
    maxLabelEl.textContent = `최대 ${finalMaxPts}점`;
  }

  const r0 = Math.max(0, Math.min(STUDENT_TOTAL_RACES, Math.floor(progressVal)));
  const r1 = Math.min(STUDENT_TOTAL_RACES, r0 + 1);
  const alpha = progressVal - r0;

  const standings0 = getStudentStandingsAtRace(r0);
  const standings1 = r1 === r0 ? standings0 : getStudentStandingsAtRace(r1);
  const displayStandings = buildInterpolatedStandings(standings0, standings1, alpha);

  const totalHeight = Math.max(0, displayStandings.length * HBAR_ROW_STRIDE - 7);
  hbarBox.style.height = `${totalHeight}px`;

  const existingRows = hbarBox.querySelectorAll(".adult-hbar-row[data-student-vbar-team]");
  if (existingRows.length !== displayStandings.length) {
    hbarBox.innerHTML = displayStandings.map((c, idx) => {
      const rowHighlight = c.isOurTeam ? "background:#fff7ed; border:1px solid #fdba74;" : "";
      const barColorCls = c.isOurTeam ? "is-our-orange" : "is-blue";
      return `
        <div class="adult-hbar-row" style="${rowHighlight} transform:translate3d(0, ${idx * HBAR_ROW_STRIDE}px, 0);" data-student-vbar-team="${escapeHtml(c.team)}">
          <span class="adult-hbar-team" data-role="team-label" style="color:${c.isOurTeam ? "#c2410c" : "#0f172a"};"></span>
          <div class="adult-hbar-track">
            <div class="adult-hbar-fill ${barColorCls}" data-role="bar-fill" style="width:0%;"></div>
          </div>
          <span class="adult-hbar-score" data-role="score-label" style="color:${c.isOurTeam ? "#c2410c" : "#0f172a"};">0점</span>
        </div>
      `;
    }).join("");
  }

  const rowMap = new Map();
  hbarBox.querySelectorAll(".adult-hbar-row[data-student-vbar-team]").forEach(el => {
    rowMap.set(el.dataset.studentVbarTeam, el);
  });

  displayStandings.forEach((c, idx) => {
    const rowEl = rowMap.get(c.team);
    if (!rowEl) return;

    const widthPct = c.interpPoints > 0
      ? Math.min(100, Math.max(0.35, (c.interpPoints / finalMaxPts) * 100))
      : 0;
    const barColorCls = c.isOurTeam ? "is-our-orange" : "is-blue";

    rowEl.style.transform = `translate3d(0, ${idx * HBAR_ROW_STRIDE}px, 0)`;
    rowEl.classList.toggle("is-active-filter", rawSheetTeamFilter === c.team);

    const teamLabelEl = rowEl.querySelector('[data-role="team-label"]');
    if (teamLabelEl) {
      teamLabelEl.textContent = `${idx + 1}. ${c.isOurTeam ? "🏊 " : ""}${c.team}`;
    }

    const fillEl = rowEl.querySelector('[data-role="bar-fill"]');
    if (fillEl) {
      fillEl.className = `adult-hbar-fill ${barColorCls}`;
      fillEl.style.width = `${widthPct.toFixed(3)}%`;
    }

    const scoreEl = rowEl.querySelector('[data-role="score-label"]');
    if (scoreEl) {
      scoreEl.textContent = `${c.displayPoints}점`;
    }
  });
}

function renderStudentMedalTableAtRace(raceIdx) {
  const medalTbody = document.getElementById("studentTeamMedalTableBody");
  if (!medalTbody) return;
  const clubStandings = getStudentStandingsAtRace(raceIdx);

  medalTbody.innerHTML = clubStandings.map((c, idx) => {
    const rowCls = c.isOurTeam ? "team-power-row row-team-yareu" : "team-power-row";
    const teamTextColor = c.team === "거제몽꾸" ? "#c2410c" : c.team === "거제야르" ? "#0369a1" : "#334155";

    return `
      <tr class="${rowCls}" data-student-vbar-team="${escapeHtml(c.team)}">
        <td style="text-align:center; font-weight:800; color:${c.isOurTeam ? "#0284c7" : "#475569"}; font-variant-numeric:tabular-nums;">${idx + 1}</td>
        <td style="text-align:left; font-weight:${c.isOurTeam ? "900" : "700"}; color:${teamTextColor};">${escapeHtml(c.team)}</td>
        <td style="text-align:center; font-weight:800; color:${c.gold > 0 ? "#b45309" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.gold}</td>
        <td style="text-align:center; font-weight:800; color:${c.silver > 0 ? "#334155" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.silver}</td>
        <td style="text-align:center; font-weight:800; color:${c.bronze > 0 ? "#9a3412" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.bronze}</td>
        <td style="text-align:center; font-weight:700; color:${c.rank4to6 > 0 ? "#0284c7" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.rank4to6}</td>
        <td style="text-align:center; font-weight:800; color:${c.indivWins > 0 ? "#0f172a" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.indivWins}</td>
        <td style="text-align:center; font-weight:800; color:${c.relayWins > 0 ? "#7c3aed" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.relayWins}</td>
        <td style="text-align:center; font-weight:800; color:#0284c7; font-variant-numeric:tabular-nums;">${c.indivPoints}</td>
        <td style="text-align:center; font-weight:800; color:#7c3aed; font-variant-numeric:tabular-nums;">${c.relayPoints}</td>
        <td style="text-align:center; font-weight:900; font-size:14px; color:${c.totalPoints > 0 ? "#0f172a" : "#94a3b8"}; font-variant-numeric:tabular-nums;">${c.totalPoints}</td>
      </tr>
    `;
  }).join("");
}

function renderStudentStandingsAndChartForCurrentStep() {
  studentPlaybackProgress = studentPlaybackRaceIndex;
  updateStudentHBarChartSmooth(studentPlaybackProgress);
  renderStudentMedalTableAtRace(studentPlaybackRaceIndex);
}

/**
 * 영법별 그룹별 1위 기록 꺾은선 그래프 생성 (학생부 4종목 / 성인부 6종목 공통)
 */
function renderStrokeFirstPlaceLineChartsHtml(divisionKey = "student") {
  const isAdult = divisionKey === "adult";
  const strokeConfigs = isAdult
    ? [
        { key: "핀접영",   title: "🐬 핀접영 50m — 그룹별 1위 기록",   accent: "#7c3aed", yMin: 20, yMax: 45, yTicks: [20, 25, 30, 35, 40, 45] },
        { key: "배영",     title: "🌊 배영 50m — 그룹별 1위 기록",     accent: "#16a34a", yMin: 25, yMax: 75, yTicks: [25, 35, 45, 55, 65, 75] },
        { key: "접영",     title: "🦋 접영 50m — 그룹별 1위 기록",     accent: "#e11d48", yMin: 25, yMax: 50, yTicks: [25, 30, 35, 40, 45, 50] },
        { key: "핀자유형", title: "🚀 핀자유형 50m — 그룹별 1위 기록", accent: "#0284c7", yMin: 20, yMax: 40, yTicks: [20, 25, 30, 35, 40] },
        { key: "평영",     title: "🐸 평영 50m — 그룹별 1위 기록",     accent: "#d97706", yMin: 30, yMax: 55, yTicks: [30, 35, 40, 45, 50, 55] },
        { key: "자유형",   title: "🏊 자유형 50m — 그룹별 1위 기록",   accent: "#2563eb", yMin: 20, yMax: 45, yTicks: [20, 25, 30, 35, 40, 45] }
      ]
    : [
        { key: "접영",   title: "🦋 접영 50m — 그룹별 1위 기록 (좌상)",   accent: "#e11d48", yMin: 25, yMax: 60, yTicks: [25, 30, 35, 40, 45, 50, 55, 60] },
        { key: "배영",   title: "🌊 배영 50m — 그룹별 1위 기록 (우상)",   accent: "#16a34a", yMin: 25, yMax: 60, yTicks: [25, 30, 35, 40, 45, 50, 55, 60] },
        { key: "평영",   title: "🐸 평영 50m — 그룹별 1위 기록 (좌하)",   accent: "#d97706", yMin: 30, yMax: 65, yTicks: [30, 35, 40, 45, 50, 55, 60, 65] },
        { key: "자유형", title: "🏊 자유형 50m — 그룹별 1위 기록 (우하)", accent: "#2563eb", yMin: 25, yMax: 55, yTicks: [25, 30, 35, 40, 45, 50, 55] }
      ];

  const groups = isAdult ? ADULT_GROUPS : STUDENT_GROUPS;
  const dataset = isAdult ? ADULT_VERIFIED_SHEET_RESULTS : VERIFIED_SHEET_RESULTS;

  const svgW = 460;
  const svgH = 215;
  const padL = 42;
  const padR = 20;
  const padT = 22;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const getX = (grpIdx) => padL + (grpIdx / (groups.length - 1)) * plotW;

  return strokeConfigs.map(cfg => {
    const { yMin, yMax, yTicks } = cfg;
    const getY = (sec) => {
      const clamped = Math.max(yMin, Math.min(yMax, sec));
      return padT + plotH - ((clamped - yMin) / (yMax - yMin)) * plotH;
    };

    const malePoints = [];
    const femalePoints = [];

    groups.forEach((grp, idx) => {
      const mWinner = dataset.find(
        r => !r.isRelay && r.stroke === cfg.key && r.gender === "남자" && r.group === grp && r.rank === "1"
      );
      if (mWinner) {
        const sec = mWinner.sec ?? parseRecordToSeconds(mWinner.record);
        if (sec !== null) {
          malePoints.push({
            idx,
            grp,
            x: getX(idx),
            y: getY(sec),
            sec,
            winner: mWinner
          });
        }
      }

      const fWinner = dataset.find(
        r => !r.isRelay && r.stroke === cfg.key && r.gender === "여자" && r.group === grp && r.rank === "1"
      );
      if (fWinner) {
        const sec = fWinner.sec ?? parseRecordToSeconds(fWinner.record);
        if (sec !== null) {
          femalePoints.push({
            idx,
            grp,
            x: getX(idx),
            y: getY(sec),
            sec,
            winner: fWinner
          });
        }
      }
    });

    const gridSvg = yTicks.map(t => {
      const y = getY(t);
      return `
        <line x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="${t === yMin ? "none" : "3,3"}" />
        <text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10.5" font-weight="700" fill="#64748b">${t}s</text>
      `;
    }).join("");

    const xLabelsSvg = groups.map((g, idx) => {
      const x = getX(idx);
      return `
        <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#f1f5f9" stroke-width="1" />
        <text x="${x}" y="${svgH - 8}" text-anchor="middle" font-size="11" font-weight="800" fill="#334155">${g}</text>
      `;
    }).join("");

    const buildSeriesSvg = (pts, color, isFemale) => {
      if (pts.length === 0) return "";
      const polyPoints = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const lineHtml = pts.length > 1
        ? `<polyline fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" points="${polyPoints}" />`
        : "";

      const nodesHtml = pts.map(p => {
        const isOur = OUR_TEAMS.has(p.winner.team);
        const rRadius = isOur ? 5.8 : 4.2;
        const fillCol = isOur ? "#eab308" : color;
        const strokeCol = isOur ? "#713f12" : "#ffffff";
        const labelOffsetY = isFemale ? -9 : 14;
        const labelText = `${p.sec.toFixed(2)}s`;
        const tooltip = `${p.grp} ${isFemale ? "여자" : "남자"} 1위: ${p.winner.name} (${p.winner.team}) — ${p.winner.record} (${p.sec.toFixed(2)}초)`;
        return `
          <g>
            <title>${escapeHtml(tooltip)}</title>
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rRadius}" fill="${fillCol}" stroke="${strokeCol}" stroke-width="1.8" />
            <text x="${p.x.toFixed(1)}" y="${(p.y + labelOffsetY).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="800" fill="${isOur ? "#b45309" : color}">${labelText}</text>
          </g>
        `;
      }).join("");

      return lineHtml + nodesHtml;
    };

    return `
      <div class="stroke-linechart-card">
        <div class="stroke-linechart-head">
          <h4 class="stroke-linechart-title">${escapeHtml(cfg.title)}</h4>
          <div class="stroke-linechart-legend">
            <span><i class="line-legend-dot" style="background:#0284c7;"></i>남자 1위</span>
            <span><i class="line-legend-dot" style="background:#ec4899;"></i>여자 1위</span>
            <span><i class="line-legend-dot" style="background:#eab308; border:1px solid #713f12;"></i>우리팀 1위</span>
          </div>
        </div>
        <div class="stroke-svg-wrap">
          <svg viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="${escapeHtml(cfg.title)}">
            ${gridSvg}
            ${xLabelsSvg}
            ${buildSeriesSvg(malePoints, "#0284c7", false)}
            ${buildSeriesSvg(femalePoints, "#ec4899", true)}
          </svg>
        </div>
      </div>
    `;
  }).join("");
}

function renderOurTeamResultRows() {
  const thead = document.getElementById("ourTeamResultTableHead");
  const tbody = document.getElementById("ourTeamResultTableBody");
  const countBadge = document.getElementById("ourTeamResultCountBadge");
  if (!tbody || !thead) return;

  const isAdult = currentDivision === "adult";
  const activeCols = OUR_TEAM_COLUMNS.filter(c => visibleOurTeamCols.has(c.key));

  thead.innerHTML = `
    <tr>
      ${activeCols.map(c => {
        if (c.key === "record") {
          const isSorted = ourTeamRecordSortMode !== "default";
          const lbl = getRecordSortHeaderLabel(c.label, ourTeamRecordSortMode);
          return `<th class="th-sortable-record ${isSorted ? "is-sorted" : ""}" data-our-record-sort-th="1" style="width:${c.width}; text-align:${c.align};" title="클릭하여 기록순 정렬 (오름차순 ▲ / 내림차순 ▼ / 기본순)">${escapeHtml(lbl)}</th>`;
        }
        return `<th style="width:${c.width}; text-align:${c.align};">${escapeHtml(c.label)}</th>`;
      }).join("")}
    </tr>
  `;

  const ourSortBtn = document.getElementById("btnOurTeamSortRecordAsc");
  if (ourSortBtn) {
    ourSortBtn.classList.toggle("is-active-sort", ourTeamRecordSortMode !== "default");
    ourSortBtn.textContent = getRecordSortButtonLabel(ourTeamRecordSortMode);
  }

  const allOurEntries = isAdult ? buildAdultOurTeamFullEntriesWithResults() : buildOurTeamFullEntriesWithResults();
  let filtered = allOurEntries;

  if (isAdult) {
    if (adultOurTableFilterMode === "거제몽꾸" || adultOurTableFilterMode === "거제야르") {
      filtered = allOurEntries.filter(item => item.team === adultOurTableFilterMode);
    } else if (adultOurTableFilterMode === "scoring") {
      filtered = allOurEntries.filter(item => item.points > 0);
    } else if (adultOurTableFilterMode === "medal") {
      filtered = allOurEntries.filter(item => ["1", "2", "3"].includes(String(item.rank)));
    }
    if (countBadge) {
      countBadge.textContent = `${filtered.length}건 표시 중 (우리팀 전체 87출전 · 거제몽꾸 65건 · 거제야르 22건 · 입상 53건)`;
    }
  } else {
    if (ourTeamResultFilterMode === "scoring") {
      filtered = allOurEntries.filter(item => item.points > 0);
    } else if (ourTeamResultFilterMode === "medal") {
      filtered = allOurEntries.filter(item => ["1", "2", "3"].includes(String(item.rank)));
    }
    if (countBadge) {
      countBadge.textContent = `${filtered.length}건 표시 중 (거제야르 전체 53출전 100% 확인 완료 · 입상 12건 · 메달 5건)`;
    }
  }

  filtered = sortRowsByRecordMode(filtered, ourTeamRecordSortMode, getSortableRecordSecForSheetRow);

  if (activeCols.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td style="text-align:center; padding:32px 16px; color:#64748b; font-weight:600;">
          표시할 열(항목)을 최소 1개 이상 선택해 주세요.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((item) => {
    const isScoring = item.points > 0;
    const rowBg = item.team === "거제몽꾸"
      ? (isScoring ? "background:#fff7ed;" : "")
      : (isScoring ? "background:#f0f9ff;" : "");

    const recordDisplay = (item.record === "99'99\"99" || item.record === "88'88\"88")
      ? `<span style="color:#94a3b8; font-size:12px;">${escapeHtml(item.record)}</span>`
      : `<strong style="color:#0f172a; font-variant-numeric:tabular-nums;">${escapeHtml(item.record)}</strong>`;

    const strokeLabel = item.isRelay ? item.stroke : `${item.stroke} ${item.distance}`;

    const rawRankStr = String(item.rank ?? "").trim().replace("위", "");
    const isNumericRank = /^\d+$/.test(rawRankStr);
    const rankNumHtml = isNumericRank
      ? `<span style="font-weight:${Number(rawRankStr) <= 6 ? "900" : "700"}; color:${
          rawRankStr === "1" ? "#b45309" : rawRankStr === "2" ? "#334155" : rawRankStr === "3" ? "#9a3412" : Number(rawRankStr) <= 6 ? "#0284c7" : "#475569"
        }; font-variant-numeric:tabular-nums;">${rawRankStr}</span>`
      : `<span style="color:#cbd5e1;">-</span>`;

    const pointsHtml = `<span style="font-weight:${item.points > 0 ? "900" : "600"}; color:${item.points > 0 ? "#1d4ed8" : "#94a3b8"}; font-variant-numeric:tabular-nums;">${item.points}</span>`;

    const noteParts = [];
    if (!isNumericRank && rawRankStr) noteParts.push(rawRankStr);
    if (item.note) noteParts.push(item.note);
    const noteText = noteParts.join(" · ");

    const teamColor = item.team === "거제몽꾸"
      ? "#c2410c"
      : item.team === "거제야르"
        ? "#0369a1"
        : "#334155";
    const groupNumOnly = String(item.group || "").replace(/[^0-9]/g, "") || "-";

    const cellMap = {
      matchNo: `<td style="text-align:center; font-weight:800; color:#0284c7; font-variant-numeric:tabular-nums;">#${escapeHtml(item.matchNo)}</td>`,
      stroke:  `<td style="text-align:center; font-weight:700; color:#334155;">${escapeHtml(strokeLabel)}</td>`,
      gender:  `<td style="text-align:center; font-weight:700; color:#334155;">${escapeHtml(item.gender)}</td>`,
      group:   `<td style="text-align:center; font-weight:700; color:#334155; font-variant-numeric:tabular-nums;">${escapeHtml(groupNumOnly)}</td>`,
      lane:    `<td style="text-align:center; font-weight:800; color:#334155; font-variant-numeric:tabular-nums;">${item.lane}</td>`,
      name:    `<td style="text-align:left; font-weight:800; color:#0f172a;">${escapeHtml(item.name)}</td>`,
      team:    `<td style="text-align:center; font-weight:900; color:${teamColor};">${escapeHtml(item.team)}</td>`,
      record:  `<td style="text-align:center;">${recordDisplay}</td>`,
      rank:    `<td style="text-align:center;">${rankNumHtml}</td>`,
      points:  `<td style="text-align:center;">${pointsHtml}</td>`,
      note:    `<td style="text-align:left; font-size:12px; color:${item.rank === "실격" ? "#be123c" : "#475569"}; font-weight:${isScoring || item.rank === "실격" ? "700" : "500"};">${escapeHtml(noteText || "-")}</td>`
    };

    return `
      <tr style="${rowBg}" data-row-stroke="${escapeHtml(item.stroke)}" data-row-match="${escapeHtml(item.matchNo)}">
        ${activeCols.map(c => cellMap[c.key]).join("")}
      </tr>
    `;
  }).join("");
}

function renderAllVerifiedSheetRows() {
  const thead = document.getElementById("verifiedSheetTableHead");
  const tbody = document.getElementById("verifiedSheetTableBody");
  const titleEl = document.getElementById("verifiedSheetTableTitle");
  if (!tbody || !thead) return;

  const activeCols = RAW_SHEET_COLUMNS.filter(c => visibleRawSheetCols.has(c.key));

  thead.innerHTML = `
    <tr>
      ${activeCols.map(c => {
        if (c.key === "record") {
          const isSorted = rawSheetRecordSortMode !== "default";
          const lbl = getRecordSortHeaderLabel(c.label, rawSheetRecordSortMode);
          return `<th class="th-sortable-record ${isSorted ? "is-sorted" : ""}" data-raw-record-sort-th="1" style="width:${c.width}; text-align:${c.align};" title="클릭하여 기록순 정렬 (오름차순 ▲ / 내림차순 ▼ / 기본순)">${escapeHtml(lbl)}</th>`;
        }
        return `<th style="width:${c.width}; text-align:${c.align};">${escapeHtml(c.label)}</th>`;
      }).join("")}
    </tr>
  `;

  const rawSortBtn = document.getElementById("btnRawSheetSortRecordAsc");
  if (rawSortBtn) {
    rawSortBtn.classList.toggle("is-active-sort", rawSheetRecordSortMode !== "default");
    rawSortBtn.textContent = getRecordSortButtonLabel(rawSheetRecordSortMode);
  }
  const rawSortSel = document.getElementById("rawSheetSortSelect");
  if (rawSortSel && rawSortSel.value !== rawSheetRecordSortMode) {
    rawSortSel.value = rawSheetRecordSortMode;
  }

  let list = [...VERIFIED_SHEET_RESULTS];

  if (rawSheetStrokeFilter !== "all") {
    list = list.filter(r => r.stroke === rawSheetStrokeFilter);
  }
  if (rawSheetGroupFilter !== "all") {
    list = list.filter(r => `${r.gender} ${r.group}` === rawSheetGroupFilter);
  }
  if (rawSheetTeamFilter !== "all") {
    list = list.filter(r => r.team.replace("(중등)", "").trim() === rawSheetTeamFilter);
  }
  if (rawSheetRankFilter === "top6") {
    list = list.filter(r => ["1", "2", "3", "4", "5", "6"].includes(r.rank));
  } else if (rawSheetRankFilter === "medal") {
    list = list.filter(r => ["1", "2", "3"].includes(r.rank));
  } else if (rawSheetRankFilter === "dq_dns") {
    list = list.filter(r => r.rank === "실격" || r.rank === "불참");
  }

  if (rawSheetSearchQuery.trim() !== "") {
    const q = rawSheetSearchQuery.trim().toLowerCase();
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.team.toLowerCase().includes(q) ||
      r.matchNo.toLowerCase().includes(q) ||
      r.stroke.toLowerCase().includes(q) ||
      r.group.toLowerCase().includes(q) ||
      String(r.note || "").toLowerCase().includes(q)
    );
  }

  list = sortRowsByRecordMode(list, rawSheetRecordSortMode, getSortableRecordSecForSheetRow);

  if (titleEl) {
    titleEl.textContent = `📄 학생부 공식 기록지 원문 전체 데이터 조회 (${list.length}건 표시 중 / 전체 ${VERIFIED_SHEET_RESULTS.length}건)`;
  }

  if (activeCols.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td style="text-align:center; padding:32px 16px; color:#64748b; font-weight:600;">
          표시할 열(항목)을 최소 1개 이상 선택해 주세요.
        </td>
      </tr>
    `;
    return;
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${activeCols.length}" style="text-align:center; padding:32px 16px; color:#64748b; font-weight:600;">
          선택한 조건에 해당하는 기록지 데이터가 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((r) => {
    const isOurTeam = r.team === "거제야르";
    const rowCls = isOurTeam ? "our-team-row-highlight" : "";
    const recordHtml = (r.record === "99'99\"99" || r.record === "88'88\"88")
      ? `<span style="color:#94a3b8; font-size:12px;">${escapeHtml(r.record)}</span>`
      : `<strong style="color:#0f172a; font-variant-numeric:tabular-nums;">${escapeHtml(r.record)}</strong>`;

    const strokeDisplay = r.isRelay ? r.stroke : `${r.stroke} 50m`;
    const teamColor = r.team === "거제몽꾸"
      ? "#c2410c"
      : r.team === "거제야르"
        ? "#0369a1"
        : "#334155";
    const genderShort = r.gender === "남자" ? "남" : r.gender === "여자" ? "여" : r.gender;
    const groupNumOnly = String(r.group || "").replace(/[^0-9]/g, "") || "-";

    const rawRankStr = String(r.rank ?? "").trim().replace("위", "");
    const isNumericRank = /^\d+$/.test(rawRankStr);
    const rankNumHtml = isNumericRank
      ? `<span style="font-weight:${Number(rawRankStr) <= 6 ? "900" : "700"}; color:${
          rawRankStr === "1" ? "#b45309" : rawRankStr === "2" ? "#334155" : rawRankStr === "3" ? "#9a3412" : Number(rawRankStr) <= 6 ? "#0284c7" : "#475569"
        }; font-variant-numeric:tabular-nums;">${rawRankStr}</span>`
      : `<span style="color:#cbd5e1;">-</span>`;

    const noteParts = [];
    if (!isNumericRank && rawRankStr) noteParts.push(rawRankStr);
    if (r.note) noteParts.push(r.note);
    const noteText = noteParts.join(" · ");

    const cellMap = {
      matchNo: `<td style="text-align:center; font-weight:800; color:#0284c7; font-variant-numeric:tabular-nums;">#${escapeHtml(r.matchNo)}</td>`,
      stroke:  `<td style="text-align:center; font-weight:700; color:#334155;">${escapeHtml(strokeDisplay)}</td>`,
      gender:  `<td style="text-align:center; font-weight:700; color:#334155;">${escapeHtml(genderShort)}</td>`,
      group:   `<td style="text-align:center; font-weight:700; color:#334155; font-variant-numeric:tabular-nums;">${escapeHtml(groupNumOnly)}</td>`,
      lane:    `<td style="text-align:center; font-weight:800; color:#334155; font-variant-numeric:tabular-nums;">${r.lane}</td>`,
      name:    `<td style="text-align:left; font-weight:${isOurTeam ? "900" : "700"}; color:#0f172a;">${escapeHtml(r.name)}</td>`,
      team:    `<td style="text-align:center; font-weight:${isOurTeam ? "900" : "700"}; color:${teamColor};">${escapeHtml(r.team)}</td>`,
      record:  `<td style="text-align:center;">${recordHtml}</td>`,
      rank:    `<td style="text-align:center;">${rankNumHtml}</td>`,
      points:  `<td style="text-align:center; font-weight:${r.points > 0 ? "900" : "600"}; color:${r.points > 0 ? "#1d4ed8" : "#94a3b8"}; font-variant-numeric:tabular-nums;">${r.points}</td>`,
      note:    `<td style="text-align:left; font-size:12px; color:${r.rank === "실격" ? "#be123c" : "#475569"}; font-weight:${r.rank === "실격" || r.points > 0 ? "700" : "500"};">${escapeHtml(noteText || "-")}</td>`
    };

    return `
      <tr class="${rowCls}" data-row-stroke="${escapeHtml(r.stroke)}" data-row-match="${escapeHtml(r.matchNo)}">
        ${activeCols.map(c => cellMap[c.key]).join("")}
      </tr>
    `;
  }).join("");
}

function renderResultAnalysisView() {
  const container = document.getElementById("viewContainerResult");
  if (!container) return;

  if (currentDivision === "adult") {
    stopStudentPlayback();
    renderAdultResultAnalysisView(container);
    return;
  }

  stopAdultPlayback();

  const hl = OUR_TEAM_STUDENT_HIGHLIGHTS;

  // 입상 하이라이트 카드 12개
  const podiumCardsHtml = hl.podiumAndScoringList.map(item => {
    const cardCls = item.rank === "1위"
      ? "is-gold"
      : item.rank === "2위"
        ? "is-silver"
        : item.rank === "3위"
          ? "is-bronze"
          : "is-top6";

    return `
      <div class="podium-spot-card ${cardCls}">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <span class="result-rank-badge ${item.badgeClass}">${escapeHtml(item.medal)}</span>
          <span class="result-pts-pill">+${item.points}점</span>
        </div>
        <div style="display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-top:2px;">
          <strong style="font-size:15px; font-weight:900; color:#0f172a;">${escapeHtml(item.name)}</strong>
          <span style="font-size:14.5px; font-weight:900; color:#0284c7; font-variant-numeric:tabular-nums;">${escapeHtml(item.record)}</span>
        </div>
        <div style="font-size:12px; font-weight:700; color:#334155;">
          ${escapeHtml(item.gender)} · ${escapeHtml(item.group)} · ${escapeHtml(item.event)} <span style="color:#64748b;">(#${escapeHtml(item.matchNo)} · ${item.lane}레인)</span>
        </div>
        <div style="font-size:11.5px; font-weight:600; color:#475569; line-height:1.45; border-top:1px dashed #e2e8f0; padding-top:5px;">
          ${escapeHtml(item.note)}
        </div>
      </div>
    `;
  }).join("");

  // 필터 옵션 목록 생성
  const uniqueGroups = [...new Set(VERIFIED_SHEET_RESULTS.map(r => `${r.gender} ${r.group}`))];
  const uniqueTeams = [...new Set(VERIFIED_SHEET_RESULTS.map(r => r.team.replace("(중등)", "").trim()))].sort((a, b) => a.localeCompare(b, "ko"));

  const ourColToggleChipsHtml = OUR_TEAM_COLUMNS.map(col => {
    const isChecked = visibleOurTeamCols.has(col.key);
    return `
      <label class="col-toggle-chip ${isChecked ? "is-checked" : ""}">
        <input type="checkbox" data-our-col-key="${col.key}" ${isChecked ? "checked" : ""}>
        <span>${escapeHtml(col.label)}</span>
      </label>
    `;
  }).join("");

  const colToggleChipsHtml = RAW_SHEET_COLUMNS.map(col => {
    const isChecked = visibleRawSheetCols.has(col.key);
    return `
      <label class="col-toggle-chip ${isChecked ? "is-checked" : ""}">
        <input type="checkbox" data-raw-col-key="${col.key}" ${isChecked ? "checked" : ""}>
        <span>${escapeHtml(col.label)}</span>
      </label>
    `;
  }).join("");

  container.innerHTML = `
    <!-- =============================================================== -->
    <!-- 1. 학생부 팀별 점수 및 메달·우승 집계 (경기 진행 재생 지원)      -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>📊 1. 학생부 참가 클럽별 점수 및 메달·우승 집계 (전 경기 232레이스 · 843엔트리 공식 결과)</h3>
          <span class="progress-sec-sub">재생 버튼을 누르면 경기번호가 진행됨(1~232경기)에 따라 19개 클럽의 점수 변화를 보여주며, 우리팀(거제야르)은 주황색 하이라이트, 다른 팀은 파란색 막대로 표시됩니다.</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="adult-sync-badge is-synced">✅ 공식 기록지 843 / 843건 (100% 반영 완료)</span>
        </div>
      </div>

      <!-- 경기번호 진행 재생(Playback) 컨트롤 바 -->
      <div class="adult-playback-bar">
        <div class="adult-playback-controls">
          <button type="button" class="btn-adult-play" id="btnStudentPlaybackToggle">▶️ 재생</button>
          <button type="button" class="btn-adult-step" id="btnStudentPlaybackReset" title="0번 초기 상태로 이동">⏮️ 처음</button>
          <button type="button" class="btn-adult-step" id="btnStudentPlaybackPrev" title="한 스텝(1경기) 이전으로 이동">◀ 이전</button>
          <button type="button" class="btn-adult-step" id="btnStudentPlaybackNext" title="한 스텝(1경기) 이후로 이동">다음 ▶</button>
          <button type="button" class="btn-adult-step" id="btnStudentPlaybackEnd" title="최종 경기로 이동">⏭️ 최종</button>
          <button type="button" class="btn-adult-mp4" id="btnStudentDownloadMp4" title="유튜브 업로드용 Full HD(1920×1080, 16:9, 60fps) 고화질 MP4 영상으로 다운로드합니다">🎬 HD MP4 저장 (1080p)</button>
        </div>
        <div class="adult-playback-slider-wrap">
          <input type="range" class="adult-race-slider" id="studentPlaybackSlider" min="0" max="${STUDENT_TOTAL_RACES}" value="${studentPlaybackRaceIndex}">
          <span class="adult-playback-match-info" id="studentPlaybackMatchInfo">${escapeHtml(getStudentPlaybackRaceLabel(studentPlaybackRaceIndex))}</span>
        </div>
      </div>

      <!-- 팀명 · 가로막대그래프(1·2·3위 금은동 / 나머지 파란색) · 총점 -->
      <div class="adult-hbar-wrap">
        <div class="adult-hbar-scale-header">
          <span>순위 · 클럽명</span>
          <div class="adult-hbar-scale-ticks" id="studentHBarScaleTicks"></div>
          <span style="text-align:right; color:#0284c7;" id="studentHBarScaleMaxLabel">최대 225점</span>
        </div>
        <div class="adult-hbar-list" id="studentTeamScoreHBarContainer"></div>
      </div>

      <!-- 메달 개수 및 개인·단체전 우승 횟수·점수 집계표 -->
      <div class="table-responsive">
        <table class="record-table">
          <thead>
            <tr>
              <th style="width: 56px; text-align: center;">순위</th>
              <th style="min-width: 140px; text-align: left;">소속 클럽</th>
              <th style="width: 68px; text-align: center;">🥇 금</th>
              <th style="width: 68px; text-align: center;">🥈 은</th>
              <th style="width: 68px; text-align: center;">🥉 동</th>
              <th style="width: 72px; text-align: center;">4~6위</th>
              <th style="width: 92px; text-align: center;">개인전 우승</th>
              <th style="width: 92px; text-align: center;">단체전 우승</th>
              <th style="width: 88px; text-align: center;">개인전 점수</th>
              <th style="width: 88px; text-align: center;">단체전 점수</th>
              <th style="width: 88px; text-align: center;">총점</th>
            </tr>
          </thead>
          <tbody id="studentTeamMedalTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 2. 우리팀 (거제야르) 대회 결과 종합 요약 & 명예의 전당          -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>🏅 2. 우리팀 (거제야르) 학생부 대회 결과 종합 요약 & 명예의 전당</h3>
          <span class="progress-sec-sub">${escapeHtml(STUDENT_SHEET_META.scoringRuleIndiv)} / ${escapeHtml(STUDENT_SHEET_META.scoringRuleRelay)}</span>
        </div>
      </div>

      <div class="kpi-grid-4">
        <div class="kpi-stat-card highlight-blue">
          <span class="kpi-label">🏆 우리팀 총 획득 점수 (전 경기 공식)</span>
          <span class="kpi-value">총 39점 (클럽 12위)</span>
          <span class="kpi-sub">개인전 <strong>37점</strong> + 단체전 <strong>2점</strong> (전체 19개 클럽 중 12위)</span>
        </div>
        <div class="kpi-stat-card highlight-amber">
          <span class="kpi-label">🥈 메달 및 입상 (1~6위 득점)</span>
          <span class="kpi-value">총 12건 입상</span>
          <span class="kpi-sub">🥈은 3 · 🥉동 2 · 4~6위 7건 (개인 11건 + 단체 1건)</span>
        </div>
        <div class="kpi-stat-card highlight-emerald">
          <span class="kpi-label">📊 출전 및 완주 현황</span>
          <span class="kpi-value">53출전 (완주 42건)</span>
          <span class="kpi-sub">개인 49출전(완주 39) + 단체 4출전(완주 3)</span>
        </div>
        <div class="kpi-stat-card highlight-purple">
          <span class="kpi-label">🌟 멀티 메달·다득점 에이스</span>
          <span class="kpi-value">정채윤 10점 · 이선우 7점</span>
          <span class="kpi-sub">정채윤(평영·자유형 은2) · 이선우(배영 은+자유형 5위)</span>
        </div>
      </div>

      <!-- 우리팀 선수별·종목별 득점 분석 차트 (2열) -->
      <div class="charts-two-col">
        <div class="hbar-chart-box">
          <h4 class="hbar-chart-title">
            <span>🌟 우리팀 (거제야르) 선수별 득점 기여도</span>
            <span style="font-size:11.5px; color:#0284c7;">총 39점 (개인 37점 + 단체 2점)</span>
          </h4>
          <div class="hbar-list">
            <div class="hbar-row">
              <span class="hbar-label">🥈🥈 정채윤 (여7)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 100%; background:#0284c7;"></div>
                <span class="hbar-bar-text">평영 2위(5점) + 자유형 2위(5점)</span>
              </div>
              <span class="hbar-val">10점 (은2)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥈🏅 이선우 (남7)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 70%; background:#2563eb;"></div>
                <span class="hbar-bar-text">배영 2위(5점) + 자유형 5위(2점)</span>
              </div>
              <span class="hbar-val">7점 (은1·5위)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥉 김서윤 (여5)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 40%; background:#d97706;"></div>
                <span class="hbar-bar-text">평영 50m 3위 (48"02)</span>
              </div>
              <span class="hbar-val">4점 (동1)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥉 안서윤 (여7)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 40%; background:#d97706;"></div>
                <span class="hbar-bar-text">자유형 50m 3위 (33"68)</span>
              </div>
              <span class="hbar-val">4점 (동1)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🏅 이은서 (여5)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 30%; background:#0d9488;"></div>
                <span class="hbar-bar-text">배영 50m 4위 (43"51)</span>
              </div>
              <span class="hbar-val">3점 (4위)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🏅 손민재 (남4)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 30%; background:#0d9488;"></div>
                <span class="hbar-bar-text">자유형 50m 4위 (35"93)</span>
              </div>
              <span class="hbar-val">3점 (+계영)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🏅 류다윤 (여5)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 30%; background:#0d9488;"></div>
                <span class="hbar-bar-text">자유형 50m 4위 (35"42)</span>
              </div>
              <span class="hbar-val">3점 (4위)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🏅 한예진 (여5)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 20%; background:#6366f1;"></div>
                <span class="hbar-bar-text">평영 50m 5위 (49"54)</span>
              </div>
              <span class="hbar-val">2점 (5위)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🤝 남초 계영팀</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 20%; background:#7c3aed;"></div>
                <span class="hbar-bar-text">배건우·손민재·양서진·김루민</span>
              </div>
              <span class="hbar-val">2점 (6위)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🏅 이설하 (여2)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 15%; background:#ec4899;"></div>
                <span class="hbar-bar-text">배영 50m 6위 (01'01"15)</span>
              </div>
              <span class="hbar-val">1점 (6위)</span>
            </div>
          </div>
        </div>

        <div class="hbar-chart-box" style="display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
          <div>
            <h4 class="hbar-chart-title" style="margin-bottom:8px;">💡 거제야르 학생부 공식 결과 핵심 인사이트</h4>
            <ul style="margin:0; padding-left:18px; font-size:12.8px; color:#334155; line-height:1.72; font-weight:600;">
              <li><strong>여7 · 남7 중등 그룹 멀티 메달 맹활약 (21점 합작)</strong>: 여7 <strong>정채윤</strong> 선수가 평영 2위(5점)·자유형 2위(5점)로 <strong>팀 내 최다 10점(은메달 2개)</strong>을 기록했고, 여7 <strong>안서윤</strong>(자유형 3위·4점), 남7 <strong>이선우</strong>(배영 2위·5점 + 자유형 5위·2점)가 힘을 보태며 7그룹에서만 21점을 쓸어담았습니다.</li>
              <li><strong>여5 주력 그룹 4명 전원 득점 (12점 합작)</strong>: 여5 평영에서 <strong>김서윤(3위·4점)·한예진(5위·2점)</strong>이 동반 입상하고, 여5 배영 <strong>이은서(4위·3점)</strong>, 여5 자유형 <strong>류다윤(4위·3점)</strong>까지 고루 입상하며 탄탄한 중학년 전력을 입증했습니다.</li>
              <li><strong>저학년·단체전 초박빙 승부</strong>: 여2 배영에서 막내 <strong>이설하(6위·1점)</strong>가 값진 첫 득점을 올렸고, 남4 자유형 <strong>손민재(4위·3점, 3위와 0.13초 차)</strong> 및 남초 계영 200m <strong>배건우·손민재·양서진·김루민(6위·2점, 7위와 0.07초 차)</strong>이 짜릿한 명승부를 연출했습니다.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 입상 12건 카드 그리드 -->
      <div style="margin-bottom: 6px; font-size:13.5px; font-weight:800; color:#0f172a;">
        🎖️ 우리팀 (거제야르) 입상 및 득점(1~6위) 명예의 전당 (총 12건 · 39점)
      </div>
      <div class="podium-grid-cards">
        ${podiumCardsHtml}
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 3. 우리팀 (거제야르) 선수별·종목별 상세 성적표                  -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>🏊 3. 우리팀 (거제야르) 전체 53출전 종목별 상세 성적표</h3>
          <span class="progress-sec-sub" id="ourTeamResultCountBadge">거제야르 전체 53출전 공식 기록 100% 확인 완료</span>
        </div>
        <div class="result-filter-pills" id="ourTeamResultFilterGroup">
          <button type="button" class="result-filter-pill ${ourTeamResultFilterMode === "all" ? "active" : ""}" data-our-filter="all">🌐 전체 53출전 (개인 49 + 단체 4)</button>
          <button type="button" class="result-filter-pill ${ourTeamResultFilterMode === "scoring" ? "active" : ""}" data-our-filter="scoring">🏅 입상·득점 경기만 (12건)</button>
          <button type="button" class="result-filter-pill ${ourTeamResultFilterMode === "medal" ? "active" : ""}" data-our-filter="medal">🥈🥉 메달 입상만 (5건)</button>
        </div>
      </div>

      <!-- 표시 열(항목) 선택 체크박스 칩 바 + 원클릭 프리셋 -->
      <div class="col-toggle-bar" id="ourTeamColToggleBar">
        <div class="col-toggle-left">
          <span class="col-toggle-label">☑️ 표시 열 항목:</span>
          ${ourColToggleChipsHtml}
        </div>
        <div class="col-toggle-presets">
          <button type="button" class="col-preset-btn ${ourTeamRecordSortMode !== "default" ? "is-active-sort" : ""}" id="btnOurTeamSortRecordAsc" title="빠른 기록(오름차순)으로 정렬">${getRecordSortButtonLabel(ourTeamRecordSortMode)}</button>
          <button type="button" class="col-preset-btn" data-our-col-preset="all">전체 열 표시</button>
          <button type="button" class="col-preset-btn" data-our-col-preset="compact">핵심 열만 (모바일 추천)</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="record-table">
          <thead id="ourTeamResultTableHead"></thead>
          <tbody id="ourTeamResultTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 4. 영법별 그룹 1위 기록 추이 꺾은선 그래프 (2x2 그리드)          -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>📈 4. 학생부 영법별 · 연령대 그룹별 1위 기록 추이 (단위: 초)</h3>
          <span class="progress-sec-sub">가로축: 연령대(1그룹~7그룹) · 세로축: 1위 기록(초) · 좌상(접영) / 우상(배영) / 좌하(평영) / 우하(자유형) 전 종목 공식 기록 완비</span>
        </div>
      </div>
      <div class="stroke-linecharts-grid">
        ${renderStrokeFirstPlaceLineChartsHtml("student")}
      </div>
    </section>

  `;

  renderStudentStandingsAndChartForCurrentStep();
  updateStudentPlaybackControlsDOM();
  renderOurTeamResultRows();
}

// ==========================================================================
// 🏅 성인부 (25일) 결과 분석: 공식 기록지 492건 완비 + 경기 진행 재생 + 우리팀 하이라이트 + 1위 추이 + 상세분석
// ==========================================================================
const ADULT_RESULTS_STORAGE_KEY = "gmdc_adult_results_2026_official_v1";
const ADULT_RESULTS_FIRESTORE_COL = "attendance";
const ADULT_RESULTS_FIRESTORE_DOC = "adult_results_2026";

const ADULT_RESULT_COLUMNS = [
  { key: "matchNo", label: "경기번호", width: "74px",  align: "center" },
  { key: "stroke",  label: "종목",     width: "115px", align: "center" },
  { key: "gender",  label: "성별",     width: "56px",  align: "center" },
  { key: "group",   label: "그룹",     width: "66px",  align: "center" },
  { key: "lane",    label: "레인",     width: "52px",  align: "center" },
  { key: "name",    label: "이름",     width: "135px", align: "left" },
  { key: "team",    label: "소속팀",   width: "120px", align: "center" },
  { key: "sec",     label: "기록",     width: "96px",  align: "center" },
  { key: "rank",    label: "등수",     width: "60px",  align: "center" },
  { key: "points",  label: "점수",     width: "60px",  align: "center" },
  { key: "note",    label: "비고",     width: "160px", align: "left" }
];

let visibleAdultResultCols = new Set(ADULT_RESULT_COLUMNS.map(c => c.key));

let adultResStrokeFilter = "all";
let adultResGroupFilter = "all";
let adultResGenderFilter = "all";
let adultResTeamFilter = "all";
let adultResStatusFilter = "all"; // 'all' | 'entered' | 'pending' | 'top6' | 'medal' | 'dq_dns'
let adultResSearchQuery = "";

let adultScheduleEntriesCache = null;
let adultResultInputs = loadAdultResultsFromLocal();
let dirtyAdultEntryKeys = new Set();
let adultSyncState = "synced";
let adultSyncTimer = null;
let adultFirestoreListenerStarted = false;
let adultFirestoreDepsPromise = null;

// 경기번호 진행에 따른 점수 변화 재생(Playback) 상태
const ADULT_TOTAL_RACES = ADULT_RACES_DATA.length; // 141경기
const ADULT_MS_PER_RACE = 112; // 60fps 연속 보간 재생 속도 (경기당 112ms)
let adultPlaybackRaceIndex = ADULT_TOTAL_RACES;    // 기본: 최종 경기(141)까지 반영
let adultPlaybackProgress = ADULT_TOTAL_RACES;
let adultPlaybackRafId = null;
let adultPlaybackLastTs = 0;
let isAdultPlaybackRunning = false;
let adultStandingsByRaceCache = new Map();

function buildDefaultAdultInputsClone() {
  const cloned = {};
  for (const [k, v] of Object.entries(DEFAULT_ADULT_OFFICIAL_INPUTS || {})) {
    cloned[k] = {
      sec: String(v.sec ?? ""),
      note: String(v.note ?? ""),
      updatedAt: Number(v.updatedAt || 1761400000000)
    };
  }
  return cloned;
}

function loadAdultResultsFromLocal() {
  const base = buildDefaultAdultInputsClone();
  try {
    const raw = localStorage.getItem(ADULT_RESULTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === "object" && (String(v.sec ?? "").trim() !== "" || String(v.note ?? "").trim() !== "")) {
            base[k] = {
              sec: String(v.sec ?? ""),
              note: String(v.note ?? ""),
              updatedAt: Number(v.updatedAt || 1761400000000)
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn("[AdultResults] localStorage load warning:", e);
  }
  return base;
}

function saveAdultResultsToLocal() {
  try {
    localStorage.setItem(ADULT_RESULTS_STORAGE_KEY, JSON.stringify(adultResultInputs));
  } catch (e) {
    console.warn("[AdultResults] localStorage save warning:", e);
  }
}

async function getAdultFirestoreDeps() {
  if (!adultFirestoreDepsPromise) {
    adultFirestoreDepsPromise = Promise.all([
      import("./firebase-config.js?v=20261024_19"),
      import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js")
    ]).then(([cfgMod, fsMod]) => {
      const db = fsMod.getFirestore(cfgMod.firebaseApp);
      return {
        db,
        doc: fsMod.doc,
        setDoc: fsMod.setDoc,
        onSnapshot: fsMod.onSnapshot
      };
    }).catch(err => {
      adultFirestoreDepsPromise = null;
      throw err;
    });
  }
  return adultFirestoreDepsPromise;
}

function updateAdultSyncBadgeDOM() {
  const badge = document.getElementById("adultResultSyncBadge");
  if (!badge) return;
  badge.classList.remove("is-synced", "is-syncing", "is-offline");
  if (adultSyncState === "syncing") {
    badge.classList.add("is-syncing");
    badge.textContent = "⏳ 로컬 즉시 반영됨 · DB 동기화 중...";
  } else if (adultSyncState === "offline") {
    badge.classList.add("is-offline");
    badge.textContent = "📴 로컬 저장 완료 (인터넷 연결 시 자동 동기화)";
  } else {
    badge.classList.add("is-synced");
    badge.textContent = "✅ 공식 기록지 492 / 492건 완비 · 실시간 동기화";
  }
}

function scheduleAdultResultsFirestoreSync(delayMs = 380) {
  adultSyncState = navigator.onLine === false ? "offline" : "syncing";
  updateAdultSyncBadgeDOM();

  if (adultSyncTimer) {
    clearTimeout(adultSyncTimer);
  }
  adultSyncTimer = setTimeout(() => {
    flushAdultResultsToFirestore();
  }, delayMs);
}

async function flushAdultResultsToFirestore() {
  if (dirtyAdultEntryKeys.size === 0) {
    adultSyncState = "synced";
    updateAdultSyncBadgeDOM();
    return;
  }

  const keysToSync = [...dirtyAdultEntryKeys];
  const entriesPayload = {};
  for (const k of keysToSync) {
    if (adultResultInputs[k]) {
      entriesPayload[k] = adultResultInputs[k];
    }
  }

  try {
    const { db, doc, setDoc } = await getAdultFirestoreDeps();
    const docRef = doc(db, ADULT_RESULTS_FIRESTORE_COL, ADULT_RESULTS_FIRESTORE_DOC);
    await setDoc(
      docRef,
      {
        entries: entriesPayload,
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );
    keysToSync.forEach(k => dirtyAdultEntryKeys.delete(k));
    adultSyncState = dirtyAdultEntryKeys.size > 0 ? "syncing" : "synced";
    updateAdultSyncBadgeDOM();
  } catch (err) {
    console.warn("[AdultResults] Firestore sync deferred:", err);
    adultSyncState = "offline";
    updateAdultSyncBadgeDOM();
  }
}

function startAdultResultsFirestoreListener() {
  if (adultFirestoreListenerStarted) return;
  adultFirestoreListenerStarted = true;

  getAdultFirestoreDeps().then(({ db, doc, onSnapshot }) => {
    const docRef = doc(db, ADULT_RESULTS_FIRESTORE_COL, ADULT_RESULTS_FIRESTORE_DOC);
    onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const remoteEntries = (data && data.entries && typeof data.entries === "object") ? data.entries : {};
      let hasChanged = false;

      for (const [entryKey, rVal] of Object.entries(remoteEntries)) {
        if (!rVal || typeof rVal !== "object") continue;
        if (String(rVal.sec ?? "").trim() === "" && String(rVal.note ?? "").trim() === "") continue;
        const lVal = adultResultInputs[entryKey];
        const rTime = Number(rVal.updatedAt || 0);
        const lTime = Number(lVal?.updatedAt || 0);
        if (!lVal || rTime > lTime) {
          adultResultInputs[entryKey] = {
            sec: String(rVal.sec ?? ""),
            note: String(rVal.note ?? ""),
            updatedAt: rTime || Date.now()
          };
          hasChanged = true;
        }
      }

      if (hasChanged) {
        saveAdultResultsToLocal();
        if (currentDivision === "adult" && (currentSubTab === "result" || currentSubTab === "records")) {
          patchAdultInputsAndResultsFromState();
        }
      }
      if (dirtyAdultEntryKeys.size === 0) {
        adultSyncState = "synced";
        updateAdultSyncBadgeDOM();
      }
    }, (err) => {
      console.warn("[AdultResults] onSnapshot warning:", err);
    });
  }).catch(() => {});

  window.addEventListener("online", () => {
    if (dirtyAdultEntryKeys.size > 0) {
      scheduleAdultResultsFirestoreSync(150);
    }
  });
}

function buildAdultScheduleEntriesBase() {
  if (adultScheduleEntriesCache) return adultScheduleEntriesCache;

  const list = [];
  for (const race of ADULT_RACES_DATA) {
    const headerMeta = new Map();
    for (const h of (race.original_headers || [])) {
      const m = h.match(/^(\d+(?:-\d+)?)\.\s*(.+)$/);
      if (m) {
        const no = m[1];
        const title = m[2];
        const grpMatch = title.match(/([1-6]그룹)/);
        const genMatch = title.match(/(남자|여자|혼성)/);
        headerMeta.set(no, {
          group: grpMatch ? grpMatch[1] : race.group,
          gender: genMatch ? genMatch[1] : race.gender
        });
      }
    }

    for (const lane of (race.lanes || [])) {
      const entryKey = `${race.primary_match_no}_${lane.lane}`;
      const matchNo = String(lane.original_match_no || race.primary_match_no);
      const isRelay = Boolean(race.is_relay);
      const team = (lane.team || "개인").trim() || "개인";

      const meta = headerMeta.get(matchNo) || {
        group: race.group,
        gender: race.gender
      };

      const gender = isRelay ? race.gender : (meta.gender === "여자" ? "여자" : "남자");
      const genderShort = gender === "남자" ? "남" : gender === "여자" ? "여" : "혼성";
      const group = isRelay ? "단체" : (ADULT_GROUPS.includes(meta.group) ? meta.group : race.group);
      const groupNum = isRelay ? "-" : String(group).replace(/[^0-9]/g, "") || "-";
      const strokeDisplay = isRelay ? `${race.stroke} ${race.distance}` : `${race.stroke} ${race.distance || "50m"}`;
      const name = isRelay
        ? (lane.name && lane.name.trim() ? lane.name.trim() : `${team} 단체조`)
        : (lane.name || "").trim();

      const eventCategoryKey = isRelay
        ? `RELAY|${race.gender}|${race.stroke}|${race.distance}`
        : `INDIV|${gender}|${group}|${race.stroke}`;

      list.push({
        entryKey,
        raceIndex: race.race_index,
        primaryMatchNo: String(race.primary_match_no),
        matchNo,
        isRelay,
        strokeRaw: race.stroke,
        strokeDisplay,
        distance: race.distance || "50m",
        gender,
        genderShort,
        group,
        groupNum,
        lane: lane.lane,
        name,
        team,
        isOurTeam: OUR_TEAMS.has(team),
        eventCategoryKey
      });
    }
  }

  adultScheduleEntriesCache = list;
  return list;
}

/**
 * 입력된 기록 문자열(예: "28.45", "28\"45", "00'28\"45", "2:15.30")을 초(number)로 변환
 */
function parseAdultRecordInputToSeconds(rawStr) {
  const s = String(rawStr ?? "").trim();
  if (!s || s === "99'99\"99" || s === "88'88\"88") return null;

  if (/^\d+(?:\.\d+)?$/.test(s)) {
    const val = parseFloat(s);
    return val > 0 ? val : null;
  }

  const mFull = s.match(/^(\d+)[':분]\s*(\d{1,2})(?:["초.](\d{1,2}))?$/);
  if (mFull) {
    const mins = parseInt(mFull[1], 10);
    const secs = parseInt(mFull[2], 10);
    const hundredths = mFull[3] ? parseInt(mFull[3].padEnd(2, "0"), 10) : 0;
    const total = mins * 60 + secs + hundredths / 100;
    return total > 0 ? total : null;
  }

  const mSecQuote = s.match(/^(\d{1,3})"(\d{1,2})$/);
  if (mSecQuote) {
    const secs = parseInt(mSecQuote[1], 10);
    const hundredths = parseInt(mSecQuote[2].padEnd(2, "0"), 10);
    const total = secs + hundredths / 100;
    return total > 0 ? total : null;
  }

  return null;
}

function isAdultNoteExcludedFromRanking(noteStr, rawSecStr = "") {
  const s = String(rawSecStr ?? "").trim();
  if (s === "88'88\"88" || s === "99'99\"99") return true;
  const n = String(noteStr ?? "").trim().toLowerCase();
  if (!n) return false;
  return (
    n.includes("실격") ||
    n.includes("불참") ||
    n.includes("기권") ||
    n.includes("번외") ||
    n.includes("오픈") ||
    n.includes("참고") ||
    n.includes("dq") ||
    n.includes("dns")
  );
}

/**
 * 전체 492개 엔트리에 대해 실시간 등수·점수 및 10개 클럽(`개인` 제외) 점수 순위를 계산
 */
function computeAdultCalculatedResults(maxRaceIndex = ADULT_TOTAL_RACES) {
  const baseList = buildAdultScheduleEntriesBase();
  const INDIV_PTS = [7, 5, 4, 3, 2, 1];
  const RELAY_PTS = [14, 10, 8, 6, 4, 2];

  const calcMap = new Map();
  const categoryGroups = new Map();

  let enteredCount = 0;

  for (const item of baseList) {
    const userInp = adultResultInputs[item.entryKey] || { sec: "", note: "" };
    const rawSec = String(userInp.sec ?? "");
    const rawNote = String(userInp.note ?? "");
    const secNum = parseAdultRecordInputToSeconds(rawSec);
    const isExcluded = isAdultNoteExcludedFromRanking(rawNote, rawSec);

    if (rawSec.trim() !== "" || rawNote.trim() !== "") {
      enteredCount++;
    }

    const rowState = {
      ...item,
      rawSec,
      rawNote,
      secNum,
      isExcluded,
      rank: null,
      points: 0
    };

    calcMap.set(item.entryKey, rowState);

    if (item.raceIndex <= maxRaceIndex) {
      if (!categoryGroups.has(item.eventCategoryKey)) {
        categoryGroups.set(item.eventCategoryKey, []);
      }
      categoryGroups.get(item.eventCategoryKey).push(rowState);
    }
  }

  for (const groupItems of categoryGroups.values()) {
    const validRunners = groupItems.filter(r => !r.isExcluded && r.secNum !== null && r.secNum > 0);
    validRunners.sort((a, b) => a.secNum - b.secNum);

    let currentRank = 1;
    for (let i = 0; i < validRunners.length; i++) {
      if (i > 0 && Math.abs(validRunners[i].secNum - validRunners[i - 1].secNum) > 1e-6) {
        currentRank = i + 1;
      }
      const runner = validRunners[i];
      runner.rank = currentRank;
      const ptsTable = runner.isRelay ? RELAY_PTS : INDIV_PTS;
      runner.points = currentRank >= 1 && currentRank <= 6 ? ptsTable[currentRank - 1] : 0;
    }
  }

  const adultDivData = getDivisionData("adult");
  const clubMap = new Map();

  for (const t of adultDivData.teams) {
    if (t.team === "개인") continue;
    clubMap.set(t.team, {
      team: t.team,
      isOurTeam: OUR_TEAMS.has(t.team),
      expectedPoints: t.expectedPoints || 0,
      totalEntries: t.indivEntries + t.relayEntries,
      enteredEntries: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      rank4to6: 0,
      top6Total: 0,
      indivWins: 0,
      relayWins: 0,
      indivPoints: 0,
      relayPoints: 0,
      totalPoints: 0
    });
  }

  for (const r of calcMap.values()) {
    if (r.team === "개인") continue;
    if (r.raceIndex > maxRaceIndex) continue;

    if (!clubMap.has(r.team)) {
      clubMap.set(r.team, {
        team: r.team,
        isOurTeam: OUR_TEAMS.has(r.team),
        expectedPoints: 0,
        totalEntries: 0,
        enteredEntries: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        rank4to6: 0,
        top6Total: 0,
        indivWins: 0,
        relayWins: 0,
        indivPoints: 0,
        relayPoints: 0,
        totalPoints: 0
      });
    }
    const c = clubMap.get(r.team);
    if (r.rawSec.trim() !== "" || r.rawNote.trim() !== "") {
      c.enteredEntries++;
    }
    if (r.rank === 1) {
      c.gold++;
      if (r.isRelay) c.relayWins++;
      else c.indivWins++;
    } else if (r.rank === 2) {
      c.silver++;
    } else if (r.rank === 3) {
      c.bronze++;
    } else if (r.rank && r.rank >= 4 && r.rank <= 6) {
      c.rank4to6++;
    }

    if (r.rank && r.rank >= 1 && r.rank <= 6) {
      c.top6Total++;
    }
    if (r.points > 0) {
      c.totalPoints += r.points;
      if (r.isRelay) c.relayPoints += r.points;
      else c.indivPoints += r.points;
    }
  }

  const clubStandings = [...clubMap.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (b.silver !== a.silver) return b.silver - a.silver;
    if (b.bronze !== a.bronze) return b.bronze - a.bronze;
    if (b.top6Total !== a.top6Total) return b.top6Total - a.top6Total;
    return b.expectedPoints - a.expectedPoints;
  });

  return {
    calcMap,
    clubStandings,
    enteredCount,
    totalCount: baseList.length
  };
}

function getAdultCalculatedAtRace(raceIdx) {
  const clamped = Math.max(0, Math.min(ADULT_TOTAL_RACES, Math.floor(Number(raceIdx) || 0)));
  if (!adultStandingsByRaceCache.has(clamped)) {
    adultStandingsByRaceCache.set(clamped, computeAdultCalculatedResults(clamped));
  }
  return adultStandingsByRaceCache.get(clamped);
}

function getAdultFinalMaxInfo() {
  const { clubStandings: finalStandings } = getAdultCalculatedAtRace(ADULT_TOTAL_RACES);
  let maxPts = 1;
  let topClub = "";
  for (const c of finalStandings) {
    if (c.totalPoints > maxPts) {
      maxPts = c.totalPoints;
      topClub = c.team;
    }
  }
  return { maxPts, topClub };
}

function getAdultPlaybackRaceLabel(raceIdx) {
  const idx = Math.max(0, Math.min(ADULT_TOTAL_RACES, Math.floor(Number(raceIdx) ?? ADULT_TOTAL_RACES)));
  if (idx === 0) {
    return `경기 시작 전 · 초기 상태 (0 / ${ADULT_TOTAL_RACES}경기)`;
  }
  const race = ADULT_RACES_DATA[idx - 1];
  if (!race) return `전체 완료 (${ADULT_TOTAL_RACES} / ${ADULT_TOTAL_RACES}경기)`;
  const shortTitle = String(race.title || "").replace(/^성인부\s*/, "");
  return `경기 #${race.primary_match_no} · ${shortTitle} (${idx} / ${ADULT_TOTAL_RACES})`;
}

function updateAdultPlaybackControlsDOM() {
  const playBtn = document.getElementById("btnAdultPlaybackToggle");
  const prevBtn = document.getElementById("btnAdultPlaybackPrev");
  const nextBtn = document.getElementById("btnAdultPlaybackNext");
  const slider = document.getElementById("adultPlaybackSlider");
  const infoEl = document.getElementById("adultPlaybackMatchInfo");

  if (playBtn) {
    playBtn.classList.toggle("is-playing", isAdultPlaybackRunning);
    playBtn.innerHTML = isAdultPlaybackRunning ? "⏸️ 일시정지" : "▶️ 재생";
  }
  if (prevBtn) {
    prevBtn.disabled = adultPlaybackRaceIndex <= 0;
  }
  if (nextBtn) {
    nextBtn.disabled = adultPlaybackRaceIndex >= ADULT_TOTAL_RACES;
  }
  if (slider && Number(slider.value) !== adultPlaybackRaceIndex) {
    slider.value = String(adultPlaybackRaceIndex);
  }
  if (infoEl) {
    infoEl.textContent = getAdultPlaybackRaceLabel(adultPlaybackRaceIndex);
  }
}

function stopAdultPlayback() {
  if (adultPlaybackRafId) {
    cancelAnimationFrame(adultPlaybackRafId);
    adultPlaybackRafId = null;
  }
  isAdultPlaybackRunning = false;
  const hbarBox = document.getElementById("adultTeamScoreHBarContainer");
  if (hbarBox) hbarBox.classList.remove("is-raf-playing");
  updateAdultPlaybackControlsDOM();
}

function startAdultPlayback() {
  if (adultPlaybackRafId) {
    cancelAnimationFrame(adultPlaybackRafId);
    adultPlaybackRafId = null;
  }
  if (adultPlaybackProgress >= ADULT_TOTAL_RACES - 0.001) {
    adultPlaybackProgress = 0;
    adultPlaybackRaceIndex = 0;
  }
  isAdultPlaybackRunning = true;
  adultPlaybackLastTs = performance.now();

  const hbarBox = document.getElementById("adultTeamScoreHBarContainer");
  if (hbarBox) hbarBox.classList.add("is-raf-playing");

  updateAdultHBarChartSmooth(adultPlaybackProgress);
  renderAdultMedalTableAtRace(adultPlaybackRaceIndex);
  updateAdultPlaybackControlsDOM();

  const stepFrame = (now) => {
    if (!isAdultPlaybackRunning) return;
    const dt = Math.min(64, Math.max(0, now - adultPlaybackLastTs));
    adultPlaybackLastTs = now;

    adultPlaybackProgress = Math.min(
      ADULT_TOTAL_RACES,
      adultPlaybackProgress + dt / ADULT_MS_PER_RACE
    );

    const nextIntIdx = Math.floor(adultPlaybackProgress + 1e-6);
    const indexChanged = nextIntIdx !== adultPlaybackRaceIndex;
    adultPlaybackRaceIndex = nextIntIdx;

    updateAdultHBarChartSmooth(adultPlaybackProgress);
    if (indexChanged) {
      renderAdultMedalTableAtRace(adultPlaybackRaceIndex);
      updateAdultPlaybackControlsDOM();
    }

    if (adultPlaybackProgress < ADULT_TOTAL_RACES - 1e-6) {
      adultPlaybackRafId = requestAnimationFrame(stepFrame);
    } else {
      adultPlaybackProgress = ADULT_TOTAL_RACES;
      adultPlaybackRaceIndex = ADULT_TOTAL_RACES;
      updateAdultHBarChartSmooth(ADULT_TOTAL_RACES);
      renderAdultMedalTableAtRace(ADULT_TOTAL_RACES);
      stopAdultPlayback();
    }
  };

  adultPlaybackRafId = requestAnimationFrame(stepFrame);
}

function updateAdultHBarChartSmooth(progressVal) {
  const hbarBox = document.getElementById("adultTeamScoreHBarContainer");
  if (!hbarBox) return;

  const { maxPts: finalMaxPts, topClub } = getAdultFinalMaxInfo();

  const scaleEl = document.getElementById("adultHBarScaleTicks");
  if (scaleEl && scaleEl.dataset.maxPts !== String(finalMaxPts)) {
    scaleEl.dataset.maxPts = String(finalMaxPts);
    const p25 = Math.round(finalMaxPts * 0.25);
    const p50 = Math.round(finalMaxPts * 0.5);
    const p75 = Math.round(finalMaxPts * 0.75);
    scaleEl.innerHTML = `
      <span class="adult-hbar-scale-tick is-start">0점</span>
      <span class="adult-hbar-scale-tick" style="left:25%;">${p25}점</span>
      <span class="adult-hbar-scale-tick" style="left:50%;">${p50}점</span>
      <span class="adult-hbar-scale-tick" style="left:75%;">${p75}점</span>
      <span class="adult-hbar-scale-tick is-end">최종 최대 ${finalMaxPts}점 (${escapeHtml(topClub)})</span>
    `;
  }

  const maxLabelEl = document.getElementById("adultHBarScaleMaxLabel");
  if (maxLabelEl) {
    maxLabelEl.textContent = `최대 ${finalMaxPts}점`;
  }

  const r0 = Math.max(0, Math.min(ADULT_TOTAL_RACES, Math.floor(progressVal)));
  const r1 = Math.min(ADULT_TOTAL_RACES, r0 + 1);
  const alpha = progressVal - r0;

  const res0 = getAdultCalculatedAtRace(r0);
  const res1 = r1 === r0 ? res0 : getAdultCalculatedAtRace(r1);
  const displayStandings = buildInterpolatedStandings(res0.clubStandings, res1.clubStandings, alpha);

  const totalHeight = Math.max(0, displayStandings.length * HBAR_ROW_STRIDE - 7);
  hbarBox.style.height = `${totalHeight}px`;

  const existingRows = hbarBox.querySelectorAll(".adult-hbar-row[data-adult-vbar-team]");
  if (existingRows.length !== displayStandings.length) {
    hbarBox.innerHTML = displayStandings.map((c, idx) => {
      const rowHighlight = c.isOurTeam ? "background:#fff7ed; border:1px solid #fdba74;" : "";
      const teamColor = c.isOurTeam ? "#c2410c" : "#0f172a";
      const scoreColor = c.isOurTeam ? "#c2410c" : "#0f172a";
      const barColorCls = c.isOurTeam ? "is-our-orange" : "is-blue";
      return `
        <div class="adult-hbar-row" style="${rowHighlight} transform:translate3d(0, ${idx * HBAR_ROW_STRIDE}px, 0);" data-adult-vbar-team="${escapeHtml(c.team)}">
          <span class="adult-hbar-team" data-role="team-label" style="color:${teamColor};"></span>
          <div class="adult-hbar-track">
            <div class="adult-hbar-fill ${barColorCls}" data-role="bar-fill" style="width:0%;"></div>
          </div>
          <span class="adult-hbar-score" data-role="score-label" style="color:${scoreColor};">0점</span>
        </div>
      `;
    }).join("");
  }

  const rowMap = new Map();
  hbarBox.querySelectorAll(".adult-hbar-row[data-adult-vbar-team]").forEach(el => {
    rowMap.set(el.dataset.adultVbarTeam, el);
  });

  displayStandings.forEach((c, idx) => {
    const rowEl = rowMap.get(c.team);
    if (!rowEl) return;

    const widthPct = c.interpPoints > 0
      ? Math.min(100, Math.max(0.35, (c.interpPoints / finalMaxPts) * 100))
      : 0;
    const barColorCls = c.isOurTeam ? "is-our-orange" : "is-blue";

    rowEl.style.transform = `translate3d(0, ${idx * HBAR_ROW_STRIDE}px, 0)`;
    rowEl.classList.toggle("is-active-filter", adultResTeamFilter === c.team);

    const teamLabelEl = rowEl.querySelector('[data-role="team-label"]');
    if (teamLabelEl) {
      teamLabelEl.textContent = `${idx + 1}. ${c.isOurTeam ? "🏊 " : ""}${c.team}`;
    }

    const fillEl = rowEl.querySelector('[data-role="bar-fill"]');
    if (fillEl) {
      fillEl.className = `adult-hbar-fill ${barColorCls}`;
      fillEl.style.width = `${widthPct.toFixed(3)}%`;
    }

    const scoreEl = rowEl.querySelector('[data-role="score-label"]');
    if (scoreEl) {
      scoreEl.textContent = `${c.displayPoints}점`;
    }
  });
}

function renderAdultMedalTableAtRace(raceIdx) {
  const { clubStandings, enteredCount, totalCount } = getAdultCalculatedAtRace(raceIdx);
  const progressBadge = document.getElementById("adultResultEnteredProgressBadge");
  if (progressBadge) {
    const pct = totalCount > 0 ? ((enteredCount / totalCount) * 100).toFixed(1) : "0.0";
    progressBadge.textContent = `기록 입력: ${enteredCount} / ${totalCount}건 (${pct}%)`;
  }

  const medalTbody = document.getElementById("adultTeamMedalTableBody");
  if (!medalTbody) return;

  medalTbody.innerHTML = clubStandings.map((c, idx) => {
    const rowCls = c.team === "거제몽꾸"
      ? "team-power-row row-team-mongkku"
      : c.team === "거제야르"
        ? "team-power-row row-team-yareu"
        : "team-power-row";
    const teamTextColor = c.team === "거제몽꾸"
      ? "#c2410c"
      : c.team === "거제야르"
        ? "#0369a1"
        : "#334155";

    return `
      <tr class="${rowCls}" data-adult-vbar-team="${escapeHtml(c.team)}">
        <td style="text-align:center; font-weight:800; color:#475569; font-variant-numeric:tabular-nums;">${idx + 1}</td>
        <td style="text-align:left; font-weight:${c.isOurTeam ? "900" : "700"}; color:${teamTextColor};">${escapeHtml(c.team)}</td>
        <td style="text-align:center; font-weight:800; color:${c.gold > 0 ? "#b45309" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.gold}</td>
        <td style="text-align:center; font-weight:800; color:${c.silver > 0 ? "#334155" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.silver}</td>
        <td style="text-align:center; font-weight:800; color:${c.bronze > 0 ? "#9a3412" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.bronze}</td>
        <td style="text-align:center; font-weight:700; color:${c.rank4to6 > 0 ? "#0284c7" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.rank4to6}</td>
        <td style="text-align:center; font-weight:800; color:${c.indivWins > 0 ? "#0f172a" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.indivWins}</td>
        <td style="text-align:center; font-weight:800; color:${c.relayWins > 0 ? "#7c3aed" : "#cbd5e1"}; font-variant-numeric:tabular-nums;">${c.relayWins}</td>
        <td style="text-align:center; font-weight:800; color:#0284c7; font-variant-numeric:tabular-nums;">${c.indivPoints}</td>
        <td style="text-align:center; font-weight:800; color:#7c3aed; font-variant-numeric:tabular-nums;">${c.relayPoints}</td>
        <td style="text-align:center; font-weight:900; font-size:14px; color:${c.totalPoints > 0 ? "#0f172a" : "#94a3b8"}; font-variant-numeric:tabular-nums;">${c.totalPoints}</td>
      </tr>
    `;
  }).join("");
}

function renderAdultStandingsAndChartForCurrentStep() {
  adultPlaybackProgress = adultPlaybackRaceIndex;
  updateAdultHBarChartSmooth(adultPlaybackProgress);
  renderAdultMedalTableAtRace(adultPlaybackRaceIndex);
}

// ==========================================================================
// 🎬 유튜브용 Full HD (1920×1080 · 16:9 · 60fps) MP4 애니메이션 생성 및 다운로드 엔진
// ==========================================================================
let isMp4Exporting = false;
let mp4MuxerModPromise = null;

function loadMp4MuxerModule() {
  if (!mp4MuxerModPromise) {
    mp4MuxerModPromise = import("https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm").catch(err => {
      mp4MuxerModPromise = null;
      throw err;
    });
  }
  return mp4MuxerModPromise;
}

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 1920×1080 (16:9 Full HD) 가상 좌표계 기준 고화질 프레임 렌더링
 */
function renderBarRaceFrameToCanvas(ctx, cfg) {
  const {
    scale,
    isAdult,
    progress,
    totalRaces,
    finalMaxPts,
    topClub,
    raceLabel,
    displayStandings,
    animYMap,
    smoothingFactor
  } = cfg;

  const W = 1920;
  const H = 1080;
  const fontStack = "'Pretendard', 'Malgun Gothic', -apple-system, BlinkMacSystemFont, sans-serif";

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // 1. 전체 배경 (1920x1080)
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, W, H);

  // 내부 메인 카드 배경
  drawRoundedRectPath(ctx, 24, 20, W - 48, H - 40, 22);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#cbd5e1";
  ctx.stroke();

  // 2. 상단 타이틀 & 현재 진행 경기 배지
  ctx.fillStyle = "#0f172a";
  ctx.font = `900 30px ${fontStack}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const mainTitle = isAdult
    ? "🏆 2026 제19회 거제시장배 전국마스터즈 — 성인부(10.25) 클럽 점수 추이"
    : "🏆 2026 제19회 거제시장배 전국마스터즈 — 학생부(10.24) 클럽 점수 추이";
  ctx.fillText(mainTitle, 56, 64);

  // 우측 경기 진행 상태 배지
  ctx.font = `800 22px ${fontStack}`;
  const badgeText = raceLabel;
  const badgeW = Math.min(760, Math.max(320, ctx.measureText(badgeText).width + 44));
  const badgeX = W - 56 - badgeW;
  drawRoundedRectPath(ctx, badgeX, 40, badgeW, 48, 12);
  ctx.fillStyle = "#f0f9ff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#7dd3fc";
  ctx.stroke();
  ctx.fillStyle = "#0369a1";
  ctx.textAlign = "center";
  ctx.fillText(badgeText, badgeX + badgeW / 2, 65);

  // 3. 경기 진행률 프로그레스 바
  const progX = 56;
  const progY = 104;
  const progW = W - 112;
  const progH = 12;
  drawRoundedRectPath(ctx, progX, progY, progW, progH, 6);
  ctx.fillStyle = "#e2e8f0";
  ctx.fill();

  const progRatio = totalRaces > 0 ? Math.max(0, Math.min(1, progress / totalRaces)) : 1;
  if (progRatio > 0) {
    drawRoundedRectPath(ctx, progX, progY, Math.max(12, progW * progRatio), progH, 6);
    const progGrad = ctx.createLinearGradient(progX, 0, progX + progW, 0);
    progGrad.addColorStop(0, "#0284c7");
    progGrad.addColorStop(1, "#2563eb");
    ctx.fillStyle = progGrad;
    ctx.fill();
  }

  // 4. 고정 최대값 스케일 헤더 & 세로 점선 가이드라인
  const labelColX = 56;
  const trackX = 330;
  const trackW = W - 330 - 180; // 우측 점수 영역 180px 확보 (트랙 폭 1410px)
  const scoreColRightX = W - 56;
  const scaleY = 146;

  ctx.font = `800 20px ${fontStack}`;
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "left";
  ctx.fillText(isAdult ? "순위 · 소속팀" : "순위 · 클럽명", labelColX, scaleY);

  ctx.textAlign = "right";
  ctx.fillStyle = "#0284c7";
  ctx.fillText(`최대 ${finalMaxPts}점`, scoreColRightX, scaleY);

  const ticks = [
    { ratio: 0,    label: "0점", align: "left", color: "#64748b" },
    { ratio: 0.25, label: `${Math.round(finalMaxPts * 0.25)}점`, align: "center", color: "#64748b" },
    { ratio: 0.50, label: `${Math.round(finalMaxPts * 0.50)}점`, align: "center", color: "#64748b" },
    { ratio: 0.75, label: `${Math.round(finalMaxPts * 0.75)}점`, align: "center", color: "#64748b" },
    { ratio: 1.0,  label: `최종 최대 ${finalMaxPts}점 (${topClub})`, align: "right", color: "#0284c7" }
  ];

  const rowsStartY = 186;
  const numClubs = Math.max(1, displayStandings.length);
  const availRowsH = H - rowsStartY - 38; // 약 856px
  const rowStride = isAdult
    ? Math.floor(availRowsH / numClubs) // 성인부 10팀: 약 85px
    : Math.floor(availRowsH / numClubs); // 학생부 19팀: 약 45px
  const barHeight = isAdult ? 52 : 31;
  const rowsEndY = rowsStartY + numClubs * rowStride - (rowStride - barHeight);

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ticks.forEach(tk => {
    const tx = trackX + trackW * tk.ratio;
    ctx.beginPath();
    ctx.moveTo(tx, rowsStartY - 10);
    ctx.lineTo(tx, rowsEndY + 6);
    ctx.stroke();

    ctx.font = `${tk.ratio === 1 ? "900" : "700"} 19px ${fontStack}`;
    ctx.fillStyle = tk.color;
    ctx.textAlign = tk.align;
    ctx.fillText(tk.label, tx, scaleY);
  });
  ctx.restore();

  // 헤더 구분선
  ctx.beginPath();
  ctx.moveTo(56, 168);
  ctx.lineTo(W - 56, 168);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 5. 각 클럽 행 렌더링 (순위 변동 시 Y좌표 부드러운 지수 보간)
  const drawItems = displayStandings.map((c, idx) => {
    const targetY = rowsStartY + idx * rowStride;
    let currY = animYMap.get(c.team);
    if (currY === undefined) {
      currY = targetY;
    } else {
      currY = currY + (targetY - currY) * smoothingFactor;
      if (Math.abs(targetY - currY) < 0.2) currY = targetY;
    }
    animYMap.set(c.team, currY);
    return { c, idx, currY };
  });

  const fontSizeLabel = isAdult ? 24 : 20;
  const fontSizeScore = isAdult ? 25 : 20.5;
  const barRadius = isAdult ? 10 : 7;

  // 상위 랭크가 위에 그려지도록 역순 렌더링
  for (let i = drawItems.length - 1; i >= 0; i--) {
    const { c, idx, currY } = drawItems[i];
    const rowPad = isAdult ? 8 : 4;
    const rowH = barHeight + rowPad * 2;

    // 우리팀(거제몽꾸·거제야르) 행 주황색 하이라이트 배경
    if (c.isOurTeam) {
      drawRoundedRectPath(ctx, 42, currY - rowPad, W - 84, rowH, 10);
      ctx.fillStyle = "#fff7ed";
      ctx.fill();
      ctx.strokeStyle = "#fdba74";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const centerY = currY + barHeight / 2;

    // 클럽명 텍스트 (우리팀 주황색 하이라이트 / 다른 팀 기본 진회색)
    ctx.font = `${c.isOurTeam ? "900" : "800"} ${fontSizeLabel}px ${fontStack}`;
    ctx.fillStyle = c.isOurTeam ? "#c2410c" : "#0f172a";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const teamLabel = `${idx + 1}. ${c.team}`;
    ctx.fillText(teamLabel, labelColX, centerY, trackX - labelColX - 16);

    // 트랙 배경
    drawRoundedRectPath(ctx, trackX, currY, trackW, barHeight, barRadius);
    ctx.fillStyle = "#e2e8f0";
    ctx.fill();

    // 막대 채우기 (우리팀: 주황색 / 다른 팀: 파란색 통일)
    const ratio = finalMaxPts > 0 ? Math.max(0, Math.min(1, c.interpPoints / finalMaxPts)) : 0;
    const fillW = c.interpPoints > 0 ? Math.max(6, trackW * ratio) : 0;
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(trackX, 0, trackX + fillW, 0);
      if (c.isOurTeam) {
        grad.addColorStop(0, "#ea580c");
        grad.addColorStop(1, "#f97316");
      } else {
        grad.addColorStop(0, "#1d4ed8");
        grad.addColorStop(1, "#3b82f6");
      }
      drawRoundedRectPath(ctx, trackX, currY, fillW, barHeight, barRadius);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 점수 텍스트
    ctx.font = `900 ${fontSizeScore}px ${fontStack}`;
    ctx.fillStyle = c.isOurTeam ? "#c2410c" : "#0f172a";
    ctx.textAlign = "right";
    ctx.fillText(`${c.displayPoints}점`, scoreColRightX, centerY);
  }

  ctx.restore();
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function exportStandingsAnimationMp4(divisionKey = "student") {
  if (isMp4Exporting) return;
  isMp4Exporting = true;

  const isAdult = divisionKey === "adult";
  const btnId = isAdult ? "btnAdultDownloadMp4" : "btnStudentDownloadMp4";
  const getBtn = () => document.getElementById(btnId);

  const setBtnState = (label, disabled) => {
    const b = getBtn();
    if (b) {
      b.textContent = label;
      b.disabled = Boolean(disabled);
    }
  };

  setBtnState("⏳ 1080p HD 준비 중...", true);

  try {
    const totalRaces = isAdult ? ADULT_TOTAL_RACES : STUDENT_TOTAL_RACES;
    const { maxPts: finalMaxPts, topClub } = isAdult ? getAdultFinalMaxInfo() : getStudentFinalMaxInfo();

    // 기본 목표: 유튜브 표준 Full HD 1920x1080 (16:9) @ 60fps, 5Mbps 고화질
    let canvasW = 1920;
    let canvasH = 1080;
    let fps = 60;
    let targetBitrate = 5_000_000; // 5 Mbps (유튜브 1080p60 선명한 텍스트·그래픽 품질)

    const canvas = document.createElement("canvas");
    const animYMap = new Map();

    let mp4Blob = null;
    let fileExt = "mp4";

    if (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {
      try {
        const { Muxer, ArrayBufferTarget } = await loadMp4MuxerModule();

        // 1순위: 1920x1080 @ 60fps (Level 4.2: 2a) -> 2순위: 1920x1080 @ 30fps (Level 4.0: 28) -> 3순위: 1280x720 (Level 3.1/4.0)
        const profileCandidates = [
          { w: 1920, h: 1080, fps: 60, bitrate: 5_000_000, codecs: ["avc1.64002a", "avc1.4d002a", "avc1.42002a"] },
          { w: 1920, h: 1080, fps: 30, bitrate: 4_000_000, codecs: ["avc1.640028", "avc1.4d0028", "avc1.420028", "avc1.64002a"] },
          { w: 1280, h: 720,  fps: 60, bitrate: 3_500_000, codecs: ["avc1.640020", "avc1.4d0020", "avc1.420020", "avc1.640028"] },
          { w: 1280, h: 720,  fps: 30, bitrate: 2_800_000, codecs: ["avc1.64001f", "avc1.4d001f", "avc1.42001f"] }
        ];

        let supportedConfig = null;
        for (const cand of profileCandidates) {
          for (const codecStr of cand.codecs) {
            const cfg = {
              codec: codecStr,
              width: cand.w,
              height: cand.h,
              bitrate: cand.bitrate,
              framerate: cand.fps
            };
            const check = await VideoEncoder.isConfigSupported(cfg);
            if (check && check.supported) {
              supportedConfig = check.config || cfg;
              canvasW = cand.w;
              canvasH = cand.h;
              fps = cand.fps;
              targetBitrate = cand.bitrate;
              break;
            }
          }
          if (supportedConfig) break;
        }

        if (supportedConfig) {
          canvas.width = canvasW;
          canvas.height = canvasH;
          const ctx = canvas.getContext("2d", { alpha: false });
          const scale = canvasW / 1920;

          const introFrames = Math.round(fps * 0.5);  // 0.5초 초기(0점) 대기
          const playFrames = Math.round(fps * 14.0);  // 14.0초 본 경기 진행
          const outroFrames = Math.round(fps * 2.0);  // 2.0초 최종 결과 홀드
          const totalFrames = introFrames + playFrames + outroFrames; // 16.5초 (60fps 기준 990프레임)
          const smoothingFactor = fps >= 60 ? 0.16 : 0.28;

          const drawStepFrame = (frameIndex) => {
            let progress = 0;
            if (frameIndex < introFrames) {
              progress = 0;
            } else if (frameIndex < introFrames + playFrames) {
              const ratio = (frameIndex - introFrames) / (playFrames - 1);
              progress = ratio * totalRaces;
            } else {
              progress = totalRaces;
            }

            const r0 = Math.max(0, Math.min(totalRaces, Math.floor(progress)));
            const r1 = Math.min(totalRaces, r0 + 1);
            const alpha = progress - r0;

            let standings0;
            let standings1;
            if (isAdult) {
              standings0 = getAdultCalculatedAtRace(r0).clubStandings;
              standings1 = r1 === r0 ? standings0 : getAdultCalculatedAtRace(r1).clubStandings;
            } else {
              standings0 = getStudentStandingsAtRace(r0);
              standings1 = r1 === r0 ? standings0 : getStudentStandingsAtRace(r1);
            }

            const displayStandings = buildInterpolatedStandings(standings0, standings1, alpha);
            const intRaceIdx = Math.floor(progress + 1e-6);
            const raceLabel = isAdult
              ? getAdultPlaybackRaceLabel(intRaceIdx)
              : getStudentPlaybackRaceLabel(intRaceIdx);

            renderBarRaceFrameToCanvas(ctx, {
              scale,
              isAdult,
              progress,
              totalRaces,
              finalMaxPts,
              topClub,
              raceLabel,
              displayStandings,
              animYMap,
              smoothingFactor
            });
          };

          const target = new ArrayBufferTarget();
          const muxer = new Muxer({
            target,
            video: {
              codec: "avc",
              width: canvasW,
              height: canvasH
            },
            fastStart: "in-memory"
          });

          let encodeError = null;
          const encoder = new VideoEncoder({
            output: (chunk, meta) => {
              muxer.addVideoChunk(chunk, meta);
            },
            error: (err) => {
              encodeError = err;
            }
          });

          encoder.configure(supportedConfig);

          for (let f = 0; f < totalFrames; f++) {
            if (encodeError) throw encodeError;
            drawStepFrame(f);

            const timestampUs = Math.round((f * 1_000_000) / fps);
            const durationUs = Math.round(1_000_000 / fps);
            const videoFrame = new VideoFrame(canvas, {
              timestamp: timestampUs,
              duration: durationUs
            });
            encoder.encode(videoFrame, { keyFrame: f % (fps * 2) === 0 });
            videoFrame.close();

            if (f % 20 === 0 || f === totalFrames - 1) {
              const pct = Math.round(((f + 1) / totalFrames) * 100);
              setBtnState(`⏳ ${canvasH}p HD 생성 중... (${pct}%)`, true);
              while (encoder.encodeQueueSize > 14) {
                await new Promise(r => setTimeout(r, 4));
              }
              await new Promise(r => setTimeout(r, 0));
            }
          }

          await encoder.flush();
          encoder.close();
          muxer.finalize();

          mp4Blob = new Blob([target.buffer], { type: "video/mp4" });
          fileExt = "mp4";
        }
      } catch (webCodecsErr) {
        console.warn("[MP4Export] WebCodecs path fallback to MediaRecorder:", webCodecsErr);
      }
    }

    // 2순위 폴백: MediaRecorder 스트림 캡처 (1920x1080 Full HD)
    if (!mp4Blob) {
      canvasW = 1920;
      canvasH = 1080;
      fps = 30;
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d", { alpha: false });
      const scale = 1.0;

      const stream = canvas.captureStream(fps);
      const mimeCandidates = [
        "video/mp4;codecs=avc1",
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm"
      ];
      const chosenMime = mimeCandidates.find(m => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
      fileExt = chosenMime.includes("mp4") ? "mp4" : "webm";

      const chunks = [];
      const recorder = new MediaRecorder(stream, {
        ...(chosenMime ? { mimeType: chosenMime } : {}),
        videoBitsPerSecond: 4_500_000
      });
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const stoppedPromise = new Promise((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start(200);
      const fallbackFrames = 360; // 12초
      for (let f = 0; f < fallbackFrames; f++) {
        const progress = (f / (fallbackFrames - 1)) * totalRaces;
        const r0 = Math.max(0, Math.min(totalRaces, Math.floor(progress)));
        const r1 = Math.min(totalRaces, r0 + 1);
        const alpha = progress - r0;
        const standings0 = isAdult ? getAdultCalculatedAtRace(r0).clubStandings : getStudentStandingsAtRace(r0);
        const standings1 = r1 === r0 ? standings0 : (isAdult ? getAdultCalculatedAtRace(r1).clubStandings : getStudentStandingsAtRace(r1));
        const displayStandings = buildInterpolatedStandings(standings0, standings1, alpha);
        const intRaceIdx = Math.floor(progress + 1e-6);
        const raceLabel = isAdult ? getAdultPlaybackRaceLabel(intRaceIdx) : getStudentPlaybackRaceLabel(intRaceIdx);

        renderBarRaceFrameToCanvas(ctx, {
          scale,
          isAdult,
          progress,
          totalRaces,
          finalMaxPts,
          topClub,
          raceLabel,
          displayStandings,
          animYMap,
          smoothingFactor: 0.25
        });

        if (f % 10 === 0) {
          const pct = Math.round(((f + 1) / fallbackFrames) * 100);
          setBtnState(`⏳ 1080p HD 녹화 중... (${pct}%)`, true);
        }
        await new Promise(r => setTimeout(r, 1000 / fps));
      }
      recorder.stop();
      await stoppedPromise;
      mp4Blob = new Blob(chunks, { type: chosenMime || "video/mp4" });
    }

    const sizeMb = (mp4Blob.size / (1024 * 1024)).toFixed(2);
    const filename = isAdult
      ? `2026_거제시장배_성인부_팀점수추이_${canvasH}p_HD.${fileExt}`
      : `2026_거제시장배_학생부_클럽점수추이_${canvasH}p_HD.${fileExt}`;

    triggerBlobDownload(mp4Blob, filename);
    setBtnState(`✅ ${canvasH}p HD 완료 (${sizeMb}MB)`, false);
    setTimeout(() => {
      if (!isMp4Exporting) {
        setBtnState("🎬 HD MP4 저장 (1080p)", false);
      }
    }, 3200);
  } catch (err) {
    console.error("[MP4Export] Error:", err);
    alert("HD MP4 영상 생성 중 오류가 발생했습니다: " + (err?.message || err));
    setBtnState("🎬 HD MP4 저장 (1080p)", false);
  } finally {
    isMp4Exporting = false;
  }
}

function renderAdultPodiumCardsDOM() {
  const box = document.getElementById("adultPodiumCardsContainer");
  if (!box) return;
  const allItems = OUR_TEAM_ADULT_HIGHLIGHTS.podiumAndScoringList || [];
  let list = allItems;
  if (adultPodiumFilterMode === "medal") {
    list = allItems.filter(it => ["1위", "2위", "3위"].includes(it.rank));
  } else if (adultPodiumFilterMode === "거제몽꾸" || adultPodiumFilterMode === "거제야르") {
    list = allItems.filter(it => it.team === adultPodiumFilterMode);
  }

  box.innerHTML = list.map(item => {
    const cardCls = item.rank === "1위"
      ? "is-gold"
      : item.rank === "2위"
        ? "is-silver"
        : item.rank === "3위"
          ? "is-bronze"
          : "is-top6";
    const teamPill = item.team === "거제몽꾸"
      ? `<span class="team-tag-pill mongkku">🟠 거제몽꾸</span>`
      : `<span class="team-tag-pill yareu">🔵 거제야르</span>`;

    return `
      <div class="podium-spot-card ${cardCls}">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <span class="result-rank-badge ${item.badgeClass}">${escapeHtml(item.medal)}</span>
            ${teamPill}
          </div>
          <span class="result-pts-pill">+${item.points}점</span>
        </div>
        <div style="display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-top:2px;">
          <strong style="font-size:15px; font-weight:900; color:#0f172a;">${escapeHtml(item.name)}</strong>
          <span style="font-size:14.5px; font-weight:900; color:#0284c7; font-variant-numeric:tabular-nums;">${escapeHtml(item.record)}</span>
        </div>
        <div style="font-size:12px; font-weight:700; color:#334155;">
          ${escapeHtml(item.gender)} · ${escapeHtml(item.group)} · ${escapeHtml(item.event)} <span style="color:#64748b;">(#${escapeHtml(item.matchNo)} · ${item.lane}레인)</span>
        </div>
        <div style="font-size:11.5px; font-weight:600; color:#475569; line-height:1.45; border-top:1px dashed #e2e8f0; padding-top:5px;">
          ${escapeHtml(item.note)}
        </div>
      </div>
    `;
  }).join("");
}

function getAdultRankCellInnerHtml(rowState) {
  if (rowState.isExcluded) {
    return `<span style="color:#be123c; font-weight:800; font-size:12px;">-</span>`;
  }
  if (rowState.rank !== null && rowState.rank > 0) {
    const r = rowState.rank;
    const color = r === 1 ? "#b45309" : r === 2 ? "#334155" : r === 3 ? "#9a3412" : r <= 6 ? "#0284c7" : "#475569";
    return `<span style="font-weight:${r <= 6 ? "900" : "700"}; color:${color}; font-variant-numeric:tabular-nums;">${r}</span>`;
  }
  return `<span style="color:#cbd5e1;">-</span>`;
}

function getAdultPointsCellInnerHtml(rowState) {
  if (rowState.isExcluded) {
    return `<span style="color:#cbd5e1;">0</span>`;
  }
  if (rowState.rank !== null && rowState.rank > 0) {
    const pts = rowState.points;
    return `<span style="font-weight:${pts > 0 ? "900" : "600"}; color:${pts > 0 ? "#1d4ed8" : "#94a3b8"}; font-variant-numeric:tabular-nums;">${pts}</span>`;
  }
  return `<span style="color:#cbd5e1;">-</span>`;
}

function recalculateAndPatchAdultResultsDOM() {
  adultStandingsByRaceCache.clear();
  const { calcMap } = getAdultCalculatedAtRace(ADULT_TOTAL_RACES);
  renderAdultStandingsAndChartForCurrentStep();

  const tbody = document.getElementById("adultResultScheduleTableBody");
  if (!tbody) return;

  tbody.querySelectorAll("tr[data-adult-entry-key]").forEach(tr => {
    const key = tr.dataset.adultEntryKey;
    const st = calcMap.get(key);
    if (!st) return;

    const rankCell = tr.querySelector("[data-adult-rank-cell]");
    if (rankCell) {
      rankCell.innerHTML = getAdultRankCellInnerHtml(st);
    }

    const ptsCell = tr.querySelector("[data-adult-pts-cell]");
    if (ptsCell) {
      ptsCell.innerHTML = getAdultPointsCellInnerHtml(st);
    }

    const secInput = tr.querySelector("input[data-adult-sec]");
    if (secInput) {
      secInput.classList.toggle("has-value", st.secNum !== null && st.secNum > 0);
    }

    const noteInput = tr.querySelector("input[data-adult-note]");
    if (noteInput) {
      noteInput.classList.toggle("is-excluded-note", st.isExcluded);
    }
  });
}

function patchAdultInputsAndResultsFromState() {
  const tbody = document.getElementById("adultResultScheduleTableBody");
  if (tbody) {
    tbody.querySelectorAll("tr[data-adult-entry-key]").forEach(tr => {
      const key = tr.dataset.adultEntryKey;
      const inp = adultResultInputs[key] || { sec: "", note: "" };
      const secEl = tr.querySelector("input[data-adult-sec]");
      if (secEl && document.activeElement !== secEl && secEl.value !== String(inp.sec ?? "")) {
        secEl.value = String(inp.sec ?? "");
      }
      const noteEl = tr.querySelector("input[data-adult-note]");
      if (noteEl && document.activeElement !== noteEl && noteEl.value !== String(inp.note ?? "")) {
        noteEl.value = String(inp.note ?? "");
      }
    });
  }
  recalculateAndPatchAdultResultsDOM();
}

function renderAdultScheduleTableRows() {
  const thead = document.getElementById("adultResultScheduleTableHead");
  const tbody = document.getElementById("adultResultScheduleTableBody");
  const titleEl = document.getElementById("adultResultTableTitle");
  if (!thead || !tbody) return;

  adultStandingsByRaceCache.clear();
  const { calcMap, totalCount } = getAdultCalculatedAtRace(ADULT_TOTAL_RACES);
  renderAdultStandingsAndChartForCurrentStep();
  updateAdultPlaybackControlsDOM();

  const activeCols = ADULT_RESULT_COLUMNS.filter(c => visibleAdultResultCols.has(c.key));
  thead.innerHTML = `
    <tr>
      ${activeCols.map(c => {
        if (c.key === "sec") {
          const isSorted = adultResRecordSortMode !== "default";
          const lbl = getRecordSortHeaderLabel(c.label, adultResRecordSortMode);
          return `<th class="th-sortable-record ${isSorted ? "is-sorted" : ""}" data-adult-record-sort-th="1" style="width:${c.width}; text-align:${c.align};" title="클릭하여 기록순 정렬 (오름차순 ▲ / 내림차순 ▼ / 기본순)">${escapeHtml(lbl)}</th>`;
        }
        return `<th style="width:${c.width}; text-align:${c.align};">${escapeHtml(c.label)}</th>`;
      }).join("")}
    </tr>
  `;

  const adultSortBtn = document.getElementById("btnAdultResSortRecordAsc");
  if (adultSortBtn) {
    adultSortBtn.classList.toggle("is-active-sort", adultResRecordSortMode !== "default");
    adultSortBtn.textContent = getRecordSortButtonLabel(adultResRecordSortMode);
  }
  const adultSortSel = document.getElementById("adultResSortSelect");
  if (adultSortSel && adultSortSel.value !== adultResRecordSortMode) {
    adultSortSel.value = adultResRecordSortMode;
  }

  let list = [...calcMap.values()];

  if (adultResStrokeFilter !== "all") {
    if (adultResStrokeFilter === "RELAY_ALL") {
      list = list.filter(r => r.isRelay);
    } else {
      list = list.filter(r => r.strokeRaw === adultResStrokeFilter);
    }
  }
  if (adultResGroupFilter !== "all") {
    list = list.filter(r => r.group === adultResGroupFilter);
  }
  if (adultResGenderFilter !== "all") {
    list = list.filter(r => r.gender === adultResGenderFilter);
  }
  if (adultResTeamFilter !== "all") {
    if (adultResTeamFilter === "OUR_ALL") {
      list = list.filter(r => r.isOurTeam);
    } else {
      list = list.filter(r => r.team === adultResTeamFilter);
    }
  }
  if (adultResStatusFilter === "entered") {
    list = list.filter(r => r.rawSec.trim() !== "" || r.rawNote.trim() !== "");
  } else if (adultResStatusFilter === "pending") {
    list = list.filter(r => r.rawSec.trim() === "" && r.rawNote.trim() === "");
  } else if (adultResStatusFilter === "top6") {
    list = list.filter(r => r.rank !== null && r.rank >= 1 && r.rank <= 6);
  } else if (adultResStatusFilter === "medal") {
    list = list.filter(r => r.rank !== null && r.rank >= 1 && r.rank <= 3);
  } else if (adultResStatusFilter === "dq_dns") {
    list = list.filter(r => r.isExcluded);
  }

  if (adultResSearchQuery.trim() !== "") {
    const q = adultResSearchQuery.trim().toLowerCase();
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.team.toLowerCase().includes(q) ||
      r.matchNo.toLowerCase().includes(q) ||
      r.strokeDisplay.toLowerCase().includes(q) ||
      r.group.toLowerCase().includes(q) ||
      r.rawNote.toLowerCase().includes(q)
    );
  }

  list = sortRowsByRecordMode(
    list,
    adultResRecordSortMode,
    (r) => (!r.isExcluded && r.secNum !== null && r.secNum > 0 ? r.secNum : null)
  );

  if (titleEl) {
    titleEl.textContent = `📋 성인부 공식 기록지 원문 전체 데이터 조회 (${list.length}건 표시 중 / 전체 ${totalCount}건)`;
  }

  if (activeCols.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td style="text-align:center; padding:32px 16px; color:#64748b; font-weight:600;">
          표시할 열(항목)을 최소 1개 이상 선택해 주세요.
        </td>
      </tr>
    `;
    return;
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${activeCols.length}" style="text-align:center; padding:32px 16px; color:#64748b; font-weight:600;">
          선택한 필터 조건에 해당하는 성인부 대진표 엔트리가 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(r => {
    const rowCls = r.team === "거제몽꾸"
      ? "team-power-row row-team-mongkku"
      : r.team === "거제야르"
        ? "team-power-row row-team-yareu"
        : "";
    const teamColor = r.team === "거제몽꾸"
      ? "#c2410c"
      : r.team === "거제야르"
        ? "#0369a1"
        : "#334155";

    const cellMap = {
      matchNo: `<td style="text-align:center; font-weight:800; color:#0284c7; font-variant-numeric:tabular-nums;">#${escapeHtml(r.matchNo)}</td>`,
      stroke:  `<td style="text-align:center; font-weight:700; color:#334155;">${escapeHtml(r.strokeDisplay)}</td>`,
      gender:  `<td style="text-align:center; font-weight:700; color:#334155;">${escapeHtml(r.genderShort)}</td>`,
      group:   `<td style="text-align:center; font-weight:700; color:#334155; font-variant-numeric:tabular-nums;">${escapeHtml(r.groupNum)}</td>`,
      lane:    `<td style="text-align:center; font-weight:800; color:#334155; font-variant-numeric:tabular-nums;">${r.lane}</td>`,
      name:    `<td style="text-align:left; font-weight:${r.isOurTeam ? "900" : "700"}; color:#0f172a;">${escapeHtml(r.name)}</td>`,
      team:    `<td style="text-align:center; font-weight:${r.isOurTeam ? "900" : "700"}; color:${teamColor};">${escapeHtml(r.team)}</td>`,
      sec:     `<td style="text-align:center;"><input type="text" inputmode="decimal" class="adult-sec-input ${r.secNum !== null && r.secNum > 0 ? "has-value" : ""}" data-adult-sec="${escapeHtml(r.entryKey)}" value="${escapeHtml(r.rawSec)}" placeholder="초 (예:28.45)" autocomplete="off"></td>`,
      rank:    `<td style="text-align:center;" data-adult-rank-cell="${escapeHtml(r.entryKey)}">${getAdultRankCellInnerHtml(r)}</td>`,
      points:  `<td style="text-align:center;" data-adult-pts-cell="${escapeHtml(r.entryKey)}">${getAdultPointsCellInnerHtml(r)}</td>`,
      note:    `<td style="text-align:left;"><input type="text" class="adult-note-input ${r.isExcluded ? "is-excluded-note" : ""}" data-adult-note="${escapeHtml(r.entryKey)}" value="${escapeHtml(r.rawNote)}" placeholder="실격/불참/비고" autocomplete="off"></td>`
    };

    return `
      <tr class="${rowCls}" data-adult-entry-key="${escapeHtml(r.entryKey)}" data-row-stroke="${escapeHtml(r.strokeRaw)}" data-row-match="${escapeHtml(r.matchNo)}">
        ${activeCols.map(c => cellMap[c.key]).join("")}
      </tr>
    `;
  }).join("");
}

function renderAdultResultAnalysisView(container) {
  startAdultResultsFirestoreListener();

  const adultDivData = getDivisionData("adult");
  const allTeamNames = adultDivData.teams.map(t => t.team);

  const ourColToggleChipsHtml = OUR_TEAM_COLUMNS.map(col => {
    const isChecked = visibleOurTeamCols.has(col.key);
    return `
      <label class="col-toggle-chip ${isChecked ? "is-checked" : ""}">
        <input type="checkbox" data-our-col-key="${col.key}" ${isChecked ? "checked" : ""}>
        <span>${escapeHtml(col.label)}</span>
      </label>
    `;
  }).join("");

  const colToggleChipsHtml = ADULT_RESULT_COLUMNS.map(col => {
    const isChecked = visibleAdultResultCols.has(col.key);
    return `
      <label class="col-toggle-chip ${isChecked ? "is-checked" : ""}">
        <input type="checkbox" data-adult-col-key="${col.key}" ${isChecked ? "checked" : ""}>
        <span>${escapeHtml(col.label)}</span>
      </label>
    `;
  }).join("");

  container.innerHTML = `
    <!-- =============================================================== -->
    <!-- 1. 성인부 팀별 점수 및 메달·우승 집계 (경기 진행 재생 지원)      -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>📊 1. 성인부 팀별 점수 및 메달·우승 집계 (전 경기 141레이스 · 492엔트리 공식 결과)</h3>
          <span class="progress-sec-sub">재생 버튼을 누르면 경기번호가 진행됨(1~141경기)에 따라 팀별 점수 변화를 보여주며, 우리팀(거제몽꾸·거제야르)은 주황색 하이라이트, 다른 팀은 파란색 막대로 표시됩니다.</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span id="adultResultEnteredProgressBadge" class="adult-sync-badge" style="background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8;">기록 입력: 492 / 492건 (100.0%)</span>
          <span id="adultResultSyncBadge" class="adult-sync-badge is-synced">✅ 공식 기록지 492 / 492건 완비 · 실시간 동기화</span>
        </div>
      </div>

      <!-- 경기번호 진행 재생(Playback) 컨트롤 바 -->
      <div class="adult-playback-bar">
        <div class="adult-playback-controls">
          <button type="button" class="btn-adult-play" id="btnAdultPlaybackToggle">▶️ 재생</button>
          <button type="button" class="btn-adult-step" id="btnAdultPlaybackReset" title="0번 초기 상태로 이동">⏮️ 처음</button>
          <button type="button" class="btn-adult-step" id="btnAdultPlaybackPrev" title="한 스텝(1경기) 이전으로 이동">◀ 이전</button>
          <button type="button" class="btn-adult-step" id="btnAdultPlaybackNext" title="한 스텝(1경기) 이후로 이동">다음 ▶</button>
          <button type="button" class="btn-adult-step" id="btnAdultPlaybackEnd" title="최종 경기로 이동">⏭️ 최종</button>
          <button type="button" class="btn-adult-mp4" id="btnAdultDownloadMp4" title="유튜브 업로드용 Full HD(1920×1080, 16:9, 60fps) 고화질 MP4 영상으로 다운로드합니다">🎬 HD MP4 저장 (1080p)</button>
        </div>
        <div class="adult-playback-slider-wrap">
          <input type="range" class="adult-race-slider" id="adultPlaybackSlider" min="0" max="${ADULT_TOTAL_RACES}" value="${adultPlaybackRaceIndex}">
          <span class="adult-playback-match-info" id="adultPlaybackMatchInfo">${escapeHtml(getAdultPlaybackRaceLabel(adultPlaybackRaceIndex))}</span>
        </div>
      </div>

      <!-- 팀명 · 가로막대그래프(1·2·3위 금은동 / 나머지 파란색) · 총점 -->
      <div class="adult-hbar-wrap">
        <div class="adult-hbar-scale-header">
          <span>순위 · 소속팀</span>
          <div class="adult-hbar-scale-ticks" id="adultHBarScaleTicks"></div>
          <span style="text-align:right; color:#0284c7;" id="adultHBarScaleMaxLabel">최대 303점</span>
        </div>
        <div class="adult-hbar-list" id="adultTeamScoreHBarContainer"></div>
      </div>

      <!-- 메달 개수 및 개인·단체전 우승 횟수·점수 집계표 -->
      <div class="table-responsive">
        <table class="record-table">
          <thead>
            <tr>
              <th style="width: 56px; text-align: center;">순위</th>
              <th style="min-width: 120px; text-align: left;">소속팀</th>
              <th style="width: 68px; text-align: center;">🥇 금</th>
              <th style="width: 68px; text-align: center;">🥈 은</th>
              <th style="width: 68px; text-align: center;">🥉 동</th>
              <th style="width: 72px; text-align: center;">4~6위</th>
              <th style="width: 92px; text-align: center;">개인전 우승</th>
              <th style="width: 92px; text-align: center;">단체전 우승</th>
              <th style="width: 88px; text-align: center;">개인전 점수</th>
              <th style="width: 88px; text-align: center;">단체전 점수</th>
              <th style="width: 88px; text-align: center;">총점</th>
            </tr>
          </thead>
          <tbody id="adultTeamMedalTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 2. 우리팀 (거제몽꾸 · 거제야르) 성인부 대회 결과 종합 요약       -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>🏅 2. 우리팀 (거제몽꾸 · 거제야르) 성인부 대회 결과 종합 요약 & 명예의 전당</h3>
          <span class="progress-sec-sub">${escapeHtml(ADULT_SHEET_META.scoringRuleIndiv)} / ${escapeHtml(ADULT_SHEET_META.scoringRuleRelay)}</span>
        </div>
      </div>

      <div class="kpi-grid-4">
        <div class="kpi-stat-card highlight-amber">
          <span class="kpi-label">🟠 거제몽꾸 종합 성적</span>
          <span class="kpi-value">195점 (종합 준우승 🥈)</span>
          <span class="kpi-sub">개인 <strong>173점</strong> + 단체 <strong>22점</strong> (🥇10 · 🥈12 · 🥉4 · 4~6위 19건)</span>
        </div>
        <div class="kpi-stat-card highlight-blue">
          <span class="kpi-label">🔵 거제야르 종합 성적</span>
          <span class="kpi-value">33점 (클럽 9위)</span>
          <span class="kpi-sub">개인 <strong>25점</strong> + 단체 <strong>8점</strong> (🥈3 · 🥉2 · 4~6위 3건, 총 8건 입상)</span>
        </div>
        <div class="kpi-stat-card highlight-emerald">
          <span class="kpi-label">🔥 우리 클럽 합산(몽꾸+야르)</span>
          <span class="kpi-value">합산 228점 · 53입상</span>
          <span class="kpi-sub">🥇금 10 · 🥈은 15 · 🥉동 6 (총 메달 31개 · 입상률 60.9%)</span>
        </div>
        <div class="kpi-stat-card highlight-purple">
          <span class="kpi-label">👑 개인전 2관왕(금2) 주인공</span>
          <span class="kpi-value">박슬우 · 이지호 · 송원자</span>
          <span class="kpi-sub">출전 2종목 모두 금메달 (각 14점 만점 획득!)</span>
        </div>
      </div>

      <!-- 우리팀 다득점 에이스 기여도 & 핵심 인사이트 (2열) -->
      <div class="charts-two-col">
        <div class="hbar-chart-box">
          <h4 class="hbar-chart-title">
            <span>🌟 우리팀 (거제몽꾸 · 거제야르) 주요 다득점 선수 Top 12</span>
            <span style="font-size:11.5px; color:#c2410c;">개인전 198점 + 단체전 30점 = 합산 228점</span>
          </h4>
          <div class="hbar-list">
            <div class="hbar-row">
              <span class="hbar-label">🥇🥇 박슬우 (남1·몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 100%; background:#eab308;"></div>
                <span class="hbar-bar-text">접영 1위(27"94) + 자유형 1위(25"06)</span>
              </div>
              <span class="hbar-val">14점 (2관왕)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥇🥇 이지호 (여1·몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 100%; background:#eab308;"></div>
                <span class="hbar-bar-text">접영 1위(45"38) + 핀자유형 1위(30"41)</span>
              </div>
              <span class="hbar-val">14점 (2관왕)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥇🥇 송원자 (여6·몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 100%; background:#eab308;"></div>
                <span class="hbar-bar-text">평영 1위(48"13) + 자유형 1위(40"93)</span>
              </div>
              <span class="hbar-val">14점 (2관왕)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥇🥈 박봉권 (남6·몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 85.7%; background:#f59e0b;"></div>
                <span class="hbar-bar-text">배영 1위(7점) + 평영 2위(5점)</span>
              </div>
              <span class="hbar-val">12점 (금1·은1)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥇🥈 최지희 (여6·몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 85.7%; background:#f59e0b;"></div>
                <span class="hbar-bar-text">핀자유형 1위(7점) + 자유형 2위(5점)</span>
              </div>
              <span class="hbar-val">12점 (금1·은1)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥇🥉 성환용 (남6·몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 78.6%; background:#d97706;"></div>
                <span class="hbar-bar-text">핀접영 1위(7점) + 핀자유형 3위(4점)</span>
              </div>
              <span class="hbar-val">11점 (금1·동1)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥇🏅 박다유 (여4·몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 71.4%; background:#ea580c;"></div>
                <span class="hbar-bar-text">배영 1위(7점) + 자유형 4위(3점)</span>
              </div>
              <span class="hbar-val">10점 (금1·4위)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥈🥈 이지훈 (남1·몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 71.4%; background:#0284c7;"></div>
                <span class="hbar-bar-text">접영 2위(5점) + 핀자유형 2위(5점)</span>
              </div>
              <span class="hbar-val">10점 (은2)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥈🥈 노언영 (여3·몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 71.4%; background:#0284c7;"></div>
                <span class="hbar-bar-text">평영 2위(5점) + 자유형 2위(5점)</span>
              </div>
              <span class="hbar-val">10점 (은2)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥈🥉 안상준 (남4·몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 64.3%; background:#2563eb;"></div>
                <span class="hbar-bar-text">자유형 2위(5점) + 접영 3위(4점)</span>
              </div>
              <span class="hbar-val">9점 (+단체2)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥈🥉 김애란 (여5·야르)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 64.3%; background:#0369a1;"></div>
                <span class="hbar-bar-text">자유형 2위(5점) + 배영 3위(4점)</span>
              </div>
              <span class="hbar-val">9점 (+단체2)</span>
            </div>
            <div class="hbar-row">
              <span class="hbar-label">🥈🏅 이영경·박선화 (몽꾸)</span>
              <div class="hbar-track allow-overflow">
                <div class="hbar-fill" style="width: 57.1%; background:#4f46e5;"></div>
                <span class="hbar-bar-text">이영경(8점) · 박선화(8점) 각각 은1+4위</span>
              </div>
              <span class="hbar-val">각 8점</span>
            </div>
          </div>
        </div>

        <div class="hbar-chart-box" style="display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
          <div>
            <h4 class="hbar-chart-title" style="margin-bottom:8px;">💡 성인부 공식 결과 핵심 인사이트</h4>
            <ul style="margin:0; padding-left:18px; font-size:12.8px; color:#334155; line-height:1.72; font-weight:600;">
              <li><strong>거제몽꾸 종합 준우승(2위 · 195점) 쾌거!</strong>: 3위 TYU(179점)를 16점 차, 4위 팀애옹(163점)을 32점 차로 따돌리며 당당히 <strong>성인부 종합 2위(준우승)</strong>를 차지했습니다. 특히 개인전 득점만 <strong>173점(금 10·은 12·동 4)</strong>을 기록했습니다.</li>
              <li><strong>1그룹·6그룹 절대 강세 및 2관왕 3명 배출</strong>: 1그룹 <strong>박슬우(남1 2관왕)·이지호(여1 2관왕)·이지훈(은2)·조성찬(은1·6위)</strong>과 6그룹 <strong>송원자(여6 2관왕)·박봉권(금1·은1)·최지희(금1·은1)·성환용(금1·동1)</strong>이 출전 종목마다 포디움을 석권했습니다.</li>
              <li><strong>거제야르 알짜배기 33점 (입상 8건)</strong>: 소수 정예로 출전한 <strong>거제야르</strong>는 <strong>김애란(자유형 은·배영 동, 9점)</strong>, <strong>심민경(배영 은, 5점)</strong>, <strong>권순용(자유형 은, 5점)</strong>, <strong>이은희(평영 동, 4점)</strong>, <strong>정서현(배영 5위, 2점)</strong> 및 여자 혼계영·혼성 핀계영(각 5위·4점씩 총 8점)으로 33점을 합작했습니다.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 입상 명예의 전당 필터 & 카드 그리드 -->
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
        <div style="font-size:13.5px; font-weight:800; color:#0f172a;">
          🎖️ 우리팀 (거제몽꾸 · 거제야르) 입상 및 득점 명예의 전당 (총 53건 · 228점)
        </div>
        <div class="result-filter-pills" id="adultPodiumFilterGroup">
          <button type="button" class="result-filter-pill ${adultPodiumFilterMode === "medal" ? "active" : ""}" data-adult-podium-filter="medal">🥇🥈🥉 메달리스트 (31건)</button>
          <button type="button" class="result-filter-pill ${adultPodiumFilterMode === "all" ? "active" : ""}" data-adult-podium-filter="all">🌐 전체 입상 1~6위 (53건)</button>
          <button type="button" class="result-filter-pill ${adultPodiumFilterMode === "거제몽꾸" ? "active" : ""}" data-adult-podium-filter="거제몽꾸">🟠 거제몽꾸 입상 (45건)</button>
          <button type="button" class="result-filter-pill ${adultPodiumFilterMode === "거제야르" ? "active" : ""}" data-adult-podium-filter="거제야르">🔵 거제야르 입상 (8건)</button>
        </div>
      </div>
      <div class="podium-grid-cards" id="adultPodiumCardsContainer"></div>
    </section>

    <!-- =============================================================== -->
    <!-- 3. 우리팀 (거제몽꾸 · 거제야르) 성인부 종목별 상세 성적표        -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>🏊 3. 우리팀 (거제몽꾸 · 거제야르) 전체 87출전 종목별 상세 성적표</h3>
          <span class="progress-sec-sub" id="ourTeamResultCountBadge">우리팀 전체 87출전 공식 기록 조회</span>
        </div>
        <div class="result-filter-pills" id="adultOurTeamTableFilterGroup">
          <button type="button" class="result-filter-pill ${adultOurTableFilterMode === "all" ? "active" : ""}" data-adult-our-filter="all">🌐 우리팀 전체 (87건)</button>
          <button type="button" class="result-filter-pill ${adultOurTableFilterMode === "거제몽꾸" ? "active" : ""}" data-adult-our-filter="거제몽꾸">🟠 거제몽꾸 (65건)</button>
          <button type="button" class="result-filter-pill ${adultOurTableFilterMode === "거제야르" ? "active" : ""}" data-adult-our-filter="거제야르">🔵 거제야르 (22건)</button>
          <button type="button" class="result-filter-pill ${adultOurTableFilterMode === "scoring" ? "active" : ""}" data-adult-our-filter="scoring">🏅 입상·득점만 (53건)</button>
          <button type="button" class="result-filter-pill ${adultOurTableFilterMode === "medal" ? "active" : ""}" data-adult-our-filter="medal">🥇🥈🥉 메달만 (31건)</button>
        </div>
      </div>

      <!-- 표시 열(항목) 선택 체크박스 칩 바 + 원클릭 프리셋 -->
      <div class="col-toggle-bar" id="ourTeamColToggleBar">
        <div class="col-toggle-left">
          <span class="col-toggle-label">☑️ 표시 열 항목:</span>
          ${ourColToggleChipsHtml}
        </div>
        <div class="col-toggle-presets">
          <button type="button" class="col-preset-btn ${ourTeamRecordSortMode !== "default" ? "is-active-sort" : ""}" id="btnOurTeamSortRecordAsc" title="빠른 기록(오름차순)으로 정렬">${getRecordSortButtonLabel(ourTeamRecordSortMode)}</button>
          <button type="button" class="col-preset-btn" data-our-col-preset="all">전체 열 표시</button>
          <button type="button" class="col-preset-btn" data-our-col-preset="compact">핵심 열만 (모바일 추천)</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="record-table">
          <thead id="ourTeamResultTableHead"></thead>
          <tbody id="ourTeamResultTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- =============================================================== -->
    <!-- 4. 성인부 영법별 · 연령대 그룹별 1위 기록 추이 (6종목 그리드)    -->
    <!-- =============================================================== -->
    <section class="progress-card-section">
      <div class="progress-sec-header">
        <div>
          <h3>📈 4. 성인부 영법별 · 연령대 그룹별 1위 기록 추이 (단위: 초)</h3>
          <span class="progress-sec-sub">가로축: 연령대(1그룹~6그룹) · 세로축: 1위 기록(초) · 노란색 강조 점은 우리팀(거제몽꾸) 선수가 그룹 1위를 차지한 종목입니다.</span>
        </div>
      </div>
      <div class="stroke-linecharts-grid">
        ${renderStrokeFirstPlaceLineChartsHtml("adult")}
      </div>
    </section>

  `;

  updateAdultSyncBadgeDOM();
  renderAdultPodiumCardsDOM();
  renderOurTeamResultRows();
  renderAdultStandingsAndChartForCurrentStep();
  updateAdultPlaybackControlsDOM();
}

// ==========================================================================
// 🗄️ TAB 4: 기록지DB (학생부 843건 / 성인부 492건 공식 기록지 원문 전체 데이터 조회)
// 상단 Sticky 헤더 + 표시 열 항목 & 검색·필터 모달(모바일 헤더 토글) + Sticky 테이블 헤더
// ==========================================================================
let isRecordsDbModalOpen = true;

function syncRecordsDbStickyOffset() {
  if (currentSubTab !== "records") return;
  const shell = document.getElementById("recordsDbStickyShell");
  if (!shell) return;
  const h = Math.ceil(shell.getBoundingClientRect().height + 28);
  document.documentElement.style.setProperty("--records-sticky-offset", `${h}px`);
}

function updateRecordsDbModalToggleDOM() {
  const modal = document.getElementById("recordsDbControlsModal");
  const btn = document.getElementById("btnToggleRecordsDbModal");
  if (modal) {
    modal.classList.toggle("is-collapsed", !isRecordsDbModalOpen);
  }
  if (btn) {
    btn.classList.toggle("is-open", isRecordsDbModalOpen);
    btn.setAttribute("aria-expanded", String(isRecordsDbModalOpen));
    btn.innerHTML = isRecordsDbModalOpen
      ? `<span class="toggle-icon">🎛️</span><span class="toggle-text">필터·열설정 닫기 ▲</span>`
      : `<span class="toggle-icon">🎛️</span><span class="toggle-text">필터·열설정 열기 ▼</span>`;
  }
  requestAnimationFrame(() => syncRecordsDbStickyOffset());
}

function renderRecordsDbView() {
  const container = document.getElementById("viewContainerRecords");
  if (!container) return;

  if (currentDivision === "adult") {
    startAdultResultsFirestoreListener();
    const adultDivData = getDivisionData("adult");
    const allTeamNames = adultDivData.teams.map(t => t.team);

    const colToggleChipsHtml = ADULT_RESULT_COLUMNS.map(col => {
      const isChecked = visibleAdultResultCols.has(col.key);
      return `
        <label class="col-toggle-chip ${isChecked ? "is-checked" : ""}">
          <input type="checkbox" data-adult-col-key="${col.key}" ${isChecked ? "checked" : ""}>
          <span>${escapeHtml(col.label)}</span>
        </label>
      `;
    }).join("");

    container.innerHTML = `
      <section class="records-db-page-section" id="adultScheduleTableSection">
        <div class="records-db-sticky-shell" id="recordsDbStickyShell">
          <div class="records-db-header-bar">
            <div class="records-db-title-wrap">
              <h3 id="adultResultTableTitle">📋 성인부 공식 기록지 원문 전체 데이터 조회 (492건 표시 중 / 전체 492건)</h3>
              <span class="comp-breadcrumb-badge">대회결과 &gt; 성인부 &gt; 기록지DB</span>
            </div>
            <div class="records-db-header-actions">
              <button type="button" class="col-preset-btn" id="btnResetAdultOfficialRecords" title="공식 기록지 원문 기록으로 전체 복원">🔄 공식 기록 원문 복원</button>
              <button type="button" class="btn-toggle-records-modal ${isRecordsDbModalOpen ? "is-open" : ""}" id="btnToggleRecordsDbModal" aria-expanded="${isRecordsDbModalOpen}">
                <span class="toggle-icon">🎛️</span>
                <span class="toggle-text">${isRecordsDbModalOpen ? "필터·열설정 닫기 ▲" : "필터·열설정 열기 ▼"}</span>
              </button>
            </div>
          </div>

          <div class="records-db-controls-modal ${isRecordsDbModalOpen ? "" : "is-collapsed"}" id="recordsDbControlsModal">
            <div class="col-toggle-bar" id="adultResultColToggleBar">
              <div class="col-toggle-left">
                <span class="col-toggle-label">☑️ 표시 열 항목:</span>
                ${colToggleChipsHtml}
              </div>
              <div class="col-toggle-presets">
                <button type="button" class="col-preset-btn ${adultResRecordSortMode !== "default" ? "is-active-sort" : ""}" id="btnAdultResSortRecordAsc" title="빠른 기록(오름차순)으로 정렬">${getRecordSortButtonLabel(adultResRecordSortMode)}</button>
                <button type="button" class="col-preset-btn" data-adult-col-preset="all">전체 열 표시</button>
                <button type="button" class="col-preset-btn" data-adult-col-preset="compact">핵심 열만 (모바일 추천)</button>
              </div>
            </div>

            <section class="toolbar">
              <div class="toolbar-left">
                <div class="search-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input type="text" id="adultResSearchInput" value="${escapeHtml(adultResSearchQuery)}" placeholder="선수명, 소속팀, 경기번호(#1, #3-1) 검색..." autocomplete="off">
                </div>

                <div class="filter-group">
                  <select id="adultResStrokeSelect" class="filter-select" aria-label="성인부 종목 필터">
                    <option value="all" ${adultResStrokeFilter === "all" ? "selected" : ""}>전체 종목</option>
                    <option value="핀접영" ${adultResStrokeFilter === "핀접영" ? "selected" : ""}>핀접영 50m</option>
                    <option value="배영" ${adultResStrokeFilter === "배영" ? "selected" : ""}>배영 50m</option>
                    <option value="접영" ${adultResStrokeFilter === "접영" ? "selected" : ""}>접영 50m</option>
                    <option value="핀자유형" ${adultResStrokeFilter === "핀자유형" ? "selected" : ""}>핀자유형 50m</option>
                    <option value="평영" ${adultResStrokeFilter === "평영" ? "selected" : ""}>평영 50m</option>
                    <option value="자유형" ${adultResStrokeFilter === "자유형" ? "selected" : ""}>자유형 50m</option>
                    <option value="RELAY_ALL" ${adultResStrokeFilter === "RELAY_ALL" ? "selected" : ""}>단체전 전체 (계영·혼계영·핀계영)</option>
                  </select>
                </div>

                <div class="filter-group">
                  <select id="adultResGroupSelect" class="filter-select" aria-label="성인부 그룹 필터">
                    <option value="all" ${adultResGroupFilter === "all" ? "selected" : ""}>모든 그룹</option>
                    ${ADULT_GROUPS.map(g => `<option value="${g}" ${adultResGroupFilter === g ? "selected" : ""}>${g}</option>`).join("")}
                    <option value="단체" ${adultResGroupFilter === "단체" ? "selected" : ""}>단체전</option>
                  </select>
                </div>

                <div class="filter-group">
                  <select id="adultResGenderSelect" class="filter-select" aria-label="성인부 성별 필터">
                    <option value="all" ${adultResGenderFilter === "all" ? "selected" : ""}>전체 성별</option>
                    <option value="남자" ${adultResGenderFilter === "남자" ? "selected" : ""}>남자</option>
                    <option value="여자" ${adultResGenderFilter === "여자" ? "selected" : ""}>여자</option>
                    <option value="혼성" ${adultResGenderFilter === "혼성" ? "selected" : ""}>혼성</option>
                  </select>
                </div>

                <div class="filter-group">
                  <select id="adultResTeamSelect" class="filter-select" aria-label="성인부 소속팀 필터">
                    <option value="all" ${adultResTeamFilter === "all" ? "selected" : ""}>모든 소속팀</option>
                    <option value="OUR_ALL" ${adultResTeamFilter === "OUR_ALL" ? "selected" : ""}>🏊 우리팀 전체 (거제몽꾸 + 거제야르)</option>
                    <option value="거제몽꾸" ${adultResTeamFilter === "거제몽꾸" ? "selected" : ""}>🟠 거제몽꾸</option>
                    <option value="거제야르" ${adultResTeamFilter === "거제야르" ? "selected" : ""}>🔵 거제야르</option>
                    ${allTeamNames.filter(t => !OUR_TEAMS.has(t)).map(t => `<option value="${escapeHtml(t)}" ${adultResTeamFilter === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}
                  </select>
                </div>

                <div class="filter-group">
                  <select id="adultResStatusSelect" class="filter-select" aria-label="성인부 입력 상태 필터">
                    <option value="all" ${adultResStatusFilter === "all" ? "selected" : ""}>전체 엔트리 (492건)</option>
                    <option value="top6" ${adultResStatusFilter === "top6" ? "selected" : ""}>🏅 1~6위 입상(득점)자만</option>
                    <option value="medal" ${adultResStatusFilter === "medal" ? "selected" : ""}>🥇🥈🥉 1~3위 메달리스트만</option>
                    <option value="dq_dns" ${adultResStatusFilter === "dq_dns" ? "selected" : ""}>⚠️ 실격 · 불참만</option>
                  </select>
                </div>

                <div class="filter-group">
                  <select id="adultResSortSelect" class="filter-select" aria-label="성인부 정렬 방식">
                    <option value="default" ${adultResRecordSortMode === "default" ? "selected" : ""}>정렬: 경기번호순 (기본)</option>
                    <option value="record_asc" ${adultResRecordSortMode === "record_asc" ? "selected" : ""}>⏱️ 기록 오름차순 (빠른순 ▲)</option>
                    <option value="record_desc" ${adultResRecordSortMode === "record_desc" ? "selected" : ""}>⏱️ 기록 내림차순 (느린순 ▼)</option>
                  </select>
                </div>
              </div>
            </section>

            <div class="records-db-mobile-modal-footer">
              <button type="button" class="btn-close-records-modal-mobile" id="btnCloseRecordsDbModalMobile">▲ 필터·열설정 닫기</button>
            </div>
          </div>
        </div>

        <div class="table-responsive records-db-table-scroll" id="recordsDbTableScroll">
          <table class="record-table">
            <thead id="adultResultScheduleTableHead"></thead>
            <tbody id="adultResultScheduleTableBody"></tbody>
          </table>
        </div>
      </section>
    `;

    renderAdultScheduleTableRows();
    requestAnimationFrame(() => syncRecordsDbStickyOffset());
    return;
  }

  // 학생부 기록지DB (843건)
  const uniqueGroups = [...new Set(VERIFIED_SHEET_RESULTS.map(r => `${r.gender} ${r.group}`))];
  const uniqueTeams = [...new Set(VERIFIED_SHEET_RESULTS.map(r => r.team.replace("(중등)", "").trim()))].sort((a, b) => a.localeCompare(b, "ko"));

  const colToggleChipsHtml = RAW_SHEET_COLUMNS.map(col => {
    const isChecked = visibleRawSheetCols.has(col.key);
    return `
      <label class="col-toggle-chip ${isChecked ? "is-checked" : ""}">
        <input type="checkbox" data-raw-col-key="${col.key}" ${isChecked ? "checked" : ""}>
        <span>${escapeHtml(col.label)}</span>
      </label>
    `;
  }).join("");

  container.innerHTML = `
    <section class="records-db-page-section" id="studentRawSheetSection">
      <div class="records-db-sticky-shell" id="recordsDbStickyShell">
        <div class="records-db-header-bar">
          <div class="records-db-title-wrap">
            <h3 id="verifiedSheetTableTitle">📄 학생부 공식 기록지 원문 전체 데이터 조회 (843건 표시 중 / 전체 843건)</h3>
            <span class="comp-breadcrumb-badge">대회결과 &gt; 학생부 &gt; 기록지DB</span>
          </div>
          <div class="records-db-header-actions">
            <button type="button" class="btn-toggle-records-modal ${isRecordsDbModalOpen ? "is-open" : ""}" id="btnToggleRecordsDbModal" aria-expanded="${isRecordsDbModalOpen}">
              <span class="toggle-icon">🎛️</span>
              <span class="toggle-text">${isRecordsDbModalOpen ? "필터·열설정 닫기 ▲" : "필터·열설정 열기 ▼"}</span>
            </button>
          </div>
        </div>

        <div class="records-db-controls-modal ${isRecordsDbModalOpen ? "" : "is-collapsed"}" id="recordsDbControlsModal">
          <div class="col-toggle-bar" id="rawSheetColToggleBar">
            <div class="col-toggle-left">
              <span class="col-toggle-label">☑️ 표시 열 항목:</span>
              ${colToggleChipsHtml}
            </div>
            <div class="col-toggle-presets">
              <button type="button" class="col-preset-btn ${rawSheetRecordSortMode !== "default" ? "is-active-sort" : ""}" id="btnRawSheetSortRecordAsc" title="빠른 기록(오름차순)으로 정렬">${getRecordSortButtonLabel(rawSheetRecordSortMode)}</button>
              <button type="button" class="col-preset-btn" data-col-preset="all">전체 열 표시</button>
              <button type="button" class="col-preset-btn" data-col-preset="compact">핵심 열만 (모바일 추천)</button>
            </div>
          </div>

          <section class="toolbar">
            <div class="toolbar-left">
              <div class="search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="rawSheetSearchInput" placeholder="선수 이름, 소속팀, 경기번호(예: 45-2) 검색..." autocomplete="off" value="${escapeHtml(rawSheetSearchQuery)}">
              </div>

              <div class="filter-group">
                <select id="rawSheetStrokeSelect" class="filter-select" aria-label="기록지 종목 필터">
                  <option value="all" ${rawSheetStrokeFilter === "all" ? "selected" : ""}>전체 종목 (6종목)</option>
                  <option value="계영 200m" ${rawSheetStrokeFilter === "계영 200m" ? "selected" : ""}>계영 200m (단체)</option>
                  <option value="접영" ${rawSheetStrokeFilter === "접영" ? "selected" : ""}>접영 50m</option>
                  <option value="배영" ${rawSheetStrokeFilter === "배영" ? "selected" : ""}>배영 50m</option>
                  <option value="평영" ${rawSheetStrokeFilter === "평영" ? "selected" : ""}>평영 50m</option>
                  <option value="자유형" ${rawSheetStrokeFilter === "자유형" ? "selected" : ""}>자유형 50m</option>
                  <option value="혼계영 200m" ${rawSheetStrokeFilter === "혼계영 200m" ? "selected" : ""}>혼계영 200m (단체)</option>
                </select>
              </div>

              <div class="filter-group">
                <select id="rawSheetGroupSelect" class="filter-select" aria-label="기록지 그룹 필터">
                  <option value="all" ${rawSheetGroupFilter === "all" ? "selected" : ""}>모든 성별·그룹</option>
                  ${uniqueGroups.map(g => `<option value="${escapeHtml(g)}" ${rawSheetGroupFilter === g ? "selected" : ""}>${escapeHtml(g)}</option>`).join("")}
                </select>
              </div>

              <div class="filter-group">
                <select id="rawSheetTeamSelect" class="filter-select" aria-label="기록지 소속팀 필터">
                  <option value="all" ${rawSheetTeamFilter === "all" ? "selected" : ""}>모든 소속팀</option>
                  <option value="거제야르" ${rawSheetTeamFilter === "거제야르" ? "selected" : ""}>🏊 거제야르 (우리팀)</option>
                  ${uniqueTeams.filter(t => t !== "거제야르").map(t => `<option value="${escapeHtml(t)}" ${rawSheetTeamFilter === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}
                </select>
              </div>

              <div class="filter-group">
                <select id="rawSheetRankSelect" class="filter-select" aria-label="기록지 순위 필터">
                  <option value="all" ${rawSheetRankFilter === "all" ? "selected" : ""}>전체 순위 결과</option>
                  <option value="top6" ${rawSheetRankFilter === "top6" ? "selected" : ""}>🏅 1~6위 입상(득점)자만</option>
                  <option value="medal" ${rawSheetRankFilter === "medal" ? "selected" : ""}>🥇🥈🥉 1~3위 메달리스트만</option>
                  <option value="dq_dns" ${rawSheetRankFilter === "dq_dns" ? "selected" : ""}>⚠️ 실격 · 불참만</option>
                </select>
              </div>

              <div class="filter-group">
                <select id="rawSheetSortSelect" class="filter-select" aria-label="기록지 정렬 방식">
                  <option value="default" ${rawSheetRecordSortMode === "default" ? "selected" : ""}>정렬: 경기번호순 (기본)</option>
                  <option value="record_asc" ${rawSheetRecordSortMode === "record_asc" ? "selected" : ""}>⏱️ 기록 오름차순 (빠른순 ▲)</option>
                  <option value="record_desc" ${rawSheetRecordSortMode === "record_desc" ? "selected" : ""}>⏱️ 기록 내림차순 (느린순 ▼)</option>
                </select>
              </div>
            </div>
          </section>

          <div class="records-db-mobile-modal-footer">
            <button type="button" class="btn-close-records-modal-mobile" id="btnCloseRecordsDbModalMobile">▲ 필터·열설정 닫기</button>
          </div>
        </div>
      </div>

      <div class="table-responsive records-db-table-scroll" id="recordsDbTableScroll">
        <table class="record-table">
          <thead id="verifiedSheetTableHead"></thead>
          <tbody id="verifiedSheetTableBody"></tbody>
        </table>
      </div>
    </section>
  `;

  renderAllVerifiedSheetRows();
  requestAnimationFrame(() => syncRecordsDbStickyOffset());
}

function renderAll() {
  if (currentSubTab !== "result") {
    stopAdultPlayback();
    stopStudentPlayback();
  }
  renderTopNavigationHeader();

  if (currentSubTab === "entry") {
    renderEntryTeamChipsAndToolbar();
    renderSummaryChart();
    renderSummaryMatrices();
    renderTeamPowerComparisonTable();
    renderSwimmersDetailTable();
  } else if (currentSubTab === "progress") {
    renderProgressSummaryView();
  } else if (currentSubTab === "result") {
    renderResultAnalysisView();
  } else if (currentSubTab === "records") {
    renderRecordsDbView();
  }
  updateCompFloatingStrokeBar();
}

function bindEvents() {
  window.addEventListener("resize", () => {
    syncRecordsDbStickyOffset();
  });

  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "GMDC_COMP_RESULT_NAV") {
      const nextDiv = e.data.div === "adult" ? "adult" : "student";
      const nextTab = ["entry", "progress", "result", "records"].includes(e.data.tab) ? e.data.tab : "entry";
      if (nextDiv !== currentDivision) {
        selectedTeamFilter = "all";
        selectedGroupFilter = "all";
        selectedStrokeFilter = "all";
      }
      currentDivision = nextDiv;
      currentSubTab = nextTab;
      renderAll();
    }
  });

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

  document.getElementById("teamFilterChips")?.addEventListener("click", (e) => {
    const chip = e.target.closest(".team-power-chip");
    if (!chip) return;
    selectedTeamFilter = chip.dataset.teamFilter || "all";
    renderAll();
  });

  document.getElementById("teamPowerTableBody")?.addEventListener("click", (e) => {
    const row = e.target.closest(".team-power-row");
    if (!row) return;
    const teamName = row.dataset.teamRow;
    if (!teamName) return;
    selectedTeamFilter = selectedTeamFilter === teamName ? "all" : teamName;
    renderAll();
  });

  document.getElementById("compSwimmersTableBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-team-filter-click]");
    if (!btn) return;
    const teamName = btn.dataset.teamFilterClick;
    if (!teamName) return;
    selectedTeamFilter = selectedTeamFilter === teamName ? "all" : teamName;
    renderAll();
  });

  const btnTogglePower = document.getElementById("btnToggleTeamPowerTable");
  const powerWrap = document.getElementById("teamPowerTableWrap");
  if (btnTogglePower && powerWrap) {
    btnTogglePower.addEventListener("click", () => {
      const isHidden = powerWrap.style.display === "none";
      powerWrap.style.display = isHidden ? "block" : "none";
      btnTogglePower.textContent = isHidden ? "▲ 표 접기" : "▼ 표 펼치기";
    });
  }

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

  document.getElementById("compSearchInput")?.addEventListener("input", (e) => {
    searchQuery = e.target.value || "";
    renderSwimmersDetailTable();
  });

  // 결과 분석 (TAB 3) & 기록지DB (TAB 4) 내부 이벤트 위임
  const bindDynamicContainerEvents = (resultContainer) => {
    if (!resultContainer) return;
    resultContainer.addEventListener("click", (e) => {
      if (e.target.closest("#btnToggleRecordsDbModal")) {
        isRecordsDbModalOpen = !isRecordsDbModalOpen;
        updateRecordsDbModalToggleDOM();
        return;
      }
      if (e.target.closest("#btnCloseRecordsDbModalMobile")) {
        isRecordsDbModalOpen = false;
        updateRecordsDbModalToggleDOM();
        return;
      }
    const filterBtn = e.target.closest("[data-our-filter]");
    if (filterBtn) {
      ourTeamResultFilterMode = filterBtn.dataset.ourFilter || "all";
      resultContainer.querySelectorAll("[data-our-filter]").forEach(b => {
        b.classList.toggle("active", b.dataset.ourFilter === ourTeamResultFilterMode);
      });
      renderOurTeamResultRows();
      return;
    }

    const adultPodiumBtn = e.target.closest("[data-adult-podium-filter]");
    if (adultPodiumBtn) {
      adultPodiumFilterMode = adultPodiumBtn.dataset.adultPodiumFilter || "medal";
      resultContainer.querySelectorAll("[data-adult-podium-filter]").forEach(b => {
        b.classList.toggle("active", b.dataset.adultPodiumFilter === adultPodiumFilterMode);
      });
      renderAdultPodiumCardsDOM();
      return;
    }

    const adultOurBtn = e.target.closest("[data-adult-our-filter]");
    if (adultOurBtn) {
      adultOurTableFilterMode = adultOurBtn.dataset.adultOurFilter || "all";
      resultContainer.querySelectorAll("[data-adult-our-filter]").forEach(b => {
        b.classList.toggle("active", b.dataset.adultOurFilter === adultOurTableFilterMode);
      });
      renderOurTeamResultRows();
      return;
    }

    if (e.target.closest("[data-our-record-sort-th]") || e.target.closest("#btnOurTeamSortRecordAsc")) {
      ourTeamRecordSortMode = cycleRecordSortMode(ourTeamRecordSortMode);
      renderOurTeamResultRows();
      return;
    }

    if (e.target.closest("[data-raw-record-sort-th]") || e.target.closest("#btnRawSheetSortRecordAsc")) {
      rawSheetRecordSortMode = cycleRecordSortMode(rawSheetRecordSortMode);
      renderAllVerifiedSheetRows();
      return;
    }

    if (e.target.closest("[data-adult-record-sort-th]") || e.target.closest("#btnAdultResSortRecordAsc")) {
      adultResRecordSortMode = cycleRecordSortMode(adultResRecordSortMode);
      renderAdultScheduleTableRows();
      return;
    }

    const ourPresetBtn = e.target.closest("[data-our-col-preset]");
    if (ourPresetBtn) {
      const preset = ourPresetBtn.dataset.ourColPreset;
      if (preset === "compact") {
        visibleOurTeamCols = new Set(["stroke", "group", "name", "team", "record", "rank", "points"]);
      } else {
        visibleOurTeamCols = new Set(OUR_TEAM_COLUMNS.map(c => c.key));
      }
      resultContainer.querySelectorAll("input[data-our-col-key]").forEach(chk => {
        const key = chk.dataset.ourColKey;
        const checked = visibleOurTeamCols.has(key);
        chk.checked = checked;
        chk.closest(".col-toggle-chip")?.classList.toggle("is-checked", checked);
      });
      renderOurTeamResultRows();
      return;
    }

    // 학생부 재생 컨트롤
    if (e.target.closest("#btnStudentPlaybackToggle")) {
      if (isStudentPlaybackRunning) {
        stopStudentPlayback();
      } else {
        startStudentPlayback();
      }
      return;
    }

    if (e.target.closest("#btnStudentPlaybackReset")) {
      stopStudentPlayback();
      studentPlaybackRaceIndex = 0;
      studentPlaybackProgress = 0;
      renderStudentStandingsAndChartForCurrentStep();
      updateStudentPlaybackControlsDOM();
      return;
    }

    if (e.target.closest("#btnStudentPlaybackPrev")) {
      stopStudentPlayback();
      studentPlaybackRaceIndex = Math.max(0, studentPlaybackRaceIndex - 1);
      studentPlaybackProgress = studentPlaybackRaceIndex;
      renderStudentStandingsAndChartForCurrentStep();
      updateStudentPlaybackControlsDOM();
      return;
    }

    if (e.target.closest("#btnStudentPlaybackNext")) {
      stopStudentPlayback();
      studentPlaybackRaceIndex = Math.min(STUDENT_TOTAL_RACES, studentPlaybackRaceIndex + 1);
      studentPlaybackProgress = studentPlaybackRaceIndex;
      renderStudentStandingsAndChartForCurrentStep();
      updateStudentPlaybackControlsDOM();
      return;
    }

    if (e.target.closest("#btnStudentPlaybackEnd")) {
      stopStudentPlayback();
      studentPlaybackRaceIndex = STUDENT_TOTAL_RACES;
      studentPlaybackProgress = STUDENT_TOTAL_RACES;
      renderStudentStandingsAndChartForCurrentStep();
      updateStudentPlaybackControlsDOM();
      return;
    }

    if (e.target.closest("#btnStudentDownloadMp4")) {
      exportStandingsAnimationMp4("student");
      return;
    }

    const studentVbarCol = e.target.closest("[data-student-vbar-team]");
    if (studentVbarCol) {
      const clickedTeam = studentVbarCol.dataset.studentVbarTeam;
      if (clickedTeam) {
        rawSheetTeamFilter = rawSheetTeamFilter === clickedTeam ? "all" : clickedTeam;
        const teamSel = document.getElementById("rawSheetTeamSelect");
        if (teamSel) teamSel.value = rawSheetTeamFilter;
        renderStudentStandingsAndChartForCurrentStep();
        renderAllVerifiedSheetRows();
      }
      return;
    }

    // 성인부 재생 컨트롤
    if (e.target.closest("#btnAdultPlaybackToggle")) {
      if (isAdultPlaybackRunning) {
        stopAdultPlayback();
      } else {
        startAdultPlayback();
      }
      return;
    }

    if (e.target.closest("#btnAdultPlaybackReset")) {
      stopAdultPlayback();
      adultPlaybackRaceIndex = 0;
      adultPlaybackProgress = 0;
      renderAdultStandingsAndChartForCurrentStep();
      updateAdultPlaybackControlsDOM();
      return;
    }

    if (e.target.closest("#btnAdultPlaybackPrev")) {
      stopAdultPlayback();
      adultPlaybackRaceIndex = Math.max(0, adultPlaybackRaceIndex - 1);
      adultPlaybackProgress = adultPlaybackRaceIndex;
      renderAdultStandingsAndChartForCurrentStep();
      updateAdultPlaybackControlsDOM();
      return;
    }

    if (e.target.closest("#btnAdultPlaybackNext")) {
      stopAdultPlayback();
      adultPlaybackRaceIndex = Math.min(ADULT_TOTAL_RACES, adultPlaybackRaceIndex + 1);
      adultPlaybackProgress = adultPlaybackRaceIndex;
      renderAdultStandingsAndChartForCurrentStep();
      updateAdultPlaybackControlsDOM();
      return;
    }

    if (e.target.closest("#btnAdultPlaybackEnd")) {
      stopAdultPlayback();
      adultPlaybackRaceIndex = ADULT_TOTAL_RACES;
      adultPlaybackProgress = ADULT_TOTAL_RACES;
      renderAdultStandingsAndChartForCurrentStep();
      updateAdultPlaybackControlsDOM();
      return;
    }

    if (e.target.closest("#btnAdultDownloadMp4")) {
      exportStandingsAnimationMp4("adult");
      return;
    }

    if (e.target.closest("#btnResetAdultOfficialRecords")) {
      adultResultInputs = buildDefaultAdultInputsClone();
      saveAdultResultsToLocal();
      renderAdultScheduleTableRows();
      return;
    }

    const adultVbarCol = e.target.closest("[data-adult-vbar-team]");
    if (adultVbarCol) {
      const clickedTeam = adultVbarCol.dataset.adultVbarTeam;
      if (clickedTeam) {
        adultResTeamFilter = adultResTeamFilter === clickedTeam ? "all" : clickedTeam;
        const teamSel = document.getElementById("adultResTeamSelect");
        if (teamSel) teamSel.value = adultResTeamFilter;
        renderAdultScheduleTableRows();
      }
      return;
    }

    const adultPresetBtn = e.target.closest("[data-adult-col-preset]");
    if (adultPresetBtn) {
      const preset = adultPresetBtn.dataset.adultColPreset;
      if (preset === "compact") {
        visibleAdultResultCols = new Set(["stroke", "group", "name", "team", "sec", "rank", "points"]);
      } else {
        visibleAdultResultCols = new Set(ADULT_RESULT_COLUMNS.map(c => c.key));
      }
      resultContainer.querySelectorAll("input[data-adult-col-key]").forEach(chk => {
        const key = chk.dataset.adultColKey;
        const checked = visibleAdultResultCols.has(key);
        chk.checked = checked;
        chk.closest(".col-toggle-chip")?.classList.toggle("is-checked", checked);
      });
      renderAdultScheduleTableRows();
      return;
    }

    const presetBtn = e.target.closest("[data-col-preset]");
    if (presetBtn) {
      const preset = presetBtn.dataset.colPreset;
      if (preset === "compact") {
        visibleRawSheetCols = new Set(["stroke", "group", "name", "team", "record", "rank"]);
      } else {
        visibleRawSheetCols = new Set(RAW_SHEET_COLUMNS.map(c => c.key));
      }
      resultContainer.querySelectorAll("input[data-raw-col-key]").forEach(chk => {
        const key = chk.dataset.rawColKey;
        const checked = visibleRawSheetCols.has(key);
        chk.checked = checked;
        chk.closest(".col-toggle-chip")?.classList.toggle("is-checked", checked);
      });
      renderAllVerifiedSheetRows();
    }
  });

  resultContainer?.addEventListener("change", (e) => {
    const adultColKey = e.target.dataset?.adultColKey;
    if (adultColKey) {
      if (e.target.checked) {
        visibleAdultResultCols.add(adultColKey);
      } else {
        if (visibleAdultResultCols.size <= 1) {
          e.target.checked = true;
          return;
        }
        visibleAdultResultCols.delete(adultColKey);
      }
      e.target.closest(".col-toggle-chip")?.classList.toggle("is-checked", e.target.checked);
      renderAdultScheduleTableRows();
      return;
    }

    const ourColKey = e.target.dataset?.ourColKey;
    if (ourColKey) {
      if (e.target.checked) {
        visibleOurTeamCols.add(ourColKey);
      } else {
        if (visibleOurTeamCols.size <= 1) {
          e.target.checked = true;
          return;
        }
        visibleOurTeamCols.delete(ourColKey);
      }
      e.target.closest(".col-toggle-chip")?.classList.toggle("is-checked", e.target.checked);
      renderOurTeamResultRows();
      return;
    }

    const colKey = e.target.dataset?.rawColKey;
    if (colKey) {
      if (e.target.checked) {
        visibleRawSheetCols.add(colKey);
      } else {
        if (visibleRawSheetCols.size <= 1) {
          e.target.checked = true;
          return;
        }
        visibleRawSheetCols.delete(colKey);
      }
      e.target.closest(".col-toggle-chip")?.classList.toggle("is-checked", e.target.checked);
      renderAllVerifiedSheetRows();
      return;
    }

    const id = e.target.id;
    if (id === "rawSheetStrokeSelect") {
      rawSheetStrokeFilter = e.target.value;
      renderAllVerifiedSheetRows();
    } else if (id === "rawSheetGroupSelect") {
      rawSheetGroupFilter = e.target.value;
      renderAllVerifiedSheetRows();
    } else if (id === "rawSheetTeamSelect") {
      rawSheetTeamFilter = e.target.value;
      renderStudentStandingsAndChartForCurrentStep();
      renderAllVerifiedSheetRows();
    } else if (id === "rawSheetRankSelect") {
      rawSheetRankFilter = e.target.value;
      renderAllVerifiedSheetRows();
    } else if (id === "rawSheetSortSelect") {
      rawSheetRecordSortMode = e.target.value || "default";
      renderAllVerifiedSheetRows();
    } else if (id === "adultResStrokeSelect") {
      adultResStrokeFilter = e.target.value;
      renderAdultScheduleTableRows();
    } else if (id === "adultResGroupSelect") {
      adultResGroupFilter = e.target.value;
      renderAdultScheduleTableRows();
    } else if (id === "adultResGenderSelect") {
      adultResGenderFilter = e.target.value;
      renderAdultScheduleTableRows();
    } else if (id === "adultResTeamSelect") {
      adultResTeamFilter = e.target.value;
      renderAdultScheduleTableRows();
    } else if (id === "adultResStatusSelect") {
      adultResStatusFilter = e.target.value;
      renderAdultScheduleTableRows();
    } else if (id === "adultResSortSelect") {
      adultResRecordSortMode = e.target.value || "default";
      renderAdultScheduleTableRows();
    }
  });

  resultContainer?.addEventListener("input", (e) => {
    const secKey = e.target.dataset?.adultSec;
    if (secKey) {
      const prev = adultResultInputs[secKey] || { sec: "", note: "" };
      adultResultInputs[secKey] = {
        sec: e.target.value,
        note: String(prev.note ?? ""),
        updatedAt: Date.now()
      };
      dirtyAdultEntryKeys.add(secKey);
      saveAdultResultsToLocal();
      recalculateAndPatchAdultResultsDOM();
      scheduleAdultResultsFirestoreSync();
      return;
    }

    const noteKey = e.target.dataset?.adultNote;
    if (noteKey) {
      const prev = adultResultInputs[noteKey] || { sec: "", note: "" };
      adultResultInputs[noteKey] = {
        sec: String(prev.sec ?? ""),
        note: e.target.value,
        updatedAt: Date.now()
      };
      dirtyAdultEntryKeys.add(noteKey);
      saveAdultResultsToLocal();
      recalculateAndPatchAdultResultsDOM();
      scheduleAdultResultsFirestoreSync();
      return;
    }

    if (e.target.id === "studentPlaybackSlider") {
      stopStudentPlayback();
      const val = Number(e.target.value);
      studentPlaybackRaceIndex = Number.isFinite(val) ? val : STUDENT_TOTAL_RACES;
      studentPlaybackProgress = studentPlaybackRaceIndex;
      renderStudentStandingsAndChartForCurrentStep();
      updateStudentPlaybackControlsDOM();
      return;
    }

    if (e.target.id === "adultPlaybackSlider") {
      stopAdultPlayback();
      const val = Number(e.target.value);
      adultPlaybackRaceIndex = Number.isFinite(val) ? val : ADULT_TOTAL_RACES;
      adultPlaybackProgress = adultPlaybackRaceIndex;
      renderAdultStandingsAndChartForCurrentStep();
      updateAdultPlaybackControlsDOM();
      return;
    }

    if (e.target.id === "rawSheetSearchInput") {
      rawSheetSearchQuery = e.target.value || "";
      renderAllVerifiedSheetRows();
    } else if (e.target.id === "adultResSearchInput") {
      adultResSearchQuery = e.target.value || "";
      renderAdultScheduleTableRows();
    }
  });

  resultContainer?.addEventListener("keydown", (e) => {
    const isSecInput = Boolean(e.target.dataset?.adultSec);
    const isNoteInput = Boolean(e.target.dataset?.adultNote);
    if (!isSecInput && !isNoteInput) return;

    if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const selector = isSecInput ? "input[data-adult-sec]" : "input[data-adult-note]";
      const inputs = [...resultContainer.querySelectorAll(selector)];
      const currIdx = inputs.indexOf(e.target);
      if (currIdx === -1) return;
      const nextIdx = e.key === "ArrowUp" ? currIdx - 1 : currIdx + 1;
      if (nextIdx >= 0 && nextIdx < inputs.length) {
        inputs[nextIdx].focus();
        inputs[nextIdx].select?.();
      }
    }
  });
  };

  bindDynamicContainerEvents(document.getElementById("viewContainerResult"));
  bindDynamicContainerEvents(document.getElementById("viewContainerRecords"));
}

function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const divParam = params.get("div");
  const tabParam = params.get("tab");

  if (divParam === "adult" || divParam === "student") {
    currentDivision = divParam;
  } else {
    currentDivision = "student";
  }

  if (["entry", "progress", "result", "records"].includes(tabParam)) {
    currentSubTab = tabParam;
  } else {
    currentSubTab = "entry";
  }
}

// ==========================================================================
// 🧭 하단 플로팅 종목 진행 순서 바 (스크롤 감지 표시 + 현재 종목 하이라이트 + 닫기)
// 성인부(25일) 공식 9개 종목 순서:
//   [핀접] - [배영] - [계영] - [접영] - [핀자] - [평영] - [혼계영] - [자유형] - [혼성핀]
// 학생부(24일) 공식 7개 종목 순서:
//   [핀자] - [접영] - [배영] - [계영] - [평영] - [혼계영] - [자유형]
// ==========================================================================
const COMP_DIVISION_STROKE_STEPS = {
  adult: [
    { key: "핀접",   fullLabel: "핀접영 50m",        matchKey: "핀접영",          rangeLabel: "#1~#20 (경기 1~10-2)",     startRaceIdx: 1 },
    { key: "배영",   fullLabel: "배영 50m",          matchKey: "배영",            rangeLabel: "#21~#35 (경기 11~20-3)",   startRaceIdx: 21 },
    { key: "계영",   fullLabel: "계영 200m",         matchKey: "계영 200m",       rangeLabel: "#36~#39 (경기 21-1~22-2)", startRaceIdx: 36 },
    { key: "접영",   fullLabel: "접영 50m",          matchKey: "접영",            rangeLabel: "#40~#59 (경기 23~33-2)",   startRaceIdx: 40 },
    { key: "핀자",   fullLabel: "핀자유형 50m",      matchKey: "핀자유형",        rangeLabel: "#60~#83 (경기 34~43-3)",   startRaceIdx: 60 },
    { key: "평영",   fullLabel: "평영 50m",          matchKey: "평영",            rangeLabel: "#84~#105 (경기 44~55-3)",  startRaceIdx: 84 },
    { key: "혼계영", fullLabel: "혼계영 200m",       matchKey: "혼계영 200m",     rangeLabel: "#106~#109 (경기 56-1~57-2)", startRaceIdx: 106 },
    { key: "자유형", fullLabel: "자유형 50m",        matchKey: "자유형",          rangeLabel: "#110~#139 (경기 58~68)",   startRaceIdx: 110 },
    { key: "혼성핀", fullLabel: "혼성 핀계영 300m",  matchKey: "혼성 핀계영 300m", rangeLabel: "#140~#141 (경기 69-1~69-2)", startRaceIdx: 140 }
  ],
  student: [
    { key: "핀자",   fullLabel: "핀자유형 50m",      matchKey: "핀자유형",        rangeLabel: "#1~#3 (경기 1~3)",         startRaceIdx: 1 },
    { key: "접영",   fullLabel: "접영 50m",          matchKey: "접영",            rangeLabel: "#4~#45 (경기 4~36)",       startRaceIdx: 4 },
    { key: "배영",   fullLabel: "배영 50m",          matchKey: "배영",            rangeLabel: "#46~#98 (경기 37~77)",     startRaceIdx: 46 },
    { key: "계영",   fullLabel: "계영 200m",         matchKey: "계영 200m",       rangeLabel: "#99~#100 (경기 78~79)",    startRaceIdx: 99 },
    { key: "평영",   fullLabel: "평영 50m",          matchKey: "평영",            rangeLabel: "#101~#153 (경기 80~118)",  startRaceIdx: 101 },
    { key: "혼계영", fullLabel: "혼계영 200m",       matchKey: "혼계영 200m",     rangeLabel: "#154~#156 (경기 119~120)", startRaceIdx: 154 },
    { key: "자유형", fullLabel: "자유형 50m",        matchKey: "자유형",          rangeLabel: "#157~#232 (경기 121~162)", startRaceIdx: 157 }
  ]
};

let isCompFloatingStrokeBarVisible = false;
let lastCompDismissedScrollY = null;
let compFloatingScrollTicking = false;

function mapRawStrokeToStepKey(divKey, rawStroke) {
  const s = String(rawStroke || "").trim();
  if (!s) return null;
  if (s.includes("혼성") && s.includes("핀계영")) return "혼성핀";
  if (s.includes("혼계영")) return "혼계영";
  if (s.includes("계영")) return "계영";
  if (s.includes("핀접영") || s === "핀접") return "핀접";
  if (s.includes("핀자유형") || s === "핀자") return "핀자";
  if (s.includes("배영")) return "배영";
  if (s.includes("접영")) return "접영";
  if (s.includes("평영")) return "평영";
  if (s.includes("자유형")) return "자유형";
  const steps = COMP_DIVISION_STROKE_STEPS[divKey] || COMP_DIVISION_STROKE_STEPS.adult;
  const found = steps.find(st => st.key === s || st.matchKey === s);
  return found ? found.key : null;
}

function detectFocusedStrokeInCompViewport(divKey) {
  const rows = document.querySelectorAll("tr[data-row-stroke]");
  if (rows.length > 0) {
    const viewportMidY = window.innerHeight * 0.42;
    let bestRow = null;
    let bestDist = Infinity;
    for (const tr of rows) {
      const rect = tr.getBoundingClientRect();
      if (rect.height === 0) continue;
      if (rect.bottom < 60 || rect.top > window.innerHeight - 60) continue;
      const mid = (rect.top + rect.bottom) * 0.5;
      const dist = Math.abs(mid - viewportMidY);
      if (dist < bestDist) {
        bestDist = dist;
        bestRow = tr;
      }
    }
    if (bestRow) {
      const stepKey = mapRawStrokeToStepKey(divKey, bestRow.dataset.rowStroke);
      if (stepKey) {
        return {
          stepKey,
          matchNo: bestRow.dataset.rowMatch || ""
        };
      }
    }
  }

  // 표 행이 화면 중앙에 없을 때는 현재 재생 슬라이더 위치 또는 종목 필터 기준
  if (divKey === "adult") {
    if (adultResStrokeFilter && adultResStrokeFilter !== "all" && adultResStrokeFilter !== "RELAY_ALL") {
      const k = mapRawStrokeToStepKey("adult", adultResStrokeFilter);
      if (k) return { stepKey: k, matchNo: "" };
    }
    const rIdx = Math.max(1, Math.min(ADULT_TOTAL_RACES, adultPlaybackRaceIndex || 1));
    const race = ADULT_RACES_DATA[rIdx - 1];
    if (race) {
      const k = mapRawStrokeToStepKey("adult", race.title);
      if (k) return { stepKey: k, matchNo: race.primary_match_no || "" };
    }
  } else {
    if (rawSheetStrokeFilter && rawSheetStrokeFilter !== "all") {
      const k = mapRawStrokeToStepKey("student", rawSheetStrokeFilter);
      if (k) return { stepKey: k, matchNo: "" };
    }
    const rIdx = Math.max(1, Math.min(STUDENT_TOTAL_RACES, studentPlaybackRaceIndex || 1));
    const race = STUDENT_RACES_DATA[rIdx - 1];
    if (race) {
      const k = mapRawStrokeToStepKey("student", race.title);
      if (k) return { stepKey: k, matchNo: race.primary_match_no || "" };
    }
  }

  const steps = COMP_DIVISION_STROKE_STEPS[divKey] || COMP_DIVISION_STROKE_STEPS.adult;
  return { stepKey: steps[0].key, matchNo: "" };
}

function updateCompFloatingStrokeBar() {
  const barEl = document.getElementById("compFloatingStrokeBar");
  const stepsContainer = document.getElementById("compFloatingStrokeSteps");
  const labelEl = document.getElementById("compFloatingStrokeLabel");
  if (!barEl || !stepsContainer) return;

  const divKey = currentDivision === "adult" ? "adult" : "student";
  const steps = COMP_DIVISION_STROKE_STEPS[divKey] || COMP_DIVISION_STROKE_STEPS.adult;
  const { stepKey: activeStepKey, matchNo } = detectFocusedStrokeInCompViewport(divKey);
  const activeIdx = Math.max(0, steps.findIndex(s => s.key === activeStepKey));
  const activeStepObj = steps[activeIdx] || steps[0];

  if (labelEl) {
    const divTitle = divKey === "adult" ? "성인부(25일)" : "학생부(24일)";
    const subInfo = matchNo
      ? `현재 #${matchNo} (${activeStepObj.fullLabel})`
      : `${activeStepObj.fullLabel} (${activeStepObj.rangeLabel})`;
    labelEl.textContent = `🧭 ${divTitle} 전체 순서 (${activeIdx + 1}/${steps.length}) · ${subInfo}`;
  }

  stepsContainer.innerHTML = steps.map((st, idx) => {
    const isCurrent = st.key === activeStepKey;
    const isPast = idx < activeIdx;
    const cls = isCurrent ? "is-active" : (isPast ? "is-past" : "");
    const bracketText = isCurrent
      ? `[[${st.key}]★현재]`
      : `[${st.key}]`;
    const arrowHtml = idx < steps.length - 1
      ? `<span class="fsb-step-arrow">-</span>`
      : "";
    return `
      <button type="button" class="fsb-step-chip ${cls}" data-comp-fsb-stroke-idx="${idx}" title="${escapeHtml(st.fullLabel)} (${escapeHtml(st.rangeLabel)}) 구간으로 이동">
        ${escapeHtml(bracketText)}
      </button>${arrowHtml}
    `;
  }).join("");

  barEl.classList.toggle("is-visible", isCompFloatingStrokeBarVisible);

  const activeChip = stepsContainer.querySelector(".fsb-step-chip.is-active");
  if (activeChip && typeof activeChip.scrollIntoView === "function") {
    activeChip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
}

function getActiveCompScrollTop() {
  if (currentSubTab === "records") {
    const tblScroll = document.getElementById("recordsDbTableScroll");
    if (tblScroll && tblScroll.scrollTop > 0) return tblScroll.scrollTop;
  }
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function bindCompFloatingStrokeBarEvents() {
  window.addEventListener("scroll", () => {
    if (compFloatingScrollTicking) return;
    compFloatingScrollTicking = true;
    requestAnimationFrame(() => {
      compFloatingScrollTicking = false;
      const currY = getActiveCompScrollTop();
      if (!isCompFloatingStrokeBarVisible) {
        if (lastCompDismissedScrollY === null || Math.abs(currY - lastCompDismissedScrollY) > 36) {
          isCompFloatingStrokeBarVisible = true;
          lastCompDismissedScrollY = null;
        }
      }
      if (isCompFloatingStrokeBarVisible) {
        updateCompFloatingStrokeBar();
      }
    });
  }, { capture: true, passive: true });

  document.getElementById("btnCloseCompFloatingStrokeBar")?.addEventListener("click", () => {
    isCompFloatingStrokeBarVisible = false;
    lastCompDismissedScrollY = getActiveCompScrollTop();
    const barEl = document.getElementById("compFloatingStrokeBar");
    if (barEl) barEl.classList.remove("is-visible");
  });

  document.getElementById("compFloatingStrokeSteps")?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-comp-fsb-stroke-idx]");
    if (!chip) return;
    const divKey = currentDivision === "adult" ? "adult" : "student";
    const steps = COMP_DIVISION_STROKE_STEPS[divKey] || COMP_DIVISION_STROKE_STEPS.adult;
    const idx = Number(chip.dataset.compFsbStrokeIdx);
    const targetStep = steps[idx];
    if (!targetStep) return;

    if (currentSubTab !== "records" && currentSubTab !== "result") {
      currentSubTab = "records";
      renderAll();
      syncRouteWithParentAndUrl();
    }

    // 전체 종목 순서대로 스크롤 탐색할 수 있도록 종목 필터가 다른 종목에 잠겨 있으면 전체로 해제
    if (divKey === "adult" && adultResStrokeFilter !== "all") {
      adultResStrokeFilter = "all";
      const sel = document.getElementById("adultResStrokeSelect");
      if (sel) sel.value = "all";
      renderAdultScheduleTableRows();
    } else if (divKey === "student" && rawSheetStrokeFilter !== "all") {
      rawSheetStrokeFilter = "all";
      const sel = document.getElementById("rawSheetStrokeSelect");
      if (sel) sel.value = "all";
      renderAllVerifiedSheetRows();
    }

    const tableBodyId = currentSubTab === "result"
      ? "ourTeamResultTableBody"
      : (divKey === "adult" ? "adultResultScheduleTableBody" : "verifiedSheetTableBody");
    const tbody = document.getElementById(tableBodyId);
    if (tbody) {
      const rows = tbody.querySelectorAll("tr[data-row-stroke]");
      let matchedRow = null;
      for (const tr of rows) {
        if (mapRawStrokeToStepKey(divKey, tr.dataset.rowStroke) === targetStep.key) {
          matchedRow = tr;
          break;
        }
      }
      if (matchedRow) {
        matchedRow.scrollIntoView({ behavior: "smooth", block: "center" });
        matchedRow.style.transition = "background-color 0.4s ease";
        const origBg = matchedRow.style.backgroundColor;
        matchedRow.style.backgroundColor = "#fef08a";
        setTimeout(() => {
          matchedRow.style.backgroundColor = origBg;
        }, 1200);
      }
    }
    setTimeout(() => updateCompFloatingStrokeBar(), 350);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initFromUrl();
  bindEvents();
  bindCompFloatingStrokeBarEvents();
  renderAll();
  syncRouteWithParentAndUrl();
});
