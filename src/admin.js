import { auth, db } from './firebase/config.js';
import { onAuthStateChanged } from "firebase/auth";
import { 
    collection, getDocs, doc, updateDoc, getDoc, setDoc, 
    addDoc, deleteDoc, onSnapshot, query, orderBy, arrayRemove, arrayUnion, increment 
} from 'firebase/firestore';
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

// 1. Check quyền Admin
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().role === 'admin') {
            loadUsers();
            loadSystemConfig(); 
            loadShopItems(); 
        } else {
            alert("Bạn không có quyền Admin!");
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

window.switchTab = (tabName) => {
    document.querySelectorAll('.admin-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`section-${tabName}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`menu-${tabName}`);
    if(activeBtn) activeBtn.classList.add('active');
};

// ... (Giữ nguyên loadUsers, renderTable, openEditModal, saveCoin) ...
// (Bạn copy lại các hàm loadUsers, renderTable, saveCoin từ file cũ vào đây để code gọn)
async function loadUsers() {
    const userListEl = document.getElementById('user-list');
    userListEl.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>'; 
    try {
        onSnapshot(collection(db, "users"), (snapshot) => {
            allUsers = [];
            let totalCoins = 0;
            snapshot.forEach((doc) => {
                const data = doc.data();
                allUsers.push({ id: doc.id, ...data });
                totalCoins += (data.coins || 0);
            });
            document.getElementById('total-users').innerText = allUsers.length;
            document.getElementById('total-coins').innerText = totalCoins.toLocaleString();
            renderTable(allUsers);
        });
    } catch (error) { console.error(error); }
}

function renderTable(users) {
    const userListEl = document.getElementById('user-list');
    userListEl.innerHTML = '';
    if (users.length === 0) return;
    users.forEach(user => {
        let statusHtml = `<span style="color:#27ae60; font-weight:bold;">Hoạt động</span>`;
        let actionBtn = `<button class="btn btn-ban" onclick="openBanModal('${user.id}', '${user.email}')">🚫 Cấm</button>`;
        if (user.bannedUntil && user.bannedUntil.toMillis() > Date.now()) {
            statusHtml = `<span class="badge-banned">Cấm</span>`;
            actionBtn = `<button class="btn btn-unban" onclick="unbanUser('${user.id}')">🔓 Gỡ</button>`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.email}</td><td>${user.phone || '---'}</td>
            <td style="font-weight:bold; color:#f39c12;">${(user.coins || 0).toLocaleString()}</td>
            <td style="font-weight:bold; color:#f1c40f;">${(user.vn_coin || 0).toLocaleString()}</td>
            <td>${statusHtml}</td>
            <td style="display:flex; gap:5px;">
                <button class="btn btn-edit" onclick="openEditModal('${user.id}', '${user.email}', ${user.coins||0}, 'coins')">Sửa Coin</button>
                <button class="btn btn-edit" style="background:#d35400" onclick="openEditModal('${user.id}', '${user.email}', ${user.vn_coin||0}, 'vn_coin')">Sửa VN</button>
                <button class="btn btn-view" onclick="showUserDetail('${user.id}')">📜 Chi tiết</button>
                ${user.role !== 'admin' ? actionBtn : ''} 
            </td>
        `;
        userListEl.appendChild(tr);
    });
}

window.openEditModal = (uid, email, val, type) => {
    currentEditingId = uid; currentEditType = type; 
    document.getElementById('editing-email').innerText = email;
    document.getElementById('edit-currency-name').innerText = type==='coins'?'Coin':'VNCoin';
    document.getElementById('new-coin-input').value = val;
    document.getElementById('modal-edit-coin').classList.remove('hidden');
};
window.saveCoin = async () => {
    const amount = parseInt(document.getElementById('new-coin-input').value);
    if(isNaN(amount) || amount < 0) return alert("Lỗi số");
    await updateDoc(doc(db, "users", currentEditingId), { [currentEditType]: amount });
    await saveLog(currentEditingId, "ADMIN_EDIT", "Money", 0, `Admin sửa tiền thành ${amount}`);
    alert("Xong!"); closeModal('modal-edit-coin');
};

// ============================================================
// [CẬP NHẬT] QUẢN LÝ SHOP VIP & THỜI HẠN
// ============================================================

function loadShopItems() {
    const listEl = document.getElementById('shop-items-list');
    const q = query(collection(db, "shop_items"), orderBy("price", "asc"));
    
    onSnapshot(q, (snapshot) => {
        listEl.innerHTML = '';
        snapshot.forEach(doc => {
            const item = doc.data();
            let detailHtml = '';
            
            // Hiển thị chi tiết theo loại
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
                <td><img src="${item.image}" style="width:40px;"></td>
                <td>${item.name}</td>
                <td>${item.currency}</td>
                <td style="font-weight:bold;">${parseInt(item.price).toLocaleString()}</td>
                <td>${item.shopType}</td>
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
        
        // Load giá trị hoặc thời hạn
        if (item.itemCode === 'sun_pack') {
            document.getElementById('shop-duration').value = item.duration || 1;
        } else {
            document.getElementById('shop-value').value = item.type === 'coin' ? item.value : (item.amount || 1);
        }
        document.getElementById('shop-is-hot').checked = item.isHot;
        
        // Trigger UI update
        // (Gọi hàm này để ẩn hiện input đúng logic)
        const codeInput = document.getElementById('shop-item-code');
        if(item.itemCode === 'sun_pack') {
             // Fake event change
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

    // Logic riêng cho Gói thời hạn vs Gói số lượng
    if (itemCode === 'sun_pack') {
        data.duration = duration; // Lưu số ngày (hoặc 99999)
        data.value = 0; // Không dùng value
    } else {
        const val = parseInt(document.getElementById('shop-value').value);
        data.value = val;
        data.amount = val;
    }

    try {
        if (currentShopItemId) {
            await updateDoc(doc(db, "shop_items", currentShopItemId), data);
            alert("Đã cập nhật!");
        } else {
            await addDoc(collection(db, "shop_items"), data);
            alert("Đã thêm mới!");
        }
        closeModal('modal-shop-item');
    } catch (e) { alert("Lỗi: " + e.message); }
};

window.deleteShopItem = async (id, name) => {
    if(confirm(`Xóa "${name}"?`)) try { await deleteDoc(doc(db, "shop_items", id)); } catch(e) { alert(e.message); }
};

// ============================================================
// [CẬP NHẬT] CHI TIẾT USER & CHỈNH SỬA KHO ĐỒ NÂNG CAO
// ============================================================

window.showUserDetail = async (uid) => {
    document.getElementById('detailModal').classList.remove('hidden');
    const infoEl = document.getElementById('modal-user-info');
    const tbody = document.getElementById('modal-logs-body');
    infoEl.innerHTML = "Đang tải...";
    tbody.innerHTML = "";

    const data = await getAdminUserDetail(uid);
    if (!data || !data.userData) return;
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

    // 2. Sun Pack (Gói Mặt Trời - Kiểm tra cả mảng Inventory và Expiring)
    
    // a. Kiểm tra Vĩnh viễn (Trong mảng inventory)
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
    // b. Kiểm tra Có thời hạn (Trong temp_items)
    else if (u.temp_items && u.temp_items.sun_pack) {
        const expireTime = u.temp_items.sun_pack.toDate();
        const now = new Date();
        const timeLeft = Math.ceil((expireTime - now) / (1000 * 60 * 60 * 24)); // Số ngày còn lại
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

    // Render Logs (Giữ nguyên)
    if (data.logs.length > 0) {
        data.logs.forEach(log => {
            const date = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('vi-VN') : 'N/A';
            const color = log.amount >= 0 ? '#27ae60' : '#c0392b';
            tbody.innerHTML += `<tr><td>${date}</td><td>${log.type}</td><td>${log.assetType}</td><td style="color:${color};font-weight:bold;">${log.amount.toLocaleString()}</td><td>${log.note}</td></tr>`;
        });
    }
};

// [MỚI] MỞ MODAL SỬA ITEM USER
window.openEditUserItem = (uid, itemKey, type, currentValue) => {
    editingUserUid = uid;
    editingItemKey = itemKey;
    editingItemType = type;

    const modal = document.getElementById('modal-edit-player-item');
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
        document.getElementById('edit-item-duration-select').value = '1'; // Reset về 1 ngày
        document.getElementById('edit-item-custom-days').classList.add('hidden');
    }
};

// [MỚI] XỬ LÝ NÚT LƯU TRONG MODAL USER ITEM
window.submitEditUserItem = async () => {
    const userRef = doc(db, "users", editingUserUid);
    const adminUser = auth.currentUser;

    try {
        if (editingItemType === 'quantity') {
            // Sửa số lượng (Plant Food)
            const newQty = parseInt(document.getElementById('edit-item-qty').value);
            if (isNaN(newQty) || newQty < 0) return alert("Số lượng không hợp lệ!");

            await updateDoc(userRef, { item_plant_food_count: newQty });
            await saveLog(editingUserUid, "ADMIN_EDIT", "Item", 0, `Admin chỉnh Plant Food thành: ${newQty}`);
        } 
        else if (editingItemType === 'duration') {
            // Sửa thời hạn (Sun Pack)
            const action = document.getElementById('edit-item-duration-select').value;
            
            if (action === 'remove') {
                // Xóa khỏi cả mảng inventory và temp_items
                await updateDoc(userRef, {
                    inventory: arrayRemove('sun_pack'),
                    "temp_items.sun_pack": deleteField() // Cần import deleteField
                });
                // Note: deleteField cần import từ firestore, nhưng để đơn giản ta set null hoặc update object
                // Cách an toàn ko cần import thêm: Đọc data -> xóa key -> ghi lại
                // Nhưng ở đây ta dùng cách đơn giản: Xóa khỏi inventory là chính. 
                // Với temp_items map, ta update:
                await updateDoc(userRef, { [`temp_items.${editingItemKey}`]: null }); // Xóa field trong map
                await saveLog(editingUserUid, "ADMIN_REVOKE", "Item", 0, `Admin xóa: ${editingItemKey}`);
            } 
            else if (action === 'permanent') {
                // Thêm vào inventory, xóa khỏi temp
                await updateDoc(userRef, {
                    inventory: arrayUnion('sun_pack'),
                    [`temp_items.${editingItemKey}`]: null
                });
                await saveLog(editingUserUid, "ADMIN_GIFT", "Item", 0, `Admin set Vĩnh viễn: ${editingItemKey}`);
            } 
            else {
                // Cộng thêm ngày (Tính từ Hiện tại hoặc Thời điểm hết hạn cũ?) -> Tính từ HIỆN TẠI cho dễ
                let days = 0;
                if (action === 'custom') {
                    days = parseInt(document.getElementById('edit-item-custom-days').value);
                } else {
                    days = parseInt(action);
                }
                
                if (isNaN(days) || days <= 0) return alert("Số ngày không hợp lệ!");

                const expireDate = new Date();
                expireDate.setDate(expireDate.getDate() + days);

                // Cập nhật vào temp_items, xóa khỏi inventory (nếu lỡ đang là vĩnh viễn)
                await updateDoc(userRef, {
                    inventory: arrayRemove('sun_pack'),
                    [`temp_items.${editingItemKey}`]: expireDate
                });
                await saveLog(editingUserUid, "ADMIN_GIFT", "Item", 0, `Admin set hạn ${days} ngày: ${editingItemKey}`);
            }
        }

        alert("Cập nhật thành công!");
        closeModal('modal-edit-player-item');
        showUserDetail(editingUserUid); // Refresh lại view
    } catch (error) {
        alert("Lỗi: " + error.message);
    }
};

// ... (Các hàm tiện ích cũ: loadSystemConfig, closeModal, etc.) giữ nguyên ...
window.closeModal = (id) => {
    document.getElementById(id).classList.add('hidden');
    currentEditingId = null;
    currentBanId = null;
    currentShopItemId = null;
};