// file: src/plantsData.js
import { db } from './firebase/config.js'; 
import { collection, getDocs } from "firebase/firestore";

// [FIX] Khởi tạo rỗng hoàn toàn để không hiện cây lạ khi chưa tải xong
export const PLANT_DATA = {};

export async function fetchPlantsFromServer() {
    try {
        console.log("📡 Đang tải dữ liệu từ Firestore...");
        
        // Reset lại mỗi lần fetch để tránh trùng lặp
        for (const key in PLANT_DATA) delete PLANT_DATA[key];

        const querySnapshot = await getDocs(collection(db, "game_data"));

        // Biến đếm để kiểm tra điều kiện (Yêu cầu phải có ít nhất 1 cây và 1 zombie)
        let plantCount = 0;
        let zombieCount = 0;

        if (querySnapshot.empty) {
            console.log("⚠️ Server chưa có dữ liệu 'game_data'.");
            return { success: false, reason: "empty" };
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const id = data.id;

            // 1. XỬ LÝ DỮ LIỆU CÂY TRỒNG (PLANTS)
            if (!data.type || data.type === 'plants') {
                plantCount++; // Tăng đếm
                PLANT_DATA[id] = {
                    name: data.name || "Unknown",
                    type: 'plants', 
                    cost: Number(data.price) || 100, 
                    
                    // Lấy thêm trường hành vi (behavior) từ Admin
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
            else if (data.type === 'zombies') {
                zombieCount++; // Tăng đếm
                PLANT_DATA[id] = {
                    name: data.name || "Zombie",
                    type: 'zombies', 
                    assets: {
                        plant: data.plantImage || `assets/zombie/${id}.png` 
                    },
                    stats: {
                        damage: Number(data.damage) || 1,
                        speed: Number(data.speed) || 0.2, 
                        hp: Number(data.hp) || 100
                    }
                };
            }
        });

        // [QUAN TRỌNG] Kiểm tra điều kiện: Phải có ít nhất 1 cây và 1 zombie
        if (plantCount > 0 && zombieCount > 0) {
            console.log(`✅ Đã tải: ${plantCount} cây, ${zombieCount} zombie.`);
            return { success: true };
        } else {
            console.warn(`⚠️ Dữ liệu không đủ để bắt đầu game: ${plantCount} cây, ${zombieCount} zombie.`);
            // Trả về false để kích hoạt Popup lỗi bên main.js
            return { success: false, reason: "insufficient" };
        }

    } catch (error) {
        console.error("❌ Lỗi tải dữ liệu:", error);
        return { success: false, reason: "error" };
    }
}