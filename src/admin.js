import { auth, db } from './firebase/config.js';
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
// [MỚI] Import hàm lấy chi tiết User và Log từ auth.js
import { getAdminUserDetail } from './firebase/auth.js';

let allUsers = []; 
let currentEditingId = null;
let currentBanId = null; 

// 1. Check quyền Admin
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().role === 'admin') {
            loadUsers();
            loadSystemConfig(); 
        } else {
            alert("Bạn không có quyền Admin!");
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Tải cấu hình hiện tại
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

// 2. Tải danh sách User
async function loadUsers() {
    const userListEl = document.getElementById('user-list');
    // colspan=6 vì thêm cột VNCoin
    userListEl.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>'; 

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsers = [];
        let totalCoins = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            allUsers.push({ id: doc.id, ...data });
            totalCoins += (data.coins || 0);
        });

        document.getElementById('total-users').innerText = allUsers.length;
        document.getElementById('total-coins').innerText = totalCoins.toLocaleString();

        renderTable(allUsers);
    } catch (error) {
        console.error(error);
        userListEl.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Lỗi tải dữ liệu (Kiểm tra Rules)</td></tr>';
    }
}

// 3. Vẽ bảng
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
            const dateStr = date.getFullYear() > 3000 ? "Vĩnh viễn" : date.toLocaleDateString('vi-VN');
            
            statusHtml = `<span class="badge-banned">Bị cấm đến: ${dateStr}</span>`;
            actionBtn = `<button class="btn btn-unban" onclick="unbanUser('${user.id}')">🔓 Gỡ cấm</button>`;
        }

        // [MỚI] Nút xem chi tiết
        const detailBtn = `<button class="btn btn-view" onclick="showUserDetail('${user.id}')">📜 Chi tiết</button>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.email}</td>
            <td>${user.phone || '---'}</td>
            <td style="font-weight:bold; color:#f39c12;">${(user.coins || 0).toLocaleString()}</td>
            <td style="font-weight:bold; color:#f1c40f;">${(user.vn_coin || 0).toLocaleString()}</td> <td>${statusHtml}</td>
            <td style="display:flex;">
                <button class="btn btn-edit" onclick="openEditModal('${user.id}', '${user.email}', ${user.coins || 0})">Sửa Coin</button>
                ${detailBtn}
                ${user.role !== 'admin' ? actionBtn : ''} 
            </td>
        `;
        userListEl.appendChild(tr);
    });
}

// Xử lý nút Lưu Thông Báo
const btnSaveAnnouncement = document.getElementById('btn-save-announcement');
if (btnSaveAnnouncement) {
    btnSaveAnnouncement.addEventListener('click', async () => {
        const content = document.getElementById('announcement-content').value;
        const docRef = doc(db, "system_config", "general");
        
        try {
            await setDoc(docRef, { announcement: content }, { merge: true });
            alert("✅ Đã cập nhật thông báo thành công!");
        } catch (error) {
            console.error("Lỗi:", error);
            alert("Lỗi khi lưu: " + error.message);
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
                if (!customDateVal) {
                    alert("Vui lòng chọn ngày giờ cụ thể!");
                    return;
                }
                endTime = new Date(customDateVal);
            } else {
                const minutes = parseInt(duration);
                // Cộng thêm số phút vào thời gian hiện tại
                endTime = new Date(now.getTime() + minutes * 60000);
            }
        }

        const docRef = doc(db, "system_config", "general");

        try {
            await setDoc(docRef, { 
                maintenance: isMaintenance,
                maintenance_message: msg,
                maintenance_end_time: endTime 
            }, { merge: true });
            
            let alertMsg = isMaintenance ? "✅ Đã bật bảo trì! Server sẽ đóng lúc: " + endTime.toLocaleTimeString() : "✅ Đã tắt bảo trì!";
            alert(alertMsg);
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    });
}


// --- LOGIC CẤM USER ---
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
        const userRef = doc(db, "users", currentBanId);
        await updateDoc(userRef, {
            bannedUntil: banDate 
        });
        
        alert("Đã cấm người chơi thành công!");
        closeModal('modal-ban-user');
        loadUsers();
    } catch (error) {
        alert("Lỗi: " + error.message);
    }
};

window.unbanUser = async (uid) => {
    if(confirm("Bạn muốn gỡ lệnh cấm cho người này?")) {
        try {
            const userRef = doc(db, "users", uid);
            await updateDoc(userRef, {
                bannedUntil: null 
            });
            alert("Đã gỡ cấm!");
            loadUsers();
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    }
};

// --- [MỚI] LOGIC XEM CHI TIẾT & LỊCH SỬ ---
window.showUserDetail = async (uid) => {
    // Hiển thị modal
    document.getElementById('detailModal').classList.remove('hidden');

    const infoEl = document.getElementById('modal-user-info');
    const tbody = document.getElementById('modal-logs-body');

    infoEl.innerHTML = "Đang tải dữ liệu...";
    tbody.innerHTML = "";

    // Gọi hàm từ firebase/auth.js
    const data = await getAdminUserDetail(uid);

    if (!data || !data.userData) {
        infoEl.innerHTML = "<span style='color:red'>Không tìm thấy dữ liệu user!</span>";
        return;
    }

    const u = data.userData;
    // Hiển thị thông tin tổng quan
    infoEl.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div><strong>Email:</strong> ${u.email}</div>
            <div><strong>Phone:</strong> ${u.phone || '---'}</div>
            <div><strong>Coin Game:</strong> <span style="color:#27ae60">${(u.coins || 0).toLocaleString()}</span></div>
            <div><strong>VNCoin:</strong> <span style="color:#f1c40f">${(u.vn_coin || 0).toLocaleString()}</span></div>
            <div style="grid-column: 1/-1;"><strong>Kho đồ:</strong> ${u.inventory && u.inventory.length > 0 ? u.inventory.join(', ') : 'Trống'}</div>
        </div>
    `;

    // Render Logs (Lịch sử giao dịch)
    if (data.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Chưa có giao dịch nào</td></tr>';
    } else {
        data.logs.forEach(log => {
            const date = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('vi-VN') : 'N/A';
            const isPositive = log.amount >= 0;
            const color = isPositive ? '#27ae60' : '#c0392b';
            const sign = isPositive ? '+' : '';

            tbody.innerHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${log.type}</td>
                    <td>${log.assetType}</td>
                    <td style="color:${color}; font-weight:bold;">${sign}${log.amount.toLocaleString()}</td>
                    <td>${log.note}</td>
                </tr>
            `;
        });
    }
};


// --- CÁC LOGIC CŨ ---
document.getElementById('search-box').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    const filteredUsers = allUsers.filter(u => u.email.toLowerCase().includes(keyword));
    renderTable(filteredUsers);
});

window.openEditModal = (uid, email, currentCoin) => {
    currentEditingId = uid;
    document.getElementById('editing-email').innerText = email;
    document.getElementById('new-coin-input').value = currentCoin;
    document.getElementById('modal-edit-coin').classList.remove('hidden');
};

window.closeModal = (id) => {
    document.getElementById(id).classList.add('hidden');
    currentEditingId = null;
    currentBanId = null;
};

window.saveCoin = async () => {
    const amount = parseInt(document.getElementById('new-coin-input').value);
    if (isNaN(amount)) return alert("Số không hợp lệ");
    try {
        await updateDoc(doc(db, "users", currentEditingId), { coins: amount });
        alert("Cập nhật thành công!");
        closeModal('modal-edit-coin');
        loadUsers();
    } catch (error) {
        alert("Lỗi: " + error.message);
    }
};