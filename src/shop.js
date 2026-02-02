import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { 
    doc, onSnapshot, collection, query, orderBy, limit, getDocs, where 
} from "firebase/firestore"; // Thêm các hàm query
import { buyShopItemWithLog } from "./firebase/auth.js";

// Biến lưu trữ dữ liệu
let SHOP_ITEMS = [];
let currentUser = null;
let userData = {}; // Lưu thông tin user realtime

// === KHỞI TẠO DOM ===
const vnCoinEl = document.getElementById('user-vncoin');
const gameCoinEl = document.getElementById('user-coin');
const loadingEl = document.getElementById('loading');

// 1. Lắng nghe dữ liệu SHOP từ Firestore (Real-time)
const qShop = query(collection(db, "shop_items"), orderBy("price", "asc"));
onSnapshot(qShop, (snapshot) => {
    SHOP_ITEMS = [];
    snapshot.forEach((doc) => {
        SHOP_ITEMS.push({ id: doc.id, ...doc.data() });
    });
    
    // Nếu đang ở tab nào thì render lại tab đó
    if(document.getElementById('section-vncoin').classList.contains('active')) renderShopByType('vncoin');
    if(document.getElementById('section-coin').classList.contains('active')) renderShopByType('coin');
});

// 2. Kiểm tra đăng nhập & Lắng nghe tiền/kho đồ User
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                userData = doc.data(); // Cập nhật data mới nhất
                
                // Cập nhật số dư trên Header
                vnCoinEl.innerText = (userData.vn_coin || 0).toLocaleString();
                gameCoinEl.innerText = (userData.coins || 0).toLocaleString();
                
                // Nếu đang ở tab kho đồ thì render lại ngay lập tức
                if(document.getElementById('section-inventory').classList.contains('active')) {
                    renderInventory();
                }
                
                // Mặc định load shop nếu chưa load
                if(!document.querySelector('.shop-section.active')) {
                    renderShopByType('vncoin');
                }
            }
        });
    } else {
        window.location.href = "login.html";
    }
});

// 3. Render Giao diện Shop (VNCoin / Coin)
window.renderShopByType = function(type) {
    const gridEl = document.getElementById(`grid-${type}`);
    gridEl.innerHTML = "";
    
    const filteredItems = SHOP_ITEMS.filter(item => item.shopType === type);
    
    if (filteredItems.length === 0) {
        gridEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #7f8c8d;">Chưa có vật phẩm nào.</div>';
        return;
    }

    filteredItems.forEach(item => {
        const balance = item.currency === "VNCoin" ? (userData.vn_coin || 0) : (userData.coins || 0);
        const canBuy = balance >= item.price;
        
        // Xử lý ảnh
        const imgUrl = (item.image && item.image.includes('assets/')) ? item.image : 'assets/sun.png'; 

        const card = document.createElement('div');
        card.className = "product-card";
        
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
                        ${canBuy ? '' : 'disabled'}>
                        ${canBuy ? 'MUA NGAY' : 'KHÔNG ĐỦ TIỀN'}
                    </button>
                </div>
            </div>
        `;
        gridEl.appendChild(card);
    });
}

// 4. [MỚI] Render Kho Đồ (Inventory)
window.renderInventory = function() {
    const container = document.getElementById('inventory-container');
    container.innerHTML = "";

    let hasItem = false;

    // A. Hiển thị Plant Food (Item tiêu hao)
    const plantFoodCount = userData.item_plant_food_count || 0;
    if (plantFoodCount > 0) {
        hasItem = true;
        const pfHtml = `
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
        container.innerHTML += pfHtml;
    }

    // B. Hiển thị Item vĩnh viễn (Skin, Cây mới)
    if (userData.inventory && userData.inventory.length > 0) {
        userData.inventory.forEach(code => {
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

// 5. [MỚI] Render Lịch sử mua hàng
window.renderHistory = async function() {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Đang tải dữ liệu...</td></tr>';

    try {
        // Lấy 20 giao dịch mua hàng gần nhất của user này
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
            
            // Xử lý tên sản phẩm từ ghi chú
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
        console.error("Lỗi tải lịch sử:", error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red; padding:20px;">Lỗi tải dữ liệu. Vui lòng thử lại sau.</td></tr>';
    }
}

// 6. Xử lý Mua Hàng
window.handleBuy = async (itemId) => {
    if (!currentUser) return;
    
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    if (!confirm(`Bạn có chắc muốn mua "${item.name}" với giá ${parseInt(item.price).toLocaleString()} ${item.currency}?`)) return;

    loadingEl.style.display = 'flex';

    // Gọi hàm xử lý giao dịch an toàn trong auth.js
    const result = await buyShopItemWithLog(currentUser.uid, item);

    loadingEl.style.display = 'none';

    if (result.success) {
        alert("✅ Mua thành công! Hãy kiểm tra Kho Đồ.");
        // Chuyển ngay sang tab Kho đồ để người chơi thấy hàng về
        // (Nếu muốn giữ ở trang shop thì bỏ dòng dưới đi)
        // switchSection('inventory', document.querySelectorAll('.sidebar-item')[2]); 
    } else {
        alert("❌ Giao dịch thất bại: " + result.message);
    }
};