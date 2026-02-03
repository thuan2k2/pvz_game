import { PROJECTILE_STATS, GAME_WIDTH } from '../constants.js';
import { images, customImages, drawSprite } from '../Resources.js'; // [MỚI] Import customImages

export class Projectile {
    /**
     * @param {number} x
     * @param {number} y
     * @param {string} type - Loại cây bắn ra đạn (vd: 'peashooter', 'melon_pult')
     * @param {number} damage - Sát thương của đạn
     */
    constructor(x, y, type = 'peashooter', damage = 20) {
        this.x = x;
        this.y = y;
        this.width = PROJECTILE_STATS.radius * 2; 
        this.height = PROJECTILE_STATS.radius * 2;
        
        this.type = type;   // Lưu ID cây để tìm ảnh đạn tương ứng
        this.power = damage; // Nhận sát thương từ Cây (không dùng cứng 20 nữa)
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
        // [LOGIC MỚI] Tìm ảnh đạn dựa trên ID cây
        // Quy tắc key ảnh đạn trong Resources.js: "bullet_" + id cây
        let bulletImg = customImages[`bullet_${this.type}`];

        // Fallback: Nếu không tìm thấy ảnh đạn riêng, dùng đạn đậu xanh mặc định
        if (!bulletImg) {
            bulletImg = images.pea; 
        }

        // Vẽ viên đạn
        drawSprite(ctx, bulletImg, this.x, this.y, this.width, this.height, PROJECTILE_STATS.color);
    }
}