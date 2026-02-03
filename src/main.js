import { monitorAuthState, logoutUser, listenToUserData } from './firebase/auth.js';
import { auth, db } from './firebase/config.js'; 
import { signOut } from 'firebase/auth';
// [CẬP NHẬT] Thêm các hàm query Firestore cần thiết
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore'; 
import { GameCore } from './game/GameCore.js';
import { loadImages } from './game/Resources.js';

const ui = {
    greeting: document.getElementById('user-greeting'),
    balance: document.getElementById('user-balance'),
    btnOpenAuth: document.getElementById('btn-open-auth-menu'), 
    btnLogoutLobby: document.getElementById('btn-lobby-logout'), 
    btnAdmin: document.getElementById('btn-admin'),
    canvas: document.getElementById('game-canvas'),
    
    lobbyUserInfo: document.getElementById('lobby-user-info'),
    lobbyEmail: document.getElementById('lobby-email'),
    lobbyBalance: document.getElementById('lobby-balance'),

    notifBar: document.getElementById('notification-bar'),
    notifText: document.getElementById('notification-text'),
    btnStartGame: document.getElementById('btn-start-game')
};

// --- BIẾN TOÀN CỤC ---
let unsubscribeUser = null;
let unsubscribeSystem = null; 
let maintenanceInterval = null; 

let currentState = {
    userRole: null, 
    config: null,
    isGuestActive: false 
};

