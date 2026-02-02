import { auth, db } from "./firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { buyShopItemWithLog } from "./firebase/auth.js";

// === CẤU HÌNH DANH SÁCH VẬT PHẨM ===
const SHOP_ITEMS = [
    // --- SHOP VNCOIN (VIP) ---
    {
        id: "pack_coin_1",
        name: "Gói Tân Thủ",
        description: "Nhận ngay 5,000 Coin Game để mua cây.",
        price: 10000,
        currency: "VNCoin",
        image: "assets/sun.png",
        type: "coin",
        value: 5000,
        isHot: true,
        shopType: "vncoin"
    },
    {
        id: "item_plant_food_vip",
        name: "Gói Thuốc Đại Gia",
        description: "Mua 10 bình Plant Food để dùng trong game.",
        price: 35000,
        currency: "VNCoin",
        image: "assets/pea.png",
        type: "item",
        itemCode: "plant_food",
        amount: 10,
        isHot: true,
        shopType: "vncoin"
    },
    // --- SHOP COIN (THƯỜNG) ---
    {
        id: "item_plant_food_basic",
        name: "Thuốc Tăng Lực",
        description: "Mua 1 bình Plant Food bằng tiền cày game.",
        price: 2000,
        currency: "Coin",
        image: "assets/pea.png",
        type: "item",
        itemCode: "plant_food",
        amount: 1,
        isHot: false,
        shopType: "coin"
    }
];

// === LOGIC HỆ THỐNG ===
const vnCoinEl = document.getElementById('user-vncoin');
const gameCoinEl = document.getElementById('user-coin');
const gridEl = document.getElementById('shop-grid');
const loadingEl = document.getElementById('loading');
let currentUser = null;
let userVNCoin = 0;
let userCoin = 0;
let currentShopType = "vncoin"; // Mặc định hiển thị Shop VNCoin

// 1. Kiểm tra đăng nhập & Lắng nghe tiền
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
                
                renderShopByType(currentShopType);
            }
        });
    } else {
        window.location.href = "login.html";
    }
});

// 2. Render Giao diện Shop theo loại (VNCoin hoặc Coin)
window.renderShopByType = function(type) {
    currentShopType = type;
    gridEl.innerHTML = "";
    
    const filteredItems = SHOP_ITEMS.filter(item => item.shopType === type);
    
    if (filteredItems.length === 0) {
        gridEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px;">Sắp ra mắt vật phẩm mới...</div>';
        return;
    }

    filteredItems.forEach(item => {
        // Kiểm tra số dư dựa trên loại tiền của vật phẩm
        const balance = item.currency === "VNCoin" ? userVNCoin : userCoin;
        const canBuy = balance >= item.price;
        
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
                    <div class="price-tag">${item.price.toLocaleString()} ${item.currency}</div>
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

// 3. Xử lý Mua Hàng
window.handleBuy = async (itemId) => {
    if (!currentUser) return;
    
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    if (!confirm(`Bạn có chắc muốn mua "${item.name}" với giá ${item.price.toLocaleString()} ${item.currency}?`)) return;

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