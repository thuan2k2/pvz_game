import { auth, db } from './firebase/config.js';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ID của document cấu hình (lưu trong collection system_config)
const CONFIG_DOC_ID = "general";

// 1. Check quyền Admin
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().role === 'admin') {
            loadConfig(); // Tải cấu hình
        } else {
            alert("Bạn không có quyền!");
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// 2. Tải cấu hình từ Firestore
async function loadConfig() {
    try {
        const docRef = doc(db, "system_config", CONFIG_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Fill dữ liệu vào form
            document.getElementById('maintenance-mode').checked = data.maintenance || false;
            document.getElementById('maintenance-msg').value = data.maintenance_message || "";
            document.getElementById('welcome-msg').value = data.welcome_message || "";
            
            document.getElementById('starter-coins').value = data.economy?.starter_coins || 0;
            document.getElementById('reward-min').value = data.economy?.reward_min || 100;
            document.getElementById('reward-max').value = data.economy?.reward_max || 500;
            
            document.getElementById('zombie-hp').value = data.gameplay?.zombie_hp_multiplier || 1.0;
        }
    } catch (error) {
        console.error("Lỗi tải config:", error);
    }
}

// 3. Lưu cấu hình (Gắn vào window để gọi từ HTML)
window.saveConfig = async () => {
    const btn = document.querySelector('.btn-save');
    const originalText = btn.innerText;
    btn.innerText = "Đang lưu...";
    btn.disabled = true;

    try {
        const configData = {
            maintenance: document.getElementById('maintenance-mode').checked,
            maintenance_message: document.getElementById('maintenance-msg').value,
            welcome_message: document.getElementById('welcome-msg').value,
            
            economy: {
                starter_coins: parseInt(document.getElementById('starter-coins').value),
                reward_min: parseInt(document.getElementById('reward-min').value),
                reward_max: parseInt(document.getElementById('reward-max').value)
            },
            
            gameplay: {
                zombie_hp_multiplier: parseFloat(document.getElementById('zombie-hp').value)
            }
        };

        // Lưu vào Firestore (dùng setDoc với merge: true để không mất field khác nếu có)
        await setDoc(doc(db, "system_config", CONFIG_DOC_ID), configData, { merge: true });

        alert("✅ Đã lưu cấu hình thành công!");
    } catch (error) {
        console.error(error);
        alert("❌ Lỗi khi lưu: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};