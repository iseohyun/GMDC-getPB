// ==================================================================
// GMDC Swim Club - Google Authentication & Role-Based Access Control
// ==================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBA0ykFrEfU9YS33Zp_HNf3OnBX39WCEkA",
  authDomain: "gmdc-swim-records.firebaseapp.com",
  projectId: "gmdc-swim-records",
  storageBucket: "gmdc-swim-records.firebasestorage.app",
  messagingSenderId: "4329922661",
  appId: "1:4329922661:web:e0799bb08d37fd1e12668c",
  measurementId: "G-5H98EB7ZSP"
};

let app;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
} catch (e) {
  console.error("Firebase App initialization error in auth.js:", e);
}

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Admin & Deadline Configurations
export const ADMIN_EMAIL = 'iseohyun@hanmail.net';
export const DEADLINE_ISO = '2026-08-17T18:00:00+09:00';

let currentUser = null;
let toastHandler = null;
let authChangeCallbacks = [];

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
  return currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export function canEditRecords() {
  if (isAdmin()) {
    return true; // Admin can always edit records even after deadline
  }
  if (isDeadlineExpired()) {
    return false; // After deadline: non-admins cannot edit records
  }
  return true; // During open period: editing permitted
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
    console.error('Google 로그인 에러:', error);
    if (toastHandler) toastHandler('⚠️ Google 로그인 실패: ' + (error.message || ''));
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

  // Bind delegated click events for Google Login & Profile Logout
  document.addEventListener('click', (e) => {
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
    applyAuthState();
  });
}
