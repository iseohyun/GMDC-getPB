// ==========================================================================
// 2026 제19회 거제시장배 전국 마스터즈 수영대회 — 학생부 공식 기록지(사진 10장) 분석 데이터
// 출처: \photos\기록지(학생)\KakaoTalk_20261024_210316558.jpg ~ _09.jpg
// ==========================================================================

export const STUDENT_SHEET_META = {
  competitionTitle: "2026 제19회 거제시장배 전국 마스터즈 수영대회 (학생부)",
  date: "2026-10-24 (토)",
  ourTeamName: "거제야르",
  scoringRuleIndiv: "개인전: 1위 7점 · 2위 5점 · 3위 4점 · 4위 3점 · 5위 2점 · 6위 1점",
  scoringRuleRelay: "단체전(2배): 1위 14점 · 2위 10점 · 3위 8점 · 4위 6점 · 5위 4점 · 6위 2점"
};

/**
 * 우리팀(거제야르) 학생부 전체 53출전(개인 49 + 단체 4) 중
 * 기록지 사진으로 확인된 22건(개인 19 + 단체 3)의 공식 성적 및 미촬영 31건 통합 현황
 */
export const OUR_TEAM_STUDENT_HIGHLIGHTS = {
  totalEntries: 53,
  indivEntries: 49,
  relayEntries: 4,
  verifiedEntries: 22,
  verifiedIndiv: 19,
  verifiedRelay: 3,
  unphotographedEntries: 31,
  totalPoints: 30,
  indivPoints: 28,
  relayPoints: 2,
  goldCount: 1,
  silverCount: 2,
  bronzeCount: 1,
  top6Count: 8, // 1~6위 입상 총 건수 (메달 4 + 4~6위 4)
  podiumAndScoringList: [
    {
      medal: "🥇 1위",
      badgeClass: "rank-1",
      name: "류다윤",
      gender: "여",
      group: "5그룹",
      event: "자유형 50m",
      matchNo: "57-1",
      lane: 2,
      record: "00'33\"85",
      rank: "1위",
      points: 7,
      isRelay: false,
      note: "여5 자유형 23명 중 전체 1위 금메달 (2위 박세은 34\"27을 0.42초 차 제침)"
    },
    {
      medal: "🥈 2위",
      badgeClass: "rank-2",
      name: "이선우",
      gender: "남",
      group: "7그룹",
      event: "배영 50m",
      matchNo: "24-1",
      lane: 2,
      record: "00'34\"97",
      rank: "2위",
      points: 5,
      isRelay: false,
      note: "남7 배영 은메달 입상 (자유형 5위와 함께 개인 2종목 모두 입상 · 총 7점 기여)"
    },
    {
      medal: "🥈 2위",
      badgeClass: "rank-2",
      name: "정채윤",
      gender: "여",
      group: "7그룹",
      event: "자유형 50m",
      matchNo: "59-1",
      lane: 3,
      record: "00'32\"98",
      rank: "2위",
      points: 5,
      isRelay: false,
      note: "여7 자유형 은메달 입상 (1위 김단 32\"50과 0.48초 차 접전)"
    },
    {
      medal: "🥉 3위",
      badgeClass: "rank-3",
      name: "안서윤",
      gender: "여",
      group: "7그룹",
      event: "자유형 50m",
      matchNo: "59-2",
      lane: 2,
      record: "00'33\"68",
      rank: "3위",
      points: 4,
      isRelay: false,
      note: "여7 자유형 동메달 입상 (정채윤·안서윤 나란히 2·3위 동반 메달 · 합계 9점 합작)"
    },
    {
      medal: "🏅 4위",
      badgeClass: "rank-top6",
      name: "손민재",
      gender: "남",
      group: "4그룹",
      event: "자유형 50m",
      matchNo: "49-9",
      lane: 4,
      record: "00'35\"93",
      rank: "4위",
      points: 3,
      isRelay: false,
      note: "남4 자유형 35명 중 4위 입상 (3위 이준민 35\"80과 불과 0.13초 차!)"
    },
    {
      medal: "🏅 5위",
      badgeClass: "rank-top6",
      name: "이선우",
      gender: "남",
      group: "7그룹",
      event: "자유형 50m",
      matchNo: "52-3",
      lane: 2,
      record: "00'30\"47",
      rank: "5위",
      points: 2,
      isRelay: false,
      note: "남7 자유형 17명 중 5위 입상 (30초대 초반 호기록으로 2점 추가 획득)"
    },
    {
      medal: "🏅 5위",
      badgeClass: "rank-top6",
      name: "김서윤",
      gender: "여",
      group: "5그룹",
      event: "자유형 50m",
      matchNo: "57-6",
      lane: 2,
      record: "00'36\"25",
      rank: "5위",
      points: 2,
      isRelay: false,
      note: "여5 자유형 23명 중 5위 입상 (류다윤 1위 + 김서윤 5위로 여5 자유형 9점 합작)"
    },
    {
      medal: "🏅 6위",
      badgeClass: "rank-top6",
      name: "거제야르 (배건우·손민재·양서진·김루민)",
      gender: "남",
      group: "남초",
      event: "계영 200m (단체)",
      matchNo: "1-1",
      lane: 3,
      record: "02'56\"60",
      rank: "6위",
      points: 2,
      isRelay: true,
      note: "7위 거제찬스돌핀(02'56\"67)을 불과 0.07초 차이로 제치고 단체전 6위(2점) 극적 획득!"
    }
  ]
};

/**
 * 기록지 사진 10장에서 추출한 전체 공식 경기 결과 (총 243개 엔트리)
 * 필드: matchNo, stroke, gender, group, lane, name, team, record, rank, points, note
 */
