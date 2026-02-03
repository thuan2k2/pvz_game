import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { 
    doc, onSnapshot, collection, query, orderBy, limit, getDocs, where 
} from "firebase/firestore"; 
import { buyShopItemWithLog, toggleItemStatus } from "./firebase/auth.js"; 

// Biến toàn cục
let SHOP_ITEMS = [];
let currentUser = null;
let userData = {}; 

// DOM Elements
const vnCoinEl = document.getElementById('user-vncoin');
const gameCoinEl = document.getElementById('user-coin');
const gridEl = document.getElementById('shop-grid');
const loadingEl = document.getElementById('loading');

// 1. Lắng nghe dữ liệu SHOP (Real-time)
const qShop = query(collection(db, "shop_items"), orderBy("price", "asc"));
onSnapshot(qShop, (snapshot) => {
    SHOP_ITEMS = [];
    snapshot.forEach((doc) => {
        SHOP_ITEMS.push({ id: doc.id, ...doc.data() });
    });
    
    // Vẽ lại nếu đang ở tab shop
    if(currentUser) {
        const activeTab = document.querySelector('.shop-section.active');
        if(activeTab && activeTab.id === 'section-vncoin') renderShopByType('vncoin');
        if(activeTab && activeTab.id === 'section-coin') renderShopByType('coin');
    }
});

// 2. Lắng nghe User Realtime
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                userData = doc.data(); 
                
                vnCoinEl.innerText = (userData.vn_coin || 0).toLocaleString();
                gameCoinEl.innerText = (userData.coins || 0).toLocaleString();
                
                // Vẽ lại màn hình hiện tại
                const activeTab = document.querySelector('.shop-section.active');
                if(activeTab) {
                    if (activeTab.id === 'section-vncoin') renderShopByType('vncoin');
                    else if (activeTab.id === 'section-coin') renderShopByType('coin');
                    else if (activeTab.id === 'section-inventory') renderInventory();
                    else if (activeTab.id === 'section-deposit') renderDeposit();
                    else if (activeTab.id === 'section-deposit-history') renderDepositHistory(); // [MỚI]
                } else {
                    renderShopByType('vncoin');
                }
            }
        });
    } else {
        window.location.href = "login.html";
    }
});

// [MỚI] RENDER LỊCH SỬ NẠP TIỀN
window.renderDepositHistory = async function() {
    const tbody = document.getElementById('deposit-history-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Đang tải dữ liệu...</td></tr>';

    if (!currentUser) return;

    try {
        // Query tìm các giao dịch nạp tiền (DEPOSIT_SEPAY)
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
                    <td class="status-success">Thành công</td>
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

// 3. Render Shop
window.renderShopByType = function(type) {
    const gridEl = document.getElementById(`grid-${type}`);
    gridEl.innerHTML = "";
    
    const filteredItems = SHOP_ITEMS.filter(item => item.shopType === type);
    
    if (filteredItems.length === 0) {
        gridEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #7f8c8d;">Đang cập nhật...</div>';
        return;
    }

    filteredItems.forEach(item => {
        const userBalance = item.currency === "VNCoin" ? (userData.vn_coin || 0) : (userData.coins || 0);
        const canBuy = userBalance >= parseInt(item.price);
        const imgUrl = (item.image && item.image.includes('assets/')) ? item.image : 'assets/sun.png'; 

        let detailInfo = "";
        if (item.type === 'coin') {
            detailInfo = `<div style="color:#2ecc71; font-size:0.9em;">Nhận: <b>${parseInt(item.value).toLocaleString()} Coin</b></div>`;
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
        const btnStyle = canBuy ? '' : 'background:#7f8c8d; cursor:not-allowed; opacity:0.7;';
        const btnText = canBuy ? 'MUA NGAY' : 'KHÔNG ĐỦ TIỀN';
        const btnAttr = canBuy ? '' : 'disabled';

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
                    <button class="btn-buy" onclick="handleBuy('${item.id}')" style="${btnStyle}" ${btnAttr}>${btnText}</button>
                </div>
            </div>
        `;
        gridEl.appendChild(card);
    });
}

// 4. Render Kho Đồ
window.renderInventory = function() {
    const container = document.getElementById('inventory-container');
    container.innerHTML = "";
    let hasItem = false;

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

    if (userData.inventory && userData.inventory.length > 0) {
        userData.inventory.forEach(code => {
            if (code === 'sun_pack') return;
            hasItem = true;
            container.innerHTML += `
                <div class="inventory-item" style="border-left-color: #9b59b6;">
                    <div style="display:flex; align-items:center;">
                        <div class="inv-icon">🎁</div>
                        <div>
                            <div style="font-weight:bold; font-size:1.2em;">Vật Phẩm: ${code}</div>
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

window.handleToggle = async (itemCode, newState) => {
    if (!currentUser) return;
    await toggleItemStatus(currentUser.uid, itemCode, newState);
};

// 5. Render Lịch Sử MUA HÀNG (Cũ)
window.renderHistory = async function() {
    const tbody = document.getElementById('history-body');
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
            const itemName = data.note.replace('Mua: ', '').replace('Mua vật phẩm: ', '');

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

// 6. Xử lý Mua Hàng
window.handleBuy = async (itemId) => {
    if (!currentUser) return;
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    if (!confirm(`Xác nhận mua "${item.name}"?`)) return;

    loadingEl.style.display = 'flex';
    const result = await buyShopItemWithLog(currentUser.uid, item);
    loadingEl.style.display = 'none';

    if (result.success) {
        alert("✅ Mua thành công! Kiểm tra Kho Đồ.");
    } else {
        alert("❌ Lỗi: " + result.message);
    }
};