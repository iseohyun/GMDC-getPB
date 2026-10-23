// ==========================================================================
// GMDC Swim Club - Collapsible Sidebar Navigation & SPA Router Component
// 카테고리별 사이드바: 1.명부 / 2.훈련일지 / 3.대회기록 / 4.관리자 설정
// ==========================================================================

import { isAdmin, initAuth, getCurrentUser, loginWithGoogle, logoutUser, formatUserDisplayName } from "./auth.js?v=20260909_03";

const SIDEBAR_COLLAPSED_KEY = 'gmdc_sidebar_collapsed';

export const SPA_ROUTES = {
  '#/roster-student-indiv':   { url: 'student-member.html?view=events', title: '학생 개인', catId: 'cat-roster', itemId: 'student-indiv' },
  '#/roster-student-relay':   { url: 'student-member.html?view=records', title: '학생 단체', catId: 'cat-roster', itemId: 'student-relay' },
  '#/roster-adult-indiv':     { url: 'adult-member.html?view=events', title: '성인 개인', catId: 'cat-roster', itemId: 'adult-indiv' },
  '#/roster-adult-relay':     { url: 'adult-member.html?view=records', title: '성인 단체', catId: 'cat-roster', itemId: 'adult-relay' },
  '#/training-attendance':    { url: 'attendance.html', title: '출석부', catId: 'cat-training', itemId: 'attendance' },
  '#/training-calendar':      { url: 'training_calendar.html', title: '일정표', catId: 'cat-training', itemId: 'calendar' },
  '#/training-meeting':       { url: 'meeting_notes.html', title: '운영기록', catId: 'cat-training', itemId: 'meeting' },
  '#/competition-prospectus':    { url: 'prospectus.html', title: '모집요강', catId: 'cat-competition', itemId: 'prospectus' },
  '#/competition-coach-meeting': { url: 'coach-meeting.html?v=20261024_05', title: '감독자회의요강', catId: 'cat-competition', itemId: 'coach-meeting' },
  '#/competition-live-student': { url: 'live-schedule.html?div=student&v=20261024_04', title: '학생부 (24일)', catId: 'cat-competition', itemId: 'live-student' },
  '#/competition-live-adult':   { url: 'live-schedule.html?div=adult&v=20261024_04', title: '성인부 (25일)', catId: 'cat-competition', itemId: 'live-adult' },
  '#/admin-settings':         { url: 'admin.html', title: '관리자 설정', catId: 'cat-admin', itemId: 'admin-settings', adminOnly: true }
};

const MENU_CATEGORIES = [
  {
    id: "cat-roster",
    title: "1. 명부",
    icon: "👥",
    items: [
      { id: "student-indiv", title: "학생 개인", hash: "#/roster-student-indiv", icon: "🧒" },
      { id: "student-relay", title: "학생 단체", hash: "#/roster-student-relay", icon: "🤝" },
      { id: "adult-indiv",   title: "성인 개인", hash: "#/roster-adult-indiv", icon: "🏊" },
      { id: "adult-relay",   title: "성인 단체", hash: "#/roster-adult-relay", icon: "🏆" }
    ]
  },
  {
    id: "cat-training",
    title: "2. 훈련일지",
    icon: "📖",
    items: [
      { id: "attendance", title: "출석부",   hash: "#/training-attendance", icon: "📋" },
      { id: "calendar",   title: "일정표",   hash: "#/training-calendar",   icon: "📅" },
      { id: "meeting",    title: "운영기록", hash: "#/training-meeting",    icon: "📝" },
      { id: "fee",        title: "회비내역", hash: "#fee",                  icon: "💰", action: "feeModal" }
    ]
  },
  {
    id: "cat-competition",
    title: "3. 대회기록",
    icon: "🏅",
    items: [
      { id: "prospectus",    title: "모집요강",               hash: "#/competition-prospectus",    icon: "📄" },
      { id: "coach-meeting", title: "감독자회의요강",          hash: "#/competition-coach-meeting", icon: "📋" },
      { id: "live-student",  title: "학생부 (24일)",          hash: "#/competition-live-student",  icon: "⏱️" },
      { id: "live-adult",    title: "성인부 (25일)",          hash: "#/competition-live-adult",    icon: "⏱️" }
    ]
  },
  {
    id: "cat-admin",
    title: "4. 관리자 설정",
    icon: "⚙️",
    adminOnly: false, // 기본으로 항상 노출됨
    items: [
      { id: "admin-settings", title: "관리자 설정", hash: "#/admin-settings", icon: "🔒", action: "adminCheck" }
    ]
  }
];

