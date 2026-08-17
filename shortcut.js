// shortcut.js - GMDC 수영대회 단축키 모듈
// 단축키:
//   G: 성인부 이동
//   S: 학생부 이동
//   T: 단체전 (기록 및 조합) 보기
//   I: 개인전 (종목별 출전 명단) 보기

(function initShortcuts() {
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
          window.location.href = 'index.html';
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
          window.location.href = 'student.html';
        }
        break;
      }
      case 't': {
        // 단체전 보기 전환
        e.preventDefault();
        const btnRecords = document.getElementById('btnToggleRecords');
        if (btnRecords) {
          btnRecords.click();
        } else if (typeof window.switchView === 'function') {
          window.switchView('records');
        }
        break;
      }
      case 'i': {
        // 개인전 보기 전환
        e.preventDefault();
        const btnEvents = document.getElementById('btnToggleEvents');
        if (btnEvents) {
          btnEvents.click();
        } else if (typeof window.switchView === 'function') {
          window.switchView('events');
        }
        break;
      }
      default:
        break;
    }
  });

  console.log('%c[GMDC Shortcuts] 활성화: [G] 성인부, [S] 학생부, [T] 단체전, [I] 개인전', 'color: #10b981; font-weight: bold;');
})();
