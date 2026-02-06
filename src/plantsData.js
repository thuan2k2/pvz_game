// file: src/plantsData.js
import { db } from './firebase/config.js'; // [SỬA] Dùng db (Firestore) thay vì database
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// [GIỮ NGUYÊN] Cấu trúc dữ liệu cũ để game không bị lỗi khi chưa load mạng
export const PLANT_DATA = {
    "peashooter": {
        name: "Peashooter",
        cost: 100,
        assets: {
            card: "assets/card/Peashooter.png",      
            plant: "assets/plant/Peashooter.png",     
            bullet: "assets/pea/Pea.png",            
            skin: "assets/skin/Peashooter Goal.png"   
        },
        stats: { damage: 20, speed: 1.5, range: "line" }
    },

    "cabbage_pult": {
        name: "Cabbage Pult",
        cost: 100,
        assets: {
            card: "assets/card/Cabbage-pult.png",     
            plant: "assets/plant/Cabbage-pult.png",    
            bullet: "assets/pea/Cabbage.png",        
            skin: null                    
        },
        stats: { damage: 40, speed: 2.0, range: "lob" } 
    },

    "melon_pult": {
        name: "Melon Pult",
        cost: 300,
        assets: {
            card: "assets/card/Melon-pult.png",       
            plant: "assets/plant/Melon-pult.png",      
            bullet: "assets/pea/Melon.png",          
            skin: "assets/skin/Winter Melon.png"      
        },
        stats: { damage: 80, speed: 2.5, range: "lob" }
    }
};

// [SỬA] Hàm tải dữ liệu từ Firestore (Đồng bộ với Admin.js)
export async function fetchPlantsFromServer() {
    try {
        console.log("📡 Đang tải dữ liệu cây từ Firestore...");
        
        // Gọi lên collection 'game_data' nơi Admin đã lưu
        const querySnapshot = await getDocs(collection(db, "game_data"));

        if (querySnapshot.empty) {
            console.log("⚠️ Server chưa có dữ liệu 'game_data', dùng mặc định.");
            return false;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const id = data.id; // VD: "peashooter"

            // Chỉ xử lý nếu là plants
            if (!data.type || data.type === 'plants') {
                // [QUAN TRỌNG] Chuyển đổi dữ liệu phẳng từ Admin sang cấu trúc lồng nhau của Game
                PLANT_DATA[id] = {
                    name: data.name || "Unknown",
                    // Admin lưu là 'price', Game dùng 'cost' -> Cần map lại
                    cost: Number(data.price) || 100, 
                    
                    assets: {
                        // Admin lưu đường dẫn full, Game gán vào đây
                        card: data.cardImage || `assets/card/${id}.png`,
                        plant: data.plantImage || `assets/plant/${id}.png`,
                        bullet: data.bulletImage || `assets/pea/Pea.png`,
                        skin: null
                    },
                    
                    stats: {
                        damage: Number(data.damage) || 20,
                        speed: Number(data.speed) || 1.5,
                        range: "line" // Mặc định là bắn thẳng, sau này có thể thêm option trong Admin
                    }
                };
            }
        });

        console.log("✅ Đã đồng bộ dữ liệu Cây thành công:", PLANT_DATA);
        return true;

    } catch (error) {
        console.error("❌ Lỗi tải dữ liệu cây:", error);
        // Không return false để game vẫn tiếp tục chạy với dữ liệu mặc định
        return false;
    }
}