import {
    type ItemStrategy,
    OnigiriStrategy,
    IceCreamStrategy,
    StarStrategy
} from './ItemStrategy';

export class ItemRegistry {
    private readonly strategies: Map<string, ItemStrategy> = new Map();

    constructor() {
        this.register(new OnigiriStrategy());
        this.register(new IceCreamStrategy());
        this.register(new StarStrategy());
    }

    public register(strategy: ItemStrategy): void {
        this.strategies.set(strategy.subtype, strategy);
    }

    public get(subtype: string): ItemStrategy | undefined {
        return this.strategies.get(subtype);
    }

    public has(subtype: string): boolean {
        return this.strategies.has(subtype);
    }
}
