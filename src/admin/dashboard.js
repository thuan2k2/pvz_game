import { db, auth } from '../firebase/config.js';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const tableBody = document.getElementById('user-list-body');
const loadingMsg = document.getElementById('loading-msg');
const usersTable = document.getElementById('users-table');

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
        // Đúng là Admin -> Cho phép tải dữ liệu
        console.log("Welcome Admin: " + user.email);
        loadUserList();
    } else {
        // Không phải Admin -> Đá về trang chủ
        alert("CẢNH BÁO: Bạn không có quyền truy cập Admin Panel!");
        window.location.href = 'index.html';
    }
});

// 2. CHỨC NĂNG: Tải danh sách người chơi
async function loadUserList() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        
        // Xóa thông báo loading, hiện bảng
        loadingMsg.classList.add('hidden');
        usersTable.classList.remove('hidden');
        tableBody.innerHTML = ''; // Reset bảng

        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            const userId = docSnap.id;
            renderUserRow(userId, userData);
        });

    } catch (error) {
        console.error("Lỗi tải danh sách:", error);
        alert("Lỗi tải dữ liệu: " + error.message);
    }
}

// 3. HIỂN THỊ: Tạo dòng HTML cho bảng
function renderUserRow(id, data) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td>${data.email}</td>
        <td>${data.phone || "---"}</td>
        <td><span style="color: ${data.role === 'admin' ? 'red' : 'green'}">${data.role}</span></td>
        <td id="coin-${id}">${data.coins}</td>
        <td>Hoạt động</td>
        <td>
            <button class="action-btn btn-edit" onclick="window.editCoin('${id}', ${data.coins})">Sửa Coin</button>
            <button class="action-btn btn-ban">Khóa</button> 
        </td>
    `;
    
    tableBody.appendChild(row);
}

// 4. ACTION: Hàm sửa tiền (Gắn vào window để gọi được từ HTML)
window.editCoin = async (userId, currentCoin) => {
    const newAmount = prompt(`Nhập số coin mới cho user này (Hiện tại: ${currentCoin}):`, currentCoin);
    
    if (newAmount !== null && !isNaN(newAmount)) {
        try {
            const userRef = doc(db, "users", userId);
            
            // Update lên Firebase
            await updateDoc(userRef, {
                coins: parseInt(newAmount)
            });

            // Update giao diện ngay lập tức không cần load lại trang
            document.getElementById(`coin-${userId}`).innerText = newAmount;
            alert("Cập nhật thành công!");
            
            // Cập nhật lại onclick để nó nhớ số coin mới
            // (Thực tế nên reload lại list, nhưng làm thế này cho nhanh)
        } catch (error) {
            console.error("Lỗi update coin:", error);
            alert("Lỗi: " + error.message);
        }
    }
};