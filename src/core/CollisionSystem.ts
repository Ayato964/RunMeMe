import type { ChunkElement, Rect } from '../types';
import type { Player } from '../Player';
import type { GamePlayContext } from '../domain/items/ItemStrategy';
import type { ItemRegistry } from '../domain/items/ItemRegistry';
import type { IAssetManager } from './AssetManager';

export interface CollisionResult {
    isGameOver: boolean;
    onGround: boolean;
}

export class CollisionSystem {
    private itemRegistry: ItemRegistry;
    private assetManager: IAssetManager;

    constructor(itemRegistry: ItemRegistry, assetManager: IAssetManager) {
        this.itemRegistry = itemRegistry;
        this.assetManager = assetManager;
    }

    public checkAndResolve(
        player: Player,
        elements: ChunkElement[],
        dt: number,
        context: GamePlayContext
    ): CollisionResult {
        const dtRatio = dt / 16;
        const initialPlayerY = player.position.y;
        const initialVelocityY = player.velocity.y;
        const initialPlayerRect = player.getRect();
        let onGround = false;
        let isGameOver = false;

        // Optimization: Only check elements close to player in X-axis (O(K))
        const minX = initialPlayerRect.x - 250;
        const maxX = initialPlayerRect.x + initialPlayerRect.width + 250;

        // Separate platforms from items and thorns for clean multi-pass resolution
        const relevantPlatforms: ChunkElement[] = [];

        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (el.x + el.width < minX || el.x > maxX) {
                continue;
            }

            if (el.type === 'platform') {
                relevantPlatforms.push(el);
            } else if (el.type === 'item') {
                if (this.intersects(initialPlayerRect, el)) {
                    if (el.subtype) {
                        const strategy = this.itemRegistry.get(el.subtype);
                        if (strategy) {
                            strategy.apply(context);
                            this.assetManager.playSfx('assets/sound/item_get.wav');
                        }
                    }
                    elements.splice(i, 1);
                }
            } else if (el.type === 'thorn') {
                // Incorporate rotation into thorn collision box
                const rot = (el.rotation || 0) % 360;
                let hitX = el.x;
                let hitY = el.y;
                let hitWidth = el.width * 0.6;
                let hitHeight = el.height * 0.6;

                if (rot === 0) {
                    // Ground spike pointing up: base at bottom
                    hitX = el.x + (el.width - hitWidth) / 2;
                    hitY = el.y + (el.height - hitHeight);
                } else if (rot === 180) {
                    // Ceiling spike pointing down: base at top
                    hitX = el.x + (el.width - hitWidth) / 2;
                    hitY = el.y;
                } else if (rot === 90) {
                    // Spike pointing right: base at left
                    hitX = el.x;
                    hitY = el.y + (el.height - hitHeight) / 2;
                } else if (rot === 270) {
                    // Spike pointing left: base at right
                    hitX = el.x + (el.width - hitWidth);
                    hitY = el.y + (el.height - hitHeight) / 2;
                } else {
                    hitX = el.x + (el.width - hitWidth) / 2;
                    hitY = el.y + (el.height - hitHeight) / 2;
                }

                const thornRect: Rect = {
                    x: hitX,
                    y: hitY,
                    width: hitWidth,
                    height: hitHeight
                };

                if (this.intersects(initialPlayerRect, thornRect)) {
                    isGameOver = true;
                }
            }
        }

        // Pass 1: Holistic landing detection (Downward vertical movement)
        // Detects any platform floor under player's feet, across seams or high falls
        let bestLandingY: number | null = null;
        if (initialVelocityY >= 0) {
            const prevBottom = initialPlayerY - (initialVelocityY * dtRatio);
            const landingTolerance = Math.max(25, initialVelocityY * dtRatio + 10);

            for (const plat of relevantPlatforms) {
                // Must have horizontal overlap with the platform
                const hasXOverlap = (initialPlayerRect.x + initialPlayerRect.width > plat.x + 5) &&
                                    (initialPlayerRect.x < plat.x + plat.width - 5);
                if (!hasXOverlap) continue;

                // Did the player start above the platform top and reach or penetrate into it?
                if (prevBottom <= plat.y + landingTolerance && initialPlayerY >= plat.y - 10) {
                    if (initialPlayerY <= plat.y + plat.height) {
                        if (bestLandingY === null || plat.y < bestLandingY) {
                            bestLandingY = plat.y;
                        }
                    }
                }
            }
        }

        if (bestLandingY !== null) {
            player.land(bestLandingY);
            onGround = true;
        }

        // Pass 2: Upward collision (bonk) and horizontal wall crash detection
        const resolvedPlayerRect = player.getRect();
        for (const plat of relevantPlatforms) {
            if (!this.intersects(resolvedPlayerRect, plat)) continue;

            // Upward collision: hitting underside of platform (bonk)
            if (initialVelocityY < 0) {
                const prevTop = (initialPlayerY - player.size.height) - (initialVelocityY * dtRatio);
                if (prevTop >= plat.y + plat.height - 25) {
                    player.velocity.y = 0;
                    player.position.y = plat.y + plat.height + player.size.height;
                    continue;
                }
            }

            // Wall crash check:
            // If the player landed on this platform or another platform at the same/lower height,
            // this is a floor block, NOT a wall!
            const isFloorUnderPlayer = onGround && plat.y >= player.position.y - 20;
            if (!isFloorUnderPlayer) {
                // A true wall protrudes at least 22px above the player's feet
                const stepThreshold = 22;
                if (player.position.y > plat.y + stepThreshold) {
                    // Check if running horizontally into the front (left) face of the obstacle
                    const frontMargin = Math.max(35, 20 * dtRatio);
                    if (resolvedPlayerRect.x + resolvedPlayerRect.width > plat.x + 10 &&
                        resolvedPlayerRect.x < plat.x + frontMargin) {
                        isGameOver = true;
                    }
                }
            }
        }

        if (!onGround) {
            player.setGrounded(false);
        }

        return { isGameOver, onGround };
    }

    private intersects(r1: Rect, r2: Rect): boolean {
        return (
            r1.x < r2.x + r2.width &&
            r1.x + r1.width > r2.x &&
            r1.y + r1.height > r2.y &&
            r1.y < r2.y + r2.height
        );
    }
}
