import { 
    CELL_WIDTH, CELL_HEIGHT, TOP_OFFSET, GAME_WIDTH, GAME_HEIGHT, 
    INITIAL_SUN, WAVE_CONFIG, 
    GRID_START_X, GRID_COLS, GRID_ROWS,
    SKY_SUN_MIN_SEC, SKY_SUN_MAX_SEC 
} from './constants.js';
import { collision } from './utils.js';
import { Cell } from './classes/Cell.js';
import { Plant } from './classes/Plant.js';
import { Zombie } from './classes/Zombie.js';
import { Projectile } from './classes/Projectile.js';
import { Sun } from './classes/Sun.js';
import { LawnMower } from './classes/LawnMower.js';
import { images } from './Resources.js';
import { callEndGameReward, saveLog, useGameItem } from '../firebase/auth.js';
import { auth } from '../firebase/config.js';
// Import dữ liệu cây động (Chứa cả Plant và Zombie từ Admin)
import { PLANT_DATA } from '../plantsData.js'; 

export default class GameCore {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.animationId = null;
        
        // Trạng thái game
        this.isPaused = false;
        this.gameOverState = false;
        this.victoryState = false;
        this.score = 0;
        this.sun = INITIAL_SUN;
        
        this.grid = [];
        this.plants = [];
        this.zombies = [];
        this.projectiles = [];
        this.suns = [];
        this.lawnMowers = [];
        
        this.mouse = { x: undefined, y: undefined, width: 0.1, height: 0.1 };
        
        this.selectedTool = 'plant';
        this.selectedPlantType = 'peashooter'; 

        this.currentWaveIndex = 0;
        this.waveTimer = 0;        
        this.waveDuration = 0;     
        this.isWaveCooldown = false; 
        this.cooldownTimer = 0;      
        this.spawnTimer = 0;        

        // Timer cho mặt trời rơi từ trên trời
        this.skySunTimer = 0;
        this.skySunInterval = this.getRandomSkySunTime();

        // Quản lý số lượng Plant Food
        this.plantFoodCount = 0;

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseClick = this.handleMouseClick.bind(this);
        
