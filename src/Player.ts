import type { GameConfig, Rect, Vector2 } from './types';
import type { IAssetManager } from './core/AssetManager';

export class Player {
    public position: Vector2;
    public velocity: Vector2;
    public size: Rect;
    public isGrounded: boolean = false;
    public doubleJumpCount: number = 0;

    private config: GameConfig;
    private assetManager: IAssetManager;
    private currentFrame: number = 0;
    private frameTimer: number = 0;
    private readonly animationSpeed: number = 0.1; // 100ms per frame

    constructor(config: GameConfig, assetManager: IAssetManager, startX: number, startY: number) {
        this.config = config;
        this.assetManager = assetManager;
        this.position = { x: startX, y: startY };
        this.velocity = { x: 0, y: 0 };
        this.size = { x: 0, y: 0, width: 60, height: 80 };
    }

    public update(dt: number, speedMultiplier: number): void {
        // Apply gravity
        this.velocity.y += this.config.gravity * (dt / 16);

        // Apply velocity
        this.position.y += this.velocity.y * (dt / 16);

        // Animation update
        this.frameTimer += dt / 1000;
        if (this.frameTimer > this.animationSpeed / Math.max(1, speedMultiplier)) {
            this.frameTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % 2;
        }
    }

    public jump(): boolean {
        if (this.isGrounded) {
            this.velocity.y = this.config.jumpForce;
            this.isGrounded = false;
            return true;
        } else if (this.doubleJumpCount > 0) {
            this.velocity.y = this.config.jumpForce;
            this.doubleJumpCount--;
            return true;
        }
        return false;
    }

    public addDoubleJump(): void {
        this.doubleJumpCount++;
    }

    public stopJump(): void {
        if (this.velocity.y < -5) {
            this.velocity.y = -5;
        }
    }

    public getRect(): Rect {
        return {
            x: this.position.x,
            y: this.position.y - this.size.height,
            width: this.size.width,
            height: this.size.height
        };
    }

    public land(y: number): void {
        this.position.y = y;
        this.velocity.y = 0;
        this.isGrounded = true;
    }

    public setGrounded(grounded: boolean): void {
        this.isGrounded = grounded;
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        let imgPath = 'assets/chara_stop.png';

        if (!this.isGrounded) {
            imgPath = 'assets/chara_run_2.png';
        } else {
            imgPath = this.currentFrame === 0 ? 'assets/chara_run_1.png' : 'assets/chara_run_2.png';
        }

        const img = this.assetManager.getImage(imgPath);
        if (img.complete) {
            ctx.drawImage(img, this.position.x, this.position.y - this.size.height, this.size.width, this.size.height);
        } else {
            ctx.fillStyle = '#ed64a6';
            ctx.fillRect(this.position.x, this.position.y - this.size.height, this.size.width, this.size.height);
        }
    }
}
