import type { GameConfig, Rect, Vector2 } from './types';

export class Player {
    public position: Vector2;
    public velocity: Vector2;
    public size: Rect;
    public isGrounded: boolean = false;

    private config: GameConfig;

    constructor(config: GameConfig, startX: number, startY: number) {
        this.config = config;
        this.position = { x: startX, y: startY };
        this.velocity = { x: 0, y: 0 };
        this.size = { x: 0, y: 0, width: 40, height: 60 }; // Standard size
    }

    public update(dt: number, _speedMultiplier: number) {
        // Apply gravity
        this.velocity.y += this.config.gravity * (dt / 16);

        // Apply velocity
        this.position.y += this.velocity.y * (dt / 16);

        // Ground collision is handled by Game class
        if (this.position.y > 2000) { // Safety net
            // Let it fall, Game over will trigger
        }
    }

    public jump() {
        if (this.isGrounded) {
            this.velocity.y = this.config.jumpForce;
            this.isGrounded = false;
        }
    }

    public draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#ed64a6'; // Pink-500
        ctx.fillRect(this.position.x, this.position.y - this.size.height, this.size.width, this.size.height);
    }
}