export const VERIFIED_SHEET_RESULTS = [
  // ========================================================================
  // [1p] 경기번호 1-1 ~ 1-2: 계영 200m 남자 (남초)
  // ========================================================================
  { matchNo: "1-1", stroke: "계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 1, name: "마정우, 이은후, 조은우, 민형찬", team: "거제찬스아이", record: "88'88\"88", rank: "실격", points: 0, note: "터치전출발(1->2번)" },
  { matchNo: "1-1", stroke: "계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 2, name: "한서준, 김경민, 김대현, 김해솔", team: "KJH디지스트", record: "02'25\"01", rank: "3", points: 8, note: "" },
  { matchNo: "1-1", stroke: "계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 3, name: "배건우, 손민재, 양서진, 김루민", team: "거제야르", record: "02'56\"60", rank: "6", points: 2, note: "7위와 0.07초 차 6위 입상" },
  { matchNo: "1-1", stroke: "계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 4, name: "유승현, 김태완, 정찬준, 조승우", team: "PSC", record: "02'23\"46", rank: "2", points: 10, note: "" },
  { matchNo: "1-2", stroke: "계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 1, name: "정연우, 박지후, 김도현, 김시윤", team: "노블 TNV", record: "02'20\"60", rank: "1", points: 14, note: "" },
  { matchNo: "1-2", stroke: "계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 2, name: "김현우, 박솔현, 김도담, 정도현", team: "다람쥐특공대", record: "02'32\"89", rank: "4", points: 6, note: "" },
  { matchNo: "1-2", stroke: "계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 3, name: "곽동혁, 이다온, 조유준, 김보겸", team: "거제찬스돌핀", record: "02'56\"67", rank: "7", points: 0, note: "" },
  { matchNo: "1-2", stroke: "계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 4, name: "김태한, 정준휘, 류영준, 제유찬", team: "통영유소년수영클럽", record: "02'36\"79", rank: "5", points: 4, note: "" },

  // ========================================================================
  // [1p] 경기번호 2: 중등 계영 200m 남자 (남중)
  // ========================================================================
  { matchNo: "2", stroke: "계영 200m", gender: "남자", group: "남중", isRelay: true, lane: 1, name: "김승기, 조현서, 이재원, 원유찬", team: "거제찬스아이(중등)", record: "02'01\"72", rank: "1", points: 14, note: "" },
  { matchNo: "2", stroke: "계영 200m", gender: "남자", group: "남중", isRelay: true, lane: 2, name: "이다훈, 김종원, 김재우, 오성민", team: "삼성야호(중등)", record: "88'88\"88", rank: "실격", points: 0, note: "4번주자 빨리뜀" },
  { matchNo: "2", stroke: "계영 200m", gender: "남자", group: "남중", isRelay: true, lane: 3, name: "임성현, 최예준, 여준석, 김태하", team: "노블 TNV(중등)", record: "02'05\"01", rank: "2", points: 10, note: "" },

  // ========================================================================
  // [1p 우측] 경기번호 3-1: 계영 200m 여자 (여초 일부 확인)
  // ========================================================================
  { matchNo: "3-1", stroke: "계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 1, name: "엄유민, 이지민, 김다연, 반서현", team: "거제야호", record: "02'40\"53", rank: "4", points: 6, note: "" },
  { matchNo: "3-1", stroke: "계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 2, name: "윤지민, 안지현, 전면서, 임하율", team: "통영유소년수영클럽", record: "02'46\"12", rank: "5", points: 4, note: "" },

  // ========================================================================
  // [8p] 경기번호 22-1 ~ 22-4: 배영 50m · 남5 (남자 5그룹)
  // ========================================================================
  { matchNo: "22-1", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 1, name: "장현규", team: "프리라움샤크", record: "00'49\"82", rank: "9", points: 0, note: "" },
  { matchNo: "22-1", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 2, name: "이도준", team: "KJH디지스트", record: "00'42\"53", rank: "3", points: 4, note: "" },
  { matchNo: "22-1", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 3, name: "이리안", team: "PSC", record: "00'46\"47", rank: "7", points: 0, note: "" },
  { matchNo: "22-1", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 4, name: "김도현", team: "노블 TNV", record: "00'40\"76", rank: "2", points: 5, note: "" },
  { matchNo: "22-2", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 1, name: "이우리", team: "거제야르", record: "00'56\"60", rank: "11", points: 0, note: "" },
  { matchNo: "22-2", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 2, name: "이루하", team: "금빛", record: "00'38\"48", rank: "1", points: 7, note: "" },
  { matchNo: "22-2", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 3, name: "김유신", team: "개인", record: "00'44\"94", rank: "6", points: 1, note: "" },
  { matchNo: "22-3", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 2, name: "이준혁", team: "거제야호", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "22-3", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 3, name: "이시윤", team: "거제찬스돌핀", record: "00'55\"27", rank: "10", points: 0, note: "" },
  { matchNo: "22-3", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 4, name: "김규빈", team: "개인", record: "00'44\"09", rank: "4", points: 3, note: "" },
  { matchNo: "22-4", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 2, name: "황태인", team: "프리라움돌핀", record: "00'46\"89", rank: "8", points: 0, note: "" },
  { matchNo: "22-4", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 3, name: "김하준", team: "거제야르", record: "99'99\"99", rank: "불참", points: 0, note: "개인전 불참 후 오후 남초 혼계영 출전" },
  { matchNo: "22-4", stroke: "배영", gender: "남자", group: "5그룹", isRelay: false, lane: 4, name: "박범준", team: "KJH디지스트", record: "00'44\"77", rank: "5", points: 2, note: "" },

  // ========================================================================
  // [8p] 경기번호 23-1 ~ 23-4: 배영 50m · 남6 (남자 6그룹)
  // ========================================================================
  { matchNo: "23-1", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 1, name: "박승현", team: "거제찬스아이", record: "00'38\"10", rank: "3", points: 4, note: "" },
  { matchNo: "23-1", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "정윤서", team: "PSC", record: "00'36\"98", rank: "2", points: 5, note: "" },
  { matchNo: "23-1", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 3, name: "김현우", team: "거제야호", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "23-1", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 4, name: "정도현", team: "다람쥐특공대", record: "00'42\"61", rank: "5", points: 2, note: "" },
  { matchNo: "23-2", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 1, name: "김루민", team: "거제야르", record: "00'56\"70", rank: "10", points: 0, note: "" },
  { matchNo: "23-2", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "곽동혁", team: "거제찬스돌핀", record: "00'54\"60", rank: "9", points: 0, note: "" },
  { matchNo: "23-2", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 4, name: "그라함로건리", team: "거제야호", record: "00'46\"00", rank: "8", points: 0, note: "" },
  { matchNo: "23-3", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "진시안", team: "거제야호", record: "01'01\"48", rank: "11", points: 0, note: "" },
  { matchNo: "23-3", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 3, name: "김채완", team: "거제찬스아이", record: "00'38\"14", rank: "4", points: 3, note: "" },
  { matchNo: "23-3", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 4, name: "이도현", team: "개인", record: "00'44\"47", rank: "6", points: 1, note: "" },
  { matchNo: "23-4", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "김보겸", team: "거제찬스돌핀", record: "00'45\"51", rank: "7", points: 0, note: "" },
  { matchNo: "23-4", stroke: "배영", gender: "남자", group: "6그룹", isRelay: false, lane: 3, name: "하민우", team: "개인", record: "00'33\"41", rank: "1", points: 7, note: "" },

  // ========================================================================
  // [8p] 경기번호 24-1 ~ 24-2: 배영 50m · 남7 (남자 7그룹)
  // ========================================================================
  { matchNo: "24-1", stroke: "배영", gender: "남자", group: "7그룹", isRelay: false, lane: 1, name: "김태하", team: "노블 TNV", record: "00'37\"99", rank: "4", points: 3, note: "" },
  { matchNo: "24-1", stroke: "배영", gender: "남자", group: "7그룹", isRelay: false, lane: 2, name: "이선우", team: "거제야르", record: "00'34\"97", rank: "2", points: 5, note: "남7 배영 은메달 입상" },
  { matchNo: "24-1", stroke: "배영", gender: "남자", group: "7그룹", isRelay: false, lane: 3, name: "오성민", team: "삼성야호", record: "00'38\"86", rank: "5", points: 2, note: "" },
  { matchNo: "24-1", stroke: "배영", gender: "남자", group: "7그룹", isRelay: false, lane: 4, name: "조현서", team: "거제찬스아이", record: "00'40\"84", rank: "6", points: 1, note: "" },
  { matchNo: "24-2", stroke: "배영", gender: "남자", group: "7그룹", isRelay: false, lane: 2, name: "이재원", team: "거제찬스아이", record: "00'33\"94", rank: "1", points: 7, note: "" },
  { matchNo: "24-2", stroke: "배영", gender: "남자", group: "7그룹", isRelay: false, lane: 3, name: "양현준", team: "삼성야호", record: "00'43\"22", rank: "7", points: 0, note: "" },
  { matchNo: "24-2", stroke: "배영", gender: "남자", group: "7그룹", isRelay: false, lane: 4, name: "여준석", team: "노블 TNV", record: "00'37\"08", rank: "3", points: 4, note: "" },

  // ========================================================================
  // [16p 하단 일부] 경기번호 48-7: 자유형 50m · 남3 (남자 3그룹 일부 확인)
  // ========================================================================
  { matchNo: "48-7", stroke: "자유형", gender: "남자", group: "3그룹", isRelay: false, lane: 2, name: "김건우", team: "KJH디지스트", record: "00'46\"34", rank: "14", points: 0, note: "" },
  { matchNo: "48-7", stroke: "자유형", gender: "남자", group: "3그룹", isRelay: false, lane: 3, name: "정찬희", team: "통영유소년수영클럽", record: "00'41\"56", rank: "7", points: 0, note: "" },
  { matchNo: "48-7", stroke: "자유형", gender: "남자", group: "3그룹", isRelay: false, lane: 4, name: "임윤찬", team: "개인", record: "00'37\"74", rank: "3", points: 4, note: "" },

  // ========================================================================
  // [17p] 경기번호 49-1 ~ 49-9: 자유형 50m · 남4 (남자 4그룹)
  // ========================================================================
  { matchNo: "49-1", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 1, name: "박성준", team: "프리라움돌핀", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "49-1", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 2, name: "김로이", team: "거제찬스샤크", record: "00'58\"77", rank: "32", points: 0, note: "" },
  { matchNo: "49-1", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 3, name: "추승우", team: "거제야호", record: "00'42\"69", rank: "20", points: 0, note: "" },
  { matchNo: "49-1", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 4, name: "이재우", team: "거제찬스돌핀", record: "00'42\"17", rank: "17", points: 0, note: "" },
  { matchNo: "49-2", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 1, name: "구규빈", team: "다람쥐특공대", record: "00'41\"41", rank: "15", points: 0, note: "" },
  { matchNo: "49-2", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 2, name: "김대현", team: "KJH디지스트", record: "00'38\"51", rank: "8", points: 0, note: "" },
  { matchNo: "49-2", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 3, name: "이승후", team: "거제야르", record: "00'51\"09", rank: "28", points: 0, note: "" },
  { matchNo: "49-2", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 4, name: "진시원", team: "개인", record: "00'39\"85", rank: "11", points: 0, note: "" },
  { matchNo: "49-3", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 1, name: "이효성", team: "IMD스위밍클럽", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "49-3", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 2, name: "강리호", team: "프리라움웨일", record: "00'52\"87", rank: "29", points: 0, note: "" },
  { matchNo: "49-3", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 3, name: "이준민", team: "노블 TNV", record: "00'35\"80", rank: "3", points: 4, note: "" },
  { matchNo: "49-3", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 4, name: "백이안", team: "거제찬스샤크", record: "00'49\"19", rank: "27", points: 0, note: "" },
  { matchNo: "49-4", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 1, name: "안률건", team: "금빛", record: "00'36\"41", rank: "6", points: 1, note: "" },
  { matchNo: "49-4", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 2, name: "정연우", team: "KJH디지스트", record: "00'42\"22", rank: "18", points: 0, note: "" },
  { matchNo: "49-4", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 3, name: "강서후", team: "키튼드림팀", record: "00'42\"72", rank: "21", points: 0, note: "" },
  { matchNo: "49-4", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 4, name: "심준용", team: "거제야호", record: "00'45\"63", rank: "25", points: 0, note: "" },
  { matchNo: "49-5", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 1, name: "강민준", team: "PSC", record: "00'42\"43", rank: "19", points: 0, note: "" },
  { matchNo: "49-5", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 2, name: "윤지유", team: "프리라움샤크", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "49-5", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 3, name: "곽이룬", team: "오르카스위밍", record: "00'54\"14", rank: "30", points: 0, note: "" },
  { matchNo: "49-5", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 4, name: "장이현", team: "노블 TNV", record: "00'44\"64", rank: "24", points: 0, note: "" },
  { matchNo: "49-6", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 1, name: "육상현", team: "노블 TNV", record: "00'34\"67", rank: "2", points: 5, note: "" },
  { matchNo: "49-6", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 2, name: "강규민", team: "금빛", record: "00'40\"76", rank: "13", points: 0, note: "" },
  { matchNo: "49-6", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 3, name: "임이준", team: "PSC", record: "00'40\"60", rank: "12", points: 0, note: "" },
  { matchNo: "49-6", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 4, name: "조은우", team: "거제찬스아이", record: "00'38\"70", rank: "9", points: 0, note: "" },
  { matchNo: "49-7", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 1, name: "김해솔", team: "KJH디지스트", record: "00'33\"77", rank: "1", points: 7, note: "" },
  { matchNo: "49-7", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 2, name: "김결", team: "거제찬스아이", record: "00'41\"47", rank: "16", points: 0, note: "" },
  { matchNo: "49-7", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 3, name: "이동하", team: "거제찬스돌핀", record: "00'41\"33", rank: "14", points: 0, note: "" },
  { matchNo: "49-7", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 4, name: "최서진", team: "거제야호", record: "00'47\"93", rank: "26", points: 0, note: "" },
  { matchNo: "49-8", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 1, name: "김도현", team: "PSC", record: "00'42\"80", rank: "22", points: 0, note: "" },
  { matchNo: "49-8", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 2, name: "임시환", team: "프리라움돌핀", record: "00'43\"95", rank: "23", points: 0, note: "" },
  { matchNo: "49-8", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 4, name: "류영준", team: "통영유소년수영클럽", record: "00'36\"18", rank: "5", points: 2, note: "" },
  { matchNo: "49-9", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 1, name: "박솔현", team: "다람쥐특공대", record: "00'38\"43", rank: "7", points: 0, note: "" },
  { matchNo: "49-9", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 2, name: "최현도", team: "IMD스위밍클럽", record: "00'39\"43", rank: "10", points: 0, note: "" },
  { matchNo: "49-9", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 3, name: "박정현", team: "거제찬스샤크", record: "00'55\"60", rank: "31", points: 0, note: "" },
  { matchNo: "49-9", stroke: "자유형", gender: "남자", group: "4그룹", isRelay: false, lane: 4, name: "손민재", team: "거제야르", record: "00'35\"93", rank: "4", points: 3, note: "3위(35\"80)와 0.13초 차 4위 입상" },

  // ========================================================================
  // [18p] 경기번호 50-1 ~ 50-6: 자유형 50m · 남5 (남자 5그룹)
  // ========================================================================
  { matchNo: "50-1", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 1, name: "성시명", team: "금빛", record: "00'33\"64", rank: "2", points: 5, note: "" },
  { matchNo: "50-1", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 2, name: "이준혁", team: "거제야호", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "50-1", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 3, name: "김도윤", team: "PSC", record: "00'38\"07", rank: "13", points: 0, note: "" },
  { matchNo: "50-1", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 4, name: "민형찬", team: "거제찬스아이", record: "00'33\"72", rank: "3", points: 4, note: "" },
  { matchNo: "50-2", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 1, name: "이시윤", team: "거제찬스돌핀", record: "00'44\"66", rank: "18", points: 0, note: "" },
  { matchNo: "50-2", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 2, name: "김유신", team: "개인", record: "00'37\"27", rank: "10", points: 0, note: "" },
  { matchNo: "50-2", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 3, name: "이우리", team: "거제야르", record: "00'49\"32", rank: "19", points: 0, note: "" },
  { matchNo: "50-2", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 4, name: "김세민", team: "노블 TNV", record: "00'35\"73", rank: "8", points: 0, note: "" },
  { matchNo: "50-3", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 1, name: "천시후", team: "프리라움웨일", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "50-3", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 2, name: "장하준", team: "거제찬스돌핀", record: "00'39\"96", rank: "15", points: 0, note: "" },
  { matchNo: "50-3", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 3, name: "양서진", team: "거제야르", record: "00'42\"53", rank: "17", points: 0, note: "" },
  { matchNo: "50-3", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 4, name: "이승원", team: "거제찬스아이", record: "00'37\"55", rank: "12", points: 0, note: "" },
  { matchNo: "50-4", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 1, name: "서윤우", team: "노블 TNV", record: "00'35\"38", rank: "7", points: 0, note: "" },
  { matchNo: "50-4", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 2, name: "김도담", team: "다람쥐특공대", record: "00'38\"73", rank: "14", points: 0, note: "" },
  { matchNo: "50-4", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 3, name: "김경민", team: "KJH디지스트", record: "00'36\"45", rank: "9", points: 0, note: "" },
  { matchNo: "50-4", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 4, name: "김남우", team: "개인", record: "00'32\"09", rank: "1", points: 7, note: "" },
  { matchNo: "50-5", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 1, name: "김부진", team: "키튼드림팀", record: "00'51\"28", rank: "20", points: 0, note: "" },
  { matchNo: "50-5", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 2, name: "이현준", team: "노블 TNV", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "50-5", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 3, name: "박주혁", team: "거제야호", record: "00'40\"63", rank: "16", points: 0, note: "" },
  { matchNo: "50-5", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 4, name: "임준후", team: "개인", record: "00'37\"44", rank: "11", points: 0, note: "" },
  { matchNo: "50-6", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 2, name: "오유준", team: "금빛", record: "00'34\"77", rank: "6", points: 1, note: "" },
  { matchNo: "50-6", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 3, name: "하민성", team: "개인", record: "00'34\"70", rank: "4", points: 3, note: "" },
  { matchNo: "50-6", stroke: "자유형", gender: "남자", group: "5그룹", isRelay: false, lane: 4, name: "조은호", team: "PSC", record: "00'34\"72", rank: "5", points: 2, note: "" },

  // ========================================================================
  // [18p] 경기번호 51-1 ~ 51-7: 자유형 50m · 남6 (남자 6그룹)
  // ========================================================================
  { matchNo: "51-1", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 1, name: "정윤서", team: "PSC", record: "00'33\"53", rank: "11", points: 0, note: "" },
  { matchNo: "51-1", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "박승현", team: "거제찬스아이", record: "00'32\"91", rank: "9", points: 0, note: "" },
  { matchNo: "51-1", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 3, name: "고건희", team: "개인", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "51-1", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 4, name: "강진우", team: "금빛", record: "00'30\"76", rank: "2", points: 5, note: "" },
  { matchNo: "51-2", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 1, name: "마정우", team: "거제찬스아이", record: "00'31\"08", rank: "3", points: 4, note: "" },
  { matchNo: "51-2", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "오태훈", team: "거제야르", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "51-2", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 3, name: "최재민", team: "거제찬스아이", record: "00'35\"55", rank: "13", points: 0, note: "" },
  { matchNo: "51-2", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 4, name: "김태완", team: "PSC", record: "00'33\"98", rank: "12", points: 0, note: "" },
  { matchNo: "51-3", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 1, name: "전재우", team: "진주스포츠클럽", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "51-3", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "정선우", team: "개인", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "51-3", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 3, name: "이승원", team: "거제찬스아이", record: "00'31\"96", rank: "5", points: 2, note: "" },
  { matchNo: "51-3", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 4, name: "송시우", team: "거제야호", record: "00'32\"79", rank: "8", points: 0, note: "" },
  { matchNo: "51-4", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 1, name: "김보겸", team: "거제찬스돌핀", record: "00'40\"12", rank: "20", points: 0, note: "" },
  { matchNo: "51-4", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "문우찬", team: "키튼드림팀", record: "00'47\"41", rank: "23", points: 0, note: "" },
  { matchNo: "51-4", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 3, name: "윤상흠", team: "프리라움돌핀", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "51-4", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 4, name: "안유찬", team: "거제찬스아이", record: "00'31\"92", rank: "4", points: 3, note: "" },
  { matchNo: "51-5", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 1, name: "이동근", team: "개인", record: "00'32\"74", rank: "7", points: 0, note: "" },
  { matchNo: "51-5", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "김시윤", team: "노블 TNV", record: "00'33\"00", rank: "10", points: 0, note: "" },
  { matchNo: "51-5", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 3, name: "강한솔", team: "거제찬스아이", record: "00'35\"94", rank: "14", points: 0, note: "" },
  { matchNo: "51-5", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 4, name: "박도현", team: "KJH디지스트", record: "00'39\"81", rank: "19", points: 0, note: "" },
  { matchNo: "51-6", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 1, name: "하민우", team: "개인", record: "00'28\"50", rank: "1", points: 7, note: "" },
  { matchNo: "51-6", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "정준휘", team: "통영유소년수영클럽", record: "00'36\"54", rank: "16", points: 0, note: "" },
  { matchNo: "51-6", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 3, name: "양진혁", team: "거제찬스아이", record: "00'36\"15", rank: "15", points: 0, note: "" },
  { matchNo: "51-6", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 4, name: "김루민", team: "거제야르", record: "00'40\"79", rank: "22", points: 0, note: "" },
  { matchNo: "51-7", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 1, name: "박서후", team: "진주스포츠클럽", record: "00'40\"27", rank: "21", points: 0, note: "" },
  { matchNo: "51-7", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 2, name: "유승현", team: "PSC", record: "00'32\"35", rank: "6", points: 1, note: "" },
  { matchNo: "51-7", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 3, name: "김채완", team: "거제찬스아이", record: "00'37\"31", rank: "17", points: 0, note: "" },
  { matchNo: "51-7", stroke: "자유형", gender: "남자", group: "6그룹", isRelay: false, lane: 4, name: "이지오", team: "금빛", record: "00'38\"01", rank: "18", points: 0, note: "" },

  // ========================================================================
  // [19p] 경기번호 52-1 ~ 52-5: 자유형 50m · 남7 (남자 7그룹)
  // ========================================================================
  { matchNo: "52-1", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 1, name: "김재우", team: "삼성야호", record: "00'31\"16", rank: "9", points: 0, note: "" },
  { matchNo: "52-1", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 2, name: "김승기", team: "거제찬스아이", record: "00'31\"19", rank: "10", points: 0, note: "" },
  { matchNo: "52-1", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 3, name: "임성현", team: "노블 TNV", record: "00'30\"63", rank: "6", points: 1, note: "" },
  { matchNo: "52-1", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 4, name: "최준영", team: "개인", record: "00'29\"21", rank: "3", points: 4, note: "" },
  { matchNo: "52-2", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 1, name: "박은규", team: "개인", record: "00'36\"25", rank: "15", points: 0, note: "" },
  { matchNo: "52-2", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 2, name: "이동민", team: "IMD스위밍클럽", record: "00'27\"60", rank: "2", points: 5, note: "" },
  { matchNo: "52-2", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 3, name: "김종원", team: "삼성야호", record: "00'29\"35", rank: "4", points: 3, note: "" },
  { matchNo: "52-2", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 4, name: "곽민재", team: "KJH디지스트", record: "00'33\"22", rank: "12", points: 0, note: "" },
  { matchNo: "52-3", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 1, name: "원유찬", team: "거제찬스아이", record: "00'27\"27", rank: "1", points: 7, note: "" },
  { matchNo: "52-3", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 2, name: "이선우", team: "거제야르", record: "00'30\"47", rank: "5", points: 2, note: "남7 자유형 5위 입상 (배영 2위 + 자유형 5위)" },
  { matchNo: "52-3", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 3, name: "안상욱", team: "개인", record: "00'37\"32", rank: "16", points: 0, note: "" },
  { matchNo: "52-3", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 4, name: "진시우", team: "삼성야호", record: "00'45\"65", rank: "17", points: 0, note: "" },
  { matchNo: "52-4", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 2, name: "최예준", team: "노블 TNV", record: "00'31\"00", rank: "8", points: 0, note: "" },
  { matchNo: "52-4", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 3, name: "김승후", team: "개인", record: "00'32\"74", rank: "11", points: 0, note: "" },
  { matchNo: "52-4", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 4, name: "추승현", team: "삼성야호", record: "00'35\"69", rank: "14", points: 0, note: "" },
  { matchNo: "52-5", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 2, name: "이다훈", team: "삼성야호", record: "00'30\"99", rank: "7", points: 0, note: "" },
  { matchNo: "52-5", stroke: "자유형", gender: "남자", group: "7그룹", isRelay: false, lane: 3, name: "이지훈", team: "개인", record: "00'34\"83", rank: "13", points: 0, note: "" },

  // ========================================================================
  // [19p] 경기번호 53-1 ~ 53-4: 자유형 50m · 여1 (여자 1그룹)
  // ========================================================================
  { matchNo: "53-1", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 1, name: "김로하", team: "프리라움돌핀", record: "01'08\"84", rank: "15", points: 0, note: "" },
  { matchNo: "53-1", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 2, name: "김소은", team: "거제찬스아이", record: "01'02\"09", rank: "10", points: 0, note: "" },
  { matchNo: "53-1", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 3, name: "황다윤", team: "PSC", record: "01'06\"43", rank: "11", points: 0, note: "" },
  { matchNo: "53-1", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 4, name: "조유빈", team: "오르카스위밍", record: "00'53\"96", rank: "4", points: 3, note: "" },
  { matchNo: "53-2", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 1, name: "백해인", team: "노블 TNV", record: "00'56\"30", rank: "5", points: 2, note: "" },
  { matchNo: "53-2", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 2, name: "임승주", team: "통영유소년수영클럽", record: "00'59\"48", rank: "7", points: 0, note: "" },
  { matchNo: "53-2", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 3, name: "장하나", team: "PSC", record: "01'06\"48", rank: "12", points: 0, note: "" },
  { matchNo: "53-2", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 4, name: "김가연", team: "프리라움돌핀", record: "01'19\"57", rank: "16", points: 0, note: "" },
  { matchNo: "53-3", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 1, name: "여승아", team: "거제찬스돌핀", record: "01'08\"14", rank: "13", points: 0, note: "" },
  { matchNo: "53-3", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 2, name: "김루아", team: "오르카스위밍", record: "00'53\"91", rank: "3", points: 4, note: "" },
  { matchNo: "53-3", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 3, name: "이서빈", team: "KJH디지스트", record: "00'57\"89", rank: "6", points: 1, note: "" },
  { matchNo: "53-3", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 4, name: "하유주", team: "PSC", record: "01'08\"47", rank: "14", points: 0, note: "" },
  { matchNo: "53-4", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 1, name: "김다솔", team: "KJH디지스트", record: "00'48\"85", rank: "2", points: 5, note: "" },
  { matchNo: "53-4", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 2, name: "김가람", team: "키튼드림팀", record: "00'48\"14", rank: "1", points: 7, note: "" },
  { matchNo: "53-4", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 3, name: "김단아", team: "PSC", record: "01'00\"08", rank: "9", points: 0, note: "" },
  { matchNo: "53-4", stroke: "자유형", gender: "여자", group: "1그룹", isRelay: false, lane: 4, name: "김로아", team: "거제찬스아이", record: "00'59\"87", rank: "8", points: 0, note: "" },

  // ========================================================================
  // [21p] 경기번호 56-1 ~ 56-8: 자유형 50m · 여4 (여자 4그룹)
  // ========================================================================
  { matchNo: "56-1", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 1, name: "주하윤", team: "거제찬스돌핀", record: "00'41\"91", rank: "12", points: 0, note: "" },
  { matchNo: "56-1", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 2, name: "최지원", team: "거제찬스샤크", record: "00'46\"86", rank: "18", points: 0, note: "" },
  { matchNo: "56-1", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 3, name: "이유빈", team: "거제야르", record: "00'45\"68", rank: "15", points: 0, note: "" },
  { matchNo: "56-1", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 4, name: "윤지아", team: "프리라움샤크", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "56-2", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 1, name: "오은세", team: "진주스포츠클럽", record: "00'35\"77", rank: "3", points: 4, note: "" },
  { matchNo: "56-2", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 2, name: "코라", team: "프리라움샤크", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "56-2", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 3, name: "김라엘", team: "거제야호", record: "00'42\"88", rank: "13", points: 0, note: "" },
  { matchNo: "56-2", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 4, name: "박서은", team: "거제찬스아이", record: "00'48\"62", rank: "21", points: 0, note: "" },
  { matchNo: "56-3", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 1, name: "이지윤", team: "다람쥐특공대", record: "00'37\"00", rank: "5", points: 2, note: "" },
  { matchNo: "56-3", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 2, name: "김재이", team: "거제찬스아이", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "56-3", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 3, name: "이아린", team: "거제찬스돌핀", record: "00'45\"40", rank: "14", points: 0, note: "" },
  { matchNo: "56-3", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 4, name: "강수아", team: "거제야호", record: "00'41\"36", rank: "10", points: 0, note: "" },
  { matchNo: "56-4", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 1, name: "박채아", team: "KJH디지스트", record: "00'38\"62", rank: "8", points: 0, note: "" },
  { matchNo: "56-4", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 2, name: "이지민", team: "거제야호", record: "00'36\"25", rank: "4", points: 3, note: "" },
  { matchNo: "56-4", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 3, name: "김예지", team: "거제찬스돌핀", record: "00'52\"73", rank: "22", points: 0, note: "" },
  { matchNo: "56-4", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 4, name: "김유주", team: "개인", record: "00'35\"04", rank: "2", points: 5, note: "" },
  { matchNo: "56-5", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 1, name: "한유주", team: "개인", record: "00'58\"10", rank: "23", points: 0, note: "" },
  { matchNo: "56-5", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 2, name: "정유민", team: "오르카스위밍", record: "00'46\"60", rank: "17", points: 0, note: "" },
  { matchNo: "56-5", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 3, name: "이지유", team: "개인", record: "00'47\"52", rank: "19", points: 0, note: "" },
  { matchNo: "56-5", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 4, name: "손주아", team: "프리라움샤크", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "56-6", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 1, name: "김려원", team: "IMD스위밍클럽", record: "00'37\"81", rank: "6", points: 1, note: "" },
  { matchNo: "56-6", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 2, name: "전연서", team: "통영유소년수영클럽", record: "00'45\"97", rank: "16", points: 0, note: "" },
  { matchNo: "56-6", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 3, name: "강예서", team: "KJH디지스트", record: "00'34\"18", rank: "1", points: 7, note: "" },
  { matchNo: "56-7", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 1, name: "정예은", team: "금빛", record: "00'39\"46", rank: "9", points: 0, note: "" },
  { matchNo: "56-7", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 2, name: "이하경", team: "PSC", record: "00'38\"55", rank: "7", points: 0, note: "" },
  { matchNo: "56-7", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 3, name: "이다겸", team: "다람쥐특공대", record: "00'41\"69", rank: "11", points: 0, note: "" },
  { matchNo: "56-8", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 2, name: "성하윤", team: "진주스포츠클럽", record: "00'48\"19", rank: "20", points: 0, note: "" },
  { matchNo: "56-8", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 3, name: "조희진", team: "거제찬스샤크", record: "01'05\"34", rank: "24", points: 0, note: "" },
  { matchNo: "56-8", stroke: "자유형", gender: "여자", group: "4그룹", isRelay: false, lane: 4, name: "서지은", team: "거제찬스돌핀", record: "99'99\"99", rank: "불참", points: 0, note: "" },

  // ========================================================================
  // [21p] 경기번호 57-1 ~ 57-6: 자유형 50m · 여5 (여자 5그룹)
  // ========================================================================
  { matchNo: "57-1", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 1, name: "서하율", team: "거제찬스아이", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "57-1", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 2, name: "류다윤", team: "거제야르", record: "00'33\"85", rank: "1", points: 7, note: "여5 자유형 1위 금메달!" },
  { matchNo: "57-1", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 3, name: "박유나", team: "진주스포츠클럽", record: "00'36\"07", rank: "4", points: 3, note: "" },
  { matchNo: "57-1", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 4, name: "강예지", team: "금빛", record: "00'53\"11", rank: "18", points: 0, note: "" },
  { matchNo: "57-2", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 1, name: "박세은", team: "거제야호", record: "00'34\"27", rank: "2", points: 5, note: "" },
  { matchNo: "57-2", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 2, name: "차세은", team: "거제찬스아이", record: "00'42\"25", rank: "15", points: 0, note: "" },
  { matchNo: "57-2", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 3, name: "한예진", team: "거제야르", record: "00'39\"91", rank: "11", points: 0, note: "" },
  { matchNo: "57-2", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 4, name: "강다현", team: "오르카스위밍", record: "00'45\"05", rank: "17", points: 0, note: "" },
  { matchNo: "57-3", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 1, name: "이윤서", team: "오르카스위밍", record: "00'35\"17", rank: "3", points: 4, note: "" },
  { matchNo: "57-3", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 2, name: "이하린", team: "다람쥐특공대", record: "00'39\"33", rank: "10", points: 0, note: "" },
  { matchNo: "57-3", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 3, name: "엄혜진", team: "거제야호", record: "00'42\"78", rank: "16", points: 0, note: "" },
  { matchNo: "57-3", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 4, name: "지혜람", team: "거제야르", record: "01'04\"20", rank: "20", points: 0, note: "" },
  { matchNo: "57-4", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 1, name: "이나라", team: "거제야르", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "57-4", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 2, name: "김가온", team: "거제찬스돌핀", record: "00'37\"04", rank: "6", points: 1, note: "" },
  { matchNo: "57-4", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 3, name: "김다연", team: "거제야호", record: "00'41\"55", rank: "14", points: 0, note: "" },
  { matchNo: "57-4", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 4, name: "최서윤", team: "거제찬스아이", record: "00'53\"81", rank: "19", points: 0, note: "" },
  { matchNo: "57-5", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 1, name: "김수진", team: "키튼드림팀", record: "00'38\"62", rank: "9", points: 0, note: "" },
  { matchNo: "57-5", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 2, name: "박지후", team: "진주스포츠클럽", record: "00'40\"69", rank: "13", points: 0, note: "" },
  { matchNo: "57-5", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 3, name: "김서현", team: "거제찬스아이", record: "00'38\"38", rank: "8", points: 0, note: "" },
  { matchNo: "57-5", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 4, name: "반서현", team: "거제야호", record: "00'40\"47", rank: "12", points: 0, note: "" },
  { matchNo: "57-6", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 1, name: "안채정", team: "거제찬스돌핀", record: "00'38\"25", rank: "7", points: 0, note: "" },
  { matchNo: "57-6", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 2, name: "김서윤", team: "거제야르", record: "00'36\"25", rank: "5", points: 2, note: "여5 자유형 5위 입상!" },
  { matchNo: "57-6", stroke: "자유형", gender: "여자", group: "5그룹", isRelay: false, lane: 4, name: "윤정인", team: "거제야호", record: "99'99\"99", rank: "불참", points: 0, note: "" },

  // ========================================================================
  // [22p] 경기번호 58-1 ~ 58-5: 자유형 50m · 여6 (여자 6그룹)
  // ========================================================================
  { matchNo: "58-1", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 1, name: "남서희", team: "개인", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "58-1", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 2, name: "명지안", team: "오르카스위밍", record: "00'37\"55", rank: "7", points: 0, note: "" },
  { matchNo: "58-1", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 3, name: "김태연B", team: "개인", record: "88'88\"88", rank: "실격", points: 0, note: "중도포기" },
  { matchNo: "58-1", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 4, name: "김하윤", team: "프리라움샤크", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "58-2", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 1, name: "김승아", team: "개인", record: "00'34\"35", rank: "4", points: 3, note: "" },
  { matchNo: "58-2", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 2, name: "이하림", team: "금빛", record: "00'35\"86", rank: "6", points: 1, note: "" },
  { matchNo: "58-2", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 3, name: "허은유", team: "PSC", record: "00'35\"82", rank: "5", points: 2, note: "" },
  { matchNo: "58-2", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 4, name: "신유리", team: "거제찬스샤크", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "58-3", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 1, name: "이루리", team: "거제야호", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "58-3", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 2, name: "안서현", team: "거제찬스돌핀", record: "00'38\"17", rank: "8", points: 0, note: "" },
  { matchNo: "58-3", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 3, name: "안지현", team: "통영유소년수영클럽", record: "00'32\"45", rank: "2", points: 5, note: "" },
  { matchNo: "58-3", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 4, name: "어서윤", team: "개인", record: "00'34\"16", rank: "3", points: 4, note: "" },
  { matchNo: "58-4", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 1, name: "고하윤", team: "PSC", record: "00'46\"52", rank: "9", points: 0, note: "" },
  { matchNo: "58-4", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 2, name: "박주하", team: "거제찬스샤크", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "58-4", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 3, name: "김도은", team: "개인", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "58-4", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 4, name: "정효빈", team: "KJH디지스트", record: "00'31\"16", rank: "1", points: 7, note: "" },
  { matchNo: "58-5", stroke: "자유형", gender: "여자", group: "6그룹", isRelay: false, lane: 1, name: "김태연B", team: "개인", record: "99'99\"99", rank: "불참", points: 0, note: "" },

  // ========================================================================
  // [22p] 경기번호 59-1 ~ 59-3: 자유형 50m · 여7 (여자 7그룹)
  // ========================================================================
  { matchNo: "59-1", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 2, name: "구윤", team: "통영유소년수영클럽", record: "00'35\"86", rank: "6", points: 1, note: "" },
  { matchNo: "59-1", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 3, name: "정채윤", team: "거제야르", record: "00'32\"98", rank: "2", points: 5, note: "여7 자유형 2위 은메달!" },
  { matchNo: "59-1", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 4, name: "이다은", team: "삼성야호", record: "00'37\"27", rank: "8", points: 0, note: "" },
  { matchNo: "59-2", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 1, name: "김단", team: "거제찬스아이", record: "00'32\"50", rank: "1", points: 7, note: "" },
  { matchNo: "59-2", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 2, name: "안서윤", team: "거제야르", record: "00'33\"68", rank: "3", points: 4, note: "여7 자유형 3위 동메달!" },
  { matchNo: "59-2", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 3, name: "정현서", team: "삼성야호", record: "00'35\"06", rank: "4", points: 3, note: "" },
  { matchNo: "59-2", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 4, name: "원지우", team: "거제찬스아이", record: "00'36\"36", rank: "7", points: 0, note: "" },
  { matchNo: "59-3", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 1, name: "이효민", team: "IMD스위밍클럽", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "59-3", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 2, name: "조안나", team: "개인", record: "99'99\"99", rank: "불참", points: 0, note: "" },
  { matchNo: "59-3", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 3, name: "강보경", team: "키튼드림팀", record: "00'35\"41", rank: "5", points: 2, note: "" },
  { matchNo: "59-3", stroke: "자유형", gender: "여자", group: "7그룹", isRelay: false, lane: 4, name: "김가연", team: "통영유소년수영클럽", record: "00'39\"17", rank: "9", points: 0, note: "" },

  // ========================================================================
  // [23p] 경기번호 60-1 ~ 60-2: 혼계영 200m · 남초 (남자 초등부)
  // ========================================================================
  { matchNo: "60-1", stroke: "혼계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 1, name: "김하준, 김예준, 양서진, 배건우", team: "거제야르", record: "03'41\"82", rank: "7", points: 0, note: "" },
  { matchNo: "60-1", stroke: "혼계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 2, name: "정연우, 이준민, 김도현, 김시윤", team: "노블 TNV", record: "02'35\"45", rank: "1", points: 14, note: "" },
  { matchNo: "60-1", stroke: "혼계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 3, name: "곽동혁, 여승재, 김보겸, 이다온", team: "거제찬스돌핀", record: "03'22\"63", rank: "6", points: 2, note: "" },
  { matchNo: "60-1", stroke: "혼계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 4, name: "김현우, 박솔현, 구노유, 정도현", team: "다람쥐특공대", record: "02'48\"32", rank: "4", points: 6, note: "" },
  { matchNo: "60-2", stroke: "혼계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 1, name: "제유찬, 정찬희, 김태양, 정준휘", team: "통영유소년수영클럽", record: "03'02\"35", rank: "5", points: 4, note: "" },
  { matchNo: "60-2", stroke: "혼계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 2, name: "유승현, 정윤서, 정찬준, 조승우", team: "PSC", record: "88'88\"88", rank: "실격", points: 0, note: "빠른출발" },
  { matchNo: "60-2", stroke: "혼계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 3, name: "한서준, 문강현, 이도준, 김해솔", team: "KJH디지스트", record: "02'46\"42", rank: "3", points: 8, note: "" },
  { matchNo: "60-2", stroke: "혼계영 200m", gender: "남자", group: "남초", isRelay: true, lane: 4, name: "박승현, 신유찬, 안유찬, 이은후", team: "거제찬스아이", record: "02'41\"14", rank: "2", points: 10, note: "" },

  // ========================================================================
  // [23p] 경기번호 61: 혼계영 200m · 남중 (남자 중등부)
  // ========================================================================
  { matchNo: "61", stroke: "혼계영 200m", gender: "남자", group: "남중", isRelay: true, lane: 2, name: "조현서, 이재원, 원유찬, 김승기", team: "거제찬스아이(중등)", record: "02'16\"94", rank: "1", points: 14, note: "" },
  { matchNo: "61", stroke: "혼계영 200m", gender: "남자", group: "남중", isRelay: true, lane: 3, name: "임성현, 최예준, 여준석, 김태하", team: "노블 TNV(중등)", record: "02'24\"65", rank: "3", points: 8, note: "" },
  { matchNo: "61", stroke: "혼계영 200m", gender: "남자", group: "남중", isRelay: true, lane: 4, name: "이다훈, 김종원, 김재우, 오성민", team: "삼성야호(중등)", record: "02'17\"49", rank: "2", points: 10, note: "" },

  // ========================================================================
  // [24p] 경기번호 62-1 ~ 62-3: 혼계영 200m · 여초 (여자 초등부)
  // ========================================================================
  { matchNo: "62-1", stroke: "혼계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 2, name: "강서연, 양지안, 심지유, 김가람", team: "키튼드림팀", record: "03'28\"97", rank: "7", points: 0, note: "" },
  { matchNo: "62-1", stroke: "혼계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 3, name: "김지나, 박서은, 최서윤, 김로아", team: "거제찬스아이", record: "03'15\"09", rank: "6", points: 2, note: "" },
  { matchNo: "62-1", stroke: "혼계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 4, name: "윤지민, 안지현, 전연서, 임하율", team: "통영유소년수영클럽", record: "03'04\"18", rank: "4", points: 6, note: "" },
  { matchNo: "62-2", stroke: "혼계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 2, name: "엄유민, 이지민, 엄혜진, 반서현", team: "거제야호", record: "03'10\"00", rank: "5", points: 4, note: "" },
  { matchNo: "62-2", stroke: "혼계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 3, name: "김유희, 이루비, 이하경, 정예울", team: "PSC", record: "02'57\"98", rank: "3", points: 8, note: "" },
  { matchNo: "62-2", stroke: "혼계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 4, name: "이유주, 김서연, 이채빈, 황부민", team: "노블 TNV", record: "02'53\"60", rank: "2", points: 10, note: "" },
  { matchNo: "62-3", stroke: "혼계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 2, name: "강예서, 전지예, 정효빈, 김지율", team: "KJH디지스트", record: "02'45\"32", rank: "1", points: 14, note: "" },
  { matchNo: "62-3", stroke: "혼계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 3, name: "오은서, 백미소, 안서현, 최시원", team: "거제찬스돌핀", record: "03'40\"80", rank: "8", points: 0, note: "" },
  { matchNo: "62-3", stroke: "혼계영 200m", gender: "여자", group: "여초", isRelay: true, lane: 4, name: "김서윤, 이유빈, 류다윤, 이설하", team: "거제야르", record: "88'88\"88", rank: "실격", points: 0, note: "레인잡고추진, 발이닿고 걸었음" }
];
