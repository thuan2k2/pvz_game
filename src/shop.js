import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { 
    doc, onSnapshot, collection, query, orderBy, limit, getDocs, where 
} from "firebase/firestore"; 
import { buyShopItemWithLog } from "./firebase/auth.js";

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
    
    // Nếu user đang online, vẽ lại shop ngay khi Admin thêm/sửa đồ
    if(currentUser) {
        const activeTab = document.querySelector('.shop-section.active');
        if(activeTab && activeTab.id === 'section-vncoin') renderShopByType('vncoin');
        if(activeTab && activeTab.id === 'section-coin') renderShopByType('coin');
    }
});

// 2. Lắng nghe User Realtime (QUAN TRỌNG: FIX LỖI NÚT MUA)
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                userData = doc.data(); // Cập nhật data mới nhất từ Firebase
                
                // Cập nhật số dư trên Header
                vnCoinEl.innerText = (userData.vn_coin || 0).toLocaleString();
                gameCoinEl.innerText = (userData.coins || 0).toLocaleString();
                
                // [FIX] Vẽ lại màn hình hiện tại ngay lập tức để nút Mua cập nhật trạng thái
                const activeTab = document.querySelector('.shop-section.active');
                if(activeTab) {
                    if (activeTab.id === 'section-vncoin') renderShopByType('vncoin');
                    else if (activeTab.id === 'section-coin') renderShopByType('coin');
                    else if (activeTab.id === 'section-inventory') renderInventory();
                } else {
                    // Mặc định lần đầu vào shop
                    renderShopByType('vncoin');
                }
            }
        });
    } else {
        window.location.href = "login.html";
    }
});

// 3. Render Shop (Logic check tiền chuẩn xác)
window.renderShopByType = function(type) {
    const gridEl = document.getElementById(`grid-${type}`);
    gridEl.innerHTML = "";
    
    const filteredItems = SHOP_ITEMS.filter(item => item.shopType === type);
    
    if (filteredItems.length === 0) {
        gridEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #7f8c8d;">Đang cập nhật...</div>';
        return;
    }

    filteredItems.forEach(item => {
        // [FIX] Lấy số dư realtime từ biến userData
        const userBalance = item.currency === "VNCoin" ? (userData.vn_coin || 0) : (userData.coins || 0);
        const canBuy = userBalance >= parseInt(item.price);
        
        // Xử lý ảnh
        const imgUrl = (item.image && item.image.includes('assets/')) ? item.image : 'assets/sun.png'; 

        const card = document.createElement('div');
        card.className = "product-card";
        
        // Nút mua sẽ bị mờ và không bấm được nếu không đủ tiền
        const btnStyle = canBuy ? '' : 'background:#7f8c8d; cursor:not-allowed; opacity:0.7;';
        const btnText = canBuy ? 'MUA NGAY' : 'KHÔNG ĐỦ TIỀN';
        const btnAttr = canBuy ? '' : 'disabled';

        card.innerHTML = `
            ${item.isHot ? '<span class="badge-hot">HOT</span>' : ''}
            <div class="product-img">
                <img src="${imgUrl}" style="width:100px; height:100px; object-fit:contain;">
            </div>
            <div class="product-info">
                <div>
                    <div class="product-name">${item.name}</div>
                    <div class="product-desc">${item.description || ''}</div>
                </div>
                <div>
                    <div class="price-tag">${parseInt(item.price).toLocaleString()} ${item.currency}</div>
                    <button class="btn-buy" 
                        onclick="handleBuy('${item.id}')" 
                        style="${btnStyle}" ${btnAttr}>
                        ${btnText}
                    </button>
                </div>
            </div>
        `;
        gridEl.appendChild(card);
    });
}

// 4. Render Kho Đồ (Inventory)
window.renderInventory = function() {
    const container = document.getElementById('inventory-container');
    container.innerHTML = "";
    let hasItem = false;

    // A. Plant Food (Số lượng)
    const plantFoodCount = userData.item_plant_food_count || 0;
    if (plantFoodCount > 0) {
        hasItem = true;
        container.innerHTML += `
            <div class="inventory-item">
                <div style="display:flex; align-items:center;">
                    <div class="inv-icon">🍃</div>
                    <div>
                        <div style="font-weight:bold; font-size:1.2em;">Thuốc Tăng Lực</div>
                        <div style="color:#bdc3c7; font-size:0.9em;">Dùng trong game để buff cây</div>
                    </div>
                </div>
                <div class="inv-count">x${plantFoodCount}</div>
            </div>
        `;
    }

    // B. Các Item Gói/Vĩnh viễn (Mảng)
    if (userData.inventory && userData.inventory.length > 0) {
        userData.inventory.forEach(code => {
            hasItem = true;
            let itemName = "Vật phẩm";
            let itemDesc = "Đã sở hữu";
            let icon = "🎁";

            if(code === 'sun_pack') { itemName = "Gói Mặt Trời"; itemDesc = "+100 Sun khi bắt đầu game"; icon = "☀️"; }
            
            container.innerHTML += `
                <div class="inventory-item" style="border-left-color: #9b59b6;">
                    <div style="display:flex; align-items:center;">
                        <div class="inv-icon">${icon}</div>
                        <div>
                            <div style="font-weight:bold; font-size:1.2em;">${itemName} (${code})</div>
                            <div style="color:#bdc3c7; font-size:0.9em;">${itemDesc}</div>
                        </div>
                    </div>
                    <div class="inv-count">✔</div>
                </div>
            `;
        });
    }

    if (!hasItem) container.innerHTML = '<div style="text-align:center; padding:50px; color:#7f8c8d;">Túi đồ trống.</div>';
}

// 5. Render Lịch Sử
window.renderHistory = async function() {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Đang tải...</td></tr>';

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
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Chưa có giao dịch.</td></tr>';
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