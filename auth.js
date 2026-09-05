// ==================================================================
// GMDC Swim Club - Google Authentication & Role-Based Access Control
// ==================================================================

import { firebaseApp } from "./firebase-config.js";
import { ADMIN_EMAILS, DEADLINE_ISO } from "./constants.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  onSnapshot,
  setDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(firebaseApp);

// Re-export for backward compatibility (modules that import ADMIN_EMAIL from auth.js)
export const ADMIN_EMAIL = ADMIN_EMAILS[0];
export { DEADLINE_ISO };

let currentUser = null;
let toastHandler = null;
let authChangeCallbacks = [];

// Dynamic Permissions State from Firestore (config/permissions)
let permissionState = {
  masterAdmin: "iseohyun@hanmail.net",
  adminEmails: [...ADMIN_EMAILS],
  admins: {
    "iseohyun@hanmail.net": {
      role: "master",
      name: "최고 관리자",
      permissions: { attendance: true, roster: true, operation: true, calendar: true, adminManage: true }
    }
  },
  attendanceEdit: "all",   // 'all' | 'admin'
  rosterEdit: "admin",     // 'admin' | 'all'
  operationView: "all"     // 'all' | 'admin' (운영기록 열람 권한)
};

// Start listening to config/permissions in Firestore
try {
  const permDocRef = doc(db, "config", "permissions");
  onSnapshot(permDocRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const master = data.masterAdmin || "iseohyun@hanmail.net";
      const emails = Array.isArray(data.adminEmails) 
        ? data.adminEmails.map(e => String(e).toLowerCase().trim()) 
        : [...ADMIN_EMAILS];
      if (!emails.includes(master.toLowerCase().trim())) {
        emails.unshift(master.toLowerCase().trim());
      }

      // Restore or build granular admins map
      const adminsMap = data.admins && typeof data.admins === 'object' ? { ...data.admins } : {};
      // Ensure master admin has full permissions
      adminsMap[master.toLowerCase().trim()] = {
        role: "master",
        name: (adminsMap[master.toLowerCase().trim()] && adminsMap[master.toLowerCase().trim()].name) || "최고 관리자",
        permissions: { attendance: true, roster: true, operation: true, calendar: true, adminManage: true }
      };

      // Ensure any email in adminEmails exists in admins map
      emails.forEach(em => {
        if (!adminsMap[em]) {
          adminsMap[em] = {
            role: "manager",
            name: em.split('@')[0],
            permissions: { attendance: true, roster: true, operation: true, calendar: true, adminManage: false }
          };
        }
      });

      permissionState = {
        masterAdmin: master,
        adminEmails: emails,
        admins: adminsMap,
        attendanceEdit: data.attendanceEdit || "all",
        rosterEdit: data.rosterEdit || "admin",
        operationView: data.operationView || "all"
      };
    }
    applyAuthState();
  }, (err) => {
    console.warn("Firestore config/permissions listener warning:", err);
  });
} catch (e) {
  console.warn("Could not attach permissions listener:", e);
}

export function getPermissionState() {
  return { ...permissionState };
}

export function isDeadlineExpired() {
  return new Date() > new Date(DEADLINE_ISO);
}

export function getCurrentUser() {
  return currentUser;
}

export function isLoggedIn() {
  return currentUser !== null;
}

export function isAdmin() {
  if (!currentUser || !currentUser.email) return false;
  const userEmail = currentUser.email.toLowerCase().trim();
  return permissionState.adminEmails.includes(userEmail) || ADMIN_EMAILS.includes(userEmail);
}

export function isMasterAdmin() {
  if (!currentUser || !currentUser.email) return false;
  return currentUser.email.toLowerCase().trim() === permissionState.masterAdmin.toLowerCase().trim();
}

export function hasPermission(permKey) {
  if (!currentUser || !currentUser.email) return false;
  const userEmail = currentUser.email.toLowerCase().trim();
  if (isMasterAdmin()) return true; // Master Admin has all permissions
  if (!isAdmin()) return false;

  const adminDetail = permissionState.admins && permissionState.admins[userEmail];
  if (adminDetail && adminDetail.permissions) {
    return adminDetail.permissions[permKey] === true;
  }
  // Fallback for legacy admin without explicit flags: true
  return true;
}

export function canEditAttendance() {
  if (permissionState.attendanceEdit === 'all') return true;
  return hasPermission('attendance');
}

export function isAttendanceEditAllowed() {
  return canEditAttendance(); // Backward compatible alias
}

