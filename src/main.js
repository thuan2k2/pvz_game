// src/main.js
import { monitorAuthState, logoutUser, listenToUserData } from './firebase/auth.js';
import { auth, db } from './firebase/config.js'; 
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore'; 

import GameCore from './game/GameCore.js'; 
import { loadImages } from './game/Resources.js';
import { fetchPlantsFromServer } from './plantsData.js';

// [CẬP NHẬT UI MAPPING] - Đồng bộ với index.html mới
const ui = {
    // Game Elements
    canvas: document.getElementById('game-canvas'),
    gameHeader: document.getElementById('game-header'),
    bottomToolbar: document.getElementById('bottom-toolbar'),
    
    // Lobby UI Elements (ID mới)
    lobbyScreen: document.getElementById('lobby-screen'),
    lobbyUsername: document.getElementById('lobby-username'),
    lobbyStatus: document.getElementById('lobby-status'),
    lobbyCoin: document.getElementById('lobby-coin'),
    lobbyVNCoin: document.getElementById('lobby-vncoin'),
    lobbyBalanceContainer: document.getElementById('lobby-balance-container'),
    
    // Buttons
    btnOpenAuth: document.getElementById('btn-open-auth-menu'), 
    btnLogoutLobby: document.getElementById('btn-lobby-logout'), 
    btnAdminNav: document.getElementById('btn-admin-nav'), // Nút Admin trên thanh Nav
    btnStartGame: document.getElementById('btn-start-game'),
    
    // Notifications & Overlays
    notifBar: document.getElementById('notification-bar'),
    notifText: document.getElementById('notification-text'),
    dataErrorPopup: document.getElementById('data-error-popup'),
    overlayScreen: document.getElementById('overlay-screen'),
    modalPause: document.getElementById('modal-pause-menu')
};

// --- BIẾN TOÀN CỤC ---
let unsubscribeUser = null;
let unsubscribeSystem = null; 
let maintenanceInterval = null; 
let gameInstance = null; 
let isDataValid = false; 

let currentState = {
    userRole: null, 
    config: null,
    isGuestActive: false 
};

