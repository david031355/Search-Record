// ******************************************************************
// ⚠️ כתובת זו חייבת להיות ה-URL הציבורי של Render (או ריקה אם רץ על Render)
// ******************************************************************
const PROXY_SERVER_URL = ''; 
// ******************************************************************

// מפה של מזהי תחנות לנתיבי לוגו מקומיים
const LOGO_MAP = {
    'kcm': 'img/kcm.svg',
    'kol_chai': 'img/kol_chai.svg',
    'kolbarama': 'img/kol_barama.png',
    'kol_play': 'img/kol_play.png',
    'default': 'img/default.png' 
};

const STATION_NAME_MAP = {
    'kcm': 'קול חי מיוזיק',
    'kol_chai': 'קול חי',
    'kolbarama': 'קול ברמה',
    'kol_play': 'קול פליי'
};

/**
 * פונקציית עזר: שולחת בקשת אימות לבדיקת תקפות פרטי המשתמש מול השרת
 */
const sendAuthRequest = async (username, password) => {
    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);
    const testUrl = `${PROXY_SERVER_URL}/search?user=${encodedUser}&pass=${encodedPass}&station=kcm&date=2024-01-01`;

    try {
        const response = await fetch(testUrl);
        return response.ok || response.status === 404; 
    } catch (error) {
        console.error("Authentication check failed due to network error:", error);
        return false;
    }
};

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}


/**
 * קוד ראשי שרץ כשהדף נטען
 */
