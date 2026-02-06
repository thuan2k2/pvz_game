// file: src/dashboard.js
import { db, auth, storage } from '../firebase/config.js'; 
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage"; 

// --- PHẦN 1: QUẢN LÝ USER (GIỮ NGUYÊN) ---
let tableBody, usersTable;

document.addEventListener("DOMContentLoaded", () => {
    tableBody = document.getElementById('user-list'); 
    usersTable = document.querySelector('#section-users table'); 
});

// 1. BẢO MẬT: Kiểm tra quyền Admin
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Vui lòng đăng nhập trước!");
        window.location.href = 'login.html';
        return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().role === 'admin') {
        console.log("Welcome Admin: " + user.email);
        loadUserList(); 
        if(window.filterGameData) window.filterGameData('plants'); // Load mặc định
    } else {
        alert("CẢNH BÁO: Bạn không có quyền truy cập Admin Panel!");
        window.location.href = 'index.html';
    }
});

// 2. Tải danh sách người chơi
async function loadUserList() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const listBody = document.getElementById('user-list');
        if (!listBody) return;
        
        listBody.innerHTML = ''; 

        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            const userId = docSnap.id;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${userData.email}</td>
                <td>${userData.phone || "---"}</td>
                <td>${userData.coins || 0}</td>
                <td>${userData.vn_coin || 0}</td>
                <td><span class="badge-active">Hoạt động</span></td>
                <td>
                    <button class="btn btn-edit" onclick="window.editCoin('${userId}', ${userData.coins || 0})">Sửa</button>
                    <button class="btn btn-ban">Khóa</button> 
                </td>
            `;
            listBody.appendChild(row);
        });
        
        const totalEl = document.getElementById('total-users');
        if(totalEl) totalEl.innerText = querySnapshot.size;

    } catch (error) {
        console.error("Lỗi tải danh sách user:", error);
    }
}

// 4. Hàm sửa tiền User
window.editCoin = async (userId, currentCoin) => {
    const newAmount = prompt(`Nhập số coin mới (Hiện tại: ${currentCoin}):`, currentCoin);
    if (newAmount !== null && !isNaN(newAmount)) {
        try {
            await updateDoc(doc(db, "users", userId), { coins: parseInt(newAmount) });
            alert("Cập nhật thành công!");
            loadUserList(); 
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    }
};


// --- PHẦN 2: [CẬP NHẬT] QUẢN LÝ CÂY TRỒNG & ZOMBIE ---

// A. Các hàm hỗ trợ UI (Gắn vào window để HTML gọi được)

// 1. Xử lý Logic Form (Ẩn/Hiện giá tiền)
window.handleTypeChange = () => {
    const type = document.getElementById('gd_type').value;
    const plantGroup = document.getElementById('group-plant-stats');
    const bulletGroup = document.getElementById('group-bullet');
    
    if (type === 'zombies') {
        plantGroup.style.display = 'none'; // Zombie không có giá tiền
        if(bulletGroup) bulletGroup.style.display = 'none';
        document.getElementById('gd_cost').value = 0;
    } else {
        plantGroup.style.display = 'block';
        if(bulletGroup) bulletGroup.style.display = 'block';
    }
};

// 2. Mở Modal để Thêm Mới
window.openAddModal = () => {
    document.getElementById('form-game-data').reset();
    document.getElementById('modal-title').innerText = "Thêm Dữ Liệu Mới";
    document.getElementById('gd_id').disabled = false; // Cho phép nhập ID
    
    // Reset ảnh preview
    document.querySelectorAll('.img-preview-box img').forEach(img => img.src = "");
    // Reset link ảnh ẩn
    document.getElementById('url_card_hidden').value = "";
    document.getElementById('url_plant_hidden').value = "";
    document.getElementById('url_bullet_hidden').value = "";

    document.getElementById('modal-game-data').classList.remove('hidden');
    window.handleTypeChange();
};

// 3. Mở Modal để Sửa (Edit)
window.editGameData = async (id) => {
    try {
        const docSnap = await getDoc(doc(db, "game_data", id));
        if (!docSnap.exists()) return alert("Dữ liệu không tồn tại!");
        
        const data = docSnap.data();
        
        // Điền dữ liệu vào form
        document.getElementById('gd_type').value = data.type || 'plants';
        document.getElementById('gd_id').value = data.id;
        document.getElementById('gd_id').disabled = true; // Cấm sửa ID
        document.getElementById('gd_name').value = data.name;
        document.getElementById('gd_cost').value = data.price || 0;
        document.getElementById('gd_damage').value = data.damage || 0;
        document.getElementById('gd_speed').value = data.speed || 0;
        document.getElementById('gd_hp').value = data.hp || 100;

        // Điền link ảnh cũ vào hidden input và hiển thị preview
        const cardImg = data.cardImage || "";
        const plantImg = data.plantImage || "";
        const bulletImg = data.bulletImage || "";

        document.getElementById('url_card_hidden').value = cardImg;
        document.getElementById('url_plant_hidden').value = plantImg;
        document.getElementById('url_bullet_hidden').value = bulletImg;

        document.getElementById('prev_card').src = cardImg;
        document.getElementById('prev_plant').src = plantImg;
        document.getElementById('prev_bullet').src = bulletImg;

        document.getElementById('modal-title').innerText = "Sửa: " + data.name;
        document.getElementById('modal-game-data').classList.remove('hidden');
        window.handleTypeChange();

    } catch (error) {
        console.error(error);
        alert("Lỗi tải dữ liệu sửa: " + error.message);
    }
};

// 4. Xóa Dữ Liệu
window.deleteGameData = async (id) => {
    if(!confirm(`Bạn chắc chắn muốn xóa ${id}? Hành động này không thể hoàn tác!`)) return;
    try {
        await deleteDoc(doc(db, "game_data", id));
        alert("🗑️ Đã xóa thành công!");
        
        const currentType = document.querySelector('.tab-btn.active')?.innerText.includes('Zombie') ? 'zombies' : 'plants';
        window.filterGameData(currentType);
    } catch (error) {
        alert("Lỗi xóa: " + error.message);
    }
};

// B. Xử lý Upload và Lưu

async function uploadImageToStorage(file, folderName, fileName) {
    if (!file) return null; // Trả về null nếu không có file mới
    const storageRef = sRef(storage, `assets/${folderName}/${fileName}`);
    await uploadBytes(storageRef, file); 
    return await getDownloadURL(storageRef); 
}

const gameDataForm = document.getElementById('form-game-data');
if (gameDataForm) {
    gameDataForm.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        
        // Nút nào được bấm? (Trong HTML form có button type=submit)
        const btn = document.querySelector('#form-game-data button[type="submit"]'); 
        const originalText = btn.innerText;
        btn.innerText = "Đang Lưu... ⏳";
        btn.disabled = true;

        try {
            const type = document.getElementById('gd_type').value;
            const id = document.getElementById('gd_id').value.trim();
            const name = document.getElementById('gd_name').value.trim();
            
            if (!id || !name) throw new Error("Vui lòng nhập ID và Tên!");

            // 1. Xử lý ảnh: Nếu có file mới thì upload, không thì dùng link cũ (từ hidden input)
            const fileCard = document.getElementById('file_card').files[0];
            const filePlant = document.getElementById('file_plant').files[0];
            const fileBullet = document.getElementById('file_bullet').files[0];

            // Upload song song nếu có file mới
            const [newUrlCard, newUrlPlant, newUrlBullet] = await Promise.all([
                uploadImageToStorage(fileCard, 'card', `${id}.png`),
                uploadImageToStorage(filePlant, type === 'plants' ? 'plant' : 'zombie', `${id}.png`),
                uploadImageToStorage(fileBullet, 'pea', `${id}_bullet.png`)
            ]);

            // Logic chọn ảnh: Mới -> Cũ -> Rỗng
            const finalCard = newUrlCard || document.getElementById('url_card_hidden').value || "";
            const finalPlant = newUrlPlant || document.getElementById('url_plant_hidden').value || "";
            const finalBullet = newUrlBullet || document.getElementById('url_bullet_hidden').value || "";

            // 2. Chuẩn bị dữ liệu
            const newData = {
                id: id,
                name: name,
                type: type,
                price: parseInt(document.getElementById('gd_cost').value) || 0,
                damage: parseInt(document.getElementById('gd_damage').value) || 0,
                speed: parseFloat(document.getElementById('gd_speed').value) || 0,
                hp: parseInt(document.getElementById('gd_hp').value) || 100,
                
                // Lưu link ảnh
                cardImage: finalCard,
                plantImage: finalPlant,
                bulletImage: finalBullet,
                
                // Cấu trúc lồng nhau để tương thích với GameCore cũ
                stats: {
                    damage: parseInt(document.getElementById('gd_damage').value) || 0,
                    speed: parseFloat(document.getElementById('gd_speed').value) || 0,
                    hp: parseInt(document.getElementById('gd_hp').value) || 100,
                },
                assets: {
                    card: finalCard,
                    plant: finalPlant,
                    bullet: finalBullet
                }
            };

            // 3. Lưu vào Firestore (merge: true để cập nhật)
            await setDoc(doc(db, "game_data", id), newData, { merge: true });

            alert(`✅ Đã lưu thành công ${name}!`);
            document.getElementById('modal-game-data').classList.add('hidden');
            
            // Reload lại danh sách
            if(window.filterGameData) window.filterGameData(type);

        } catch (error) {
            console.error(error);
            alert("❌ Lỗi: " + error.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

// C. Tải danh sách
window.filterGameData = async (type) => {
    const listBody = document.getElementById('game-data-list');
    if(!listBody) return;
    
    // Update nút active style
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    // Tìm nút có onclick chứa type và active nó
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if(btn.getAttribute('onclick').includes(type)) btn.classList.add('active');
    });

    listBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Đang tải dữ liệu ${type}...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "game_data"));
        listBody.innerHTML = ''; 
        let hasData = false;

        querySnapshot.forEach((doc) => {
            const item = doc.data();
            const itemType = item.type || 'plants'; 

            if (itemType === type) {
                hasData = true;
                const imgUrl = item.cardImage || item.plantImage || "https://via.placeholder.com/50";
                
                // Hiển thị thông minh
                const priceDisplay = type === 'plants' ? `${item.price} ☀️` : '-';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><b>${item.id}</b></td>
                    <td><img src="${imgUrl}" style="height:50px; object-fit:contain;"></td>
                    <td>${item.name}</td>
                    <td>${priceDisplay}</td>
                    <td>${item.damage || 0}</td>
                    <td>${item.speed || 0}</td>
                    <td>
                        <button class="btn btn-edit" onclick="editGameData('${item.id}')">Sửa</button>
                        <button class="btn btn-ban" onclick="deleteGameData('${item.id}')" style="background:#c0392b;">Xóa</button>
                    </td>
                `;
                listBody.appendChild(tr);
            }
        });

        if (!hasData) listBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Chưa có dữ liệu ${type}.</td></tr>`;

    } catch (error) {
        console.error(error);
        listBody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Lỗi tải data: ${error.message}</td></tr>`;
    }
};