// --- 1. LOGIC AUTH & REALTIME UPDATE ---
monitorAuthState(async (user) => {
    
    // Tải dữ liệu Cây/Zombie
    try {
        const result = await fetchPlantsFromServer();
        if (result.success) {
            isDataValid = true;
        } else {
            isDataValid = false;
            // Hiện Popup Lỗi Dữ Liệu
            if(ui.dataErrorPopup) ui.dataErrorPopup.style.display = 'flex';
            
            // Vô hiệu hóa nút Play
            if(ui.btnStartGame) {
                ui.btnStartGame.disabled = true;
                // Thay đổi text bên trong span của nút Hextech
                const span = ui.btnStartGame.querySelector('span');
                if(span) span.textContent = "LỖI DỮ LIỆU";
                ui.btnStartGame.style.borderColor = "#c0392b";
                ui.btnStartGame.style.opacity = "0.5";
            }
            return; 
        }
    } catch (e) {
        console.error("Lỗi tải dữ liệu cây:", e);
    }

    // BROADCAST ĐẠI GIA
    const qBroadcast = query(collection(db, "server_broadcasts"), orderBy("timestamp", "desc"), limit(1));
    onSnapshot(qBroadcast, (snapshot) => {
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            if (data.timestamp) {
                const now = new Date().getTime();
                const msgTime = data.timestamp.toMillis();
                if (now - msgTime < 15000) showBigSpenderEffect(data.message);
            }
        }
    });

    // CONFIG HỆ THỐNG
    if (!unsubscribeSystem) {
        unsubscribeSystem = onSnapshot(doc(db, "system_config", "general"), (docSnap) => {
            if (docSnap.exists()) {
                currentState.config = docSnap.data();
                if (user || currentState.isGuestActive) {
                    checkMaintenanceAndKick(); 
                    updateNotificationUI();
                }
            }
        });
    }

    if (user) {
        // --- ĐÃ ĐĂNG NHẬP ---
        console.log("User:", user.email);
        currentState.isGuestActive = false;

        // Cập nhật UI
        if(ui.btnOpenAuth) ui.btnOpenAuth.style.pointerEvents = 'none'; // Tắt click mở modal login
        if(ui.btnLogoutLobby) ui.btnLogoutLobby.classList.remove('hidden');
        if(ui.lobbyBalanceContainer) ui.lobbyBalanceContainer.classList.remove('hidden'); 
        
        if (isDataValid) enableStartGameBtn(); 

        if (unsubscribeUser) unsubscribeUser();
        
        unsubscribeUser = listenToUserData(user.uid, async (userData) => {
            if (!userData) return;

            currentState.userRole = userData.role || 'user';
            
            // Sync Storage
            localStorage.setItem('item_plant_food_count', userData.item_plant_food_count || 0);
            localStorage.setItem('user_inventory', JSON.stringify(userData.inventory || []));
            const tempItems = {};
            if (userData.temp_items) {
                for (const [key, val] of Object.entries(userData.temp_items)) {
                    if(val && val.toDate) tempItems[key] = val.toDate().getTime();
                }
            }
            localStorage.setItem('user_temp_items', JSON.stringify(tempItems));
            localStorage.setItem('user_item_settings', JSON.stringify(userData.item_settings || {}));

            checkMaintenanceAndKick();
            updateNotificationUI();

            // Check Ban
            if (userData.bannedUntil) {
                const banDate = userData.bannedUntil.toDate();
                if (banDate > new Date()) {
                    alert(`⛔ TÀI KHOẢN ĐÃ BỊ KHÓA!\n\nHiệu lực đến: ${banDate.toLocaleDateString()}`);
                    await logoutUser();
                    window.location.reload();
                    return;
                }
            }

            const safeCoins = (typeof userData.coins === 'number') ? userData.coins : 0;
            const safeVNCoin = (typeof userData.vn_coin === 'number') ? userData.vn_coin : 0;
            
            updateUserUI(userData.email, safeCoins, safeVNCoin, userData.role);
        });

    } else {
        // --- CHƯA ĐĂNG NHẬP ---
        console.log("Khách / Chưa đăng nhập");
        
        if (unsubscribeUser) unsubscribeUser();
        
        if(ui.btnOpenAuth) ui.btnOpenAuth.style.pointerEvents = 'auto';
        if(ui.btnLogoutLobby) ui.btnLogoutLobby.classList.add('hidden');
        if(ui.lobbyBalanceContainer) ui.lobbyBalanceContainer.classList.add('hidden');
        if(ui.btnAdminNav) ui.btnAdminNav.classList.add('hidden');

        // Reset UI về mặc định
        if(ui.lobbyUsername) ui.lobbyUsername.textContent = "Khách";
        if(ui.lobbyStatus) ui.lobbyStatus.textContent = "Chưa đăng nhập";
        
        currentState.userRole = null;

        if (!currentState.isGuestActive) {
            disableStartGameBtn();
            if(ui.notifBar) ui.notifBar.style.display = 'none'; 
        } else {
            if (isDataValid) activeGuestMode();
        }
    }

    initGameEvents();
});

// [FIX] Cập nhật UI an toàn
function updateUserUI(email, coins, vncoin, role) {
    if(ui.lobbyUsername) ui.lobbyUsername.textContent = email.split('@')[0];
    if(ui.lobbyStatus) ui.lobbyStatus.textContent = "Online";
    if(ui.lobbyCoin) ui.lobbyCoin.textContent = coins.toLocaleString();
    if(ui.lobbyVNCoin) ui.lobbyVNCoin.textContent = vncoin.toLocaleString();

    if (role === 'admin' && ui.btnAdminNav) {
        ui.btnAdminNav.classList.remove('hidden');
    }
}

function activeGuestMode() {
    if (!isDataValid) return;

    currentState.userRole = 'guest';
    currentState.isGuestActive = true;

    localStorage.setItem('item_plant_food_count', 0);
    localStorage.setItem('user_inventory', JSON.stringify([]));
    localStorage.setItem('user_temp_items', JSON.stringify({}));
    localStorage.setItem('user_item_settings', JSON.stringify({}));

    if(ui.lobbyUsername) ui.lobbyUsername.textContent = "Khách (Chơi Thử)";
    if(ui.lobbyStatus) ui.lobbyStatus.textContent = "Đang Online";
    
    if(ui.btnOpenAuth) ui.btnOpenAuth.classList.add('hidden'); // Ẩn vùng click login
    if(ui.btnLogoutLobby) ui.btnLogoutLobby.classList.remove('hidden'); // Hiện nút thoát
    
    enableStartGameBtn(); 
    checkMaintenanceAndKick();
    updateNotificationUI();
}

