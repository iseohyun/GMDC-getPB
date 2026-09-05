// ==========================================================================
// GMDC Swim Club - Roster Export Service (명단 내보내기 서비스)
// Handles formatted export to TXT, Excel (CSV with UTF-8 BOM), PDF, and Images (JPG/PNG).
// ==========================================================================

import { formatBirthDisplay, getSwimmerKey } from "./swimmerService.js";
import { ATTENDANCE_DATES } from "./constants.js";

// Image Export Constants
export const EXPORT_IMAGE_SCALE = 2;       // 2× high-resolution canvas
export const EXPORT_JPEG_QUALITY = 0.95;   // JPEG encoding quality (0–1)

/**
 * Exports currently filtered roster as formatted Text file (.txt)
 * @param {Object} params
 * @param {Array} params.list - Swimmer list
 * @param {'simple'|'detailed'} params.viewMode
 * @param {Object} params.attendanceMap
 * @param {Object} params.nearestDate
 * @param {Array} [params.attendanceDates]
 * @param {Function} [params.getSwimmerRelaysFn]
 * @param {Function} [params.showToast]
 */
export function exportRosterAsTxt({
  list = [],
  viewMode = 'simple',
  attendanceMap = {},
  nearestDate = { key: '2026-09-06', label: '09/06(일)', title: '1회차' },
  attendanceDates = ATTENDANCE_DATES,
  getSwimmerRelaysFn = () => [],
  showToast = () => {}
} = {}) {
  const nowStr = new Date().toLocaleString('ko-KR');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let lines = [];
  let fileName = '';

  if (viewMode === 'simple') {
    fileName = `GMDC_거제오션_훈련출석명단_간단히_${dateStr}.txt`;
    lines = [
      '========================================================================',
      '             GMDC 거제오션 2026 수영대회 훈련 출석부 (간단히)',
      `             출력일시: ${nowStr} | 총원: ${list.length}명`,
      `             기준 훈련일: ${nearestDate.label} (${nearestDate.title})`,
      '========================================================================',
      '순번 | 선수명       | 생년월일   | 출석 시간 (입력 시각)',
      '------------------------------------------------------------------------'
    ];

    list.forEach((s, idx) => {
      const key = getSwimmerKey(s);
      const att = attendanceMap[key] || {};
      const num = String(idx + 1).padStart(3, ' ');
      const name = (s.name || '').padEnd(8, ' ');
      const birth = formatBirthDisplay(s.birthId || s.birth).padEnd(10, ' ');
      const timeVal = att[nearestDate.key] || '-';

      lines.push(`${num}  | ${name} | ${birth} | ${timeVal}`);
    });

    lines.push('========================================================================');
    lines.push(`※ 훈련 장소: 거제 동부학생수영장 | 워밍업 06:30 ~ / 훈련 08:30 ~`);
  } else {
    // Detailed Mode
    fileName = `GMDC_거제오션_훈련출석명단_자세히_${dateStr}.txt`;
    const dateHeaders = attendanceDates.map(d => d.label.padEnd(5, ' ')).join(' | ');
    lines = [
      '========================================================================================',
      '                   GMDC 거제오션 2026 수영대회 훈련 출석부 (자세히)',
      `                   출력일시: ${nowStr} | 총원: ${list.length}명`,
      '========================================================================================',
      `순번 | 구분 | 소속팀 | 성명   | 생년월일 | 신청종목                     | ${dateHeaders}`,
      '----------------------------------------------------------------------------------------'
    ];

    list.forEach((s, idx) => {
      const key = getSwimmerKey(s);
      const att = attendanceMap[key] || {};
      const num = String(idx + 1).padStart(3, ' ');
      const div = s.division === 'student' ? '학생' : '성인';
      const team = s.team ? `${s.team}팀` : '-  ';
      const name = (s.name || '').padEnd(5, ' ');
      const birth = formatBirthDisplay(s.birthId || s.birth).padEnd(8, ' ');

      const indivEvents = [s.event1, s.event2].filter(Boolean);
      const relayEvents = getSwimmerRelaysFn(s).map(r => r.simple);
      const allEvts = [...indivEvents, ...relayEvents].join(', ') || '-';
      const evtsPadded = allEvts.padEnd(28, ' ');

      const attCells = attendanceDates.map(d => (att[d.key] || '-').padEnd(5, ' '));

      lines.push(`${num} | ${div} | ${team} | ${name} | ${birth} | ${evtsPadded} | ${attCells.join(' | ')}`);
    });

    lines.push('========================================================================================');
    lines.push(`※ 훈련 장소: 거제 동부학생수영장 | 워밍업 06:30 ~ / 훈련 08:30 ~`);
  }

  const textContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`📝 [${viewMode === 'simple' ? '간단히' : '자세히'}] 텍스트 파일 (.txt) 저장이 완료되었습니다.`);
}

