import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { buyShopItemWithLog } from "./firebase/auth.js";

// === CẤU HÌNH DANH SÁCH VẬT PHẨM ===
// Bạn có thể thêm sửa xóa vật phẩm tại đây
const SHOP_ITEMS = [
    {
        id: "pack_coin_1",
        name: "Gói Tân Thủ",
        description: "Nhận ngay 5,000 Coin Game để mua cây.",
        price: 10000, // Giá VNCoin
        image: "assets/sun.png", // Đảm bảo bạn có ảnh này hoặc thay ảnh khác
        type: "coin",
        value: 5000, // Số coin nhận được
        isHot: true
    },
    {
        id: "pack_coin_2",
        name: "Gói Đại Gia",
        description: "Nhận ngay 50,000 Coin Game. Tiêu xả láng!",
        price: 90000,
        image: "assets/sun.png",
        type: "coin",
        value: 50000,
        isHot: false
    },
    {
        id: "item_plant_food",
        name: "Bình Thuốc Tăng Lực",
        description: "Mua 5 bình Plant Food để kích hoạt kỹ năng đặc biệt cho cây.",
        price: 20000,
        image: "assets/pea.png",
        type: "item",
        itemCode: "plant_food", // Code để lưu vào inventory
        amount: 5,
        isHot: true
    }
];

// === LOGIC HỆ THỐNG ===
const vnCoinEl = document.getElementById('user-vncoin');
const gameCoinEl = document.getElementById('user-coin');
const gridEl = document.getElementById('shop-grid');
const loadingEl = document.getElementById('loading');
let currentUser = null;
let userBalance = 0;

// 1. Kiểm tra đăng nhập & Lắng nghe tiền
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        // Lắng nghe thay đổi tài sản realtime
        onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                userBalance = data.vn_coin || 0;
                vnCoinEl.innerText = userBalance.toLocaleString();
                gameCoinEl.innerText = (data.coins || 0).toLocaleString();
                
                // Render lại để cập nhật trạng thái nút (Disable nếu không đủ tiền)
                renderShop();
            }
        });
    } else {
        // Chưa đăng nhập thì đá về login
        window.location.href = "login.html";
    }
});

// 2. Render Giao diện Shop
function renderShop() {
    gridEl.innerHTML = "";
    
    SHOP_ITEMS.forEach(item => {
        const canBuy = userBalance >= item.price;
        const card = document.createElement('div');
        card.className = "product-card";
        
        card.innerHTML = `
            ${item.isHot ? '<span class="badge-hot">HOT</span>' : ''}
            <div class="product-img">
                ${item.image.endsWith('.png') || item.image.endsWith('.jpg') 
                    ? `<img src="${item.image}" alt="${item.name}" style="width:100px; height:100px;">` 
                    : '🎁'} 
            </div>
            <div class="product-info">
                <div>
                    <div class="product-name">${item.name}</div>
                    <div class="product-desc">${item.description}</div>
                </div>
                <div>
                    <div class="price-tag">${item.price.toLocaleString()} VNCoin</div>
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

// 3. Xử lý Mua Hàng (Gọi hàm từ HTML)
window.handleBuy = async (itemId) => {
    if (!currentUser) return;
    
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    if (!confirm(`Bạn có chắc muốn mua "${item.name}" với giá ${item.price.toLocaleString()} VNCoin?`)) return;

    loadingEl.style.display = 'flex';

    // Gọi hàm xử lý giao dịch an toàn trong auth.js
    const result = await buyShopItemWithLog(currentUser.uid, item);

    loadingEl.style.display = 'none';

    if (result.success) {
        alert("✅ Mua thành công! Kiểm tra tài khoản của bạn.");
    } else {
        alert("❌ Giao dịch thất bại: " + result.message);
    }
};