function disableStartGameBtn() {
    if(ui.btnStartGame) {
        ui.btnStartGame.disabled = true;
        const span = ui.btnStartGame.querySelector('span');
        if(span) span.textContent = "ĐĂNG NHẬP ĐỂ CHƠI";
    }
}

function enableStartGameBtn() {
    if(ui.btnStartGame && isDataValid) {
        ui.btnStartGame.disabled = false;
        const span = ui.btnStartGame.querySelector('span');
        if(span) span.textContent = "ĐẤU NGAY";
    }
}

// ... (Các hàm phụ trợ: checkMaintenance, updateNotification, showBigSpenderEffect giữ nguyên logic cũ) ...
// Để ngắn gọn, tôi chỉ viết lại phần logic chính. Bạn có thể giữ lại các hàm phụ trợ từ code cũ nếu muốn, 
// nhưng nhớ sửa lại các tham chiếu `ui.xyz` nếu cần.
// Dưới đây là các hàm phụ trợ đã được chỉnh sửa tham chiếu UI:

function checkMaintenanceAndKick() {
    if (maintenanceInterval) clearInterval(maintenanceInterval);
    const config = currentState.config;
    const role = currentState.userRole;
    if (!config || !config.maintenance || role === 'admin' || !role) return;
    
    const endTime = config.maintenance_end_time ? config.maintenance_end_time.toDate().getTime() : 0;
    const performCheck = async () => {
        const now = Date.now();
        if ((endTime - now) <= 0) {
            clearInterval(maintenanceInterval);
            alert(`⚠️ BẢO TRÌ HỆ THỐNG\n\n${config.maintenance_message || "Hệ thống bảo trì."}`);
            if (auth.currentUser) await logoutUser(); 
            window.location.reload(); 
        }
    };
    performCheck();
    maintenanceInterval = setInterval(performCheck, 1000);
}

function updateNotificationUI() {
    const config = currentState.config;
    if (!config || (!auth.currentUser && !currentState.isGuestActive)) {
        if(ui.notifBar) ui.notifBar.style.display = 'none';
        return;
    }
    let messageParts = [];
    if (config.maintenance) messageParts.push(`⚠️ BẢO TRÌ: ${config.maintenance_message}`);
    if (config.announcement) messageParts.push(`📢 ${config.announcement}`);
    
    if (messageParts.length > 0) {
        if(ui.notifText) ui.notifText.textContent = messageParts.join("   |   ");
        if(ui.notifBar) ui.notifBar.style.display = 'flex';
    } else {
        if(ui.notifBar) ui.notifBar.style.display = 'none';
    }
}

function showBigSpenderEffect(message) {
    const oldStyle = document.getElementById('vip-marquee-style');
    if (oldStyle) oldStyle.remove();
    const oldMarquee = document.getElementById('vip-marquee');
    if (oldMarquee) oldMarquee.remove();

    const style = document.createElement('style');
    style.id = 'vip-marquee-style';
    style.innerHTML = ` @keyframes vipMarqueeRun { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } } .vip-rainbow-text { font-family: 'Segoe UI', sans-serif; font-size: 1.3em; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; background: linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8f00ff); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: 0px 0px 6px rgba(255, 255, 255, 0.4); white-space: nowrap; padding-right: 30px; } `;
    document.head.appendChild(style);

    const marquee = document.createElement('div');
    marquee.id = 'vip-marquee';
    marquee.style.cssText = ` position: fixed; top: 0; left: 0; width: 100%; height: 48px; background: rgba(0, 0, 0, 0.9); border-bottom: 2px solid #f1c40f; box-shadow: 0 3px 10px rgba(241, 196, 15, 0.35); z-index: 100000; display: flex; align-items: center; overflow: hidden; pointer-events: none; `;
    const content = document.createElement('div');
    content.className = 'vip-rainbow-text';
    content.innerHTML = `💎 📢 ĐẠI GIA XUẤT HIỆN: ${message} 💎`;
    content.style.animation = "vipMarqueeRun 12s linear 3"; 
    marquee.appendChild(content);
    document.body.appendChild(marquee);
    content.addEventListener('animationend', () => { marquee.remove(); style.remove(); });
}

