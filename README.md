# NoteFlow — Modern Notes & Productivity App

A modern, fast, and feature-complete Notes Management Web Application built with pure **HTML5**, **CSS3**, and **Vanilla JavaScript**, integrated with **Google Firebase Authentication**.

---

## ✨ Features

- **Google & Email/Password Authentication**: Sign in with **Google**, or create an account with your **Gmail/Email & Password** with integrated password reset support.
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
- **Firebase Project Config Manager**: In-app credentials panel to easily connect your own Firebase project.
- **Data Portability**: Full JSON export and import capabilities for local backup and restore.
- **Keyboard Shortcuts**:
  - `Ctrl + N` / `Cmd + N`: Open New Note Editor
  - `Ctrl + K` / `/`: Focus Global Search Bar
  - `Ctrl + Enter` / `Cmd + Enter`: Save Note in Editor
  - `Escape`: Close Open Modals / Clear Search Focus
- **Fully Responsive**: Mobile navigation drawer, floating action button (FAB), touch-friendly targets, and mobile-optimized modal sheets.

---

## 🔑 Firebase & Google Sign-In Setup

To connect your **Firebase Google Authentication**:

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Build > Authentication > Sign-in method** and enable **Google**.
3. Under **Authentication > Settings > Authorized domains**, ensure `localhost` (or your deployment domain) is listed.
4. Go to **Project Settings > General > Your apps**, select **Web App (`</>`)**, and copy your Firebase config object.
5. In NoteFlow:
   - Click **Settings (gear icon)** or the **Configure Firebase Credentials** link on the login screen.
   - Enter your `API Key`, `Auth Domain`, `Project ID`, and `App ID`.
   - Click **Update Firebase Config**.

---

## 📁 Project Structure

```
NoteFlow/
│
├── index.html          # Semantic HTML5 dashboard layout, Login view, dialog modals
├── style.css           # CSS design system, dark/light themes, login styling, animations
├── firebase-config.js  # Firebase v10 SDK integration, Google provider, auth helpers
├── app.js              # Vanilla JS application controller, state management, LocalStorage sync
└── README.md           # Documentation and setup guide
```

---

## 🚀 Getting Started

Simply open `index.html` in any modern web browser or serve with a local web server:

```bash
# Using Python 3
python -m http.server 5173

# Or using npx serve
npx serve .
```

Visit `http://localhost:5173` in your browser.