/**
 * 사이드바 컴포넌트 초기화
 */
export function initSidebar() {
  // If running inside an iframe, do not initialize sidebar
  if (window.self !== window.top) return;
  if (document.getElementById('gmdcSidebar')) return;

  // 1. body 기본 클래스 설정
  document.body.classList.add('with-sidebar');
  const isCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  if (isCollapsed) {
    document.body.classList.add('sidebar-collapsed');
  }

  // 2. 사이드바 DOM 구조 생성
  const sidebarEl = document.createElement('aside');
  sidebarEl.id = 'gmdcSidebar';
  sidebarEl.className = 'gmdc-sidebar';
  sidebarEl.innerHTML = buildSidebarHTML();

  const backdropEl = document.createElement('div');
  backdropEl.id = 'sidebarBackdrop';
  backdropEl.className = 'sidebar-backdrop';

  document.body.prepend(backdropEl);
  document.body.prepend(sidebarEl);

  // 3. 헤더 좌측에 햄버거 토글 버튼 주입
  injectMobileHamburgerButton();

  // 4. 이벤트 바인딩
  bindSidebarEvents(sidebarEl, backdropEl);

  // 5. Auth 상태 구독 및 하단 사용자 프로필 렌더링
  initAuth({
    onAuthChange: (authInfo) => {
      const user = authInfo ? (authInfo.user || null) : null;
      updateSidebarUserProfile(user);
    }
  });
  updateSidebarUserProfile(getCurrentUser());

  // 6. SPA 라우팅 초기화
  initSpaRouter();
}

/**
 * 사이드바 내부 HTML 구성
 */
