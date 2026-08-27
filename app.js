/**
 * NoteFlow - Modern Notes Management Web Application
 * Integrated with Google Firebase Authentication & LocalStorage Scoped Persistence
 */

import { 
  signInWithGoogle, 
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
  signOutUser, 
  onAuthStatusChange, 
  getStoredFirebaseConfig, 
  saveCustomFirebaseConfig, 
  isCustomConfigConfigured,
  DEFAULT_FIREBASE_CONFIG,
  initFirebaseAuth
} from './firebase-config.js';
import { FirestoreSync, SYNC_STATUS } from './firestore.js';

(() => {
  'use strict';

  // --- Storage Keys & Constants ---
  const STORAGE_KEYS = {
    NOTES_PREFIX: 'noteflow_notes_',
    LEGACY_NOTES: 'noteflow_notes_v1',
    THEME: 'noteflow_theme_v1',
    USER_NAME: 'noteflow_username_v1',
    VIEW_MODE: 'noteflow_viewmode_v1',
    SORT_BY: 'noteflow_sortby_v1'
  };

  // --- Default Sample Notes for New Users ---
  const DEFAULT_SAMPLE_NOTES = [
    {
      id: 'note_welcome_01',
      title: '🚀 Welcome to NoteFlow Pro!',
      content: `Welcome to your new modern workspace. NoteFlow is crafted for speed, elegance, and focus.

✨ **Key Features:**
• **Google & Firebase Auth:** Secure sign-in integrated seamlessly.
• **Real-time Search:** Press \`/\` or \`Ctrl+K\` to find anything instantly.
• **Pinned & Favorites:** Keep your highest priority thoughts at the top.
• **Categories & Tags:** Organize your work by Personal, Work, Study, Project, Ideas, and custom tags.
• **Offline & Private:** All data is safely stored in your browser's LocalStorage.
• **Dark & Light Mode:** Toggle seamlessly from the bottom-left sidebar.

Try creating your next note by pressing **Ctrl + N** or clicking **+ New Note**!`,
      category: 'Project',
      tags: ['welcome', 'guide', 'shortcuts'],
      color: 'purple',
      isPinned: true,
      isFavorite: true,
      isTrash: false,
      createdAt: Date.now() - 3600000 * 2,
      updatedAt: Date.now() - 3600000 * 2
    },
    {
      id: 'note_ui_design_02',
      title: '💡 Modern UI & Glassmorphism Design System',
      content: `Design notes for upcoming SaaS dashboard release:
1. Emphasize soft backdrop-filter blur effects.
2. Use Plus Jakarta Sans typography with subtle tracking.
3. Integrate tactile micro-animations for card hover states and toast alerts.
4. Keep color accents harmonious across emerald, amber, rose, and indigo.`,
      category: 'Ideas',
      tags: ['design', 'ui', 'glassmorphism'],
      color: 'rose',
      isPinned: true,
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now() - 3600000 * 5,
      updatedAt: Date.now() - 3600000 * 5
    },
    {
      id: 'note_js_perf_03',
      title: '📚 JavaScript DOM Performance Best Practices',
      content: `Crucial patterns for 60fps web apps:
• Event delegation for dynamic lists and cards.
• Debounced search handlers to avoid layout thrashing.
• Use CSS custom properties for instant zero-runtime theme toggling.
• Batch DOM updates using DocumentFragments when rendering note collections.`,
      category: 'Study',
      tags: ['javascript', 'frontend', 'web-dev'],
      color: 'amber',
      isPinned: false,
      isFavorite: true,
      isTrash: false,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000
    },
    {
      id: 'note_roadmap_04',
      title: '🎯 Q3 Strategic Milestones & Deliverables',
      content: `Action items for the engineering sprint:
[x] Finalize LocalStorage schema & migrations
[x] Integrate Google Sign-In with Firebase Auth
[ ] Implement JSON import/export sync tool
[ ] Configure automated test suites and accessibility check`,
      category: 'Work',
      tags: ['roadmap', 'planning', 'sprint'],
      color: 'blue',
      isPinned: false,
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2
    },
    {
      id: 'note_wellness_05',
      title: '🧘 Weekend Retreat & Camping Checklist',
      content: `Items to pack for the mountain trail:
• Lightweight 2-person tent & sleeping bag
• Portable camp stove & pour-over coffee kit
• Trail mix, dried fruits, energy bars
• First aid kit, solar power bank, and headlamp`,
      category: 'Personal',
      tags: ['outdoors', 'weekend', 'travel'],
      color: 'emerald',
      isPinned: false,
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 86400000 * 3
    }
  ];

  // --- Application State ---
  const state = {
    // Authenticated user state
    currentUser: null, // { uid, displayName, email, photoURL, provider: 'google' }
    notes: [],
    activeView: 'all', // 'all' | 'pinned' | 'favorites' | 'trash'
    activeCategory: null, // null or string (e.g. 'Work')
    searchQuery: '',
    sortBy: 'updated_desc',
    viewMode: 'grid', // 'grid' | 'list'
    theme: 'dark',
    userName: 'Sandy',
    
    // Editor modal state
    editingNoteId: null,
    editorTags: [],
    editorColor: 'default',
    editorIsPinned: false,
    editorIsFavorite: false,
    editorPinCode: null, // holds 4-digit PIN for note currently in editor

    // PIN & Lock Security State
    targetUnlockNoteId: null,
    targetUnlockAction: 'preview', // 'preview' | 'edit'

    // Auth UI state
    authMode: 'signin', // 'signin' | 'signup'
    authPasswordVisible: false,

    // Confirm modal callback
    confirmCallback: null
  };

  // --- DOM Elements Cache ---
  const DOM = {
    html: document.documentElement,
    appLayout: document.getElementById('appLayout'),
    authScreen: document.getElementById('authScreen'),
    authTabSignIn: document.getElementById('authTabSignIn'),
    authTabSignUp: document.getElementById('authTabSignUp'),
    authMainTitle: document.getElementById('authMainTitle'),
    authMainSubtitle: document.getElementById('authMainSubtitle'),
    authErrorAlert: document.getElementById('authErrorAlert'),
    authErrorText: document.getElementById('authErrorText'),
    authSuccessAlert: document.getElementById('authSuccessAlert'),
    authSuccessText: document.getElementById('authSuccessText'),
    emailAuthForm: document.getElementById('emailAuthForm'),
    authNameGroup: document.getElementById('authNameGroup'),
    authNameInput: document.getElementById('authNameInput'),
    authEmailInput: document.getElementById('authEmailInput'),
    authPasswordInput: document.getElementById('authPasswordInput'),
    btnForgotPassword: document.getElementById('btnForgotPassword'),
    togglePasswordVisibilityBtn: document.getElementById('togglePasswordVisibilityBtn'),
    btnEmailAuthSubmit: document.getElementById('btnEmailAuthSubmit'),
    emailAuthSpinnerWrapper: document.getElementById('emailAuthSpinnerWrapper'),
    emailAuthBtnText: document.getElementById('emailAuthBtnText'),
    authSwitchPromptText: document.getElementById('authSwitchPromptText'),
    btnSwitchAuthMode: document.getElementById('btnSwitchAuthMode'),
    btnGoogleSignIn: document.getElementById('btnGoogleSignIn'),
    googleIconWrapper: document.getElementById('googleIconWrapper'),
    googleSpinnerWrapper: document.getElementById('googleSpinnerWrapper'),
    googleBtnText: document.getElementById('googleBtnText'),
    authFirebaseStatusText: document.getElementById('authFirebaseStatusText'),
    authOpenConfigBtn: document.getElementById('authOpenConfigBtn'),

    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    sidebarAvatar: document.getElementById('sidebarAvatar'),
    sidebarAvatarImg: document.getElementById('sidebarAvatarImg'),
    sidebarUserName: document.getElementById('sidebarUserName'),
    sidebarUserStatus: document.getElementById('sidebarUserStatus'),
    sidebarSignOutBtn: document.getElementById('sidebarSignOutBtn'),
    
    // Navigation items
    navAllNotes: document.getElementById('navAllNotes'),
    navPinned: document.getElementById('navPinned'),
    navFavorites: document.getElementById('navFavorites'),
    navTrash: document.getElementById('navTrash'),
    categoryNavList: document.getElementById('categoryNavList'),
    resetCategoryFilterBtn: document.getElementById('resetCategoryFilterBtn'),
    
    // Counters
    countAllNotes: document.getElementById('countAllNotes'),
    countPinned: document.getElementById('countPinned'),
    countFavorites: document.getElementById('countFavorites'),
    countTrash: document.getElementById('countTrash'),
    countCatPersonal: document.getElementById('countCatPersonal'),
    countCatWork: document.getElementById('countCatWork'),
    countCatStudy: document.getElementById('countCatStudy'),
    countCatProject: document.getElementById('countCatProject'),
    countCatIdeas: document.getElementById('countCatIdeas'),
    countCatOther: document.getElementById('countCatOther'),

    // Topbar & Stats
    greetingHeading: document.getElementById('greetingHeading'),
    greetingSub: document.getElementById('greetingSub'),
    statTotalNotes: document.getElementById('statTotalNotes'),
    statPinnedNotes: document.getElementById('statPinnedNotes'),
    statFavoriteNotes: document.getElementById('statFavoriteNotes'),
    sidebarNewNoteBtn: document.getElementById('sidebarNewNoteBtn'),
    topbarNewNoteBtn: document.getElementById('topbarNewNoteBtn'),
    mobileFabBtn: document.getElementById('mobileFabBtn'),

    // Cloud Sync Status Indicator
    syncStatusIndicator: document.getElementById('syncStatusIndicator'),
    syncStatusIcon: document.getElementById('syncStatusIcon'),
    syncStatusText: document.getElementById('syncStatusText'),
    btnSyncNow: document.getElementById('btnSyncNow'),

    // Settings Modal Sync Card
    settingsSyncBadge: document.getElementById('settingsSyncBadge'),
    settingsSyncStatusText: document.getElementById('settingsSyncStatusText'),
    settingsSyncSubText: document.getElementById('settingsSyncSubText'),
    btnSettingsForceSync: document.getElementById('btnSettingsForceSync'),

    // Search & Filter
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    sortSelect: document.getElementById('sortSelect'),
    btnGridView: document.getElementById('btnGridView'),
    btnListView: document.getElementById('btnListView'),
    trashControls: document.getElementById('trashControls'),
    emptyTrashBtn: document.getElementById('emptyTrashBtn'),
    activeFilterBar: document.getElementById('activeFilterBar'),
    currentViewTitle: document.getElementById('currentViewTitle'),
    resultsCountBadge: document.getElementById('resultsCountBadge'),
    activeFilterChips: document.getElementById('activeFilterChips'),

    // Notes Grid & Empty State
    notesContainer: document.getElementById('notesContainer'),
    mainNotesGrid: document.getElementById('mainNotesGrid'),
    pinnedSectionWrapper: document.getElementById('pinnedSectionWrapper'),
    pinnedNotesGrid: document.getElementById('pinnedNotesGrid'),
    emptyStateContainer: document.getElementById('emptyStateContainer'),
    emptyIconCircle: document.getElementById('emptyIconCircle'),
    emptyStateTitle: document.getElementById('emptyStateTitle'),
    emptyStateDesc: document.getElementById('emptyStateDesc'),
    emptyStateBtn: document.getElementById('emptyStateBtn'),

    // Note Editor Modal
    noteEditorModal: document.getElementById('noteEditorModal'),
    editorModeTag: document.getElementById('editorModeTag'),
    editorModalTitle: document.getElementById('editorModalTitle'),
    editorPinBtn: document.getElementById('editorPinBtn'),
    editorFavoriteBtn: document.getElementById('editorFavoriteBtn'),
    editorLockBtn: document.getElementById('editorLockBtn'),
    editorLockPill: document.getElementById('editorLockPill'),
    editorLockStatusText: document.getElementById('editorLockStatusText'),
    closeEditorModalBtn: document.getElementById('closeEditorModalBtn'),
    cancelEditorBtn: document.getElementById('cancelEditorBtn'),
    noteForm: document.getElementById('noteForm'),
    noteTitleInput: document.getElementById('noteTitleInput'),
    noteCategorySelect: document.getElementById('noteCategorySelect'),
    colorPalettePicker: document.getElementById('colorPalettePicker'),
    tagInputContainer: document.getElementById('tagInputContainer'),
    modalTagChips: document.getElementById('modalTagChips'),
    tagInputField: document.getElementById('tagInputField'),
    noteContentInput: document.getElementById('noteContentInput'),
    editorWordCount: document.getElementById('editorWordCount'),
    editorCharCount: document.getElementById('editorCharCount'),
    editorLastSaved: document.getElementById('editorLastSaved'),

    // Set PIN Modal
    setPinModal: document.getElementById('setPinModal'),
    closeSetPinModalBtn: document.getElementById('closeSetPinModalBtn'),
    btnCancelSetPin: document.getElementById('btnCancelSetPin'),
    btnSavePin: document.getElementById('btnSavePin'),
    btnRemovePin: document.getElementById('btnRemovePin'),
    setPinDigitsRow: document.getElementById('setPinDigitsRow'),
    setPinErrorText: document.getElementById('setPinErrorText'),
    setPinKeypad: document.getElementById('setPinKeypad'),

    // Unlock PIN Modal
    pinUnlockModal: document.getElementById('pinUnlockModal'),
    closeUnlockModalBtn: document.getElementById('closeUnlockModalBtn'),
    btnCancelUnlockPin: document.getElementById('btnCancelUnlockPin'),
    btnSubmitUnlockPin: document.getElementById('btnSubmitUnlockPin'),
    unlockNoteTitle: document.getElementById('unlockNoteTitle'),
    unlockPinDigitsRow: document.getElementById('unlockPinDigitsRow'),
    unlockPinErrorText: document.getElementById('unlockPinErrorText'),
    unlockPinKeypad: document.getElementById('unlockPinKeypad'),

    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    settingsAvatarImg: document.getElementById('settingsAvatarImg'),
    settingsAvatarInitial: document.getElementById('settingsAvatarInitial'),
    settingsUserDisplay: document.getElementById('settingsUserDisplay'),
    settingsUserEmail: document.getElementById('settingsUserEmail'),
    settingsSignOutBtn: document.getElementById('settingsSignOutBtn'),

    // Firebase Config form fields
    cfgApiKey: document.getElementById('cfgApiKey'),
    cfgAuthDomain: document.getElementById('cfgAuthDomain'),
    cfgProjectId: document.getElementById('cfgProjectId'),
    cfgAppId: document.getElementById('cfgAppId'),
    btnSaveFirebaseConfig: document.getElementById('btnSaveFirebaseConfig'),
    btnResetFirebaseConfig: document.getElementById('btnResetFirebaseConfig'),
    firebaseConfigStatusBadge: document.getElementById('firebaseConfigStatusBadge'),

    exportDataBtn: document.getElementById('exportDataBtn'),
    importDataFileInput: document.getElementById('importDataFileInput'),
    loadSampleDataBtn: document.getElementById('loadSampleDataBtn'),
    settingsEmptyTrashBtn: document.getElementById('settingsEmptyTrashBtn'),
    resetAllDataBtn: document.getElementById('resetAllDataBtn'),

    // Confirmation Modal
    confirmModal: document.getElementById('confirmModal'),
    confirmModalTitle: document.getElementById('confirmModalTitle'),
    confirmModalMessage: document.getElementById('confirmModalMessage'),
    confirmProceedBtn: document.getElementById('confirmProceedBtn'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),

    // Preview Modal
    notePreviewModal: document.getElementById('notePreviewModal'),
    closePreviewModalBtn: document.getElementById('closePreviewModalBtn'),
    previewCloseBottomBtn: document.getElementById('previewCloseBottomBtn'),
    previewEditBtn: document.getElementById('previewEditBtn'),
    previewEditBottomBtn: document.getElementById('previewEditBottomBtn'),
    previewCategoryBadge: document.getElementById('previewCategoryBadge'),
    previewDateLabel: document.getElementById('previewDateLabel'),
    previewPinBtn: document.getElementById('previewPinBtn'),
    previewFavoriteBtn: document.getElementById('previewFavoriteBtn'),
    previewLockBtn: document.getElementById('previewLockBtn'),
    previewModalTitle: document.getElementById('previewModalTitle'),
    previewTagsRow: document.getElementById('previewTagsRow'),
    previewContentRendered: document.getElementById('previewContentRendered'),
    previewUpdatedLabel: document.getElementById('previewUpdatedLabel'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  // --- Helper Functions ---
  const Helpers = {
    uuid() {
      return 'note_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    },

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    timeAgo(timestamp) {
      if (!timestamp) return 'Unknown';
      const now = Date.now();
      const elapsed = now - timestamp;
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (seconds < 45) return 'Just now';
      if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
      if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
      if (days === 1) return 'Yesterday';
      if (days < 30) return `${days} days ago`;

      const date = new Date(timestamp);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    },

    formatDate(timestamp) {
      if (!timestamp) return '';
      const d = new Date(timestamp);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    getGreeting(name = 'Sandy') {
      const hour = new Date().getHours();
      let greeting = 'Good evening';
      let emoji = '👋';

      if (hour >= 5 && hour < 12) {
        greeting = 'Good morning';
        emoji = '☀️';
      } else if (hour >= 12 && hour < 17) {
        greeting = 'Good afternoon';
        emoji = '🌤️';
      } else if (hour >= 17 && hour < 22) {
        greeting = 'Good evening';
        emoji = '👋';
      } else {
        greeting = 'Good night';
        emoji = '🌙';
      }

      return `${greeting}, ${Helpers.escapeHtml(name)} ${emoji}`;
    },

    renderMarkdown(text) {
      if (!text) return '';
      let escaped = Helpers.escapeHtml(text);

      // Code blocks: ```code```
      escaped = escaped.replace(/```([\s\S]*?)```/g, (match, p1) => {
        return `<pre><code>${p1.trim()}</code></pre>`;
      });

      // Inline code: `code`
      escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

      // Bold: **text** or __text__
      escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      escaped = escaped.replace(/__(.*?)__/g, '<strong>$1</strong>');

      // Italic: *text* or _text_
      escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
      escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');

      return escaped;
    }
  };

  // --- Storage Controller ---
  const Storage = {
    getUserStorageKey() {
      const uid = state.currentUser ? state.currentUser.uid : 'default_user';
      return `${STORAGE_KEYS.NOTES_PREFIX}${uid}`;
    },

    loadNotes() {
      try {
        const key = this.getUserStorageKey();
        let stored = localStorage.getItem(key);

        // Check for legacy migration
        if (!stored && (key === `${STORAGE_KEYS.NOTES_PREFIX}guest` || key === `${STORAGE_KEYS.NOTES_PREFIX}default_user`)) {
          const legacy = localStorage.getItem(STORAGE_KEYS.LEGACY_NOTES);
          if (legacy) stored = legacy;
        }

        if (!stored) {
          this.saveNotes(DEFAULT_SAMPLE_NOTES);
          return [...DEFAULT_SAMPLE_NOTES];
        }

        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        return [...DEFAULT_SAMPLE_NOTES];
      } catch (err) {
        console.error('Failed to load notes from LocalStorage:', err);
        return [...DEFAULT_SAMPLE_NOTES];
      }
    },

    saveNotes(notes) {
      try {
        const key = this.getUserStorageKey();
        localStorage.setItem(key, JSON.stringify(notes));
      } catch (err) {
        console.error('Failed to save notes to LocalStorage:', err);
        Toast.show('Storage quota exceeded or error saving notes.', 'danger');
      }
    },

    loadSettings() {
      state.theme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
      state.userName = localStorage.getItem(STORAGE_KEYS.USER_NAME) || 'Sandy';
      state.viewMode = localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || 'grid';
      state.sortBy = localStorage.getItem(STORAGE_KEYS.SORT_BY) || 'updated_desc';
    },

    saveSettings() {
      localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
      localStorage.setItem(STORAGE_KEYS.USER_NAME, state.userName);
      localStorage.setItem(STORAGE_KEYS.VIEW_MODE, state.viewMode);
      localStorage.setItem(STORAGE_KEYS.SORT_BY, state.sortBy);
    }
  };

  // --- Toast Notification Controller ---
  const Toast = {
    show(message, type = 'success', undoCallback = null) {
      const toast = document.createElement('div');
      toast.className = `toast-item toast-${type}`;

      let iconSvg = '';
      if (type === 'success') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
      } else if (type === 'danger') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
      } else if (type === 'warning') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      } else {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
      }

      toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-content">${Helpers.escapeHtml(message)}</div>
        ${undoCallback ? `<button class="toast-undo-btn">Undo</button>` : ''}
        <button class="toast-close-btn" aria-label="Close notification">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;

      DOM.toastContainer.appendChild(toast);

      if (undoCallback) {
        const undoBtn = toast.querySelector('.toast-undo-btn');
        undoBtn.addEventListener('click', () => {
          undoCallback();
          dismissToast();
        });
      }

      const closeBtn = toast.querySelector('.toast-close-btn');
      closeBtn.addEventListener('click', dismissToast);

      const autoDismissTimeout = setTimeout(dismissToast, 3800);

      function dismissToast() {
        clearTimeout(autoDismissTimeout);
        toast.classList.add('hide');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 200);
      }
    }
  };

  // --- Modal Controller ---
  const Modal = {
    open(modalElement) {
      if (!modalElement) return;
      modalElement.classList.add('open');
      modalElement.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    },

    close(modalElement) {
      if (!modalElement) return;
      if (modalElement.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      modalElement.classList.remove('open');
      modalElement.setAttribute('aria-hidden', 'true');
      
      const openModals = document.querySelectorAll('.modal-backdrop.open');
      if (openModals.length === 0) {
        document.body.style.overflow = '';
      }
    },

    confirm({ title, message, proceedText = 'Confirm', isDanger = true, onProceed }) {
      DOM.confirmModalTitle.textContent = title || 'Are you sure?';
      DOM.confirmModalMessage.textContent = message || 'This action cannot be undone.';
      DOM.confirmProceedBtn.textContent = proceedText;

      if (isDanger) {
        DOM.confirmProceedBtn.className = 'btn btn-danger';
      } else {
        DOM.confirmProceedBtn.className = 'btn btn-primary';
      }

      state.confirmCallback = onProceed;
      this.open(DOM.confirmModal);
    }
  };

  // --- 4-Digit PIN Passcode Manager ---
  const PinManager = {
    setupPinInputs(digitsRow, keypad, onSubmit) {
      if (!digitsRow) return;
      const inputs = Array.from(digitsRow.querySelectorAll('.pin-digit-input'));

      inputs.forEach((input, index) => {
        input.value = '';
        input.classList.remove('filled');

        input.oninput = (e) => {
          const raw = e.target.value;
          const val = raw.replace(/[^0-9]/g, '');
          e.target.value = val ? val.slice(-1) : '';
          if (e.target.value) {
            e.target.classList.add('filled');
            if (index < inputs.length - 1) {
              inputs[index + 1].focus();
              inputs[index + 1].select();
            }
          } else {
            e.target.classList.remove('filled');
          }

          const fullPin = inputs.map(i => i.value).join('');
          if (fullPin.length === 4 && typeof onSubmit === 'function') {
            onSubmit(fullPin);
          }
        };

        input.onkeydown = (e) => {
          if (e.key === 'Backspace') {
            if (input.value) {
              input.value = '';
              input.classList.remove('filled');
              e.preventDefault();
            } else if (index > 0) {
              inputs[index - 1].value = '';
              inputs[index - 1].classList.remove('filled');
              inputs[index - 1].focus();
              e.preventDefault();
            }
          } else if (e.key === 'ArrowLeft' && index > 0) {
            inputs[index - 1].focus();
            e.preventDefault();
          } else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
            inputs[index + 1].focus();
            e.preventDefault();
          } else if (e.key === 'Enter') {
            const fullPin = inputs.map(i => i.value).join('');
            if (typeof onSubmit === 'function') {
              onSubmit(fullPin);
            }
          }
        };

        input.onpaste = (e) => {
          e.preventDefault();
          const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 4);
          if (paste) {
            paste.split('').forEach((char, i) => {
              if (inputs[i]) {
                inputs[i].value = char;
                inputs[i].classList.add('filled');
              }
            });
            const nextFocus = Math.min(paste.length, inputs.length - 1);
            inputs[nextFocus].focus();
            if (paste.length === 4 && typeof onSubmit === 'function') {
              onSubmit(paste);
            }
          }
        };
      });

      if (keypad) {
        keypad.onclick = (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          const num = btn.getAttribute('data-num');
          const action = btn.getAttribute('data-action');

          if (num !== null) {
            const firstEmpty = inputs.find(i => !i.value);
            if (firstEmpty) {
              firstEmpty.value = num;
              firstEmpty.classList.add('filled');
              const idx = inputs.indexOf(firstEmpty);
              if (idx < inputs.length - 1) {
                inputs[idx + 1].focus();
              }
              const fullPin = inputs.map(i => i.value).join('');
              if (fullPin.length === 4 && typeof onSubmit === 'function') {
                onSubmit(fullPin);
              }
            }
          } else if (action === 'backspace') {
            for (let i = inputs.length - 1; i >= 0; i--) {
              if (inputs[i].value) {
                inputs[i].value = '';
                inputs[i].classList.remove('filled');
                inputs[i].focus();
                break;
              }
            }
          } else if (action === 'clear') {
            inputs.forEach(i => {
              i.value = '';
              i.classList.remove('filled');
            });
            inputs[0].focus();
          }
        };
      }
    },

    openSetPinModal() {
      DOM.setPinErrorText.style.display = 'none';
      DOM.setPinDigitsRow.classList.remove('pin-shake');
      const inputs = Array.from(DOM.setPinDigitsRow.querySelectorAll('.pin-digit-input'));
      inputs.forEach(i => {
        i.value = '';
        i.classList.remove('filled');
      });

      if (state.editorPinCode) {
        DOM.btnRemovePin.style.display = 'inline-block';
        state.editorPinCode.split('').forEach((digit, idx) => {
          if (inputs[idx]) {
            inputs[idx].value = digit;
            inputs[idx].classList.add('filled');
          }
        });
      } else {
        DOM.btnRemovePin.style.display = 'none';
      }

      this.setupPinInputs(DOM.setPinDigitsRow, DOM.setPinKeypad, () => this.savePin());
      Modal.open(DOM.setPinModal);
      setTimeout(() => inputs[0].focus(), 120);
    },

    savePin() {
      const inputs = Array.from(DOM.setPinDigitsRow.querySelectorAll('.pin-digit-input'));
      const pin = inputs.map(i => i.value).join('');
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        DOM.setPinErrorText.textContent = 'Please enter a complete 4-digit numeric PIN.';
        DOM.setPinErrorText.style.display = 'block';
        DOM.setPinDigitsRow.classList.remove('pin-shake');
        void DOM.setPinDigitsRow.offsetWidth;
        DOM.setPinDigitsRow.classList.add('pin-shake');
        return;
      }

      state.editorPinCode = pin;
      NoteManager.updateLockStatusUI();
      Modal.close(DOM.setPinModal);
      Toast.show('4-Digit PIN passcode configured! 🔒', 'success');
    },

    removePin() {
      state.editorPinCode = null;
      NoteManager.updateLockStatusUI();
      Modal.close(DOM.setPinModal);
      Toast.show('Passcode protection removed.', 'info');
    },

    promptUnlock(noteId, action = 'preview') {
      const note = state.notes.find(n => n.id === noteId);
      if (!note) return;

      state.targetUnlockNoteId = noteId;
      state.targetUnlockAction = action;

      DOM.unlockNoteTitle.textContent = note.title ? `"${note.title}"` : 'Enter Passcode';
      DOM.unlockPinErrorText.style.display = 'none';
      DOM.unlockPinDigitsRow.classList.remove('pin-shake');

      const inputs = Array.from(DOM.unlockPinDigitsRow.querySelectorAll('.pin-digit-input'));
      inputs.forEach(i => {
        i.value = '';
        i.classList.remove('filled');
      });

      this.setupPinInputs(DOM.unlockPinDigitsRow, DOM.unlockPinKeypad, () => this.verifyUnlock());
      Modal.open(DOM.pinUnlockModal);
      setTimeout(() => inputs[0].focus(), 120);
    },

    verifyUnlock() {
      const note = state.notes.find(n => n.id === state.targetUnlockNoteId);
      if (!note) {
        Modal.close(DOM.pinUnlockModal);
        return;
      }

      const inputs = Array.from(DOM.unlockPinDigitsRow.querySelectorAll('.pin-digit-input'));
      const enteredPin = inputs.map(i => i.value).join('');

      if (enteredPin === note.pinCode) {
        Modal.close(DOM.pinUnlockModal);
        Toast.show('Note unlocked 🔓', 'success');

        if (state.targetUnlockAction === 'edit') {
          NoteManager.openEditor(note.id, true);
        } else {
          NoteManager.openPreview(note.id, true);
        }
      } else {
        DOM.unlockPinErrorText.textContent = 'Incorrect PIN passcode. Try again.';
        DOM.unlockPinErrorText.style.display = 'block';
        DOM.unlockPinDigitsRow.classList.remove('pin-shake');
        void DOM.unlockPinDigitsRow.offsetWidth;
        DOM.unlockPinDigitsRow.classList.add('pin-shake');
        inputs.forEach(i => {
          i.value = '';
          i.classList.remove('filled');
        });
        inputs[0].focus();
      }
    }
  };

  // --- Note Manager ---
  const NoteManager = {
    openEditor(noteId = null, bypassPin = false) {
      if (noteId) {
        const note = state.notes.find(n => n.id === noteId);
        if (!note) return;

        if (note.pinCode && !bypassPin) {
          PinManager.promptUnlock(note.id, 'edit');
          return;
        }

        state.editingNoteId = noteId;
        DOM.noteForm.reset();
        DOM.modalTagChips.innerHTML = '';
        state.editorTags = Array.isArray(note.tags) ? [...note.tags] : [];

        DOM.editorModeTag.textContent = 'Edit Note';
        DOM.editorModalTitle.textContent = 'Edit Note';
        DOM.noteTitleInput.value = note.title;
        DOM.noteContentInput.value = note.content;
        DOM.noteCategorySelect.value = note.category || 'Personal';

        state.editorColor = note.color || 'default';
        state.editorIsPinned = !!note.isPinned;
        state.editorIsFavorite = !!note.isFavorite;
        state.editorPinCode = note.pinCode || null;

        DOM.editorLastSaved.textContent = `Last updated ${Helpers.timeAgo(note.updatedAt)}`;
      } else {
        state.editingNoteId = null;
        DOM.noteForm.reset();
        DOM.modalTagChips.innerHTML = '';
        state.editorTags = [];

        DOM.editorModeTag.textContent = 'New Note';
        DOM.editorModalTitle.textContent = 'Create Note';
        DOM.noteCategorySelect.value = state.activeCategory || 'Personal';

        state.editorColor = 'default';
        state.editorIsPinned = state.activeView === 'pinned';
        state.editorIsFavorite = state.activeView === 'favorites';
        state.editorPinCode = null;

        DOM.editorLastSaved.textContent = 'Unsaved draft';
      }

      NoteManager.renderEditorTags();
      NoteManager.updateColorPickerUI();
      NoteManager.updateEditorToggleButtons();
      NoteManager.updateLockStatusUI();
      NoteManager.updateEditorMetrics();

      Modal.open(DOM.noteEditorModal);

      setTimeout(() => {
        DOM.noteTitleInput.focus();
      }, 100);
    },

    renderEditorTags() {
      DOM.modalTagChips.innerHTML = '';
      state.editorTags.forEach((tag, idx) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip-item';
        chip.innerHTML = `
          <span>#${Helpers.escapeHtml(tag)}</span>
          <button type="button" class="tag-chip-remove" data-index="${idx}" aria-label="Remove tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        `;
        DOM.modalTagChips.appendChild(chip);
      });
    },

    addEditorTag(tagText) {
      const cleanTag = tagText.trim().toLowerCase().replace(/^[#,\s]+|[,\s]+$/g, '');
      if (cleanTag && !state.editorTags.includes(cleanTag)) {
        if (state.editorTags.length >= 8) {
          Toast.show('Maximum 8 tags allowed per note.', 'warning');
          return;
        }
        state.editorTags.push(cleanTag);
        this.renderEditorTags();
      }
      DOM.tagInputField.value = '';
    },

    removeEditorTag(index) {
      state.editorTags.splice(index, 1);
      this.renderEditorTags();
    },

    updateColorPickerUI() {
      const dots = DOM.colorPalettePicker.querySelectorAll('.color-dot');
      dots.forEach(dot => {
        if (dot.getAttribute('data-color') === state.editorColor) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    },

    updateEditorToggleButtons() {
      if (state.editorIsPinned) {
        DOM.editorPinBtn.classList.add('active-pin');
      } else {
        DOM.editorPinBtn.classList.remove('active-pin');
      }

      if (state.editorIsFavorite) {
        DOM.editorFavoriteBtn.classList.add('active-fav');
      } else {
        DOM.editorFavoriteBtn.classList.remove('active-fav');
      }
    },

    updateLockStatusUI() {
      if (state.editorPinCode) {
        DOM.editorLockBtn.classList.add('active-lock');
        DOM.editorLockPill.classList.add('active-lock');
        DOM.editorLockStatusText.textContent = 'PIN Protected 🔒';
      } else {
        DOM.editorLockBtn.classList.remove('active-lock');
        DOM.editorLockPill.classList.remove('active-lock');
        DOM.editorLockStatusText.textContent = 'Set PIN';
      }
    },

    updateEditorMetrics() {
      const content = DOM.noteContentInput.value || '';
      const charCount = content.length;
      const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

      DOM.editorCharCount.textContent = `${charCount} character${charCount === 1 ? '' : 's'}`;
      DOM.editorWordCount.textContent = `${wordCount} word${wordCount === 1 ? '' : 's'}`;
    },

    saveCurrentNote() {
      const title = DOM.noteTitleInput.value.trim();
      const content = DOM.noteContentInput.value.trim();
      const category = DOM.noteCategorySelect.value;

      if (!title) {
        Toast.show('Please provide a title for your note.', 'warning');
        DOM.noteTitleInput.focus();
        return;
      }

      const now = Date.now();

      if (state.editingNoteId) {
        const noteIndex = state.notes.findIndex(n => n.id === state.editingNoteId);
        if (noteIndex !== -1) {
          const updatedNote = {
            ...state.notes[noteIndex],
            title,
            content,
            category,
            tags: [...state.editorTags],
            color: state.editorColor,
            isPinned: state.editorIsPinned,
            isFavorite: state.editorIsFavorite,
            pinCode: state.editorPinCode || null,
            updatedAt: now
          };
          state.notes[noteIndex] = updatedNote;
          Storage.saveNotes(state.notes);

          // Sync to Cloud Firestore
          if (state.currentUser) {
            FirestoreSync.saveNote(state.currentUser.uid, updatedNote);
          }

          Toast.show('Note updated successfully!', 'success');
        }
      } else {
        const newNote = {
          id: Helpers.uuid(),
          title,
          content,
          category,
          tags: [...state.editorTags],
          color: state.editorColor,
          isPinned: state.editorIsPinned,
          isFavorite: state.editorIsFavorite,
          pinCode: state.editorPinCode || null,
          isTrash: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
        state.notes.unshift(newNote);
        Storage.saveNotes(state.notes);

        // Sync to Cloud Firestore
        if (state.currentUser) {
          FirestoreSync.saveNote(state.currentUser.uid, newNote);
        }

        Toast.show('Note created successfully!', 'success');
      }

      Modal.close(DOM.noteEditorModal);
      App.render();
    },

    togglePin(noteId, event = null) {
      if (event) event.stopPropagation();
      const note = state.notes.find(n => n.id === noteId);
      if (!note) return;

      note.isPinned = !note.isPinned;
      note.updatedAt = Date.now();
      Storage.saveNotes(state.notes);

      // Sync to Cloud Firestore
      if (state.currentUser) {
        FirestoreSync.saveNote(state.currentUser.uid, note);
      }

      Toast.show(note.isPinned ? 'Note pinned to top 📌' : 'Note unpinned', 'info');
      App.render();
    },

    toggleFavorite(noteId, event = null) {
      if (event) event.stopPropagation();
      const note = state.notes.find(n => n.id === noteId);
      if (!note) return;

      note.isFavorite = !note.isFavorite;
      note.updatedAt = Date.now();
      Storage.saveNotes(state.notes);

      // Sync to Cloud Firestore
      if (state.currentUser) {
        FirestoreSync.saveNote(state.currentUser.uid, note);
      }

      Toast.show(note.isFavorite ? 'Added to favorites ⭐' : 'Removed from favorites', 'info');
      App.render();
    },

    moveToTrash(noteId, event = null) {
      if (event) event.stopPropagation();
      const note = state.notes.find(n => n.id === noteId);
      if (!note) return;

      note.isTrash = true;
      note.deletedAt = Date.now();
      note.updatedAt = Date.now();
      Storage.saveNotes(state.notes);

      // Sync to Cloud Firestore
      if (state.currentUser) {
        FirestoreSync.saveNote(state.currentUser.uid, note);
      }

      Toast.show('Note moved to trash 🗑️', 'warning', () => {
        note.isTrash = false;
        note.deletedAt = null;
        note.updatedAt = Date.now();
        Storage.saveNotes(state.notes);

        if (state.currentUser) {
          FirestoreSync.saveNote(state.currentUser.uid, note);
        }

        Toast.show('Note restored from trash!', 'success');
        App.render();
      });

      App.render();
    },

    restoreFromTrash(noteId, event = null) {
      if (event) event.stopPropagation();
      const note = state.notes.find(n => n.id === noteId);
      if (!note) return;

      note.isTrash = false;
      note.deletedAt = null;
      note.updatedAt = Date.now();
      Storage.saveNotes(state.notes);

      // Sync to Cloud Firestore
      if (state.currentUser) {
        FirestoreSync.saveNote(state.currentUser.uid, note);
      }

      Toast.show('Note restored successfully! ✨', 'success');
      App.render();
    },

    permanentDelete(noteId, event = null) {
      if (event) event.stopPropagation();
      const note = state.notes.find(n => n.id === noteId);
      if (!note) return;

      Modal.confirm({
        title: 'Permanently Delete Note?',
        message: `Are you sure you want to permanently delete "${note.title}"? This cannot be undone.`,
        proceedText: 'Delete Permanently',
        isDanger: true,
        onProceed: () => {
          state.notes = state.notes.filter(n => n.id !== noteId);
          Storage.saveNotes(state.notes);

          // Sync deletion to Cloud Firestore
          if (state.currentUser) {
            FirestoreSync.deleteNote(state.currentUser.uid, noteId);
          }

          Toast.show('Note permanently deleted.', 'danger');
          App.render();
        }
      });
    },

    emptyTrash() {
      const trashNotes = state.notes.filter(n => n.isTrash);
      const trashCount = trashNotes.length;
      if (trashCount === 0) {
        Toast.show('Trash is already empty.', 'info');
        return;
      }

      Modal.confirm({
        title: 'Empty Trash?',
        message: `Permanently delete all ${trashCount} note(s) in trash? This action cannot be reversed.`,
        proceedText: 'Empty Trash',
        isDanger: true,
        onProceed: () => {
          const trashIds = trashNotes.map(n => n.id);
          state.notes = state.notes.filter(n => !n.isTrash);
          Storage.saveNotes(state.notes);

          // Batch delete from Cloud Firestore
          if (state.currentUser) {
            FirestoreSync.emptyTrashBatch(state.currentUser.uid, trashIds);
          }

          Toast.show('Trash emptied successfully.', 'danger');
          App.render();
        }
      });
    },

    openPreview(noteId, bypassPin = false) {
      const note = state.notes.find(n => n.id === noteId);
      if (!note) return;

      if (note.pinCode && !bypassPin) {
        PinManager.promptUnlock(note.id, 'preview');
        return;
      }

      DOM.previewCategoryBadge.textContent = note.category || 'General';
      DOM.previewCategoryBadge.className = `preview-category-badge category-pill cat-${(note.category || 'other').toLowerCase()}`;
      DOM.previewDateLabel.textContent = `Created ${Helpers.formatDate(note.createdAt)}`;
      DOM.previewUpdatedLabel.textContent = `Last updated ${Helpers.timeAgo(note.updatedAt)}`;

      DOM.previewModalTitle.textContent = note.title;
      DOM.previewContentRendered.innerHTML = Helpers.renderMarkdown(note.content);

      DOM.previewTagsRow.innerHTML = '';
      if (Array.isArray(note.tags) && note.tags.length > 0) {
        note.tags.forEach(tag => {
          const span = document.createElement('span');
          span.className = 'tag-badge';
          span.textContent = `#${tag}`;
          DOM.previewTagsRow.appendChild(span);
        });
      }

      if (note.isPinned) {
        DOM.previewPinBtn.classList.add('active-pin');
      } else {
        DOM.previewPinBtn.classList.remove('active-pin');
      }

      if (note.isFavorite) {
        DOM.previewFavoriteBtn.classList.add('active-fav');
      } else {
        DOM.previewFavoriteBtn.classList.remove('active-fav');
      }

      if (note.pinCode) {
        DOM.previewLockBtn.classList.add('active-lock');
        DOM.previewLockBtn.title = 'Protected with 4-Digit PIN (Click to change/remove)';
      } else {
        DOM.previewLockBtn.classList.remove('active-lock');
        DOM.previewLockBtn.title = 'Set 4-Digit PIN Lock';
      }

      DOM.previewLockBtn.onclick = () => {
        Modal.close(DOM.notePreviewModal);
        NoteManager.openEditor(note.id, true);
        PinManager.openSetPinModal();
      };

      DOM.previewPinBtn.onclick = () => {
        NoteManager.togglePin(note.id);
        NoteManager.openPreview(note.id, true);
      };

      DOM.previewFavoriteBtn.onclick = () => {
        NoteManager.toggleFavorite(note.id);
        NoteManager.openPreview(note.id, true);
      };

      DOM.previewEditBtn.onclick = () => {
        Modal.close(DOM.notePreviewModal);
        NoteManager.openEditor(note.id, true);
      };

      DOM.previewEditBottomBtn.onclick = () => {
        Modal.close(DOM.notePreviewModal);
        NoteManager.openEditor(note.id, true);
      };

      Modal.open(DOM.notePreviewModal);
    }
  };

  // --- Main Application Controller ---
  const App = {
    init() {
      // 1. Load settings & theme
      Storage.loadSettings();
      this.applyTheme(state.theme);
      DOM.sortSelect.value = state.sortBy;
      this.applyViewMode(state.viewMode);

      // 2. Load Firebase config into settings UI
      this.populateFirebaseConfigUI();

      // 3. Bind UI event listeners
      this.bindEvents();

      // 4. Check Authentication state
      this.initAuth();
    },

    initAuth() {
      // Initialize Firebase Auth listener
      try {
        onAuthStatusChange((user) => {
          if (user) {
            this.setUser(user);
          } else {
            this.showAuthScreen();
          }
        });
      } catch (err) {
        console.warn('Firebase auth listener init issue, showing auth screen:', err);
        this.showAuthScreen();
      }
    },

    updateSyncStatusUI(status, message = '') {
      if (!DOM.syncStatusIndicator) return;

      // Remove old status classes
      DOM.syncStatusIndicator.classList.remove('status-synced', 'status-syncing', 'status-offline', 'status-error');
      DOM.syncStatusIndicator.classList.add(`status-${status}`);

      const iconSynced = DOM.syncStatusIcon ? DOM.syncStatusIcon.querySelector('.icon-cloud-synced') : null;
      const iconSyncing = DOM.syncStatusIcon ? DOM.syncStatusIcon.querySelector('.icon-cloud-syncing') : null;
      const iconOffline = DOM.syncStatusIcon ? DOM.syncStatusIcon.querySelector('.icon-cloud-offline') : null;
      const iconError = DOM.syncStatusIcon ? DOM.syncStatusIcon.querySelector('.icon-cloud-error') : null;

      if (iconSynced) iconSynced.style.display = status === 'synced' ? 'block' : 'none';
      if (iconSyncing) iconSyncing.style.display = status === 'syncing' ? 'block' : 'none';
      if (iconOffline) iconOffline.style.display = status === 'offline' ? 'block' : 'none';
      if (iconError) iconError.style.display = status === 'error' ? 'block' : 'none';

      let statusLabel = '☁️ Synced';
      if (status === 'syncing') statusLabel = '🔄 Syncing...';
      else if (status === 'offline') statusLabel = '📴 Offline';
      else if (status === 'error') statusLabel = '⚠️ Sync Error';

      if (DOM.syncStatusText) DOM.syncStatusText.textContent = statusLabel;
      DOM.syncStatusIndicator.title = message || `Firestore Cloud Sync: ${statusLabel}`;

      // Update Settings Modal Sync Card
      if (DOM.settingsSyncBadge) {
        DOM.settingsSyncBadge.className = `badge-subtle badge-sync-status status-${status}`;
        DOM.settingsSyncBadge.textContent = statusLabel;
      }
      if (DOM.settingsSyncStatusText) {
        if (status === 'synced') {
          DOM.settingsSyncStatusText.textContent = 'All notes are securely synchronized with Cloud Firestore.';
        } else if (status === 'syncing') {
          DOM.settingsSyncStatusText.textContent = message || 'Synchronizing notes with Cloud Firestore...';
        } else if (status === 'offline') {
          DOM.settingsSyncStatusText.textContent = 'Working in offline mode. Changes saved locally.';
        } else if (status === 'error') {
          DOM.settingsSyncStatusText.textContent = message || 'Sync issue detected. Local cache remains active.';
        }
      }
    },

    setUser(user) {
      state.currentUser = user;
      state.userName = user.displayName || 'Sandy';
      Storage.saveSettings();

      // Hide Login Screen
      DOM.authScreen.classList.add('hidden');

      // Update User Profile UI
      this.updateUserProfileUI();

      // 1. Instant load from LocalStorage cache (instant startup / offline fallback)
      state.notes = Storage.loadNotes();
      this.render();

      // 2. Subscribe to live Firestore Sync connection state
      FirestoreSync.onStatusChange((status, message) => {
        this.updateSyncStatusUI(status, message);
      });

      // 3. Connect to Cloud Firestore with real-time onSnapshot listener
      FirestoreSync.startSync(user.uid, {
        onNotesReceived: (cloudNotes, isInitial) => {
          // If cloud has 0 notes on first login but local has existing notes, migrate local notes to cloud
          if (isInitial && cloudNotes.length === 0 && state.notes.length > 0) {
            console.log('Initial cloud sync: Migrating local notes to Cloud Firestore...');
            FirestoreSync.batchUploadNotes(user.uid, state.notes);
            return;
          }

          state.notes = cloudNotes;
          Storage.saveNotes(state.notes);
          this.render();
        },
        onError: (err) => {
          console.warn('Firestore cloud sync notice:', err);
        }
      });
    },

    showAuthScreen() {
      state.currentUser = null;
      FirestoreSync.stopSync();
      this.updateSyncStatusUI(SYNC_STATUS.OFFLINE, 'Sign in to enable Cloud Sync');
      DOM.authScreen.classList.remove('hidden');

      // Update Firebase connection status badge on login screen
      if (isCustomConfigConfigured()) {
        DOM.authFirebaseStatusText.textContent = 'Custom Firebase Active';
        DOM.firebaseConfigStatusBadge.textContent = 'Custom Config Active';
      } else {
        DOM.authFirebaseStatusText.textContent = 'Firebase Ready (Demo Config)';
        DOM.firebaseConfigStatusBadge.textContent = 'Default Demo Config';
      }
    },

    updateUserProfileUI() {
      const user = state.currentUser || {
        displayName: state.userName || 'User',
        email: 'user@gmail.com',
        provider: 'google'
      };

      const displayName = user.displayName || 'User';
      DOM.greetingHeading.textContent = Helpers.getGreeting(displayName);
      DOM.sidebarUserName.textContent = displayName;
      DOM.settingsUserDisplay.textContent = displayName;
      DOM.settingsUserEmail.textContent = user.email || 'user@gmail.com';

      if (user.provider === 'password') {
        DOM.sidebarUserStatus.textContent = 'Email Account';
      } else {
        DOM.sidebarUserStatus.textContent = 'Google Account';
      }

      // Profile Avatar Image handling
      if (user.photoURL) {
        DOM.sidebarAvatarImg.src = user.photoURL;
        DOM.sidebarAvatarImg.style.display = 'block';
        DOM.sidebarAvatar.style.display = 'none';

        DOM.settingsAvatarImg.src = user.photoURL;
        DOM.settingsAvatarImg.style.display = 'block';
        DOM.settingsAvatarInitial.style.display = 'none';
      } else {
        const initial = (displayName.charAt(0) || 'S').toUpperCase();
        DOM.sidebarAvatar.textContent = initial;
        DOM.sidebarAvatar.style.display = 'block';
        DOM.sidebarAvatarImg.style.display = 'none';

        DOM.settingsAvatarInitial.textContent = initial;
        DOM.settingsAvatarInitial.style.display = 'block';
        DOM.settingsAvatarImg.style.display = 'none';
      }
    },

    setAuthMode(mode = 'signin') {
      state.authMode = mode;
      DOM.authErrorAlert.style.display = 'none';
      if (DOM.authSuccessAlert) DOM.authSuccessAlert.style.display = 'none';

      if (mode === 'signup') {
        DOM.authTabSignUp.classList.add('active');
        DOM.authTabSignUp.setAttribute('aria-selected', 'true');
        DOM.authTabSignIn.classList.remove('active');
        DOM.authTabSignIn.setAttribute('aria-selected', 'false');

        DOM.authMainTitle.textContent = 'Create an Account';
        DOM.authMainSubtitle.textContent = 'Sign up with your Gmail/email & password to get started with NoteFlow.';
        DOM.authNameGroup.style.display = 'flex';
        DOM.btnForgotPassword.style.display = 'none';
        DOM.emailAuthBtnText.textContent = 'Create Account';
        if (DOM.authSwitchPromptText) DOM.authSwitchPromptText.textContent = 'Already have an account?';
        if (DOM.btnSwitchAuthMode) DOM.btnSwitchAuthMode.textContent = 'Sign In';
      } else {
        DOM.authTabSignIn.classList.add('active');
        DOM.authTabSignIn.setAttribute('aria-selected', 'true');
        DOM.authTabSignUp.classList.remove('active');
        DOM.authTabSignUp.setAttribute('aria-selected', 'false');

        DOM.authMainTitle.textContent = 'Welcome Back';
        DOM.authMainSubtitle.textContent = 'Sign in with your Gmail/email & password or Google account.';
        DOM.authNameGroup.style.display = 'none';
        DOM.btnForgotPassword.style.display = 'inline-block';
        DOM.emailAuthBtnText.textContent = 'Sign In';
        if (DOM.authSwitchPromptText) DOM.authSwitchPromptText.textContent = "Don't have an account yet?";
        if (DOM.btnSwitchAuthMode) DOM.btnSwitchAuthMode.textContent = 'Create Account';
      }
    },

    togglePasswordVisibility() {
      state.authPasswordVisible = !state.authPasswordVisible;
      const isVisible = state.authPasswordVisible;
      DOM.authPasswordInput.type = isVisible ? 'text' : 'password';

      const eyeOpen = DOM.togglePasswordVisibilityBtn.querySelector('.icon-eye-open');
      const eyeClosed = DOM.togglePasswordVisibilityBtn.querySelector('.icon-eye-closed');
      if (eyeOpen && eyeClosed) {
        eyeOpen.style.display = isVisible ? 'none' : 'block';
        eyeClosed.style.display = isVisible ? 'block' : 'none';
      }
    },

    async handleEmailAuth(e) {
      if (e) e.preventDefault();
      DOM.authErrorAlert.style.display = 'none';
      if (DOM.authSuccessAlert) DOM.authSuccessAlert.style.display = 'none';

      const email = DOM.authEmailInput.value.trim();
      const password = DOM.authPasswordInput.value;
      const name = DOM.authNameInput ? DOM.authNameInput.value.trim() : '';

      if (!email) {
        this.showAuthError('Please enter your email or Gmail address.');
        DOM.authEmailInput.focus();
        return;
      }

      if (!password || password.length < 6) {
        this.showAuthError('Password must be at least 6 characters.');
        DOM.authPasswordInput.focus();
        return;
      }

      DOM.emailAuthSpinnerWrapper.style.display = 'inline-flex';
      DOM.btnEmailAuthSubmit.disabled = true;
      DOM.emailAuthBtnText.textContent = state.authMode === 'signup' ? 'Creating Account...' : 'Signing In...';

      try {
        let result;
        if (state.authMode === 'signup') {
          result = await signUpWithEmail(email, password, name);
        } else {
          result = await signInWithEmail(email, password);
        }

        if (result.success) {
          DOM.emailAuthForm.reset();
          this.setUser(result.user);
          Toast.show(`Welcome, ${result.user.displayName}! 🎉`, 'success');
        } else {
          this.showAuthError(result.message || 'Authentication failed. Please check your credentials.', result.code);
        }
      } catch (err) {
        console.error('Email Auth error:', err);
        this.showAuthError('An unexpected error occurred. Please try again.');
      } finally {
        DOM.emailAuthSpinnerWrapper.style.display = 'none';
        DOM.btnEmailAuthSubmit.disabled = false;
        DOM.emailAuthBtnText.textContent = state.authMode === 'signup' ? 'Create Account' : 'Sign In';
      }
    },

    showAuthError(message, code = null) {
      if (DOM.authSuccessAlert) DOM.authSuccessAlert.style.display = 'none';
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        DOM.authErrorText.innerHTML = `Invalid email or password. Don't have an account? <button type="button" class="auth-error-link" id="authErrorCreateAccountLink">Create Account</button>`;
        const link = document.getElementById('authErrorCreateAccountLink');
        if (link) {
          link.onclick = (e) => {
            e.preventDefault();
            this.setAuthMode('signup');
          };
        }
      } else {
        DOM.authErrorText.textContent = message;
      }
      DOM.authErrorAlert.style.display = 'flex';
      DOM.emailAuthForm.classList.remove('pin-shake');
      void DOM.emailAuthForm.offsetWidth;
      DOM.emailAuthForm.classList.add('pin-shake');
    },

    async handleForgotPassword() {
      if (DOM.authSuccessAlert) DOM.authSuccessAlert.style.display = 'none';
      const email = DOM.authEmailInput.value.trim();
      if (!email) {
        this.showAuthError('Please enter your email address above to receive a password reset link.');
        DOM.authEmailInput.focus();
        return;
      }

      try {
        const result = await resetPassword(email);
        if (result.success) {
          if (DOM.authSuccessAlert && DOM.authSuccessText) {
            DOM.authSuccessText.textContent = `Password reset link sent to ${email}! Please check your inbox (and spam folder). ✉️`;
            DOM.authSuccessAlert.style.display = 'flex';
          }
          Toast.show(`Password reset link sent to ${email}! ✉️`, 'success');
          DOM.authErrorAlert.style.display = 'none';
        } else {
          this.showAuthError(result.message || 'Could not send password reset email.');
        }
      } catch (err) {
        this.showAuthError('Failed to send reset link.');
      }
    },

    async handleGoogleSignIn() {
      DOM.googleSpinnerWrapper.style.display = 'flex';
      DOM.googleIconWrapper.style.display = 'none';
      DOM.googleBtnText.textContent = 'Signing in...';
      DOM.btnGoogleSignIn.disabled = true;

      try {
        const result = await signInWithGoogle();
        if (result.success) {
          this.setUser(result.user);
          Toast.show(`Welcome back, ${result.user.displayName}! 🎉`, 'success');
        } else {
          Toast.show(result.message || 'Google Sign-In was cancelled or failed.', 'warning');
        }
      } catch (err) {
        console.error('Google Sign-In Error:', err);
        Toast.show('Failed to authenticate with Google.', 'danger');
      } finally {
        DOM.googleSpinnerWrapper.style.display = 'none';
        DOM.googleIconWrapper.style.display = 'flex';
        DOM.googleBtnText.textContent = 'Continue with Google';
        DOM.btnGoogleSignIn.disabled = false;
      }
    },

    async handleSignOut() {
      Modal.confirm({
        title: 'Sign Out?',
        message: 'Are you sure you want to sign out of NoteFlow?',
        proceedText: 'Sign Out',
        isDanger: false,
        onProceed: async () => {
          FirestoreSync.stopSync();
          await signOutUser();
          Modal.close(DOM.settingsModal);
          this.showAuthScreen();
          Toast.show('Signed out successfully.', 'info');
        }
      });
    },

    populateFirebaseConfigUI() {
      const cfg = getStoredFirebaseConfig();
      DOM.cfgApiKey.value = cfg.apiKey || '';
      DOM.cfgAuthDomain.value = cfg.authDomain || '';
      DOM.cfgProjectId.value = cfg.projectId || '';
      DOM.cfgAppId.value = cfg.appId || '';

      if (isCustomConfigConfigured()) {
        DOM.firebaseConfigStatusBadge.textContent = 'Custom Config Active';
      } else {
        DOM.firebaseConfigStatusBadge.textContent = 'Default Active';
      }
    },

    saveFirebaseConfigFromUI() {
      const apiKey = DOM.cfgApiKey.value.trim();
      const authDomain = DOM.cfgAuthDomain.value.trim();
      const projectId = DOM.cfgProjectId.value.trim();
      const appId = DOM.cfgAppId.value.trim();

      if (!apiKey || !projectId) {
        Toast.show('API Key and Project ID are required.', 'warning');
        return;
      }

      const newConfig = {
        apiKey,
        authDomain: authDomain || `${projectId}.firebaseapp.com`,
        projectId,
        storageBucket: `${projectId}.appspot.com`,
        appId
      };

      saveCustomFirebaseConfig(newConfig);
      initFirebaseAuth();
      this.populateFirebaseConfigUI();
      Toast.show('Firebase credentials updated! ⚡', 'success');
    },

    resetFirebaseConfig() {
      localStorage.removeItem('noteflow_firebase_config_v1');
      this.populateFirebaseConfigUI();
      initFirebaseAuth();
      Toast.show('Reset to default Firebase configuration.', 'info');
    },

    applyTheme(theme) {
      state.theme = theme;
      DOM.html.setAttribute('data-theme', theme);
      Storage.saveSettings();

      const themeBtns = DOM.settingsModal.querySelectorAll('.theme-choice-btn');
      themeBtns.forEach(btn => {
        if (btn.getAttribute('data-theme-choice') === theme) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    },

    applyViewMode(mode) {
      state.viewMode = mode;
      Storage.saveSettings();

      if (mode === 'list') {
        DOM.mainNotesGrid.classList.add('list-view');
        DOM.pinnedNotesGrid.classList.add('list-view');
        DOM.btnListView.classList.add('active');
        DOM.btnGridView.classList.remove('active');
      } else {
        DOM.mainNotesGrid.classList.remove('list-view');
        DOM.pinnedNotesGrid.classList.remove('list-view');
        DOM.btnGridView.classList.add('active');
        DOM.btnListView.classList.remove('active');
      }
    },

    getFilteredNotes() {
      let filtered = [...state.notes];

      if (state.activeView === 'all') {
        filtered = filtered.filter(n => !n.isTrash);
      } else if (state.activeView === 'pinned') {
        filtered = filtered.filter(n => !n.isTrash && n.isPinned);
      } else if (state.activeView === 'favorites') {
        filtered = filtered.filter(n => !n.isTrash && n.isFavorite);
      } else if (state.activeView === 'trash') {
        filtered = filtered.filter(n => n.isTrash);
      }

      if (state.activeCategory && state.activeView !== 'trash') {
        filtered = filtered.filter(n => (n.category || '').toLowerCase() === state.activeCategory.toLowerCase());
      }

      if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase().trim();
        filtered = filtered.filter(n => {
          const matchTitle = (n.title || '').toLowerCase().includes(q);
          const matchContent = (n.content || '').toLowerCase().includes(q);
          const matchCategory = (n.category || '').toLowerCase().includes(q);
          const matchTags = Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(q));
          return matchTitle || matchContent || matchCategory || matchTags;
        });
      }

      filtered.sort((a, b) => {
        if (state.sortBy === 'updated_desc') return b.updatedAt - a.updatedAt;
        if (state.sortBy === 'created_desc') return b.createdAt - a.createdAt;
        if (state.sortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '');
        if (state.sortBy === 'title_desc') return (b.title || '').localeCompare(a.title || '');
        return 0;
      });

      return filtered;
    },

    updateCounters() {
      const activeNotes = state.notes.filter(n => !n.isTrash);
      const pinnedNotes = state.notes.filter(n => !n.isTrash && n.isPinned);
      const favoriteNotes = state.notes.filter(n => !n.isTrash && n.isFavorite);
      const trashNotes = state.notes.filter(n => n.isTrash);

      DOM.statTotalNotes.textContent = activeNotes.length;
      DOM.statPinnedNotes.textContent = pinnedNotes.length;
      DOM.statFavoriteNotes.textContent = favoriteNotes.length;

      DOM.countAllNotes.textContent = activeNotes.length;
      DOM.countPinned.textContent = pinnedNotes.length;
      DOM.countFavorites.textContent = favoriteNotes.length;
      DOM.countTrash.textContent = trashNotes.length;

      const categories = ['Personal', 'Work', 'Study', 'Project', 'Ideas', 'Other'];
      categories.forEach(cat => {
        const count = activeNotes.filter(n => (n.category || '').toLowerCase() === cat.toLowerCase()).length;
        const el = DOM[`countCat${cat}`];
        if (el) el.textContent = count;
      });
    },

    createNoteCardElement(note) {
      const card = document.createElement('div');
      card.className = 'note-card';
      card.setAttribute('data-note-id', note.id);
      card.setAttribute('data-card-color', note.color || 'default');

      const isLocked = Boolean(note.pinCode);

      let tagsHtml = '';
      if (Array.isArray(note.tags) && note.tags.length > 0) {
        tagsHtml = `<div class="card-tags">
          ${note.tags.map(t => `<span class="tag-badge">#${Helpers.escapeHtml(t)}</span>`).join('')}
        </div>`;
      }

      const catLower = (note.category || 'other').toLowerCase();

      let headerActionsHtml = '';
      if (!note.isTrash) {
        headerActionsHtml = `
          <div class="card-quick-actions">
            <button class="card-icon-btn ${note.isPinned ? 'active-pin' : ''}" data-action="pin" title="${note.isPinned ? 'Unpin note' : 'Pin note'}" aria-label="Pin note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
            </button>
            <button class="card-icon-btn ${note.isFavorite ? 'active-fav' : ''}" data-action="favorite" title="${note.isFavorite ? 'Remove favorite' : 'Favorite note'}" aria-label="Favorite note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
          </div>
        `;
      }

      let footerActionsHtml = '';
      if (note.isTrash) {
        footerActionsHtml = `
          <div class="card-actions-menu">
            <button class="btn btn-secondary btn-sm" data-action="restore" title="Restore note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
              <span>Restore</span>
            </button>
            <button class="btn btn-danger-outline btn-sm" data-action="perm-delete" title="Permanently delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        `;
      } else {
        footerActionsHtml = `
          <div class="card-actions-menu">
            <button class="card-icon-btn" data-action="edit" title="Edit Note" aria-label="Edit Note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="card-icon-btn" data-action="trash" title="Move to Trash" aria-label="Move to Trash">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        `;
      }

      const lockBadgeHtml = note.pinCode ? `
        <span class="lock-indicator-badge" title="4-Digit PIN Protected">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </span>
      ` : '';

      const previewHtml = isLocked ? `
        <div class="card-preview">
          <div class="locked-preview-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Protected with PIN. Click to unlock.</span>
          </div>
        </div>
      ` : `
        <div class="card-preview">${Helpers.escapeHtml(note.content)}</div>
      `;

      card.innerHTML = `
        <div class="card-header">
          <h3 class="card-title">${Helpers.escapeHtml(note.title)}${lockBadgeHtml}</h3>
          ${headerActionsHtml}
        </div>
        ${previewHtml}
        ${tagsHtml}
        <div class="card-footer">
          <div class="card-meta-left">
            <span class="category-pill cat-${catLower}">${Helpers.escapeHtml(note.category || 'General')}</span>
            <span class="card-time">${Helpers.timeAgo(note.updatedAt)}</span>
          </div>
          ${footerActionsHtml}
        </div>
      `;

      card.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          const action = actionBtn.getAttribute('data-action');
          if (action === 'pin') NoteManager.togglePin(note.id, e);
          else if (action === 'favorite') NoteManager.toggleFavorite(note.id, e);
          else if (action === 'edit') {
            e.stopPropagation();
            if (isLocked) {
              PinManager.promptUnlock(note.id, 'edit');
            } else {
              NoteManager.openEditor(note.id);
            }
          }
          else if (action === 'trash') NoteManager.moveToTrash(note.id, e);
          else if (action === 'restore') NoteManager.restoreFromTrash(note.id, e);
          else if (action === 'perm-delete') NoteManager.permanentDelete(note.id, e);
        } else {
          if (note.isTrash) {
            Toast.show('Note is in trash. Restore it to edit or view.', 'info');
          } else if (isLocked) {
            PinManager.promptUnlock(note.id, 'preview');
          } else {
            NoteManager.openPreview(note.id);
          }
        }
      });

      return card;
    },

    render() {
      this.updateCounters();
      this.updateUserProfileUI();

      const filteredNotes = this.getFilteredNotes();

      let titleText = 'All Notes';
      if (state.activeView === 'pinned') titleText = 'Pinned Notes';
      else if (state.activeView === 'favorites') titleText = 'Favorite Notes';
      else if (state.activeView === 'trash') titleText = 'Trash Bin';

      if (state.activeCategory && state.activeView !== 'trash') {
        titleText = `${state.activeCategory} Notes`;
      }

      DOM.currentViewTitle.textContent = titleText;
      DOM.resultsCountBadge.textContent = `${filteredNotes.length} note${filteredNotes.length === 1 ? '' : 's'}`;

      if (state.activeView === 'trash') {
        DOM.trashControls.style.display = 'block';
      } else {
        DOM.trashControls.style.display = 'none';
      }

      if (state.activeCategory) {
        DOM.resetCategoryFilterBtn.style.display = 'flex';
      } else {
        DOM.resetCategoryFilterBtn.style.display = 'none';
      }

      DOM.activeFilterChips.innerHTML = '';
      if (state.activeCategory) {
        const chip = document.createElement('span');
        chip.className = 'filter-chip';
        chip.innerHTML = `
          <span>Category: ${Helpers.escapeHtml(state.activeCategory)}</span>
          <button type="button" class="filter-chip-remove" id="clearCatFilterChip" aria-label="Clear category filter">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        `;
        DOM.activeFilterChips.appendChild(chip);
        chip.querySelector('#clearCatFilterChip').addEventListener('click', () => {
          state.activeCategory = null;
          App.updateNavActiveState();
          App.render();
        });
      }

      if (state.searchQuery.trim()) {
        const searchChip = document.createElement('span');
        searchChip.className = 'filter-chip';
        searchChip.innerHTML = `
          <span>Search: "${Helpers.escapeHtml(state.searchQuery)}"</span>
          <button type="button" class="filter-chip-remove" id="clearSearchChip" aria-label="Clear search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        `;
        DOM.activeFilterChips.appendChild(searchChip);
        searchChip.querySelector('#clearSearchChip').addEventListener('click', () => {
          DOM.searchInput.value = '';
          DOM.searchClearBtn.style.display = 'none';
          state.searchQuery = '';
          App.render();
        });
      }

      if (filteredNotes.length === 0) {
        DOM.mainNotesGrid.innerHTML = '';
        DOM.pinnedNotesGrid.innerHTML = '';
        DOM.pinnedSectionWrapper.style.display = 'none';
        DOM.emptyStateContainer.style.display = 'flex';

        if (state.searchQuery.trim()) {
          DOM.emptyStateTitle.textContent = 'No matching notes found';
          DOM.emptyStateDesc.textContent = `We couldn't find any notes matching "${state.searchQuery}". Try different keywords or clear your search.`;
          DOM.emptyStateBtn.innerHTML = `<span>Clear Search</span>`;
          DOM.emptyStateBtn.onclick = () => {
            DOM.searchInput.value = '';
            DOM.searchClearBtn.style.display = 'none';
            state.searchQuery = '';
            App.render();
          };
        } else if (state.activeView === 'pinned') {
          DOM.emptyStateTitle.textContent = 'No pinned notes yet';
          DOM.emptyStateDesc.textContent = 'Pin your important notes to keep them accessible right at the top of your dashboard.';
          DOM.emptyStateBtn.innerHTML = `<span>Browse All Notes</span>`;
          DOM.emptyStateBtn.onclick = () => {
            App.setActiveView('all');
          };
        } else if (state.activeView === 'favorites') {
          DOM.emptyStateTitle.textContent = 'No favorite notes yet';
          DOM.emptyStateDesc.textContent = 'Star your most cherished notes to collect them here in your favorites list.';
          DOM.emptyStateBtn.innerHTML = `<span>Browse All Notes</span>`;
          DOM.emptyStateBtn.onclick = () => {
            App.setActiveView('all');
          };
        } else if (state.activeView === 'trash') {
          DOM.emptyStateTitle.textContent = 'Your trash is clean';
          DOM.emptyStateDesc.textContent = 'Deleted notes will be preserved here so you can restore them whenever needed.';
          DOM.emptyStateBtn.innerHTML = `<span>Back to Notes</span>`;
          DOM.emptyStateBtn.onclick = () => {
            App.setActiveView('all');
          };
        } else if (state.activeCategory) {
          DOM.emptyStateTitle.textContent = `No notes in ${state.activeCategory}`;
          DOM.emptyStateDesc.textContent = `You don't have any notes categorized under "${state.activeCategory}" yet.`;
          DOM.emptyStateBtn.innerHTML = `<span>+ Create Note in ${state.activeCategory}</span>`;
          DOM.emptyStateBtn.onclick = () => {
            NoteManager.openEditor();
          };
        } else {
          DOM.emptyStateTitle.textContent = 'No notes yet';
          DOM.emptyStateDesc.textContent = 'Create your first note to capture ideas, manage tasks, and organize your work effortlessly.';
          DOM.emptyStateBtn.innerHTML = `<span>+ Create First Note</span>`;
          DOM.emptyStateBtn.onclick = () => {
            NoteManager.openEditor();
          };
        }
        return;
      }

      DOM.emptyStateContainer.style.display = 'none';

      const shouldSplitPinned = state.activeView === 'all' && !state.activeCategory && !state.searchQuery.trim();
      const pinnedNotes = filteredNotes.filter(n => n.isPinned);
      const otherNotes = filteredNotes.filter(n => !n.isPinned);

      if (shouldSplitPinned && pinnedNotes.length > 0 && otherNotes.length > 0) {
        DOM.pinnedSectionWrapper.style.display = 'block';

        DOM.pinnedNotesGrid.innerHTML = '';
        pinnedNotes.forEach(note => {
          DOM.pinnedNotesGrid.appendChild(this.createNoteCardElement(note));
        });

        DOM.mainNotesGrid.innerHTML = '';
        otherNotes.forEach(note => {
          DOM.mainNotesGrid.appendChild(this.createNoteCardElement(note));
        });
      } else {
        DOM.pinnedSectionWrapper.style.display = 'none';
        DOM.pinnedNotesGrid.innerHTML = '';

        DOM.mainNotesGrid.innerHTML = '';
        filteredNotes.forEach(note => {
          DOM.mainNotesGrid.appendChild(this.createNoteCardElement(note));
        });
      }
    },

    setActiveView(viewName) {
      state.activeView = viewName;
      state.activeCategory = null;
      this.updateNavActiveState();
      this.render();
      App.closeSidebar();
    },

    setActiveCategory(category) {
      if (state.activeCategory === category) {
        state.activeCategory = null;
      } else {
        state.activeCategory = category;
        state.activeView = 'all';
      }
      this.updateNavActiveState();
      this.render();
      App.closeSidebar();
    },

    updateNavActiveState() {
      const navButtons = [DOM.navAllNotes, DOM.navPinned, DOM.navFavorites, DOM.navTrash];
      navButtons.forEach(btn => {
        if (!state.activeCategory && btn.getAttribute('data-view') === state.activeView) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      const catButtons = DOM.categoryNavList.querySelectorAll('.category-nav-item');
      catButtons.forEach(btn => {
        if (state.activeCategory && btn.getAttribute('data-category').toLowerCase() === state.activeCategory.toLowerCase()) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    },

    openSidebar() {
      DOM.sidebar.classList.add('open');
      DOM.sidebarOverlay.classList.add('active');
    },

    closeSidebar() {
      DOM.sidebar.classList.remove('open');
      DOM.sidebarOverlay.classList.remove('active');
    },

    bindEvents() {
      // Auth Actions (Email / Gmail & Google)
      DOM.authTabSignIn.addEventListener('click', () => this.setAuthMode('signin'));
      DOM.authTabSignUp.addEventListener('click', () => this.setAuthMode('signup'));
      if (DOM.btnSwitchAuthMode) {
        DOM.btnSwitchAuthMode.addEventListener('click', () => this.setAuthMode(state.authMode === 'signin' ? 'signup' : 'signin'));
      }
      DOM.emailAuthForm.addEventListener('submit', (e) => this.handleEmailAuth(e));
      DOM.togglePasswordVisibilityBtn.addEventListener('click', () => this.togglePasswordVisibility());
      DOM.btnForgotPassword.addEventListener('click', () => this.handleForgotPassword());
      DOM.btnGoogleSignIn.addEventListener('click', () => this.handleGoogleSignIn());
      DOM.authOpenConfigBtn.addEventListener('click', () => {
        Modal.open(DOM.settingsModal);
      });

      // Sign Out buttons
      DOM.sidebarSignOutBtn.addEventListener('click', () => this.handleSignOut());
      DOM.settingsSignOutBtn.addEventListener('click', () => this.handleSignOut());

      // Firebase Config Actions
      DOM.btnSaveFirebaseConfig.addEventListener('click', () => this.saveFirebaseConfigFromUI());
      DOM.btnResetFirebaseConfig.addEventListener('click', () => this.resetFirebaseConfig());

      // Mobile Drawer Toggle
      DOM.mobileMenuBtn.addEventListener('click', () => this.openSidebar());
      DOM.closeSidebarBtn.addEventListener('click', () => this.closeSidebar());
      DOM.sidebarOverlay.addEventListener('click', () => this.closeSidebar());

      // Navigation clicks
      DOM.navAllNotes.addEventListener('click', () => this.setActiveView('all'));
      DOM.navPinned.addEventListener('click', () => this.setActiveView('pinned'));
      DOM.navFavorites.addEventListener('click', () => this.setActiveView('favorites'));
      DOM.navTrash.addEventListener('click', () => this.setActiveView('trash'));

      // Category items clicks
      DOM.categoryNavList.addEventListener('click', (e) => {
        const item = e.target.closest('.category-nav-item');
        if (item) {
          const category = item.getAttribute('data-category');
          this.setActiveCategory(category);
        }
      });

      DOM.resetCategoryFilterBtn.addEventListener('click', () => {
        state.activeCategory = null;
        this.updateNavActiveState();
        this.render();
      });

      // Theme toggle button
      DOM.themeToggleBtn.addEventListener('click', () => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        Toast.show(`Switched to ${newTheme} mode`, 'info');
      });

      // Create Note Buttons
      DOM.sidebarNewNoteBtn.addEventListener('click', () => NoteManager.openEditor());
      DOM.topbarNewNoteBtn.addEventListener('click', () => NoteManager.openEditor());
      DOM.mobileFabBtn.addEventListener('click', () => NoteManager.openEditor());

      // Real-time Search Input
      DOM.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (state.searchQuery.trim()) {
          DOM.searchClearBtn.style.display = 'block';
        } else {
          DOM.searchClearBtn.style.display = 'none';
        }
        this.render();
      });

      DOM.searchClearBtn.addEventListener('click', () => {
        DOM.searchInput.value = '';
        DOM.searchClearBtn.style.display = 'none';
        state.searchQuery = '';
        DOM.searchInput.focus();
        this.render();
      });

      // Sort Select
      DOM.sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        Storage.saveSettings();
        this.render();
      });

      // Layout Toggles (Grid / List)
      DOM.btnGridView.addEventListener('click', () => this.applyViewMode('grid'));
      DOM.btnListView.addEventListener('click', () => this.applyViewMode('list'));

      // Trash controls
      DOM.emptyTrashBtn.addEventListener('click', () => NoteManager.emptyTrash());

      // Note Editor Modal events
      DOM.closeEditorModalBtn.addEventListener('click', () => Modal.close(DOM.noteEditorModal));
      DOM.cancelEditorBtn.addEventListener('click', () => Modal.close(DOM.noteEditorModal));

      DOM.editorPinBtn.addEventListener('click', () => {
        state.editorIsPinned = !state.editorIsPinned;
        NoteManager.updateEditorToggleButtons();
      });

      DOM.editorFavoriteBtn.addEventListener('click', () => {
        state.editorIsFavorite = !state.editorIsFavorite;
        NoteManager.updateEditorToggleButtons();
      });

      // PIN Passcode Button in Editor & Pill
      DOM.editorLockBtn.addEventListener('click', () => PinManager.openSetPinModal());
      DOM.editorLockPill.addEventListener('click', () => PinManager.openSetPinModal());

      // Set PIN Modal Events
      DOM.closeSetPinModalBtn.addEventListener('click', () => Modal.close(DOM.setPinModal));
      DOM.btnCancelSetPin.addEventListener('click', () => Modal.close(DOM.setPinModal));
      DOM.btnSavePin.addEventListener('click', () => PinManager.savePin());
      DOM.btnRemovePin.addEventListener('click', () => PinManager.removePin());

      // Unlock PIN Modal Events
      DOM.closeUnlockModalBtn.addEventListener('click', () => Modal.close(DOM.pinUnlockModal));
      DOM.btnCancelUnlockPin.addEventListener('click', () => Modal.close(DOM.pinUnlockModal));
      DOM.btnSubmitUnlockPin.addEventListener('click', () => PinManager.verifyUnlock());

      // Color Palette in Editor
      DOM.colorPalettePicker.addEventListener('click', (e) => {
        const dot = e.target.closest('.color-dot');
        if (dot) {
          state.editorColor = dot.getAttribute('data-color');
          NoteManager.updateColorPickerUI();
        }
      });

      // Tag input in Editor
      DOM.tagInputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
          e.preventDefault();
          NoteManager.addEditorTag(DOM.tagInputField.value);
        } else if (e.key === 'Backspace' && !DOM.tagInputField.value && state.editorTags.length > 0) {
          NoteManager.removeEditorTag(state.editorTags.length - 1);
        }
      });

      DOM.modalTagChips.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.tag-chip-remove');
        if (removeBtn) {
          const idx = parseInt(removeBtn.getAttribute('data-index'), 10);
          NoteManager.removeEditorTag(idx);
        }
      });

      // Note Form Submit
      DOM.noteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        NoteManager.saveCurrentNote();
      });

      DOM.noteContentInput.addEventListener('input', () => NoteManager.updateEditorMetrics());

      // Preview Modal events
      DOM.closePreviewModalBtn.addEventListener('click', () => Modal.close(DOM.notePreviewModal));
      DOM.previewCloseBottomBtn.addEventListener('click', () => Modal.close(DOM.notePreviewModal));

      // Settings Modal events
      DOM.openSettingsBtn.addEventListener('click', () => {
        this.populateFirebaseConfigUI();
        Modal.open(DOM.settingsModal);
      });

      DOM.closeSettingsModalBtn.addEventListener('click', () => Modal.close(DOM.settingsModal));

      DOM.saveSettingsBtn.addEventListener('click', () => {
        Modal.close(DOM.settingsModal);
        Toast.show('Settings saved successfully!', 'success');
      });

      // Settings Theme Choices
      DOM.settingsModal.querySelectorAll('.theme-choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const choice = btn.getAttribute('data-theme-choice');
          this.applyTheme(choice);
        });
      });

      // Export Notes as JSON
      DOM.exportDataBtn.addEventListener('click', () => {
        try {
          const dataStr = JSON.stringify(state.notes, null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `noteflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          Toast.show('Notes exported successfully as JSON! 📦', 'success');
        } catch (err) {
          Toast.show('Failed to export notes.', 'danger');
        }
      });

      // Import Notes from JSON
      DOM.importDataFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            if (!Array.isArray(imported)) {
              throw new Error('Imported file is not an array of notes.');
            }

            const existingIds = new Set(state.notes.map(n => n.id));
            let addedCount = 0;

            imported.forEach(item => {
              if (item && item.title) {
                const noteObj = {
                  id: item.id || Helpers.uuid(),
                  title: String(item.title),
                  content: String(item.content || ''),
                  category: String(item.category || 'Personal'),
                  tags: Array.isArray(item.tags) ? item.tags : [],
                  color: item.color || 'default',
                  isPinned: !!item.isPinned,
                  isFavorite: !!item.isFavorite,
                  pinCode: item.pinCode ? String(item.pinCode) : null,
                  isTrash: !!item.isTrash,
                  createdAt: item.createdAt || Date.now(),
                  updatedAt: item.updatedAt || Date.now()
                };

                if (!existingIds.has(noteObj.id)) {
                  state.notes.unshift(noteObj);
                  existingIds.add(noteObj.id);
                  addedCount++;
                }
              }
            });

            Storage.saveNotes(state.notes);

            // Sync imported notes to Cloud Firestore
            if (state.currentUser) {
              FirestoreSync.batchUploadNotes(state.currentUser.uid, state.notes);
            }

            App.render();
            Toast.show(`Successfully imported ${addedCount} new notes! 🎉`, 'success');
            Modal.close(DOM.settingsModal);
          } catch (err) {
            console.error('Import error:', err);
            Toast.show('Invalid JSON format for notes import.', 'danger');
          }
          DOM.importDataFileInput.value = '';
        };
        reader.readAsText(file);
      });

      // Restore Demo Notes
      DOM.loadSampleDataBtn.addEventListener('click', () => {
        Modal.confirm({
          title: 'Restore Demo Notes?',
          message: 'This will append the original sample notes to your current list.',
          proceedText: 'Restore Demo Notes',
          isDanger: false,
          onProceed: () => {
            const existingIds = new Set(state.notes.map(n => n.id));
            DEFAULT_SAMPLE_NOTES.forEach(sample => {
              if (!existingIds.has(sample.id)) {
                state.notes.unshift({ ...sample, createdAt: Date.now(), updatedAt: Date.now() });
              }
            });
            Storage.saveNotes(state.notes);

            // Sync demo notes to Cloud Firestore
            if (state.currentUser) {
              FirestoreSync.batchUploadNotes(state.currentUser.uid, state.notes);
            }

            App.render();
            Toast.show('Demo notes restored! 🚀', 'success');
            Modal.close(DOM.settingsModal);
          }
        });
      });

      // Settings Empty Trash
      DOM.settingsEmptyTrashBtn.addEventListener('click', () => {
        NoteManager.emptyTrash();
      });

      // Reset All Data
      DOM.resetAllDataBtn.addEventListener('click', () => {
        Modal.confirm({
          title: 'Reset All Data?',
          message: 'WARNING: This will permanently wipe all notes, custom settings, and preferences from LocalStorage and Cloud.',
          proceedText: 'Wipe Everything',
          isDanger: true,
          onProceed: async () => {
            if (state.currentUser) {
              const allIds = state.notes.map(n => n.id);
              await FirestoreSync.emptyTrashBatch(state.currentUser.uid, allIds);
            }
            localStorage.clear();
            state.notes = [];
            state.activeView = 'all';
            state.activeCategory = null;
            state.searchQuery = '';
            state.userName = 'Sandy';
            Storage.saveSettings();
            App.updateUserProfileUI();
            App.render();
            Modal.close(DOM.settingsModal);
            Toast.show('All data has been reset.', 'danger');
          }
        });
      });

      // Cloud Firestore Sync Triggers
      if (DOM.btnSyncNow) {
        DOM.btnSyncNow.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!state.currentUser) {
            Toast.show('Please sign in to sync notes.', 'warning');
            return;
          }
          const res = await FirestoreSync.forceSync(state.currentUser.uid);
          if (res.success) {
            state.notes = res.notes;
            Storage.saveNotes(state.notes);
            App.render();
            Toast.show('Notes refreshed from Cloud Firestore! ☁️', 'success');
          } else {
            Toast.show(res.message || 'Sync failed. Please check internet connection.', 'warning');
          }
        });
      }

      if (DOM.syncStatusIndicator) {
        DOM.syncStatusIndicator.addEventListener('click', async () => {
          if (!state.currentUser) return;
          const res = await FirestoreSync.forceSync(state.currentUser.uid);
          if (res.success) {
            state.notes = res.notes;
            Storage.saveNotes(state.notes);
            App.render();
            Toast.show('Notes refreshed from Cloud Firestore! ☁️', 'success');
          }
        });
      }

      if (DOM.btnSettingsForceSync) {
        DOM.btnSettingsForceSync.addEventListener('click', async () => {
          if (!state.currentUser) {
            Toast.show('Please sign in to sync notes.', 'warning');
            return;
          }
          const res = await FirestoreSync.forceSync(state.currentUser.uid);
          if (res.success) {
            state.notes = res.notes;
            Storage.saveNotes(state.notes);
            App.render();
            Toast.show('Cloud Firestore synchronization complete! ☁️', 'success');
          } else {
            Toast.show(res.message || 'Sync failed.', 'warning');
          }
        });
      }

      // Confirmation Modal Action Buttons
      DOM.confirmProceedBtn.addEventListener('click', () => {
        if (typeof state.confirmCallback === 'function') {
          state.confirmCallback();
          state.confirmCallback = null;
        }
        Modal.close(DOM.confirmModal);
      });

      DOM.confirmCancelBtn.addEventListener('click', () => {
        state.confirmCallback = null;
        Modal.close(DOM.confirmModal);
      });

      // Global Keyboard Shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const openModals = document.querySelectorAll('.modal-backdrop.open');
          if (openModals.length > 0) {
            openModals.forEach(m => Modal.close(m));
          } else if (DOM.sidebar.classList.contains('open')) {
            App.closeSidebar();
          } else if (document.activeElement === DOM.searchInput) {
            DOM.searchInput.blur();
          }
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          if (DOM.noteEditorModal.classList.contains('open')) {
            e.preventDefault();
            NoteManager.saveCurrentNote();
            return;
          }
        }

        const activeTag = (document.activeElement.tagName || '').toLowerCase();
        const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

        if (!isTyping) {
          if (e.key === '/') {
            e.preventDefault();
            DOM.searchInput.focus();
            return;
          }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          DOM.searchInput.focus();
          DOM.searchInput.select();
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
          e.preventDefault();
          NoteManager.openEditor();
          return;
        }
      });
    }
  };

  // Bootstrap NoteFlow Application on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

})();
