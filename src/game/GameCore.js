import { 
    CELL_WIDTH, CELL_HEIGHT, TOP_OFFSET, GAME_WIDTH, GAME_HEIGHT, 
    INITIAL_SUN, PLANT_TYPES, SUN_SPAWN_RATE, WAVE_CONFIG, 
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
// [CẬP NHẬT] Thêm import useGameItem
import { callEndGameReward, getSystemConfig, saveLog, useGameItem } from '../firebase/auth.js';
import { auth } from '../firebase/config.js';

export class GameCore {
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
        this.selectedPlantType = 'sunflower'; 

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
        
        const plantCards = document.querySelectorAll('.plant-card');
        plantCards.forEach(card => {
            card.addEventListener('click', () => {
                this.selectedTool = 'plant';
                document.getElementById('shovel-tool').classList.remove('selected');
                document.getElementById('plant-food-tool').classList.remove('selected'); 
                document.querySelector('.plant-card.selected')?.classList.remove('selected');
                card.classList.add('selected');
                this.selectedPlantType = card.getAttribute('data-type');
            });
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
                // Cập nhật lại số lượng từ localStorage khi click (phòng trường hợp vừa mua xong)
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
        this.createGrid();
        this.createLawnMowers();
        
        this.gameOverState = false;
        this.victoryState = false;
        this.isPaused = false;
        this.score = 0;
        this.sun = INITIAL_SUN;

        // 1. Kiểm tra Gói Mặt Trời (Sun Pack) từ Inventory
        const rawInventory = localStorage.getItem('user_inventory'); 
        const inventory = rawInventory ? JSON.parse(rawInventory) : [];
        
        if (inventory.includes('sun_pack')) {
            this.sun += 100; // Cộng 100 sun
            console.log("🌞 Đã kích hoạt Gói Mặt Trời (+100 Sun)");
        }

        // 2. Cập nhật số lượng Plant Food mới nhất
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
        
        this.animate();
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

        const relativeX = this.mouse.x - GRID_START_X;
        const relativeY = this.mouse.y - TOP_OFFSET;

        if (relativeX < 0 || relativeY < 0) return;

        const col = Math.floor(relativeX / CELL_WIDTH);
        const row = Math.floor(relativeY / CELL_HEIGHT);

        if (col >= GRID_COLS || row >= GRID_ROWS) return;

        const gridPositionX = GRID_START_X + (col * CELL_WIDTH);
        const gridPositionY = TOP_OFFSET + (row * CELL_HEIGHT);

        if (this.selectedTool === 'plant_food') {
            for (let i = 0; i < this.plants.length; i++) {
                if (this.plants[i].x === gridPositionX && this.plants[i].y === gridPositionY) {
                    this.plants[i].activatePower();
                    
                    // --- [FIX] LOGIC TRỪ ITEM TRÊN SERVER ---
                    this.plantFoodCount--; // 1. Trừ hiển thị ngay trong game
                    localStorage.setItem('item_plant_food_count', this.plantFoodCount); // 2. Lưu local
                    this.updatePlantFoodUI();
                    
                    // 3. Gọi hàm cập nhật Firebase ngay lập tức
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

        if (this.selectedTool === 'shovel') {
            for (let i = 0; i < this.plants.length; i++) {
                if (this.plants[i].x === gridPositionX && this.plants[i].y === gridPositionY) {
                    this.plants.splice(i, 1);
                    return; 
                }
            }
            return;
        }

        for (let i = 0; i < this.plants.length; i++) {
            if (this.plants[i].x === gridPositionX && this.plants[i].y === gridPositionY) return; 
        }

        const plantCost = PLANT_TYPES[this.selectedPlantType].cost;
        if (this.sun >= plantCost) {
            this.plants.push(new Plant(gridPositionX, gridPositionY, this.selectedPlantType));
            this.sun -= plantCost;
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

                if (p.y === z.y + 35 && p && collision(p, z) && !isZombieInStreet) { 
                    if (collision(p, z)) {
                        z.health -= p.power; 
                        p.delete = true; 
                        break; 
                    }
                }
                if (collision(p, z) && !isZombieInStreet) { 
                      z.health -= p.power; 
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
                this.projectiles.push(new Projectile(plant.x + 70, plant.y + 35)); 
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

                // [MỚI] Ghi log lịch sử nhận thưởng vào hệ thống
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