export function canEditRecords() {
  if (hasPermission('roster')) {
    return true; // Roster manager can always edit records even after deadline
  }
  if (isDeadlineExpired()) {
    return false; // After deadline: non-managers cannot edit records
  }
  return permissionState.rosterEdit === 'all'; // Depends on dynamic policy
}

export function canViewOperationNotes() {
  if (permissionState.operationView === 'all') return true;
  return isAdmin() || hasPermission('operation');
}

export function canEditOperationNotes() {
  return hasPermission('operation');
}

export function canEditCalendar() {
  return hasPermission('calendar');
}

export function canManageAdmins() {
  if (isMasterAdmin()) return true;
  return hasPermission('adminManage');
}

/**
 * Record user profile to Firestore `users` collection upon successful login
 */
export async function recordUserLogin(user) {
  if (!user || !user.email) return;
  try {
    const emailKey = user.email.toLowerCase().trim().replace(/[./@]/g, '_');
    const userDocRef = doc(db, "users", emailKey);
    await setDoc(userDocRef, {
      email: user.email.toLowerCase().trim(),
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      lastLoginAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn("Could not record user login history to Firestore:", err);
  }
}

/**
 * Fetch known/previously logged-in users for admin autocomplete suggestions
 */
export async function getKnownUsers() {
  const usersMap = new Map();

  // 1. Add current admin emails and master admin as baseline
  const seedEmails = [
    permissionState.masterAdmin,
    ...permissionState.adminEmails,
    ...ADMIN_EMAILS
  ];
  seedEmails.forEach(em => {
    if (em) {
      const clean = em.toLowerCase().trim();
      const name = (permissionState.admins && permissionState.admins[clean] && permissionState.admins[clean].name) || clean.split('@')[0];
      usersMap.set(clean, { email: clean, displayName: name, source: 'admin' });
    }
  });

  // 2. Fetch from Firestore `users` collection
  try {
    const usersColRef = collection(db, "users");
    const snap = await getDocs(usersColRef);
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.email) {
        const email = data.email.toLowerCase().trim();
        usersMap.set(email, {
          email: email,
          displayName: data.displayName || usersMap.get(email)?.displayName || email.split('@')[0],
          photoURL: data.photoURL || '',
          lastLoginAt: data.lastLoginAt || 0,
          source: 'login_history'
        });
      }
    });
  } catch (err) {
    console.warn("Could not query `users` collection (using baseline fallback):", err);
  }

  return Array.from(usersMap.values());
}

export function formatUserDisplayName(user) {
  if (!user) return '';
  let name = user.displayName || '';
  if (!name && user.email) {
    if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      name = '이서현';
    } else {
      name = user.email.split('@')[0];
    }
  }
  // Strip parentheses and square brackets (괄호 별명 생략)
  name = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
  name = name.replace(/\s*\[[^\]]*\]\s*/g, '').trim();
  return name.slice(0, 3) || '사용자';
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const shortName = formatUserDisplayName(user);
    const admin = user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    
    if (admin) {
      if (toastHandler) toastHandler(`👑 관리자 '${shortName}' 님 환영합니다.`);
    } else {
      if (toastHandler) toastHandler(`🏊 '${shortName}' 님 환영합니다.`);
    }
    return user;
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      return null;
    }
    console.error('Google 로그인 상세 에러:', {
      code: error.code,
      message: error.message,
      email: error.customData?.email || error.email,
      credential: error.credential,
      errorObj: error
    });

    if (toastHandler) {
      toastHandler(`⚠️ Google 로그인 실패 [${error.code || 'ERROR'}]: ${error.message || ''}`);
    }
    return null;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
    if (toastHandler) toastHandler('로그아웃되었습니다.');
  } catch (error) {
    console.error('로그아웃 에러:', error);
    if (toastHandler) toastHandler('⚠️ 로그아웃 중 오류가 발생했습니다.');
  }
}

