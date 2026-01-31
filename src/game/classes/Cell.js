import { CELL_WIDTH, CELL_HEIGHT } from '../constants.js';
import { collision } from '../utils.js';

export class Cell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = CELL_WIDTH;
        this.height = CELL_HEIGHT;
    }

    /**
     * Vẽ ô đất và xử lý hiệu ứng khi chuột lướt qua
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} mouse - Tọa độ chuột {x, y, width, height}
     */
    draw(ctx, mouse) {
        // [CẬP NHẬT] Đã ẩn viền đen theo yêu cầu
        // ctx.strokeStyle = 'black';
        // ctx.lineWidth = 1;
        // ctx.strokeRect(this.x, this.y, this.width, this.height);

        // Hiệu ứng Hover: Nếu chuột đang ở trong ô này -> tô màu sáng lên
        // Chúng ta dùng hàm collision đã viết ở utils.js để kiểm tra va chạm
        if (mouse.x && mouse.y && collision(this, mouse)) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; // Màu trắng mờ (30%)
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}