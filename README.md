# NoteFlow — Modern Notes & Productivity App

A modern, fast, and feature-complete Notes Management Web Application built with pure **HTML5**, **CSS3**, and **Vanilla JavaScript**, integrated with **Google Firebase Authentication** and **Cloud Firestore Real-Time Sync**.

---

## ✨ Features

- **Google & Email/Password Authentication**: Sign in with **Google**, or create an account with your **Gmail/Email & Password** with integrated password reset support.
- **Cloud Firestore Real-Time Sync**: Instant multi-device synchronization using Firebase Firestore `onSnapshot` listeners with deterministic note IDs.
- **Offline-First & Local Storage Caching**: Keep working seamlessly offline. Changes are saved to IndexedDB/LocalStorage and automatically synchronized when reconnected.
- **Live Sync Status Indicator**: Visual indicator in the topbar and settings (`☁️ Synced`, `🔄 Syncing...`, `📴 Offline`, `⚠️ Sync Error`) with a **"Sync Now"** manual refresh button.
- **Strict Multi-Tenant Security**: User data is completely isolated under `/users/{userId}/notes/{noteId}` protected by production-ready `firestore.rules`.
- **4-Digit PIN Passcode Protection**: Secure sensitive individual notes with a custom 4-digit PIN lock. Locked notes mask their preview and require the passcode to view or edit.
- **Sleek SaaS Aesthetics**: Refined typography (*Plus Jakarta Sans*), subtle glassmorphism (`backdrop-filter: blur`), smooth micro-animations, and card hover lifts.
- **Dark & Light Modes**: Instant theme toggle with full color token support and persistent storage.
- **Dynamic Greetings & Stats**: Time-of-day greeting (morning, afternoon, evening) with user's Google display name / avatar photo and live counters for Total Notes, Pinned, Favorites, and Trash.
- **Full CRUD Workflow**: Create, read, edit, delete, pin, favorite, and restore notes effortlessly.
- **Color Accents**: Assign customizable color tags/accents (Default, Purple, Blue, Emerald, Amber, Rose) to visually categorize cards.
- **Interactive Tagging**: Chip-based tag input in the modal editor (type and press `Enter` or `,`).
- **Real-Time Search & Filters**: Instant multi-field search across titles, content, categories, and tags with debounced rendering.
- **Trash & Restore Lifecycle**: Safe deletion pattern (moves to Trash with instant Undo toast, plus permanent deletion and empty trash confirmation modals).
- **Grid & List Layout Views**: Seamless toggle between responsive card grid and compact list view.
- **Data Portability**: Full JSON export and import capabilities for local backup and restore.
- **Keyboard Shortcuts**:
  - `Ctrl + N` / `Cmd + N`: Open New Note Editor
  - `Ctrl + K` / `/`: Focus Global Search Bar
  - `Ctrl + Enter` / `Cmd + Enter`: Save Note in Editor
  - `Escape`: Close Open Modals / Clear Search Focus
- **Fully Responsive**: Mobile navigation drawer, floating action button (FAB), touch-friendly targets, and mobile-optimized modal sheets.

---

## 🗄️ Firestore Database Schema

Notes are stored under each user's authenticated UID document:

```text
users (collection)
  └── {userId} (document)
       └── notes (collection)
            └── {noteId} (document)
                 ├── id: string (deterministic unique note ID)
                 ├── title: string
                 ├── content: string
                 ├── category: string ('Personal', 'Work', 'Study', 'Project', 'Ideas', 'Other')
                 ├── tags: array of strings
                 ├── color: string ('purple', 'rose', 'amber', 'blue', 'emerald', 'default')
                 ├── isPinned: boolean
                 ├── isFavorite: boolean
                 ├── isLocked: boolean
                 ├── pinCode: string | null
                 ├── isTrash: boolean
                 ├── createdAt: number (epoch ms timestamp)
                 ├── updatedAt: number (epoch ms timestamp)
                 └── deletedAt: number | null
```

---

## 🔒 Firestore Security Rules (`firestore.rules`)

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Deny access to arbitrary collections
    match /{document=**} {
      allow read, write: if false;
    }

    // User-specific notes collection: /users/{userId}/notes/{noteId}
    match /users/{userId}/notes/{noteId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🔑 Firebase & Firestore Setup

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Build > Authentication > Sign-in method** and enable **Google** and **Email/Password**.
3. Under **Authentication > Settings > Authorized domains**, ensure `localhost` (or your deployment domain) is listed.
4. Navigate to **Build > Firestore Database** and click **Create database**.
5. Copy the contents of `firestore.rules` to the **Firestore Database > Rules** tab and click **Publish**.
6. Go to **Project Settings > General > Your apps**, select **Web App (`</>`)**, and copy your Firebase config object.
7. In NoteFlow:
   - Click **Settings (gear icon)** or the **Configure Firebase Credentials** link on the login screen.
   - Enter your `API Key`, `Auth Domain`, `Project ID`, and `App ID`.
   - Click **Update Firebase Config**.

---

## 📁 Project Structure

```
NoteFlow/
│
├── index.html          # Semantic HTML5 dashboard layout, Login view, sync indicators, modals
├── style.css           # CSS design system, dark/light themes, sync status badges, animations
├── firebase-config.js  # Firebase v10 SDK integration, Auth & Firestore initialization
├── firestore.js        # Real-time Cloud Sync module, onSnapshot listener, offline queueing
├── firestore.rules     # Cloud Firestore multi-tenant security rules
├── app.js              # Vanilla JS application controller, state management, UI events
└── README.md           # Documentation and setup guide
```

---

## 🚀 Getting Started

Simply open `index.html` in any modern web browser or serve with a local web server:

```bash
# Using Python 3
python -m http.server 5500

# Or using npx serve
npx serve -l 5500 .
```

Visit `http://localhost:5500` in your browser.
