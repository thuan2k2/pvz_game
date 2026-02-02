import { auth, db } from './firebase/config.js';
import { onAuthStateChanged } from "firebase/auth";
import { 
    collection, getDocs, doc, updateDoc, getDoc, setDoc, 
    addDoc, deleteDoc, onSnapshot, query, orderBy 
} from 'firebase/firestore';
// Import hàm lấy chi tiết và hàm Ghi Log
import { getAdminUserDetail, saveLog } from './firebase/auth.js';

let allUsers = []; 
let currentEditingId = null;
let currentEditType = 'coins'; // 'coins' hoặc 'vn_coin'
let currentBanId = null; 
let currentShopItemId = null; // ID vật phẩm đang sửa (null nếu là thêm mới)

// 1. Check quyền Admin
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().role === 'admin') {
            // Tải dữ liệu ban đầu
            loadUsers();
            loadSystemConfig(); 
            loadShopItems(); // [MỚI] Tải danh sách Shop
        } else {
            alert("Bạn không có quyền Admin!");
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// --- [MỚI] CHUYỂN TAB QUẢN LÝ ---
window.switchTab = (tabName) => {
    // Ẩn tất cả section
    document.querySelectorAll('.admin-section').forEach(el => el.classList.add('hidden'));
    // Bỏ active tất cả menu
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

    // Hiện section được chọn
    document.getElementById(`section-${tabName}`).classList.remove('hidden');
    // Active menu tương ứng (cần set ID bên HTML sau)
    const activeBtn = document.getElementById(`menu-${tabName}`);
    if(activeBtn) activeBtn.classList.add('active');
};

// ============================================================
// 1. QUẢN LÝ NGƯỜI CHƠI (USER)
// ============================================================

async function loadUsers() {
    const userListEl = document.getElementById('user-list');
    userListEl.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>'; 

    try {
        // Dùng onSnapshot để tự động cập nhật nếu có người nạp tiền
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

            // Cập nhật thống kê
            document.getElementById('total-users').innerText = allUsers.length;
            document.getElementById('total-coins').innerText = totalCoins.toLocaleString();
            // Nếu có thẻ hiển thị tổng VNCoin thì gán vào đây
            
            renderTable(allUsers);
        });
    } catch (error) {
        console.error(error);
        userListEl.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Lỗi tải dữ liệu</td></tr>';
    }
}

