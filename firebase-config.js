// ==========================================================================
// GMDC Swim Club - Firebase App Singleton
// Single source of truth for Firebase initialization.
// All other modules import { firebaseApp } from here instead of calling
// initializeApp() themselves.
// ==========================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

/**
 * Shared Firebase project configuration.
 * Edit here once if project credentials change.
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBA0ykFrEfU9YS33Zp_HNf3OnBX39WCEkA",
  authDomain: "gmdc-swim-records.firebaseapp.com",
  projectId: "gmdc-swim-records",
  storageBucket: "gmdc-swim-records.firebasestorage.app",
  messagingSenderId: "4329922661",
  appId: "1:4329922661:web:e0799bb08d37fd1e12668c",
  measurementId: "G-5H98EB7ZSP"
};

/**
 * Singleton Firebase App instance.
 * Reuses existing app if already initialized (safe for multi-module pages).
 */
export const firebaseApp = getApps().length === 0
  ? initializeApp(FIREBASE_CONFIG)
  : getApp();
