/**
 * Kiểm tra va chạm giữa 2 hình chữ nhật (AABB Collision)
 * first: Đối tượng 1 (có x, y, width, height)
 * second: Đối tượng 2 (có x, y, width, height)
 * Trả về: true nếu đang chạm nhau, false nếu không
 */
export function collision(first, second) {
    if (    !(first.x > second.x + second.width ||
              first.x + first.width < second.x ||
              first.y > second.y + second.height ||
              first.y + first.height < second.y)
    ) {
        return true;
    }
    return false;
};

/**
 * Hàm hỗ trợ vẽ văn bản căn giữa (dùng cho Game Over hoặc thông báo)
 */
export function drawTextCentered(ctx, text, x, y, font = "30px Arial", color = "white") {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    // Reset lại để không ảnh hưởng các phần vẽ khác
    ctx.textAlign = "start"; 
    ctx.textBaseline = "alphabetic";
}