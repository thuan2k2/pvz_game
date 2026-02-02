import { auth, db } from './firebase/config.js';
import { onAuthStateChanged } from "firebase/auth";
import { 
    collection, getDocs, doc, updateDoc, getDoc, setDoc, 
    addDoc, deleteDoc, onSnapshot, query, orderBy, arrayRemove, arrayUnion, increment, deleteField 
} from 'firebase/firestore';
// Import hàm lấy chi tiết và hàm Ghi Log
import { getAdminUserDetail, saveLog } from './firebase/auth.js';

let allUsers = []; 
let currentEditingId = null;
let currentEditType = 'coins'; 
let currentBanId = null; 
let currentShopItemId = null; 

// Biến cho sửa Item User
let editingUserUid = null;
let editingItemKey = null; // 'plant_food' hoặc 'sun_pack'
let editingItemType = null; // 'quantity' hoặc 'duration'

// ============================================================
// 0. CÁC HÀM HỆ THỐNG & CONFIG (ĐẶT LÊN ĐẦU ĐỂ TRÁNH LỖI)
// ============================================================

// Load cấu hình hệ thống
async function loadSystemConfig() {
    try {
        const docRef = doc(db, "system_config", "general");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            const maintMode = document.getElementById('maintenance-mode');
            const maintMsg = document.getElementById('maintenance-msg');
            if (maintMode) maintMode.value = data.maintenance ? "true" : "false";
            if (maintMsg) maintMsg.value = data.maintenance_message || "";
            
            const annContent = document.getElementById('announcement-content');
            if (annContent) annContent.value = data.announcement || "";
        }
    } catch (error) {
        console.error("Lỗi tải config:", error);
    }
}

// Chuyển Tab
window.switchTab = (tabName) => {
    document.querySelectorAll('.admin-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`section-${tabName}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`menu-${tabName}`);
    if(activeBtn) activeBtn.classList.add('active');
};

// Đóng Modal
window.closeModal = (id) => {
    const el = document.getElementById(id);
    if(el) el.classList.add('hidden');
    currentEditingId = null;
    currentBanId = null;
    currentShopItemId = null;
};

// 1. Check quyền Admin & Khởi chạy
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().role === 'admin') {
            // Gọi các hàm load dữ liệu
            await loadSystemConfig(); // Load config trước
            loadUsers();
            loadShopItems(); 
        } else {
            alert("Bạn không có quyền Admin!");
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// ============================================================
// 2. QUẢN LÝ NGƯỜI CHƠI (USER)
// ============================================================

async function loadUsers() {
    const userListEl = document.getElementById('user-list');
    if(userListEl) userListEl.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>'; 

    try {
        onSnapshot(collection(db, "users"), (snapshot) => {
            allUsers = [];
            let totalCoins = 0;
            let totalVNCoin = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                allUsers.push({ id: doc.id, ...data });
                totalCoins += (data.coins || 0);
                totalVNCoin += (data.vn_coin || 0);
            });

            const totalUsersEl = document.getElementById('total-users');
            const totalCoinsEl = document.getElementById('total-coins');
            if(totalUsersEl) totalUsersEl.innerText = allUsers.length;
            if(totalCoinsEl) totalCoinsEl.innerText = totalCoins.toLocaleString();
            
            renderTable(allUsers);
        });
    } catch (error) {
        console.error(error);
        if(userListEl) userListEl.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Lỗi tải dữ liệu</td></tr>';
    }
}

