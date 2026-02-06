// file: src/game/classes/Plant.js
import { 
    CELL_WIDTH, CELL_HEIGHT, 
    PLANT_SUN_MIN_SEC, PLANT_SUN_MAX_SEC 
} from '../constants.js';
import { images, customImages, drawSprite } from '../Resources.js'; 
import { PLANT_DATA } from '../../plantsData.js'; 

export class Plant {
    // [CẬP NHẬT] Constructor nhận thêm plantInfo từ GameCore để tối ưu
    constructor(x, y, type, plantInfo = null) {
        this.x = x;
        this.y = y;
        this.width = CELL_WIDTH;
        this.height = CELL_HEIGHT;
        
        // 1. Lấy thông số (Ưu tiên từ tham số truyền vào, nếu không có mới tìm trong PLANT_DATA)
        const info = plantInfo || PLANT_DATA[type] || {}; 
        const stats = info.stats || { damage: 0, speed: 2, health: 100 }; 
        
        this.type = type; 
        
        // 2. Thiết lập Máu (Health)
        // [FIX] Sửa 'blocker' thành 'wallnut' để khớp với ID trong database
        this.maxHealth = stats.health || (type === 'wallnut' ? 4000 : 100);
        this.health = this.maxHealth;
        
        this.damage = stats.damage || 0; 
        
        // 3. Tốc độ bắn
        this.shootInterval = (stats.speed || 2) * 60;
        this.timer = 0; 
        
        this.isReadyToShoot = false;       
        this.isReadyToProduceSun = false;
        this.isReadyToExplode = false; 

        // Cờ tiến hóa (cho Wall-nut)
        this.isGold = false;

        this.mySuns = []; 
        // Logic cho Sunflower
        if (this.type === 'sunflower' || this.type === 'sunflower_twin') {
            this.shootInterval = this.getRandomSunTime();
        }

        // Trạng thái Plant Food
        this.isPowered = false;
        this.powerTimer = 0;
        this.originalShootInterval = this.shootInterval;
    }

    getRandomSunTime() {
        const minFrames = PLANT_SUN_MIN_SEC * 60;
        const maxFrames = PLANT_SUN_MAX_SEC * 60;
        return Math.floor(Math.random() * (maxFrames - minFrames + 1) + minFrames);
    }

    trackSun(sunObject) {
        this.mySuns.push(sunObject);
    }

    // HÀM KÍCH HOẠT PLANT FOOD
    activatePower() {
        if (this.type !== 'wallnut' && this.isPowered) return; 
        
        this.isPowered = true;
        this.powerTimer = 0;

        if (this.type === 'sunflower') {
            this.powerDuration = 60; // 1 giây phun nắng
        } 
        else if (this.damage > 0) { 
            this.powerDuration = 180; // 3 giây bắn siêu tốc
            this.shootInterval = 5;   // Tốc độ máy khâu
        }
        else if (this.type === 'wallnut') {
            // [LOGIC TIẾN HÓA WALL-NUT]
            this.isGold = true;       
            this.maxHealth = 8000;    
            this.health = 8000;       
            this.powerDuration = 60;  
        }
    }

    draw(ctx) {
        // 1. Ưu tiên ảnh động từ Admin (customImages)
        let currentImg = customImages[this.type];

        // 2. Fallback: Nếu không có ảnh động thì dùng ảnh tĩnh mặc định
        if (!currentImg) {
            if (this.type === 'peashooter') currentImg = images.shooter; // [FIX] ID là peashooter
            else if (this.type === 'sunflower') currentImg = images.sunflower;
            else if (this.type === 'cherrybomb') currentImg = images.cherrybomb;
            else if (this.type === 'wallnut') currentImg = images.blocker; // [FIX] ID là wallnut
            else if (this.type === 'wallnut_gold') currentImg = images.blocker_gold;
        }

        // Logic Wall-nut Vàng
        if (this.type === 'wallnut' && this.isGold) {
            if (images.blocker_gold && images.blocker_gold.complete) {
                currentImg = images.blocker_gold;
            }
        }
        
        // Hiệu ứng phát sáng
        if (this.isPowered) {
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#00ff00"; 
        }

        // Vẽ cây
        drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height);

        if (this.isPowered) {
            ctx.restore();
        }

        // Vẽ thanh máu (Trừ Cherry Bomb)
        if (this.health < this.maxHealth && this.type !== 'cherrybomb') {
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x + 15, this.y, this.width - 30, 5);
            
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            ctx.fillStyle = this.isGold ? 'gold' : (healthPercent > 0.5 ? '#00ff00' : 'red');
            
            ctx.fillRect(this.x + 15, this.y, (this.width - 30) * healthPercent, 5);
        }
    }

    update() {
        // XỬ LÝ POWER UP
        if (this.isPowered) {
            this.powerTimer++;

            if (this.type === 'sunflower') {
                if (this.powerTimer % 10 === 0 && this.powerTimer < 60) {
                    this.isReadyToProduceSun = true; 
                }
            }

            if (this.powerTimer >= this.powerDuration) {
                this.isPowered = false;
                if (this.damage > 0) {
                    this.shootInterval = this.originalShootInterval;
                }
            }
        }

        // LOGIC CHÍNH
        if (this.type === 'sunflower') {
            this.mySuns = this.mySuns.filter(s => !s.delete && !s.collected);

            if (this.mySuns.length < 2 || this.isPowered) {
                this.timer++;
                if (this.timer >= this.shootInterval) {
                    this.isReadyToProduceSun = true;
                    if (!this.isPowered) {
                        this.timer = 0; 
                        this.shootInterval = this.getRandomSunTime(); 
                    } else {
                        this.timer = 0;
                    }
                }
            } else {
                this.timer = 0;
            }
        } 
        else if (this.shootInterval > 0) {
            this.timer++;
            if (this.timer >= this.shootInterval) {
                if (this.damage > 0) {
                    this.isReadyToShoot = true;
                }
                else if (this.type === 'cherrybomb' || this.type === 'jalapeno') {
                    this.isReadyToExplode = true;
                }
                
                if (this.type !== 'cherrybomb' && this.type !== 'jalapeno') {
                    this.timer = 0;
                }
            }
        }
    }
}