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

// 1. RENDER SHOP ITEMS (FIX UI)
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
        const priceColor = item.currency === 'VNCoin' ? '#f1c40f' : '#0acbe6'; // Vàng hoặc Xanh
        const icon = item.currency === 'VNCoin' ? '🟡' : '💎';
        
        // Escape chuỗi để tránh lỗi JS khi truyền vào hàm onclick
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

// 2. RENDER DEPOSIT FORM (SEPAY QR)
function renderDepositForm(container) {
    // Thông tin tài khoản nhận tiền (Bạn hãy sửa lại thông tin thật của mình ở đây)
    const BANK_INFO = {
        BANK_NAME: "MBBank", // Tên ngân hàng (VD: MBBank, VCB, TPBank...)
        ACC_NUM: "0000123456789", // Số tài khoản
        ACC_NAME: "NGUYEN VAN A", // Tên chủ tài khoản
        TEMPLATE: "compact" // compact, print, qr_only
    };

    const userEmail = auth.currentUser ? auth.currentUser.email : "KHÁCH";
    // Nội dung chuyển khoản: NAP + EMAIL (Viết liền, không dấu, in hoa để dễ đối soát)
    const transferContent = `NAP ${userEmail.split('@')[0]}`.toUpperCase().replace(/[^A-Z0-9]/g, '');

    container.innerHTML = `
        <div style="display:flex; gap:30px; justify-content:center; flex-wrap:wrap; color:#f0e6d2;">
            <div style="background:#fff; padding:20px; border-radius:10px; text-align:center;">
                <h3 style="color:#333; margin-bottom:10px;">QUÉT MÃ ĐỂ NẠP</h3>
                <img src="https://img.vietqr.io/image/${BANK_INFO.BANK_NAME}-${BANK_INFO.ACC_NUM}-${BANK_INFO.TEMPLATE}.png?amount=0&addInfo=${transferContent}&accountName=${encodeURIComponent(BANK_INFO.ACC_NAME)}" 
                     style="width:250px; height:250px;" alt="QR Code">
                <p style="color:#333; font-size:12px; margin-top:5px;">(Quét mã bằng App Ngân hàng)</p>
            </div>

            <div style="max-width:400px;">
                <h2 style="color:#c8aa6e; font-family:'Cinzel', serif; border-bottom:1px solid #785a28; padding-bottom:10px;">HƯỚNG DẪN NẠP</h2>
                <ul style="line-height:2; color:#a09b8c;">
                    <li>1. Mở App Ngân hàng hoặc Momo/ZaloPay.</li>
                    <li>2. Quét mã QR bên cạnh.</li>
                    <li>3. Nhập số tiền muốn nạp (Tỷ lệ: <b>1.000 VNĐ = 1.000 VNCoin</b>).</li>
                    <li>4. <b>QUAN TRỌNG:</b> Nội dung chuyển khoản phải ghi đúng:</li>
                </ul>
                <div style="background:#1e2328; padding:15px; border:1px solid #c8aa6e; text-align:center; margin:15px 0;">
                    <span style="color:#f1c40f; font-size:20px; font-weight:bold; letter-spacing:2px;">${transferContent}</span>
                </div>
                <p style="font-size:13px; color:#c0392b;">* Nếu không nhập đúng nội dung, tiền sẽ không vào tài khoản tự động. Vui lòng liên hệ Admin nếu gặp sự cố.</p>
                
                <div style="margin-top:20px; padding:10px; border:1px dashed #555;">
                    <p><b>Ngân hàng:</b> ${BANK_INFO.BANK_NAME}</p>
                    <p><b>Số tài khoản:</b> ${BANK_INFO.ACC_NUM}</p>
                    <p><b>Chủ tài khoản:</b> ${BANK_INFO.ACC_NAME}</p>
                </div>
            </div>
        </div>
    `;
}