/**
 * Exports currently filtered roster as Excel CSV file (.csv) with UTF-8 BOM
 * @param {Object} params
 */
export function exportRosterAsExcel({
  list = [],
  viewMode = 'simple',
  attendanceMap = {},
  nearestDate = { key: '2026-09-06', label: '09/06(일)', title: '1회차' },
  attendanceDates = ATTENDANCE_DATES,
  getSwimmerRelaysFn = () => [],
  showToast = () => {}
} = {}) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let headers = [];
  let rows = [];
  let fileName = '';

  if (viewMode === 'simple') {
    fileName = `GMDC_거제오션_훈련출석명단_간단히_${dateStr}.csv`;
    headers = ['순번', '선수명', '생년월일', `${nearestDate.label} 출석시간`];

    rows = list.map((s, idx) => {
      const key = getSwimmerKey(s);
      const att = attendanceMap[key] || {};
      return [
        idx + 1,
        s.name || '',
        formatBirthDisplay(s.birthId || s.birth),
        att[nearestDate.key] || ''
      ];
    });
  } else {
    // Detailed Mode
    fileName = `GMDC_거제오션_훈련출석명단_자세히_${dateStr}.csv`;
    const dateColHeaders = attendanceDates.map(d => `${d.label}`);
    headers = ['순번', '구분', '소속팀', '선수명', '생년월일', '신청종목', ...dateColHeaders, '출석횟수'];

    rows = list.map((s, idx) => {
      const key = getSwimmerKey(s);
      const att = attendanceMap[key] || {};
      const indivEvents = [s.event1, s.event2].filter(Boolean);
      const relayEvents = getSwimmerRelaysFn(s).map(r => r.detailed);
      const eventStr = [...indivEvents, ...relayEvents].join(' / ');
      const attCount = attendanceDates.filter(d => Boolean(att[d.key])).length;
      const attValues = attendanceDates.map(d => att[d.key] || '');

      return [
        idx + 1,
        s.division === 'student' ? '학생부' : '성인부',
        s.team || '',
        s.name || '',
        formatBirthDisplay(s.birthId || s.birth),
        eventStr,
        ...attValues,
        `${attCount}회`
      ];
    });
  }

  const csvRows = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ];

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`📊 [${viewMode === 'simple' ? '간단히' : '자세히'}] 엑셀 파일 (.csv) 저장이 완료되었습니다.`);
}

/**
 * Exports currently filtered roster as PDF via window.print
 * @param {Object} params
 */
export function exportRosterAsPdf({
  viewMode = 'simple',
  showToast = () => {},
  onClose = () => {}
} = {}) {
  onClose();
  showToast(`📄 [${viewMode === 'simple' ? '간단히' : '자세히'}] 인쇄 / PDF 저장 대화상자를 호출합니다...`);
  setTimeout(() => {
    window.print();
  }, 300);
}

/**
 * Shared image capture helper used for JPG / PNG export
 * @param {Object} params
 */
export async function captureTableAsImage({
  format = 'png',
  viewMode = 'simple',
  targetElement = null,
  showToast = () => {},
  onClose = () => {}
} = {}) {
  onClose();
  const target = targetElement || document.querySelector('.table-card') || document.getElementById('attendanceTable');
  if (!target || typeof window.html2canvas !== 'function') {
    showToast('⚠️ 이미지 캡처 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도하세요.');
    return;
  }

  const isJpg = format === 'jpg';
  const mimeType = isJpg ? 'image/jpeg' : 'image/png';
  const ext = isJpg ? 'jpg' : 'png';
  const viewLabel = viewMode === 'simple' ? '간단히' : '자세히';
  const icon = isJpg ? '🖼️' : '🎨';

  showToast(`⏳ [${viewLabel}] 고화질 ${ext.toUpperCase()} 이미지 생성 중...`);
  try {
    const canvas = await window.html2canvas(target, {
      scale: EXPORT_IMAGE_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const imgData = isJpg ? canvas.toDataURL(mimeType, EXPORT_JPEG_QUALITY) : canvas.toDataURL(mimeType);
    const a = document.createElement('a');
    a.href = imgData;
    a.download = `GMDC_거제오션_훈련출석명단_${viewLabel}_${dateStr}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`${icon} [${viewLabel}] ${ext.toUpperCase()} 이미지 저장이 완료되었습니다.`);
  } catch (err) {
    console.error(`${ext.toUpperCase()} capture error:`, err);
    showToast('❌ 이미지 저장 중 오류가 발생했습니다.');
  }
}

/** Exports table as JPG image (.jpg) */
export function exportRosterAsJpg(options = {}) {
  return captureTableAsImage({ ...options, format: 'jpg' });
}

/** Exports table as PNG image (.png) */
export function exportRosterAsPng(options = {}) {
  return captureTableAsImage({ ...options, format: 'png' });
}
