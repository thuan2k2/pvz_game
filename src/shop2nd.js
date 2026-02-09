// file: src/shop.js
import { auth, db } from "./firebase/config.js"; // [ĐÃ SỬA] Bỏ import database
import { onAuthStateChanged } from "firebase/auth";
import { 
    doc, onSnapshot, collection, query, orderBy, limit, getDocs, where 
} from "firebase/firestore"; 
import { buyShopItemWithLog, toggleItemStatus, useBigSpenderCard } from "./firebase/auth.js"; 

// Biến toàn cục
let SHOP_ITEMS = [];       // Shop thủ công (Admin tạo từ Firestore)
let GAME_DATA_ITEMS = [];  // Shop tự động (Cây trồng từ Firestore game_data)
let currentUser = null;
let userData = {}; 

// DOM Elements
const vnCoinEl = document.getElementById('user-vncoin');
const gameCoinEl = document.getElementById('user-coin');
const loadingEl = document.getElementById('loading');

// ============================================================
// 1. LẮNG NGHE DỮ LIỆU TỪ FIRESTORE (2 NGUỒN)
// ============================================================

// A. Lắng nghe Shop Vật Phẩm (collection: shop_items)
const qShop = query(collection(db, "shop_items"), orderBy("price", "asc"));
onSnapshot(qShop, (snapshot) => {
    SHOP_ITEMS = [];
    snapshot.forEach((doc) => {
        SHOP_ITEMS.push({ id: doc.id, ...doc.data() });
    });
    // Vẽ lại giao diện nếu đang ở tab shop
    refreshActiveTab();
});

// B. [ĐÃ SỬA] Lắng nghe Shop Cây Trồng (collection: game_data)
// Chuyển từ Realtime Database sang Firestore để đồng bộ với Admin
const qGameData = query(collection(db, "game_data"));
onSnapshot(qGameData, (snapshot) => {
    GAME_DATA_ITEMS = [];
    snapshot.forEach((doc) => {
        const plant = doc.data();
        
        // Chỉ lấy item là Cây (plants) và có giá tiền
        if ((!plant.type || plant.type === 'plants') && plant.price) {
            GAME_DATA_ITEMS.push({
                id: doc.id,                 // ID document (vd: peashooter)
                type: 'plant_card',         // Đánh dấu là thẻ cây
                name: plant.name,
                price: parseInt(plant.price) || 0,
                currency: 'Coin',           // Mặc định mua bằng Coin
                // Ưu tiên ảnh card, nếu không có lấy ảnh plant
                image: plant.cardImage || plant.plantImage || `assets/card/${doc.id}.png`,
                description: `Sát thương: ${plant.damage || 0} - Tốc độ: ${plant.speed || 0}s`,
                shopType: 'coin',           // Hiển thị ở tab Coin
                originalData: { ...plant, id: doc.id } // Lưu data gốc
            });
        }
    });
    refreshActiveTab();
});

// Hàm tiện ích: Vẽ lại tab đang mở khi có dữ liệu mới
function refreshActiveTab() {
    if(currentUser) {
        const activeTab = document.querySelector('.shop-section.active');
        if(activeTab) {
            if(activeTab.id === 'section-vncoin') renderShopByType('vncoin');
            if(activeTab.id === 'section-coin') renderShopByType('coin');
        }
    }
}

// 2. Lắng nghe User Realtime
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                userData = doc.data(); 
                
                // Cập nhật số dư trên Header
                if(vnCoinEl) vnCoinEl.innerText = (userData.vn_coin || 0).toLocaleString();
                if(gameCoinEl) gameCoinEl.innerText = (userData.coins || 0).toLocaleString();
                
                // Vẽ lại tab hiện tại
                const activeTab = document.querySelector('.shop-section.active');
                if(activeTab) {
                    if (activeTab.id === 'section-vncoin') renderShopByType('vncoin');
                    else if (activeTab.id === 'section-coin') renderShopByType('coin');
                    else if (activeTab.id === 'section-inventory') renderInventory();
                    else if (activeTab.id === 'section-deposit') renderDeposit();
                    else if (activeTab.id === 'section-deposit-history') renderDepositHistory();
                } else {
                    renderShopByType('vncoin'); // Mặc định mở tab VNCoin
                }
            }
        });
    } else {
        window.location.href = "login.html";
    }
});

// ============================================================
// 3. CÁC HÀM RENDER GIAO DIỆN
// ============================================================

