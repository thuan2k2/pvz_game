// src/game/Resources.js

// Khởi tạo các đối tượng ảnh TĨNH (Load mặc định để game không bị crash khi chưa có mạng)
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
// [FIX LỖI 404] Cập nhật đúng tên file và thư mục theo cấu trúc mới
export function loadImages() {
    images.bg.src = '/assets/bg.jpg';
    
    // Cây (Folder: assets/plant) - Lưu ý viết hoa chữ cái đầu đúng như file của bạn
    images.shooter.src = '/assets/plant/Peashooter.png'; 
    images.sunflower.src = '/assets/plant/Sunflower.png'; 
    images.blocker.src = '/assets/plant/Wall-nut.png';
    images.blocker_gold.src = '/assets/plant/Wall-nut.png'; 
    images.cherrybomb.src = '/assets/plant/Cherry Bomb.png'; // Có dấu cách

    // Zombie (Folder: assets/zombie)
    images.zombie.src = '/assets/zombie/Zombie.png';
    images.conehead.src = '/assets/zombie/Conehead Zombie.png'; // Có dấu cách
    images.buckethead.src = '/assets/zombie/Buckethead Zombie.png'; // Có dấu cách

    // Đạn & Item khác
    images.pea.src = '/assets/pea/Pea.png';
    images.sun.src = '/assets/sun.png';
    images.lawnmower.src = '/assets/lawnmower.png'; 
}

// [MỚI] Hàm tải ảnh động dựa trên dữ liệu PLANT_DATA
export function loadDynamicResources(plantData) {
    console.log("🔄 Đang tải tài nguyên hình ảnh động...");
    
    for (const [id, data] of Object.entries(plantData)) {
        // 1. Tải ảnh Cây (Plant)
        if (data.assets && data.assets.plant) {
            const img = new Image();
            const src = data.assets.plant.startsWith('http') 
                ? data.assets.plant 
                : `/assets/plant/${data.assets.plant}`;
            
            img.src = src;
            customImages[id] = img; 
        }

        // 2. Tải ảnh Đạn (Bullet)
        if (data.assets && data.assets.bullet) {
            const img = new Image();
            const src = data.assets.bullet.startsWith('http') 
                ? data.assets.bullet 
                : `/assets/pea/${data.assets.bullet}`;
            
            img.src = src;
            customImages[`bullet_${id}`] = img; 
        }

        // 3. Tải ảnh Skin (Nếu có)
        if (data.assets && data.assets.skin) {
            const img = new Image();
            const src = data.assets.skin.startsWith('http') 
                ? data.assets.skin 
                : `/assets/skin/${data.assets.skin}`;
            
            img.src = src;
            customImages[`skin_${id}`] = img; 
        }
    }
    console.log("✅ Đã nạp xong tài nguyên ảnh động:", Object.keys(customImages).length, "ảnh.");
}

/**
 * Hàm hỗ trợ vẽ an toàn
 */
export function drawSprite(ctx, img, x, y, w, h, fallbackColor = 'red') {
    if (img && img.complete && img.naturalWidth !== 0) {
        ctx.drawImage(img, x, y, w, h);
    } else {
        ctx.fillStyle = fallbackColor;
        ctx.fillRect(x, y, w, h);
    }
}