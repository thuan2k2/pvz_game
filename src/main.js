import { monitorAuthState, logoutUser, listenToUserData, getSystemConfig, addUserCoins, callBuyItem } from './firebase/auth.js';
import { auth, db } from './firebase/config.js'; 
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; 
import { GameCore } from './game/GameCore.js';
import { loadImages } from './game/Resources.js';

const ui = {
    greeting: document.getElementById('user-greeting'),
    balance: document.getElementById('user-balance'),
    btnOpenAuth: document.getElementById('btn-open-auth-menu'), // Nút Mở Menu Đăng nhập
    btnLogoutLobby: document.getElementById('btn-lobby-logout'), // Nút Đăng xuất Sảnh
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
    userRole: null, // null = chưa chọn, 'guest' = khách, 'user'/'admin' = đã login
    config: null,
    isGuestActive: false // Cờ đánh dấu khách đã bấm "Chơi ngay"
};

// --- 1. LOGIC AUTH & REALTIME UPDATE ---
monitorAuthState(async (user) => {
    
    // Lắng nghe Config hệ thống (nhưng chưa xử lý hiển thị nếu chưa active)
    if (!unsubscribeSystem) {
        unsubscribeSystem = onSnapshot(doc(db, "system_config", "general"), (docSnap) => {
            if (docSnap.exists()) {
                currentState.config = docSnap.data();
                // Chỉ check khi đã xác định danh tính (User login hoặc Khách đã bấm chơi)
                if (user || currentState.isGuestActive) {
                    checkMaintenanceAndKick(); 
                    updateNotificationUI();
                }
            }
        });
    }

    if (user) {
        // --- TRƯỜNG HỢP: ĐÃ ĐĂNG NHẬP ---
        console.log("User đã login:", user.email);
        currentState.isGuestActive = false; // Không phải khách

        // UI: Ẩn nút "Đăng nhập", Hiện nút "Đăng xuất"
        ui.btnOpenAuth.classList.add('hidden');
        ui.btnLogoutLobby.classList.remove('hidden');
        enableStartGameBtn(); // Mở khóa nút chơi

        if (unsubscribeUser) unsubscribeUser();
        
        unsubscribeUser = listenToUserData(user.uid, async (userData) => {
            if (!userData) return;

            currentState.userRole = userData.role || 'user';
            
            checkMaintenanceAndKick();
            updateNotificationUI(); // Hiện thông báo chạy

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
            updateUserUI(userData.email, safeCoins, userData.role);
        });

    } else {
        // --- TRƯỜNG HỢP: CHƯA ĐĂNG NHẬP (MỚI VÀO WEB) ---
        console.log("Chưa đăng nhập / Đang chờ chọn chế độ");
        
        if (unsubscribeUser) unsubscribeUser();
        
        // UI: Hiện nút "Đăng nhập", Ẩn nút "Đăng xuất"
        ui.btnOpenAuth.classList.remove('hidden');
        ui.btnLogoutLobby.classList.add('hidden');
        
        // Ẩn thông tin user
        if (ui.lobbyUserInfo) ui.lobbyUserInfo.classList.add('hidden');
        
        // Reset role
        currentState.userRole = null;

        // Nếu chưa kích hoạt chế độ Khách -> Không làm gì cả (không hiện thông báo, không check bảo trì)
        if (!currentState.isGuestActive) {
            disableStartGameBtn(); // Khóa nút chơi
            ui.notifBar.style.display = 'none'; // Ẩn thanh thông báo
        } else {
            // Nếu ĐÃ kích hoạt chế độ Khách (sau khi bấm nút trong Modal)
            activeGuestMode();
        }
    }

    initGame();
});

// --- HÀM KÍCH HOẠT CHẾ ĐỘ KHÁCH ---
function activeGuestMode() {
    console.log("Kích hoạt chế độ Khách");
    currentState.userRole = 'guest';
    currentState.isGuestActive = true;

    // UI Khách
    ui.greeting.textContent = "Khách";
    const shopCoinEl = document.getElementById('shop-coin');
    if (shopCoinEl) shopCoinEl.textContent = "0";
    
    // UI ở sảnh (Giữ nút Đăng nhập để họ có thể đăng ký sau này)
    ui.btnOpenAuth.classList.remove('hidden'); 
    ui.btnLogoutLobby.classList.add('hidden');

    enableStartGameBtn(); // Mở khóa nút chơi

    // Bắt đầu check bảo trì và hiện thông báo
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

    // Chỉ check khi đã có role (Khách hoặc User)
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
                await logoutUser(); // Nếu là user thì logout
            }
            window.location.reload(); 
        } else {
            // Không hiện alert đếm ngược nữa, chỉ hiện trên thanh chạy chữ
        }
    };

    performCheck();
    maintenanceInterval = setInterval(performCheck, 1000);
}

// --- 3. HÀM CẬP NHẬT GIAO DIỆN THÔNG BÁO CHẠY ---
function updateNotificationUI() {
    const config = currentState.config;
    // Chỉ hiện khi đã xác định danh tính
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
        ui.notifText.textContent = messageParts.join("   |   ");
        ui.notifBar.style.display = 'flex';
        document.body.classList.add('has-notification');
    } else {
        ui.notifBar.style.display = 'none';
        document.body.classList.remove('has-notification');
    }
}

