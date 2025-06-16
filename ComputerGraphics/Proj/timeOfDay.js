import { Entity } from './entity.js';
import { context } from './init.js';

export class TimeOfDay extends Entity {
    constructor(name, initialTime = 7, cycleSpeed = 0.1) {
        super(name);
        this.currentTime = initialTime; // Current time in hours (0-23.99)
        this.cycleSpeed = cycleSpeed;   // How fast the time progresses (hours per real-time second)
        this.object = null; // No 3D object needed for this simple version
    }

    Init() {
        console.log(`Simple TimeOfDay initialized. Current time: ${this.currentTime.toFixed(2)}h. Cycle speed: ${this.cycleSpeed} hrs/sec.`);
    }

    Start() {
        // No scene interaction needed for this simple version in Start
        console.log('Simple TimeOfDay started.');
    }

    Update(deltaTime) {
        this.currentTime += this.cycleSpeed * deltaTime;
        this.currentTime %= 24; // Keep time within 0-24 hours

        // Update UI if available (optional, but good for debugging)
        if (context.ui && context.ui.updateTimeOfDay) { // Ensure context and ui.updateTimeOfDay exist
            const hours = Math.floor(this.currentTime);
            const minutes = Math.floor((this.currentTime - hours) * 60);
            context.ui.updateTimeOfDay(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        }
    }

    getCurrentHour() {
        return this.currentTime;
    }

    // Allow external setting of time, e.g., for debugging
    setTime(hour) {
        this.currentTime = Math.max(0, Math.min(23.99, hour));
        console.log(`Time manually set to: ${this.currentTime.toFixed(2)}h`);
        // Optionally update UI here too if needed immediately after setTime
        if (context.ui && context.ui.updateTimeOfDay) {
            const hours = Math.floor(this.currentTime);
            const minutes = Math.floor((this.currentTime - hours) * 60);
            context.ui.updateTimeOfDay(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        }
    }
}
