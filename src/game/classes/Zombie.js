import { CELL_WIDTH, CELL_HEIGHT, GAME_WIDTH, ZOMBIE_TYPES } from '../constants.js';
import { images, drawSprite } from '../Resources.js';

export class Zombie {
    /**
     * @param {number} verticalPosition - Vị trí hàng
     * @param {string} type - Loại zombie ('normal', 'conehead', 'buckethead')
     */
    constructor(verticalPosition, type = 'normal') {
        this.x = GAME_WIDTH;
        this.y = verticalPosition;
        this.width = CELL_WIDTH;
        this.height = CELL_HEIGHT;

        // Lấy thông số theo loại
        const stats = ZOMBIE_TYPES[type];
        
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
        // 1. Chọn ảnh dựa trên loại Zombie
        let currentImg = images.zombie; // Mặc định
        if (this.type === 'conehead') currentImg = images.conehead;
        if (this.type === 'buckethead') currentImg = images.buckethead;

        // 2. Vẽ Zombie
        drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height, this.color);

        // 3. Vẽ thanh máu (Quan trọng để biết con nào trâu)
        if (this.health < this.maxHealth) {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x + 15, this.y - 10, this.width - 30, 8);
            
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x + 15, this.y - 10, (this.width - 30) * healthPercent, 8);
        }
    }
}