// In preload.js
const { contextBridge, ipcRenderer } = require('electron');

// --- Local Shortcut Handling ---
let localShortcuts = {};

// Function to convert a keyboard event to an Electron Accelerator string
function eventToShortcutString(e) {
    const parts = [];
    // Start with modifiers
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    // Note: metaKey is the Command key on macOS and the Windows key on Windows.
if (e.metaKey) parts.push(process.platform === 'darwin' ? 'Command' : 'Super');

    // Add the base key, avoiding double-counting modifiers
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
let keyCode = e.code.replace('Key', '').replace('Digit', '');
if (keyCode.length === 1) keyCode = keyCode.toUpperCase();
parts.push(keyCode);

    }
    
    return parts.join('+');
}

// Listen for keydown events at the window level
window.addEventListener('keydown', (e) => {
    // If there are no local shortcuts registered, do nothing
    if (Object.keys(localShortcuts).length === 0) return;

    const shortcutString = eventToShortcutString(e);
    
    // Check if the pressed combination matches a known local shortcut
    for (const action in localShortcuts) {
        if (localShortcuts[action] === shortcutString) {
            e.preventDefault(); // Prevent the browser from handling the event
            ipcRenderer.send('execute-shortcut', action);
            return;
        }
    }
}, true);

// Listen for the main process to send the list of local shortcuts
ipcRenderer.on('set-local-shortcuts', (event, shortcuts) => {
    console.log('Received local shortcuts:', shortcuts);
    localShortcuts = shortcuts || {}; // Ensure it's always an object
});


contextBridge.exposeInMainWorld('electronAPI', {
  theme: {
    getResolved: () => ipcRenderer.invoke('theme:get-resolved'),
    getSetting: () => ipcRenderer.invoke('theme:get-setting'),
    set: (theme) => ipcRenderer.send('theme:set', theme),
    onUpdate: (callback) => ipcRenderer.on('theme-updated', (_event, theme) => callback(theme)),
  },
  toggleFullScreen: () => ipcRenderer.send('toggle-full-screen'), // <--- הוסף שורה זו
  completeOnboarding: () => ipcRenderer.send('onboarding-complete'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (key, value) => ipcRenderer.send('update-setting', key, value),
  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
  openNewWindow: () => ipcRenderer.send('open-new-window'),
  resetSettings: () => ipcRenderer.send('reset-settings'),
  showConfirmReset: () => ipcRenderer.send('show-confirm-reset'),
  confirmReset: () => ipcRenderer.send('confirm-reset-action'),
  cancelReset: () => ipcRenderer.send('cancel-reset-action'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
    manualCheckForNotifications: () => ipcRenderer.send('manual-check-for-notifications'),
  onNotificationCheckStatus: (callback) =>
    ipcRenderer.on('notification-check-status', (_event, result) => callback(result)),
  sendLoginAttempt: (data) => ipcRenderer.send('login-attempt', data),

  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, ...args) => callback(...args)),
  onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', (event, ...args) => callback(...args)),
  notifyCanvasState: (isCanvasVisible) => ipcRenderer.send('canvas-state-changed', isCanvasVisible),
  openDownloadPage: () => ipcRenderer.send('open-download-page'),
  startDownloadUpdate: () => ipcRenderer.send('start-download-update'),
  installUpdateNow: () => ipcRenderer.send('install-update-now'),
  closeDownloadWindow: () => ipcRenderer.send('close-download-window'),
  closeUpdateWindow: () => ipcRenderer.send('close-update-window')
});

// A. Added code to read the chat title
contextBridge.exposeInMainWorld('chatAPI', {
  onTitleUpdate: (callback) => ipcRenderer.on('update-title', (event, ...args) => callback(...args)),
});
contextBridge.exposeInMainWorld('updateAPI', {
    onUpdateInfo: (callback) => ipcRenderer.on('update-info', (_event, value) => callback(value)),
});
let lastTitle = '';
setInterval(() => {
    // Checks the title from the DOM of the Gemini page
    const titleElement = document.querySelector('.conversation.selected .conversation-title');
    let currentTitle = 'New Chat'; // Default value if there is no open chat or title
    if (titleElement) {
        currentTitle = titleElement.textContent.trim();
    }
    
    if (currentTitle !== lastTitle) {
        lastTitle = currentTitle;
        ipcRenderer.send('update-title', currentTitle);
    }
}, 1000); // Checks every second

// --- קוד מאוחד לניהול אוטומטי של הממשק ---
// --- לוגיקה עבור שינוי גודל החלון (Canvas) ---
let isImmersivePanelCurrentlyVisible = false;

function checkForPanelAndNotify() {
    const panelExists = document.querySelector('immersive-panel') !== null;
    if (panelExists !== isImmersivePanelCurrentlyVisible) {
        console.log(`Canvas panel state changed. Now visible: ${panelExists}`);
        isImmersivePanelCurrentlyVisible = panelExists;
        ipcRenderer.send('canvas-state-changed', isImmersivePanelCurrentlyVisible);
    }
}

// --- הגדרת ה-MutationObserver ---
const observer = new MutationObserver(() => {
    // הרץ את פונקציית הבדיקה בכל שינוי בדף
    checkForPanelAndNotify();
});

// התחלת המעקב אחרי שהדף נטען
window.addEventListener('load', () => {
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    // בצע בדיקה ראשונית אחת מיד עם טעינת הדף
    checkForPanelAndNotify();
});
// In preload.js, add this at the end

contextBridge.exposeInMainWorld('notificationAPI', {
    closeWindow: () => ipcRenderer.send('close-notification-window'),
    requestLastNotification: () => ipcRenderer.send('request-last-notification'),      // ← ADD THIS
    onReceiveNotification: (callback) => ipcRenderer.on('notification-data', (event, ...args) => callback(...args)),
});