function initGameEvents() {
    if (window.isGameInitialized) return;
    window.isGameInitialized = true;

    loadImages();
    const ctx = ui.canvas.getContext('2d');
    ui.canvas.width = 1200; 
    ui.canvas.height = 600;

    // AUTH Events
    if (ui.btnOpenAuth) {
        ui.btnOpenAuth.addEventListener('click', () => {
            if(!auth.currentUser && !currentState.isGuestActive) {
                const modal = document.getElementById('modal-auth-selection');
                if(modal) modal.classList.remove('hidden');
            }
        });
    }

    if (ui.btnLogoutLobby) {
        ui.btnLogoutLobby.addEventListener('click', async () => {
            if (confirm("Thoát khỏi tài khoản?")) {
                await signOut(auth);
                window.location.reload(); 
            }
        });
    }

    const btnPlayGuest = document.getElementById('btn-play-guest');
    if (btnPlayGuest) {
        btnPlayGuest.addEventListener('click', () => {
            window.closeModal('modal-auth-selection');
            activeGuestMode(); 
        });
    }

    // START GAME
    if (ui.btnStartGame) {
        ui.btnStartGame.addEventListener('click', () => {
            if (!isDataValid) return;
            
            // Chuyển cảnh: Ẩn Lobby -> Hiện Game
            if(ui.lobbyScreen) ui.lobbyScreen.style.display = 'none';
            document.body.classList.add('in-game'); // Kích hoạt CSS in-game
            
            if (!gameInstance) {
                gameInstance = new GameCore(ui.canvas);
            }
            gameInstance.start();
        });
    }

    // TUTORIAL
    const btnTutorial = document.getElementById('btn-tutorial');
    if (btnTutorial) {
        btnTutorial.addEventListener('click', () => {
            const modal = document.getElementById('modal-tutorial');
            if(modal) modal.classList.remove('hidden');
        });
    }

    // IN-GAME CONTROLS (Pause, Resume, Restart, Quit)
    const btnPause = document.getElementById('btn-pause-game');
    if (btnPause) btnPause.addEventListener('click', () => { if(gameInstance) gameInstance.togglePause(); });

    const btnResume = document.getElementById('btn-resume');
    if (btnResume) btnResume.addEventListener('click', () => { if(gameInstance) gameInstance.togglePause(); });

    const restartAction = () => {
        if(gameInstance) {
            if(ui.modalPause) ui.modalPause.classList.add('hidden');
            if(ui.overlayScreen) ui.overlayScreen.classList.add('hidden');
            gameInstance.isPaused = false;
            gameInstance.start();
        }
    };
    const btnRestart = document.getElementById('btn-restart');
    const btnRestartPause = document.getElementById('btn-restart-pause');
    if(btnRestart) btnRestart.addEventListener('click', restartAction);
    if(btnRestartPause) btnRestartPause.addEventListener('click', restartAction);

    // QUIT TO LOBBY
    const backToLobbyAction = () => {
        if(ui.modalPause) ui.modalPause.classList.add('hidden');
        if(ui.overlayScreen) ui.overlayScreen.classList.add('hidden');
        if(ui.bottomToolbar) ui.bottomToolbar.classList.add('hidden');
        if(ui.gameHeader) ui.gameHeader.style.display = 'none';

        // Hiện lại Lobby
        document.body.classList.remove('in-game');
        if(ui.lobbyScreen) ui.lobbyScreen.style.display = 'flex';
        
        if (gameInstance) {
            gameInstance.isPaused = true; 
            cancelAnimationFrame(gameInstance.animationId);
        }
        // Reload để refresh trạng thái sạch sẽ
        window.location.reload();
    };

    const btnQuitLobby = document.getElementById('btn-quit-lobby');
    const btnBackLobby = document.getElementById('btn-back-lobby');
    if(btnQuitLobby) btnQuitLobby.addEventListener('click', backToLobbyAction);
    if(btnBackLobby) btnBackLobby.addEventListener('click', backToLobbyAction);

    window.closeModal = (id) => {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('hidden');
    };
}