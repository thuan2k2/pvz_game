// file: src/plantsData.js
import { db } from './firebase/config.js'; 
import { collection, getDocs } from "firebase/firestore";

// [FIX] Khởi tạo rỗng hoàn toàn để không hiện cây lạ khi chưa tải xong
export const PLANT_DATA = {};

export async function fetchPlantsFromServer() {
    try {
        console.log("📡 Đang tải dữ liệu cây từ Firestore...");
        
        // Reset lại mỗi lần fetch để tránh trùng lặp
        for (const key in PLANT_DATA) delete PLANT_DATA[key];

        const querySnapshot = await getDocs(collection(db, "game_data"));

        if (querySnapshot.empty) {
            console.log("⚠️ Server chưa có dữ liệu 'game_data'.");
            return false;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const id = data.id;

            // 1. XỬ LÝ DỮ LIỆU CÂY TRỒNG (PLANTS)
            // Nếu type là 'plants' hoặc không có type (dữ liệu cũ mặc định là cây)
            if (!data.type || data.type === 'plants') {
                PLANT_DATA[id] = {
                    name: data.name || "Unknown",
                    type: 'plants', // Đánh dấu loại
                    cost: Number(data.price) || 100, 
                    
                    // [QUAN TRỌNG] Lấy thêm trường hành vi (behavior) từ Admin
                    // Mặc định là 'shooter' nếu chưa cài đặt
                    behavior: data.behavior || "shooter", 
                    
                    assets: {
                        card: data.cardImage || `assets/card/${id}.png`,
                        plant: data.plantImage || `assets/plant/${id}.png`,
                        bullet: data.bulletImage || `assets/pea/Pea.png`,
                    },
                    stats: {
                        damage: Number(data.damage) || 20,
                        speed: Number(data.speed) || 1.5,
                        hp: Number(data.hp) || 100
                    }
                };
            }
            // 2. XỬ LÝ DỮ LIỆU ZOMBIE
            // Lưu cả zombie vào đây để GameCore/Zombie.js có thể tra cứu chỉ số
            else if (data.type === 'zombies') {
                PLANT_DATA[id] = {
                    name: data.name || "Zombie",
                    type: 'zombies', // Đánh dấu loại
                    assets: {
                        plant: data.plantImage || `assets/zombie/${id}.png` // Zombie dùng ảnh 'plant' làm sprite chính
                    },
                    stats: {
                        damage: Number(data.damage) || 1,
                        speed: Number(data.speed) || 0.2, // Tốc độ chạy
                        hp: Number(data.hp) || 100
                    }
                };
            }
        });

        console.log("✅ Đã đồng bộ dữ liệu hoàn tất:", PLANT_DATA);
        return true;

    } catch (error) {
        console.error("❌ Lỗi tải dữ liệu cây:", error);
        return false;
    }
}