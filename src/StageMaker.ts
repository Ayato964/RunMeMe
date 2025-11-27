import { API_BASE_URL, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './config';
import type { ChunkDef } from './types';

export class StageMaker {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // State
    private currentStage: ChunkDef = { id: '', width: 0, elements: [] };
    private selectedTool: { type: string, blockType?: string } | null = null;
    private clearedSpeeds: { [key: string]: boolean } = { '1.0': false, '2.0': false, '3.0': false };

    // Viewport
    private scale: number = 1;
    private offsetX: number = 0;
    private offsetY: number = 0;
    private cameraX: number = 0;

    // Constants
    private readonly BLOCK_SIZE = 100;

    // Images
    private plantImage: HTMLImageElement;
    private stoneImage: HTMLImageElement;
    private soilImage: HTMLImageElement;

    constructor() {
        this.canvas = document.getElementById('stagemaker-canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        this.plantImage = new Image(); this.plantImage.src = 'assets/plant.png';
        this.stoneImage = new Image(); this.stoneImage.src = 'assets/stone.png';
        this.soilImage = new Image(); this.soilImage.src = 'assets/soil.png';

        this.initUI();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Input handling
        this.canvas.addEventListener('mousedown', (e) => this.handleInput(e));
        this.canvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) { // Drag to paint/erase
                this.handleInput(e);
            }
        });

        // Wheel to pan
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraX += e.deltaY;
            // Limit camera to stage bounds
            const maxScroll = Math.max(0, this.currentStage.width - LOGICAL_WIDTH);
            this.cameraX = Math.max(0, Math.min(this.cameraX, maxScroll));
            this.draw();
        }, { passive: false });

        this.loop();
    }

    private initUI() {
        console.log("StageMaker: initUI called");

        // Direct Event Listeners

        // Back Button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/index.html';
            });
        } else {
            console.error("Back button not found");
        }

        // Reset Button
        const resetBtn = document.getElementById('reset-map-btn');
        const confirmModal = document.getElementById('confirm-modal');
        const confirmYesBtn = document.getElementById('confirm-yes-btn');
        const confirmNoBtn = document.getElementById('confirm-no-btn');

        if (resetBtn && confirmModal && confirmYesBtn && confirmNoBtn) {
            // Show Modal
            resetBtn.addEventListener('click', () => {
                confirmModal.classList.remove('hidden');
            });

            // Confirm Yes
            confirmYesBtn.addEventListener('click', () => {
                // Reset State
                this.currentStage = { id: '', width: 0, elements: [] };
                this.clearedSpeeds = { '1.0': false, '2.0': false, '3.0': false };

                // Clear LocalStorage
                localStorage.removeItem('stageMakerDraft');
                localStorage.removeItem('stageMakerDraftMeta');
                localStorage.removeItem('testCompleted');
                localStorage.removeItem('testStage');

                // Reset UI
                document.getElementById('setup-panel')?.classList.remove('hidden');
                document.getElementById('inventory-bar')?.classList.add('hidden');
                document.getElementById('inventory-bar')?.classList.remove('flex');
                document.getElementById('checklist-container')?.classList.add('hidden');
                document.getElementById('checklist-container')?.classList.remove('flex');

                this.updateChecklistUI();
                this.draw();

                confirmModal.classList.add('hidden');
                // alert("Map has been reset."); // Optional, maybe too noisy
            });

            // Confirm No
            confirmNoBtn.addEventListener('click', () => {
                confirmModal.classList.add('hidden');
            });
        } else {
            console.error("Reset Map button or modal elements not found");
        }

        // Test Play Button
        const testPlayBtn = document.getElementById('test-play-btn');
        if (testPlayBtn) {
            testPlayBtn.addEventListener('click', () => {
                console.log("Test Play button clicked");
                if (this.currentStage.elements.length === 0) {
                    alert("Please place some blocks first!");
                    return;
                }

                // Validate: At least one item spawn area
                const hasItemArea = this.currentStage.elements.some(el => el.type === 'item_area');
                if (!hasItemArea) {
                    alert("You must place at least one Item Spawn Area!");
                    return;
                }

                // Determine speed to test
                let speedToTest = '1.0';
                if (!this.clearedSpeeds['1.0']) speedToTest = '1.0';
                else if (!this.clearedSpeeds['2.0']) speedToTest = '2.0';
                else if (!this.clearedSpeeds['3.0']) speedToTest = '3.0';
                else speedToTest = '3.0'; // Default to max if all cleared

                localStorage.setItem('testStage', JSON.stringify(this.currentStage));
                localStorage.setItem('testSpeed', speedToTest);
                this.saveDraft(); // Ensure draft is saved
                window.location.href = '/index.html?mode=test';
            });
        } else {
            console.error("Test Play button not found");
        }

        // Publish Button
        const publishBtn = document.getElementById('publish-btn');
        if (publishBtn) {
            publishBtn.addEventListener('click', () => {
                // Requirement relaxed: Allow publishing immediately
                this.publishStage();
            });
        } else {
            console.error("Publish button not found");
        }

        // 1. Load Draft & Meta FIRST
        const draft = localStorage.getItem('stageMakerDraft');
        const draftMeta = localStorage.getItem('stageMakerDraftMeta');

        if (draft) {
            try {
                this.currentStage = JSON.parse(draft);
                if (draftMeta) {
                    this.clearedSpeeds = JSON.parse(draftMeta);
                }
            } catch (e) {
                console.error("Failed to load draft", e);
            }
        } else {
            // Fallback: If no draft but we have a testStage (rare case if local storage was cleared but not testStage?)
            const savedStage = localStorage.getItem('testStage');
            if (savedStage) {
                this.currentStage = JSON.parse(savedStage);
            }
        }

        // 2. Process Test Completion (Merge results)
        const lastTestSpeed = localStorage.getItem('testSpeed');
        const testCompleted = localStorage.getItem('testCompleted') === 'true';

        if (testCompleted && lastTestSpeed) {
            // Mark as cleared
            this.clearedSpeeds[lastTestSpeed] = true;
            localStorage.removeItem('testCompleted'); // Consume the flag

            // Save immediately so we don't lose it on refresh
            this.saveDraft();
        }

        // 3. Update UI based on state
        this.updateChecklistUI();

        if (this.currentStage.width > 0) {
            // We have an active stage
            document.getElementById('setup-panel')?.classList.add('hidden');
            document.getElementById('inventory-bar')?.classList.remove('hidden');
            document.getElementById('inventory-bar')?.classList.add('flex');
            document.getElementById('checklist-container')?.classList.remove('hidden');
            document.getElementById('checklist-container')?.classList.add('flex');
        } else {
            // No active stage, show setup
            document.getElementById('setup-panel')?.classList.remove('hidden');
            document.getElementById('inventory-bar')?.classList.add('hidden');
            document.getElementById('inventory-bar')?.classList.remove('flex');
            document.getElementById('checklist-container')?.classList.add('hidden');
            document.getElementById('checklist-container')?.classList.remove('flex');
        }

        // Width Selection
        const widthBtns = document.querySelectorAll('.width-select-btn');
        widthBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const widthBlocks = parseInt(target.dataset.width || '10');
                this.initStage(widthBlocks);
            });
        });

        // Custom Width
        const customWidthBtn = document.getElementById('custom-width-btn');
        const customWidthInput = document.getElementById('custom-width') as HTMLInputElement;

        if (customWidthBtn && customWidthInput) {
            customWidthBtn.addEventListener('click', () => {
                const val = parseInt(customWidthInput.value);
                if (isNaN(val) || val < 5 || val > 100) {
                    alert("Please enter a width between 5 and 100 blocks.");
                    return;
                }
                this.initStage(val);
            });
        } else {
            console.error("Custom width elements not found!", { btn: !!customWidthBtn, input: !!customWidthInput });
        }

        // Tool Selection
        document.querySelectorAll('.block-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = (e.currentTarget as HTMLElement);
                const type = target.dataset.type!;
                const block = target.dataset.block;

                this.selectedTool = { type, blockType: block };

                // Visual feedback
                document.querySelectorAll('.block-btn').forEach(b => {
                    b.classList.remove('border-blue-500', 'bg-blue-100');
                    b.classList.add('border-transparent');
                });
                target.classList.remove('border-transparent');
                target.classList.add('border-blue-500', 'bg-blue-100');
            });
        });
    }

    private async publishStage() {
        try {
            const response = await fetch(`${API_BASE_URL}/stage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify(this.currentStage)
            });

            if (response.ok) {
                alert("Stage Published Successfully!");
                localStorage.removeItem('testCompleted');
                localStorage.removeItem('testStage');
                localStorage.removeItem('stageMakerDraft'); // Clear draft
                localStorage.removeItem('stageMakerDraftMeta');
                window.location.href = '/index.html';
            } else {
                alert("Failed to publish stage.");
            }
        } catch (error) {
            console.error("Publish error:", error);
            alert("Error publishing stage.");
        }
    }

    private updateChecklistUI() {
        const speeds = ['1.0', '2.0', '3.0'];
        let allCleared = true;

        speeds.forEach(speed => {
            const el = document.getElementById(`check-${speed}`);
            if (el) {
                if (this.clearedSpeeds[speed]) {
                    el.innerText = '☑';
                    el.classList.remove('text-red-500');
                    el.classList.add('text-green-500');
                } else {
                    el.innerText = '☐';
                    el.classList.remove('text-green-500');
                    el.classList.add('text-red-500');
                    allCleared = false;
                }
            }
        });

        const publishBtn = document.getElementById('publish-btn') as HTMLButtonElement;
        if (publishBtn) {
            // Always enable publish button (relaxed requirement)
            publishBtn.disabled = false;
            publishBtn.classList.remove('bg-gray-400', 'text-gray-200', 'cursor-not-allowed');
            publishBtn.classList.add('bg-purple-500', 'hover:bg-purple-600', 'text-white');
        }
    }

    private initStage(widthBlocks: number) {
        this.currentStage = {
            id: `custom_${Date.now()}`,
            width: widthBlocks * this.BLOCK_SIZE, // Corrected: blocks * BLOCK_SIZE
            elements: []
        };

        // Reset cleared speeds on new stage
        this.clearedSpeeds = { '1.0': false, '2.0': false, '3.0': false };
        this.updateChecklistUI();

        // Hide setup, show inventory
        document.getElementById('setup-panel')?.classList.add('hidden');
        document.getElementById('inventory-bar')?.classList.remove('hidden');
        document.getElementById('inventory-bar')?.classList.add('flex');
        document.getElementById('checklist-container')?.classList.remove('hidden');
        document.getElementById('checklist-container')?.classList.add('flex');

        this.saveDraft();
        this.draw();
    }

    private resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        const scaleX = this.canvas.width / LOGICAL_WIDTH;
        const scaleY = this.canvas.height / LOGICAL_HEIGHT;
        this.scale = Math.min(scaleX, scaleY);

        this.offsetX = (this.canvas.width - LOGICAL_WIDTH * this.scale) / 2;
        this.offsetY = (this.canvas.height - LOGICAL_HEIGHT * this.scale) / 2;

        this.draw();
    }

    private handleInput(e: MouseEvent) {
        if (!this.selectedTool) return;

        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        // Convert to logical coordinates
        const logicalX = (clientX - this.offsetX) / this.scale + this.cameraX;
        const logicalY = (clientY - this.offsetY) / this.scale;

        // Snap to grid
        const gridX = Math.floor(logicalX / this.BLOCK_SIZE) * this.BLOCK_SIZE;
        const gridY = Math.floor(logicalY / this.BLOCK_SIZE) * this.BLOCK_SIZE;

        if (gridY < 0 || gridY >= LOGICAL_HEIGHT) return; // Out of bounds vertically
        if (gridX < 0 || gridX >= this.currentStage.width) return; // Out of bounds horizontally

        if (this.selectedTool.type === 'eraser') {
            // Remove elements at this position
            this.currentStage.elements = this.currentStage.elements.filter(el => {
                return !(el.x === gridX && el.y === gridY);
            });
        } else if (this.selectedTool.type === 'platform') {
            // Check if occupied
            const occupied = this.currentStage.elements.some(el => el.x === gridX && el.y === gridY);
            if (!occupied) {
                this.currentStage.elements.push({
                    type: 'platform',
                    blockType: this.selectedTool.blockType as any,
                    x: gridX,
                    y: gridY,
                    width: this.BLOCK_SIZE,
                    height: this.BLOCK_SIZE
                });
            }
        } else if (this.selectedTool.type === 'item_area') {
            // Check if occupied
            const occupied = this.currentStage.elements.some(el => el.x === gridX && el.y === gridY);
            if (!occupied) {
                this.currentStage.elements.push({
                    type: 'item_area',
                    x: gridX,
                    y: gridY,
                    width: this.BLOCK_SIZE,
                    height: this.BLOCK_SIZE
                });
            }
        }

        this.saveDraft();
        this.draw();
    }

    private saveDraft() {
        localStorage.setItem('stageMakerDraft', JSON.stringify(this.currentStage));
        localStorage.setItem('stageMakerDraftMeta', JSON.stringify(this.clearedSpeeds));
    }

    private loop() {
        requestAnimationFrame(() => this.loop());
        this.draw();
    }

    private draw() {
        // Clear
        this.ctx.fillStyle = '#87CEEB'; // Sky blue
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Clip
        this.ctx.beginPath();
        this.ctx.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        this.ctx.clip();

        // Translate for Camera
        this.ctx.translate(-this.cameraX, 0);

        // Draw Grid
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;

        // Vertical lines
        const startCol = Math.floor(this.cameraX / this.BLOCK_SIZE);
        const endCol = startCol + Math.ceil(LOGICAL_WIDTH / this.BLOCK_SIZE) + 1;

        // Limit to stage width
        const maxCol = this.currentStage.width / this.BLOCK_SIZE;

        for (let i = startCol; i <= endCol; i++) {
            if (i > maxCol) break;
            const x = i * this.BLOCK_SIZE;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, LOGICAL_HEIGHT);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let i = 0; i <= LOGICAL_HEIGHT / this.BLOCK_SIZE; i++) {
            const y = i * this.BLOCK_SIZE;
            this.ctx.beginPath();
            this.ctx.moveTo(this.cameraX, y);
            // Limit horizontal line length to stage width
            const lineEnd = Math.min(this.cameraX + LOGICAL_WIDTH, this.currentStage.width);
            if (lineEnd > this.cameraX) {
                this.ctx.lineTo(lineEnd, y);
                this.ctx.stroke();
            }
        }

        // Draw Elements
        this.currentStage.elements.forEach(el => {
            if (el.type === 'platform') {
                let img = this.soilImage;
                if (el.blockType === 'grass') img = this.plantImage;
                else if (el.blockType === 'stone') img = this.stoneImage;

                if (img.complete) {
                    this.ctx.drawImage(img, el.x, el.y, el.width, el.height);
                } else {
                    this.ctx.fillStyle = 'gray';
                    this.ctx.fillRect(el.x, el.y, el.width, el.height);
                }
            } else if (el.type === 'item_area') {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                this.ctx.fillRect(el.x, el.y, el.width, el.height);
                this.ctx.strokeStyle = 'red';
                this.ctx.strokeRect(el.x, el.y, el.width, el.height);
                this.ctx.fillStyle = 'red';
                this.ctx.font = '20px Arial';
                this.ctx.fillText('?', el.x + 35, el.y + 55);
            }
        });

        // Draw Start Line
        this.ctx.strokeStyle = 'green';
        this.ctx.lineWidth = 5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(0, LOGICAL_HEIGHT);
        this.ctx.stroke();

        // Draw End Line
        this.ctx.strokeStyle = 'red';
        this.ctx.lineWidth = 2; // Reduced from 5 to 2
        this.ctx.beginPath();
        this.ctx.moveTo(this.currentStage.width, 0);
        this.ctx.lineTo(this.currentStage.width, LOGICAL_HEIGHT);
        this.ctx.stroke();

        this.ctx.restore();
    }
}

// Global access for debugging
declare global {
    interface Window {
        stageMaker: StageMaker;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.stageMaker) {
            window.stageMaker = new StageMaker();
            console.log("StageMaker initialized via DOMContentLoaded");
        }
    });
} else {
    if (!window.stageMaker) {
        window.stageMaker = new StageMaker();
        console.log("StageMaker initialized immediately");
    }
}
