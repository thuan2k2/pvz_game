import { images, drawSprite } from '../Resources.js';
// [CẬP NHẬT] Import thêm các hằng số thời gian
import { SUN_VALUE, SUN_LIFESPAN_MIN_SEC, SUN_LIFESPAN_MAX_SEC } from '../constants.js';

export class Sun {
    /**
     * @param {number} x - Vị trí bắt đầu
     * @param {number} y - Vị trí bắt đầu
     * @param {number} targetY - Điểm dừng rơi
     * @param {boolean} isFromSky - [MỚI] Xác định có phải rơi từ trời không
     */
    constructor(x, y, targetY, isFromSky = false) {
        this.x = x;
        this.y = y;
        this.width = 100;
        this.height = 100;
        this.targetY = targetY || y; 
        
        this.amount = SUN_VALUE; 
        this.delete = false;     
        this.speed = 2; // [CẬP NHẬT] Tăng tốc độ rơi một chút cho mượt (0.5 hơi chậm)
        this.isFromSky = isFromSky;

        // [CẬP NHẬT] Tính thời gian tồn tại ngẫu nhiên (5s - 10s)
        // Giả sử game chạy 60 FPS
        const minFrames = SUN_LIFESPAN_MIN_SEC * 60;
        const maxFrames = SUN_LIFESPAN_MAX_SEC * 60;
        this.lifeTime = Math.floor(Math.random() * (maxFrames - minFrames + 1) + minFrames);
    }

    update() {
        // 1. Logic rơi: Nếu chưa chạm đất (targetY) thì rơi xuống
        if (this.y < this.targetY) {
            this.y += this.speed;
        } else {
            // [CẬP NHẬT] Chỉ khi đã chạm đất (hoặc sinh ra tại chỗ) mới bắt đầu đếm ngược thời gian
            this.lifeTime--;
            
            // Nếu hết thời gian sống -> Xóa
            if (this.lifeTime <= 0) {
                this.delete = true;
            }
        }
    }

    draw(ctx) {
        drawSprite(ctx, images.sun, this.x, this.y, this.width, this.height, 'yellow');
        
        // [HIỆU ỨNG] Nhấp nháy khi sắp mất (còn 1 giây ~ 60 frame)
        if (this.y >= this.targetY && this.lifeTime < 60) {
            if (Math.floor(this.lifeTime / 10) % 2 === 0) {
                ctx.globalAlpha = 0.5; // Làm mờ
                drawSprite(ctx, images.sun, this.x, this.y, this.width, this.height, 'yellow');
                ctx.globalAlpha = 1.0; // Reset
                return;
            }
        }
    }
}