/**
 * NoteFlow - Firebase & Google Authentication Module
 * Built using Firebase Web SDK v10 Modular CDN
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const FIREBASE_STORAGE_KEY = 'noteflow_firebase_config_v1';

export const firebaseConfig = {
  apiKey: "AIzaSyC9AxgQl79s0zTzjI9luDMtbaxhp7HqqMo",
  authDomain: "note-ai-49ba6.firebaseapp.com",
  projectId: "note-ai-49ba6",
  storageBucket: "note-ai-49ba6.firebasestorage.app",
  messagingSenderId: "519055020810",
  appId: "1:519055020810:web:c20ac0d1f14311d315e0f3"
};

export const DEFAULT_FIREBASE_CONFIG = firebaseConfig;

/**
 * Get the current active Firebase config (from LocalStorage or default)
 */
export function getStoredFirebaseConfig() {
  try {
    const saved = localStorage.getItem(FIREBASE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored Firebase config:', e);
  }
  return firebaseConfig;
}

/**
 * Save user's custom Firebase configuration to LocalStorage
 */
export function saveCustomFirebaseConfig(config) {
  try {
    localStorage.setItem(FIREBASE_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Failed to save Firebase config:', e);
    return false;
  }
}

/**
 * Check if the current config is a user-configured valid Firebase project
 */
export function isCustomConfigConfigured() {
  const config = getStoredFirebaseConfig();
  return config.apiKey && !config.apiKey.includes('Placeholder');
}

// Global Firebase References
let firebaseApp = null;
let firebaseAuth = null;
let firebaseFirestore = null;
let googleProvider = null;

/**
 * Initialize or get Firebase App & Auth instance
 */
export function initFirebaseAuth() {
  try {
    const config = getStoredFirebaseConfig();

    if (getApps().length === 0) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApp();
    }

    firebaseAuth = getAuth(firebaseApp);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    // Also initialize Firestore
    initFirestore();

    return { app: firebaseApp, auth: firebaseAuth, isReady: true };
  } catch (err) {
    console.error('Firebase initialization error:', err);
    return { app: null, auth: null, isReady: false, error: err };
  }
}

/**
 * Initialize or get Cloud Firestore instance with offline persistence
 */
export function initFirestore() {
  try {
    if (!firebaseApp) {
      const config = getStoredFirebaseConfig();
      if (getApps().length === 0) {
        firebaseApp = initializeApp(config);
      } else {
        firebaseApp = getApp();
      }
    }

    if (firebaseFirestore) {
      return firebaseFirestore;
    }

    // Try modern multi-tab persistent cache first
    try {
      firebaseFirestore = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (cacheErr) {
      firebaseFirestore = getFirestore(firebaseApp);
      enableIndexedDbPersistence(firebaseFirestore).catch((e) => {
        // Safe to ignore if already enabled or not supported in current environment
        console.debug('Firestore persistence info:', e.message);
      });
    }

    return firebaseFirestore;
  } catch (err) {
    console.error('Firestore initialization error:', err);
    return null;
  }
}

/**
 * Get active Firestore instance
 */
export function getFirestoreInstance() {
  if (!firebaseFirestore) {
    return initFirestore();
  }
  return firebaseFirestore;
}

/**
 * Sign in using Google Auth Popup
 */
export async function signInWithGoogle() {
  try {
    if (!firebaseAuth || !googleProvider) {
      initFirebaseAuth();
    }

    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const user = result.user;

    return {
      success: true,
      user: {
        uid: user.uid,
        displayName: user.displayName || 'Google User',
        email: user.email,
        photoURL: user.photoURL,
        provider: 'google'
      }
    };
  } catch (error) {
    console.error('Google Sign-In failed:', error);
    let friendlyMessage = error.message;

    if (error.code === 'auth/popup-closed-by-user') {
      friendlyMessage = 'Sign-in window was closed before completing.';
    } else if (error.code === 'auth/unauthorized-domain') {
      friendlyMessage = 'This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).';
    } else if (error.code === 'auth/invalid-api-key' || error.code === 'auth/api-key-not-valid') {
      friendlyMessage = 'Invalid Firebase API Key. Please configure your Firebase project credentials.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      friendlyMessage = 'Sign-in request was replaced by a new popup.';
    }

    return {
      success: false,
      code: error.code,
      message: friendlyMessage
    };
  }
}

/**
 * Sign in using Email and Password
 */
export async function signInWithEmail(email, password) {
  try {
    if (!firebaseAuth) {
      initFirebaseAuth();
    }

    const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    const user = result.user;

    return {
      success: true,
      user: {
        uid: user.uid,
        displayName: user.displayName || user.email.split('@')[0] || 'User',
        email: user.email,
        photoURL: user.photoURL || null,
        provider: 'password'
      }
    };
  } catch (error) {
    console.error('Email sign-in failed:', error);
    let friendlyMessage = error.message;

    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      friendlyMessage = 'Invalid email or password. Please check your credentials and try again.';
    } else if (error.code === 'auth/invalid-email') {
      friendlyMessage = 'Please enter a valid email address.';
    } else if (error.code === 'auth/user-disabled') {
      friendlyMessage = 'This account has been disabled by the administrator.';
    } else if (error.code === 'auth/too-many-requests') {
      friendlyMessage = 'Access temporarily blocked due to multiple failed login attempts. Please try again later.';
    }

    return {
      success: false,
      code: error.code,
      message: friendlyMessage
    };
  }
}

/**
 * Create new account using Email, Password and optional Display Name
 */
export async function signUpWithEmail(email, password, displayName = '') {
  try {
    if (!firebaseAuth) {
      initFirebaseAuth();
    }

    const result = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
    const user = result.user;

    const finalName = displayName.trim() || email.split('@')[0] || 'User';

    // Update Firebase Auth profile displayName if provided
    try {
      await updateProfile(user, { displayName: finalName });
    } catch (profileErr) {
      console.warn('Could not update user profile name:', profileErr);
    }

    return {
      success: true,
      user: {
        uid: user.uid,
        displayName: finalName,
        email: user.email,
        photoURL: user.photoURL || null,
        provider: 'password'
      }
    };
  } catch (error) {
    console.error('Email sign-up failed:', error);
    let friendlyMessage = error.message;

    if (error.code === 'auth/email-already-in-use') {
      friendlyMessage = 'An account with this email address already exists. Please sign in instead.';
    } else if (error.code === 'auth/weak-password') {
      friendlyMessage = 'Password is too weak. Please use at least 6 characters.';
    } else if (error.code === 'auth/invalid-email') {
      friendlyMessage = 'Please enter a valid email address.';
    } else if (error.code === 'auth/operation-not-allowed') {
      friendlyMessage = 'Email/Password sign-in is not enabled in your Firebase Console. Please enable it in Authentication > Sign-in method.';
    }

    return {
      success: false,
      code: error.code,
      message: friendlyMessage
    };
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  try {
    if (!firebaseAuth) {
      initFirebaseAuth();
    }

    await sendPasswordResetEmail(firebaseAuth, email.trim());
    return { success: true };
  } catch (error) {
    console.error('Password reset failed:', error);
    let friendlyMessage = error.message;

    if (error.code === 'auth/user-not-found') {
      friendlyMessage = 'No account was found with that email address.';
    } else if (error.code === 'auth/invalid-email') {
      friendlyMessage = 'Please enter a valid email address.';
    }

    return {
      success: false,
      code: error.code,
      message: friendlyMessage
    };
  }
}

/**
 * Sign out current authenticated user
 */
export async function signOutUser() {
  try {
    if (firebaseAuth) {
      await signOut(firebaseAuth);
    }
    return { success: true };
  } catch (error) {
    console.error('Sign-out error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Subscribe to Firebase Auth state changes
 */
export function onAuthStatusChange(callback) {
  if (!firebaseAuth) {
    initFirebaseAuth();
  }

  if (!firebaseAuth) {
    // If Firebase failed to initialize, notify callback with null
    callback(null);
    return () => { };
  }

  return onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
      callback({
        uid: user.uid,
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
        email: user.email,
        photoURL: user.photoURL,
        provider: user.providerData && user.providerData[0] ? user.providerData[0].providerId : 'password'
      });
    } else {
      callback(null);
    }
  });
}

