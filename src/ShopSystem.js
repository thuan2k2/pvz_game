// src/ShopSystem.js
import { db, auth } from './firebase/config.js';
import { collection, getDocs, query, where, orderBy, limit, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { buyShopItemWithLog } from './firebase/auth.js';

// --- MAIN RENDER FUNCTION ---
export async function renderShopContent(type, container) {
    container.innerHTML = '<div style="text-align:center; color:#c8aa6e; padding:50px; font-family:Cinzel,serif;">⏳ ĐANG TẢI DỮ LIỆU...</div>';

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
        container.innerHTML = `<div style="text-align:center; color:#c0392b;">❌ Lỗi: ${e.message}</div>`;
    }
}

// 1. RENDER SHOP ITEMS
async function renderShopItems(currencyType, container) {
    const currencyLabel = currencyType === 'vncoin' ? 'VNCoin' : 'Coin';
    const q = query(collection(db, "shop_items"), where("currency", "==", currencyLabel));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        container.innerHTML = '<div style="text-align:center; color:#888;">Chưa có vật phẩm nào được bày bán.</div>';
        return;
    }

    let html = '<div class="shop-grid">';
    snapshot.forEach(doc => {
        const item = doc.data();
        const priceColor = item.currency === 'VNCoin' ? '#f1c40f' : '#0acbe6';
        const icon = item.currency === 'VNCoin' ? '🟡' : '💎';
        
        const safeName = item.name.replace(/'/g, "\\'");
        const safeDesc = (item.description || "Vật phẩm giá trị").replace(/'/g, "\\'");
        const safeImg = item.image || 'assets/sun.png';

        html += `
            <div class="hex-card">
                <div class="hex-card-img">
                    <img src="${safeImg}" onerror="this.src='assets/card/Peashooter.png'">
                </div>
                <div class="hex-card-body">
                    <div>
                        <div class="hex-card-title">${item.name}</div>
                        <div class="hex-card-price" style="color:${priceColor}">
                            ${parseInt(item.price).toLocaleString()} ${icon}
                        </div>
                    </div>
                    <button class="btn-buy-now" 
                        onclick="window.showProductModal('${doc.id}', '${safeName}', '${item.price}', '${item.currency}', '${safeDesc}', '${safeImg}')">
                        MUA NGAY
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// 2. RENDER DEPOSIT FORM (IFRAME TỚI WORKER)
function renderDepositForm(container) {
    // URL của Worker Cloudflare bạn đã cung cấp
    const WORKER_URL = "https://plans-game.angelmodel147.workers.dev/"; 
    
    // Lấy email user hiện tại để truyền vào iframe (Worker sẽ dùng để tạo nội dung nạp)
    const userEmail = auth.currentUser ? auth.currentUser.email : "";
    
    if (!userEmail) {
        container.innerHTML = '<div style="text-align:center; padding:50px; color:#c0392b;">Vui lòng đăng nhập để nạp tiền.</div>';
        return;
    }

    const iframeSrc = `${WORKER_URL}?email=${encodeURIComponent(userEmail)}`;

    // Hiển thị iframe full chiều cao
    container.innerHTML = `
        <div style="width:100%; height:100%; min-height:500px; display:flex; justify-content:center;">
            <iframe src="${iframeSrc}" 
                    style="width:100%; height:600px; border:none; background:transparent;"
                    allowtransparency="true">
            </iframe>
        </div>
    `;
}

// 3. RENDER DEPOSIT HISTORY (CẬP NHẬT TYPE)
async function renderDepositHistory(container) {
    if (!auth.currentUser) return;
    
    // [QUAN TRỌNG] Thêm "DEPOSIT_SEPAY" vào danh sách lọc để khớp với Worker
    const q = query(
        collection(db, "transactions_history"),
        where("uid", "==", auth.currentUser.uid),
        where("type", "in", ["DEPOSIT", "ADMIN_ADD", "DEPOSIT_SEPAY"]), 
        orderBy("timestamp", "desc"),
        limit(20)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Bạn chưa nạp lần nào.</div>';
        return;
    }

    let html = `
        <div class="history-container">
            <table class="hex-table">
                <thead>
                    <tr><th>THỜI GIAN</th><th>SỐ TIỀN</th><th>NỘI DUNG</th><th>TRẠNG THÁI</th></tr>
                </thead>
                <tbody>
    `;

    snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleString('vi-VN') : '---';
        // Xử lý hiển thị nội dung cho gọn
        let note = data.note || 'Nạp tiền';
        if (note.length > 40) note = note.substring(0, 40) + '...';

        html += `
            <tr>
                <td>${date}</td>
                <td style="color:#f1c40f; font-weight:bold;">+${parseInt(data.amount).toLocaleString()}</td>
                <td style="color:#fff;">${note}</td>
                <td style="color:#2ecc71;">Thành công</td>
            </tr>
        `;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// 4. RENDER INVENTORY
async function renderInventory(container) {
    if (!auth.currentUser) return;
    
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    if(!userSnap.exists()) return;
    const userData = userSnap.data();

    const pfCount = userData.item_plant_food_count || 0;
    const inventory = userData.inventory || [];
    
    let html = '<div class="shop-grid">';

    if (pfCount > 0) {
        html += `
            <div class="hex-card">
                <div class="hex-card-img">
                    <span style="font-size:40px;">🍃</span>
                </div>
                <div class="hex-card-body">
                    <div class="hex-card-title">Thuốc Tăng Lực</div>
                    <div style="color:#2ecc71; font-weight:bold; font-size:18px;">x${pfCount}</div>
                    <div class="inv-actions">
                        <button class="btn-inv btn-del" onclick="window.handleInventoryAction('plant_food', 'delete', true)">Xóa bớt</button>
                    </div>
                </div>
            </div>
        `;
    }

    if (inventory.length > 0) {
        const itemCounts = {};
        inventory.forEach(x => { itemCounts[x] = (itemCounts[x] || 0) + 1; });

        for (const [code, count] of Object.entries(itemCounts)) {
            const isActive = userData.item_settings && userData.item_settings[code] === true;
            const statusText = isActive ? "<span style='color:#2ecc71'>[ĐANG BẬT]</span>" : "<span style='color:#888'>[ĐANG TẮT]</span>";
            const btnText = isActive ? "TẮT" : "BẬT";
            const btnClass = isActive ? "btn-del" : "btn-use";

            html += `
                <div class="hex-card">
                    <div class="hex-card-img">
                        <span style="font-size:40px;">📦</span>
                    </div>
                    <div class="hex-card-body">
                        <div class="hex-card-title">${code}</div>
                        <div style="font-size:12px; color:#aaa; margin-bottom:5px;">${statusText}</div>
                        <div class="inv-actions">
                            <button class="btn-inv ${btnClass}" onclick="window.handleInventoryAction('${code}', 'toggle', ${!isActive})">${btnText}</button>
                            <button class="btn-inv btn-del" onclick="window.handleInventoryAction('${code}', 'delete_one', false)">Xóa</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    if (pfCount === 0 && inventory.length === 0) {
        html = '<div style="color:#888; margin-top:50px; text-align:center; width:100%;">Túi đồ trống rỗng. Hãy ghé Cửa Hàng nhé!</div>';
    } else {
        html += '</div>';
    }
    
    container.innerHTML = html;
}

// 5. RENDER PURCHASE HISTORY
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
    
    if (snapshot.empty) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Chưa có lịch sử mua hàng.</div>';
        return;
    }

    let html = `
        <div class="history-container">
            <table class="hex-table">
                <thead>
                    <tr><th>THỜI GIAN</th><th>SẢN PHẨM</th><th>GIÁ TRỊ</th></tr>
                </thead>
                <tbody>
    `;

    snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleString('vi-VN') : '---';
        const priceColor = data.assetType === 'VNCoin' ? '#f1c40f' : '#0acbe6';
        const icon = data.assetType === 'VNCoin' ? '🟡' : '💎';
        
        html += `
            <tr>
                <td>${date}</td>
                <td style="color:#f0e6d2;">${data.note.replace('Mua: ', '')}</td>
                <td style="color:${priceColor}; font-weight:bold;">-${Math.abs(data.amount).toLocaleString()} ${icon}</td>
            </tr>
        `;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// --- GLOBAL FUNCTIONS ---

window.showProductModal = (id, name, price, currency, desc, img) => {
    const oldModal = document.getElementById('product-modal');
    if (oldModal) oldModal.remove();

    const icon = currency === 'VNCoin' ? '🟡' : '💎';
    const priceColor = currency === 'VNCoin' ? '#f1c40f' : '#0acbe6';

    const modalHtml = `
        <div id="product-modal" onclick="if(event.target === this) this.remove()">
            <div class="product-modal-content">
                <div class="pm-img">
                    <img src="${img}" style="max-width:100%; max-height:100%;" onerror="this.src='assets/sun.png'">
                </div>
                <div class="pm-title">${name}</div>
                <div class="pm-desc">${desc}</div>
                <div class="pm-price" style="color:${priceColor}">
                    GIÁ: ${parseInt(price).toLocaleString()} ${icon}
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-buy-now" onclick="window.confirmBuy('${id}', '${name}', '${price}', '${currency}')">XÁC NHẬN MUA</button>
                    <button class="btn-buy-now" style="background:#333; border-color:#555; color:#aaa;" onclick="document.getElementById('product-modal').remove()">ĐÓNG</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.confirmBuy = async (itemId, name, price, currency) => {
    if (!auth.currentUser) return alert("Vui lòng đăng nhập!");
    const modal = document.getElementById('product-modal');
    if(modal) modal.remove();

    const oldCursor = document.body.style.cursor;
    document.body.style.cursor = 'wait';

    try {
        const itemSnap = await getDoc(doc(db, "shop_items", itemId));
        if(!itemSnap.exists()) throw new Error("Vật phẩm không còn tồn tại!");
        
        const realItemData = itemSnap.data();
        const result = await buyShopItemWithLog(auth.currentUser.uid, realItemData);
        
        if (result.success) {
            alert(`✅ Mua thành công: ${name}`);
            const activeTab = document.querySelector('.shop-tab-item.active');
            if(activeTab) activeTab.click();
        } else {
            alert("❌ Giao dịch thất bại: " + result.message);
        }
    } catch (e) {
        alert("Lỗi: " + e.message);
    } finally {
        document.body.style.cursor = oldCursor;
    }
};

window.handleInventoryAction = async (itemCode, action, value) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const userRef = doc(db, "users", uid);

    try {
        if (action === 'delete') {
            const qty = prompt("Nhập số lượng muốn xóa:", "1");
            if (!qty || isNaN(qty) || parseInt(qty) <= 0) return;
            
            if (itemCode === 'plant_food') {
                await updateDoc(userRef, { item_plant_food_count: increment(-parseInt(qty)) });
            }
            alert("Đã xóa vật phẩm.");
        } 
        else if (action === 'delete_one') {
            if(!confirm("Bạn có chắc muốn xóa vật phẩm này?")) return;
            const { arrayRemove } = await import('firebase/firestore');
            await updateDoc(userRef, { inventory: arrayRemove(itemCode) });
            alert("Đã xóa.");
        }
        else if (action === 'toggle') {
            await updateDoc(userRef, { [`item_settings.${itemCode}`]: value });
        }
        
        const invTab = document.querySelector('.shop-tab-item.active');
        if(invTab && invTab.innerText.includes('KHO')) invTab.click();

    } catch (e) {
        console.error(e);
        alert("Lỗi thao tác: " + e.message);
    }
};