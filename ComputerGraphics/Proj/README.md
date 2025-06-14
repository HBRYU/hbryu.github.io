# PseudoEngine

A basic Three.js project skeleton for prototyping 3D applications.

## Project Structure

- `main.html` - Entry point of the application
- `main.js` - Main script that handles animation and rendering
- `init.js` - Initialization script that sets up the scene, camera, and entities
- `entity.js` - Base class for all entities in the scene
- `postProcessing.js` - Post-processing effects for rendering

## Available Assets

### Basic Shapes
- `Assets/plane.js` - A simple plane mesh
- `Assets/pillar.js` - A cylinder mesh
- `Assets/controllableBox.js` - A box mesh that can be controlled with mouse clicks

### Environment
- `Assets/road.js` - A tilemap system for creating roads, grass, and water

### Camera
- `Assets/cameraControl.js` - A camera controller that follows a target entity

### 3D Models
The project also includes several 3D models in GLTF format that can be loaded using the GLTFModel class:

1. **Car Model**
   - Located in `Assets/models/car/`
   - Author: Renafox (https://sketchfab.com/kryik1023)
   - License: CC-BY-NC-4.0

2. **Road Model**
   - Located in `Assets/models/road/`
   - Author: jimbogies (https://sketchfab.com/jimbogies)
   - License: CC-BY-4.0

3. **Tree Model**
   - Located in `Assets/models/tree/`
   - Author: massive-graphisme (https://sketchfab.com/massive-graphisme)
   - License: CC-BY-4.0

## Using 3D Models

To use the 3D models in your project, you can utilize the GLTFModel class from `Assets/modelLoader.js`:

```javascript
// Import the model classes
import { CarModel, RoadModel, TreeModel } from './Assets/modelLoader.js';

// Create a car model
const carModel = new CarModel('MyCar', {
    position: new THREE.Vector3(0, 2, 0),
    scale: new THREE.Vector3(10, 10, 10)
});

// Initialize the model (starts loading)
carModel.Init();

// Add the model to your scene
// Note: The model may not be loaded immediately, so you should check isLoaded before adding
if (carModel.isLoaded && carModel.object) {
    scene.add(carModel.object);
}

// Or add it once it's loaded using the onLoad callback
carModel.options.onLoad = (model) => {
    scene.add(model.object);
};
```

## Running the Project

Open `main.html` in a web browser to run the project.

## Credits

This project uses Three.js and models from Sketchfab. Please see individual license files in the model folders for attribution requirements.
