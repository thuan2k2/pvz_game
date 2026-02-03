// file: src/plantsData.js
import { database } from './firebase/config.js';
import { ref, child, get } from "firebase/database";

// [CẬP NHẬT] Thêm 'export' để các file khác import được
export const PLANT_DATA = {
    // --- DỮ LIỆU CŨ (Mặc định khi chưa tải xong từ mạng) ---
    "peashooter": {
        name: "Peashooter",
        cost: 100,
        // Lưu ý: Dữ liệu cũ dùng tên file, dữ liệu mới từ Admin sẽ là Link Full (https://...)
        assets: {
            card: "Peashooter.png",          
            plant: "Peashooter.png",         
            bullet: "Pea.png",               
            skin: "Peashooter Goal.png"      
        },
        stats: { damage: 20, speed: 1.5, range: "line" }
    },

    "cabbage_pult": {
        name: "Cabbage Pult",
        cost: 100,
        assets: {
            card: "Cabbage-pult.png",        
            plant: "Cabbage-pult.png",       
            bullet: "Cabbage.png",           
            skin: null                       
        },
        stats: { damage: 40, speed: 2.0, range: "lob" } 
    },

    "melon_pult": {
        name: "Melon Pult",
        cost: 300,
        assets: {
            card: "Melon-pult.png",          
            plant: "Melon-pult.png",         
            bullet: "Melon.png",             
            skin: "Winter Melon.png"         
        },
        stats: { damage: 80, speed: 2.5, range: "lob" }
    }
};

// [MỚI] Hàm tải dữ liệu từ Firebase Realtime Database
export async function fetchPlantsFromServer() {
    const dbRef = ref(database);
    try {
        console.log("📡 Đang tải dữ liệu cây từ Server...");
        const snapshot = await get(child(dbRef, "game_data/plants"));
        
        if (snapshot.exists()) {
            const serverData = snapshot.val();
            
            // Kỹ thuật quan trọng: Gộp dữ liệu mới vào biến PLANT_DATA cũ
            // Lệnh này giúp cập nhật dữ liệu mà không làm mất tham chiếu của biến
            Object.assign(PLANT_DATA, serverData);
            
            console.log("✅ Đã đồng bộ dữ liệu Cây thành công!", PLANT_DATA);
            return true;
        } else {
            console.log("⚠️ Chưa có dữ liệu trên Server, dùng dữ liệu mặc định.");
            return false;
        }
    } catch (error) {
        console.error("❌ Lỗi tải dữ liệu cây:", error);
        return false;
    }
}