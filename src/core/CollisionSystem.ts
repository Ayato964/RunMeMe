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
        const playerRect = player.getRect();
        let onGround = false;
        let isGameOver = false;

        // Optimization: Only check elements close to player in X-axis (O(K))
        const minX = playerRect.x - 250;
        const maxX = playerRect.x + playerRect.width + 250;

        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (el.x + el.width < minX || el.x > maxX) {
                continue;
            }

            if (el.type === 'platform') {
                if (this.intersects(playerRect, el)) {
                    // Landing on top of platform
                    const prevBottom = playerRect.y + playerRect.height - (player.velocity.y * (dt / 16));
                    if (player.velocity.y >= 0 && prevBottom <= el.y + 20) {
                        player.land(el.y);
                        onGround = true;
                    } else if (playerRect.x + playerRect.width > el.x + 10 && playerRect.y + playerRect.height > el.y + 22) {
                        // Check if it's an upward collision hitting underside of platform (bonk)
                        // If moving upward and player's top is penetrating below the platform
                        const isUnderPlatform = player.velocity.y < 0 && playerRect.y < el.y + el.height;
                        if (isUnderPlatform) {
                            player.velocity.y = 0;
                            player.position.y = el.y + el.height + player.size.height;
                        } else {
                            isGameOver = true;
                        }
                    }
                }
            } else if (el.type === 'item') {
                if (this.intersects(playerRect, el)) {
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

                if (this.intersects(playerRect, thornRect)) {
                    isGameOver = true;
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
