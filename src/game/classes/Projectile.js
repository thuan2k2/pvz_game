import { PROJECTILE_STATS, GAME_WIDTH } from '../constants.js';
import { images, drawSprite } from '../Resources.js'; // Import bộ nạp ảnh

export class Projectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = PROJECTILE_STATS.radius * 2; // Kích thước ảnh
        this.height = PROJECTILE_STATS.radius * 2;
        this.power = 20;
        this.speed = PROJECTILE_STATS.speed;
        this.delete = false; 
    }

    update() {
        this.x += this.speed;

        // Nếu bay quá màn hình bên phải -> Xóa
        if (this.x > GAME_WIDTH) {
            this.delete = true;
        }
    }

    draw(ctx) {
        // Vẽ viên đạn bằng ảnh
        // Nếu chưa có ảnh thì vẽ màu vàng như cũ
        drawSprite(ctx, images.pea, this.x, this.y, this.width, this.height, PROJECTILE_STATS.color);
    }
}