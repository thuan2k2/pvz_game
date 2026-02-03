// src/game/Resources.js

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

export const customImages = {};

export function loadImages() {
    // 1. Ảnh nền & Vật phẩm chung
    images.bg.src = '/assets/bg.jpg';
    images.sun.src = '/assets/sun.png'; 
    images.lawnmower.src = '/assets/lawnmower.png';

    // 2. Cây trồng (Folder: assets/plant) - Đã fix đường dẫn
    images.shooter.src = '/assets/plant/Peashooter.png';
    images.sunflower.src = '/assets/plant/Sunflower.png';
    images.blocker.src = '/assets/plant/Wall-nut.png';
    images.blocker_gold.src = '/assets/plant/Wall-nut.png'; 
    images.cherrybomb.src = '/assets/plant/Cherry Bomb.png'; 

    // 3. Zombie (Folder: assets/zombie)
    images.zombie.src = '/assets/zombie/Zombie.png';
    images.conehead.src = '/assets/zombie/Conehead Zombie.png'; 
    images.buckethead.src = '/assets/zombie/Buckethead Zombie.png';

    // 4. Đạn (Folder: assets/pea)
    images.pea.src = '/assets/pea/Pea.png';
}

// Hàm tải ảnh động từ Admin/Firebase (Đã thêm kiểm tra an toàn)
export function loadDynamicResources(plantData) {
    if (!plantData) return; // [An toàn] Nếu chưa có data thì bỏ qua

    console.log("🔄 Đang tải tài nguyên hình ảnh động...");
    
    for (const [id, data] of Object.entries(plantData)) {
        // Tải ảnh Cây
        if (data.assets && data.assets.plant) {
            const img = new Image();
            const src = data.assets.plant.startsWith('http') 
                ? data.assets.plant 
                : `/assets/plant/${data.assets.plant}`;
            img.src = src;
            customImages[id] = img;
        }
        
        // Tải ảnh Đạn
        if (data.assets && data.assets.bullet) {
            const img = new Image();
            const src = data.assets.bullet.startsWith('http') 
                ? data.assets.bullet 
                : `/assets/pea/${data.assets.bullet}`;
            img.src = src;
            customImages[`bullet_${id}`] = img;
        }
        
        // Tải ảnh Skin
        if (data.assets && data.assets.skin) {
            const img = new Image();
            const src = data.assets.skin.startsWith('http') 
                ? data.assets.skin 
                : `/assets/skin/${data.assets.skin}`;
            img.src = src;
            customImages[`skin_${id}`] = img;
        }
    }
}

export function drawSprite(ctx, img, x, y, w, h, fallbackColor = 'red') {
    if (img && img.complete && img.naturalWidth !== 0) {
        ctx.drawImage(img, x, y, w, h);
    } else {
        ctx.fillStyle = fallbackColor;
        ctx.fillRect(x, y, w, h);
    }
}