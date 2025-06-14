import * as THREE from 'three';
import { Entity } from '../entity.js';
import { Plane } from './plane.js';

// Simple tile types
export const TileType = {
    ROAD: 'road',
    GRASS: 'grass',
    WATER: 'water',
    SAND: 'sand'
};

// TileMap class for creating a grid of tiles
export class TileMap extends Entity {
    constructor(name, gridSizeX = 10, gridSizeZ = 10, tileSize = 1) {
        super(name);
        this.gridSizeX = gridSizeX;
        this.gridSizeZ = gridSizeZ;
        this.tileSize = tileSize;
        
        // Create container for all tiles
        this.object = new THREE.Group();
        this.object.name = name;
        
        // 2D array to store tile references
        this.tiles = Array(gridSizeX).fill().map(() => Array(gridSizeZ).fill(null));
        
        // Define tile colors by type
        this.tileColors = {
            [TileType.ROAD]: 0x555555,   // Dark gray for roads
            [TileType.GRASS]: 0x77a674,  // Green for grass
            [TileType.WATER]: 0x4a95d4,  // Blue for water
            [TileType.SAND]: 0xe6d1a2    // Tan for sand
        };
    }
    
    // Add a tile at grid coordinates
    addTile(x, z, type = TileType.GRASS) {
        // Validate coordinates
        if (x < 0 || x >= this.gridSizeX || z < 0 || z >= this.gridSizeZ) {
            console.warn(`Tile position (${x}, ${z}) is out of bounds`);
            return null;
        }
        
        // Remove existing tile if any
        this.removeTile(x, z);
        
        // Create new tile
        const tileName = `Tile_${x}_${z}`;
        const tile = new Plane(tileName, this.tileSize, this.tileSize);
        tile.Init();
        
        // Set color based on type
        const color = this.tileColors[type] || 0xFFFFFF;
        tile.object.material.color.setHex(color);
        
        // Position in world space with a small Y offset to prevent z-fighting
        const worldX = (x - this.gridSizeX / 2 + 0.5) * this.tileSize;
        const worldZ = (z - this.gridSizeZ / 2 + 0.5) * this.tileSize;
        tile.position.set(worldX, 0.01, worldZ);  // Add 0.01 Y offset
        
        // Store reference and add to scene
        this.tiles[x][z] = { tile, type };
        this.object.add(tile.object);
        
        return tile;
    }
    
    // Remove a tile at grid coordinates
    removeTile(x, z) {
        if (x < 0 || x >= this.gridSizeX || z < 0 || z >= this.gridSizeZ) {
            return false;
        }
        
        const tileData = this.tiles[x][z];
        if (tileData && tileData.tile) {
            this.object.remove(tileData.tile.object);
            this.tiles[x][z] = null;
            return true;
        }
        
        return false;
    }
    
    // Fill an entire area with tiles of specified type
    fillArea(startX, startZ, endX, endZ, type = TileType.GRASS) {
        const minX = Math.max(0, Math.min(startX, endX));
        const maxX = Math.min(this.gridSizeX - 1, Math.max(startX, endX));
        const minZ = Math.max(0, Math.min(startZ, endZ));
        const maxZ = Math.min(this.gridSizeZ - 1, Math.max(startZ, endZ));
        
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                this.addTile(x, z, type);
            }
        }
    }
    
    // Create a path from one point to another
    createPath(startX, startZ, endX, endZ, type = TileType.ROAD) {
        // Only support straight horizontal or vertical paths
        if (startX !== endX && startZ !== endZ) {
            // Create an L-shaped path instead
            this.createPath(startX, startZ, endX, startZ, type); // Horizontal segment
            this.createPath(endX, startZ, endX, endZ, type);     // Vertical segment
            return;
        }
        
        // Create horizontal path
        if (startZ === endZ) {
            const minX = Math.max(0, Math.min(startX, endX));
            const maxX = Math.min(this.gridSizeX - 1, Math.max(startX, endX));
            
            for (let x = minX; x <= maxX; x++) {
                this.addTile(x, startZ, type);
            }
        } 
        // Create vertical path
        else if (startX === endX) {
            const minZ = Math.max(0, Math.min(startZ, endZ));
            const maxZ = Math.min(this.gridSizeZ - 1, Math.max(startZ, endZ));
            
            for (let z = minZ; z <= maxZ; z++) {
                this.addTile(startX, z, type);
            }
        }
    }
    
    // Fill the entire grid with a default tile type
    fillGrid(type = TileType.GRASS) {
        for (let x = 0; x < this.gridSizeX; x++) {
            for (let z = 0; z < this.gridSizeZ; z++) {
                this.addTile(x, z, type);
            }
        }
    }

    fillCheckerBoard(startX, startZ, endX, endZ, type1 = TileType.GRASS, type2 = TileType.SAND) {
        const minX = Math.max(0, Math.min(startX, endX));
        const maxX = Math.min(this.gridSizeX - 1, Math.max(startX, endX));
        const minZ = Math.max(0, Math.min(startZ, endZ));
        const maxZ = Math.min(this.gridSizeZ - 1, Math.max(startZ, endZ));
        
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const type = (x + z) % 2 === 0 ? type1 : type2;
                this.addTile(x, z, type);
            }
        }
    }
    
    // Get tile at position
    getTile(x, z) {
        if (x < 0 || x >= this.gridSizeX || z < 0 || z >= this.gridSizeZ) {
            return null;
        }
        return this.tiles[x][z];
    }
    
    // Clean up resources
    dispose() {
        for (let x = 0; x < this.gridSizeX; x++) {
            for (let z = 0; z < this.gridSizeZ; z++) {
                this.removeTile(x, z);
            }
        }
        
        this.tiles = Array(this.gridSizeX).fill().map(() => Array(this.gridSizeZ).fill(null));
    }
}