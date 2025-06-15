import * as THREE from 'three';
import { Entity } from '../entity.js';
import { context } from '../init.js'; // For car, roadLoader, ui

export class Timer extends Entity {
    constructor(name) {
        super(name);
        this.roadLoader = null;
        this.car = null;

        this.startTime = 0;
        this.elapsedTime = 0;
        this.isRunning = false;

        this.startPoint = null;
        this.finishPoint = null;

        this.uiUpdateThrottle = 0;
        this.uiUpdateInterval = 1 / 30; // Update UI at most 30 FPS

        this.lapUIDisplayed = false; // To prevent spamming UI with final time
    }

    Init() {
        // Initialize UI display
        if (window.ui && window.ui.updateTimerDisplay) {
            window.ui.updateTimerDisplay(this.formatTime(0));
        } else {
            // This might be too early for window.ui to be fully set up.
            // We can also try to set initial text in Start() or first Update().
            console.warn("Timer.Init: ui.updateTimerDisplay not found yet.");
        }
    }

    Start() {
        // Resolve dependencies on other entities
        if (context.entityList) {
            this.car = context.entityList.find(e => e.name === 'Car' && e.object);
            this.roadLoader = context.entityList.find(e => e.name === 'Road');
        }

        if (!this.car) {
            console.error("Timer.Start: Car entity not found or not initialized.");
            // No car, no timer logic possible
        }
        if (!this.roadLoader) {
            console.error("Timer.Start: RoadLoader entity not found.");
            // No road, no start/finish points
        }

        // Attempt to set initial UI text if not done in Init
        if (window.ui && window.ui.updateTimerDisplay) {
             window.ui.updateTimerDisplay(this.formatTime(this.elapsedTime));
        }


        // Poll for roadLoader to be ready and fetch track points
        if (this.roadLoader) {
            const checkRoadLoaderInterval = setInterval(() => {
                if (this.roadLoader.isLoaded) {
                    this.fetchTrackPoints();
                    if (this.startPoint && this.finishPoint) {
                        clearInterval(checkRoadLoaderInterval);
                        console.log("Timer: Start and Finish points acquired.");
                    } else {
                        // Keep trying if points are not immediately available after road is loaded
                        console.warn("Timer: RoadLoader is loaded, but start/finish points are still null. Retrying fetch...");
                    }
                }
            }, 500); // Check every 500ms
        } else {
            console.error("Timer.Start: RoadLoader not available for polling.");
        }
    }

    fetchTrackPoints() {
        if (this.roadLoader && this.roadLoader.isLoaded) {
            this.startPoint = this.roadLoader.getStartPosition();
            this.finishPoint = this.roadLoader.getFinishPosition();

            if (!this.startPoint) {
                console.warn("Timer.fetchTrackPoints: Start point not available from RoadLoader.");
            }
            if (!this.finishPoint) {
                console.warn("Timer.fetchTrackPoints: Finish point not available from RoadLoader.");
            }
        }
    }

    Update(deltaTime) {
        if (!this.car || !this.car.modelLoaded || !this.roadLoader || !this.roadLoader.isLoaded) {
            return; // Essential dependencies not ready
        }

        if (!this.startPoint || !this.finishPoint) {
            this.fetchTrackPoints(); // Attempt to get points if missing
            if (!this.startPoint || !this.finishPoint) {
                return; // Still no points, wait for next update
            }
        }

        const carPosition = this.car.object.position;

        // Check for starting the timer
        const distanceToStart = carPosition.distanceTo(this.startPoint);
        if (distanceToStart < 2.0) { // World units
            // Start if not running, or reset if already running (e.g., passed start line again)
            if (!this.isRunning || (this.isRunning && this.elapsedTime > 0.1)) { // Add small threshold to prevent instant re-trigger
                this.startTime = performance.now();
                this.elapsedTime = 0;
                this.isRunning = true;
                this.lapUIDisplayed = false; // Reset UI display flag for new lap
                console.log("Timer started/reset!");
            }
        }

        if (this.isRunning) {
            this.elapsedTime = (performance.now() - this.startTime) / 1000; // in seconds

            // Check for stopping the timer
            const distanceToFinish = carPosition.distanceTo(this.finishPoint);
            if (distanceToFinish < 2.0) { // World units
                this.isRunning = false;
                // Final time is now in this.elapsedTime
                console.log(`Timer stopped! Final time: ${this.formatTime(this.elapsedTime)}`);
                // UI will show the final time due to the continuous update logic below
            }
        }

        // Throttle UI updates
        this.uiUpdateThrottle += deltaTime;
        if (this.uiUpdateThrottle >= this.uiUpdateInterval) {
            this.uiUpdateThrottle = 0;
            if (window.ui && window.ui.updateTimerDisplay) {
                // Display current time if running, or final time once if stopped
                if (this.isRunning || (this.elapsedTime > 0 && !this.lapUIDisplayed)) {
                    window.ui.updateTimerDisplay(this.formatTime(this.elapsedTime));
                    if (!this.isRunning && this.elapsedTime > 0) {
                        this.lapUIDisplayed = true; // Mark that final time for this lap has been displayed
                    }
                } else if (!this.isRunning && this.elapsedTime === 0 && !this.lapUIDisplayed) {
                    // Ensure initial "00:00.000" is shown if not running and not yet started
                    window.ui.updateTimerDisplay(this.formatTime(0));
                }
            }
        }
    }

    formatTime(seconds) {
        const totalMs = Math.floor(seconds * 1000);
        const ms = totalMs % 1000;
        const totalSec = Math.floor(totalMs / 1000);
        const sec = totalSec % 60;
        const min = Math.floor(totalSec / 60);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
}
