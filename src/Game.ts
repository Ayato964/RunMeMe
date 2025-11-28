import { StageManager } from './StageManager';
import { Player } from './Player';
import { API_BASE_URL, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './config';
import type { GameConfig } from './types';

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private stageManager: StageManager;
    private player: Player;
    private lastTime: number = 0;
    private gameLoopId: number | null = null;
    private isGameOver: boolean = false;
    private score: number = 0;
    private scoreOffset: number = 0;
    private speedMultiplier: number = 1.0;
    private scrollSpeed: number = 6; // pixels per frame (approx 60fps)

    private backgroundImage: HTMLImageElement;
    private backgroundScoreImage: HTMLImageElement;

    private jumpSound: HTMLAudioElement;
    private itemGetSound: HTMLAudioElement;
    private gameOverSound: HTMLAudioElement;

    // Scaling properties
    private scale: number = 1;
    private offsetX: number = 0;
    private offsetY: number = 0;

    private readonly config: GameConfig = {
        gravity: 0.6, // Reasonable gravity
        jumpForce: -15, // Jump force
        baseSpeed: 6, // Base speed
        speedIncreaseRate: 0.1 // Slower speed increase
    };

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        this.backgroundImage = new Image();
        this.backgroundImage.src = 'assets/background.png';
        this.backgroundScoreImage = new Image();
        this.backgroundScoreImage.src = 'assets/background_score.png';

        this.jumpSound = new Audio('assets/sound/Jump.wav');
        this.itemGetSound = new Audio('assets/sound/item_get.wav');
        this.gameOverSound = new Audio('assets/sound/gameover.wav');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.stageManager = new StageManager(this.config);
        this.player = new Player(this.config, 100, LOGICAL_HEIGHT - 300); // Start position

        // Input handling
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (this.isGameOver) {
                    this.reset();
                } else {
                    if (this.player.jump()) {
                        this.jumpSound.currentTime = 0;
                        this.jumpSound.play().catch(() => { });
                    }
                }
            }
        });

        // Touch handling
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling
            if (this.isGameOver) {
                this.reset();
            } else {
                if (this.player.jump()) {
                    this.jumpSound.currentTime = 0;
                    this.jumpSound.play().catch(() => { });
                }
            }
        }, { passive: false });

        // UI Event Listeners
        const startBtn = document.getElementById('start-btn');
        const nameInput = document.getElementById('player-name-input') as HTMLInputElement;

        const startGame = () => {
            const name = nameInput?.value.trim().toUpperCase();
            console.log("Start Game triggered. Name:", name);
            if (name === '[STAGEMAKER]') {
                console.log("Redirecting to StageMaker...");
                window.location.href = '/stagemaker.html';
            } else {
                this.start();
            }
        };

        if (startBtn) {
            startBtn.addEventListener('click', startGame);
        }

        if (nameInput) {
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    startGame();
                }
            });
        }

        // Rankings Buttons
        const rankingsBtnStart = document.getElementById('rankings-btn-start');
        if (rankingsBtnStart) {
            rankingsBtnStart.addEventListener('click', () => this.showRankings());
        }
        const rankingsBtnGameOver = document.getElementById('rankings-btn-gameover');
        if (rankingsBtnGameOver) {
            rankingsBtnGameOver.addEventListener('click', () => this.showRankings());
        }

        const closeRankingsBtn = document.getElementById('close-rankings-btn');
        if (closeRankingsBtn) {
            closeRankingsBtn.addEventListener('click', () => {
                const rankingsScreen = document.getElementById('rankings-screen');
                if (rankingsScreen) rankingsScreen.classList.add('hidden');
            });
        }

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.reset());
        }

        // Mobile Jump Button
        const jumpBtn = document.getElementById('mobile-jump-btn');
        if (jumpBtn) {
            jumpBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.isGameOver) {
                    this.reset();
                } else {
                    if (this.player.jump()) {
                        this.jumpSound.currentTime = 0;
                        this.jumpSound.play().catch(() => { });
                    }
                }
            }, { passive: false });

            // Also handle click for testing on desktop
            jumpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.isGameOver) {
                    this.reset();
                } else {
                    if (this.player.jump()) {
                        this.jumpSound.currentTime = 0;
                        this.jumpSound.play().catch(() => { });
                    }
                }
            });
        }

        // Check for Test Mode at startup
        const urlParams = new URLSearchParams(window.location.search);
        console.log("Game Constructor: URL Params:", window.location.search);
        if (urlParams.get('mode') === 'test') {
            console.log("Game Constructor: Test Mode detected, starting...");
            this.start();
        }
    }

    private resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Calculate scale to fit 16:9 aspect ratio within the window
        const scaleX = this.canvas.width / LOGICAL_WIDTH;
        const scaleY = this.canvas.height / LOGICAL_HEIGHT;
        this.scale = Math.min(scaleX, scaleY);

        this.offsetX = (this.canvas.width - LOGICAL_WIDTH * this.scale) / 2;
        this.offsetY = (this.canvas.height - LOGICAL_HEIGHT * this.scale) / 2;
    }

    private currentBgm: HTMLAudioElement | null = null;

    public async start() {
        try {
            this.reset();
            this.playRandomBGM();
            if (!this.gameLoopId) {
                this.loop(performance.now());
            }
        } catch (error) {
            console.error("Game start error:", error);
            alert("Failed to start game. Please refresh.");
        }
    }

    private playRandomBGM() {
        if (this.currentBgm) {
            this.currentBgm.pause();
            this.currentBgm = null;
        }

        const tracks = ['assets/sound/stage1.mp3', 'assets/sound/stage2.mp3'];
        const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];

        this.currentBgm = new Audio(randomTrack);
        this.currentBgm.volume = 0.5; // Reasonable volume
        this.currentBgm.play().catch(e => console.error("BGM Play failed:", e));

        this.currentBgm.addEventListener('ended', () => {
            this.playRandomBGM(); // Play next random track
        });
    }

    private reset() {
        console.log("Game Reset called");

        // Stop BGM
        if (this.currentBgm) {
            this.currentBgm.pause();
            this.currentBgm = null;
        }

        this.isGameOver = false;
        this.score = 0;
        this.scoreOffset = 0;
        this.speedMultiplier = 1.0;
        this.timeSinceLastSpeedIncrease = 0;
        this.totalPlayTime = 0;
        this.stageManager.reset();
        this.player = new Player(this.config, 100, LOGICAL_HEIGHT - 300);

        // Hide rankings
        const rankingsEl = document.getElementById('rankings-screen');
        if (rankingsEl) rankingsEl.classList.add('hidden');

        // Hide start screen
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'none';

        // Hide Game Over screen
        const gameOverScreen = document.getElementById('game-over-screen');
        if (gameOverScreen) gameOverScreen.classList.add('hidden');

        // Show mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'flex';

        this.lastTime = performance.now();

        // Check for Test Mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'test') {
            console.log("Game Reset: Test Mode detected");
            const testStageStr = localStorage.getItem('testStage');
            const testSpeedStr = localStorage.getItem('testSpeed');
            console.log("Game Reset: testStage from LS:", testStageStr ? "Found" : "Null");

            if (testStageStr) {
                const testStage = JSON.parse(testStageStr);
                console.log("Game Reset: Setting test stage", testStage);
                this.stageManager.setTestStage(testStage);


                if (testSpeedStr) {
                    this.speedMultiplier = parseFloat(testSpeedStr);
                    this.config.speedIncreaseRate = 0;
                }

                // Show Test Mode UI
                const scoreEl = document.createElement('div');
                scoreEl.className = "absolute top-4 right-4 text-white font-bold text-2xl drop-shadow-md z-50";
                scoreEl.innerText = `TEST MODE - SPEED: ${this.speedMultiplier.toFixed(1)}`;
                document.body.appendChild(scoreEl);
            }
        }
    }

    private loop(timestamp: number) {
        if (this.isGameOver) return;

        let dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Cap dt to prevent huge jumps (e.g. tab switching)
        if (dt > 50) dt = 50;

        // Update
        this.update(dt);

        // Draw
        this.draw();

        this.gameLoopId = requestAnimationFrame((t) => this.loop(t));
    }

    private timeSinceLastSpeedIncrease: number = 0;
    private totalPlayTime: number = 0;

    private update(dt: number) {
        this.totalPlayTime += dt;

        // Calculate Level (1 to 8, increases every 50 seconds)
        const level = Math.min(8, Math.floor(this.totalPlayTime / 35000) + 1);

        // Calculate Interval (10s base, -1s per level)
        // Level 1: 10s, Level 2: 9s, ..., Level 5: 6s
        const speedIncreaseInterval = (10 - (level - 1)) * 1000;

        // Increase speed based on dynamic interval
        this.timeSinceLastSpeedIncrease += dt;
        if (this.timeSinceLastSpeedIncrease > speedIncreaseInterval) {
            this.speedMultiplier += this.config.speedIncreaseRate;
            this.timeSinceLastSpeedIncrease = 0;

            // Visual feedback for speed up could be added here
            const speedDisplay = document.getElementById('speed-display');
            if (speedDisplay) {
                speedDisplay.innerText = this.speedMultiplier.toFixed(3) + 'x (Lv.' + level + ')';
                speedDisplay.classList.add('text-yellow-400', 'scale-125');
                setTimeout(() => {
                    speedDisplay.classList.remove('text-yellow-400', 'scale-125');
                }, 500);
            }
        }

        this.stageManager.update(dt, this.speedMultiplier, this.scrollSpeed);
        this.player.update(dt, this.speedMultiplier);

        // Collision detection
        const elements = this.stageManager.getElements();
        const playerRect = this.player.getRect();

        // Check for ground collision
        let onGround = false;
        for (const el of elements) {
            if (el.type === 'platform') {
                if (
                    playerRect.x < el.x + el.width &&
                    playerRect.x + playerRect.width > el.x &&
                    playerRect.y + playerRect.height > el.y &&
                    playerRect.y < el.y + el.height
                ) {
                    // Collision
                    // Simple resolution: if falling and above, land
                    if (this.player.velocity.y >= 0 && playerRect.y + playerRect.height - (this.player.velocity.y * (dt / 16)) <= el.y + 10) {
                        this.player.land(el.y);
                        onGround = true;
                    }
                    // Side collision (death)
                    else if (playerRect.x + playerRect.width > el.x + 10) {
                        this.gameOver();
                    }
                }
            } else if (el.type === 'item') {
                // Check collision with item
                if (
                    playerRect.x < el.x + el.width &&
                    playerRect.x + playerRect.width > el.x &&
                    playerRect.y + playerRect.height > el.y &&
                    playerRect.y < el.y + el.height
                ) {
                    // Item collected
                    if (el.subtype === 'onigiri') {
                        this.speedMultiplier = Math.max(0.5, this.speedMultiplier - 0.5);
                    } else if (el.subtype === 'icecream') {
                        this.scoreOffset += 500;
                    } else if (el.subtype === 'star') {
                        this.player.addDoubleJump();
                    }

                    this.itemGetSound.currentTime = 0;
                    this.itemGetSound.play().catch(() => { });

                    // Remove item
                    const index = this.stageManager.getElements().indexOf(el);
                    if (index > -1) {
                        this.stageManager.getElements().splice(index, 1);
                    }
                }
            }
        }

        if (!onGround) {
            this.player.setGrounded(false);
        }

        // Score update (distance based)
        // 1 pixel = 1 point roughly, maybe scaled down
        // Score update (distance based + offset)
        // 1 pixel = 1 point roughly, maybe scaled down
        this.score = Math.floor(this.stageManager.getTotalDistance() / 10) + this.scoreOffset;

        // Check fall off
        if (this.player.position.y > LOGICAL_HEIGHT) {
            this.gameOver();
        }

        // Check Test Clear Condition
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'test' && !this.isGameOver) {
            // Check if player passed the stage
            const testStageStr = localStorage.getItem('testStage');
            if (testStageStr) {
                const testStage = JSON.parse(testStageStr);
                const finishDistance = 2400 + testStage.width;

                if (this.stageManager.getTotalDistance() > finishDistance) {
                    this.onTestClear();
                }
            }
        }
    }

    private onTestClear() {
        this.isGameOver = true;
        cancelAnimationFrame(this.gameLoopId!);

        // Stop BGM
        if (this.currentBgm) {
            this.currentBgm.pause();
            this.currentBgm = null;
        }

        const currentSpeed = parseFloat(localStorage.getItem('testSpeed') || '1.0');
        let nextSpeed = currentSpeed + 1.0;

        if (nextSpeed > 3.0) {
            // All cleared!
            alert("TEST CLEARED! You can now publish this stage.");
            localStorage.setItem('testCompleted', 'true');
            window.location.href = '/stagemaker.html';
        } else {
            alert(`SPEED ${currentSpeed.toFixed(1)} CLEARED! Next: ${nextSpeed.toFixed(1)}`);
            localStorage.setItem('testSpeed', nextSpeed.toFixed(1));
            window.location.reload();
        }
    }

    private draw() {
        // Clear screen with black (for letterboxing)
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();

        // Apply scaling and centering
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Clip to logical area to prevent drawing outside
        this.ctx.beginPath();
        this.ctx.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        this.ctx.clip();

        // Draw Background
        if (this.backgroundImage.complete) {
            // Draw background to cover the logical area
            this.ctx.drawImage(this.backgroundImage, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        } else {
            this.ctx.fillStyle = '#87CEEB'; // Sky blue fallback
            this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        }

        this.stageManager.draw(this.ctx);
        this.player.draw(this.ctx);

        // Draw Score
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 30px "Comic Sans MS", "Chalkboard SE", sans-serif';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText(`Score: ${Math.floor(this.score)}`, 20, 50);
        this.ctx.strokeText(`Score: ${Math.floor(this.score)}`, 20, 50);
        this.ctx.fillText(`Score: ${Math.floor(this.score)}`, 20, 50);

        // Draw Double Jump Count
        if (this.player.doubleJumpCount > 0) {
            this.ctx.fillStyle = '#f6e05e'; // Yellow-400
            this.ctx.font = 'bold 24px "Comic Sans MS", sans-serif';
            this.ctx.strokeText(`Double Jumps: ${this.player.doubleJumpCount}`, 20, 80);
            this.ctx.fillText(`Double Jumps: ${this.player.doubleJumpCount}`, 20, 80);
        }

        this.ctx.restore();
    }

    private gameOver() {
        this.isGameOver = true;
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
        }

        // Stop BGM
        if (this.currentBgm) {
            this.currentBgm.pause();
            this.currentBgm = null;
        }

        this.gameOverSound.currentTime = 0;
        this.gameOverSound.play().catch(() => { });

        // Check Test Mode Failure
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'test') {
            alert("TEST FAILED! Returning to editor...");
            window.location.href = '/stagemaker.html';
            return;
        }

        // Hide mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'none';

        // Get player name from input (entered at start)
        const nameInput = document.getElementById('player-name-input') as HTMLInputElement;
        const playerName = nameInput?.value || "Player";

        // Submit score automatically
        fetch(`${API_BASE_URL}/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ score: Math.floor(this.score), name: playerName })
        }).then(() => {
            // Show Rankings immediately
            this.showRankings(true); // true = isGameOver

            // Auto-return to title after 3 seconds
            setTimeout(() => {
                // Ensure we are still in game over state (user didn't click restart manually)
                if (this.isGameOver) {
                    this.returnToTitle();
                }
            }, 3000);

        }).catch(err => {
            console.error("Failed to submit score:", err);
            this.showRankings(true);
            setTimeout(() => {
                if (this.isGameOver) {
                    this.returnToTitle();
                }
            }, 3000);
        });
    }

    private returnToTitle() {
        this.isGameOver = false; // Reset flag but don't start loop
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }

        // Hide rankings
        const rankingsEl = document.getElementById('rankings-screen');
        if (rankingsEl) rankingsEl.classList.add('hidden');

        // Hide Game Over screen
        const gameOverScreen = document.getElementById('game-over-screen');
        if (gameOverScreen) gameOverScreen.classList.add('hidden');

        // Show start screen
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'flex'; // Restore flex display

        // Hide mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'none';
    }

    public async showRankings(isGameOver: boolean = false) {
        const rankingsEl = document.getElementById('rankings-screen');
        const rankingsList = document.getElementById('rankings-list');

        if (rankingsEl && rankingsList) {
            rankingsList.innerHTML = '<div class="text-4xl font-black text-white animate-pulse">LOADING...</div>';
            rankingsEl.classList.remove('hidden');

            // Add Game Over title if applicable
            if (isGameOver) {
                const title = document.createElement('h2');
                title.className = "text-6xl font-black text-red-500 mb-4 drop-shadow-[4px_4px_0_#000] transform -rotate-3";
                title.innerText = "GAME OVER";
                rankingsList.innerHTML = '';
                rankingsList.appendChild(title);

                const scoreDisplay = document.createElement('div');
                scoreDisplay.className = "text-4xl font-bold text-white mb-8 drop-shadow-[2px_2px_0_#000]";
                scoreDisplay.innerText = `SCORE: ${Math.floor(this.score)}`;
                rankingsList.appendChild(scoreDisplay);
            } else {
                rankingsList.innerHTML = '<h2 class="text-6xl font-black text-yellow-400 mb-8 drop-shadow-[4px_4px_0_#000] transform -rotate-3">RANKING</h2>';
            }

            try {
                const res = await fetch(`${API_BASE_URL}/scores`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                const scores = await res.json();

                const listContainer = document.createElement('div');
                listContainer.className = "w-full max-w-2xl bg-white/90 border-4 border-black rounded-xl p-6 shadow-[8px_8px_0_#000] transform rotate-1";

                listContainer.innerHTML = scores.map((s: any, i: number) => `
                    <div class="flex justify-between items-center mb-4 border-b-2 border-dashed border-gray-400 pb-2 last:border-0">
                        <div class="flex items-center gap-4">
                            <span class="text-3xl font-black ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-orange-600' : 'text-black'} drop-shadow-sm">#${i + 1}</span> 
                            <span class="text-2xl font-bold text-gray-800 truncate max-w-[200px]">${s.name}</span>
                        </div>
                        <span class="text-3xl font-black text-pink-500 drop-shadow-sm">${s.score}</span>
                    </div>
                `).join('');

                rankingsList.appendChild(listContainer);

            } catch (err) {
                rankingsList.innerHTML += '<div class="text-2xl text-red-500 font-bold mt-4">Failed to load rankings.</div>';
            }
        }
    }

    // Helper to restore rankings view if closed
    public displayRankings() {
        this.showRankings();
    }
}
