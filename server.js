const express = require('express');
const fetchModule = require('node-fetch');
const fetch = fetchModule.default || fetchModule;
const path = require('path');
const { JSDOM } = require('jsdom');

// --- תוספות לעריכת אודיו ---
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
// אומר לשרת להשתמש ב-ffmpeg שהורדנו מקומית
ffmpeg.setFfmpegPath(ffmpegPath);
// ---------------------------

const app = express();
const PORT = process.env.PORT || 3000; 

const REMOTE_RECORDING_SERVER_URL = 'http://192.168.1.10'; 
const RENDER_PUBLIC_URL = process.env.RENDER_EXTERNAL_URL; 

const VALID_USERS = [];
if (process.env.AUTH_USER && process.env.AUTH_PASS) {
    VALID_USERS.push({
        username: process.env.AUTH_USER,
        password: process.env.AUTH_PASS
    });
}
if (process.env.AUTH_USER_2 && process.env.AUTH_PASS_2) {
    VALID_USERS.push({
        username: process.env.AUTH_USER_2,
        password: process.env.AUTH_PASS_2
    });
}
if (VALID_USERS.length === 0) {
    VALID_USERS.push({ username: 'admin', password: '12345' });
}

app.use(express.static(__dirname)); 

// --- ✨ נתיב חדש: חיתוך הקלטה ✨ ---
app.get('/trim', (req, res) => {
    const { url, start, duration, filename } = req.query;

    if (!url || !start || !duration) {
        return res.status(400).send('Missing parameters (url, start, duration)');
    }

    // הופך את ה-URL של Render חזרה ל-URL של שרת ההקלטות המקורי
    let remoteFileUrl = url;
    if (url.includes('/recordings/')) {
        // לדוגמה: משמיט את https://.../recordings/ ומחבר לשרת המקורי
        const relativePath = url.split('/recordings/')[1];
        remoteFileUrl = `${REMOTE_RECORDING_SERVER_URL}/${relativePath}`;
    }

    console.log(`Starting trim: ${filename} | Start: ${start}s | Duration: ${duration}s`);

    // מגדיר את הקובץ כהורדה בדפדפן
    res.header('Content-Disposition', `attachment; filename="cut_${filename || 'recording.mp3'}"`);
    res.header('Content-Type', 'audio/mpeg');

    // ביצוע החיתוך והזרמה ישירה למשתמש
    ffmpeg(remoteFileUrl)
        .setStartTime(start)
        .setDuration(duration)
        .format('mp3')
        .audioCodec('libmp3lame')
        .on('error', (err) => {
            console.error('Error trimming file:', err);
            // אם ההורדה כבר התחילה אי אפשר לשלוח סטטוס שגיאה, אבל נרשום בלוג
            if (!res.headersSent) {
                res.status(500).send('Error processing file');
            }
        })
        .on('end', () => {
            console.log('Trim finished successfully');
        })
        .pipe(res, { end: true });
});
// -----------------------------------


app.get('/search', async (req, res) => {
    const { station, date, hour, user, pass } = req.query; 

    const isAuthenticated = VALID_USERS.some(validUser => {
        return validUser.username === user && validUser.password === pass;
    });

    if (!isAuthenticated) {
        return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
    }
    
    if (!station || !date) {
        return res.status(400).json({ error: 'Missing station or date parameters' });
    }

    const dateParts = date.split('-'); 
    const year = dateParts[0];
    const month = parseInt(dateParts[1], 10).toString(); 
    const day = parseInt(dateParts[2], 10).toString();   

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
                    path: `${process.env.RENDER_EXTERNAL_URL}/recordings/${station}/${year}/${month}/${day}/${href}` 
                });
            }
        });
        
        if (hour) {
            const targetHour = parseInt(hour, 10);
            
            if (isNaN(targetHour) || targetHour < 0 || targetHour > 23) {
                return res.status(400).json({ error: 'שעה לא תקינה. יש לבחור מספר בין 0 ל-23.' });
            }

            recordings = recordings.filter(file => {
                const fileNameWithoutExtension = file.name.slice(0, -4); 
                const prefix = station + year + month + day;
                const fileHourStr = fileNameWithoutExtension.replace(prefix, '');
                
                if (fileHourStr === "") return false; 
                const fileHour = parseInt(fileHourStr, 10);
                
                return fileHour === targetHour;
            });
        }
        
        res.json(recordings);

    } catch (error) {
        console.error('SERVER DEBUG ERROR:', error.message);
        return res.status(500).json({ error: 'Failed to process request on proxy server.' });
    }
});

app.use('/recordings', async (req, res) => {
    const remoteUrl = REMOTE_RECORDING_SERVER_URL + req.originalUrl.replace('/recordings', '');
    try {
        const response = await fetch(remoteUrl);
        if (!response.ok) {
            return res.status(response.status).send('Failed to stream file');
        }
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