function buildSidebarHTML() {
  const categoriesHtml = MENU_CATEGORIES.map(cat => {
    const catId = cat.id;

    const itemsHtml = cat.items.map(item => {
      const dataAction = item.action ? `data-action="${item.action}"` : '';
      return `
        <a href="${item.hash}" class="sidebar-item-link" id="navItem-${item.id}" data-item-id="${item.id}" data-hash="${item.hash}" ${dataAction}>
          <span class="item-icon">${item.icon}</span>
          <span class="item-title">${item.title}</span>
        </a>
      `;
    }).join('');

    return `
      <div class="sidebar-category" id="${catId}">
        <div class="sidebar-cat-header" data-cat-id="${catId}">
          <div class="cat-title-wrap">
            <span class="cat-icon">${cat.icon}</span>
            <span>${cat.title}</span>
          </div>
          <span class="cat-arrow">▼</span>
        </div>
        <div class="sidebar-submenu">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="sidebar-header">
      <a href="index.html" class="sidebar-brand">
        <span class="sidebar-logo-icon">🏊</span>
        <div class="sidebar-brand-text">
          <span class="brand-title">거제시장배 2026</span>
          <span class="brand-subtitle">전국마스터즈 수영대회</span>
        </div>
      </a>
      <button type="button" class="btn-sidebar-collapse" id="btnToggleSidebar" title="사이드바 접기/펼치기" aria-label="사이드바 접기/펼치기">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button type="button" class="btn-mobile-sidebar-close" id="btnMobileCloseSidebar" aria-label="메뉴 닫기">✕</button>
    </div>

    <nav class="sidebar-menu" aria-label="카테고리 네비게이션">
      ${categoriesHtml}
    </nav>

    <!-- 사이드바 최하단: 현재 로그인 계정 정보 및 로그인/로그아웃 -->
    <div class="sidebar-footer" id="sidebarFooter">
      <div class="sidebar-user-card" id="sidebarUserCard">
        <button type="button" class="btn-sidebar-login" id="btnSidebarLogin">
          <svg class="google-svg" viewBox="0 0 24 24" width="14" height="14">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>구글 로그인</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * 사이드바 최하단 사용자 프로필 갱신
 */
export function updateSidebarUserProfile(user) {
  const card = document.getElementById('sidebarUserCard');
  if (!card) return;

  if (user && user.email) {
    const isUserAdmin = isAdmin();
    const displayName = formatUserDisplayName(user) || user.email.split('@')[0];
    const initial = displayName.charAt(0).toUpperCase();
    const avatarHtml = user.photoURL 
      ? `<img src="${user.photoURL}" class="user-avatar-img" alt="${displayName}">`
      : `<div class="user-avatar-icon">${initial}</div>`;

    card.innerHTML = `
      <div class="user-info-area">
        ${avatarHtml}
        <div class="user-name-text">
          <span class="user-display-name">${displayName}</span>
          <span class="user-role-badge">${isUserAdmin ? '🛡️ 관리자' : '일반 회원'}</span>
        </div>
      </div>
      <button type="button" class="btn-sidebar-logout" id="btnSidebarLogout" title="로그아웃" aria-label="로그아웃">🚪</button>
    `;
  } else {
    card.innerHTML = `
      <button type="button" class="btn-sidebar-login" id="btnSidebarLogin">
        <svg class="google-svg" viewBox="0 0 24 24" width="14" height="14">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>구글 로그인</span>
      </button>
    `;
  }
}

/**
 * 햄버거 토글 버튼 주입
 */
function injectMobileHamburgerButton() {
  const header = document.querySelector('.app-header');
  if (!header) return;

  const headerLeft = header.querySelector('.header-left') || header;
  if (headerLeft.querySelector('.btn-mobile-sidebar-toggle')) return;

  const btnHamburger = document.createElement('button');
  btnHamburger.type = 'button';
  btnHamburger.className = 'btn-mobile-sidebar-toggle';
  btnHamburger.id = 'btnMobileSidebarToggle';
  btnHamburger.setAttribute('aria-label', '메뉴 열기');
  btnHamburger.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  `;

  headerLeft.prepend(btnHamburger);
}

/**
 * 사이드바 인터랙션 바인딩
 */
function bindSidebarEvents(sidebarEl, backdropEl) {
  // 접기/펼치기 토글
  const btnToggle = sidebarEl.querySelector('#btnToggleSidebar');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const isNowCollapsed = document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isNowCollapsed));
    });
  }

  // 모바일 드로어
  const btnMobileToggle = document.getElementById('btnMobileSidebarToggle');
  const btnMobileClose = sidebarEl.querySelector('#btnMobileCloseSidebar');

  function closeMobileSidebar() {
    sidebarEl.classList.remove('mobile-open');
    backdropEl.classList.remove('active');
  }

  function openMobileSidebar() {
    sidebarEl.classList.add('mobile-open');
    backdropEl.classList.add('active');
  }

  if (btnMobileToggle) btnMobileToggle.addEventListener('click', openMobileSidebar);
  if (btnMobileClose) btnMobileClose.addEventListener('click', closeMobileSidebar);
  if (backdropEl) backdropEl.addEventListener('click', closeMobileSidebar);

  // 로그인 / 로그아웃 클릭 이벤트 위임
  sidebarEl.addEventListener('click', async (e) => {
    const loginBtn = e.target.closest('#btnSidebarLogin');
    if (loginBtn) {
      e.preventDefault();
      try {
        const u = await loginWithGoogle();
        if (u) {
          updateSidebarUserProfile(u);
          const spaFrame = document.getElementById('spaFrame');
          if (spaFrame && spaFrame.contentWindow) {
            try { spaFrame.contentWindow.location.reload(); } catch (err) {}
          }
        }
      } catch (err) {
        console.error("Sidebar Google Login error:", err);
      }
      return;
    }

    const logoutBtn = e.target.closest('#btnSidebarLogout');
    if (logoutBtn) {
      e.preventDefault();
      const curr = getCurrentUser();
      const displayName = curr ? (formatUserDisplayName(curr) || curr.email.split('@')[0]) : '사용자';
      if (confirm(`'${displayName}' 님, 로그아웃하시겠습니까?`)) {
        await logoutUser();
        updateSidebarUserProfile(null);
        const spaFrame = document.getElementById('spaFrame');
        if (spaFrame && spaFrame.contentWindow) {
          try { spaFrame.contentWindow.location.reload(); } catch (err) {}
        }
      }
      return;
    }
  });

  // 카테고리 아코디언
  sidebarEl.querySelectorAll('.sidebar-cat-header').forEach(header => {
    header.addEventListener('click', () => {
      const catBlock = header.closest('.sidebar-category');
      if (catBlock) catBlock.classList.toggle('collapsed');
    });
  });

  // 메뉴 링크 클릭
  sidebarEl.querySelectorAll('.sidebar-item-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      const action = link.getAttribute('data-action');
      const hash = link.getAttribute('data-hash');

      if (action === 'feeModal') {
        e.preventDefault();
        showFeeModal();
        closeMobileSidebar();
        return;
      }

      if (action === 'coachNotice') {
        e.preventDefault();
        showCoachNoticeModal();
        closeMobileSidebar();
        return;
      }

      if (action === 'adminCheck') {
        // 관리자 설정 클릭 시: 로그인 검사
        const user = getCurrentUser();
        if (!user) {
          e.preventDefault();
          if (confirm("관리자 설정에 접근하려면 로그인이 필요합니다.\n지금 Google 계정으로 로그인하시겠습니까?")) {
            try {
              const loggedUser = await loginWithGoogle();
              if (isAdmin()) {
                navigateToRoute('#/admin-settings');
              } else {
                alert(`로그인된 계정(${loggedUser.email})은 관리자 권한이 없습니다.`);
              }
            } catch (err) {
              console.warn("Login canceled or failed:", err);
            }
          }
          closeMobileSidebar();
          return;
        }

        if (!isAdmin()) {
          e.preventDefault();
          alert(`현재 로그인된 계정(${user.email})은 관리자 권한이 없습니다.\n관리자 이메일로 다시 로그인해 주세요.`);
          closeMobileSidebar();
          return;
        }
      }

      // SPA 라우팅 실행
      if (hash && SPA_ROUTES[hash]) {
        e.preventDefault();
        navigateToRoute(hash);
        closeMobileSidebar();
      }
    });
  });
}

