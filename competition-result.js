// ==========================================================================
// GMDC Swim Club - 2026 거제시장배 전국마스터즈 수영대회 대회결과 통합 컨트롤러
// 구조: 대회결과 > [학생부 / 성인부] > [접수 분석 / 진행 요약 / 결과 분석]
// ==========================================================================

import { ADULT_RACES_DATA, STUDENT_RACES_DATA } from "./races-data.js?v=20261024_11";

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

  for (const tStat of teamStatsMap.values()) {
    groups.forEach(g => {
      tStat.groupCounts[g] = tStat.groupSwimmerKeys.get(g)?.size || 0;
    });
  }

  const swimmers = [...swimmerMap.values()].sort((a, b) => {
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
    result: "결과 분석"
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

  // 팀별 전력 필터 칩 박스는 '접수 분석' 페이지에서만 노출
  const entryFilterBox = document.getElementById("entryTeamFilterBox");
  if (entryFilterBox) {
    entryFilterBox.style.display = currentSubTab === "entry" ? "block" : "none";
  }

  const viewEntry = document.getElementById("viewContainerEntry");
  const viewProgress = document.getElementById("viewContainerProgress");
  const viewResult = document.getElementById("viewContainerResult");

  if (viewEntry) viewEntry.style.display = currentSubTab === "entry" ? "block" : "none";
  if (viewProgress) viewProgress.style.display = currentSubTab === "progress" ? "block" : "none";
  if (viewResult) viewResult.style.display = currentSubTab === "result" ? "block" : "none";
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

// ==========================================================================
// ⏱️ TAB 2: 진행 요약 (학생부: 2번, 4번, 5-2번, 5-3번 시각화·표 / 성인부: 추후 업데이트 예정)
// ==========================================================================
function renderProgressSummaryView() {
  const container = document.getElementById("viewContainerProgress");
  if (!container) return;

  if (currentDivision === "adult") {
    container.innerHTML = `
      <section class="pending-update-card">
        <span class="pending-icon">⏱️</span>
        <h3 class="pending-title">성인부 (25일) 진행 요약 — 추후 업데이트 예정</h3>
        <p class="pending-desc" style="margin-bottom: 0;">
          성인부 경기는 <strong>2026년 10월 25일(일) 08:30</strong>부터 진행됩니다.<br>
          전 경기 종료 후 실제 경기 타임라인, 영법별·그룹별·성별 평균 소요시간 분석 데이터가 이곳에 업데이트될 예정입니다.
        </p>
      </section>
    `;
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
    return `
      <tr>
        <td style="text-align:left; font-weight:800; color:#0f172a;">${escapeHtml(r.group)}</td>
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
              <td style="text-align:left; font-weight:800;"><span class="comp-ev-pill ev-pill-free">자유형 50m</span></td>
              <td style="text-align:center; font-weight:700;">78경기</td>
              <td style="text-align:center; font-weight:900; color:#1d4ed8;">01:24</td>
              <td style="text-align:center; font-weight:800;">83.9초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">다이빙 출발 + 가장 빠른 영법 (오후 여학생 #204~#226 23경기 순수 실측 평균 <strong>01:20 [79.8초]</strong>)</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#64748b;">2</td>
              <td style="text-align:left; font-weight:800;"><span class="comp-ev-pill ev-pill-breast">평영 50m</span></td>
              <td style="text-align:center; font-weight:700;">55경기</td>
              <td style="text-align:center; font-weight:900; color:#0f172a;">01:36</td>
              <td style="text-align:center; font-weight:800;">96.3초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">다이빙 출발이나 수영 자체 소요시간이 자유형·접영보다 약 10~12초 더 소요</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#64748b;">3</td>
              <td style="text-align:left; font-weight:800;"><span class="comp-ev-pill ev-pill-fly">접영 50m</span></td>
              <td style="text-align:center; font-weight:700;">40경기</td>
              <td style="text-align:center; font-weight:900; color:#0f172a;">01:38</td>
              <td style="text-align:center; font-weight:800;">98.3초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">오전 첫 개인전 종목(#7~#46)으로 진행 요원·선수 초반 적응 시간 포함</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:800; color:#be123c;">4 (개인전 최장)</td>
              <td style="text-align:left; font-weight:800;"><span class="comp-ev-pill ev-pill-back">배영 50m</span></td>
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
              <td style="text-align:center;"><span class="gender-badge male">남자</span></td>
              <td style="text-align:center; font-weight:800;">119경기</td>
              <td style="text-align:center; font-weight:700;">3시간 08분 15초 (11,295초)</td>
              <td style="text-align:center; font-weight:900; color:#0284c7;">01:35</td>
              <td style="text-align:center; font-weight:800;">94.9초</td>
              <td style="text-align:left; font-size:12.5px; color:#334155;">저학년(2·3그룹) 출전 비중이 소폭 높아 1.4초 차이 발생</td>
            </tr>
            <tr>
              <td style="text-align:center;"><span class="gender-badge female">여자</span></td>
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
// 🏅 TAB 3: 결과 분석 (학생부 / 성인부 공통: 추후 업데이트 예정 안내)
// ==========================================================================
function renderResultAnalysisView() {
  const container = document.getElementById("viewContainerResult");
  if (!container) return;

  const isStudent = currentDivision === "student";
  const divTitle = isStudent ? "학생부 (24일)" : "성인부 (25일)";

  container.innerHTML = `
    <section class="pending-update-card">
      <span class="pending-icon">🏅</span>
      <h3 class="pending-title">${divTitle} 결과 분석 — 추후 업데이트 예정</h3>
      <p class="pending-desc" style="margin-bottom: 0;">
        거제시수영연맹의 공식 대회 기록표(종목별 최종 기록, 순위, 대회신기록 및 종합 입상 집계)가 확정된 후<br>
        우리 팀(<strong>거제몽꾸 · 거제야르</strong>) 및 전체 참가팀의 결과 분석 데이터가 이곳에 업데이트될 예정입니다.
      </p>
    </section>
  `;
}

function renderAll() {
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
  }
}

function bindEvents() {
  // 부모(sidebar.js)에서 postMessage로 페이지 전환 요청 시 즉시 반영
  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "GMDC_COMP_RESULT_NAV") {
      const nextDiv = e.data.div === "adult" ? "adult" : "student";
      const nextTab = ["entry", "progress", "result"].includes(e.data.tab) ? e.data.tab : "entry";
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

  // 상단 팀 선택 칩 클릭
  document.getElementById("teamFilterChips")?.addEventListener("click", (e) => {
    const chip = e.target.closest(".team-power-chip");
    if (!chip) return;
    selectedTeamFilter = chip.dataset.teamFilter || "all";
    renderAll();
  });

  // 팀별 전력 비교표 행 클릭 시 해당 팀 토글 필터링
  document.getElementById("teamPowerTableBody")?.addEventListener("click", (e) => {
    const row = e.target.closest(".team-power-row");
    if (!row) return;
    const teamName = row.dataset.teamRow;
    if (!teamName) return;
    selectedTeamFilter = selectedTeamFilter === teamName ? "all" : teamName;
    renderAll();
  });

  // 선수 명단 내 소속팀 배지 클릭 시 해당 팀 필터링
  document.getElementById("compSwimmersTableBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-team-filter-click]");
    if (!btn) return;
    const teamName = btn.dataset.teamFilterClick;
    if (!teamName) return;
    selectedTeamFilter = selectedTeamFilter === teamName ? "all" : teamName;
    renderAll();
  });

  // 전력 비교표 접기/펼치기
  const btnTogglePower = document.getElementById("btnToggleTeamPowerTable");
  const powerWrap = document.getElementById("teamPowerTableWrap");
  if (btnTogglePower && powerWrap) {
    btnTogglePower.addEventListener("click", () => {
      const isHidden = powerWrap.style.display === "none";
      powerWrap.style.display = isHidden ? "block" : "none";
      btnTogglePower.textContent = isHidden ? "▲ 표 접기" : "▼ 표 펼치기";
    });
  }

  // 하단 툴바 필터링 이벤트
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

  if (["entry", "progress", "result"].includes(tabParam)) {
    currentSubTab = tabParam;
  } else {
    currentSubTab = "entry";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initFromUrl();
  bindEvents();
  renderAll();
  syncRouteWithParentAndUrl();
});
