// --- CẤU HÌNH BẢN ĐỒ ---
export const CELL_WIDTH = 71; 
export const CELL_HEIGHT = 100; 

// [ĐÃ CHỈNH SỬA] Điều chỉnh để khớp với nền mới
export const TOP_OFFSET = 80; 
export const GRID_START_X = 210; 

export const GAME_WIDTH = 1200;
export const GAME_HEIGHT = 600;

export const GRID_COLS = 9;
export const GRID_ROWS = 5;

// --- CẤU HÌNH TÀI NGUYÊN ---
export const INITIAL_SUN = 100;
export const SUN_VALUE = 25;
export const SUN_SPAWN_RATE = 500; 

// [FIX LỖI] Điều chỉnh lại thời gian cho hợp lý hơn
// 1. Mặt trời rơi từ trên trời (Tăng lên 10s - 15s để không bị rơi quá nhiều)
export const SKY_SUN_MIN_SEC = 20;
export const SKY_SUN_MAX_SEC = 30;

// 2. Mặt trời sinh ra từ cây (Giữ nguyên 3s - 5s như bạn muốn hoặc tăng nhẹ nếu cần)
export const PLANT_SUN_MIN_SEC = 15;
export const PLANT_SUN_MAX_SEC = 30;

// 3. Thời gian tồn tại của mặt trời (5s - 10s)
export const SUN_LIFESPAN_MIN_SEC = 10;
export const SUN_LIFESPAN_MAX_SEC = 15;

// --- CẤU HÌNH CÁC LOẠI CÂY ---
export const PLANT_TYPES = {
    shooter: {
        id: 'shooter', name: 'Pea Shooter', cost: 100, health: 100,
        damage: 5, range: 9, color: '#00aa00', shootInterval: 350, type: 'attack'
    },
    blocker: {
        id: 'blocker', name: 'Wall Nut', cost: 50, health: 1200,
        damage: 0, range: 0, color: '#8B4513', shootInterval: 0, type: 'defense'
    },
    sunflower: {
        id: 'sunflower', name: 'Sunflower', cost: 50, health: 60,
        damage: 0, range: 0, color: 'yellow', shootInterval: 300, type: 'producer'
    },
    cherrybomb: {
        id: 'cherrybomb', name: 'Cherry Bomb', cost: 150, health: 10000,
        damage: 5000, range: 1, color: 'darkred', shootInterval: 120, type: 'explosive'
    }
};

// --- CẤU HÌNH ZOMBIE ---
export const ZOMBIE_TYPES = {
    normal: { id: 'normal', speed: 0.06, health: 100, damage: 0.5, color: 'red', reward: 10 },
    conehead: { id: 'conehead', speed: 0.04, health: 250, damage: 0.5, color: 'orange', reward: 20 },
    buckethead: { id: 'buckethead', speed: 0.02, health: 700, damage: 0.6, color: 'gray', reward: 50 }
};

export const PROJECTILE_STATS = { speed: 5, radius: 5, color: 'yellow' };

// --- CẤU HÌNH ĐỢT TẤN CÔNG (WAVE) ---
export const WAVE_CONFIG = [
    {
        id: 1,
        name: "ĐỢT 1: KHỞI ĐỘNG",
        minDuration: 40, maxDuration: 60, 
        startSpawnRate: 600, endSpawnRate: 300, 
        zombies: ['normal'] 
    },
    {
        id: 2,
        name: "ĐỢT 2: TẤN CÔNG MẠNH",
        minDuration: 60, maxDuration: 90,
        startSpawnRate: 300, endSpawnRate: 150,
        zombies: ['normal', 'conehead'] 
    },
    {
        id: 3,
        name: "ĐỢT 3: TỬ CHIẾN (FINAL WAVE)",
        minDuration: 90, maxDuration: 120,
        startSpawnRate: 150, endSpawnRate: 80, 
        zombies: ['normal', 'conehead', 'buckethead'] 
    }
];