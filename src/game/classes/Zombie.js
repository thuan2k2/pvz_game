import { CELL_WIDTH, CELL_HEIGHT, GAME_WIDTH, ZOMBIE_TYPES } from '../constants.js';
import { images, customImages, drawSprite } from '../Resources.js'; // [MỚI] Import customImages

export class Zombie {
    /**
     * @param {number} verticalPosition - Vị trí hàng
     * @param {string} type - Loại zombie ('normal', 'conehead', 'football', v.v...)
     */
    constructor(verticalPosition, type = 'normal') {
        this.x = GAME_WIDTH;
        this.y = verticalPosition;
        this.width = CELL_WIDTH;
        this.height = CELL_HEIGHT;

        // [CẬP NHẬT] Lấy thông số an toàn
        // Nếu loại zombie này chưa có trong file constants, dùng chỉ số mặc định
        const defaultStats = { speed: 0.2, health: 100, damage: 1, color: 'green', reward: 10 };
        const stats = ZOMBIE_TYPES[type] || defaultStats;
        
        this.type = type;
        this.speed = stats.speed;
        this.movement = this.speed;
        this.health = stats.health;
        this.maxHealth = stats.health;
        this.damage = stats.damage;
        this.color = stats.color;
        this.reward = stats.reward;

        this.delete = false;
    }

    update() {
        this.x -= this.movement;
        if (this.x < 0 - this.width) {
            this.delete = true;
        }
    }

    draw(ctx) {
        // [MỚI] 1. Ưu tiên chọn ảnh ĐỘNG từ Admin (customImages)
        // Nếu bạn thêm zombie ID "football", nó sẽ tìm customImages['football']
        let currentImg = customImages[this.type];

        // 2. Fallback: Nếu không có ảnh động thì dùng ảnh tĩnh cũ
        if (!currentImg) {
            if (this.type === 'conehead') currentImg = images.conehead;
            else if (this.type === 'buckethead') currentImg = images.buckethead;
            else currentImg = images.zombie; // Mặc định là zombie thường
        }

        // 3. Vẽ Zombie
        drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height, this.color);

        // 4. Vẽ thanh máu (Chỉ vẽ khi máu không đầy)
        if (this.health < this.maxHealth) {
            // Khung đỏ nền
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x + 15, this.y - 10, this.width - 30, 8);
            
            // Máu xanh hiện tại
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x + 15, this.y - 10, (this.width - 30) * healthPercent, 8);
            
            // Viền đen cho rõ
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x + 15, this.y - 10, this.width - 30, 8);
        }
    }
}