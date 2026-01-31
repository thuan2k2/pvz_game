// Khai báo danh sách âm thanh
const sounds = {
    bgm: new Audio('/audio/bgm.mp3'),
    shoot: new Audio('/audio/shoot.mp3'),
    hit: new Audio('/audio/hit.mp3'),
    collect: new Audio('/audio/collect.mp3')
};

// Cấu hình nhạc nền (lặp lại vô tận & nhỏ tiếng thôi)
sounds.bgm.loop = true;
sounds.bgm.volume = 0.5;

// Hàm phát âm thanh
export function playSound(name) {
    const sound = sounds[name];
    if (sound) {
        // Nếu là hiệu ứng (không phải nhạc nền), cho phép phát đè lên nhau
        // (Ví dụ: 2 cây bắn cùng lúc thì nghe 2 tiếng)
        if (name !== 'bgm') {
            const clone = sound.cloneNode(); // Tạo bản sao để phát song song
            clone.volume = 0.8; // Hiệu ứng to hơn nhạc nền chút
            clone.play().catch(err => console.log("Chưa tương tác trang web, chặn autoplay"));
        } else {
            // Nhạc nền thì chỉ phát 1 lần
            sound.play().catch(err => console.log("Chưa tương tác trang web, chặn autoplay"));
        }
    }
}

// Hàm dừng âm thanh (Dùng khi Game Over)
export function stopSound(name) {
    const sound = sounds[name];
    if (sound) {
        sound.pause();
        sound.currentTime = 0;
    }
}