// 3. RENDER DEPOSIT HISTORY
async function renderDepositHistory(container) {
    if (!auth.currentUser) return;
    
    // Lấy dữ liệu log loại 'DEPOSIT' hoặc 'ADMIN_ADD'
    const q = query(
        collection(db, "transactions_history"),
        where("uid", "==", auth.currentUser.uid),
        where("type", "in", ["DEPOSIT", "ADMIN_ADD"]), 
        orderBy("timestamp", "desc"),
        limit(20)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Bạn chưa nạp lần nào.</div>';
        return;
    }

    let html = `
        <div style="overflow-x:auto;">
            <table class="hex-table">
                <thead>
                    <tr><th>THỜI GIAN</th><th>SỐ TIỀN</th><th>NỘI DUNG</th><th>TRẠNG THÁI</th></tr>
                </thead>
                <tbody>
    `;

    snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleString('vi-VN') : '---';
        html += `
            <tr>
                <td>${date}</td>
                <td style="color:#f1c40f; font-weight:bold;">+${parseInt(data.amount).toLocaleString()}</td>
                <td>${data.note || 'Nạp tiền hệ thống'}</td>
                <td style="color:#2ecc71;">Thành công</td>
            </tr>
        `;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// 4. RENDER INVENTORY (FIX ACTION BUTTONS)
async function renderInventory(container) {
    if (!auth.currentUser) return;
    
    // Lấy dữ liệu mới nhất từ Firestore (thay vì localStorage để đảm bảo đồng bộ khi xóa)
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    
    if(!userSnap.exists()) return;
    const userData = userSnap.data();

    const pfCount = userData.item_plant_food_count || 0;
    const inventory = userData.inventory || [];
    
    let html = '<div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center;">';

    // Item đặc biệt: Thuốc Tăng Lực (Số lượng)
    if (pfCount > 0) {
        html += `
            <div class="hex-card" style="width:180px; height:auto; min-height:250px;">
                <div class="hex-card-img" style="height:100px;">
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

    // Các Item khác (Dạng danh sách unique hoặc skin)
    // Để demo, ta giả sử inventory chứa mã item string
    if (inventory.length > 0) {
        // Gom nhóm item giống nhau (nếu cần)
        const itemCounts = {};
        inventory.forEach(x => { itemCounts[x] = (itemCounts[x] || 0) + 1; });

        for (const [code, count] of Object.entries(itemCounts)) {
            // Kiểm tra trạng thái đang bật/tắt (nếu là skin/tính năng)
            const isActive = userData.item_settings && userData.item_settings[code] === true;
            const statusText = isActive ? "<span style='color:#2ecc71'>[ĐANG BẬT]</span>" : "<span style='color:#888'>[ĐANG TẮT]</span>";
            const btnText = isActive ? "TẮT" : "BẬT";
            const btnColor = isActive ? "#c0392b" : "#27ae60";

            html += `
                <div class="hex-card" style="width:180px; height:auto; min-height:250px;">
                    <div class="hex-card-img" style="height:100px;">
                        <span style="font-size:40px;">📦</span>
                    </div>
                    <div class="hex-card-body">
                        <div class="hex-card-title" style="font-size:14px;">${code}</div>
                        <div style="font-size:12px; color:#aaa;">${statusText}</div>
                        
                        <div class="inv-actions" style="flex-direction:column; gap:5px; margin-top:10px;">
                            <button class="btn-inv" style="background:${btnColor}; border:none;" 
                                onclick="window.handleInventoryAction('${code}', 'toggle', ${!isActive})">
                                ${btnText}
                            </button>
                            <button class="btn-inv btn-del" onclick="window.handleInventoryAction('${code}', 'delete_one', false)">Xóa</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    if (pfCount === 0 && inventory.length === 0) {
        html = '<div style="color:#888; margin-top:50px;">Túi đồ trống rỗng. Hãy ghé Cửa Hàng nhé!</div>';
    } else {
        html += '</div>';
    }
    
    container.innerHTML = html;
}

// 5. RENDER PURCHASE HISTORY (FIX UI)
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
        <div style="overflow-x:auto;">
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

// --- GLOBAL FUNCTIONS (Gắn vào window để gọi từ HTML string) ---

// 1. SHOW PRODUCT MODAL
window.showProductModal = (id, name, price, currency, desc, img) => {
    // Xóa modal cũ nếu có
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

// 2. CONFIRM BUY LOGIC
window.confirmBuy = async (itemId, name, price, currency) => {
    if (!auth.currentUser) return alert("Vui lòng đăng nhập!");
    const modal = document.getElementById('product-modal');
    if(modal) modal.remove(); // Đóng modal

    const oldCursor = document.body.style.cursor;
    document.body.style.cursor = 'wait';

    try {
        const itemSnap = await getDoc(doc(db, "shop_items", itemId));
        if(!itemSnap.exists()) throw new Error("Vật phẩm không còn tồn tại!");
        
        const realItemData = itemSnap.data();
        const result = await buyShopItemWithLog(auth.currentUser.uid, realItemData);
        
        if (result.success) {
            alert(`✅ Mua thành công: ${name}`);
            // Refresh lại view nếu đang ở tab liên quan
            const activeTab = document.querySelector('.shop-tab-item.active');
            if(activeTab) {
                // Hack: Click lại tab đang active để reload content
                activeTab.click();
            }
        } else {
            alert("❌ Giao dịch thất bại: " + result.message);
        }
    } catch (e) {
        alert("Lỗi: " + e.message);
    } finally {
        document.body.style.cursor = oldCursor;
    }
};

// 3. INVENTORY ACTIONS (USE / DELETE)
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
            // Xóa phần tử khỏi mảng inventory (Firestore arrayRemove chỉ xóa nếu khớp chính xác giá trị)
            const { arrayRemove } = await import('firebase/firestore');
            await updateDoc(userRef, { inventory: arrayRemove(itemCode) });
            alert("Đã xóa.");
        }
        else if (action === 'toggle') {
            await updateDoc(userRef, { [`item_settings.${itemCode}`]: value });
            alert(value ? "Đã BẬT vật phẩm." : "Đã TẮT vật phẩm.");
        }
        
        // Reload Inventory Tab
        const invTab = document.querySelector('.shop-tab-item.active');
        if(invTab && invTab.innerText.includes('KHO')) invTab.click();

    } catch (e) {
        console.error(e);
        alert("Lỗi thao tác: " + e.message);
    }
};