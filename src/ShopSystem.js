// src/ShopSystem.js
import { db, auth } from './firebase/config.js';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { buyShopItemWithLog, useGameItem } from './firebase/auth.js';

// Hàm render chính
export async function renderShopContent(type, container) {
    container.innerHTML = '<div style="text-align:center; color:#888; padding:50px;">⏳ Đang tải dữ liệu...</div>';

    try {
        if (type === 'vncoin' || type === 'coin') {
            await renderShopItems(type, container);
        } else if (type === 'deposit') {
            renderDepositForm(container);
        } else if (type === 'deposit-history') {
            await renderDepositHistory(container);
        } else if (type === 'inventory') {
            await renderInventory(container);
        } else if (type === 'history') {
            await renderPurchaseHistory(container);
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="text-align:center; color:#c0392b;">❌ Lỗi tải dữ liệu: ${e.message}</div>`;
    }
}

// 1. Render Danh Sách Vật Phẩm (VNCoin/Coin)
async function renderShopItems(currencyType, container) {
    const currencyLabel = currencyType === 'vncoin' ? 'VNCoin' : 'Coin';
    const q = query(collection(db, "shop_items"), where("currency", "==", currencyLabel));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        container.innerHTML = '<div style="text-align:center; color:#888;">Chưa có vật phẩm nào được bày bán.</div>';
        return;
    }

    let html = '';
    snapshot.forEach(doc => {
        const item = doc.data();
        html += `
            <div class="shop-card-dummy" onclick="window.confirmBuy('${doc.id}', '${item.name}', '${item.price}', '${item.currency}')">
                <div style="width:100%; height:120px; background:#000; margin-bottom:10px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                    <img src="${item.image || 'assets/sun.png'}" style="max-height:100%;" onerror="this.style.display='none'">
                </div>
                <div style="color:#c8aa6e; font-weight:bold; font-family:'Cinzel',serif; font-size:14px;">${item.name}</div>
                <div style="color:${item.currency === 'VNCoin' ? '#f1c40f' : '#0acbe6'}; font-size:13px; margin-top:5px;">
                    ${parseInt(item.price).toLocaleString()} ${item.currency === 'VNCoin' ? '🟡' : '💎'}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 2. Render Form Nạp (Giả lập)
function renderDepositForm(container) {
    container.innerHTML = `
        <div style="text-align:center; color:#f0e6d2; padding:30px;">
            <h2 style="color:#c8aa6e; font-family:'Cinzel', serif;">NẠP TÀI KHOẢN</h2>
            <p>Vui lòng liên hệ Admin qua Fanpage để nạp VNCoin.</p>
            <div style="margin-top:20px; padding:20px; background:rgba(255,255,255,0.05); border:1px solid #3c3c41; display:inline-block;">
                <p>Tỷ giá: <b>10.000 VNĐ = 10.000 VNCoin</b></p>
                <p>Nội dung chuyển khoản: <b>NAP [EMAIL CỦA BẠN]</b></p>
            </div>
        </div>
    `;
}

// 3. Render Lịch Sử Nạp
async function renderDepositHistory(container) {
    if (!auth.currentUser) return;
    const q = query(
        collection(db, "transactions_history"),
        where("uid", "==", auth.currentUser.uid),
        where("type", "==", "DEPOSIT"),
        orderBy("timestamp", "desc"),
        limit(20)
    );
    const snapshot = await getDocs(q);
    
    let html = `<table style="width:100%; text-align:left; color:#ccc; font-size:13px;">
                <tr style="color:#c8aa6e; border-bottom:1px solid #444;"><th>Thời gian</th><th>Số tiền</th><th>Trạng thái</th></tr>`;
    
    if (snapshot.empty) {
        container.innerHTML = '<div style="text-align:center; padding:20px;">Chưa có giao dịch nào.</div>';
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : '---';
        html += `
            <tr style="border-bottom:1px solid #222;">
                <td style="padding:10px;">${date}</td>
                <td style="color:#f1c40f;">+${parseInt(data.amount).toLocaleString()}</td>
                <td style="color:#2ecc71;">Thành công</td>
            </tr>
        `;
    });
    html += '</table>';
    container.innerHTML = html;
}

// 4. Render Kho Đồ
async function renderInventory(container) {
    if (!auth.currentUser) return;
    // Lấy dữ liệu từ localStorage để nhanh (đã được sync ở main.js)
    const pfCount = localStorage.getItem('item_plant_food_count') || 0;
    const inventory = JSON.parse(localStorage.getItem('user_inventory') || '[]');
    
    let html = `
        <div style="display:flex; gap:15px; flex-wrap:wrap;">
            <div style="background:#1e2328; padding:15px; border:1px solid #2ecc71; width:150px; text-align:center;">
                <div style="font-size:30px;">🍃</div>
                <div style="font-weight:bold; color:#2ecc71;">Thuốc Tăng Lực</div>
                <div style="font-size:20px; color:#fff; margin-top:5px;">x${pfCount}</div>
            </div>
    `;

    // Hiển thị các item khác trong mảng inventory
    // (Cần mapping tên item nếu muốn đẹp hơn)
    inventory.forEach(itemCode => {
        html += `
            <div style="background:#1e2328; padding:15px; border:1px solid #3c3c41; width:150px; text-align:center;">
                <div style="font-size:30px;">📦</div>
                <div style="font-weight:bold; color:#ccc;">${itemCode}</div>
                <div style="font-size:12px; color:#888;">Đã sở hữu</div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// 5. Render Lịch Sử Mua
async function renderPurchaseHistory(container) {
    if (!auth.currentUser) return;
    const q = query(
        collection(db, "transactions_history"),
        where("uid", "==", auth.currentUser.uid),
        where("type", "==", "BUY_SHOP"),
        orderBy("timestamp", "desc"),
        limit(20)
    );
    const snapshot = await getDocs(q);
    
    let html = `<table style="width:100%; text-align:left; color:#ccc; font-size:13px;">
                <tr style="color:#c8aa6e; border-bottom:1px solid #444;"><th>Thời gian</th><th>Sản phẩm</th><th>Giá</th></tr>`;
    
    if (snapshot.empty) {
        container.innerHTML = '<div style="text-align:center; padding:20px;">Chưa mua gì cả.</div>';
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : '---';
        const priceColor = data.assetType === 'VNCoin' ? '#f1c40f' : '#0acbe6';
        html += `
            <tr style="border-bottom:1px solid #222;">
                <td style="padding:10px;">${date}</td>
                <td style="color:#fff;">${data.note.replace('Mua: ', '')}</td>
                <td style="color:${priceColor};">${Math.abs(data.amount).toLocaleString()}</td>
            </tr>
        `;
    });
    html += '</table>';
    container.innerHTML = html;
}

// --- GLOBAL FUNCTION CHO WINDOW (Để gọi từ onclick trong HTML nếu cần) ---
window.confirmBuy = async (itemId, name, price, currency) => {
    if (!auth.currentUser) {
        alert("Vui lòng đăng nhập để mua hàng!");
        return;
    }
    
    if (!confirm(`Bạn có chắc muốn mua "${name}" với giá ${parseInt(price).toLocaleString()} ${currency}?`)) return;

    // Hiển thị loading (tạm thời)
    const oldCursor = document.body.style.cursor;
    document.body.style.cursor = 'wait';

    try {
        // Import hàm từ auth.js để tái sử dụng logic (Đã có logic tặng thẻ đại gia ở đó)
        const itemData = { 
            name: name, 
            price: price, 
            currency: currency,
            type: 'item', // Giả sử là item, logic thật cần lấy chi tiết từ DB nếu cần
            itemCode: 'plant_food' // Mặc định test, thực tế cần lấy từ item data
        };
        
        // Gọi hàm mua (Cần lấy itemData đầy đủ hơn từ DB hoặc truyền vào)
        // Để đơn giản, ta sẽ gọi Cloud Function hoặc hàm xử lý trực tiếp.
        // Ở đây tôi gọi hàm `buyShopItemWithLog` mà ta đã sửa ở `auth.js`
        // Lưu ý: Ta cần lấy ItemCode thật.
        
        // Cách tốt nhất: Lấy lại doc từ DB để an toàn
        const { doc, getDoc } = await import('firebase/firestore');
        const itemSnap = await getDoc(doc(db, "shop_items", itemId));
        if(!itemSnap.exists()) throw new Error("Vật phẩm không tồn tại");
        
        const realItemData = itemSnap.data();
        
        const result = await buyShopItemWithLog(auth.currentUser.uid, realItemData);
        
        if (result.success) {
            alert("✅ Mua thành công!");
            // Refresh lại view inventory hoặc tiền
        } else {
            alert("❌ Lỗi: " + result.message);
        }
    } catch (e) {
        alert("Lỗi: " + e.message);
    } finally {
        document.body.style.cursor = oldCursor;
    }
};