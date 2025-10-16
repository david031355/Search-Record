// ******************************************************************
// ⚠️ כתובת זו חייבת להיות ה-URL הציבורי של Render (כולל https://)
// ******************************************************************
const PROXY_SERVER_URL = 'https://search-record.onrender.com'; 
// ******************************************************************

// פונקציית עזר: שולחת בקשת אימות לבדיקת תקפות פרטי המשתמש מול השרת
const sendAuthRequest = async (username, password) => {
    
    // **תיקון קריטי: קידוד פרטי הכניסה (במיוחד לעברית)**
    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);
    
    // שולח בקשת חיפוש 'ריקה' (עם נתונים בסיסיים) רק כדי לאכוף את האימות בשרת
    const testUrl = `${PROXY_SERVER_URL}/search?user=${encodedUser}&pass=${encodedPass}&station=kcm&date=2024-01-01`;

    try {
        const response = await fetch(testUrl);
        return response.ok || response.status === 404; // מחזיר true אם 200/404, false אם 401
    } catch (error) {
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
    
    await checkSession();


    // ----------------------------------------------------
    // מטפל בלחיצה על כפתור הכניסה
    // ----------------------------------------------------
    loginBtn.addEventListener('click', async () => {
        const user = document.getElementById('initial-username').value;
        const pass = document.getElementById('initial-password').value;
        
        loginMessage.textContent = '';
        loginBtn.disabled = true; 

        if (await sendAuthRequest(user, pass)) {
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
        
        const username = sessionStorage.getItem('radioUser');
        const password = sessionStorage.getItem('radioPass');
        
        // **תיקון קריטי: קידוד פרטי הכניסה (במיוחד לעברית)**
        const encodedUser = encodeURIComponent(username);
        const encodedPass = encodeURIComponent(password);

        const station = document.getElementById('station').value;
        const date = document.getElementById('date').value;
        const hour = document.getElementById('hour').value;
        
        if (!date || !username || !password) {
            location.reload(); 
            return;
        }

        const resultsList = document.getElementById('results-list');
        const loadingDiv = document.getElementById('loading');
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
                if (response.status === 401) {
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
                resultsList.innerHTML = ''; 
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