export function applyAuthState() {
  const admin = isAdmin();
  const editable = canEditRecords();
  const logged = isLoggedIn();

  if (admin) {
    document.body.classList.add('is-admin');
  } else {
    document.body.classList.remove('is-admin');
  }

  if (!editable) {
    document.body.classList.add('is-readonly');
  } else {
    document.body.classList.remove('is-readonly');
  }

  // Update Header Auth Area UI
  const authContainer = document.getElementById('headerAuthArea');
  if (authContainer) {
    if (logged) {
      const shortName = formatUserDisplayName(currentUser);
      const email = currentUser.email || '';
      const tooltip = admin 
        ? `👑 관리자 (${email}) · 클릭하여 로그아웃`
        : `🏊 ${shortName} (${email}) · 클릭하여 로그아웃`;
      
      authContainer.innerHTML = `
        ${admin ? `
          <button type="button" class="btn-excel-download" id="btnAdminExcelDownload" title="2026 거제시장배 공식 대회신청서 엑셀 다운로드 (거제오션)" aria-label="엑셀 신청서 다운로드">
            <svg class="excel-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>신청서 엑셀</span>
          </button>
        ` : ''}
        <button type="button" class="btn-user-profile ${admin ? 'is-admin-badge' : ''}" id="btnUserProfile" title="${tooltip}" aria-label="사용자 프로필 및 로그아웃">
          <span class="user-role-icon">${admin ? '👑' : '🏊'}</span>
          <span class="user-display-name">${shortName}</span>
        </button>
      `;
    } else {
      authContainer.innerHTML = `
        <button type="button" class="btn-google-login" id="btnGoogleLogin" title="Google 계정으로 로그인" aria-label="Google 로그인">
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

  // Dynamic Admin Nav Tab in division-nav
  const navBar = document.querySelector('.division-nav');
  if (navBar) {
    let adminTab = document.getElementById('adminNavTab');
    if (admin) {
      if (!adminTab) {
        adminTab = document.createElement('a');
        adminTab.href = 'admin.html';
        adminTab.id = 'adminNavTab';
        adminTab.className = 'division-tab admin-tab';
        adminTab.innerHTML = '⚙️ 관리자 설정';
        adminTab.title = '시스템 권한 및 정책 관리자 페이지';
        navBar.appendChild(adminTab);
      }
      const isCurrentAdminPage = window.location.pathname.endsWith('admin.html');
      adminTab.classList.toggle('active', isCurrentAdminPage);
    } else {
      if (adminTab && !window.location.pathname.endsWith('admin.html')) {
        adminTab.remove();
      }
      // If user is on admin.html and not admin, guard and redirect
      if (window.location.pathname.endsWith('admin.html')) {
        if (toastHandler) toastHandler('⚠️ 관리자 전용 페이지입니다. 메인 화면으로 이동합니다.');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1200);
      }
    }
  }

  // Dispatch auth state event
  window.dispatchEvent(new CustomEvent('gmdc:auth-change', { 
    detail: { 
      isLoggedIn: logged, 
      isAdmin: admin, 
      canEdit: editable,
      user: currentUser 
    } 
  }));

  // Trigger registered callbacks
  authChangeCallbacks.forEach(cb => {
    try {
      cb({ isLoggedIn: logged, isAdmin: admin, canEdit: editable, user: currentUser });
    } catch (e) {
      console.error('Auth callback error:', e);
    }
  });
}

export function initAuth(options = {}) {
  if (options.showToast) toastHandler = options.showToast;
  if (options.onAuthChange) authChangeCallbacks.push(options.onAuthChange);

  // Bind delegated click events for Google Login, Profile Logout & Excel Download
  document.addEventListener('click', (e) => {
    const excelBtn = e.target.closest('#btnAdminExcelDownload');
    if (excelBtn) {
      e.preventDefault();
      const currentRecords = typeof window.getGmdcRecords === 'function' ? window.getGmdcRecords() : window.gmdcRecords;
      if (typeof window.downloadApplicationExcel === 'function') {
        window.downloadApplicationExcel({ showToast: toastHandler, teamName: '거제오션', records: currentRecords });
      } else {
        import('./excelExporter.js').then(module => {
          module.downloadApplicationExcel({ showToast: toastHandler, teamName: '거제오션', records: currentRecords });
        }).catch(err => {
          console.error('엑셀 모듈 로드 실패:', err);
          if (toastHandler) toastHandler('❌ 엑셀 모듈 로드 실패: ' + err.message);
        });
      }
      return;
    }

    const loginBtn = e.target.closest('#btnGoogleLogin');
    if (loginBtn) {
      e.preventDefault();
      loginWithGoogle();
      return;
    }

    const profileBtn = e.target.closest('#btnUserProfile');
    if (profileBtn) {
      e.preventDefault();
      const shortName = formatUserDisplayName(currentUser);
      if (confirm(`'${shortName}' 님, 로그아웃하시겠습니까?`)) {
        logoutUser();
      }
      return;
    }
  });

  // Listen to Firebase Auth state changes
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      recordUserLogin(user);
    }
    applyAuthState();
  });
}