/**
 * SPA 라우팅 처리 함수
 */
export function navigateToRoute(hash) {
  const route = SPA_ROUTES[hash];
  if (!route) return;

  window.location.hash = hash;

  const spaFrame = document.getElementById('spaFrame');
  if (spaFrame) {
    // 메인 SPA 셸 환경인 경우 iframe에 로드
    if (spaFrame.getAttribute('data-current-hash') !== hash) {
      spaFrame.src = route.url;
      spaFrame.setAttribute('data-current-hash', hash);
    }
  } else {
    // SPA 외부에서 호출된 경우 index.html#/해시 로 이동
    window.location.href = `index.html${hash}`;
  }

  highlightActiveItem(route.itemId, route.catId);
}

/**
 * 현재 활성화된 메뉴 하이라이트
 */
function highlightActiveItem(itemId, catId) {
  document.querySelectorAll('.sidebar-item-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.getElementById(`navItem-${itemId}`);
  if (activeLink) {
    activeLink.classList.add('active');
    const catBlock = document.getElementById(catId);
    if (catBlock) catBlock.classList.remove('collapsed');
  }
}

/**
 * SPA 라우터 초기화
 */
function initSpaRouter() {
  const spaFrame = document.getElementById('spaFrame');
  if (!spaFrame) {
    // 단독 서브 페이지에서 실행된 경우: URL에 맞는 메뉴 활성화만 수행
    highlightMenuFromUrl();
    return;
  }

  // 초기 해시 판별 (기본: 출석부)
  let currentHash = window.location.hash || '#/training-attendance';
  if (!SPA_ROUTES[currentHash]) {
    currentHash = '#/training-attendance';
  }

  navigateToRoute(currentHash);

  // 해시 변경 감지
  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash;
    if (SPA_ROUTES[newHash]) {
      navigateToRoute(newHash);
    }
  });
}

