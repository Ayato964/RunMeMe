export interface GamePlayContext {
    addScore(amount: number): void;
    modifySpeed(delta: number, minSpeed?: number): void;
    grantDoubleJump(): void;
    incrementCollectedItem(type: 'onigiri' | 'icecream' | 'star'): void;
}

export interface ItemStrategy {
    readonly subtype: 'onigiri' | 'icecream' | 'star';
    apply(context: GamePlayContext): void;
}

export class OnigiriStrategy implements ItemStrategy {
    readonly subtype = 'onigiri' as const;

    apply(context: GamePlayContext): void {
        context.incrementCollectedItem(this.subtype);
        context.modifySpeed(-0.5, 0.5);
    }
}

export class IceCreamStrategy implements ItemStrategy {
    readonly subtype = 'icecream' as const;

    apply(context: GamePlayContext): void {
        context.incrementCollectedItem(this.subtype);
        context.addScore(500);
    }
}

export class StarStrategy implements ItemStrategy {
    readonly subtype = 'star' as const;

    apply(context: GamePlayContext): void {
        context.incrementCollectedItem(this.subtype);
        context.grantDoubleJump();
    }
}
