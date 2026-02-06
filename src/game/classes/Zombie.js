// file: src/game/classes/Zombie.js
import { CELL_WIDTH, CELL_HEIGHT, GAME_WIDTH, ZOMBIE_TYPES } from '../constants.js';
import { images, customImages, drawSprite } from '../Resources.js'; 
import { PLANT_DATA } from '../../plantsData.js'; 

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
        this.type = type;

        // [CẢI TIẾN] Chuẩn hóa ID
        const safeType = type.toLowerCase();

        let stats = {};
        
        // 1. Tìm trong dữ liệu Admin
        let dynamicData = PLANT_DATA[type] || PLANT_DATA[safeType];
        
        // 2. Fallback dữ liệu cứng (chỉ dùng khi admin chưa có)
        const constantData = ZOMBIE_TYPES[type] || ZOMBIE_TYPES[safeType];

        // [FIX HÌNH ẢNH] Ưu tiên tải ảnh từ Admin nếu có link
        this.image = null;
        
        // Kiểm tra ảnh có sẵn trong kho tải trước
        if (customImages[type] || customImages[safeType]) {
            this.image = customImages[type] || customImages[safeType];
        } 
        // Nếu không, tạo ảnh mới từ URL trong PLANT_DATA
        else if (dynamicData && dynamicData.assets && dynamicData.assets.plant) {
            this.image = new Image();
            this.image.src = dynamicData.assets.plant;
        }

        // Lấy chỉ số (Máu, Tốc độ, Damage)
        if (dynamicData && dynamicData.stats) {
            stats = {
                speed: dynamicData.stats.speed || 0.2,
                health: dynamicData.stats.hp || 100, 
                damage: dynamicData.stats.damage || 1,
                reward: 10,
                color: 'green'
            };
        } else if (constantData) {
            stats = constantData;
        } else {
            stats = { speed: 0.2, health: 100, damage: 1, color: 'green', reward: 10 };
        }
        
        this.speed = parseFloat(stats.speed);
        this.movement = this.speed;
        this.health = parseInt(stats.health);
        this.maxHealth = parseInt(stats.health);
        this.damage = parseFloat(stats.damage);
        this.color = stats.color || 'green';
        this.reward = stats.reward;

        this.delete = false;
        this.isFrozen = false;
        this.frozenTimer = 0;
    }

    update() {
        this.x -= this.movement;

        // Logic bị đóng băng (Ice Pea)
        if (this.isFrozen) {
            this.frozenTimer++;
            if (this.frozenTimer > 120) { // 2 giây
                this.isFrozen = false;
                this.movement = this.speed; 
                this.frozenTimer = 0;
            } else {
                this.movement = this.speed * 0.5; // Giảm tốc 50%
            }
        }

        if (this.x < 0 - this.width) {
            this.delete = true;
        }
    }

    draw(ctx) {
        // [FIX] Sử dụng biến this.image đã xử lý ở constructor
        let currentImg = this.image;

        // Fallback: Nếu ảnh chưa tải xong hoặc bị lỗi, dùng ảnh mặc định
        if (!currentImg || !currentImg.complete || currentImg.naturalWidth === 0) {
            const safeType = this.type.toLowerCase();
            if (safeType.includes('conehead')) currentImg = images.conehead;
            else if (safeType.includes('buckethead')) currentImg = images.buckethead;
            else currentImg = images.zombie; // Mặc định là zombie thường
        }

        // Hiệu ứng đóng băng
        if (this.isFrozen) {
            ctx.save();
            ctx.filter = 'hue-rotate(180deg) brightness(1.2)'; 
        }

        drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height, this.color);

        if (this.isFrozen) {
            ctx.restore();
        }

        // Vẽ thanh máu
        if (this.health < this.maxHealth) {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x + 15, this.y - 10, this.width - 30, 8);
            
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x + 15, this.y - 10, (this.width - 30) * healthPercent, 8);
            
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x + 15, this.y - 10, this.width - 30, 8);
        }
    }
    
    takeDamage(amount, effectType = 'normal') {
        this.health -= amount;
        
        if (effectType === 'ice') {
            this.isFrozen = true;
            this.frozenTimer = 0;
        }
    }
}