function renderTable(users) {
    const userListEl = document.getElementById('user-list');
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

// --- LOGIC SỬA TIỀN (COIN & VNCOIN) ---
window.openEditModal = (uid, email, currentValue, type) => {
    currentEditingId = uid;
    currentEditType = type; // 'coins' hoặc 'vn_coin'
    
    document.getElementById('editing-email').innerText = email;
    document.getElementById('edit-currency-name').innerText = type === 'coins' ? 'Coin Game' : 'VNCoin (Nạp)';
    document.getElementById('new-coin-input').value = currentValue;
    document.getElementById('modal-edit-coin').classList.remove('hidden');
};

window.saveCoin = async () => {
    const amount = parseInt(document.getElementById('new-coin-input').value);
    if (isNaN(amount) || amount < 0) return alert("Số không hợp lệ");
    
    try {
        // 1. Lấy dữ liệu cũ để tính biến động
        const userRef = doc(db, "users", currentEditingId);
        const userSnap = await getDoc(userRef);
        const oldVal = userSnap.data()[currentEditType] || 0;
        
        // 2. Cập nhật tiền mới
        await updateDoc(userRef, { [currentEditType]: amount });

        // 3. Ghi Log hành động của Admin
        const adminUser = auth.currentUser;
        await saveLog(
            currentEditingId, 
            "ADMIN_EDIT", 
            currentEditType === 'coins' ? 'Coin' : 'VNCoin',
            amount - oldVal, // Số lượng thay đổi (+ hoặc -)
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
// 2. QUẢN LÝ SHOP VIP (REAL-TIME)
// ============================================================

function loadShopItems() {
    const listEl = document.getElementById('shop-items-list');
    // Lắng nghe thay đổi realtime từ collection 'shop_items'
    const q = query(collection(db, "shop_items"), orderBy("price", "asc"));
    
    onSnapshot(q, (snapshot) => {
        listEl.innerHTML = '';
        if(snapshot.empty) {
            listEl.innerHTML = '<tr><td colspan="7" style="text-align:center;">Chưa có sản phẩm nào. Hãy thêm mới!</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const item = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${item.image}" style="width:50px; height:50px; object-fit:contain; border:1px solid #ddd; border-radius:5px;"></td>
                <td>${item.name}</td>
                <td>${item.currency}</td>
                <td style="font-weight:bold;">${parseInt(item.price).toLocaleString()}</td>
                <td>${item.shopType === 'vncoin' ? '<span class="badge-active">VIP</span>' : '<span style="color:gray">Thường</span>'}</td>
                <td>${item.isHot ? '🔥 Hot' : ''}</td>
                <td>
                    <button class="btn btn-edit" onclick='openShopModal(${JSON.stringify({id: doc.id, ...item})})'>✏️ Sửa</button>
                    <button class="btn btn-ban" onclick="deleteShopItem('${doc.id}', '${item.name}')">🗑 Xóa</button>
                </td>
            `;
            listEl.appendChild(tr);
        });
    });
}

// Mở Modal Thêm/Sửa
window.openShopModal = (item = null) => {
    const modal = document.getElementById('modal-shop-item');
    const title = document.getElementById('shop-modal-title');
    
    if (item) {
        // Chế độ Sửa
        currentShopItemId = item.id;
        title.innerText = "Sửa sản phẩm";
        document.getElementById('shop-name').value = item.name;
        document.getElementById('shop-desc').value = item.description;
        document.getElementById('shop-price').value = item.price;
        document.getElementById('shop-image').value = item.image;
        document.getElementById('shop-currency').value = item.currency;
        document.getElementById('shop-type').value = item.type; // coin/item
        document.getElementById('shop-value').value = item.type === 'coin' ? item.value : (item.amount || 1);
        document.getElementById('shop-item-code').value = item.itemCode || '';
        document.getElementById('shop-is-hot').checked = item.isHot;
        document.getElementById('shop-category').value = item.shopType || 'vncoin';
    } else {
        // Chế độ Thêm mới
        currentShopItemId = null;
        title.innerText = "Thêm sản phẩm mới";
        document.getElementById('form-shop-item').reset();
    }
    
    modal.classList.remove('hidden');
};

// Lưu sản phẩm (Thêm hoặc Update)
window.saveShopItem = async () => {
    const name = document.getElementById('shop-name').value;
    const price = parseInt(document.getElementById('shop-price').value);
    const currency = document.getElementById('shop-currency').value;
    const shopType = document.getElementById('shop-category').value; // vncoin hoặc coin
    
    const data = {
        name: name,
        description: document.getElementById('shop-desc').value,
        price: price,
        image: document.getElementById('shop-image').value,
        currency: currency,
        shopType: shopType,
        type: document.getElementById('shop-type').value,
        isHot: document.getElementById('shop-is-hot').checked,
        // Nếu là gói coin thì lấy value, nếu là item thì lấy amount
        value: parseInt(document.getElementById('shop-value').value), 
        amount: parseInt(document.getElementById('shop-value').value),
        itemCode: document.getElementById('shop-item-code').value
    };

    try {
        if (currentShopItemId) {
            // Update
            await updateDoc(doc(db, "shop_items", currentShopItemId), data);
            alert("Đã cập nhật sản phẩm!");
        } else {
            // Add New
            await addDoc(collection(db, "shop_items"), data);
            alert("Đã thêm sản phẩm mới!");
        }
        closeModal('modal-shop-item');
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
};

window.deleteShopItem = async (id, name) => {
    if(confirm(`Bạn chắc chắn muốn xóa "${name}"? Hành động này không thể hoàn tác.`)) {
        try {
            await deleteDoc(doc(db, "shop_items", id));
            // Không cần alert vì onSnapshot sẽ tự xóa dòng đó đi
        } catch (e) {
            alert("Lỗi xóa: " + e.message);
        }
    }
};


// ============================================================
// 3. CẤU HÌNH HỆ THỐNG
// ============================================================

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

// Xử lý nút Lưu Thông Báo
const btnSaveAnnouncement = document.getElementById('btn-save-announcement');
if (btnSaveAnnouncement) {
    btnSaveAnnouncement.addEventListener('click', async () => {
        const content = document.getElementById('announcement-content').value;
        const docRef = doc(db, "system_config", "general");
        try {
            await setDoc(docRef, { announcement: content }, { merge: true });
            alert("✅ Đã cập nhật thông báo!");
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    });
}

// Xử lý nút Lưu Bảo Trì
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
            alert(isMaintenance ? `✅ Đã bật bảo trì tới ${endTime.toLocaleTimeString()}` : "✅ Đã tắt bảo trì!");
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    });
}


// ============================================================
// 4. TIỆN ÍCH CHUNG
// ============================================================

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
    } catch (error) {
        alert("Lỗi: " + error.message);
    }
};

window.unbanUser = async (uid) => {
    if(confirm("Gỡ lệnh cấm?")) {
        try {
            await updateDoc(doc(db, "users", uid), { bannedUntil: null });
            alert("Đã gỡ cấm!");
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    }
};

window.showUserDetail = async (uid) => {
    document.getElementById('detailModal').classList.remove('hidden');
    const infoEl = document.getElementById('modal-user-info');
    const tbody = document.getElementById('modal-logs-body');
    infoEl.innerHTML = "Đang tải dữ liệu...";
    tbody.innerHTML = "";

    const data = await getAdminUserDetail(uid);
    if (!data || !data.userData) {
        infoEl.innerHTML = "<span style='color:red'>Không tìm thấy user!</span>";
        return;
    }
    const u = data.userData;
    infoEl.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div><strong>Email:</strong> ${u.email}</div>
            <div><strong>Phone:</strong> ${u.phone || '---'}</div>
            <div><strong>Coin Game:</strong> <span style="color:#27ae60">${(u.coins || 0).toLocaleString()}</span></div>
            <div><strong>VNCoin:</strong> <span style="color:#f1c40f">${(u.vn_coin || 0).toLocaleString()}</span></div>
            <div style="grid-column: 1/-1;"><strong>Kho đồ:</strong> ${u.inventory && u.inventory.length > 0 ? u.inventory.join(', ') : 'Trống'}</div>
        </div>
    `;

    if (data.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Chưa có giao dịch</td></tr>';
    } else {
        data.logs.forEach(log => {
            const date = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('vi-VN') : 'N/A';
            const color = log.amount >= 0 ? '#27ae60' : '#c0392b';
            tbody.innerHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${log.type}</td>
                    <td>${log.assetType}</td>
                    <td style="color:${color}; font-weight:bold;">${log.amount.toLocaleString()}</td>
                    <td>${log.note}</td>
                </tr>
            `;
        });
    }
};

// Tìm kiếm User (Client side filtering)
document.getElementById('search-box').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    const filteredUsers = allUsers.filter(u => u.email.toLowerCase().includes(keyword));
    renderTable(filteredUsers);
});

window.closeModal = (id) => {
    document.getElementById(id).classList.add('hidden');
    currentEditingId = null;
    currentBanId = null;
    currentShopItemId = null;
};