// RENDER LỊCH SỬ NẠP TIỀN
window.renderDepositHistory = async function() {
    const tbody = document.getElementById('deposit-history-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Đang tải dữ liệu...</td></tr>';

    if (!currentUser) return;

    try {
        const q = query(
            collection(db, "transactions_history"),
            where("uid", "==", currentUser.uid),
            where("type", "==", "DEPOSIT_SEPAY"), 
            orderBy("timestamp", "desc"),
            limit(20)
        );
        
        const snapshot = await getDocs(q);
        tbody.innerHTML = "";

        if(snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#bdc3c7;">Chưa có giao dịch nạp tiền nào.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString('vi-VN') : 'N/A';
            const note = data.note || "Nạp tiền qua SePay";
            
            tbody.innerHTML += `
                <tr>
                    <td style="color:#bdc3c7; font-size:0.9em;">${date}</td>
                    <td style="color:#f1c40f; font-weight:bold;">+${parseInt(data.amount).toLocaleString()}</td>
                    <td>${note}</td>
                    <td class="status-success" style="color:#2ecc71;">Thành công</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Lỗi tải dữ liệu (Vui lòng báo Admin tạo Index).</td></tr>';
    }
}

// HÀM RENDER NẠP TIỀN (SEPAY)
window.renderDeposit = function() {
    const container = document.getElementById('deposit-container');
    if (!container) return;
    if (!currentUser) {
        container.innerHTML = '<p style="text-align:center; color:red;">Vui lòng đăng nhập để nạp tiền.</p>';
        return;
    }

    const BANK_BIN = "970423"; 
    const BANK_ACC = "00006464313"; 
    const ACCOUNT_NAME = "PHAM DUC THUAN"; 
    const AMOUNT = 0; 
    const TRANSFER_CONTENT = `NAP ${currentUser.uid}`; 

    const qrSrc = `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACC}-compact2.png?amount=${AMOUNT}&addInfo=${encodeURIComponent(TRANSFER_CONTENT)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; color:white; padding:20px;">
            <h2 style="color:#e67e22; margin-bottom:20px; text-transform: uppercase;">Nạp VNCoin Tự Động</h2>
            
            <div style="background:white; padding:15px; border-radius:10px; margin-bottom:20px; box-shadow: 0 0 15px rgba(230, 126, 34, 0.5);">
                <img src="${qrSrc}" alt="QR Code" style="width:250px; height:250px; object-fit:contain;">
            </div>

            <div style="background:rgba(0,0,0,0.6); padding:20px; border-radius:10px; width:100%; max-width:600px; border: 1px solid #e67e22;">
                <p style="text-align:center; font-size:1.1em; margin-bottom:15px;">
                    ⚠️ <strong>LƯU Ý QUAN TRỌNG:</strong>
                </p>
                <ul style="margin-left:20px; margin-bottom:20px; line-height:1.8; color:#ddd;">
                    <li>Hệ thống tự động cộng tiền sau <strong>1 - 3 phút</strong>.</li>
                    <li>Tỷ lệ nạp: <strong>1.000 VNĐ = 1.000 VNCoin</strong>.</li>
                    <li>Nếu sau 10 phút chưa nhận được, vui lòng liên hệ Admin.</li>
                </ul>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:20px;">
                    <div>🏦 Ngân hàng: <strong style="color:#2ecc71;">TPBank</strong></div>
                    <div>💳 Số tài khoản: <strong style="color:#2ecc71;">${BANK_ACC}</strong></div>
                    <div style="grid-column: 1/-1;">👤 Chủ tài khoản: <strong>${ACCOUNT_NAME}</strong></div>
                </div>
                
                <div style="margin-top:20px; padding:15px; background:#c0392b; border-radius:8px; text-align:center;">
                    <span style="display:block; font-size:0.9em; margin-bottom:5px; color:#fff;">NỘI DUNG CHUYỂN KHOẢN (BẮT BUỘC):</span>
                    <div style="display:flex; justify-content:center; align-items:center; gap:10px;">
                        <strong style="font-size:1.5em; color:#fff; letter-spacing:1px; user-select:all;">${TRANSFER_CONTENT}</strong>
                        <button onclick="navigator.clipboard.writeText('${TRANSFER_CONTENT}'); alert('Đã copy nội dung!');" 
                            style="cursor:pointer; padding:5px 10px; border:none; background:white; color:#c0392b; border-radius:4px; font-weight:bold;">
                            COPY
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// [MỚI - CẬP NHẬT] Render Shop (Gộp chung Shop Thủ Công + Shop Cây Trồng)
window.renderShopByType = function(type) {
    const gridEl = document.getElementById(`grid-${type}`);
    if (!gridEl) return;
    gridEl.innerHTML = "";
    
    // Lọc danh sách item cần hiển thị
    let displayItems = [];

    if (type === 'vncoin') {
        // Tab VNCoin: Chỉ hiện đồ Admin bán bằng VNCoin
        displayItems = SHOP_ITEMS.filter(item => item.shopType === 'vncoin');
    } else if (type === 'coin') {
        // Tab Coin: Hiện đồ Admin bán bằng Coin + Cây Trồng
        const adminItems = SHOP_ITEMS.filter(item => item.shopType === 'coin');
        // Chỉ thêm cây trồng vào tab Coin
        const plantItems = GAME_DATA_ITEMS.filter(item => item.shopType === 'coin');
        displayItems = [...adminItems, ...plantItems];
    }
    
    if (displayItems.length === 0) {
        gridEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #7f8c8d;">Đang cập nhật...</div>';
        return;
    }

    displayItems.forEach(item => {
        const userBalance = item.currency === "VNCoin" ? (userData.vn_coin || 0) : (userData.coins || 0);
        const canBuy = userBalance >= parseInt(item.price);
        // Nếu là cây trồng (có link ảnh online) thì dùng luôn, còn không thì fallback về ảnh mặc định
        const imgUrl = (item.image && (item.image.startsWith('http') || item.image.includes('assets/'))) ? item.image : 'assets/sun.png'; 

        // Kiểm tra xem đã sở hữu chưa (đối với cây trồng hoặc item unique)
        const inventory = userData.inventory || [];
        const isOwned = inventory.includes(item.id);
        
        let detailInfo = "";
        
        // Logic hiển thị chi tiết
        if (item.type === 'coin') {
            detailInfo = `<div style="color:#2ecc71; font-size:0.9em;">Nhận: <b>${parseInt(item.value).toLocaleString()} Coin</b></div>`;
        } else if (item.type === 'plant_card') {
            detailInfo = `<div style="color:#3498db; font-size:0.8em; font-style:italic;">${item.description}</div>`;
        } else if (item.itemCode === 'plant_food') {
            detailInfo = `<div style="color:#27ae60; font-size:0.9em;">Số lượng: <b>${item.amount || 1} bình</b></div>`;
        } else if (item.itemCode === 'sun_pack') {
            if (item.duration && item.duration !== 99999) {
                detailInfo = `<div style="color:#e67e22; font-size:0.9em;">Thời hạn: <b>${item.duration} Ngày</b></div>`;
            } else {
                detailInfo = `<div style="color:#f1c40f; font-size:0.9em;">Thời hạn: <b>Vĩnh viễn</b></div>`;
            }
        }

        const card = document.createElement('div');
        card.className = "product-card";
        
        // CSS cho nút mua
        let btnStyle = canBuy ? '' : 'background:#7f8c8d; cursor:not-allowed; opacity:0.7;';
        let btnText = canBuy ? 'MUA NGAY' : 'KHÔNG ĐỦ';
        let btnAttr = canBuy ? '' : 'disabled';
        let buyAction = `handleBuy('${item.id}')`; 

        // Nếu đã sở hữu cây -> disable nút
        if (item.type === 'plant_card' && isOwned) {
            btnText = "ĐÃ SỞ HỮU";
            btnStyle = 'background:#27ae60; cursor:default;';
            btnAttr = 'disabled';
        } else if (item.type === 'plant_card') {
            buyAction = `handleBuyPlant('${item.id}', ${item.price})`;
        }

        card.innerHTML = `
            ${item.isHot ? '<span class="badge-hot">HOT</span>' : ''}
            <div class="product-img"><img src="${imgUrl}" style="width:100px; height:100px; object-fit:contain;"></div>
            <div class="product-info">
                <div>
                    <div class="product-name">${item.name}</div>
                    ${detailInfo} 
                    <div class="product-desc" style="margin-top:5px;">${item.description || ''}</div>
                </div>
                <div>
                    <div class="price-tag">${parseInt(item.price).toLocaleString()} ${item.currency}</div>
                    <button class="btn-buy" onclick="${buyAction}" style="${btnStyle}" ${btnAttr}>${btnText}</button>
                </div>
            </div>
        `;
        gridEl.appendChild(card);
    });
}

// 4. Render Kho Đồ
window.renderInventory = function() {
    const container = document.getElementById('inventory-container');
    if (!container) return;
    container.innerHTML = "";
    let hasItem = false;

    // A. Plant Food
    const plantFoodCount = userData.item_plant_food_count || 0;
    if (plantFoodCount > 0) {
        hasItem = true;
        container.innerHTML += `
            <div class="inventory-item">
                <div style="display:flex; align-items:center;">
                    <div class="inv-icon">🍃</div>
                    <div>
                        <div style="font-weight:bold; font-size:1.2em;">Thuốc Tăng Lực</div>
                        <div style="color:#bdc3c7; font-size:0.9em;">SL: <b>${plantFoodCount}</b></div>
                    </div>
                </div>
                <div class="inv-count">Sẵn sàng</div>
            </div>
        `;
    }

    // B. Thẻ Đại Gia Tiêu Sản (item_broadcast_count)
    const broadcastCount = userData.item_broadcast_count || 0;
    if (broadcastCount > 0) {
        hasItem = true;
        container.innerHTML += `
            <div class="inventory-item" style="border-left-color: #e74c3c; background: linear-gradient(45deg, #34495e, #4a235a);">
                <div style="display:flex; align-items:center;">
                    <div class="inv-icon">📢</div>
                    <div>
                        <div style="font-weight:bold; font-size:1.2em; color:#f1c40f;">Thẻ Đại Gia Tiêu Sản</div>
                        <div style="color:#bdc3c7; font-size:0.9em;">SL: <b>${broadcastCount}</b> - Thông báo toàn Server</div>
                    </div>
                </div>
                <button onclick="handleUseBroadcast()" 
                    style="background:#e74c3c; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; min-width: 80px; box-shadow: 0 0 10px #e74c3c;">
                    SỬ DỤNG
                </button>
            </div>
        `;
    }

    // C. Sun Pack
    let sunPackStatus = null;
    if (userData.inventory && userData.inventory.includes('sun_pack')) {
        sunPackStatus = 'perm';
    } else if (userData.temp_items && userData.temp_items.sun_pack) {
        sunPackStatus = userData.temp_items.sun_pack.toDate();
    }

    if (sunPackStatus) {
        hasItem = true;
        const isActive = userData.item_settings && userData.item_settings.sun_pack !== false; 
        const btnColor = isActive ? '#c0392b' : '#27ae60';
        const btnText = isActive ? 'TẮT' : 'BẬT';
        
        let timeText = "";
        let isExpired = false;

        if (sunPackStatus === 'perm') {
            timeText = "Thời hạn: Vĩnh viễn";
        } else {
            const now = new Date();
            const diff = sunPackStatus - now;
            if (diff > 0) {
                const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                timeText = `Hết hạn: ${sunPackStatus.toLocaleDateString()} (${daysLeft} ngày)`;
            } else {
                timeText = "Đã hết hạn";
                isExpired = true;
            }
        }

        if (!isExpired) {
            container.innerHTML += `
                <div class="inventory-item" style="border-left-color: #f1c40f;">
                    <div style="display:flex;align-items:center;">
                        <div class="inv-icon">☀️</div>
                        <div>
                            <div style="font-weight:bold; font-size:1.2em;">Gói Mặt Trời</div>
                            <div style="color:#bdc3c7;font-size:0.9em;">${timeText}</div>
                        </div>
                    </div>
                    <button onclick="handleToggle('sun_pack', ${!isActive})" 
                        style="background:${btnColor}; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; min-width: 80px;">
                        ${btnText}
                    </button>
                </div>
            `;
        }
    }

    // D. Các item khác
    if (userData.inventory && userData.inventory.length > 0) {
        userData.inventory.forEach(code => {
            if (code === 'sun_pack') return;
            // Tìm tên cây nếu là code cây
            const plantInfo = GAME_DATA_ITEMS.find(p => p.id === code);
            const itemName = plantInfo ? "Cây: " + plantInfo.name : "Vật Phẩm: " + code;
            
            hasItem = true;
            container.innerHTML += `
                <div class="inventory-item" style="border-left-color: #9b59b6;">
                    <div style="display:flex; align-items:center;">
                        <div class="inv-icon">🎁</div>
                        <div>
                            <div style="font-weight:bold; font-size:1.2em;">${itemName}</div>
                            <div style="color:#bdc3c7; font-size:0.9em;">Đã sở hữu vĩnh viễn</div>
                        </div>
                    </div>
                    <div class="inv-count">✔</div>
                </div>
            `;
        });
    }

    if (!hasItem) container.innerHTML = '<div style="text-align:center; padding:50px; color:#7f8c8d;">Túi đồ trống rỗng... Hãy mua sắm đi!</div>';
}

// ============================================================
// 4. XỬ LÝ HÀNH ĐỘNG NGƯỜI DÙNG (MUA, SỬ DỤNG)
// ============================================================

window.handleUseBroadcast = async () => {
    if (!currentUser) return;
    if (!confirm("Bạn muốn dùng Thẻ Đại Gia để thông báo cho cả Server biết độ chịu chơi của mình chứ?")) return;

    if (loadingEl) loadingEl.style.display = 'flex';
    const result = await useBigSpenderCard(currentUser.uid, userData.email);
    if (loadingEl) loadingEl.style.display = 'none';

    if (result.success) {
        alert("📢 Đã phát loa thông báo toàn Server!");
    } else {
        alert("Lỗi: " + result.message);
    }
};

window.handleToggle = async (itemCode, newState) => {
    if (!currentUser) return;
    await toggleItemStatus(currentUser.uid, itemCode, newState);
};

window.renderHistory = async function() {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Đang tải dữ liệu...</td></tr>';

    try {
        const q = query(
            collection(db, "transactions_history"),
            where("uid", "==", currentUser.uid),
            where("type", "==", "BUY_SHOP"),
            orderBy("timestamp", "desc"),
            limit(20)
        );
        
        const snapshot = await getDocs(q);
        tbody.innerHTML = "";

        if(snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Chưa có giao dịch nào.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString('vi-VN') : 'N/A';
            const priceColor = data.assetType === 'VNCoin' ? '#f1c40f' : '#2ecc71';
            const itemName = data.note ? data.note.replace('Mua: ', '').replace('Mua vật phẩm: ', '') : 'Vật phẩm';

            tbody.innerHTML += `
                <tr>
                    <td style="color:#bdc3c7; font-size:0.9em;">${date}</td>
                    <td style="font-weight:bold;">${itemName}</td>
                    <td style="color:${priceColor}; font-weight:bold;">${Math.abs(data.amount).toLocaleString()} ${data.assetType}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">Cần tạo Index trên Firestore để xem lịch sử.</td></tr>';
    }
}

// 6. Xử lý Mua Hàng (Vật phẩm thường)
window.handleBuy = async (itemId) => {
    if (!currentUser) return;
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    if (!confirm(`Xác nhận mua "${item.name}"?`)) return;

    if (loadingEl) loadingEl.style.display = 'flex';
    const result = await buyShopItemWithLog(currentUser.uid, item);
    if (loadingEl) loadingEl.style.display = 'none';

    if (result.success) {
        alert("✅ Mua thành công! Kiểm tra Kho Đồ.");
    } else {
        alert("❌ Lỗi: " + result.message);
    }
};

// [ĐÃ SỬA] Hàm xử lý mua Cây Trồng
window.handleBuyPlant = async (plantId, price) => {
    if (!currentUser) return;
    // Tìm thông tin cây trong danh sách đã tải
    const item = GAME_DATA_ITEMS.find(i => i.id === plantId);
    if (!item) return alert("Không tìm thấy thông tin cây!");

    if (!confirm(`Bạn muốn mở khóa cây "${item.name}" với giá ${price} Coin?`)) return;

    if (loadingEl) loadingEl.style.display = 'flex';
    
    // Tạo object dữ liệu để gửi hàm mua
    const buyData = {
        id: plantId,
        name: item.name,
        price: price,
        currency: 'Coin',
        type: 'plant', // Đánh dấu là cây để server (hoặc logic mua) biết
        shopType: 'coin'
    };

    const result = await buyShopItemWithLog(currentUser.uid, buyData);
    
    if (loadingEl) loadingEl.style.display = 'none';

    if (result.success) {
        alert(`✅ Chúc mừng! Bạn đã mở khóa ${item.name}. Hãy vào game để sử dụng.`);
    } else {
        alert("❌ Lỗi: " + result.message);
    }
};