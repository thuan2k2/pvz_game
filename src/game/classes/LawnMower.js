import { CELL_HEIGHT, GRID_START_X, TOP_OFFSET, GAME_WIDTH } from '../constants.js';
import { collision } from '../utils.js';
import { images } from '../Resources.js';

export class LawnMower {
    constructor(rowIndex) {
        // Vị trí nằm bên trái vùng trồng cây
        this.x = GRID_START_X - 80; 
        this.y = TOP_OFFSET + (rowIndex * CELL_HEIGHT) + 10; // Căn giữa dòng
        this.width = 70;
        this.height = 70;
        
        this.isActive = false; // Trạng thái đang chạy
        this.isUsed = false;   // Trạng thái đã chạy xong (biến mất)
        this.speed = 10;       // Tốc độ chạy rất nhanh
        
        // Âm thanh
        this.sound = new Audio('assets/lawnmower.ogg');
        this.sound.volume = 0.5;
    }

    update(zombies) {
        if (this.isUsed) return;

        // 1. Nếu đang chạy thì di chuyển sang phải
        if (this.isActive) {
            this.x += this.speed;
            
            // Xử lý va chạm khi đang chạy (Cán chết zombie)
            for (let i = 0; i < zombies.length; i++) {
                const z = zombies[i];
                // Chỉ cán zombie cùng hàng và không phải loại bay (ví dụ balloon)
                if (!z.delete && 
                    z.y === (this.y - 10) && // Hack nhẹ để khớp row y
                    z.x < this.x + this.width && 
                    z.x + z.width > this.x &&
                    z.type !== 'balloon') { // [Logic] Không diệt zombie bay
                    
                    z.health = 0; // Chết ngay lập tức
                }
            }

            // Ra khỏi màn hình thì xóa
            if (this.x > GAME_WIDTH) {
                this.isUsed = true;
            }
        } 
        // 2. Nếu đang đứng yên thì check xem có zombie nào chạm vào không
        else {
            for (const z of zombies) {
                if (collision(this, z) && z.x < this.x + 50) { // Zombie chạm vào
                    this.activate();
                    break;
                }
            }
        }
    }

    activate() {
        if (!this.isActive) {
            this.isActive = true;
            this.sound.currentTime = 0;
            this.sound.play().catch(e => console.log("Chưa tương tác user nên chưa play audio"));
        }
    }

    draw(ctx) {
        if (this.isUsed) return;
        
        if (images.lawnmower && images.lawnmower.complete) {
            ctx.drawImage(images.lawnmower, this.x, this.y, this.width, this.height);
        } else {
            // Vẽ tạm nếu chưa có ảnh
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'black';
            ctx.fillText("MOWER", this.x, this.y + 40);
        }
    }
}