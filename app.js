console.log("App.js started loading..."); 

// ******************************************************************
// ⚠️ תיקון: כתובת מלאה וישירה (בלי סלאש בסוף)
// ******************************************************************
const PROXY_SERVER_URL = 'https://search-record.onrender.com'; 
// ******************************************************************

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

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

const sendAuthRequest = async (username, password) => {
    try {
        const encodedUser = encodeURIComponent(username);
        const encodedPass = encodeURIComponent(password);
        const testUrl = `${PROXY_SERVER_URL}/search?user=${encodedUser}&pass=${encodedPass}&station=kcm&date=2024-01-01`;
        
        const response = await fetch(testUrl);
        return response.ok || response.status === 404; 
    } catch (error) {
        console.error("Auth check network error:", error);
        return false;
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded, initializing scripts...");

    const loginContainer = document.getElementById('login-container');
    const mainContent = document.getElementById('main-content');
    const themeToggleBtn = document.getElementById('theme-toggle');

    if (!loginContainer || !mainContent) {
        console.error("Critical Error: HTML elements missing!");
        return;
    }

    if (themeToggleBtn) {
        const themeIcon = themeToggleBtn.querySelector('i');
        const currentTheme = localStorage.getItem('theme');
        
        if (currentTheme === 'dark') {
            document.body.classList.add('dark-mode');
            if(themeIcon) { themeIcon.classList.remove('fa-moon'); themeIcon.classList.add('fa-sun'); }
        }

        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            
            if (themeIcon) {
                themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            }
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');
    const searchForm = document.getElementById('search-form'); 
    const resultsList = document.getElementById('results-list');
    const loadingDiv = document.getElementById('loading');
    
    const playerContainer = document.getElementById('persistent-player');
    const player = document.getElementById('main-player');
    const playPauseBtn = document.getElementById('player-play-pause');
    const skipForwardBtn = document.getElementById('player-skip-forward');
    const skipBackwardBtn = document.getElementById('player-skip-backward');
    const volumeSlider = document.getElementById('player-volume-slider');
    const seekSlider = document.getElementById('player-seek-slider');
    const playerTitle = document.getElementById('player-episode-title');
    const playerArt = document.getElementById('player-episode-art');
    const currentTimeDisplay = document.getElementById('player-current-time');
    const totalTimeDisplay = document.getElementById('player-total-time');
    
    let wavesurfer = null;
    let wsRegions = null;
    const modal = document.getElementById('editor-modal');
    const closeModal = document.querySelector('.close-modal');
    const loadingWave = document.getElementById('waveform-loading');
    const editorAudio = document.getElementById('editor-audio-element');

    const checkSession = async () => {
        const storedUser = sessionStorage.getItem('radioUser');
        const storedPass = sessionStorage.getItem('radioPass');

        if (storedUser && storedPass) {
            if (await sendAuthRequest(storedUser, storedPass)) {
                loginContainer.classList.add('hidden');
                mainContent.classList.remove('hidden');
                return;
            } else {
                sessionStorage.clear();
            }
        }
        loginContainer.classList.remove('hidden'); 
    };
    
    checkSession();

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const userIn = document.getElementById('initial-username').value;
            const passIn = document.getElementById('initial-password').value;
            
            if (loginMessage) loginMessage.textContent = 'בודק פרטים...';
            loginBtn.disabled = true; 

            if (await sendAuthRequest(userIn, passIn)) {
                sessionStorage.setItem('radioUser', userIn);
                sessionStorage.setItem('radioPass', passIn);
                loginContainer.classList.add('hidden');
                mainContent.classList.remove('hidden');
            } else {
                if (loginMessage) loginMessage.textContent = 'שם משתמש או סיסמה שגויים.';
                loginBtn.disabled = false; 
            }
        });
    }

    if (searchForm) {
        searchForm.addEventListener('submit', async (event) => {
            event.preventDefault(); 
            
            const username = sessionStorage.getItem('radioUser');
            const password = sessionStorage.getItem('radioPass');
            
            const station = document.getElementById('station').value;
            const date = document.getElementById('date').value;
            const hour = document.getElementById('hour').value;
            
            if (!username || !password) {
                location.reload(); return;
            }

            const imageSrc = LOGO_MAP[station] || LOGO_MAP['default'];
            const stationFullName = STATION_NAME_MAP[station] || station;

            resultsList.innerHTML = '';
            if (loadingDiv) loadingDiv.style.display = 'block';

            const encodedUser = encodeURIComponent(username);
            const encodedPass = encodeURIComponent(password);
            
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
                    throw new Error(`Server returned ${response.status}`);
                }

                const files = await response.json(); 
                if (loadingDiv) loadingDiv.style.display = 'none';

                if (files.length === 0) {
                    resultsList.innerHTML = `<li>לא נמצאו הקלטות.</li>`;
                } else {
                    const [year, monthRaw, dayRaw] = date.split('-'); 
                    const month = parseInt(monthRaw, 10).toString(); 
                    const day = parseInt(dayRaw, 10).toString();

                    files.forEach(file => {
                        const listItem = document.createElement('li');
                        
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

                        const editBtn = document.createElement('button');
                        editBtn.className = 'btn-listen btn-edit'; 
                        editBtn.innerHTML = '<i class="fas fa-cut"></i> עריכה';
                        editBtn.setAttribute('data-src', file.path);
                        editBtn.setAttribute('data-name', file.name);

                        actionsWrapper.appendChild(playBtn);
                        actionsWrapper.appendChild(downloadBtn); 
                        actionsWrapper.appendChild(editBtn);

                        const fileLink = document.createElement('a');
                        fileLink.textContent = file.name;
                        fileLink.href = file.path;
                        fileLink.target = '_blank';

                        listItem.appendChild(fileLink);
                        listItem.appendChild(metadataDiv);
                        listItem.appendChild(actionsWrapper);
                        
                        resultsList.appendChild(listItem);
                    });
                }
            } catch (error) {
                if (loadingDiv) loadingDiv.style.display = 'none';
                resultsList.innerHTML = `<li>שגיאה: ${error.message}</li>`;
                console.error('Search error:', error);
            }
        });
    }

    if (resultsList && player && playerContainer) {
        resultsList.addEventListener('click', function(event) {
            const playButton = event.target.closest('.btn-listen');
            // אם זה לא כפתור עריכה
            if (playButton && !playButton.classList.contains('btn-edit')) {
                const src = playButton.getAttribute('data-src');
                const title = playButton.getAttribute('data-title');
                const imageSrc = playButton.getAttribute('data-image-src');
                
                const pTitle = document.getElementById('player-episode-title');
                const pArt = document.getElementById('player-episode-art');

                if (pTitle) pTitle.textContent = title;
                if (pArt) pArt.src = imageSrc || LOGO_MAP['default']; 
                
                player.src = src;
                player.load();
                player.play().catch(e => console.log("Auto-play blocked:", e));
                
                playerContainer.classList.add('visible'); 
            }
        });
    }

    if (modal && closeModal) {
        closeModal.onclick = () => {
            modal.classList.remove('show');
            if (wavesurfer) {
                wavesurfer.destroy();
                wavesurfer = null;
            }
            if (editorAudio) {
                editorAudio.pause();
                editorAudio.src = '';
            }
        };

        if (resultsList) {
            resultsList.addEventListener('click', async (event) => {
                const editButton = event.target.closest('.btn-edit');
                if (!editButton) return;

                const src = editButton.getAttribute('data-src');
                const filename = editButton.getAttribute('data-name');
                
                modal.classList.add('show');
                const editorFilename = document.getElementById('editor-filename');
                if (editorFilename) editorFilename.textContent = filename;
                
                const waveStatus = document.getElementById('waveform-loading');
                if (waveStatus) {
                    waveStatus.style.display = 'block';
                    waveStatus.textContent = 'טוען גלי קול... (ניתן כבר לנגן ולבחור)';
                }

                if (editorAudio) {
                    editorAudio.crossOrigin = "anonymous";
                    editorAudio.src = src;
                    editorAudio.load();
                }
                
                const waveEl = document.getElementById('waveform');
                if (waveEl) waveEl.innerHTML = ''; 
                
                modal.setAttribute('data-current-url', src);

                if (typeof WaveSurfer === 'undefined') return;

                wavesurfer = WaveSurfer.create({
                    container: '#waveform',
                    waveColor: '#007bff',
                    progressColor: '#17a2b8',
                    cursorColor: '#333',
                    height: 128,
                    media: editorAudio, 
                    fetchMedia: true, 
                    plugins: [
                        WaveSurfer.Timeline.create({ container: '#wave-timeline' }),
                        WaveSurfer.Regions.create()
                    ]
                });

                wsRegions = wavesurfer.registerPlugin(WaveSurfer.Regions.create());

                wavesurfer.on('ready', () => {
                    if (waveStatus) waveStatus.style.display = 'none';
                    wsRegions.addRegion({ start: 0, end: 60, color: 'rgba(0, 255, 204, 0.2)', drag: true, resize: true });
                });

                wsRegions.on('region-updated', (region) => updateRegionDisplay(region));
                wsRegions.on('region-created', (region) => {
                    updateRegionDisplay(region);
                    const regs = wsRegions.getRegions();
                    if (regs.length > 1) regs[0].remove();
                });
                
                wavesurfer.on('play', () => {
                    const btn = document.getElementById('btn-play-region');
                    if (btn) btn.innerHTML = '<i class="fas fa-pause"></i> השהה';
                });
                wavesurfer.on('pause', () => {
                    const btn = document.getElementById('btn-play-region');
                    if (btn) btn.innerHTML = '<i class="fas fa-expand"></i> נגן בחירה';
                });
            });
        }
    }

    function updateRegionDisplay(region) {
        const startEl = document.getElementById('region-start');
        const endEl = document.getElementById('region-end');
        const durEl = document.getElementById('region-duration');
        if(startEl) startEl.textContent = formatTime(region.start);
        if(endEl) endEl.textContent = formatTime(region.end);
        if(durEl) durEl.textContent = formatTime(region.end - region.start);
    }

    const btnPlayRegion = document.getElementById('btn-play-region');
    if (btnPlayRegion) {
        btnPlayRegion.addEventListener('click', () => {
            if (!wavesurfer) return;
            
            if (wavesurfer.isPlaying()) {
                wavesurfer.pause();
            } else {
                if (wsRegions) {
                    const regions = wsRegions.getRegions();
                    if (regions.length > 0) {
                        regions[0].play();
                    } else {
                        wavesurfer.play();
                    }
                } else {
                    wavesurfer.play();
                }
            }
        });
    }

    const btnDownloadCut = document.getElementById('btn-download-cut');
    if (btnDownloadCut) {
        btnDownloadCut.addEventListener('click', () => {
            if (!wsRegions) return;
            const regions = wsRegions.getRegions();
            if (regions.length === 0) {
                alert('אנא סמן אזור לחיתוך.');
                return;
            }
            const region = regions[0];
            const start = region.start;
            const duration = region.end - region.start;
            const filename = document.getElementById('editor-filename').textContent;
            const fileUrl = modal.getAttribute('data-current-url');

            const fadeIn = document.getElementById('fade-in-check').checked;
            const fadeOut = document.getElementById('fade-out-check').checked;

            const encodedFile = encodeURIComponent(filename);
            const encodedUrl = encodeURIComponent(fileUrl);
            
            const downloadUrl = `${PROXY_SERVER_URL}/trim?url=${encodedUrl}&start=${start}&duration=${duration}&filename=${encodedFile}&fadein=${fadeIn}&fadeout=${fadeOut}`;
            window.location.href = downloadUrl;
        });
    }

    if (playPauseBtn && player) {
        const togglePlayPause = () => {
            if (player.src && (player.paused || player.ended)) player.play();
            else player.pause();
        };
        playPauseBtn.addEventListener('click', togglePlayPause);
        
        const playIconStr = '<i class="fas fa-play"></i>';
        const pauseIconStr = '<i class="fas fa-pause"></i>';
        
        player.addEventListener('play', () => { playPauseBtn.innerHTML = pauseIconStr; });
        player.addEventListener('pause', () => { playPauseBtn.innerHTML = playIconStr; });
        player.addEventListener('ended', () => { playPauseBtn.innerHTML = playIconStr; });
        
        if (skipForwardBtn) skipForwardBtn.addEventListener('click', () => { if(player.src) player.currentTime += 30; });
        if (skipBackwardBtn) skipBackwardBtn.addEventListener('click', () => { if(player.src) player.currentTime -= 10; });
        if (volumeSlider) volumeSlider.addEventListener('input', (e) => { player.volume = e.target.value; });
        
        if (seekSlider && currentTimeDisplay) {
            player.addEventListener('timeupdate', () => {
                if (player.duration) {
                    seekSlider.value = player.currentTime;
                    currentTimeDisplay.textContent = formatTime(player.currentTime);
                }
            });
            seekSlider.addEventListener('input', () => {
                if(player.src) player.currentTime = seekSlider.value;
            });
        }
        
        if (totalTimeDisplay) {
            player.addEventListener('loadedmetadata', () => {
                if(seekSlider) seekSlider.max = player.duration;
                totalTimeDisplay.textContent = formatTime(player.duration);
            });
        }
    }
    
    if (playerContainer && player && volumeSlider) {
        playerContainer.addEventListener('wheel', e => {
            e.preventDefault();
            let volume = player.volume;
            if (e.deltaY < 0) volume = Math.min(1, volume + 0.1);
            else volume = Math.max(0, volume - 0.1);
            player.volume = volume;
            volumeSlider.value = volume;
        });
    }

    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!player || !player.src) return;
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                if (player.paused) player.play(); else player.pause();
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
