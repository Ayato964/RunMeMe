import type { GameConfig } from './types';
import { Player } from './Player';
import { StageManager } from './StageManager';

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private lastTime: number = 0;
    private isPlaying: boolean = false;
    private speedMultiplier: number = 1.0;
    private score: number = 0;

    private player: Player;
    private stageManager: StageManager;

    private config: GameConfig = {
        gravity: 0.5,
        jumpForce: -12,
        baseSpeed: 5,
        speedIncreaseRate: 0.0001
    };

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.player = new Player(this.config, 100, 300);
        this.stageManager = new StageManager(this.config);

        this.setupInputs();
    }

    private resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    private setupInputs() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (!this.isPlaying) {
                    // this.start(); // Optional: Start on space
                } else {
                    this.player.jump();
                }
            }
        });

        const startBtn = document.getElementById('start-btn');
        startBtn?.addEventListener('click', () => this.start());

        const restartBtn = document.getElementById('restart-btn');
        restartBtn?.addEventListener('click', () => this.reset());
    }

    public start() {
        this.isPlaying = true;
        this.score = 0;
        this.speedMultiplier = 1.0;
        this.lastTime = performance.now();

        this.player = new Player(this.config, 100, 300);
        this.stageManager.reset();

        document.getElementById('start-screen')?.classList.add('hidden');
        document.getElementById('game-over-screen')?.classList.add('hidden');

        requestAnimationFrame((t) => this.loop(t));
    }

    public reset() {
        this.start();
    }

    private loop(timestamp: number) {
        if (!this.isPlaying) return;

        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    private update(dt: number) {
        // Increase speed
        this.speedMultiplier += this.config.speedIncreaseRate * dt;

        // Update score
        this.score += (this.config.baseSpeed * this.speedMultiplier) * (dt / 16);

        // Update entities
        this.stageManager.update(dt, this.speedMultiplier, this.config.baseSpeed);
        this.player.update(dt, this.speedMultiplier);

        // Collision Detection
        this.checkCollisions();

        // Check Game Over
        if (this.player.position.y > this.canvas.height) {
            this.gameOver();
        }

        // Update UI
        this.updateUI();
    }

    private checkCollisions() {
        const playerRect = {
            x: this.player.position.x,
            y: this.player.position.y - this.player.size.height,
            width: this.player.size.width,
            height: this.player.size.height
        };

        const elements = this.stageManager.getElements();
        let onGround = false;

        for (const el of elements) {
            if (el.type === 'platform') {
                // Simple AABB collision
                if (
                    playerRect.x < el.x + el.width &&
                    playerRect.x + playerRect.width > el.x &&
                    playerRect.y < el.y + el.height &&
                    playerRect.y + playerRect.height > el.y
                ) {
                    // Collision detected
                    // Determine side
                    const overlapX = Math.min(playerRect.x + playerRect.width - el.x, el.x + el.width - playerRect.x);
                    const overlapY = Math.min(playerRect.y + playerRect.height - el.y, el.y + el.height - playerRect.y);

                    // Check if landing on top
                    // We are on top if our previous bottom was above the platform's top (with tolerance)
                    // AND we are falling or stationary
                    const wasAbove = playerRect.y + playerRect.height - this.player.velocity.y <= el.y + 20;

                    if (wasAbove && this.player.velocity.y >= 0) {
                        // Landing on top
                        this.player.position.y = el.y;
                        this.player.velocity.y = 0;
                        this.player.isGrounded = true;
                        onGround = true;
                    } else {
                        // Not landing on top
                        if (overlapY < overlapX) {
                            // Vertical collision (hitting head)
                            if (this.player.velocity.y < 0) {
                                this.player.position.y = el.y + el.height + this.player.size.height;
                                this.player.velocity.y = 0;
                            }
                        } else {
                            // Horizontal collision (Game Over)
                            this.gameOver();
                        }
                    }
                }
            }
        }

        if (!onGround) {
            this.player.isGrounded = false;
        }
    }

    private gameOver() {
        this.isPlaying = false;
        document.getElementById('game-over-screen')?.classList.remove('hidden');
        const finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) finalScoreEl.textContent = Math.floor(this.score).toString();
    }

    private draw() {
        // Clear screen
        this.ctx.fillStyle = '#1a202c'; // Gray-900
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw entities
        this.stageManager.draw(this.ctx);
        this.player.draw(this.ctx);
    }

    private updateUI() {
        const scoreEl = document.getElementById('score-display');
        if (scoreEl) scoreEl.textContent = Math.floor(this.score).toString().padStart(6, '0');

        const speedEl = document.getElementById('speed-display');
        if (speedEl) speedEl.textContent = this.speedMultiplier.toFixed(1) + 'x';
    }
}
