// Khởi tạo các đối tượng ảnh
export const images = {
    bg: new Image(),
    shooter: new Image(),
    blocker: new Image(),
    blocker_gold: new Image(), // <--- [MỚI] Ảnh Củ đậu vàng
    zombie: new Image(),
    pea: new Image(),
    sun: new Image(),
    sunflower: new Image(), 
    conehead: new Image(),
    buckethead: new Image(),
    cherrybomb: new Image(),
    lawnmower: new Image() 
};

// Hàm gán đường dẫn ảnh (Chạy 1 lần khi game bắt đầu)
export function loadImages() {
    images.bg.src = '/assets/bg.jpg';
    images.shooter.src = '/assets/shooter.png';
    images.blocker.src = '/assets/blocker.png';
    images.blocker_gold.src = '/assets/blocker_gold.png'; // <--- [MỚI] Gán nguồn ảnh
    images.zombie.src = '/assets/zombie.png';
    images.pea.src = '/assets/pea.png';
    images.sun.src = '/assets/sun.png';
    images.sunflower.src = '/assets/sunflower.png'; 
    images.conehead.src = '/assets/conehead.png';
    images.buckethead.src = '/assets/buckethead.png';
    images.cherrybomb.src = '/assets/cherrybomb.png';
    images.lawnmower.src = '/assets/lawnmower.png'; 
}

/**
 * Hàm hỗ trợ vẽ an toàn
 * Nếu ảnh chưa tải xong hoặc bị lỗi -> Vẽ hình vuông màu như cũ (fallback)
 */
export function drawSprite(ctx, img, x, y, w, h, fallbackColor = 'red') {
    if (img.complete && img.naturalWidth !== 0) {
        // Nếu ảnh đã tải xong -> Vẽ ảnh
        ctx.drawImage(img, x, y, w, h);
    } else {
        // Nếu chưa có ảnh -> Vẽ màu tạm
        ctx.fillStyle = fallbackColor;
        ctx.fillRect(x, y, w, h);
    }
}