// file: src/admin/dashboard.js
import { db, auth, storage } from '../firebase/config.js'; 
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage"; 

// --- PHẦN 1: QUẢN LÝ USER ---
let tableBody, usersTable;

document.addEventListener("DOMContentLoaded", () => {
    tableBody = document.getElementById('user-list'); 
    usersTable = document.querySelector('#section-users table'); 
});

// 1. BẢO MẬT: Kiểm tra quyền Admin
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        if(window.location.pathname.includes('admin')) {
            alert("Vui lòng đăng nhập trước!");
            window.location.href = 'login.html';
        }
        return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().role === 'admin') {
        console.log("Welcome Admin: " + user.email);
        loadUserList(); 
        if(window.filterGameData) window.filterGameData('plants'); 
    } else {
        if(window.location.pathname.includes('admin')) {
            alert("CẢNH BÁO: Bạn không có quyền truy cập Admin Panel!");
            window.location.href = 'index.html';
        }
    }
});

// 2. Tải danh sách người chơi
async function loadUserList() {
    try {
        const listBody = document.getElementById('user-list');
        if (!listBody) return; 
        
        const querySnapshot = await getDocs(collection(db, "users"));
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


// --- PHẦN 2: QUẢN LÝ CÂY TRỒNG & ZOMBIE ---

// A. Các hàm hỗ trợ UI

// 1. [FIX LOGIC] Ẩn/Hiện trường nhập liệu tùy theo loại (Plant/Zombie)
window.handleTypeChange = () => {
    const type = document.getElementById('gd_type').value;
    const plantGroup = document.getElementById('group-plant-stats'); // Nhóm giá tiền
    const bulletGroup = document.getElementById('group-bullet');     // Nhóm ảnh đạn
    const behaviorGroup = document.getElementById('group-behavior'); // Nhóm hành vi
    
    if (type === 'zombies') {
        // Zombie: Ẩn giá tiền, ảnh đạn và hành vi (Zombie chưa cần behavior phức tạp)
        if(plantGroup) plantGroup.style.display = 'none';
        if(bulletGroup) bulletGroup.style.display = 'none';
        if(behaviorGroup) behaviorGroup.style.display = 'none';
        
        // Reset giá tiền về 0
        const costInput = document.getElementById('gd_cost');
        if(costInput) costInput.value = 0;
    } else {
        // Plant: Hiện đầy đủ
        if(plantGroup) plantGroup.style.display = 'block';
        if(bulletGroup) bulletGroup.style.display = 'block';
        if(behaviorGroup) behaviorGroup.style.display = 'block';
    }
};

// 2. Mở Modal Thêm Mới
window.openAddModal = () => {
    const form = document.getElementById('form-game-data');
    if(form) form.reset();
    
    document.getElementById('modal-title').innerText = "Thêm Dữ Liệu Mới";
    const idInput = document.getElementById('gd_id');
    if(idInput) idInput.disabled = false; 
    
    // Reset ảnh
    document.querySelectorAll('.img-preview-box img').forEach(img => img.src = "");
    if(document.getElementById('url_card_hidden')) document.getElementById('url_card_hidden').value = "";
    if(document.getElementById('url_plant_hidden')) document.getElementById('url_plant_hidden').value = "";
    if(document.getElementById('url_bullet_hidden')) document.getElementById('url_bullet_hidden').value = "";

    document.getElementById('modal-game-data').classList.remove('hidden');
    
    if(window.handleTypeChange) window.handleTypeChange();
};

// 3. [CẬP NHẬT] Mở Modal Sửa (Đổ dữ liệu cũ vào form)
window.editGameData = async (id) => {
    try {
        const docSnap = await getDoc(doc(db, "game_data", id));
        if (!docSnap.exists()) return alert("Dữ liệu không tồn tại!");
        
        const data = docSnap.data();
        
        // Đổ dữ liệu cơ bản
        document.getElementById('gd_type').value = data.type || 'plants';
        document.getElementById('gd_id').value = data.id;
        document.getElementById('gd_id').disabled = true; 
        document.getElementById('gd_name').value = data.name;
        
        // [MỚI] Đổ dữ liệu hành vi
        if(document.getElementById('gd_behavior')) {
            document.getElementById('gd_behavior').value = data.behavior || 'shooter';
        }
        
        // Đổ chỉ số
        const price = data.price !== undefined ? data.price : (data.cost || 0);
        const damage = data.damage !== undefined ? data.damage : (data.stats?.damage || 0);
        const speed = data.speed !== undefined ? data.speed : (data.stats?.speed || 0);
        const hp = data.hp !== undefined ? data.hp : (data.stats?.hp || 100);

        document.getElementById('gd_cost').value = price;
        document.getElementById('gd_damage').value = damage;
        document.getElementById('gd_speed').value = speed;
        document.getElementById('gd_hp').value = hp;

        // Đổ ảnh
        const cardImg = data.cardImage || data.assets?.card || "";
        const plantImg = data.plantImage || data.assets?.plant || "";
        const bulletImg = data.bulletImage || data.assets?.bullet || "";

        document.getElementById('url_card_hidden').value = cardImg;
        document.getElementById('url_plant_hidden').value = plantImg;
        document.getElementById('url_bullet_hidden').value = bulletImg;

        if(document.getElementById('prev_card')) document.getElementById('prev_card').src = cardImg;
        if(document.getElementById('prev_plant')) document.getElementById('prev_plant').src = plantImg;
        if(document.getElementById('prev_bullet')) document.getElementById('prev_bullet').src = bulletImg;

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
        
        const activeBtn = document.querySelector('.tab-btn.active');
        const currentType = activeBtn && activeBtn.innerText.includes('Zombie') ? 'zombies' : 'plants';
        window.filterGameData(currentType);
    } catch (error) {
        alert("Lỗi xóa: " + error.message);
    }
};

// B. Xử lý Upload và Lưu Form

async function uploadImageToStorage(file, folderName, fileName) {
    if (!file) return null; 
    const storageRef = sRef(storage, `assets/${folderName}/${fileName}`);
    await uploadBytes(storageRef, file); 
    return await getDownloadURL(storageRef); 
}

const gameDataForm = document.getElementById('form-game-data');
if (gameDataForm) {
    gameDataForm.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        
        const btn = document.querySelector('#form-game-data button[type="submit"]'); 
        const originalText = btn ? btn.innerText : 'Lưu';
        if(btn) {
            btn.innerText = "Đang Lưu... ⏳";
            btn.disabled = true;
        }

        try {
            const type = document.getElementById('gd_type').value;
            const id = document.getElementById('gd_id').value.trim();
            const name = document.getElementById('gd_name').value.trim();
            
            if (!id || !name) throw new Error("Vui lòng nhập ID và Tên!");

            // 1. Upload ảnh
            const fileCard = document.getElementById('file_card').files[0];
            const filePlant = document.getElementById('file_plant').files[0];
            const fileBullet = document.getElementById('file_bullet').files[0];

            const [newUrlCard, newUrlPlant, newUrlBullet] = await Promise.all([
                uploadImageToStorage(fileCard, 'card', `${id}.png`),
                uploadImageToStorage(filePlant, type === 'plants' ? 'plant' : 'zombie', `${id}.png`),
                uploadImageToStorage(fileBullet, 'pea', `${id}_bullet.png`)
            ]);

            const finalCard = newUrlCard || document.getElementById('url_card_hidden').value || "";
            const finalPlant = newUrlPlant || document.getElementById('url_plant_hidden').value || "";
            const finalBullet = newUrlBullet || document.getElementById('url_bullet_hidden').value || "";

            // Lấy chỉ số
            const valPrice = parseInt(document.getElementById('gd_cost').value) || 0;
            const valDamage = parseInt(document.getElementById('gd_damage').value) || 0;
            const valSpeed = parseFloat(document.getElementById('gd_speed').value) || 0;
            const valHp = parseInt(document.getElementById('gd_hp').value) || 100;
            
            // [MỚI] Lấy hành vi
            const valBehavior = document.getElementById('gd_behavior') ? document.getElementById('gd_behavior').value : 'shooter';

            // 2. Chuẩn bị Object dữ liệu
            const newData = {
                id: id,
                name: name,
                type: type,
                
                // [MỚI] Lưu hành vi vào DB
                behavior: valBehavior,

                // Dữ liệu phẳng
                price: valPrice, 
                damage: valDamage,
                speed: valSpeed,
                hp: valHp,
                
                // Dữ liệu ảnh phẳng
                cardImage: finalCard,
                plantImage: finalPlant,
                bulletImage: finalBullet,
                
                // Dữ liệu lồng nhau (cho GameCore cũ nếu cần)
                stats: {
                    damage: valDamage,
                    speed: valSpeed,
                    hp: valHp,
                },
                assets: {
                    card: finalCard,
                    plant: finalPlant,
                    bullet: finalBullet
                }
            };

            // 3. Lưu vào Firestore
            await setDoc(doc(db, "game_data", id), newData, { merge: true });

            alert(`✅ Đã lưu thành công ${name}!`);
            document.getElementById('modal-game-data').classList.add('hidden');
            
            if(window.filterGameData) window.filterGameData(type);

        } catch (error) {
            console.error(error);
            alert("❌ Lỗi: " + error.message);
        } finally {
            if(btn) {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }
    });
}

// C. Tải danh sách
window.filterGameData = async (type) => {
    const listBody = document.getElementById('game-data-list');
    if(!listBody) return;
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(type)) btn.classList.add('active');
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
                
                const priceDisplay = type === 'plants' ? `${item.price || item.cost || 0} ☀️` : '-';
                const damageDisplay = item.damage || (item.stats ? item.stats.damage : 0);
                const speedDisplay = item.speed || (item.stats ? item.stats.speed : 0);
                
                // Hiển thị hành vi nếu là Plants
                const behaviorDisplay = type === 'plants' ? 
                    `<span style="background:#eef; padding:3px 6px; border-radius:4px; font-size:0.9em; color:#2980b9;">${item.behavior || 'Shooter'}</span>` 
                    : '<span style="color:#7f8c8d;">Zombie</span>';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><b>${item.id}</b></td>
                    <td><img src="${imgUrl}" style="height:50px; object-fit:contain;"></td>
                    <td>${item.name}</td>
                    <td>${priceDisplay}</td>
                    <td>${damageDisplay}</td>
                    <td>${speedDisplay}s</td>
                    <td>${behaviorDisplay}</td>
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