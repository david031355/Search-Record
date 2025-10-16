const express = require('express');
// ייבוא fetch בצורה יציבה (גרסה 2)
const fetchModule = require('node-fetch');
const fetch = fetchModule.default || fetchModule;
const path = require('path');
const { JSDOM } = require('jsdom');

const app = express();
// הפורט נקבע על ידי Render
const PORT = process.env.PORT || 3000; 

// ******************************************************************
// ⚠️ נקודות קריטיות לחיבור:
// ******************************************************************
const REMOTE_RECORDING_SERVER_URL = 'http://164.68.127.36/'; 
// עליך להחליף את הכתובת הזו ב-IP או בדומיין האמיתי של שרת ההקלטות שלך!

// Render מספק את ה-HTTPS URL שלו אוטומטית (חיוני להזרמה)
const RENDER_PUBLIC_URL = process.env.RENDER_EXTERNAL_URL; 

// ערכים אלו נקראים ממשתני הסביבה (Environment Variables) ב-Render
const VALID_USERNAME = process.env.AUTH_USER || 'admin'; 
const VALID_PASSWORD = process.env.AUTH_PASS || '12345';
// ******************************************************************

// הגשת קבצים סטטיים (index.html, app.js, style.css) משורש הפרויקט
app.use(express.static(__dirname)); 

// נקודת ה-API לחיפוש
app.get('/search', async (req, res) => {
    // 1. קבלת פרמטרי אימות וחיפוש
    const { station, date, hour, user, pass } = req.query; 

    // 2. אכיפת האימות (חובה)
    if (user !== VALID_USERNAME || pass !== VALID_PASSWORD) {
        return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
    }
    
    // 3. בדיקות חובה לאחר האימות
    if (!station || !date) {
        return res.status(400).json({ error: 'Missing station or date parameters' });
    }

    // 4. בניית נתיב לשרת ההקלטות
    const [year, month, day] = date.split('-'); 
    const targetDirectoryUrl = `${REMOTE_RECORDING_SERVER_URL}/${station}/${year}/${month}/${day}/`;

    try {
        const response = await fetch(targetDirectoryUrl);
        
        if (!response.ok) {
            if (response.status === 404) return res.json([]); 
            throw new Error(`Failed to fetch directory listing: HTTP ${response.status}`);
        }

        const htmlText = await response.text();
        const dom = new JSDOM(htmlText);
        const links = dom.window.document.querySelectorAll('a');
        
        let recordings = [];

        links.forEach(link => {
            const href = link.getAttribute('href');
            if ((href.endsWith('.mp3') || href.endsWith('.wav'))) {
                recordings.push({
                    name: link.textContent,
                    // יצירת נתיב שמשתמש ב-HTTPS URL של Render
                    path: `${RENDER_PUBLIC_URL}/recordings/${station}/${year}/${month}/${day}/${href}` 
                });
            }
        });
        
        // 5. סינון לפי שעה בודדת (כפי שנקבע)
        if (hour) {
            const targetHour = parseInt(hour, 10);
            
            if (isNaN(targetHour) || targetHour < 0 || targetHour > 23) {
                return res.status(400).json({ error: 'שעה לא תקינה. יש לבחור מספר בין 0 ל-23.' });
            }

            recordings = recordings.filter(file => {
                const fileNameWithoutExtension = file.name.slice(0, -4); 
                const hourMatch = fileNameWithoutExtension.match(/(\d{1,2})$/);
                
                if (!hourMatch) return false; 
                const fileHour = parseInt(hourMatch[1], 10);
                
                return fileHour === targetHour;
            });
        }
        
        res.json(recordings);

    } catch (error) {
        console.error('SERVER DEBUG ERROR:', error.message);
        return res.status(500).json({ error: 'Failed to process request on proxy server.' });
    }
});

// ***************************************************************
// Reverse Proxy להזרמת קבצי מדיה דרך Render (הכרחי ל-HTTPS!)
// ***************************************************************
app.use('/recordings', async (req, res) => {
    // בונה את ה-URL המלא לשרת ההקלטות המקורי
    const remoteUrl = REMOTE_RECORDING_SERVER_URL + req.originalUrl.replace('/recordings', '');
    try {
        const response = await fetch(remoteUrl);
        if (!response.ok) {
            return res.status(response.status).send('Failed to stream file');
        }
        // העברת הכותרות וזרם הקובץ ישירות לדפדפן
        response.headers.forEach((value, name) => res.set(name, value));
        response.body.pipe(res);
    } catch (error) {
        console.error('Reverse Proxy Error:', error.message);
        res.status(500).send('Streaming error');
    }
});


app.listen(PORT, () => {
    console.log(`Proxy Server running on port ${PORT}.`);
});
