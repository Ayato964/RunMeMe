import type { GameConfig, Rect, Vector2 } from './types';

export class Player {
    public position: Vector2;
    public velocity: Vector2;
    public size: Rect;
    public isGrounded: boolean = false;

    private config: GameConfig;
    private images: { run1: HTMLImageElement, run2: HTMLImageElement, stop: HTMLImageElement };
    private currentFrame: number = 0;
    private frameTimer: number = 0;
    private animationSpeed: number = 0.1; // Switch every 100ms

    constructor(config: GameConfig, startX: number, startY: number) {
        this.config = config;
        this.position = { x: startX, y: startY };
        this.velocity = { x: 0, y: 0 };
        this.size = { x: 0, y: 0, width: 60, height: 80 }; // Adjusted size for sprites

        this.images = {
            run1: new Image(),
            run2: new Image(),
            stop: new Image()
        };
        this.images.run1.src = '/assets/chara_run_1.png';
        this.images.run2.src = '/assets/chara_run_2.png';
        this.images.stop.src = '/assets/chara_stop.png';
    }

    public update(dt: number, speedMultiplier: number) {
        // Apply gravity
        this.velocity.y += this.config.gravity * (dt / 16);

        // Apply velocity
        this.position.y += this.velocity.y * (dt / 16);

        // Ground collision is handled by Game class
        if (this.position.y > 2000) { // Safety net
            // Let it fall, Game over will trigger
        }

        // Update animation
        this.frameTimer += dt / 1000;
        if (this.frameTimer > this.animationSpeed / Math.max(1, speedMultiplier)) {
            this.frameTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % 2;
        }
    }

    public jump() {
        if (this.isGrounded) {
            this.velocity.y = this.config.jumpForce;
            this.isGrounded = false;
        }
    }

    public stopJump() {
        // If moving up, cut the jump short
        if (this.velocity.y < -5) {
            this.velocity.y = -5;
        }
    }

    public draw(ctx: CanvasRenderingContext2D) {
        let img = this.images.stop;

        if (!this.isGrounded) {
            // Jumping/Falling
            img = this.images.run2;
        } else {
            // Running
            img = this.currentFrame === 0 ? this.images.run1 : this.images.run2;
        }

        if (img.complete) {
            ctx.drawImage(img, this.position.x, this.position.y - this.size.height, this.size.width, this.size.height);
        } else {
            // Fallback
            ctx.fillStyle = '#ed64a6'; // Pink-500
            ctx.fillRect(this.position.x, this.position.y - this.size.height, this.size.width, this.size.height);
        }
    }
}
