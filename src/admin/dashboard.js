import { db, auth, storage, database } from '../firebase/config.js'; // Thêm storage và database Realtime
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, set, get, child } from "firebase/database"; // Import cho Realtime Database
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage"; // Import cho Storage

// --- PHẦN 1: QUẢN LÝ USER (GIỮ NGUYÊN CODE CŨ) ---
// (Chỉ chỉnh sửa nhẹ biến global để tránh lỗi undefined nếu chưa load xong DOM)
let tableBody, loadingMsg, usersTable;

document.addEventListener("DOMContentLoaded", () => {
    tableBody = document.getElementById('user-list'); // Sửa ID khớp với HTML mới
    // loadingMsg = document.getElementById('loading-msg'); // Tạm bỏ vì HTML mới không có ID này
    usersTable = document.querySelector('#section-users table'); // Lấy table trong section users
});

// 1. BẢO MẬT: Kiểm tra xem có phải Admin không?
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Vui lòng đăng nhập trước!");
        window.location.href = 'login.html';
        return;
    }

    // Kiểm tra Role trong database
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().role === 'admin') {
        console.log("Welcome Admin: " + user.email);
        loadUserList(); // Load user cũ
        filterGameData('plants'); // Load luôn danh sách cây mặc định
    } else {
        alert("CẢNH BÁO: Bạn không có quyền truy cập Admin Panel!");
        window.location.href = 'index.html';
    }
});

// 2. CHỨC NĂNG: Tải danh sách người chơi (Logic cũ, chỉ sửa ID)
async function loadUserList() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const listBody = document.getElementById('user-list');
        listBody.innerHTML = ''; 

        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            const userId = docSnap.id;
            
            // Render HTML
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${userData.email}</td>
                <td>${userData.phone || "---"}</td>
                <td>${userData.coins || 0}</td>
                <td>${userData.vncoins || 0}</td>
                <td><span class="badge-active">Hoạt động</span></td>
                <td>
                    <button class="btn btn-edit" onclick="window.editCoin('${userId}', ${userData.coins || 0})">Sửa</button>
                    <button class="btn btn-ban">Khóa</button> 
                </td>
            `;
            listBody.appendChild(row);
        });
        
        // Cập nhật thống kê sơ bộ
        document.getElementById('total-users').innerText = querySnapshot.size;

    } catch (error) {
        console.error("Lỗi tải danh sách user:", error);
    }
}

// 4. ACTION: Hàm sửa tiền (Giữ nguyên)
window.editCoin = async (userId, currentCoin) => {
    const newAmount = prompt(`Nhập số coin mới (Hiện tại: ${currentCoin}):`, currentCoin);
    if (newAmount !== null && !isNaN(newAmount)) {
        try {
            await updateDoc(doc(db, "users", userId), { coins: parseInt(newAmount) });
            alert("Cập nhật thành công!");
            loadUserList(); // Reload lại bảng
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    }
};


// --- PHẦN 2: [MỚI] QUẢN LÝ CÂY TRỒNG & ZOMBIE ---

// Hàm helper upload ảnh lên Firebase Storage
async function uploadImageToStorage(file, folderName, fileName) {
    if (!file) return ""; // Không có file thì trả về rỗng
    
    // Tạo tham chiếu: assets/pea/peashooter_bullet.png
    const storageRef = sRef(storage, `assets/${folderName}/${fileName}`);
    
    await uploadBytes(storageRef, file); // Upload
    return await getDownloadURL(storageRef); // Lấy link tải về
}

// Xử lý sự kiện Submit Form Thêm Cây/Zombie
const gameDataForm = document.getElementById('form-game-data');
if (gameDataForm) {
    document.getElementById('btn-save-game-data').addEventListener('click', async (e) => {
        e.preventDefault(); // Chặn reload
        
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

            // 3. Upload song song (Tiết kiệm thời gian)
            // Lưu ý: Folder 'pea' cho đạn như yêu cầu
            const [urlCard, urlPlant, urlBullet, urlSkin] = await Promise.all([
                uploadImageToStorage(fileCard, 'card', `${id}.png`),
                uploadImageToStorage(filePlant, type === 'plants' ? 'plant' : 'zombie', `${id}.png`), // Nếu là zombie thì vào folder zombie
                uploadImageToStorage(fileBullet, 'pea', `${id}_bullet.png`),
                uploadImageToStorage(fileSkin, 'skin', `${id}_skin.png`)
            ]);

            // 4. Chuẩn bị Object dữ liệu để lưu
            const newData = {
                id: id,
                name: name,
                cost: cost,
                stats: {
                    damage: damage,
                    speed: speed
                },
                assets: {
                    card: urlCard || "",
                    plant: urlPlant || "",
                    bullet: urlBullet || "",
                    skin: urlSkin || ""
                }
            };

            // 5. Lưu vào Realtime Database (Ghi đè nếu đã có)
            // Path: game_data/plants/peashooter hoặc game_data/zombies/basic
            await set(ref(database, `game_data/${type}/${id}`), newData);

            alert(`✅ Đã thêm thành công ${name} vào hệ thống!`);
            
            // Reset form và đóng modal
            gameDataForm.reset();
            document.getElementById('modal-game-data').classList.add('hidden');
            
            // Load lại danh sách
            filterGameData(type);

        } catch (error) {
            console.error(error);
            alert("❌ Lỗi: " + error.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

// Hàm tải và hiển thị danh sách Cây/Zombie ra bảng
window.filterGameData = async (type) => {
    const listBody = document.getElementById('game-data-list');
    listBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Đang tải dữ liệu ${type}...</td></tr>`;

    try {
        // Lấy data từ Realtime Database
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, `game_data/${type}`));

        listBody.innerHTML = ''; // Xóa loading

        if (snapshot.exists()) {
            const data = snapshot.val();
            // Duyệt qua từng item (Object)
            Object.keys(data).forEach(key => {
                const item = data[key];
                const imgUrl = item.assets?.card || item.assets?.plant || "https://via.placeholder.com/50";
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><b>${item.id}</b></td>
                    <td><img src="${imgUrl}" style="height:50px;"></td>
                    <td>${item.name}</td>
                    <td>${item.cost} ☀️</td>
                    <td>${item.stats?.damage || 0}</td>
                    <td>${item.stats?.speed || 0}s</td>
                    <td>
                        <button class="btn btn-edit" onclick="alert('Tính năng sửa đang phát triển!')">Sửa</button>
                    </td>
                `;
                listBody.appendChild(tr);
            });
        } else {
            listBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Chưa có dữ liệu nào. Hãy thêm mới!</td></tr>`;
        }
    } catch (error) {
        console.error(error);
        listBody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Lỗi tải data!</td></tr>`;
    }
};