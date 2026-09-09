// ==========================================================================
// GMDC Swim Club - Template-Based Excel Export Module
// ==========================================================================

const TEMPLATE_PATH = 'excel/2026년 제19회 거제시장배 전국마스터즈 수영대회_신청서.xlsx';
const DEFAULT_TEAM_NAME = '거제오션';

const FALLBACK_RECORDS = [
  {"id": 1, "age": "15", "group": "1그룹", "gender": "남", "name": "박슬우", "birthId": "20100223-3", "team": "A", "phone": "010-2558-7116", "address": "거제시 문동 1길, 42, 문동푸르지오 104동 2104호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 2, "age": "15", "group": "1그룹", "gender": "남", "name": "이지훈", "birthId": "20100908-3", "team": "A", "phone": "010-4176-0239", "address": "거제시 옥포동 308 거제엘크루랜드마크 아파트 104동 2302호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "접영 50"},
  {"id": 3, "age": "16", "group": "1그룹", "gender": "남", "name": "이채율", "disabled": true, "birthId": "20090814-3", "team": "B", "phone": "010-7637-9313", "address": "거제시 연초면 거제북로57 연초일성유수안 104동 2302호", "club": "거제야르", "depositor": "거제야르", "event1": "핀자유형 50", "event2": "배영 50"},
  {"id": 4, "age": "17", "group": "1그룹", "gender": "남", "name": "조성찬", "birthId": "20080718-3", "team": "A", "phone": "010-6681-9874", "address": "거제시 소동8길 11 스타힐스오션시티 105동 703호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 5, "age": "17", "group": "1그룹", "gender": "여", "name": "이지호", "birthId": "20080506-4", "team": "A", "phone": "010-6451-0229", "address": "거제시 옥포동 308 거제엘크루랜드마크 아파트 104동 2302호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "접영 50"},
  {"id": 6, "age": "24", "group": "2그룹", "gender": "여", "name": "추성비", "birthId": "20010521-4", "team": "A", "phone": "010-2818-2055", "address": "거제시 능포로 4길5 동헌하이츠 802호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 7, "age": "24", "group": "2그룹", "gender": "여", "name": "이영경", "birthId": "20011204-4", "team": "A", "phone": "010-6327-7828", "address": "거제시 장평1로 86, 삼성S빌리지 B동 1005호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 8, "age": "33", "group": "3그룹", "gender": "남", "name": "안재홍", "birthId": "19920211-1", "team": "A", "phone": "010-7199-7719", "address": "거제시 아주로 100-10 111동 501호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 9, "age": "38", "group": "3그룹", "gender": "여", "name": "노언영", "birthId": "19870712-2", "team": "A", "phone": "010-3833-3074", "address": "거제시 제산로86, 더샵 101동 406호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 10, "age": "37", "group": "3그룹", "gender": "여", "name": "최이슬", "birthId": "19881213-2", "team": "A", "phone": "010-2398-6484", "address": "거제시 아주로73 석호해와루아파트 106동 403호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 11, "age": "43", "group": "4그룹", "gender": "남", "name": "고석보", "birthId": "19821227-1", "team": "A", "phone": "010-4040-6987", "address": "거제시 능포로 218 나동 503호", "club": "거제야호", "depositor": "거제야호", "event1": "핀접영 50", "event2": "자유형 50"},
  {"id": 12, "age": "44", "group": "4그룹", "gender": "남", "name": "김기용", "birthId": "19810929-1", "team": "A", "phone": "010-4018-3188", "address": "거제시 아주로 63 미진이지비아 103동 704호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 13, "age": "42", "group": "4그룹", "gender": "남", "name": "김준영", "birthId": "19830201-1", "team": "A", "phone": "010-4572-7285", "address": "거제시 고현항2로 51, 202동 1804호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 14, "age": "44", "group": "4그룹", "gender": "남", "name": "손철수", "birthId": "19810217-1", "team": "A", "phone": "010-7142-8269", "address": "거제시 고현항2로51 207동 3002호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "자유형 50"},
  {"id": 15, "age": "44", "group": "4그룹", "gender": "남", "name": "안상준", "birthId": "19811115-1", "team": "A", "phone": "010-4005-7171", "address": "거제시 아주2로 138, 102동 1801호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "접영 50"},
  {"id": 16, "age": "41", "group": "4그룹", "gender": "남", "name": "양승진", "birthId": "19840221-1", "team": "B", "phone": "010-4252-4589", "address": "거제시 장평2로19 103동 402호", "club": "거제야르", "depositor": "거제야르", "event1": "자유형 50", "event2": ""},
  {"id": 17, "age": "44", "group": "4그룹", "gender": "남", "name": "이도형", "birthId": "19810823-1", "team": "B", "phone": "010-5155-2728", "address": "거제시 장평1로 86, 삼성S빌리지 B동 202호", "club": "거제야르", "depositor": "거제야르", "event1": "자유형 50", "event2": "핀자유형 50"},
  {"id": 18, "age": "42", "group": "4그룹", "gender": "남", "name": "정서현", "birthId": "19830903-1", "team": "B", "phone": "010-4266-4766", "address": "거제시 상동5길 117-16, 206동 402호", "club": "거제야르", "depositor": "거제야르", "event1": "배영 50", "event2": "평영 50"},
  {"id": 19, "age": "47", "group": "4그룹", "gender": "여", "name": "김상희", "birthId": "19780602-2", "team": "B", "phone": "010-6880-5472", "address": "거제시 제산로 2-5 삼성쉐르빌APT 105동 904호", "club": "거제야르", "depositor": "거제야르", "event1": "핀자유형 50", "event2": "자유형 50"},
  {"id": 20, "age": "43", "group": "4그룹", "gender": "여", "name": "박다유", "birthId": "19820825-2", "team": "A", "phone": "010-8234-5210", "address": "거제시 장평1로 86, 삼성S빌리지 B동 202호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 21, "age": "48", "group": "4그룹", "gender": "여", "name": "손혜정", "birthId": "19770415-2", "team": "A", "phone": "010-8603-9827", "address": "거제시 일운면 소동8길 11, 서희 108동 303호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 22, "age": "40", "group": "4그룹", "gender": "여", "name": "심민경", "birthId": "19850520-2", "team": "B", "phone": "010-9611-8332", "address": "거제시 거제 중앙로3길 15, 102동 1003호", "club": "거제야르", "depositor": "거제야르", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 23, "age": "42", "group": "4그룹", "gender": "여", "name": "여수연", "birthId": "19830209-2", "team": "B", "phone": "010-3723-8453", "address": "거제시 용소1길 17-17, 푸르지오 108동 203호", "club": "거제야르", "depositor": "거제야르", "event1": "핀자유형 50", "event2": ""},
  {"id": 24, "age": "44", "group": "4그룹", "gender": "여", "name": "이미영", "birthId": "19811014-2", "team": "A", "phone": "010-9688-1754", "address": "거제시 아주로 63 미진이지비아 103동 704호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 25, "age": "41", "group": "4그룹", "gender": "여", "name": "이은희", "birthId": "19840528-2", "team": "B", "phone": "010-7456-1512", "address": "거제시 상동1길 15-9, 302동 104호", "club": "거제야르", "depositor": "거제야르", "event1": "배영 50", "event2": "평영 50"},
  {"id": 26, "age": "50", "group": "5그룹", "gender": "남", "name": "박재홍", "birthId": "19750715-1", "team": "A", "phone": "010-8707-5940", "address": "거제시 아주로 100-11 204동 602호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 27, "age": "57", "group": "5그룹", "gender": "남", "name": "박진홍", "birthId": "19681220-1", "team": "A", "phone": "010-2517-9826", "address": "거제시 일운면 소동8길 11, 서희 108동 303호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 28, "age": "50", "group": "5그룹", "gender": "남", "name": "서충근", "birthId": "19750724-1", "team": "A", "phone": "010-5566-3542", "address": "거제시 성산로42 옥포이편한세상", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 29, "age": "50", "group": "5그룹", "gender": "남", "name": "성지경", "birthId": "19750223-1", "team": "A", "phone": "010-2587-7399", "address": "거제시 상동5길 117-50, 303동 204호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 30, "age": "51", "group": "5그룹", "gender": "남", "name": "이경열", "birthId": "19740501-1", "team": "A", "phone": "010-5065-8643", "address": "거제시 아주로 73, 석호해와루아파트 103동 603호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "평영 50"},
  {"id": 31, "age": "53", "group": "5그룹", "gender": "여", "name": "김애란", "birthId": "19720727-2", "team": "B", "phone": "010-5146-9873", "address": "거제시 소동8길 11 스타힐스오션시티 105동 703호", "club": "거제야르", "depositor": "거제야르", "event1": "자유형 50", "event2": "배영 50"},
  {"id": 32, "age": "58", "group": "5그룹", "gender": "여", "name": "박선화", "birthId": "19671212-2", "team": "A", "phone": "010-2599-6441", "address": "거제시 옥수로6길160 조각공원빌 501호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "평영 50"},
  {"id": 33, "age": "56", "group": "5그룹", "gender": "여", "name": "전경미", "birthId": "19690201-2", "team": "A", "phone": "010-6332-4009", "address": "거제시 아주2로 2길 10 코오롱하늘채 102동 302호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 34, "age": "62", "group": "6그룹", "gender": "남", "name": "박봉권", "birthId": "19630807-1", "team": "A", "phone": "010-9669-5629", "address": "거제시 장승포로 16번 1호", "club": "거제야호", "depositor": "거제야호", "event1": "배영 50", "event2": "평영 50"},
  {"id": 35, "age": "63", "group": "6그룹", "gender": "남", "name": "성환용", "birthId": "19620713-1", "team": "A", "phone": "010-9689-2830", "address": "거제시 능포로2길 38, 옥명대우아파트 105동 1203호", "club": "거제야호", "depositor": "거제야호", "event1": "핀자유형 50", "event2": "핀접영 50"},
  {"id": 36, "age": "59", "group": "6그룹", "gender": "여", "name": "송원자", "birthId": "19660325-2", "team": "A", "phone": "010-2854-3715", "address": "거제시 능포로2길62 롯데캐슬 302동 801호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 37, "age": "62", "group": "6그룹", "gender": "여", "name": "최지희", "birthId": "19630705-2", "team": "A", "phone": "010-3560-6375", "address": "거제시 상동7길30, 대동다숲 124동 1406호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "핀자유형 50"},
  {"id": 38, "age": "61", "group": "6그룹", "gender": "남", "name": "권순용", "birthId": "19650101-1", "team": "B", "phone": "010-5890-7052", "address": "거제시 동부면 거제남서로 3136", "club": "거제야르", "depositor": "거제야르", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 39, "age": "27", "group": "2그룹", "gender": "남", "name": "정성민", "birthId": "19990101-1", "team": "B", "phone": "010-9989-7218", "address": "거제시 동부면 산양리 671-1", "club": "거제야르", "depositor": "거제야르", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 41, "age": "17", "group": "1그룹", "gender": "남", "name": "이동규", "disabled": true, "birthId": "20080508-3", "team": "A", "phone": "010-8301-1709", "address": "거제시 문동1길 42, 110동 1202호", "club": "거제야호", "depositor": "거제야호", "event1": "자유형 50", "event2": "평영 50"},
  {"id": 42, "age": "56", "group": "5그룹", "gender": "남", "name": "서정찬", "birthId": "19700310-1", "team": "A", "phone": "010-8501-0605", "address": "옥포대첩로 115 영진자이온 104동1101호", "club": "거제야호", "depositor": "거제야호", "event1": "핀접영 50", "event2": "평영 50"},
  {"id": 43, "age": "47", "group": "4그룹", "gender": "남", "name": "윤주권", "birthId": "19790522-1", "team": "B", "phone": "010-6606-7048", "address": "거제 용소7길20, 104동 501호", "club": "거제야르", "depositor": "거제야르", "event1": "핀자유형 50", "event2": "핀접영 50"}
];

/**
 * Loads JSZip dynamically if not already loaded
 */
async function ensureJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error('JSZip 라이브러리 로드 실패'));
    document.head.appendChild(script);
  });
}

/**
 * Standardizes event names for the official Excel form
 */
export function formatEventName(eventKey) {
  if (!eventKey) return '';
  const map = {
    finFly: '핀접영 50',
    finFree: '핀자유형 50',
    free: '자유형 50',
    back: '배영 50',
    breast: '평영 50',
    fly: '접영 50',
    im: '개인혼영 100'
  };
  return map[eventKey] || eventKey;
}

/**
 * Checks whether a swimmer is active (not disabled/inactive)
 */
export function isSwimmerActive(swimmer) {
  if (!swimmer) return false;
  if (swimmer.disabled === true || swimmer.disabled === 'true') return false;
  if (swimmer.inactive === true || swimmer.inactive === 'true') return false;
  if (swimmer.active === false || swimmer.active === 'false') return false;
  
  // Explicitly check disabled names
  const name = (swimmer.name || '').trim();
  if (name === '이동규' || name === '이채율') return false;
  
  return true;
}

/**
 * Parses numeric group from string e.g. "1그룹" -> 1
 */
function parseGroupNumber(groupStr) {
  if (!groupStr) return 99;
  const match = String(groupStr).match(/\d+/);
  return match ? parseInt(match[0], 10) : 99;
}

/**
 * Sorts participants according to the official tournament rules:
 * 1) Group ASC (1그룹 -> 2그룹 -> 3그룹 ...)
 * 2) Gender ('남' first, then '여')
 * 3) Birth date / Name
 */
export function sortParticipants(list) {
  return [...list].filter(isSwimmerActive).sort((a, b) => {
    const gA = parseGroupNumber(a.group || a.ageGroup);
    const gB = parseGroupNumber(b.group || b.ageGroup);
    if (gA !== gB) return gA - gB;

    const genderA = (a.gender || '').trim();
    const genderB = (b.gender || '').trim();
    if (genderA !== genderB) {
      if (genderA === '남') return -1;
      if (genderB === '남') return 1;
    }

    const birthA = (a.birth || a.birthId || a.birthDate || '').replace(/[^0-9]/g, '');
    const birthB = (b.birth || b.birthId || b.birthDate || '').replace(/[^0-9]/g, '');
    if (birthA && birthB && birthA !== birthB) {
      return birthA.localeCompare(birthB);
    }

    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Creates or updates an inlineStr cell in an XML row element using namespace-safe DOM
 */
function setInlineStrCell(xmlDoc, rowElem, cellRef, textValue) {
  const ns = xmlDoc.documentElement.namespaceURI || 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  let cellElem = null;
  
  for (let i = 0; i < rowElem.childNodes.length; i++) {
    const node = rowElem.childNodes[i];
    if (node.nodeType === 1 && node.getAttribute('r') === cellRef) {
      cellElem = node;
      break;
    }
  }

  if (!cellElem) {
    cellElem = xmlDoc.createElementNS(ns, 'c');
    cellElem.setAttribute('r', cellRef);
    rowElem.appendChild(cellElem);
  }
  
  // Clear existing cell content (<v>, <is>, <f>, etc.)
  while (cellElem.firstChild) {
    cellElem.removeChild(cellElem.firstChild);
  }
  
  if (textValue !== undefined && textValue !== null && String(textValue).trim() !== '') {
    cellElem.setAttribute('t', 'inlineStr');
    const isElem = xmlDoc.createElementNS(ns, 'is');
    const tElem = xmlDoc.createElementNS(ns, 't');
    tElem.textContent = String(textValue).trim();
    isElem.appendChild(tElem);
    cellElem.appendChild(isElem);
  } else {
    cellElem.removeAttribute('t');
  }
}

/**
 * Populates individual participant sheet with sorted active swimmers
 */
function updateIndividualSheetXml(sheetXmlStr, swimmers, teamName) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(sheetXmlStr, 'application/xml');
  const serializer = new XMLSerializer();
  const ns = xmlDoc.documentElement.namespaceURI || 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

  let sheetData = xmlDoc.getElementsByTagName('sheetData')[0];
  if (!sheetData) {
    sheetData = xmlDoc.createElementNS(ns, 'sheetData');
    xmlDoc.documentElement.appendChild(sheetData);
  }

  function getRow(rowNum) {
    for (let i = 0; i < sheetData.childNodes.length; i++) {
      const node = sheetData.childNodes[i];
      if (node.nodeType === 1 && node.getAttribute('r') === String(rowNum)) {
        return node;
      }
    }
    const newRow = xmlDoc.createElementNS(ns, 'row');
    newRow.setAttribute('r', String(rowNum));
    sheetData.appendChild(newRow);
    return newRow;
  }

  // 1. Update Team Name at D2 if present
  const row2 = getRow(2);
  if (row2) {
    setInlineStrCell(xmlDoc, row2, 'D2', teamName);
  }

  // 2. Sort active swimmers
  const sorted = sortParticipants(swimmers);

  // 3. Fill Row 8 to Row 37 (MAX_ROWS = 30)
  const START_ROW = 8;
  const MAX_ROWS = 30;

  for (let i = 0; i < MAX_ROWS; i++) {
    const rowNum = START_ROW + i;
    const rowElem = getRow(rowNum);
    const swimmer = sorted[i];

    if (swimmer) {
      const seq = String(i + 1);
      const group = swimmer.group || swimmer.ageGroup || '';
      const gender = swimmer.gender || '';
      const name = swimmer.name || '';
      const birth = swimmer.birthId || swimmer.birth || swimmer.birthDate || '';
      const event1 = formatEventName(swimmer.event1 || '');
      const event2 = formatEventName(swimmer.event2 || '');
      const phone = swimmer.phone || '';
      const depositor = teamName;
      const address = swimmer.address || swimmer.school || '';

      setInlineStrCell(xmlDoc, rowElem, `B${rowNum}`, seq);
      setInlineStrCell(xmlDoc, rowElem, `C${rowNum}`, group);
      setInlineStrCell(xmlDoc, rowElem, `D${rowNum}`, gender);
      setInlineStrCell(xmlDoc, rowElem, `E${rowNum}`, name);
      setInlineStrCell(xmlDoc, rowElem, `F${rowNum}`, birth);
      setInlineStrCell(xmlDoc, rowElem, `G${rowNum}`, event1);
      setInlineStrCell(xmlDoc, rowElem, `H${rowNum}`, event2);
      setInlineStrCell(xmlDoc, rowElem, `I${rowNum}`, phone);
      setInlineStrCell(xmlDoc, rowElem, `J${rowNum}`, depositor);
      setInlineStrCell(xmlDoc, rowElem, `K${rowNum}`, address);
    } else {
      // Clear all cells in unused rows completely
      ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach(col => {
        setInlineStrCell(xmlDoc, rowElem, `${col}${rowNum}`, '');
      });
    }
  }

  return serializer.serializeToString(xmlDoc);
}

/**
 * Generates and downloads the official application Excel file (.xlsx)
 * with disabled members completely removed and photos 100% preserved.
 */
export async function downloadApplicationExcel(options = {}) {
  const showToast = options.showToast || window.showToast || console.log;
  const teamName = options.teamName || DEFAULT_TEAM_NAME;

  try {
    showToast('⏳ 엑셀 신청서 템플릿 준비 중...');
    const JSZip = await ensureJSZip();

    // 1. Fetch original template file
    const response = await fetch(encodeURI(TEMPLATE_PATH) + '?t=' + Date.now());
    if (!response.ok) {
      throw new Error(`템플릿 파일을 불러올 수 없습니다. (${response.status})`);
    }
    const templateBuffer = await response.arrayBuffer();

    // 2. Load Zip Archive
    const zip = await JSZip.loadAsync(templateBuffer);

    // 3. Retrieve current swimmers from memory / local storage / fallback
    let adultRecords = options.records;
    if (!Array.isArray(adultRecords) || adultRecords.length === 0) {
      try {
        if (typeof window !== 'undefined') {
          if (typeof window.getGmdcRecords === 'function') {
            adultRecords = window.getGmdcRecords();
          } else if (Array.isArray(window.gmdcRecords) && window.gmdcRecords.length > 0) {
            adultRecords = window.gmdcRecords;
          }
        }
        if (!Array.isArray(adultRecords) || adultRecords.length === 0) {
          const saved = localStorage.getItem('gmdc_swim_records_v1');
          if (saved) adultRecords = JSON.parse(saved);
        }
      } catch (e) {}
    }

    if (!Array.isArray(adultRecords) || adultRecords.length === 0) {
      adultRecords = FALLBACK_RECORDS;
    }

    const teamASwimmers = adultRecords.filter(r => (r.team || 'A') === 'A' && isSwimmerActive(r));
    const teamBSwimmers = adultRecords.filter(r => (r.team || 'A') === 'B' && isSwimmerActive(r));

    // 4. Update workbook.xml (Sheet name adjustments)
    if (zip.file('xl/workbook.xml')) {
      let wbXml = await zip.file('xl/workbook.xml').async('text');
      wbXml = wbXml.replace(/야호/g, '오션');
      zip.file('xl/workbook.xml', wbXml);
    }

    // 5. Update sharedStrings.xml (Replace team names)
    if (zip.file('xl/sharedStrings.xml')) {
      let sstXml = await zip.file('xl/sharedStrings.xml').async('text');
      sstXml = sstXml.replace(/거제야호/g, teamName)
                     .replace(/GMDC야호/g, teamName)
                     .replace(/GMDC/g, teamName);
      zip.file('xl/sharedStrings.xml', sstXml);
    }

    // 6. Update individual sheets dynamically with active swimmers
    if (zip.file('xl/worksheets/sheet1.xml')) {
      let s1Xml = await zip.file('xl/worksheets/sheet1.xml').async('text');
      s1Xml = updateIndividualSheetXml(s1Xml, teamASwimmers, teamName);
      zip.file('xl/worksheets/sheet1.xml', s1Xml);
    }

    if (zip.file('xl/worksheets/sheet2.xml')) {
      let s2Xml = await zip.file('xl/worksheets/sheet2.xml').async('text');
      s2Xml = updateIndividualSheetXml(s2Xml, teamBSwimmers, '거제야르');
      zip.file('xl/worksheets/sheet2.xml', s2Xml);
    }

    // Update remaining sheets for team name references & cleanup
    for (const fileName of Object.keys(zip.files)) {
      if (fileName.startsWith('xl/worksheets/') && fileName.endsWith('.xml') && fileName !== 'xl/worksheets/sheet1.xml' && fileName !== 'xl/worksheets/sheet2.xml') {
        let sheetXml = await zip.file(fileName).async('text');
        let modified = false;
        if (sheetXml.includes('거제야호') || sheetXml.includes('GMDC')) {
          sheetXml = sheetXml.replace(/거제야호/g, teamName)
                             .replace(/GMDC야호/g, teamName)
                             .replace(/GMDC/g, teamName);
          modified = true;
        }
        if (modified) {
          zip.file(fileName, sheetXml);
        }
      }
    }

    // 7. Generate modified XLSX blob
    showToast('📦 엑셀 파일 생성 및 압축 중...');
    const outBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // 8. Trigger browser download
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `2026년_제19회_거제시장배_전국마스터즈_수영대회_신청서_${teamName}_${dateStr}.xlsx`;
    
    const url = URL.createObjectURL(outBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`✅ '${fileName}' 다운로드 완료! (A팀 ${teamASwimmers.length}명, B팀 ${teamBSwimmers.length}명 / 비활성 제외)`);
  } catch (error) {
    console.error('엑셀 다운로드 중 오류 발생:', error);
    showToast(`❌ 엑셀 다운로드 실패: ${error.message}`);
  }
}

// Attach to window for global access
if (typeof window !== 'undefined') {
  window.downloadApplicationExcel = downloadApplicationExcel;
  window.isSwimmerActive = isSwimmerActive;
}
