import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, collection, query, orderBy } from "firebase/firestore"; // Thêm collection, query, orderBy
import { buyShopItemWithLog } from "./firebase/auth.js";

// [THAY ĐỔI] Không dùng danh sách cứng nữa.
// Biến này sẽ chứa dữ liệu tải từ Firestore về.
let SHOP_ITEMS = [];

// === LOGIC HỆ THỐNG ===
const vnCoinEl = document.getElementById('user-vncoin');
const gameCoinEl = document.getElementById('user-coin');
const gridEl = document.getElementById('shop-grid');
const loadingEl = document.getElementById('loading');
let currentUser = null;
let userVNCoin = 0;
let userCoin = 0;
let currentShopType = "vncoin"; // Mặc định hiển thị Shop VNCoin

// 1. Lắng nghe dữ liệu SHOP từ Firestore (Real-time)
// Khi Admin thêm/sửa/xóa, hàm này tự chạy lại để cập nhật giao diện
const q = query(collection(db, "shop_items"), orderBy("price", "asc"));
onSnapshot(q, (snapshot) => {
    SHOP_ITEMS = [];
    snapshot.forEach((doc) => {
        SHOP_ITEMS.push({ id: doc.id, ...doc.data() });
    });
    
    // Nếu user đã đăng nhập, render lại ngay
    if (currentUser) {
        renderShopByType(currentShopType);
    }
});

// 2. Kiểm tra đăng nhập & Lắng nghe tiền User
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                userVNCoin = data.vn_coin || 0;
                userCoin = data.coins || 0;
                
                vnCoinEl.innerText = userVNCoin.toLocaleString();
                gameCoinEl.innerText = userCoin.toLocaleString();
                
                // Render lại khi tiền thay đổi (để cập nhật nút Mua/Không đủ tiền)
                renderShopByType(currentShopType);
            }
        });
    } else {
        window.location.href = "login.html";
    }
});

// 3. Render Giao diện Shop theo loại (VNCoin hoặc Coin)
window.renderShopByType = function(type) {
    currentShopType = type;
    gridEl.innerHTML = "";
    
    // Lọc sản phẩm theo loại Shop (vncoin hoặc coin)
    // Lưu ý: Dữ liệu trên Firestore cần có trường 'shopType'
    const filteredItems = SHOP_ITEMS.filter(item => item.shopType === type);
    
    if (filteredItems.length === 0) {
        gridEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #7f8c8d;">Chưa có vật phẩm nào được bày bán.</div>';
        return;
    }

    filteredItems.forEach(item => {
        // Kiểm tra số dư dựa trên loại tiền của vật phẩm
        const balance = item.currency === "VNCoin" ? userVNCoin : userCoin;
        const canBuy = balance >= item.price;
        
        const card = document.createElement('div');
        card.className = "product-card";
        
        // Xử lý hiển thị ảnh (nếu link ảnh lỗi hoặc trống thì hiện hộp quà)
        const imgHtml = (item.image && (item.image.startsWith('http') || item.image.startsWith('assets/')))
            ? `<img src="${item.image}" alt="${item.name}" style="width:100px; height:100px; object-fit:contain;">`
            : '<span style="font-size:3em;">🎁</span>';

        card.innerHTML = `
            ${item.isHot ? '<span class="badge-hot">HOT</span>' : ''}
            <div class="product-img">
                ${imgHtml}
            </div>
            <div class="product-info">
                <div>
                    <div class="product-name">${item.name}</div>
                    <div class="product-desc">${item.description || 'Không có mô tả'}</div>
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

// 4. Xử lý Mua Hàng
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
        alert("✅ Mua thành công! Vật phẩm đã được chuyển vào tài khoản.");
    } else {
        alert("❌ Giao dịch thất bại: " + result.message);
    }
};