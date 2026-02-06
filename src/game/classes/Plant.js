// file: src/game/classes/Plant.js
import { CELL_WIDTH, CELL_HEIGHT, PLANT_SUN_MIN_SEC, PLANT_SUN_MAX_SEC } from '../constants.js';
import { images, customImages, drawSprite } from '../Resources.js'; 
import { PLANT_DATA } from '../../plantsData.js'; 

export class Plant {
    constructor(x, y, type, plantInfo = null) {
        this.x = x;
        this.y = y;
        this.width = CELL_WIDTH;
        this.height = CELL_HEIGHT;
        
        // 1. Lấy thông số (Ưu tiên từ tham số truyền vào)
        const info = plantInfo || PLANT_DATA[type] || {}; 
        const stats = info.stats || { damage: 0, speed: 2, health: 100 }; 
        
        this.type = type; 
        // [QUAN TRỌNG] Lấy hành vi từ Admin (Mặc định là shooter)
        this.behavior = info.behavior || "shooter"; 

        // 2. Thiết lập Máu (Health)
        this.maxHealth = stats.hp || (type === 'wallnut' ? 4000 : 100);
        this.health = this.maxHealth;
        
        this.damage = stats.damage || 0; 
        
        // 3. Tốc độ hồi chiêu (Frames)
        // [FIX] Nếu speed = 0 thì không bao giờ kích hoạt
        this.shootInterval = (stats.speed > 0 ? stats.speed : 999) * 60;
        this.timer = 0; 
        
        // Trạng thái
        this.isReadyToShoot = false;       
        this.isReadyToProduceSun = false;
        this.isReadyToExplode = false; 

        // Cờ tiến hóa (cho Wall-nut)
        this.isGold = false;

        this.mySuns = []; 
        
        // Cấu hình riêng theo behavior
        if (this.behavior === 'producer') {
            this.shootInterval = this.getRandomSunTime();
            this.timer = Math.floor(Math.random() * 100); // Random offset lần đầu
        } else if (this.behavior === 'mine') {
            this.isArmed = false;
            this.armTimer = 0;
            this.armDuration = 200; // ~3.3s để kích hoạt
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

        if (this.behavior === 'producer') {
            this.powerDuration = 60; // 1 giây phun nắng liên tục
        } 
        else if (['shooter', 'lobbed', 'slow'].includes(this.behavior)) { 
            this.powerDuration = 180; // 3 giây bắn siêu tốc
            this.shootInterval = 5;   // Tốc độ máy khâu
        }
        else if (this.behavior === 'wall' || this.type === 'wallnut') {
            this.isGold = true;       
            this.maxHealth = 8000;    
            this.health = 8000;       
            this.powerDuration = 60;  
        }
        else if (this.behavior === 'mine') {
            this.isArmed = true; // Kích hoạt ngay lập tức
            this.powerDuration = 60;
        }
    }

    draw(ctx) {
        // 1. Ưu tiên ảnh động từ Admin
        let currentImg = customImages[this.type];

        // 2. Fallback ảnh tĩnh
        if (!currentImg) {
            if (this.type.includes('peashooter')) currentImg = images.shooter;
            else if (this.type.includes('sunflower')) currentImg = images.sunflower;
            else if (this.type.includes('cherrybomb')) currentImg = images.cherrybomb;
            else if (this.type.includes('wallnut')) currentImg = images.blocker;
            else if (this.type === 'wallnut_gold') currentImg = images.blocker_gold;
            else currentImg = images.shooter; // Mặc định
        }

        // Logic Wall-nut Vàng
        if (this.isGold && images.blocker_gold && images.blocker_gold.complete) {
            currentImg = images.blocker_gold;
        }
        
        // Hiệu ứng phát sáng khi dùng Plant Food
        if (this.isPowered) {
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#00ff00"; 
        }

        // Logic mờ cho Mìn chưa kích hoạt
        if (this.behavior === 'mine' && !this.isArmed) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height);
            ctx.restore();
        } else {
            drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height);
        }

        if (this.isPowered) ctx.restore();

        // Vẽ thanh máu (Trừ cây nổ ngay)
        if (this.health < this.maxHealth && this.behavior !== 'instant_kill' && this.behavior !== 'squash') {
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

            if (this.behavior === 'producer') {
                if (this.powerTimer % 10 === 0 && this.powerTimer < 60) {
                    this.isReadyToProduceSun = true; 
                }
            }

            if (this.powerTimer >= this.powerDuration) {
                this.isPowered = false;
                if (['shooter', 'lobbed', 'slow'].includes(this.behavior)) {
                    this.shootInterval = this.originalShootInterval;
                }
            }
        }

        // LOGIC CHÍNH THEO HÀNH VI
        this.timer++;

        switch (this.behavior) {
            case 'producer': // Sunflower
                this.mySuns = this.mySuns.filter(s => !s.delete && !s.collected);
                // Giới hạn số lượng sun trên sân để không spam quá nhiều
                if (this.mySuns.length < 2 || this.isPowered) {
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
                    this.timer = 0; // Đợi nhặt sun xong mới đếm tiếp
                }
                break;

            case 'shooter':      // Bắn thẳng
            case 'lobbed':       // Bắn cong
            case 'slow':         // Bắn chậm
                // Logic timer đơn giản, việc kiểm tra có zombie hay không để bắn sẽ nằm ở GameCore
                if (this.timer >= this.shootInterval) {
                    this.isReadyToShoot = true;
                    // Timer sẽ được reset ở GameCore khi đạn thực sự được bắn
                }
                break;

            case 'mine':         // Mìn
                if (!this.isArmed) {
                    // Đếm ngược để kích hoạt
                    if (this.timer >= this.armDuration) {
                        this.isArmed = true; 
                    }
                }
                // Nếu đã armed, chờ va chạm zombie ở GameCore
                break;

            case 'instant_kill': // Cherry Bomb
            case 'squash':       // Squash
                if (this.timer >= 60) { // Đợi 1s animation
                    this.isReadyToExplode = true;
                }
                break;

            case 'wall':         // Wall-nut
                // Không làm gì cả
                break;

            default: // Mặc định Shooter
                if (this.timer >= this.shootInterval) {
                    this.isReadyToShoot = true;
                }
                break;
        }
    }
}