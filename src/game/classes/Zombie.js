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

        // [CẢI TIẾN] Chuẩn hóa ID để tránh lỗi hoa thường/hoa in
        // Ví dụ: 'Conehead' -> 'conehead'
        const safeType = type.toLowerCase();

        let stats = {};
        
        // 1. Tìm trong dữ liệu Admin (PLANT_DATA chứa cả zombie)
        // Thử tìm chính xác, nếu không thấy thì tìm ID viết thường
        let dynamicData = PLANT_DATA[type] || PLANT_DATA[safeType];
        
        // 2. Nếu vẫn không thấy, thử tìm trong ZOMBIE_TYPES (dữ liệu cứng)
        const constantData = ZOMBIE_TYPES[type] || ZOMBIE_TYPES[safeType];

        // LOG KIỂM TRA ĐỂ DEBUG
        if (!dynamicData && !constantData) {
            console.warn(`⚠️ Zombie ID "${type}" không tồn tại trong hệ thống! Đang dùng chỉ số mặc định.`);
        }

        if (dynamicData && dynamicData.stats) {
            // Dữ liệu từ Admin
            stats = {
                speed: dynamicData.stats.speed || 0.2,
                health: dynamicData.stats.hp || 100, 
                damage: dynamicData.stats.damage || 1,
                reward: 10,
                color: 'green'
            };
        } else if (constantData) {
            // Dữ liệu cứng (Fallback)
            stats = constantData;
        } else {
            // Mặc định cuối cùng (Tránh crash game)
            stats = { speed: 0.2, health: 100, damage: 1, color: 'green', reward: 10 };
        }
        
        // Gán chỉ số vào đối tượng Zombie
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
            if (this.frozenTimer > 120) { // 2 giây (60fps * 2)
                this.isFrozen = false;
                this.movement = this.speed; // Hết đóng băng -> Tốc độ thường
                this.frozenTimer = 0;
            } else {
                this.movement = this.speed * 0.5; // Giảm tốc 50%
            }
        }

        // Nếu đi quá màn hình bên trái -> Xóa
        if (this.x < 0 - this.width) {
            this.delete = true;
        }
    }

    draw(ctx) {
        // [CẢI TIẾN] Tìm ảnh động (Custom)
        // Thử tìm theo ID chính xác hoặc ID viết thường
        let currentImg = customImages[this.type] || customImages[this.type.toLowerCase()];

        // Fallback: Nếu không có ảnh động thì dùng ảnh tĩnh cũ
        if (!currentImg) {
            const safeType = this.type.toLowerCase();
            if (safeType.includes('conehead')) currentImg = images.conehead;
            else if (safeType.includes('buckethead')) currentImg = images.buckethead;
            else currentImg = images.zombie; // Mặc định là zombie thường
        }

        // Hiệu ứng đóng băng (Vẽ màu xanh lam đè lên)
        if (this.isFrozen) {
            ctx.save();
            ctx.filter = 'hue-rotate(180deg) brightness(1.2)'; 
        }

        // Vẽ Zombie
        drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height, this.color);

        if (this.isFrozen) {
            ctx.restore();
        }

        // Vẽ thanh máu (Chỉ vẽ khi máu không đầy)
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
    
    // Hàm nhận sát thương (Dùng cho đạn bắn trúng)
    takeDamage(amount, effectType = 'normal') {
        this.health -= amount;
        
        if (effectType === 'ice') {
            this.isFrozen = true;
            this.frozenTimer = 0;
        }
    }
}