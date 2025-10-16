// ******************************************************************
// ⚠️ כתובת זו חייבת להיות ה-URL הציבורי של Render (כולל https://)
// ******************************************************************
const PROXY_SERVER_URL = 'https://search-record.onrender.com'; 
// ******************************************************************

// פונקציית עזר: שולחת בקשת אימות לבדיקת תקפות פרטי המשתמש מול השרת
const sendAuthRequest = async (username, password) => {
    // שולח בקשת חיפוש 'ריקה' (עם נתונים בסיסיים) רק כדי לאכוף את האימות בשרת
    const testUrl = `${PROXY_SERVER_URL}/search?user=${username}&pass=${password}&station=kcm&date=2024-01-01`;

    try {
        const response = await fetch(testUrl);
        // אם השרת החזיר 401 (Unauthorized), האימות נכשל.
        return response.ok || response.status === 404; // מחזיר true אם 200/404, false אם 401
    } catch (error) {
        // שגיאת רשת (כמו Failed to fetch) נחשבת ככישלון זמני
        console.error("Authentication check failed due to network error:", error);
        return false;
    }
};


document.addEventListener('DOMContentLoaded', async () => {
    const loginContainer = document.getElementById('login-container');
    const mainContent = document.getElementById('main-content');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');
    
    // ----------------------------------------------------
    // לוגיקת טעינה ובדיקת סשן
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
            }
        }
        loginContainer.classList.remove('hidden'); // הצגת טופס הכניסה
        return false;
    };
    
    await checkSession();


    // ----------------------------------------------------
    // מטפל בלחיצה על כפתור הכניסה
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

            loginContainer.classList.add('hidden');
            mainContent.classList.remove('hidden');
        } else {
            loginMessage.textContent = 'שם משתמש או סיסמה שגויים.';
            loginBtn.disabled = false;
        }
    });

    // ----------------------------------------------------
    // לוגיקת חיפוש
    // ----------------------------------------------------
    const searchForm = document.getElementById('search-form'); 
    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault(); 
        
        // קבלת פרמטרי האימות מזיכרון הדפדפן (Session Storage)
        const username = sessionStorage.getItem('radioUser');
        const password = sessionStorage.getItem('radioPass');

        const station = document.getElementById('station').value;
        const date = document.getElementById('date').value;
        const hour = document.getElementById('hour').value;
        
        if (!date || !username || !password) {
             // אם מאיזושהי סיבה חסרים נתונים, שולח חזרה לטופס הכניסה
            location.reload(); 
            return;
        }

        resultsList.innerHTML = '';
        const loadingDiv = document.getElementById('loading');
        loadingDiv.style.display = 'block';

        // בניית ה-URL: שליחת פרטי האימות השמורים
        let searchUrl = `${PROXY_SERVER_URL}/search?user=${username}&pass=${password}&station=${station}&date=${date}`;
        
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
                const resultsList = document.getElementById('results-list');
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
            document.getElementById('results-list').innerHTML = `<li>אירעה שגיאה: **${error.message}**</li>`;
            console.error('Error fetching files:', error);
        }
    });
});
