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
        this.behavior = info.behavior || "shooter"; 

        // 2. Thiết lập Máu (Health)
        this.maxHealth = stats.hp || (type === 'wallnut' ? 4000 : 100);
        this.health = this.maxHealth;
        this.damage = stats.damage || 0; 
        
        // 3. Tốc độ hồi chiêu
        this.shootInterval = (stats.speed > 0 ? stats.speed : 999) * 60;
        this.timer = 0; 
        
        // [FIX HÌNH ẢNH] Tạo ảnh từ URL Admin (Lazy load)
        this.image = null;
        if (customImages[this.type]) {
            this.image = customImages[this.type]; 
        } else if (info.assets && info.assets.plant) {
            this.image = new Image();
            this.image.src = info.assets.plant;
        }

        // Trạng thái
        this.isReadyToShoot = false;       
        this.isReadyToProduceSun = false;
        this.isReadyToExplode = false; 
        this.isGold = false;
        this.mySuns = []; 
        
        if (this.behavior === 'producer') {
            this.shootInterval = this.getRandomSunTime();
            this.timer = Math.floor(Math.random() * 100); 
        } else if (this.behavior === 'mine') {
            this.isArmed = false;
            this.armTimer = 0;
            this.armDuration = 200; 
        }

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

    activatePower() {
        if (this.type !== 'wallnut' && this.isPowered) return; 
        this.isPowered = true;
        this.powerTimer = 0;

        if (this.behavior === 'producer') {
            this.powerDuration = 60; 
        } else if (['shooter', 'lobbed', 'slow'].includes(this.behavior)) { 
            this.powerDuration = 180; 
            this.shootInterval = 5;   
        } else if (this.behavior === 'wall' || this.type === 'wallnut') {
            this.isGold = true;       
            this.maxHealth = 8000;    
            this.health = 8000;       
            this.powerDuration = 60;  
        } else if (this.behavior === 'mine') {
            this.isArmed = true; 
            this.powerDuration = 60;
        }
    }

    draw(ctx) {
        // [FIX] Vẽ ảnh đã tải
        let currentImg = this.image;

        // Fallback tạm thời nếu ảnh chưa load
        if (!currentImg || !currentImg.complete || currentImg.naturalWidth === 0) {
            // Có thể vẽ một ô vuông màu tạm thời hoặc ảnh mặc định
            if (this.type.includes('peashooter')) currentImg = images.shooter;
            else if (this.type.includes('sunflower')) currentImg = images.sunflower;
            else currentImg = images.shooter; 
        }

        if (this.isGold && images.blocker_gold && images.blocker_gold.complete) {
            currentImg = images.blocker_gold;
        }
        
        if (this.isPowered) {
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#00ff00"; 
        }

        if (this.behavior === 'mine' && !this.isArmed) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height);
            ctx.restore();
        } else {
            drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height);
        }

        if (this.isPowered) ctx.restore();

        if (this.health < this.maxHealth && this.behavior !== 'instant_kill' && this.behavior !== 'squash') {
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x + 15, this.y, this.width - 30, 5);
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            ctx.fillStyle = this.isGold ? 'gold' : (healthPercent > 0.5 ? '#00ff00' : 'red');
            ctx.fillRect(this.x + 15, this.y, (this.width - 30) * healthPercent, 5);
        }
    }

    update() {
        if (this.isPowered) {
            this.powerTimer++;
            if (this.behavior === 'producer') {
                if (this.powerTimer % 10 === 0 && this.powerTimer < 60) this.isReadyToProduceSun = true; 
            }
            if (this.powerTimer >= this.powerDuration) {
                this.isPowered = false;
                if (['shooter', 'lobbed', 'slow'].includes(this.behavior)) this.shootInterval = this.originalShootInterval;
            }
        }

        this.timer++;

        switch (this.behavior) {
            case 'producer': 
                this.mySuns = this.mySuns.filter(s => !s.delete && !s.collected);
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
                    this.timer = 0; 
                }
                break;

            case 'shooter': case 'lobbed': case 'slow':       
                if (this.timer >= this.shootInterval) {
                    this.isReadyToShoot = true;
                }
                break;

            case 'mine':         
                if (!this.isArmed) {
                    if (this.timer >= this.armDuration) this.isArmed = true; 
                }
                break;

            case 'instant_kill': case 'squash':       
                if (this.timer >= 60) this.isReadyToExplode = true;
                break;

            case 'wall': break;

            default: 
                if (this.timer >= this.shootInterval) this.isReadyToShoot = true;
                break;
        }
    }
}