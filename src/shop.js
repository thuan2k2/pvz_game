import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { 
    doc, onSnapshot, collection, query, orderBy, limit, getDocs, where 
} from "firebase/firestore"; 
import { buyShopItemWithLog, toggleItemStatus } from "./firebase/auth.js"; // [CẬP NHẬT] Import thêm toggleItemStatus

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

// 3. Render Shop (Logic check tiền chuẩn xác & Hiển thị chi tiết)
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

        // [MỚI] TẠO THÔNG TIN CHI TIẾT GÓI
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
                    ${detailInfo} 
                    <div class="product-desc" style="margin-top:5px;">${item.description || ''}</div>
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

// 4. Render Kho Đồ (Inventory) [CẬP NHẬT LỚN]
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
                        <div style="color:#bdc3c7; font-size:0.9em;">SL: <b>${plantFoodCount}</b></div>
                    </div>
                </div>
                <div class="inv-count">Sẵn sàng</div>
            </div>
        `;
    }

    // B. Xử lý Sun Pack (Gộp logic Vĩnh viễn & Có hạn & Bật/Tắt)
    let sunPackStatus = null; // null = không có, 'perm' = vĩnh viễn, date = ngày hết hạn
    
    // Ưu tiên kiểm tra Vĩnh viễn trước
    if (userData.inventory && userData.inventory.includes('sun_pack')) {
        sunPackStatus = 'perm';
    } 
    // Sau đó kiểm tra Có hạn
    else if (userData.temp_items && userData.temp_items.sun_pack) {
        sunPackStatus = userData.temp_items.sun_pack.toDate(); // Timestamp object
    }

    if (sunPackStatus) {
        hasItem = true;
        // Kiểm tra trạng thái bật/tắt (Mặc định là Bật nếu chưa có setting)
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

    // C. Các item khác trong inventory (Trừ sun_pack đã xử lý)
    if (userData.inventory && userData.inventory.length > 0) {
        userData.inventory.forEach(code => {
            if (code === 'sun_pack') return; // Đã xử lý ở trên
            
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

    if (!hasItem) {
        container.innerHTML = '<div style="text-align:center; padding:50px; color:#7f8c8d;">Túi đồ trống rỗng... Hãy mua sắm đi!</div>';
    }
}

// [MỚI] Xử lý nút Bật/Tắt
window.handleToggle = async (itemCode, newState) => {
    if (!currentUser) return;
    // Gọi hàm cập nhật Firebase (đã import ở trên)
    await toggleItemStatus(currentUser.uid, itemCode, newState);
    // Giao diện sẽ tự cập nhật nhờ listener onSnapshot
};

// 5. Render Lịch Sử
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