function highlightMenuFromUrl() {
  const file = window.location.pathname.split('/').pop();
  const search = window.location.search;
  const hash = window.location.hash;
  const fullTarget = `${file}${search}`;
  for (const [, route] of Object.entries(SPA_ROUTES)) {
    if (route.url === fullTarget) {
      highlightActiveItem(route.itemId, route.catId);
      return;
    }
  }
  if (file === 'adult-member.html') {
    highlightActiveItem(hash === '#events' ? 'adult-indiv' : 'adult-relay', 'cat-roster');
    return;
  }
  if (file === 'student-member.html') {
    highlightActiveItem(hash === '#events' ? 'student-indiv' : 'student-relay', 'cat-roster');
    return;
  }
  for (const [, route] of Object.entries(SPA_ROUTES)) {
    if (route.url.split('?')[0] === file) {
      highlightActiveItem(route.itemId, route.catId);
      break;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 팝업 모달 다이얼로그 (회비내역 & 감독자회의요강)
// ──────────────────────────────────────────────────────────────────────────

function showFeeModal() {
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-modal-overlay';
  overlay.innerHTML = `
    <div class="sidebar-modal-box">
      <h3><span>💰</span> GMDC 클럽 회비 및 재정 현황</h3>
      <p>
        <strong>• 대회 참가비 및 특별 훈련 회비</strong>는 총무단 및 운영진을 통해 투명하게 집행되고 있습니다.<br>
        <strong>• 세부 결산 및 집행 내역</strong>은 <code>운영기록 (회의록)</code> 페이지의 재정 보고서 항목에서 확인하실 수 있습니다.
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px;">
        <div><strong>입금 계좌:</strong> 카카오뱅크 (총무단)</div>
        <div style="color: #64748b; margin-top: 4px;">문의: 거제오션 GMDC 총무단 및 운영진</div>
      </div>
      <div class="sidebar-modal-actions">
        <button type="button" class="btn-sidebar-modal-close" id="btnGoMeetingNotes" style="background:#f1f5f9; color:#475569; margin-right:auto;">운영기록 보러가기</button>
        <button type="button" class="btn-sidebar-modal-close" id="btnCloseFeeModal">닫기</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnCloseFeeModal').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnGoMeetingNotes').addEventListener('click', () => {
    overlay.remove();
    navigateToRoute('#/training-meeting');
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function showCoachNoticeModal() {
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-modal-overlay';
  overlay.innerHTML = `
    <div class="sidebar-modal-box">
      <h3><span>📢</span> 감독자 회의 요강 안내</h3>
      <p>
        <strong>2026년 제19회 거제시장배 전국마스터즈 수영대회</strong><br>
        감독자 회의는 대회 직전(10월 23일경) 거제시수영연맹 주관으로 소집 진행될 예정입니다.<br><br>
        회의에서 확정되는 <strong>레인 배정 특이사항, 워밍업 수용 계획, 현장 계측 및 시상 안내</strong> 최종안이 나오는 즉시 본 메뉴에 원문 파일과 함께 공지됩니다.
      </p>
      <div class="sidebar-modal-actions">
        <button type="button" class="btn-sidebar-modal-close" id="btnCloseCoachModal">확인</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnCloseCoachModal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ──────────────────────────────────────────────────────────────────────────
// DOM 준비 시 자동 실행
// ──────────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar);
} else {
  initSidebar();
}
