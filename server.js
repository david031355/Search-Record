const express = require('express');
const fetchModule = require('node-fetch');
const fetch = fetchModule.default || fetchModule;
const path = require('path');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 3000; 

// ******************************************************************
// ⚠️ נקודות קריטיות לחיבור:
// ******************************************************************
const REMOTE_RECORDING_SERVER_URL = 'http://164.68.127.36/'; 
// עליך להחליף את הכתובת הזו ב-IP או בדומיין האמיתי של שרת ההקלטות שלך!

// Render מספק את ה-HTTPS URL שלו דרך משתנה סביבה (RENDER_EXTERNAL_URL)
const RENDER_PUBLIC_URL = process.env.RENDER_EXTERNAL_URL; 
// ******************************************************************

// תיקון: הגשת קבצים סטטיים משורש הפרויקט
app.use(express.static(__dirname)); 

app.get('/search', async (req, res) => {
    const { station, date, hour } = req.query; 

    if (!station || !date) {
        return res.status(400).json({ error: 'Missing station or date parameters' });
    }

    const [year, month, day] = date.split('-'); 
    const targetDirectoryUrl = `${REMOTE_RECORDING_SERVER_URL}/${station}/${year}/${month}/${day}/`;

    try {
        const response = await fetch(targetDirectoryUrl);
        
        if (!response.ok) {
            if (response.status === 404) {
                return res.json([]); 
            }
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
                    // **התיקון הקריטי:** יצירת נתיב שמשתמש ב-HTTPS URL של Render
                    path: `${RENDER_PUBLIC_URL}/recordings/${station}/${year}/${month}/${day}/${href}` 
                });
            }
        });
        
        // סינון לפי שעה בודדת (כפי שנקבע)
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
        return res.status(500).json({ error: 'Failed to process request on proxy server. Check terminal for specific error.' });
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
        console.error('Reverse Proxy Error:', error);
        res.status(500).send('Streaming error');
    }
});


app.listen(PORT, () => {
    console.log(`Proxy Server running on port ${PORT}.`);
});
