# Anaglyphic 3D Surface Viewer

This project implements an interactive 3D viewer that renders a mathematical surface (Sievert's Surface) in anaglyphic 3D (red-cyan) with webcam integration. The application allows users to manipulate various rendering parameters and includes both solid and wireframe visualization.

## Features

- Anaglyphic (red-cyan) stereo rendering
- Interactive 3D model rotation using mouse/touch
- Webcam feed integration in zero parallax plane
- Adjustable parameters:
  - Eye separation
  - Field of View angle
  - Near clipping distance
  - Convergence distance
- Surface resolution control (U and V polylines)
- Combined wireframe and solid surface visualization

## Prerequisites

- Node.js (v14.0.0 or higher)
- A modern web browser with WebGL support
- A webcam
- Red-cyan 3D glasses

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd [repository-name]
```

2. Install dependencies:
```bash
npm install express
```

## Running the Application

1. Start the server:
```bash
node server.js
```

2. Open your web browser and navigate to:
```
http://localhost:3000
```

## Usage

1. Wear red-cyan 3D glasses
2. Allow webcam access when prompted
3. Use mouse/touch to rotate the model:
   - Click and drag to rotate
   - Use scroll wheel to zoom

4. Adjust rendering parameters using the control panel:
   - Eye Separation: Controls the stereo effect intensity
   - Field of View: Adjusts the perspective projection
   - Near Clipping: Sets the near clipping plane distance
   - Convergence: Controls the stereo convergence point
   - U/V Steps: Adjusts the surface resolution

## Technical Details

- Built with WebGL for 3D rendering
- Uses Express.js for serving the application
- Implements real-time shader-based rendering
- Features custom trackball rotation controls

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