        this.initInput();
    }

    getRandomSkySunTime() {
        const min = SKY_SUN_MIN_SEC * 60;
        const max = SKY_SUN_MAX_SEC * 60;
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    updatePlantFoodUI() {
        const pfCountEl = document.getElementById('plant-food-count');
        if (pfCountEl) pfCountEl.innerText = this.plantFoodCount;
    }

    initInput() {
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('click', this.handleMouseClick);
        
        // Xử lý chọn cây (Dynamic)
        document.body.addEventListener('click', (e) => {
            const card = e.target.closest('.plant-card'); 
            if (card) {
                // Xóa selected cũ
                document.querySelectorAll('.plant-card').forEach(c => c.classList.remove('selected'));
                document.getElementById('shovel-tool').classList.remove('selected');
                document.getElementById('plant-food-tool').classList.remove('selected');
                
                // Active cái mới
                card.classList.add('selected');
                this.selectedTool = 'plant';
                
                // Lấy ID cây
                const type = card.getAttribute('data-type');
                if(type) this.selectedPlantType = type;
            }
        });

        const shovelBtn = document.getElementById('shovel-tool');
        if (shovelBtn) {
            shovelBtn.addEventListener('click', () => {
                this.selectedTool = 'shovel';
                shovelBtn.classList.add('selected');
                document.getElementById('plant-food-tool').classList.remove('selected');
                document.querySelector('.plant-card.selected')?.classList.remove('selected');
            });
        }

        const pfBtn = document.getElementById('plant-food-tool');
        if (pfBtn) {
            pfBtn.addEventListener('click', () => {
                this.plantFoodCount = parseInt(localStorage.getItem('item_plant_food_count') || 0);
                this.updatePlantFoodUI();

                if (this.plantFoodCount > 0) {
                    this.selectedTool = 'plant_food';
                    pfBtn.classList.add('selected');
                    document.getElementById('shovel-tool').classList.remove('selected');
                    document.querySelector('.plant-card.selected')?.classList.remove('selected');
                } else {
                    console.log("Hết thuốc rồi!");
                }
            });
        }
    }

    createGrid() {
        this.grid = [];
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const x = GRID_START_X + (col * CELL_WIDTH);
                const y = TOP_OFFSET + (row * CELL_HEIGHT);
                this.grid.push(new Cell(x, y));
            }
        }
    }

    createLawnMowers() {
        this.lawnMowers = [];
        for (let i = 0; i < GRID_ROWS; i++) {
            this.lawnMowers.push(new LawnMower(i));
        }
    }

    getRandomDuration(min, max) { return Math.floor(Math.random() * (max - min + 1) + min) * 60; }

    start() {
        if (this.animationId) cancelAnimationFrame(this.animationId);

        this.createGrid();
        this.createLawnMowers();
        
        this.gameOverState = false;
        this.victoryState = false;
        this.isPaused = false;
        this.score = 0;
        this.sun = INITIAL_SUN;

        // LOGIC KIỂM TRA GÓI MẶT TRỜI
        const inventory = JSON.parse(localStorage.getItem('user_inventory') || '[]');
        const tempItems = JSON.parse(localStorage.getItem('user_temp_items') || '{}');
        const settings = JSON.parse(localStorage.getItem('user_item_settings') || '{}');

        let hasSunPack = false;

        if (inventory.includes('sun_pack')) {
            hasSunPack = true;
        } else if (tempItems.sun_pack) {
            const now = Date.now();
            if (tempItems.sun_pack > now) {
                hasSunPack = true;
            }
        }

        const isEnabled = settings.sun_pack !== false; 

        if (hasSunPack && isEnabled) {
            this.sun += 100;
            console.log("🌞 Đã kích hoạt Gói Mặt Trời (+100 Sun)");
        }

        this.plantFoodCount = parseInt(localStorage.getItem('item_plant_food_count') || 0);
        this.updatePlantFoodUI();
        
        this.frame = 0;
        
        this.plants = [];
        this.zombies = [];
        this.projectiles = [];
        this.suns = [];
        
        this.skySunTimer = 0;
        this.skySunInterval = this.getRandomSkySunTime();

        this.currentWaveIndex = 0;
        this.isWaveCooldown = true; 
        this.cooldownTimer = 180;
        this.spawnTimer = 0;
        
        document.getElementById('overlay-screen').classList.add('hidden');
        document.getElementById('modal-pause-menu').classList.add('hidden');
        document.getElementById('bottom-toolbar').classList.remove('hidden');
        document.getElementById('btn-pause-game').classList.remove('hidden');
        
        // [QUAN TRỌNG] Render thanh chọn cây khi bắt đầu game
        this.renderPlantShopBar();

        this.animate();
    }

    // [FIX] Hàm vẽ thanh chọn cây: Lọc chỉ hiện 'plants' và sắp xếp
    renderPlantShopBar() {
        const container = document.getElementById('plant-shop-bar'); 
        if (!container) return;
        
        container.innerHTML = ''; 
        
        // 1. Chuyển đổi PLANT_DATA thành mảng để dễ xử lý
        // 2. Lọc: Chỉ lấy item có type là 'plants' (hoặc undefined nếu là dữ liệu cũ) và có giá tiền
        const plantsArray = Object.entries(PLANT_DATA).filter(([id, data]) => {
            return (data.type === 'plants' || !data.type) && data.cost !== undefined;
        });

        // 3. Sắp xếp: Cây rẻ lên trước, đắt ra sau
        plantsArray.sort((a, b) => a[1].cost - b[1].cost);

        // 4. Render
        plantsArray.forEach(([id, plant]) => {
            const card = document.createElement('div');
            card.className = 'plant-card';
            card.setAttribute('data-type', id);
            
            // Auto-select cây đầu tiên (thường là peashooter hoặc cây rẻ nhất)
            if(id === this.selectedPlantType || (!this.selectedPlantType && id === 'peashooter')) {
                card.classList.add('selected');
                this.selectedPlantType = id;
            }

            // Xử lý ảnh (Hỗ trợ cả link online và link local)
            let imgSrc = plant.assets.card;
            if(!imgSrc.startsWith('http') && !imgSrc.includes('assets/')) imgSrc = `/assets/card/${imgSrc}`;

            card.innerHTML = `
                <div class="card-cost">${plant.cost}</div>
                <img src="${imgSrc}" alt="${plant.name}" onerror="this.src='assets/card/Sunflower.png'">
            `;
            container.appendChild(card);
        });
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseMenu = document.getElementById('modal-pause-menu');
        if (this.isPaused) {
            pauseMenu.classList.remove('hidden');
            cancelAnimationFrame(this.animationId);
        } else {
            pauseMenu.classList.add('hidden');
            this.animate();
        }
    }

    animate() {
        if (this.isPaused) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (images.bg.complete) this.ctx.drawImage(images.bg, 0, 0, this.canvas.width, this.canvas.height);
        else { this.ctx.fillStyle = '#4caf50'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }

        this.handleGrid();
        this.handleLawnMowers();
        this.handleWaveLogic();
        this.handlePlants();
        this.handleZombies();   
        this.handleProjectiles();
        this.handleSuns();
        this.handleGameStatus();
        this.drawWaveNotification(); 

        this.frame++;
        
        if (!this.gameOverState && !this.victoryState) {
            this.animationId = requestAnimationFrame(() => this.animate());
        }
    }

    handleLawnMowers() {
        for (const mower of this.lawnMowers) {
            mower.update(this.zombies);
            mower.draw(this.ctx);
        }
    }

    handleWaveLogic() {
        if (this.isWaveCooldown) {
            this.cooldownTimer--;
            if (this.cooldownTimer <= 0) {
                this.isWaveCooldown = false;
                const config = WAVE_CONFIG[this.currentWaveIndex];
                if (config) {
                    this.waveDuration = this.getRandomDuration(config.minDuration, config.maxDuration);
                    this.waveTimer = 0;
                }
            }
            return;
        }

        const config = WAVE_CONFIG[this.currentWaveIndex];
        if (!config) return;

        this.waveTimer++;

        if (this.waveTimer < this.waveDuration) {
            this.spawnTimer++;
            const progress = this.waveTimer / this.waveDuration;
            const currentRate = config.startSpawnRate - (config.startSpawnRate - config.endSpawnRate) * progress;

            if (this.spawnTimer >= currentRate) {
                this.spawnTimer = 0;
                const typeIndex = Math.floor(Math.random() * config.zombies.length);
                const zombieType = config.zombies[typeIndex];
                
                const randomRow = Math.floor(Math.random() * GRID_ROWS);
                const verticalPosition = (randomRow * CELL_HEIGHT) + TOP_OFFSET;
                
                // Gọi Zombie mới (Zombie class đã được update để tự lấy stats từ PLANT_DATA)
                const newZombie = new Zombie(verticalPosition, zombieType);
                newZombie.x = GAME_WIDTH;
                this.zombies.push(newZombie);
            }
        } else {
            if (this.zombies.length === 0) {
                if (this.currentWaveIndex >= WAVE_CONFIG.length - 1) {
                    this.endGame(true);
                    this.victoryState = true;
                } else {
                    this.currentWaveIndex++;
                    this.isWaveCooldown = true;
                    this.cooldownTimer = 20 * 60;
                }
            }
        }
    }

    handleMouseClick() {
        // 1. Xử lý nhặt mặt trời
        let sunClicked = false;
        for (let i = 0; i < this.suns.length; i++) {
            if (collision(this.suns[i], {x: this.mouse.x, y: this.mouse.y, width: 0.1, height: 0.1})) {
                this.sun += this.suns[i].amount; 
                this.suns[i].collected = true; 
                this.suns.splice(i, 1); 
                i--; 
                sunClicked = true;
            }
        }
        if (sunClicked) return;

        // 2. Tính toán vị trí Grid
        const relativeX = this.mouse.x - GRID_START_X;
        const relativeY = this.mouse.y - TOP_OFFSET;

        if (relativeX < 0 || relativeY < 0) return;

        const col = Math.floor(relativeX / CELL_WIDTH);
        const row = Math.floor(relativeY / CELL_HEIGHT);

        if (col >= GRID_COLS || row >= GRID_ROWS) return;

        const gridPositionX = GRID_START_X + (col * CELL_WIDTH);
        const gridPositionY = TOP_OFFSET + (row * CELL_HEIGHT);

        // 3. Xử lý dùng Plant Food
        if (this.selectedTool === 'plant_food') {
            for (let i = 0; i < this.plants.length; i++) {
                if (this.plants[i].x === gridPositionX && this.plants[i].y === gridPositionY) {
                    this.plants[i].activatePower();
                    
                    this.plantFoodCount--; 
                    localStorage.setItem('item_plant_food_count', this.plantFoodCount); 
                    this.updatePlantFoodUI();
                    
                    if (auth.currentUser) {
                        useGameItem(auth.currentUser.uid, 'plant_food');
                    }
                    
                    this.selectedTool = 'plant';
                    document.getElementById('plant-food-tool').classList.remove('selected');
                    return;
                }
            }
            return;
        }

        // 4. Xử lý Xẻng
        if (this.selectedTool === 'shovel') {
            for (let i = 0; i < this.plants.length; i++) {
                if (this.plants[i].x === gridPositionX && this.plants[i].y === gridPositionY) {
                    this.plants.splice(i, 1);
                    return; 
                }
            }
            return;
        }

        // 5. Kiểm tra ô đã có cây chưa
        for (let i = 0; i < this.plants.length; i++) {
            if (this.plants[i].x === gridPositionX && this.plants[i].y === gridPositionY) return; 
        }

        // 6. TRỒNG CÂY
        const plantInfo = PLANT_DATA[this.selectedPlantType];
        
        // Kiểm tra kỹ: Phải có info và phải là loại 'plants' (tránh trồng nhầm zombie vào ô)
        if (plantInfo && (plantInfo.type === 'plants' || !plantInfo.type)) {
            if (this.sun >= plantInfo.cost) {
                this.plants.push(new Plant(gridPositionX, gridPositionY, this.selectedPlantType, plantInfo));
                this.sun -= plantInfo.cost;
            } else {
                // Có thể thêm hiệu ứng âm thanh fail tại đây
                console.log("Không đủ sun!"); 
            }
        }
    }

    handleZombies() {
        for (let i = 0; i < this.zombies.length; i++) {
            const z = this.zombies[i];
            z.update();
            z.draw(this.ctx);
            z.movement = z.speed; 
            
            for (let j = 0; j < this.plants.length; j++) {
                const p = this.plants[j];
                if (z.y === p.y && collision(z, p)) { 
                    z.movement = 0; 
                    p.health -= z.damage; 
                }
            }
            
            if (z.x < -50) this.endGame(false);
            
            if (z.health <= 0) { this.score += z.reward; this.zombies.splice(i, 1); i--; }
        }
    }

    handleProjectiles() {
        for (let i = 0; i < this.projectiles.length; i++) {
            const p = this.projectiles[i]; p.update(); p.draw(this.ctx);
            
            for (let j = 0; j < this.zombies.length; j++) {
                const z = this.zombies[j];
                const GRID_RIGHT_EDGE = GRID_START_X + (GRID_COLS * CELL_WIDTH);
                const isZombieInStreet = z.x > GRID_RIGHT_EDGE + 10; 

                // Kiểm tra va chạm (Thêm điều kiện zombie phải vào sân mới bắn trúng để công bằng)
                if (collision(p, z) && !isZombieInStreet) { 
                    // Zombie nhận damage
                    // Gọi hàm takeDamage của Zombie class để xử lý hiệu ứng (như băng)
                    if (z.takeDamage) {
                        // Xác định loại đạn để gây hiệu ứng
                        const effectType = (p.type && p.type.includes('snow')) ? 'ice' : 'normal';
                        z.takeDamage(p.power, effectType);
                    } else {
                        z.health -= p.power; 
                    }
                    
                    p.delete = true; 
                    break; 
                }
            }
            if (p && p.delete) { this.projectiles.splice(i, 1); i--; }
        }
    }

    handleGrid() { for (let i = 0; i < this.grid.length; i++) this.grid[i].draw(this.ctx, this.mouse); }
    
    handlePlants() {
        for (let i = 0; i < this.plants.length; i++) {
            const plant = this.plants[i];
            plant.draw(this.ctx); 
            plant.update();
            
            if (plant.health <= 0) { 
                this.plants.splice(i, 1); 
                i--; 
                continue; 
            }
            
            if (plant.isReadyToExplode) { 
                this.triggerExplosion(plant); 
                plant.health = 0; 
                continue; 
            }
            
            if (plant.isReadyToProduceSun) { 
                const newSun = new Sun(plant.x, plant.y + 10, plant.y + 10, false);
                this.suns.push(newSun);
                plant.trackSun(newSun);
                plant.isReadyToProduceSun = false; 
            }
            
            const GRID_RIGHT_EDGE = GRID_START_X + (GRID_COLS * CELL_WIDTH);
            const zombieInRowAndRange = this.zombies.some(z => 
                z.y === plant.y && 
                z.x < GRID_RIGHT_EDGE + 20 && 
                z.x > plant.x
            );

            if (plant.isReadyToShoot && zombieInRowAndRange) { 
                // Cây tự lấy damage từ thông số của nó
                this.projectiles.push(new Projectile(plant.x + 70, plant.y + 35, plant.type, plant.damage)); 
                plant.isReadyToShoot = false; 
            }
        }
    }
    
    handleSuns() {
        this.skySunTimer++;
        if (this.skySunTimer >= this.skySunInterval) {
            const randomX = Math.random() * (GAME_WIDTH - GRID_START_X) + GRID_START_X;
            const randomY = (Math.random() * (GAME_HEIGHT - TOP_OFFSET)) + TOP_OFFSET;
            this.suns.push(new Sun(randomX, -50, randomY, true));
            this.skySunTimer = 0;
            this.skySunInterval = this.getRandomSkySunTime();
        }

        for (let i = 0; i < this.suns.length; i++) {
            this.suns[i].update(); 
            this.suns[i].draw(this.ctx);
            if (this.suns[i].delete) { 
                this.suns.splice(i, 1); 
                i--; 
            }
        }
    }

    triggerExplosion(bombPlant) {
        const explosionRect = { x: bombPlant.x - CELL_WIDTH, y: bombPlant.y - CELL_HEIGHT, width: CELL_WIDTH * 3, height: CELL_HEIGHT * 3 };
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.fillRect(explosionRect.x, explosionRect.y, explosionRect.width, explosionRect.height);
        for (let i = 0; i < this.zombies.length; i++) {
            const z = this.zombies[i];
            if (collision(explosionRect, z)) { z.health -= bombPlant.damage; }
        }
    }

    handleGameStatus() {
        document.getElementById('sun-count').innerText = this.sun;
        document.getElementById('score-count').innerText = this.score;
    }
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
    }
    drawWaveNotification() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';

        if (this.isWaveCooldown) {
            if (this.currentWaveIndex < WAVE_CONFIG.length) {
                this.ctx.fillStyle = 'yellow';
                this.ctx.fillText(`${WAVE_CONFIG[this.currentWaveIndex].name}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10);
                this.ctx.font = '20px Arial';
                this.ctx.fillStyle = 'white';
                this.ctx.fillText(`${Math.ceil(this.cooldownTimer / 60)}s`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
            }
        } else {
            const config = WAVE_CONFIG[this.currentWaveIndex];
            if (config) {
                if (this.waveTimer >= this.waveDuration && this.zombies.length > 0) {
                    this.ctx.fillStyle = '#e74c3c';
                    this.ctx.font = '24px Arial';
                    this.ctx.fillText("DIỆT HẾT ZOMBIE!", GAME_WIDTH / 2, 80);
                }
                this.ctx.fillStyle = 'white';
                this.ctx.font = '20px Arial';
                this.ctx.fillText(config.name, GAME_WIDTH / 2, 30);
                
                const progress = Math.min(1, this.waveTimer / this.waveDuration);
                this.ctx.fillStyle = 'gray';
                this.ctx.fillRect(GAME_WIDTH / 2 - 100, 40, 200, 10);
                this.ctx.fillStyle = 'red';
                this.ctx.fillRect(GAME_WIDTH / 2 - 100, 40, 200 * progress, 10);
            }
        }
    }

    async endGame(isVictory) {
        this.gameOverState = true;
        cancelAnimationFrame(this.animationId);
        
        const overlay = document.getElementById('overlay-screen');
        overlay.classList.remove('hidden');
        
        const titleEl = document.getElementById('result-title');
        const scoreEl = document.getElementById('final-score');
        const rewardSection = document.getElementById('reward-section');
        const rewardCoinEl = document.getElementById('reward-coin');
        
        scoreEl.innerText = this.score;
        
        if (isVictory) {
            titleEl.innerText = "CHIẾN THẮNG!"; 
            titleEl.style.color = "#27ae60";
            rewardSection.classList.remove('hidden');
            
            const data = await callEndGameReward(true);
            
            if (data && data.success) {
                rewardCoinEl.innerText = data.reward; 
                console.log(data.message);

                if (auth.currentUser) {
                    saveLog(
                        auth.currentUser.uid,
                        "GAME_REWARD",
                        "Coin",
                        data.reward,
                        `Thắng trận - Wave ${this.currentWaveIndex + 1}`
                    );
                }
            } else {
                rewardCoinEl.innerText = "Lỗi kết nối!";
            }

        } else {
            titleEl.innerText = "GAME OVER!"; 
            titleEl.style.color = "#c0392b";
            rewardSection.classList.add('hidden');
        }
        
        document.getElementById('btn-restart').onclick = () => this.start();
        document.getElementById('btn-back-lobby').onclick = () => {
            overlay.classList.add('hidden');
            document.getElementById('bottom-toolbar').classList.add('hidden');
            document.getElementById('btn-pause-game').classList.add('hidden');
            document.getElementById('lobby-screen').classList.remove('hidden');
            setTimeout(() => window.location.reload(), 500);
        };
    }
}