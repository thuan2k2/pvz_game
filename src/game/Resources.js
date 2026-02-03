// src/game/Resources.js

// Khởi tạo các đối tượng ảnh TĨNH (Cũ)
export const images = {
    bg: new Image(),
    shooter: new Image(),
    blocker: new Image(),
    blocker_gold: new Image(), 
    zombie: new Image(),
    pea: new Image(),
    sun: new Image(),
    sunflower: new Image(), 
    conehead: new Image(),
    buckethead: new Image(),
    cherrybomb: new Image(),
    lawnmower: new Image() 
};

// [MỚI] Đối tượng chứa ảnh ĐỘNG (Cây/Zombie tải từ Admin/Firebase)
export const customImages = {}; 

// Hàm gán đường dẫn ảnh tĩnh (Chạy 1 lần khi game bắt đầu)
export function loadImages() {
    images.bg.src = '/assets/bg.jpg';
    images.shooter.src = '/assets/plant/Peashooter.png'; // Cập nhật lại đường dẫn cho chuẩn folder mới
    images.blocker.src = '/assets/plant/Wall-nut.png';
    images.blocker_gold.src = '/assets/plant/Wall-nut.png'; 
    images.zombie.src = '/assets/zombie.png';
    images.pea.src = '/assets/pea/Pea.png';
    images.sun.src = '/assets/sun.png';
    images.sunflower.src = '/assets/plant/Sunflower.png'; 
    images.conehead.src = '/assets/zombie/Conehead Zombie.png';
    images.buckethead.src = '/assets/zombie/Buckethead Zombie.png';
    images.cherrybomb.src = '/assets/plant/Cherry Bomb.png';
    images.lawnmower.src = '/assets/lawnmower.png'; 
}

// [MỚI] Hàm tải ảnh động dựa trên dữ liệu PLANT_DATA
// Hàm này sẽ được gọi từ Main.js sau khi tải dữ liệu từ Server xong
export function loadDynamicResources(plantData) {
    console.log("🔄 Đang tải tài nguyên hình ảnh động...");
    
    for (const [id, data] of Object.entries(plantData)) {
        // 1. Tải ảnh Cây (Plant)
        if (data.assets && data.assets.plant) {
            const img = new Image();
            // Nếu là link online (Firebase) thì dùng luôn, nếu là tên file thì nối đường dẫn local
            const src = data.assets.plant.startsWith('http') 
                ? data.assets.plant 
                : `/assets/plant/${data.assets.plant}`;
            
            img.src = src;
            customImages[id] = img; // Lưu với key là ID cây (vd: 'peashooter')
        }

        // 2. Tải ảnh Đạn (Bullet)
        if (data.assets && data.assets.bullet) {
            const img = new Image();
            const src = data.assets.bullet.startsWith('http') 
                ? data.assets.bullet 
                : `/assets/pea/${data.assets.bullet}`;
            
            img.src = src;
            customImages[`bullet_${id}`] = img; // Lưu với key: 'bullet_peashooter'
        }

        // 3. Tải ảnh Skin (Nếu có)
        if (data.assets && data.assets.skin) {
            const img = new Image();
            const src = data.assets.skin.startsWith('http') 
                ? data.assets.skin 
                : `/assets/skin/${data.assets.skin}`;
            
            img.src = src;
            customImages[`skin_${id}`] = img; // Lưu với key: 'skin_peashooter'
        }
    }
    console.log("✅ Đã nạp xong tài nguyên ảnh động:", Object.keys(customImages).length, "ảnh.");
}

/**
 * Hàm hỗ trợ vẽ an toàn
 * Nếu ảnh chưa tải xong hoặc bị lỗi -> Vẽ hình vuông màu như cũ (fallback)
 */
export function drawSprite(ctx, img, x, y, w, h, fallbackColor = 'red') {
    if (img && img.complete && img.naturalWidth !== 0) {
        // Nếu ảnh đã tải xong -> Vẽ ảnh
        ctx.drawImage(img, x, y, w, h);
    } else {
        // Nếu chưa có ảnh -> Vẽ màu tạm
        ctx.fillStyle = fallbackColor;
        ctx.fillRect(x, y, w, h);
    }
}