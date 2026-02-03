import { 
    CELL_WIDTH, CELL_HEIGHT, 
    PLANT_SUN_MIN_SEC, PLANT_SUN_MAX_SEC 
} from '../constants.js';
import { images, customImages, drawSprite } from '../Resources.js'; // Thêm customImages
import { PLANT_DATA } from '../../plantsData.js'; // [MỚI] Sử dụng dữ liệu cây động

export class Plant {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = CELL_WIDTH;
        this.height = CELL_HEIGHT;
        
        // [MỚI] Lấy thông số từ PLANT_DATA (bao gồm cả cây cũ và cây mới từ Admin)
        const plantInfo = PLANT_DATA[type] || {}; 
        const stats = plantInfo.stats || { damage: 0, speed: 2, health: 100 }; // Fallback nếu lỗi
        
        this.type = type; 
        
        // [MỚI] Thiết lập máu (Health)
        // Nếu trong data không có health thì mặc định là 100 (cho cây thường) hoặc 4000 (cho Wall-nut)
        this.maxHealth = stats.health || (type === 'blocker' ? 4000 : 100);
        this.health = this.maxHealth;
        
        this.damage = stats.damage || 0; 
        
        // Chuyển đổi tốc độ (giây) sang frame (60 FPS)
        // Nếu speed = 1.5s -> shootInterval = 90 frames
        this.shootInterval = (stats.speed || 2) * 60;
        this.timer = 0; 
        
        this.isReadyToShoot = false;       
        this.isReadyToProduceSun = false;
        this.isReadyToExplode = false; 

        // [MỚI] Cờ xác định trạng thái tiến hóa (cho blocker)
        this.isGold = false;

        this.mySuns = []; 
        // Logic riêng cho Hoa Hướng Dương (Tạo nắng ngẫu nhiên)
        if (this.type === 'sunflower' || this.type === 'sunflower_twin') {
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
        else if (this.damage > 0) { // Áp dụng cho mọi cây tấn công
            this.powerDuration = 180; // 3 giây bắn siêu nhanh
            this.shootInterval = 5; // Tốc độ bắn cực nhanh (5 frame/phát)
        }
        else if (this.type === 'blocker') {
            // [LOGIC TIẾN HÓA BLOCKER]
            this.isGold = true;       // Bật trạng thái vàng
            this.maxHealth = 8000;    // Tăng giới hạn máu gấp đôi
            this.health = 8000;       // Hồi đầy máu mới
            this.powerDuration = 60;  // Thời gian hiệu ứng phát sáng
        }
    }

    draw(ctx) {
        // [QUAN TRỌNG] Ưu tiên dùng ảnh động từ Admin (customImages)
        // Key ảnh động: 'peashooter', 'melon_pult', ...
        let currentImg = customImages[this.type];

        // Fallback: Nếu không có ảnh động thì dùng ảnh tĩnh cũ
        if (!currentImg) {
            if (this.type === 'shooter') currentImg = images.shooter;
            else if (this.type === 'sunflower') currentImg = images.sunflower;
            else if (this.type === 'cherrybomb') currentImg = images.cherrybomb;
            else if (this.type === 'blocker') currentImg = images.blocker;
            // ... thêm các fallback khác nếu cần
        }

        // [LOGIC BLOCKER GOLD]
        if (this.type === 'blocker' && this.isGold) {
            if (images.blocker_gold && images.blocker_gold.complete) {
                currentImg = images.blocker_gold;
            }
        }
        
        // [MỚI] Hiệu ứng phát sáng khi đang dùng thuốc
        if (this.isPowered) {
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#00ff00"; // Phát sáng xanh lá
        }

        // Vẽ cây
        drawSprite(ctx, currentImg, this.x, this.y, this.width, this.height);

        if (this.isPowered) {
            ctx.restore();
        }

        // Vẽ thanh máu (Chỉ vẽ khi mất máu)
        if (this.health < this.maxHealth && this.type !== 'cherrybomb') {
            // Khung thanh máu
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x + 15, this.y, this.width - 30, 5);
            
            // Thanh máu hiện tại
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            ctx.fillStyle = this.isGold ? 'gold' : (healthPercent > 0.5 ? '#00ff00' : 'red');
            
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
                
                // Reset lại chỉ số gốc (cho Shooter và các cây tấn công)
                if (this.damage > 0) {
                    this.shootInterval = this.originalShootInterval;
                }
                // Blocker: Không reset isGold (vàng vĩnh viễn)
            }
        }

        // --- LOGIC HOẠT ĐỘNG CHÍNH ---
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
                // Cây nào có damage > 0 thì bắn
                if (this.damage > 0) {
                    this.isReadyToShoot = true;
                }
                else if (this.type === 'cherrybomb' || this.type === 'jalapeno') {
                    this.isReadyToExplode = true;
                }
                
                // Reset timer (trừ cây nổ dùng 1 lần)
                if (this.type !== 'cherrybomb' && this.type !== 'jalapeno') {
                    this.timer = 0;
                }
            }
        }
    }
}