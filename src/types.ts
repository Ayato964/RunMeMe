export interface Vector2 {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ChunkElement {
    type: 'platform' | 'coin' | 'enemy' | 'decoration';
    subtype?: 'plant' | 'stone' | 'flower';
    blockType?: 'grass' | 'soil' | 'stone'; // For platforms
    x: number; // Relative to chunk start
    y: number;
    width: number;
    height: number;
    properties?: Record<string, any>;
}

export interface ChunkDef {
    id: string;
    width: number;
    elements: ChunkElement[];
}

export interface GameConfig {
    gravity: number;
    jumpForce: number;
    baseSpeed: number;
    speedIncreaseRate: number;
}
