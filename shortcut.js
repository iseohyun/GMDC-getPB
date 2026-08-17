// shortcut.js - GMDC 수영대회 단축키 모듈
// 단축키:
//   G: 성인부 이동 (스크롤 위치 유지)
//   S: 학생부 이동 (스크롤 위치 유지)
//   T: 단체전 (기록 및 조합) 보기 (스크롤 위치 유지)
//   I: 개인전 (종목별 출전 명단) 보기 (스크롤 위치 유지)

(function initShortcuts() {
  const SCROLL_POS_KEY = 'gmdc_nav_scroll_y';

  // 페이지 이동 후 이전 스크롤 위치 복원
  function restoreSavedScroll() {
    const saved = sessionStorage.getItem(SCROLL_POS_KEY);
    if (saved !== null) {
      sessionStorage.removeItem(SCROLL_POS_KEY);
      const pos = parseFloat(saved);
      if (!isNaN(pos) && pos > 0) {
        window.scrollTo({ top: pos, behavior: 'instant' });
        setTimeout(() => window.scrollTo({ top: pos, behavior: 'instant' }), 50);
        setTimeout(() => window.scrollTo({ top: pos, behavior: 'instant' }), 150);
        setTimeout(() => window.scrollTo({ top: pos, behavior: 'instant' }), 300);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreSavedScroll);
  } else {
    restoreSavedScroll();
  }

  window.addEventListener('keydown', (e) => {
    // 입력 필드(input, textarea, select) 또는 contenteditable 활성화 상태 시 단축키 무시
    const target = e.target;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    // Ctrl, Alt, Meta(Cmd) 등 조합키 사용 시 단축키 무시 (브라우저 기본 동작 보존)
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    const key = e.key.toLowerCase();

    switch (key) {
      case 'g': {
        // 성인부 페이지로 이동
        e.preventDefault();
        const currentPath = window.location.pathname;
        const isAdultPage = currentPath.endsWith('index.html') || currentPath === '/' || currentPath.endsWith('/');
        if (isAdultPage) {
          if (typeof window.showToast === 'function') {
            window.showToast('🏊 현재 성인부 페이지입니다.');
          }
        } else {
          sessionStorage.setItem(SCROLL_POS_KEY, window.scrollY.toString());
          window.location.href = 'index.html' + (window.location.hash || '');
        }
        break;
      }
      case 's': {
        // 학생부 페이지로 이동
        e.preventDefault();
        const currentPath = window.location.pathname;
        const isStudentPage = currentPath.endsWith('student.html');
        if (isStudentPage) {
          if (typeof window.showToast === 'function') {
            window.showToast('🏊 현재 학생부 페이지입니다.');
          }
        } else {
          sessionStorage.setItem(SCROLL_POS_KEY, window.scrollY.toString());
          window.location.href = 'student.html' + (window.location.hash || '');
        }
        break;
      }
      case 't': {
        // 단체전 보기 전환
        e.preventDefault();
        const prevScroll = window.scrollY;
        const btnRecords = document.getElementById('btnToggleRecords');
        if (btnRecords) {
          btnRecords.click();
        } else if (typeof window.switchView === 'function') {
          window.switchView('records');
        }
        if (prevScroll > 0) {
          window.scrollTo({ top: prevScroll, behavior: 'instant' });
        }
        break;
      }
      case 'i': {
        // 개인전 보기 전환
        e.preventDefault();
        const prevScroll = window.scrollY;
        const btnEvents = document.getElementById('btnToggleEvents');
        if (btnEvents) {
          btnEvents.click();
        } else if (typeof window.switchView === 'function') {
          window.switchView('events');
        }
        if (prevScroll > 0) {
          window.scrollTo({ top: prevScroll, behavior: 'instant' });
        }
        break;
      }
      default:
        break;
    }
  });

  console.log('%c[GMDC Shortcuts] 활성화: [G] 성인부, [S] 학생부, [T] 단체전, [I] 개인전 (스크롤 위치 보존)', 'color: #10b981; font-weight: bold;');
})();
