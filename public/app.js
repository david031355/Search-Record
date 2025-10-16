// ******************************************************************
// ⚠️ כתובת זו תשתנה! כרגע היא ריקה, נמלא אותה לאחר הפריסה ל-Render.
// ******************************************************************
const PROXY_SERVER_URL = ''; 
// ******************************************************************

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form'); 
    const resultsList = document.getElementById('results-list');
    const loadingDiv = document.getElementById('loading');

    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const station = document.getElementById('station').value;
        const date = document.getElementById('date').value;
        const hour = document.getElementById('hour').value;

        if (!date) {
            alert('יש לבחור תאריך!');
            return;
        }

        resultsList.innerHTML = '';
        loadingDiv.style.display = 'block';

        let searchUrl = `${PROXY_SERVER_URL}/search?station=${station}&date=${date}`;
        
        if (hour !== '') {
            searchUrl += `&hour=${hour}`;
        }

        try {
            const response = await fetch(searchUrl);
            
            if (!response.ok) {
                if (response.status === 400) {
                     const errorData = await response.json();
                     throw new Error(errorData.error);
                }
                // אם ה-URL ריק, תופיע שגיאה. זה יתוקן לאחר הפריסה.
                throw new Error(`שגיאה בחיבור לשרת ה-Proxy. ודא שכתובת ה-URL מעודכנת ב-app.js.`);
            }

            const files = await response.json(); 

            loadingDiv.style.display = 'none';

            if (files.length === 0) {
                resultsList.innerHTML = `<li>לא נמצאו הקלטות בתאריך המבוקש.</li>`;
            } else {
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