// ******************************************************************
// ⚠️ כתובת זו חייבת להיות ה-URL הציבורי של Render (כולל https://)
// ******************************************************************
const PROXY_SERVER_URL = 'https://search-record.onrender.com'; 
// ******************************************************************

/**
 * פונקציית עזר: שולחת בקשת אימות לבדיקת תקפות פרטי המשתמש מול השרת
 */
const sendAuthRequest = async (username, password) => {
    
    // **תיקון קריטי: קידוד פרטי הכניסה (במיוחד לעברית)**
    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);
    
    // שולח בקשת חיפוש 'ריקה' (עם נתונים בסיסיים) רק כדי לאכוף את האימות בשרת
    const testUrl = `${PROXY_SERVER_URL}/search?user=${encodedUser}&pass=${encodedPass}&station=kcm&date=2024-01-01`;

    try {
        const response = await fetch(testUrl);
        // מחזיר true אם 200 (נמצא) או 404 (לא נמצא - אבל האימות עבר)
        // מחזיר false אם 401 (אין הרשאה)
        return response.ok || response.status === 404; 
    } catch (error) {
        console.error("Authentication check failed due to network error:", error);
        return false; // שגיאת רשת נחשבת ככישלון אימות
    }
};


/**
 * קוד ראשי שרץ כשהדף נטען
 */
document.addEventListener('DOMContentLoaded', async () => {
    const loginContainer = document.getElementById('login-container');
    const mainContent = document.getElementById('main-content');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');
    const searchForm = document.getElementById('search-form'); 
    const resultsList = document.getElementById('results-list');
    const loadingDiv = document.getElementById('loading');
    
    // ----------------------------------------------------
    // 1. לוגיקת טעינה ובדיקת סשן
    // ----------------------------------------------------
    const checkSession = async () => {
        const storedUser = sessionStorage.getItem('radioUser');
        const storedPass = sessionStorage.getItem('radioPass');

        if (storedUser && storedPass) {
             // בדיקה חוזרת מול השרת לוודא שהפרטים עדיין תקפים
            if (await sendAuthRequest(storedUser, storedPass)) {
                loginContainer.classList.add('hidden');
                mainContent.classList.remove('hidden');
                return true;
            } else {
                // אם הפרטים השמורים שגויים, נקה אותם
                sessionStorage.clear();
            }
        }
        loginContainer.classList.remove('hidden'); // הצגת טופס הכניסה
        return false;
    };
    
    // הפעלת בדיקת הסשן בעת טעינת הדף
    await checkSession();


    // ----------------------------------------------------
    // 2. מטפל בלחיצה על כפתור הכניסה
    // ----------------------------------------------------
    loginBtn.addEventListener('click', async () => {
        const user = document.getElementById('initial-username').value;
        const pass = document.getElementById('initial-password').value;
        
        loginMessage.textContent = '';
        loginBtn.disabled = true; // מונע קליקים כפולים

        if (await sendAuthRequest(user, pass)) {
            // שמירת הפרטים בזיכרון הדפדפן (Session Storage)
            sessionStorage.setItem('radioUser', user);
            sessionStorage.setItem('radioPass', pass);

            // הצגת התוכן הראשי והסתרת הכניסה
            loginContainer.classList.add('hidden');
            mainContent.classList.remove('hidden');
        } else {
            loginMessage.textContent = 'שם משתמש או סיסמה שגויים.';
            loginBtn.disabled = false; // מאפשר ניסיון חוזר
        }
    });

    // ----------------------------------------------------
    // 3. לוגיקת חיפוש (לאחר שהמשתמש מחובר)
    // ----------------------------------------------------
    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault(); 
        
        // קבלת פרמטרי האימות מזיכרון הדפדפן (Session Storage)
        const username = sessionStorage.getItem('radioUser');
        const password = sessionStorage.getItem('radioPass');
        
        // **תיקון קריטי: קידוד פרטי הכניסה (במיוחד לעברית)**
        const encodedUser = encodeURIComponent(username);
        const encodedPass = encodeURIComponent(password);

        const station = document.getElementById('station').value;
        const date = document.getElementById('date').value;
        const hour = document.getElementById('hour').value;
        
        if (!date || !username || !password) {
             // אם מאיזושהי סיבה חסרים נתונים, שולח חזרה לטופס הכניסה
            sessionStorage.clear();
            location.reload(); 
            return;
        }

        resultsList.innerHTML = '';
        loadingDiv.style.display = 'block';

        // בניית ה-URL: שימוש בערכים המקודדים
        let searchUrl = `${PROXY_SERVER_URL}/search?user=${encodedUser}&pass=${encodedPass}&station=${station}&date=${date}`;
        
        if (hour !== '') {
            searchUrl += `&hour=${hour}`;
        }

        try {
            const response = await fetch(searchUrl);
            
            if (!response.ok) {
                // טיפול בשגיאת אימות (401) או אחרת
                if (response.status === 401) {
                     // אם האימות נכשל במהלך חיפוש, מפנה לכניסה מחדש
                    sessionStorage.clear();
                    location.reload();
                    return;
                }
                const errorData = await response.json().catch(() => ({ error: 'שגיאה בשרת ה-Proxy.' }));
                throw new Error(`שגיאה בחיבור: ${response.status} - ${errorData.error || 'נא לנסות שוב.'}`);
            }

            const files = await response.json(); 

            loadingDiv.style.display = 'none';

            if (files.length === 0) {
                resultsList.innerHTML = `<li>לא נמצאו הקלטות בתאריך המבוקש.</li>`;
            } else {
                resultsList.innerHTML = ''; // מנקה את הרשימה הקודמת
                files.forEach(file => {
                    const listItem = document.createElement('li');
                    const fileLink = document.createElement('a');
                    
                    fileLink.href = file.path; 
                    fileLink.textContent = file.name;
                    fileLink.target = '_blank';
                    
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.src = file.path;

                    listItem.appendChild(fileLink);
                    listItem.appendChild(audio);
                    resultsList.appendChild(listItem);
                });
            }
        } catch (error) {
            loadingDiv.style.display = 'none';
            resultsList.innerHTML = `<li>אירעה שגיאה: **${error.message}**</li>`;
            console.error('Error fetching files:', error);
        }
    });
});