function renderTable(users) {
    const userListEl = document.getElementById('user-list');
    if(!userListEl) return;
    userListEl.innerHTML = '';

    if (users.length === 0) {
        userListEl.innerHTML = '<tr><td colspan="6" style="text-align:center;">Không tìm thấy user nào</td></tr>';
        return;
    }

    users.forEach(user => {
        const isBanned = user.bannedUntil && user.bannedUntil.toMillis() > Date.now();
        let statusHtml = `<span style="color:#27ae60; font-weight:bold;">Hoạt động</span>`;
        let actionBtn = `<button class="btn btn-ban" onclick="openBanModal('${user.id}', '${user.email}')">🚫 Cấm</button>`;

        if (isBanned) {
            const date = user.bannedUntil.toDate();
            const dateStr = date.toLocaleDateString('vi-VN');
            statusHtml = `<span class="badge-banned">Cấm đến: ${dateStr}</span>`;
            actionBtn = `<button class="btn btn-unban" onclick="unbanUser('${user.id}')">🔓 Gỡ</button>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.email}</td>
            <td>${user.phone || '---'}</td>
            <td style="font-weight:bold; color:#f39c12;">${(user.coins || 0).toLocaleString()}</td>
            <td style="font-weight:bold; color:#f1c40f;">${(user.vn_coin || 0).toLocaleString()}</td>
            <td>${statusHtml}</td>
            <td style="display:flex; flex-wrap:wrap; gap:5px;">
                <button class="btn btn-edit" onclick="openEditModal('${user.id}', '${user.email}', ${user.coins || 0}, 'coins')">Sửa Coin</button>
                <button class="btn btn-edit" style="background:#d35400" onclick="openEditModal('${user.id}', '${user.email}', ${user.vn_coin || 0}, 'vn_coin')">Sửa VN</button>
                <button class="btn btn-view" onclick="showUserDetail('${user.id}')">📜 Chi tiết</button>
                ${user.role !== 'admin' ? actionBtn : ''} 
            </td>
        `;
        userListEl.appendChild(tr);
    });
}

// LOGIC SỬA TIỀN
window.openEditModal = (uid, email, currentValue, type) => {
    currentEditingId = uid;
    currentEditType = type; 
    
    document.getElementById('editing-email').innerText = email;
    document.getElementById('edit-currency-name').innerText = type === 'coins' ? 'Coin Game' : 'VNCoin (Nạp)';
    document.getElementById('new-coin-input').value = currentValue;
    document.getElementById('modal-edit-coin').classList.remove('hidden');
};

window.saveCoin = async () => {
    const amount = parseInt(document.getElementById('new-coin-input').value);
    if (isNaN(amount) || amount < 0) return alert("Số không hợp lệ");
    
    try {
        const userRef = doc(db, "users", currentEditingId);
        const userSnap = await getDoc(userRef);
        const oldVal = userSnap.data()[currentEditType] || 0;
        
        await updateDoc(userRef, { [currentEditType]: amount });

        const adminUser = auth.currentUser;
        await saveLog(
            currentEditingId, 
            "ADMIN_EDIT", 
            currentEditType === 'coins' ? 'Coin' : 'VNCoin',
            amount - oldVal, 
            `Admin ${adminUser.email} chỉnh sửa thủ công`,
            oldVal,
            amount
        );

        alert("Cập nhật thành công!");
        closeModal('modal-edit-coin');
    } catch (error) {
        alert("Lỗi: " + error.message);
    }
};

// ============================================================
// 3. QUẢN LÝ SHOP VIP
// ============================================================

function loadShopItems() {
    const listEl = document.getElementById('shop-items-list');
    if(!listEl) return;

    const q = query(collection(db, "shop_items"), orderBy("price", "asc"));
    
    onSnapshot(q, (snapshot) => {
        listEl.innerHTML = '';
        if(snapshot.empty) {
            listEl.innerHTML = '<tr><td colspan="7" style="text-align:center;">Chưa có sản phẩm nào. Hãy thêm mới!</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const item = doc.data();
            let detailHtml = '';
            
            if(item.itemCode === 'sun_pack') {
                const days = item.duration === 99999 ? "Vĩnh viễn" : `${item.duration} Ngày`;
                detailHtml = `<span style="color:#e67e22">⏳ ${days}</span>`;
            } else if (item.type === 'item') {
                detailHtml = `<span>📦 SL: ${item.amount || 1}</span>`;
            } else {
                detailHtml = `<span>💰 ${item.value} Coin</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${item.image}" style="width:40px; height:40px; object-fit:contain;"></td>
                <td>${item.name}</td>
                <td>${item.currency}</td>
                <td style="font-weight:bold;">${parseInt(item.price).toLocaleString()}</td>
                <td>${item.shopType === 'vncoin' ? '<span class="badge-active">VIP</span>' : '<span style="color:gray">Thường</span>'}</td>
                <td>${detailHtml}</td>
                <td>
                    <button class="btn btn-edit" onclick='openShopModal(${JSON.stringify({id: doc.id, ...item})})'>✏️</button>
                    <button class="btn btn-ban" onclick="deleteShopItem('${doc.id}', '${item.name}')">🗑</button>
                </td>
            `;
            listEl.appendChild(tr);
        });
    });
}

window.openShopModal = (item = null) => {
    const modal = document.getElementById('modal-shop-item');
    if (item) {
        currentShopItemId = item.id;
        document.getElementById('shop-modal-title').innerText = "Sửa sản phẩm";
        document.getElementById('shop-name').value = item.name;
        document.getElementById('shop-desc').value = item.description;
        document.getElementById('shop-price').value = item.price;
        document.getElementById('shop-image').value = item.image;
        document.getElementById('shop-currency').value = item.currency;
        document.getElementById('shop-type').value = item.type;
        document.getElementById('shop-item-code').value = item.itemCode || '';
        document.getElementById('shop-category').value = item.shopType || 'vncoin';
        
        if (item.itemCode === 'sun_pack') {
            document.getElementById('shop-duration').value = item.duration || 1;
        } else {
            document.getElementById('shop-value').value = item.type === 'coin' ? item.value : (item.amount || 1);
        }
        document.getElementById('shop-is-hot').checked = item.isHot;
        
        const codeInput = document.getElementById('shop-item-code');
        if(item.itemCode === 'sun_pack') {
             codeInput.dispatchEvent(new Event('change'));
        }
        
    } else {
        currentShopItemId = null;
        document.getElementById('shop-modal-title').innerText = "Thêm sản phẩm";
        document.getElementById('form-shop-item').reset();
    }
    
    modal.classList.remove('hidden');
};

window.saveShopItem = async () => {
    const itemCode = document.getElementById('shop-item-code').value;
    const duration = parseInt(document.getElementById('shop-duration').value);
    
    const data = {
        name: document.getElementById('shop-name').value,
        description: document.getElementById('shop-desc').value,
        price: parseInt(document.getElementById('shop-price').value),
        image: document.getElementById('shop-image').value,
        currency: document.getElementById('shop-currency').value,
        shopType: document.getElementById('shop-category').value,
        type: document.getElementById('shop-type').value,
        isHot: document.getElementById('shop-is-hot').checked,
        itemCode: itemCode
    };

    if (itemCode === 'sun_pack') {
        data.duration = duration;
        data.value = 0;
    } else {
        const val = parseInt(document.getElementById('shop-value').value);
        data.value = val;
        data.amount = val;
    }

    try {
        if (currentShopItemId) {
            await updateDoc(doc(db, "shop_items", currentShopItemId), data);
            alert("Đã cập nhật sản phẩm!");
        } else {
            await addDoc(collection(db, "shop_items"), data);
            alert("Đã thêm sản phẩm mới!");
        }
        closeModal('modal-shop-item');
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
};

window.deleteShopItem = async (id, name) => {
    if(confirm(`Bạn chắc chắn muốn xóa "${name}"?`)) {
        try {
            await deleteDoc(doc(db, "shop_items", id));
        } catch (e) {
            alert("Lỗi xóa: " + e.message);
        }
    }
};

// ============================================================
// [CẬP NHẬT] CHI TIẾT USER & CHỈNH SỬA KHO ĐỒ NÂNG CAO
// ============================================================

window.showUserDetail = async (uid) => {
    const modalDetail = document.getElementById('detailModal');
    if(modalDetail) modalDetail.classList.remove('hidden');
    
    const infoEl = document.getElementById('modal-user-info');
    const tbody = document.getElementById('modal-logs-body');
    if(infoEl) infoEl.innerHTML = "Đang tải...";
    if(tbody) tbody.innerHTML = "";

    const data = await getAdminUserDetail(uid);
    if (!data || !data.userData) {
        if(infoEl) infoEl.innerHTML = "<span style='color:red'>Không tìm thấy user!</span>";
        return;
    }
    const u = data.userData;

    // --- RENDER KHO ĐỒ ---
    let invHtml = '';

    // 1. Plant Food (Số lượng - Có nút Sửa)
    if (u.item_plant_food_count !== undefined) {
        invHtml += `
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; background:white; padding:8px; border-radius:4px; border-left:4px solid #2ecc71;">
                <div>
                    <strong>🍃 Thuốc Tăng Lực</strong><br>
                    <span style="color:#7f8c8d; font-size:0.9em;">Số lượng: <b>${u.item_plant_food_count}</b></span>
                </div>
                <button class="btn btn-edit" style="font-size:0.8em;" 
                    onclick="openEditUserItem('${uid}', 'plant_food', 'quantity', ${u.item_plant_food_count})">
                    ✏️ Sửa
                </button>
            </div>
        `;
    }

    // 2. Sun Pack (Gói Mặt Trời)
    if (u.inventory && u.inventory.includes('sun_pack')) {
        invHtml += `
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; background:white; padding:8px; border-radius:4px; border-left:4px solid #f1c40f;">
                <div>
                    <strong>☀️ Gói Mặt Trời (Vĩnh viễn)</strong><br>
                    <span style="color:#7f8c8d; font-size:0.9em;">Đang kích hoạt</span>
                </div>
                <button class="btn btn-edit" style="font-size:0.8em;" 
                    onclick="openEditUserItem('${uid}', 'sun_pack', 'duration', 'permanent')">
                    ⚙️ Chỉnh sửa
                </button>
            </div>
        `;
    } 
    else if (u.temp_items && u.temp_items.sun_pack) {
        const expireTime = u.temp_items.sun_pack.toDate();
        const now = new Date();
        const timeLeft = Math.ceil((expireTime - now) / (1000 * 60 * 60 * 24)); 
        const isExpired = timeLeft <= 0;
        
        invHtml += `
            <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; background:white; padding:8px; border-radius:4px; border-left:4px solid ${isExpired ? '#95a5a6' : '#e67e22'};">
                <div>
                    <strong>☀️ Gói Mặt Trời (${isExpired ? 'Hết hạn' : 'Có hạn'})</strong><br>
                    <span style="color:#7f8c8d; font-size:0.9em;">Hết hạn: ${expireTime.toLocaleDateString()} (${timeLeft} ngày)</span>
                </div>
                <button class="btn btn-edit" style="font-size:0.8em;" 
                    onclick="openEditUserItem('${uid}', 'sun_pack', 'duration', '${expireTime.getTime()}')">
                    ⚙️ Gia hạn/Xóa
                </button>
            </div>
        `;
    }

    if (invHtml === '') invHtml = '<em style="color:#999">Túi đồ trống</em>';

    infoEl.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div><strong>Email:</strong> ${u.email}</div>
            <div><strong>VNCoin:</strong> <span style="color:#f1c40f; font-weight:bold;">${(u.vn_coin || 0).toLocaleString()}</span></div>
            <div style="grid-column: 1/-1; background:#eee; padding:15px; border-radius:8px;">
                <strong style="display:block; margin-bottom:10px; border-bottom:1px solid #ddd; padding-bottom:5px;">🎒 Quản lý Kho đồ:</strong>
                ${invHtml}
            </div>
        </div>
    `;

    if (data.logs.length > 0 && tbody) {
        data.logs.forEach(log => {
            const date = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('vi-VN') : 'N/A';
            const color = log.amount >= 0 ? '#27ae60' : '#c0392b';
            tbody.innerHTML += `<tr><td>${date}</td><td>${log.type}</td><td>${log.assetType}</td><td style="color:${color};font-weight:bold;">${log.amount.toLocaleString()}</td><td>${log.note}</td></tr>`;
        });
    }
};

// [FIX] MỞ MODAL SỬA ITEM USER (Kiểm tra modal tồn tại)
window.openEditUserItem = (uid, itemKey, type, currentValue) => {
    editingUserUid = uid;
    editingItemKey = itemKey;
    editingItemType = type;

    const modal = document.getElementById('modal-edit-player-item');
    if (!modal) {
        alert("Lỗi: Không tìm thấy modal sửa item! Hãy chắc chắn bạn đã cập nhật file admin.html.");
        return;
    }

    const nameEl = document.getElementById('edit-item-name');
    const qtyGroup = document.getElementById('edit-qty-group');
    const durGroup = document.getElementById('edit-duration-group');

    modal.classList.remove('hidden');
    nameEl.innerText = itemKey === 'plant_food' ? "Thuốc Tăng Lực" : "Gói Mặt Trời";

    if (type === 'quantity') {
        qtyGroup.classList.remove('hidden');
        durGroup.classList.add('hidden');
        document.getElementById('edit-item-qty').value = currentValue;
    } else {
        qtyGroup.classList.add('hidden');
        durGroup.classList.remove('hidden');
        document.getElementById('edit-item-duration-select').value = '1';
        document.getElementById('edit-item-custom-days').classList.add('hidden');
    }
};

// XỬ LÝ NÚT LƯU TRONG MODAL USER ITEM
window.submitEditUserItem = async () => {
    const userRef = doc(db, "users", editingUserUid);
    const adminUser = auth.currentUser;

    try {
        if (editingItemType === 'quantity') {
            const newQty = parseInt(document.getElementById('edit-item-qty').value);
            if (isNaN(newQty) || newQty < 0) return alert("Số lượng không hợp lệ!");

            await updateDoc(userRef, { item_plant_food_count: newQty });
            await saveLog(editingUserUid, "ADMIN_EDIT", "Item", 0, `Admin chỉnh Plant Food thành: ${newQty}`);
        } 
        else if (editingItemType === 'duration') {
            const action = document.getElementById('edit-item-duration-select').value;
            
            if (action === 'remove') {
                await updateDoc(userRef, {
                    inventory: arrayRemove('sun_pack'),
                    [`temp_items.${editingItemKey}`]: deleteField() 
                });
                await saveLog(editingUserUid, "ADMIN_REVOKE", "Item", 0, `Admin xóa: ${editingItemKey}`);
            } 
            else if (action === 'permanent') {
                await updateDoc(userRef, {
                    inventory: arrayUnion('sun_pack'),
                    [`temp_items.${editingItemKey}`]: deleteField()
                });
                await saveLog(editingUserUid, "ADMIN_GIFT", "Item", 0, `Admin set Vĩnh viễn: ${editingItemKey}`);
            } 
            else {
                let days = 0;
                if (action === 'custom') {
                    days = parseInt(document.getElementById('edit-item-custom-days').value);
                } else {
                    days = parseInt(action);
                }
                
                if (isNaN(days) || days <= 0) return alert("Số ngày không hợp lệ!");

                const expireDate = new Date();
                expireDate.setDate(expireDate.getDate() + days);

                await updateDoc(userRef, {
                    inventory: arrayRemove('sun_pack'),
                    [`temp_items.${editingItemKey}`]: expireDate
                });
                await saveLog(editingUserUid, "ADMIN_GIFT", "Item", 0, `Admin set hạn ${days} ngày: ${editingItemKey}`);
            }
        }

        alert("Cập nhật thành công!");
        closeModal('modal-edit-player-item');
        showUserDetail(editingUserUid);
    } catch (error) {
        alert("Lỗi: " + error.message);
    }
};

const btnSaveAnnouncement = document.getElementById('btn-save-announcement');
if (btnSaveAnnouncement) {
    btnSaveAnnouncement.addEventListener('click', async () => {
        const content = document.getElementById('announcement-content').value;
        const docRef = doc(db, "system_config", "general");
        try {
            await setDoc(docRef, { announcement: content }, { merge: true });
            alert("✅ Đã cập nhật thông báo!");
        } catch (error) { alert("Lỗi: " + error.message); }
    });
}

const btnSaveConfig = document.getElementById('btn-save-config');
if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async () => {
        const isMaintenance = document.getElementById('maintenance-mode').value === "true";
        const msg = document.getElementById('maintenance-msg').value;
        const duration = document.getElementById('maintenance-duration').value;
        let endTime = null;

        if (isMaintenance) {
            const now = new Date();
            if (duration === 'custom') {
                const customDateVal = document.getElementById('maintenance-custom-date').value;
                if (!customDateVal) return alert("Vui lòng chọn ngày giờ!");
                endTime = new Date(customDateVal);
            } else {
                endTime = new Date(now.getTime() + parseInt(duration) * 60000);
            }
        }

        try {
            await setDoc(doc(db, "system_config", "general"), { 
                maintenance: isMaintenance,
                maintenance_message: msg,
                maintenance_end_time: endTime 
            }, { merge: true });
            alert(isMaintenance ? `✅ Đã bật bảo trì` : "✅ Đã tắt bảo trì!");
        } catch (error) { alert("Lỗi: " + error.message); }
    });
}

// 4. TIỆN ÍCH CHUNG
window.openBanModal = (uid, email) => {
    currentBanId = uid;
    document.getElementById('ban-email').innerText = email;
    document.getElementById('modal-ban-user').classList.remove('hidden');
};

window.confirmBan = async () => {
    const days = parseInt(document.getElementById('ban-duration').value);
    const banDate = new Date();
    banDate.setDate(banDate.getDate() + days); 
    try {
        await updateDoc(doc(db, "users", currentBanId), { bannedUntil: banDate });
        alert("Đã cấm thành công!");
        closeModal('modal-ban-user');
    } catch (error) { alert("Lỗi: " + error.message); }
};

window.unbanUser = async (uid) => {
    if(confirm("Gỡ lệnh cấm?")) {
        try {
            await updateDoc(doc(db, "users", uid), { bannedUntil: null });
            alert("Đã gỡ cấm!");
        } catch (error) { alert("Lỗi: " + error.message); }
    }
};

const searchBox = document.getElementById('search-box');
if(searchBox) {
    searchBox.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        const filteredUsers = allUsers.filter(u => u.email.toLowerCase().includes(keyword));
        renderTable(filteredUsers);
    });
}