// file: src/game/classes/Projectile.js
import { PROJECTILE_STATS, GAME_WIDTH } from '../constants.js';
import { images, customImages, drawSprite } from '../Resources.js';

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
        
        this.type = type;   
        this.power = damage; 
        this.speed = PROJECTILE_STATS.speed;
        this.delete = false; 

        // [CẬP NHẬT] Điều chỉnh kích thước đạn
        // Nếu là Dưa hấu (Melon) thì to hơn (60px), còn lại là 30px
        if (this.type === 'melon_pult') {
            this.width = 60;
            this.height = 60;
        } else {
            this.width = 30; // Kích thước tiêu chuẩn dễ nhìn hơn
            this.height = 30;
        }
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
        // Key ảnh đạn trong Resources.js là: "bullet_" + type
        let bulletImg = customImages[`bullet_${this.type}`];

        // Fallback: Nếu không tìm thấy ảnh đạn riêng, dùng đạn đậu xanh mặc định
        if (!bulletImg) {
            bulletImg = images.pea; 
        }

        // Vẽ viên đạn
        drawSprite(ctx, bulletImg, this.x, this.y, this.width, this.height, PROJECTILE_STATS.color);
    }
}