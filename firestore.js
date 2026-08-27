/**
 * NoteFlow - Cloud Firestore Real-Time Synchronization Module
 * Handles:
 * - Real-time onSnapshot listeners per user: /users/{userId}/notes/{noteId}
 * - Offline detection, queueing, and IndexedDB multi-tab caching
 * - CRUD operations: Create, Update, Soft-Delete (Trash), Restore, Permanent Delete, Empty Trash
 * - Deterministic note ID mapping to avoid duplicates
 * - Sync connection state management (Synced, Syncing, Offline, Error)
 */

import { getFirestoreInstance } from './firebase-config.js';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Connection & Sync States
export const SYNC_STATUS = {
  SYNCED: 'synced',     // ☁️ Synced
  SYNCING: 'syncing',   // 🔄 Syncing...
  OFFLINE: 'offline',   // 📴 Offline
  ERROR: 'error'        // ⚠️ Sync Error
};

class FirestoreSyncService {
  constructor() {
    this.activeUserId = null;
    this.unsubscribeSnapshot = null;
    this.currentStatus = navigator.onLine ? SYNC_STATUS.SYNCED : SYNC_STATUS.OFFLINE;
    this.statusListeners = new Set();
    this.pendingSyncCount = 0;
    this.isInitialLoadDone = false;

    // Listen for browser online/offline network transitions
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  /**
   * Subscribe a callback to receive sync status updates
   * @param {Function} callback (status, message) => void
   * @returns {Function} unsubscribe function
   */
  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.statusListeners.add(callback);
      // Immediately notify current status
      callback(this.currentStatus);
      return () => this.statusListeners.delete(callback);
    }
    return () => {};
  }

  /**
   * Set and broadcast current sync status
   * @param {string} status SYNC_STATUS
   * @param {string} [customMessage]
   */
  setStatus(status, customMessage = '') {
    this.currentStatus = status;
    this.statusListeners.forEach((cb) => {
      try {
        cb(status, customMessage);
      } catch (e) {
        console.warn('Sync status callback error:', e);
      }
    });
  }

  /**
   * Handle network status transitions
   */
  handleNetworkChange(isOnline) {
    if (!isOnline) {
      this.setStatus(SYNC_STATUS.OFFLINE, 'No internet connection. Changes saved locally.');
    } else {
      if (this.pendingSyncCount > 0) {
        this.setStatus(SYNC_STATUS.SYNCING, 'Reconnected. Syncing pending changes...');
      } else {
        this.setStatus(SYNC_STATUS.SYNCED, 'Connected & Synced with Cloud');
      }
    }
  }

  /**
   * Sanitize and format note payload to match Firestore schema
   * @param {Object} note
   * @returns {Object} cleaned Firestore document object
   */
  formatNoteForFirestore(note) {
    const now = Date.now();
    const isTrash = Boolean(note.isTrash || note.deletedAt != null);

    return {
      id: String(note.id || 'note_' + now),
      title: String(note.title || 'Untitled Note'),
      content: String(note.content || ''),
      category: String(note.category || 'Personal'),
      tags: Array.isArray(note.tags) ? note.tags.map(t => String(t).trim().toLowerCase()) : [],
      color: String(note.color || 'default'),
      isPinned: Boolean(note.isPinned),
      isFavorite: Boolean(note.isFavorite),
      isLocked: Boolean(note.isLocked || note.pinCode),
      pinCode: note.pinCode ? String(note.pinCode) : null,
      isTrash: isTrash,
      createdAt: typeof note.createdAt === 'number' ? note.createdAt : now,
      updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : now,
      deletedAt: isTrash ? (typeof note.deletedAt === 'number' ? note.deletedAt : now) : null
    };
  }

  /**
   * Normalize document received from Firestore snapshot
   * @param {Object} docData 
   * @param {string} docId 
   * @returns {Object} NoteFlow standard note object
   */
  parseFirestoreNote(docData, docId) {
    const id = docData.id || docId;
    
    // Parse timestamps (handle Firestore Timestamp objects or numeric epoch)
    const parseTime = (val, fallback) => {
      if (!val) return fallback;
      if (typeof val === 'number') return val;
      if (val && typeof val.toMillis === 'function') return val.toMillis();
      if (val && typeof val.toDate === 'function') return val.toDate().getTime();
      return fallback;
    };

    const createdAt = parseTime(docData.createdAt, Date.now());
    const updatedAt = parseTime(docData.updatedAt, createdAt);
    const isTrash = Boolean(docData.isTrash || docData.deletedAt != null);
    const deletedAt = isTrash ? parseTime(docData.deletedAt, updatedAt) : null;

    return {
      id: id,
      title: docData.title || '',
      content: docData.content || '',
      category: docData.category || 'Personal',
      tags: Array.isArray(docData.tags) ? docData.tags : [],
      color: docData.color || 'default',
      isPinned: Boolean(docData.isPinned),
      isFavorite: Boolean(docData.isFavorite),
      isLocked: Boolean(docData.isLocked || docData.pinCode),
      pinCode: docData.pinCode || null,
      isTrash: isTrash,
      createdAt: createdAt,
      updatedAt: updatedAt,
      deletedAt: deletedAt
    };
  }

  /**
   * Start real-time Firestore synchronization for an authenticated user
   * @param {string} userId Firebase Auth User UID
   * @param {Object} callbacks
   * @param {Function} callbacks.onNotesReceived (notes: Array, isInitial: Boolean) => void
   * @param {Function} [callbacks.onError] (error: Error) => void
   */
  startSync(userId, { onNotesReceived, onError } = {}) {
    if (!userId) {
      console.warn('startSync called without valid userId');
      return;
    }

    // Stop existing listener if user changed
    if (this.activeUserId && this.activeUserId !== userId) {
      this.stopSync();
    }

    this.activeUserId = userId;
    this.isInitialLoadDone = false;

    const db = getFirestoreInstance();
    if (!db) {
      console.error('Firestore not available for sync');
      this.setStatus(SYNC_STATUS.ERROR, 'Database initialization failed.');
      return;
    }

    if (!navigator.onLine) {
      this.setStatus(SYNC_STATUS.OFFLINE, 'Offline mode. Changes will sync when reconnected.');
    } else {
      this.setStatus(SYNC_STATUS.SYNCING, 'Connecting to Cloud Firestore...');
    }

    try {
      const notesColRef = collection(db, 'users', userId, 'notes');
      const notesQuery = query(notesColRef);

      this.unsubscribeSnapshot = onSnapshot(
        notesQuery,
        (snapshot) => {
          const notes = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
              notes.push(this.parseFirestoreNote(docSnap.data(), docSnap.id));
            }
          });

          // Sort by updatedAt descending
          notes.sort((a, b) => b.updatedAt - a.updatedAt);

          const hasPendingWrites = snapshot.metadata.hasPendingWrites;
          const fromCache = snapshot.metadata.fromCache;

          if (!navigator.onLine) {
            this.setStatus(SYNC_STATUS.OFFLINE, 'Working offline. Local cache active.');
          } else if (hasPendingWrites) {
            this.setStatus(SYNC_STATUS.SYNCING, 'Syncing changes to cloud...');
          } else {
            this.setStatus(SYNC_STATUS.SYNCED, 'All notes synced to cloud');
          }

          const isInitial = !this.isInitialLoadDone;
          this.isInitialLoadDone = true;

          if (typeof onNotesReceived === 'function') {
            onNotesReceived(notes, isInitial, fromCache);
          }
        },
        (error) => {
          console.error('Firestore onSnapshot listener error:', error);
          if (error.code === 'permission-denied') {
            this.setStatus(SYNC_STATUS.ERROR, 'Permission denied. Please verify your Firestore rules.');
          } else if (error.code === 'unavailable') {
            this.setStatus(SYNC_STATUS.OFFLINE, 'Firestore server unavailable. Working from local cache.');
          } else {
            this.setStatus(SYNC_STATUS.ERROR, error.message || 'Sync error occurred.');
          }

          if (typeof onError === 'function') {
            onError(error);
          }
        }
      );
    } catch (err) {
      console.error('Failed to attach Firestore snapshot listener:', err);
      this.setStatus(SYNC_STATUS.ERROR, 'Failed to connect to Firestore.');
    }
  }

  /**
   * Stop real-time listener and reset state
   */
  stopSync() {
    if (typeof this.unsubscribeSnapshot === 'function') {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
    this.activeUserId = null;
    this.isInitialLoadDone = false;
    this.pendingSyncCount = 0;
    this.setStatus(navigator.onLine ? SYNC_STATUS.SYNCED : SYNC_STATUS.OFFLINE);
  }

  /**
   * Create or update a note in Cloud Firestore
   * @param {string} userId 
   * @param {Object} note 
   */
  async saveNote(userId, note) {
    if (!userId || !note || !note.id) return { success: false, error: 'Missing parameters' };

    const db = getFirestoreInstance();
    if (!db) return { success: false, error: 'Firestore not initialized' };

    const payload = this.formatNoteForFirestore(note);
    const noteDocRef = doc(db, 'users', userId, 'notes', payload.id);

    this.pendingSyncCount++;
    if (navigator.onLine) {
      this.setStatus(SYNC_STATUS.SYNCING, 'Saving note to cloud...');
    }

    try {
      await setDoc(noteDocRef, payload, { merge: true });
      this.pendingSyncCount = Math.max(0, this.pendingSyncCount - 1);
      if (navigator.onLine && this.pendingSyncCount === 0) {
        this.setStatus(SYNC_STATUS.SYNCED, 'Note synced');
      }
      return { success: true, id: payload.id };
    } catch (error) {
      console.error(`Error saving note ${note.id} to Firestore:`, error);
      this.pendingSyncCount = Math.max(0, this.pendingSyncCount - 1);
      if (navigator.onLine) {
        this.setStatus(SYNC_STATUS.ERROR, 'Error saving note to cloud.');
      }
      return { success: false, error };
    }
  }

  /**
   * Permanently delete a note from Cloud Firestore
   * @param {string} userId 
   * @param {string} noteId 
   */
  async deleteNote(userId, noteId) {
    if (!userId || !noteId) return { success: false, error: 'Missing parameters' };

    const db = getFirestoreInstance();
    if (!db) return { success: false, error: 'Firestore not initialized' };

    const noteDocRef = doc(db, 'users', userId, 'notes', String(noteId));

    this.pendingSyncCount++;
    if (navigator.onLine) {
      this.setStatus(SYNC_STATUS.SYNCING, 'Deleting note from cloud...');
    }

    try {
      await deleteDoc(noteDocRef);
      this.pendingSyncCount = Math.max(0, this.pendingSyncCount - 1);
      if (navigator.onLine && this.pendingSyncCount === 0) {
        this.setStatus(SYNC_STATUS.SYNCED, 'Note deleted from cloud');
      }
      return { success: true };
    } catch (error) {
      console.error(`Error deleting note ${noteId} from Firestore:`, error);
      this.pendingSyncCount = Math.max(0, this.pendingSyncCount - 1);
      if (navigator.onLine) {
        this.setStatus(SYNC_STATUS.ERROR, 'Error deleting note from cloud.');
      }
      return { success: false, error };
    }
  }

  /**
   * Permanently delete multiple notes (e.g. Empty Trash) in batch
   * @param {string} userId 
   * @param {Array<string>} noteIds 
   */
  async emptyTrashBatch(userId, noteIds) {
    if (!userId || !Array.isArray(noteIds) || noteIds.length === 0) {
      return { success: true, count: 0 };
    }

    const db = getFirestoreInstance();
    if (!db) return { success: false, error: 'Firestore not initialized' };

    this.pendingSyncCount++;
    if (navigator.onLine) {
      this.setStatus(SYNC_STATUS.SYNCING, `Emptying trash (${noteIds.length} notes)...`);
    }

    try {
      // Process in chunks of 450 (Firestore limit is 500 ops per batch)
      const chunkSize = 450;
      for (let i = 0; i < noteIds.length; i += chunkSize) {
        const chunk = noteIds.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((noteId) => {
          const docRef = doc(db, 'users', userId, 'notes', String(noteId));
          batch.delete(docRef);
        });

        await batch.commit();
      }

      this.pendingSyncCount = Math.max(0, this.pendingSyncCount - 1);
      if (navigator.onLine && this.pendingSyncCount === 0) {
        this.setStatus(SYNC_STATUS.SYNCED, 'Trash emptied from cloud');
      }
      return { success: true, count: noteIds.length };
    } catch (error) {
      console.error('Error emptying trash in Firestore:', error);
      this.pendingSyncCount = Math.max(0, this.pendingSyncCount - 1);
      if (navigator.onLine) {
        this.setStatus(SYNC_STATUS.ERROR, 'Failed to empty trash in cloud.');
      }
      return { success: false, error };
    }
  }

  /**
   * Batch upload multiple notes (e.g. Initial Local Migration or JSON Import)
   * @param {string} userId 
   * @param {Array<Object>} notes 
   */
  async batchUploadNotes(userId, notes) {
    if (!userId || !Array.isArray(notes) || notes.length === 0) {
      return { success: true, count: 0 };
    }

    const db = getFirestoreInstance();
    if (!db) return { success: false, error: 'Firestore not initialized' };

    this.pendingSyncCount++;
    if (navigator.onLine) {
      this.setStatus(SYNC_STATUS.SYNCING, `Syncing ${notes.length} notes to cloud...`);
    }

    try {
      const chunkSize = 450;
      for (let i = 0; i < notes.length; i += chunkSize) {
        const chunk = notes.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((note) => {
          const payload = this.formatNoteForFirestore(note);
          const docRef = doc(db, 'users', userId, 'notes', payload.id);
          batch.set(docRef, payload, { merge: true });
        });

        await batch.commit();
      }

      this.pendingSyncCount = Math.max(0, this.pendingSyncCount - 1);
      if (navigator.onLine && this.pendingSyncCount === 0) {
        this.setStatus(SYNC_STATUS.SYNCED, `All ${notes.length} notes synced to cloud`);
      }
      return { success: true, count: notes.length };
    } catch (error) {
      console.error('Error batch uploading notes to Firestore:', error);
      this.pendingSyncCount = Math.max(0, this.pendingSyncCount - 1);
      if (navigator.onLine) {
        this.setStatus(SYNC_STATUS.ERROR, 'Batch upload failed.');
      }
      return { success: false, error };
    }
  }

  /**
   * Force manual sync and fetch from server
   * @param {string} userId 
   */
  async forceSync(userId) {
    if (!userId) return { success: false, error: 'No user ID' };
    if (!navigator.onLine) {
      this.setStatus(SYNC_STATUS.OFFLINE, 'Cannot force sync while offline.');
      return { success: false, message: 'Offline' };
    }

    const db = getFirestoreInstance();
    if (!db) return { success: false, error: 'Firestore not ready' };

    this.setStatus(SYNC_STATUS.SYNCING, 'Refreshing notes from cloud...');

    try {
      const notesCol = collection(db, 'users', userId, 'notes');
      const snapshot = await getDocs(notesCol);
      const notes = [];

      snapshot.forEach((docSnap) => {
        if (docSnap.exists()) {
          notes.push(this.parseFirestoreNote(docSnap.data(), docSnap.id));
        }
      });

      notes.sort((a, b) => b.updatedAt - a.updatedAt);
      this.setStatus(SYNC_STATUS.SYNCED, `Synced ${notes.length} notes`);
      return { success: true, notes };
    } catch (error) {
      console.error('Force sync error:', error);
      this.setStatus(SYNC_STATUS.ERROR, 'Sync refresh failed.');
      return { success: false, error };
    }
  }
}

// Export singleton instance
export const FirestoreSync = new FirestoreSyncService();
