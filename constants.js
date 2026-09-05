// ==========================================================================
// GMDC Swim Club - Domain Constants (중앙 상수 파일)
// Extracted from auth.js, attendance.js.
// Edit here to affect all modules that import these values.
// ==========================================================================

// ─── Admin & Access Control ───────────────────────────────────────────────
/**
 * List of admin email addresses (lowercase).
 * Add additional admins here — no code logic changes needed.
 */
export const ADMIN_EMAILS = ['iseohyun@hanmail.net'];

/**
 * Deadline for non-admin record edits (ISO 8601 + KST offset)
 */
export const DEADLINE_ISO = '2026-09-01T18:00:00+09:00';

// ─── Training Schedule ────────────────────────────────────────────────────
/**
 * Fixed 4-session training dates for the 2026 season.
 * Each entry: { key: 'YYYY-MM-DD', label: 'MM/DD(요)', title: 'N회차 설명' }
 */
export const ATTENDANCE_DATES = [
  { key: '2026-09-06', label: '09/06(일)', title: '1회차 (09월 06일 일요일)' },
  { key: '2026-09-13', label: '09/13(일)', title: '2회차 (09월 13일 일요일)' },
  { key: '2026-10-11', label: '10/11(일)', title: '3회차 (10월 11일 일요일)' },
  { key: '2026-10-18', label: '10/18(일)', title: '4회차 (10월 18일 일요일)' }
];

// ─── Official Match Schedule ──────────────────────────────────────────────
/**
 * Competition event order based on Prospectus Section 5 (개정판).
 * Used by attendance.js to highlight swimmer participation in the schedule modal.
 */
export const OFFICIAL_MATCH_SCHEDULE = {
  student: {
    dayLabel: '10월 24일(토) - 학생부 (1일차)',
    divisionLabel: '학생부',
    badgeClass: 'student',
    warmup: '06:30 ~ 08:00',
    startTime: '08:30 ~',
    events: [
      { order: 1, name: '학생부 계영 200m',    type: 'relay', stroke: 'free_relay',    dist: '200m' },
      { order: 2, name: '학생부 접영 50m',      type: 'indiv', stroke: '접영',          dist: '50m'  },
      { order: 3, name: '학생부 배영 50m',      type: 'indiv', stroke: '배영',          dist: '50m'  },
      { order: 4, name: '학생부 평영 50m',      type: 'indiv', stroke: '평영',          dist: '50m'  },
      { order: 5, name: '학생부 자유형 50m',    type: 'indiv', stroke: '자유형',        dist: '50m'  },
      { order: 6, name: '학생부 혼계영 200m',   type: 'relay', stroke: 'medley_relay',  dist: '200m' }
    ]
  },
  adult: {
    dayLabel: '10월 25일(일) - 성인부 (2일차)',
    divisionLabel: '성인부',
    badgeClass: 'adult',
    warmup: '06:30 ~ 08:00',
    startTime: '08:30 ~',
    events: [
      { order: 1, name: '성인부 핀접영 50m',       type: 'indiv', stroke: '핀접영',         dist: '50m'  },
      { order: 2, name: '성인부 배영 50m',          type: 'indiv', stroke: '배영',           dist: '50m'  },
      { order: 3, name: '성인부 계영 200m',         type: 'relay', stroke: 'free_relay',     dist: '200m' },
      { order: 4, name: '성인부 접영 50m',          type: 'indiv', stroke: '접영',           dist: '50m'  },
      { order: 5, name: '성인부 핀자유형 50m',      type: 'indiv', stroke: '핀자유형',       dist: '50m'  },
      { order: 6, name: '성인부 평영 50m',          type: 'indiv', stroke: '평영',           dist: '50m'  },
      { order: 7, name: '성인부 혼계영 200m',       type: 'relay', stroke: 'medley_relay',   dist: '200m' },
      { order: 8, name: '성인부 자유형 50m',        type: 'indiv', stroke: '자유형',         dist: '50m'  },
      { order: 9, name: '성인부 혼성핀계영 300m',   type: 'relay', stroke: 'fin_mixed_relay', dist: '300m' }
    ]
  }
};

// ─── LocalStorage Key Namespace ──────────────────────────────────────────
/**
 * All localStorage keys used across the app, grouped by module.
 * Prevents accidental key-name collisions and makes key discovery easy.
 */
export const STORAGE_KEYS = {
  // attendance.js
  ATTENDANCE_CACHE:       'gmdc_attendance_cache_v1',
  ATTENDANCE_LAST_UPDATED:'gmdc_attendance_last_updated_v1',
  ATTENDANCE_VIEW_MODE:   'gmdc_attendance_view_mode',
  ATTENDANCE_EVENTS_MODE: 'gmdc_attendance_events_mode',

  // app.js / student.js
  ADULT_RECORDS:          'gmdc_swim_records_v1',
  STUDENT_RECORDS:        'gmdc_student_records_v1',
  ADULT_PINNED_RELAYS:    'gmdc_pinned_relays_v2',
  STUDENT_PINNED_RELAYS:  'gmdc_student_pinned_relays_v1',
  ADULT_TEAM:             'gmdc_adult_team',
  EVENTS_VIEW_MODE:       'gmdc_events_view_mode',
  RECORDS_VIEW_MODE:      'gmdc_records_view_mode',
  MATRIX_COMPARE_MODE:    'gmdc_matrix_compare_mode',
  PINNED_CARD_ID:         'gmdc_pinned_card_id',
  HIDE_NOTICE_MODAL_DATE: 'gmdc_hide_notice_modal_date',
};
