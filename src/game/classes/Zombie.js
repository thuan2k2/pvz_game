import { CELL_WIDTH, CELL_HEIGHT, GAME_WIDTH, ZOMBIE_TYPES } from '../constants.js';
import { images, customImages, drawSprite } from '../Resources.js'; 
import { PLANT_DATA } from '../../plantsData.js'; // [MỚI] Import dữ liệu động

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

        // [LOGIC MỚI] Xử lý thống kê (Stats) theo thứ tự ưu tiên:
        // 1. Dữ liệu từ Admin (PLANT_DATA)
        // 2. Dữ liệu cứng (ZOMBIE_TYPES)
        // 3. Mặc định an toàn
        
        let stats = {};
        const dynamicData = PLANT_DATA[type]; // Dữ liệu tải từ Firestore
        const constantData = ZOMBIE_TYPES[type]; // Dữ liệu cứng

        if (dynamicData && dynamicData.stats) {
            // Nếu có dữ liệu từ Admin -> Dùng nó
            stats = {
                speed: dynamicData.stats.speed || 0.2,
                health: dynamicData.stats.hp || 100, // Admin lưu là 'hp'
                damage: dynamicData.stats.damage || 1,
                reward: 10, // Hiện tại Admin chưa chỉnh reward, để mặc định
                color: 'green'
            };
        } else if (constantData) {
            // Fallback về dữ liệu cứng
            stats = constantData;
        } else {
            // Fallback cuối cùng
            stats = { speed: 0.2, health: 100, damage: 1, color: 'green', reward: 10 };
        }
        
        // Gán chỉ số
        this.speed = stats.speed;
        this.movement = this.speed;
        this.health = stats.health;
        this.maxHealth = stats.health;
        this.damage = stats.damage;
        this.color = stats.color || 'green';
        this.reward = stats.reward;

        this.delete = false;
        
        // Hiệu ứng trạng thái
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
        // 1. Ưu tiên chọn ảnh ĐỘNG từ Admin (customImages)
        let currentImg = customImages[this.type];

        // 2. Fallback: Nếu không có ảnh động thì dùng ảnh tĩnh cũ
        if (!currentImg) {
            if (this.type === 'conehead') currentImg = images.conehead;
            else if (this.type === 'buckethead') currentImg = images.buckethead;
            else currentImg = images.zombie; // Mặc định
        }

        // 3. Hiệu ứng đóng băng (Vẽ màu xanh lam đè lên)
        if (this.isFrozen) {
            ctx.save();
            ctx.filter = 'hue-rotate(180deg) brightness(1.2)'; 
        }

        // 4. Vẽ Zombie
        drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height, this.color);

        if (this.isFrozen) {
            ctx.restore();
        }

        // 5. Vẽ thanh máu (Chỉ vẽ khi máu không đầy)
        if (this.health < this.maxHealth) {
            // Khung đỏ nền
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x + 15, this.y - 10, this.width - 30, 8);
            
            // Máu xanh hiện tại
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x + 15, this.y - 10, (this.width - 30) * healthPercent, 8);
            
            // Viền đen
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