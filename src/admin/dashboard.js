// file: src/dashboard.js
import { db, auth, storage } from '../firebase/config.js'; // [ĐÃ SỬA] Bỏ database Realtime
import { collection, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage"; 

// --- PHẦN 1: QUẢN LÝ USER (GIỮ NGUYÊN CODE CŨ) ---
let tableBody, loadingMsg, usersTable;

document.addEventListener("DOMContentLoaded", () => {
    tableBody = document.getElementById('user-list'); 
    usersTable = document.querySelector('#section-users table'); 
});

// 1. BẢO MẬT: Kiểm tra xem có phải Admin không?
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

// 2. CHỨC NĂNG: Tải danh sách người chơi
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
                <td>${userData.vn_coin || 0}</td> <td><span class="badge-active">Hoạt động</span></td>
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

// 4. ACTION: Hàm sửa tiền
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


// --- PHẦN 2: [ĐÃ SỬA] QUẢN LÝ CÂY TRỒNG & ZOMBIE (FIRESTORE) ---

// Hàm helper upload ảnh lên Firebase Storage
async function uploadImageToStorage(file, folderName, fileName) {
    if (!file) return ""; 
    const storageRef = sRef(storage, `assets/${folderName}/${fileName}`);
    await uploadBytes(storageRef, file); 
    return await getDownloadURL(storageRef); 
}

// Xử lý sự kiện Submit Form Thêm Cây/Zombie
const gameDataForm = document.getElementById('form-game-data');
if (gameDataForm) {
    document.getElementById('btn-save-game-data').addEventListener('click', async (e) => {
        e.preventDefault(); 
        
        const btn = document.getElementById('btn-save-game-data');
        const originalText = btn.innerText;
        btn.innerText = "Đang Upload & Lưu... ⏳";
        btn.disabled = true;

        try {
            // 1. Lấy dữ liệu từ Form
            const type = document.getElementById('gd_type').value; // 'plants' hoặc 'zombies'
            const id = document.getElementById('gd_id').value.trim();
            const name = document.getElementById('gd_name').value.trim();
            const cost = parseInt(document.getElementById('gd_cost').value) || 0;
            const damage = parseInt(document.getElementById('gd_damage').value) || 0;
            const speed = parseFloat(document.getElementById('gd_speed').value) || 0;

            if (!id || !name) throw new Error("Vui lòng nhập ID và Tên!");

            // 2. Lấy File ảnh
            const fileCard = document.getElementById('file_card').files[0];
            const filePlant = document.getElementById('file_plant').files[0];
            const fileBullet = document.getElementById('file_bullet').files[0];
            const fileSkin = document.getElementById('file_skin').files[0];

            // 3. Upload song song
            const [urlCard, urlPlant, urlBullet, urlSkin] = await Promise.all([
                uploadImageToStorage(fileCard, 'card', `${id}.png`),
                uploadImageToStorage(filePlant, type === 'plants' ? 'plant' : 'zombie', `${id}.png`), 
                uploadImageToStorage(fileBullet, 'pea', `${id}_bullet.png`),
                uploadImageToStorage(fileSkin, 'skin', `${id}_skin.png`)
            ]);

            // 4. Chuẩn bị Object dữ liệu (FLATTEN - Dạng phẳng để khớp với Shop.js)
            const newData = {
                id: id,
                name: name,
                type: type,
                // Shop dùng 'price', Game dùng 'cost'. Lưu 'price' làm chuẩn cho Shop
                price: cost, 
                // Lưu thẳng các chỉ số ra ngoài để dễ query
                damage: damage,
                speed: speed,
                
                // Lưu đường dẫn ảnh thẳng ra ngoài
                cardImage: urlCard || "",
                plantImage: urlPlant || "",
                bulletImage: urlBullet || "",
                skinImage: urlSkin || ""
            };

            // 5. [SỬA] Lưu vào Firestore (Collection "game_data")
            // Dùng setDoc để ghi đè theo ID (dễ quản lý hơn addDoc random ID)
            await setDoc(doc(db, "game_data", id), newData);

            alert(`✅ Đã thêm thành công ${name} vào hệ thống!`);
            
            // Reset form và đóng modal
            gameDataForm.reset();
            document.getElementById('modal-game-data').classList.add('hidden');
            
            // Load lại danh sách
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

// [ĐÃ SỬA] Hàm tải và hiển thị danh sách Cây/Zombie từ FIRESTORE
window.filterGameData = async (type) => {
    const listBody = document.getElementById('game-data-list');
    if(!listBody) return;
    
    listBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Đang tải dữ liệu ${type}...</td></tr>`;

    try {
        // Lấy data từ Firestore "game_data"
        const querySnapshot = await getDocs(collection(db, "game_data"));
        
        listBody.innerHTML = ''; 

        let hasData = false;

        querySnapshot.forEach((doc) => {
            const item = doc.data();
            
            // Lọc Client-side: Chỉ hiện item đúng loại (plants/zombies)
            // Nếu item không có field type (dữ liệu cũ), mặc định là plants
            const itemType = item.type || 'plants';

            if (itemType === type) {
                hasData = true;
                const imgUrl = item.cardImage || item.plantImage || "https://via.placeholder.com/50";
                
                // Hiển thị giá (item.price hoặc item.cost)
                const displayPrice = item.price || item.cost || 0;
                // Hiển thị damage (item.damage hoặc item.stats.damage)
                const displayDamage = item.damage || (item.stats ? item.stats.damage : 0);
                const displaySpeed = item.speed || (item.stats ? item.stats.speed : 0);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><b>${item.id}</b></td>
                    <td><img src="${imgUrl}" style="height:50px;"></td>
                    <td>${item.name}</td>
                    <td>${displayPrice} ☀️</td>
                    <td>${displayDamage}</td>
                    <td>${displaySpeed}s</td>
                    <td>
                        <button class="btn btn-edit" onclick="alert('Tính năng sửa đang phát triển!')">Sửa</button>
                    </td>
                `;
                listBody.appendChild(tr);
            }
        });

        if (!hasData) {
            listBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Chưa có dữ liệu ${type}. Hãy thêm mới!</td></tr>`;
        }

    } catch (error) {
        console.error(error);
        listBody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Lỗi tải data: ${error.message}</td></tr>`;
    }
};