// --- 1. LOGIC AUTH & REALTIME UPDATE ---
monitorAuthState(async (user) => {
    
    // [MỚI] LẮNG NGHE THÔNG BÁO ĐẠI GIA (SERVER BROADCAST)
    // Lấy tin nhắn mới nhất
    const qBroadcast = query(collection(db, "server_broadcasts"), orderBy("timestamp", "desc"), limit(1));
    onSnapshot(qBroadcast, (snapshot) => {
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            // Chỉ hiện nếu tin nhắn mới (trong vòng 15 giây qua) để tránh hiện lại tin cũ khi F5
            if (data.timestamp) {
                const now = new Date().getTime();
                const msgTime = data.timestamp.toMillis();
                if (now - msgTime < 15000) { 
                    showBigSpenderEffect(data.message);
                }
            }
        }
    });

    // Lắng nghe Config hệ thống
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
        console.log("User đã login:", user.email);
        currentState.isGuestActive = false;

        ui.btnOpenAuth.classList.add('hidden');
        ui.btnLogoutLobby.classList.remove('hidden');
        enableStartGameBtn(); 

        if (unsubscribeUser) unsubscribeUser();
        
        unsubscribeUser = listenToUserData(user.uid, async (userData) => {
            if (!userData) return;

            currentState.userRole = userData.role || 'user';
            
            // [CẬP NHẬT ĐỒNG BỘ DỮ LIỆU]
            localStorage.setItem('item_plant_food_count', userData.item_plant_food_count || 0);
            localStorage.setItem('user_inventory', JSON.stringify(userData.inventory || []));
            
            // Lưu thông tin đồ có hạn (chuyển Timestamp sang millis)
            const tempItems = {};
            if (userData.temp_items) {
                for (const [key, val] of Object.entries(userData.temp_items)) {
                    if(val && val.toDate) tempItems[key] = val.toDate().getTime();
                }
            }
            localStorage.setItem('user_temp_items', JSON.stringify(tempItems));

            // Lưu cài đặt Bật/Tắt
            localStorage.setItem('user_item_settings', JSON.stringify(userData.item_settings || {}));

            checkMaintenanceAndKick();
            updateNotificationUI();

            if (userData.bannedUntil) {
                const banDate = userData.bannedUntil.toDate();
                if (banDate > new Date()) {
                    alert(`⛔ TÀI KHOẢN ĐÃ BỊ KHÓA!\n\nHiệu lực đến: ${banDate.toLocaleDateString('vi-VN')}`);
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
        console.log("Chưa đăng nhập / Đang chờ chọn chế độ");
        
        if (unsubscribeUser) unsubscribeUser();
        
        ui.btnOpenAuth.classList.remove('hidden');
        ui.btnLogoutLobby.classList.add('hidden');
        
        if (ui.lobbyUserInfo) ui.lobbyUserInfo.classList.add('hidden');
        
        currentState.userRole = null;

        if (!currentState.isGuestActive) {
            disableStartGameBtn();
            ui.notifBar.style.display = 'none'; 
        } else {
            activeGuestMode();
        }
    }

    initGame();
});

// [MỚI] HÀM HIỂN THỊ HIỆU ỨNG ĐẠI GIA (CHẠY CHỮ)
function showBigSpenderEffect(message) {
    // Kiểm tra nếu đã có element thì dùng lại, chưa có thì tạo mới
    let marquee = document.getElementById('vip-marquee');
    if (!marquee) {
        marquee = document.createElement('div');
        marquee.id = 'vip-marquee';
        // Style sang chảnh: Gradient đỏ vàng, chữ vàng kim
        marquee.style.cssText = `
            position: fixed; top: 80px; left: 0; width: 100%;
            background: linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(192, 57, 43, 0.9) 20%, rgba(192, 57, 43, 0.9) 80%, rgba(0,0,0,0) 100%);
            color: #f1c40f; font-weight: bold; font-size: 1.8em; text-shadow: 2px 2px 4px #000;
            padding: 15px 0; z-index: 9999; text-align: center;
            white-space: nowrap; pointer-events: none;
            font-family: 'Segoe UI', sans-serif;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        document.body.appendChild(marquee);
    }

    // Nội dung thông báo
    marquee.innerHTML = `📢 💎 VIP ALERT: ${message} 💎`;
    
    // Reset vị trí để bắt đầu chạy
    marquee.style.transition = 'none';
    marquee.style.transform = 'translateX(100%)'; // Bắt đầu từ bên phải ngoài màn hình
    
    // Trigger animation (Chạy từ phải sang trái)
    // Thời gian chạy 12s cho chậm rãi để mọi người kịp đọc
    setTimeout(() => {
        marquee.style.transition = 'transform 12s linear';
        marquee.style.transform = 'translateX(-100%)'; // Chạy sang bên trái ngoài màn hình
    }, 100);
}

// --- HÀM KÍCH HOẠT CHẾ ĐỘ KHÁCH ---
function activeGuestMode() {
    console.log("Kích hoạt chế độ Khách");
    currentState.userRole = 'guest';
    currentState.isGuestActive = true;

    // Reset LocalStorage cho khách
    localStorage.setItem('item_plant_food_count', 0);
    localStorage.setItem('user_inventory', JSON.stringify([]));
    localStorage.setItem('user_temp_items', JSON.stringify({}));
    localStorage.setItem('user_item_settings', JSON.stringify({}));

    ui.greeting.textContent = "Khách";
    
    ui.btnOpenAuth.classList.remove('hidden'); 
    ui.btnLogoutLobby.classList.add('hidden');

    enableStartGameBtn(); 

    checkMaintenanceAndKick();
    updateNotificationUI();
}

// --- LOGIC UI NÚT BẮT ĐẦU ---
function disableStartGameBtn() {
    if(ui.btnStartGame) {
        ui.btnStartGame.disabled = true;
        ui.btnStartGame.style.opacity = "0.5";
        ui.btnStartGame.style.cursor = "not-allowed";
        ui.btnStartGame.textContent = "⛔ Vui lòng Đăng nhập";
    }
}

function enableStartGameBtn() {
    if(ui.btnStartGame) {
        ui.btnStartGame.disabled = false;
        ui.btnStartGame.style.opacity = "1";
        ui.btnStartGame.style.cursor = "pointer";
        ui.btnStartGame.textContent = "🧟 ADVENTURE (Bắt đầu)";
    }
}

// --- 2. HÀM LOGIC BẢO TRÌ & KICK ---
function checkMaintenanceAndKick() {
    if (maintenanceInterval) clearInterval(maintenanceInterval);

    const config = currentState.config;
    const role = currentState.userRole;

    if (!config || !config.maintenance || role === 'admin' || !role) {
        return;
    }

    const endTime = config.maintenance_end_time ? config.maintenance_end_time.toDate().getTime() : 0;
    
    const performCheck = async () => {
        const now = Date.now();
        const timeLeft = endTime - now;

        if (timeLeft <= 0) {
            clearInterval(maintenanceInterval);
            const msg = config.maintenance_message || "Hệ thống bảo trì.";
            alert(`⚠️ BẢO TRÌ HỆ THỐNG\n\n${msg}\n\nĐã đến giờ đóng cửa server.`);
            
            if (auth.currentUser) {
                await logoutUser(); 
            }
            window.location.reload(); 
        }
    };

    performCheck();
    maintenanceInterval = setInterval(performCheck, 1000);
}

// --- 3. HÀM CẬP NHẬT GIAO DIỆN THÔNG BÁO CHẠY ---
function updateNotificationUI() {
    const config = currentState.config;
    if (!config || (!auth.currentUser && !currentState.isGuestActive)) {
        ui.notifBar.style.display = 'none';
        return;
    }

    let messageParts = [];

    if (config.maintenance) {
        const endTime = config.maintenance_end_time ? config.maintenance_end_time.toDate() : null;
        let timeMsg = "";
        
        if (endTime) {
            const timeLeft = Math.floor((endTime.getTime() - Date.now()) / 60000);
            if (timeLeft > 0) {
                timeMsg = `(SERVER ĐÓNG CỬA SAU ${timeLeft} PHÚT)`;
            } else {
                timeMsg = "(ĐANG TIẾN HÀNH)";
            }
        }
        messageParts.push(`⚠️ CẢNH BÁO BẢO TRÌ: ${config.maintenance_message || "Hệ thống sắp bảo trì"} ${timeMsg} - VUI LÒNG THOÁT GAME!`);
    }

    if (config.announcement && config.announcement.trim() !== "") {
        messageParts.push(`📢 THÔNG BÁO: ${config.announcement}`);
    }

    if (messageParts.length > 0) {
        ui.notifText.textContent = messageParts.join("   |   ");
        ui.notifBar.style.display = 'flex';
        document.body.classList.add('has-notification');
    } else {
        ui.notifBar.style.display = 'none';
        document.body.classList.remove('has-notification');
    }
}

// --- CÁC HÀM UI PHỤ TRỢ ---
function updateUserUI(email, coins, vncoin, role) {
    ui.greeting.textContent = `Hi, ${email}`;
    ui.balance.innerHTML = `💰 ${coins.toLocaleString()} | 🟡 ${vncoin.toLocaleString()}`;
    ui.balance.classList.remove('hidden');

    if (ui.lobbyUserInfo) {
        ui.lobbyUserInfo.classList.remove('hidden'); 
        if(ui.lobbyEmail) ui.lobbyEmail.textContent = email;
        if(ui.lobbyBalance) ui.lobbyBalance.innerHTML = `💰 ${coins.toLocaleString()}<br>🟡 ${vncoin.toLocaleString()}`;
    }

    if (role === 'admin') {
        if(ui.btnAdmin) ui.btnAdmin.classList.remove('hidden');
        const btnLobbyAdmin = document.getElementById('btn-lobby-admin');
        if (btnLobbyAdmin) {
            btnLobbyAdmin.classList.remove('hidden');
            btnLobbyAdmin.onclick = () => window.location.href = 'admin.html';
        }
    }
}

// --- 4. HÀM KHỞI TẠO GAME & SỰ KIỆN ---
function initGame() {
    loadImages();

    const ctx = ui.canvas.getContext('2d');
    ui.canvas.width = 1200; 
    ui.canvas.height = 600;

    const game = new GameCore(ui.canvas);

    // SỰ KIỆN AUTH
    if (ui.btnOpenAuth) {
        ui.btnOpenAuth.addEventListener('click', () => {
            document.getElementById('modal-auth-selection').classList.remove('hidden');
        });
    }

    if (ui.btnLogoutLobby) {
        ui.btnLogoutLobby.addEventListener('click', async () => {
            if (confirm("Đăng xuất khỏi hệ thống?")) {
                await signOut(auth);
                window.location.reload(); 
            }
        });
    }

    const btnPlayGuest = document.getElementById('btn-play-guest');
    if (btnPlayGuest) {
        btnPlayGuest.addEventListener('click', () => {
            closeModal('modal-auth-selection');
            activeGuestMode(); 
        });
    }

    // SỰ KIỆN SẢNH CHỜ
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (!auth.currentUser && !currentState.isGuestActive) {
                alert("Vui lòng đăng nhập hoặc chọn chế độ Khách!");
                return;
            }
            document.getElementById('lobby-screen').classList.add('hidden');
            game.start();
        });
    }

    const btnTutorial = document.getElementById('btn-tutorial');
    if (btnTutorial) {
        btnTutorial.addEventListener('click', () => {
            document.getElementById('modal-tutorial').classList.remove('hidden');
        });
    }

    // SỰ KIỆN GAME & PAUSE
    const btnPause = document.getElementById('btn-pause-game');
    if (btnPause) btnPause.addEventListener('click', () => game.togglePause());

    const btnResume = document.getElementById('btn-resume');
    if (btnResume) btnResume.addEventListener('click', () => game.togglePause());

    const btnRestartPause = document.getElementById('btn-restart-pause');
    if (btnRestartPause) {
        btnRestartPause.addEventListener('click', () => {
            game.togglePause();
            game.start();
        });
    }

    const btnQuitLobby = document.getElementById('btn-quit-lobby');
    if (btnQuitLobby) {
        btnQuitLobby.addEventListener('click', () => {
            document.getElementById('modal-pause-menu').classList.add('hidden');
            document.getElementById('bottom-toolbar').classList.add('hidden');
            document.getElementById('btn-pause-game').classList.add('hidden');
            document.getElementById('overlay-screen').classList.add('hidden');
            document.getElementById('lobby-screen').classList.remove('hidden');
            game.isPaused = true; 
            cancelAnimationFrame(game.animationId);
        });
    }

    window.closeModal = (id) => {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('hidden');
    };
}