// --- CÁC HÀM UI PHỤ TRỢ ---
function updateUserUI(email, coins, role) {
    ui.greeting.textContent = `Hi, ${email}`;
    ui.balance.textContent = `💰 ${coins}`;
    ui.balance.classList.remove('hidden');

    if (ui.lobbyUserInfo) {
        ui.lobbyUserInfo.classList.remove('hidden'); 
        if(ui.lobbyEmail) ui.lobbyEmail.textContent = email;
        if(ui.lobbyBalance) ui.lobbyBalance.textContent = `💰 ${coins} Coin`;
    }

    const shopCoinEl = document.getElementById('shop-coin');
    if (shopCoinEl) shopCoinEl.textContent = coins;

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

    // ==========================================
    // SỰ KIỆN ĐĂNG NHẬP / ĐĂNG XUẤT / MENU AUTH
    // ==========================================
    
    // Nút "Đăng nhập" ở sảnh -> Mở Modal Chọn
    if (ui.btnOpenAuth) {
        ui.btnOpenAuth.addEventListener('click', () => {
            document.getElementById('modal-auth-selection').classList.remove('hidden');
        });
    }

    // Nút "Đăng xuất" ở sảnh (chỉ hiện khi đã login)
    if (ui.btnLogoutLobby) {
        ui.btnLogoutLobby.addEventListener('click', async () => {
            if (confirm("Đăng xuất khỏi hệ thống?")) {
                await signOut(auth);
                window.location.reload(); 
            }
        });
    }

    // Nút "Chơi Ngay (Khách)" trong Modal
    const btnPlayGuest = document.getElementById('btn-play-guest');
    if (btnPlayGuest) {
        btnPlayGuest.addEventListener('click', () => {
            closeModal('modal-auth-selection');
            activeGuestMode(); // Kích hoạt chế độ khách
        });
    }

    // ==========================================
    // B. SỰ KIỆN SẢNH CHỜ
    // ==========================================
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            // Kiểm tra lần cuối
            if (!auth.currentUser && !currentState.isGuestActive) {
                alert("Vui lòng đăng nhập hoặc chọn chế độ Khách!");
                return;
            }
            document.getElementById('lobby-screen').classList.add('hidden');
            game.start();
        });
    }

    const btnShop = document.getElementById('btn-shop');
    if (btnShop) {
        btnShop.addEventListener('click', () => {
            document.getElementById('modal-shop').classList.remove('hidden');
            
            const btn = document.querySelector('#item-sun-pack .buy-btn');
            const card = document.querySelector('#item-sun-pack');
            
            if (btn && card) {
                if (localStorage.getItem('buff_sun_pack')) {
                    btn.textContent = "Đã trang bị";
                    btn.style.background = "#95a5a6";
                    btn.disabled = true;
                    card.classList.add('purchased');
                } else {
                    btn.innerHTML = "Mua 200 💰";
                    btn.style.background = ""; 
                    btn.disabled = false;
                    card.classList.remove('purchased');
                }
            }
        });
    }

    const btnTutorial = document.getElementById('btn-tutorial');
    if (btnTutorial) {
        btnTutorial.addEventListener('click', () => {
            document.getElementById('modal-tutorial').classList.remove('hidden');
        });
    }

    // ==========================================
    // C. SỰ KIỆN GAME & PAUSE
    // ==========================================
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

    window.buyItem = async (itemId, price) => {
        const user = auth.currentUser;
        if (!user) {
            alert("Vui lòng đăng nhập!");
            return;
        }
        const currentBalance = parseInt(document.getElementById('shop-coin').textContent) || 0;
        if (currentBalance < price) {
            alert("Bạn không đủ Coin!");
            return;
        }
        if (itemId === 'plant_food') {
             if (confirm(`Xác nhận mua 1 Thuốc Tăng Lực với giá ${price} Coin?`)) {
                try {
                    const data = await callBuyItem(itemId);
                    if (data && data.success) {
                        let currentCount = parseInt(localStorage.getItem('item_plant_food_count') || 0);
                        currentCount++;
                        localStorage.setItem('item_plant_food_count', currentCount);
                        alert(`Mua thành công! Bạn hiện có ${currentCount} Thuốc Tăng Lực.`);
                    }
                } catch (error) {
                    alert("Lỗi giao dịch: " + error.message);
                }
            }
            return; 
        }
        if (localStorage.getItem('buff_' + itemId)) {
            alert("Bạn đã trang bị vật phẩm này rồi!");
            return;
        }
        if (confirm(`Xác nhận mua với giá ${price} Coin?`)) {
            try {
                const data = await callBuyItem(itemId);
                if (data && data.success) {
                    localStorage.setItem('buff_' + itemId, 'true');
                    const btn = document.querySelector(`#item-${itemId.replace('_', '-')} .buy-btn`);
                    if(btn) {
                        btn.textContent = "Đã trang bị";
                        btn.parentElement.parentElement.classList.add('purchased');
                    }
                    alert("Mua thành công! Vào game ngay để sử dụng.");
                }
            } catch (error) {
                alert("Lỗi giao dịch: " + error.message);
            }
        }
    };
}