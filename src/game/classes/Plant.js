import { 
    CELL_WIDTH, CELL_HEIGHT, PLANT_TYPES, 
    PLANT_SUN_MIN_SEC, PLANT_SUN_MAX_SEC 
} from '../constants.js';
import { images, drawSprite } from '../Resources.js';
// import { playSound } from '../Audio.js'; 

export class Plant {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = CELL_WIDTH;
        this.height = CELL_HEIGHT;
        
        const stats = PLANT_TYPES[type];
        
        this.type = type; 
        this.health = stats.health;
        this.maxHealth = stats.health;
        this.color = stats.color;
        this.damage = stats.damage; 
        
        this.shootInterval = stats.shootInterval;
        this.timer = 0; 
        
        this.isReadyToShoot = false;       
        this.isReadyToProduceSun = false;
        this.isReadyToExplode = false; 

        // [MỚI] Cờ xác định trạng thái tiến hóa (cho blocker)
        this.isGold = false;

        this.mySuns = []; 
        if (this.type === 'sunflower') {
            this.shootInterval = this.getRandomSunTime();
        }

        // [MỚI] Trạng thái Power Up (Plant Food)
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

    // [MỚI] HÀM KÍCH HOẠT PLANT FOOD
    activatePower() {
        // Blocker có thể dùng thuốc nhiều lần để hồi máu/tiến hóa, các cây khác đang dùng thì thôi
        if (this.type !== 'blocker' && this.isPowered) return; 
        
        this.isPowered = true;
        this.powerTimer = 0;

        if (this.type === 'sunflower') {
            this.powerDuration = 60; // Hiệu ứng 1 giây
        } 
        else if (this.type === 'shooter') {
            this.powerDuration = 180; // 3 giây bắn siêu nhanh
            this.shootInterval = 5; // Tốc độ bắn cực nhanh (5 frame/phát)
        }
        else if (this.type === 'blocker') {
            // [LOGIC TIẾN HÓA BLOCKER]
            this.isGold = true;       // Bật trạng thái vàng
            this.maxHealth = 2400;    // Tăng giới hạn máu
            this.health = 2400;       // Hồi đầy máu mới
            this.powerDuration = 60;  // Thời gian hiệu ứng phát sáng
        }
    }

    draw(ctx) {
        let currentImg = images.shooter;
        
        // [CẬP NHẬT] Logic chọn ảnh cho Blocker
        if (this.type === 'blocker') {
            // Nếu đã tiến hóa và ảnh vàng đã tải xong thì dùng ảnh vàng
            if (this.isGold && images.blocker_gold && images.blocker_gold.complete) {
                currentImg = images.blocker_gold;
            } else {
                currentImg = images.blocker;
            }
        }
        
        if (this.type === 'sunflower') currentImg = images.sunflower;
        if (this.type === 'cherrybomb') currentImg = images.cherrybomb;

        // [MỚI] Hiệu ứng phát sáng khi đang dùng thuốc
        if (this.isPowered) {
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#00ff00"; // Phát sáng xanh lá
        }

        drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height, this.color);

        if (this.isPowered) {
            ctx.restore();
        }

        // Vẽ thanh máu
        if (this.health < this.maxHealth && this.type !== 'cherrybomb') {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x + 15, this.y, this.width - 30, 5);
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            
            // [MỚI] Nếu là Gold Blocker thì thanh máu màu vàng
            ctx.fillStyle = this.isGold ? 'gold' : '#00ff00';
            
            ctx.fillRect(this.x + 15, this.y, (this.width - 30) * healthPercent, 5);
        }
    }

    update() {
        // [MỚI] XỬ LÝ KHI ĐANG DÙNG THUỐC (POWER UP)
        if (this.isPowered) {
            this.powerTimer++;

            // Logic Sunflower Power: Phun ra liên tiếp
            if (this.type === 'sunflower') {
                if (this.powerTimer % 10 === 0 && this.powerTimer < 60) {
                    this.isReadyToProduceSun = true; 
                }
            }

            // Hết thời gian hiệu ứng
            if (this.powerTimer >= this.powerDuration) {
                this.isPowered = false;
                
                // Reset lại chỉ số gốc (cho Shooter)
                if (this.type === 'shooter') {
                    this.shootInterval = this.originalShootInterval;
                }
                // Blocker: Không reset isGold (vàng vĩnh viễn)
            }
        }

        // --- LOGIC CŨ (BÌNH THƯỜNG) ---
        if (this.type === 'sunflower') {
            // Loại bỏ mặt trời đã xóa hoặc đã nhặt
            this.mySuns = this.mySuns.filter(s => !s.delete && !s.collected);

            // [FIX] Nếu đang Power thì bỏ qua check giới hạn số lượng để phun liên tục
            if (this.mySuns.length < 2 || this.isPowered) {
                this.timer++;
                
                if (this.timer >= this.shootInterval) {
                    this.isReadyToProduceSun = true;
                    
                    // Nếu đang Power thì không reset timer chính để tránh xung đột logic
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
        // --- LOGIC CHO CÁC CÂY KHÁC ---
        else if (this.shootInterval > 0) {
            this.timer++;
            
            if (this.timer >= this.shootInterval) {
                if (this.type === 'shooter') {
                    this.isReadyToShoot = true;
                }
                else if (this.type === 'cherrybomb') {
                    this.isReadyToExplode = true;
                }
                
                if (this.type !== 'cherrybomb') {
                    this.timer = 0;
                }
            }
        }
    }
}