document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. בחירת רכיבי DOM ---
    
    const loginContainer = document.getElementById('login-container');
    const mainContent = document.getElementById('main-content');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');
    
    const searchForm = document.getElementById('search-form'); 
    const resultsList = document.getElementById('results-list');
    const loadingDiv = document.getElementById('loading');
    
    const playerContainer = document.getElementById('persistent-player');
    const player = document.getElementById('main-player');
    const playPauseBtn = document.getElementById('player-play-pause');
    const playIcon = '<i class="fas fa-play"></i>';
    const pauseIcon = '<i class="fas fa-pause"></i>';
    const skipForwardBtn = document.getElementById('player-skip-forward');
    const skipBackwardBtn = document.getElementById('player-skip-backward');
    const volumeSlider = document.getElementById('player-volume-slider');
    const seekSlider = document.getElementById('player-seek-slider');
    const playerTitle = document.getElementById('player-episode-title');
    const playerArt = document.getElementById('player-episode-art');
    const currentTimeDisplay = document.getElementById('player-current-time');
    const totalTimeDisplay = document.getElementById('player-total-time');

    // ✨ לוגיקת מצב כהה (Dark Mode) ✨
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = themeToggleBtn.querySelector('i');

    // בדיקה אם יש העדפה שמורה
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        
        // החלפת אייקון ושמירה ב-LocalStorage
        if (document.body.classList.contains('dark-mode')) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
            localStorage.setItem('theme', 'dark');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
            localStorage.setItem('theme', 'light');
        }
    });
    // ✨ סוף לוגיקת מצב כהה ✨

    
    // ----------------------------------------------------
    // 2. לוגיקת טעינה ובדיקת סשן
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
                sessionStorage.clear();
            }
        }
        loginContainer.classList.remove('hidden'); 
        return false;
    };
    
    await checkSession();


    // ----------------------------------------------------
    // 3. מטפל בלחיצה על כפתור הכניסה
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
    // 4. לוגיקת חיפוש
    // ----------------------------------------------------
    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault(); 
        
        const username = sessionStorage.getItem('radioUser');
        const password = sessionStorage.getItem('radioPass');
        const encodedUser = encodeURIComponent(username);
        const encodedPass = encodeURIComponent(password);
        
        const station = document.getElementById('station').value;
        const date = document.getElementById('date').value;
        const hour = document.getElementById('hour').value;
        
        const imageSrc = LOGO_MAP[station] || LOGO_MAP['default'];
        const stationFullName = STATION_NAME_MAP[station] || station;
        
        if (!date || !username || !password) {
            sessionStorage.clear();
            location.reload(); 
            return;
        }

        resultsList.innerHTML = '';
        loadingDiv.style.display = 'block';

        let searchUrl = `${PROXY_SERVER_URL}/search?user=${encodedUser}&pass=${encodedPass}&station=${station}&date=${date}`;
        if (hour !== '') searchUrl += `&hour=${hour}`;

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
                
                const [year, monthRaw, dayRaw] = date.split('-'); 
                const month = parseInt(monthRaw, 10).toString(); 
                const day = parseInt(dayRaw, 10).toString();
                
                files.forEach(file => {
                    const listItem = document.createElement('li');
                    
                    const fileLink = document.createElement('a');
                    fileLink.href = file.path; 
                    fileLink.textContent = file.name;
                    fileLink.target = '_blank';
                    
                    const metadataDiv = document.createElement('div');
                    metadataDiv.className = 'result-metadata';
                    
                    let fileHour = '??';
                    const prefix = station + year + month + day;
                    const fileHourStr = file.name.slice(0, -4).replace(prefix, '');
                    
                    if (fileHourStr !== "") {
                        fileHour = fileHourStr.padStart(2, '0'); 
                    }
                    metadataDiv.textContent = `תאריך: ${dayRaw}/${monthRaw}/${year} | שעה: ${fileHour}:00`;

                    const actionsWrapper = document.createElement('div');
                    actionsWrapper.className = 'result-actions';

                    const playBtn = document.createElement('button');
                    playBtn.className = 'btn-listen'; 
                    playBtn.innerHTML = '<i class="fas fa-play"></i> האזנה';
                    playBtn.setAttribute('data-src', file.path); 
                    playBtn.setAttribute('data-title', `${stationFullName} | ${fileHour}:00`); 
                    playBtn.setAttribute('data-image-src', imageSrc); 
                    
                    const downloadBtn = document.createElement('a');
                    downloadBtn.href = file.path; 
                    downloadBtn.setAttribute('download', file.name); 
                    downloadBtn.className = 'download-button';
                    downloadBtn.innerHTML = '<i class="fas fa-download"></i> הורדה'; 

                    actionsWrapper.appendChild(playBtn);
                    actionsWrapper.appendChild(downloadBtn); 

                    listItem.appendChild(fileLink);
                    listItem.appendChild(metadataDiv); 
                    listItem.appendChild(actionsWrapper);
                    
                    resultsList.appendChild(listItem);
                });
            }
        } catch (error) {
            loadingDiv.style.display = 'none';
            resultsList.innerHTML = `<li>אירעה שגיאה: **${error.message}**</li>`;
            console.error('Error fetching files:', error);
        }
    });
    
    // ----------------------------------------------------
    // 5. לוגיקת הנגן הקבוע
    // ----------------------------------------------------
    
    resultsList.addEventListener('click', function(event) {
        const playButton = event.target.closest('.btn-listen');
        
        if (playButton) {
            const src = playButton.getAttribute('data-src');
            const title = playButton.getAttribute('data-title');
            const imageSrc = playButton.getAttribute('data-image-src');
            
            player.src = src;
            playerTitle.textContent = title;
            playerArt.src = imageSrc || LOGO_MAP['default']; 
            
            player.load();
            player.play();
            
            playerContainer.classList.add('visible'); 
        }
    });

    function togglePlayPause() {
        if (player.src && (player.paused || player.ended)) {
            player.play();
        } else {
            player.pause();
        }
    }
    
    playPauseBtn.addEventListener('click', togglePlayPause);
    player.addEventListener('play', () => { playPauseBtn.innerHTML = pauseIcon; });
    player.addEventListener('pause', () => { playPauseBtn.innerHTML = playIcon; });
    player.addEventListener('ended', () => { playPauseBtn.innerHTML = playIcon; });
    
    skipForwardBtn.addEventListener('click', () => { if(player.src) player.currentTime += 30; });
    skipBackwardBtn.addEventListener('click', () => { if(player.src) player.currentTime -= 10; });
    
    volumeSlider.addEventListener('input', (e) => { player.volume = e.target.value; });
    
    player.addEventListener('timeupdate', () => {
        if (player.duration) {
            seekSlider.value = player.currentTime;
            currentTimeDisplay.textContent = formatTime(player.currentTime);
        }
    });
    
    player.addEventListener('loadedmetadata', () => {
        seekSlider.max = player.duration;
        totalTimeDisplay.textContent = formatTime(player.duration);
    });
    
    seekSlider.addEventListener('input', () => {
        if(player.src) player.currentTime = seekSlider.value;
    });

    playerContainer.addEventListener('wheel', e => {
        e.preventDefault();
        let volume = player.volume;
        if (e.deltaY < 0) { 
            volume = Math.min(1, volume + 0.1);
        } else { 
            volume = Math.max(0, volume - 0.1);
        }
        player.volume = volume;
        volumeSlider.value = volume;
    });

    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        if (!player.src) {
            return;
        }
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowRight':
                player.currentTime += 30;
                break;
            case 'ArrowLeft':
                player.currentTime -= 10;
                break;
        }
    });
    
});
