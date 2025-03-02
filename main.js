import { ShaderProgram } from "./ShaderProgram.js";
import { SurfaceModel } from "./SurfaceModel.js";

let gl;
let surface;
let program;
let ball;
let videoTexture;
let webcamElement;
const renderingParams = {
	eyeSeparation: 0.5,
	fov: 45,
	nearClip: 0.1,
	convergence: 10.0,
};

function getUVSteps() {
	return {
		u: Number.parseInt(document.getElementById("u-stepper").value, 10),
		v: Number.parseInt(document.getElementById("v-stepper").value, 10),
	};
}

function initSurface() {
	const { u, v } = getUVSteps();
	surface = new SurfaceModel("Richmond's Minimal Surface", u, v);
	surface.createSurfaceData();
	surface.initBuffer(gl);
}

function initShaderProgram() {
	program = new ShaderProgram("Basic");
	program.init(gl, vertexShaderSource, fragmentShaderSource);
	program.use(gl);
}

async function initWebcam() {
	webcamElement = document.getElementById("webcam");
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ video: true });
		webcamElement.srcObject = stream;

		// Create and set up video texture
		videoTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, videoTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	} catch (error) {
		console.error("Error accessing webcam:", error);
	}
}

function initBackgroundShaders() {
	const backgroundVertexShader = `
        attribute vec2 position;
        attribute vec2 texCoord;
        varying vec2 vTexCoord;
        void main() {
            gl_Position = vec4(position, 0.0, 1.0);
            vTexCoord = texCoord;
        }
    `;

	const backgroundFragmentShader = `
        precision mediump float;
        uniform sampler2D uTexture;
        varying vec2 vTexCoord;
        void main() {
            gl_FragColor = texture2D(uTexture, vTexCoord);
        }
    `;

	program.backgroundProgram = new ShaderProgram("Background").init(
		gl,
		backgroundVertexShader,
		backgroundFragmentShader,
	);
}

function drawVideoBackground() {
	if (!program.backgroundProgram) {
		initBackgroundShaders();
	}

	gl.useProgram(program.backgroundProgram);

	// Set up a simple quad for the background
	const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

	const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

	// Create and bind buffers
	const vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

	const texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

	// Set up attributes
	const positionLoc = gl.getAttribLocation(
		program.backgroundProgram,
		"position",
	);
	const texCoordLoc = gl.getAttribLocation(
		program.backgroundProgram,
		"texCoord",
	);

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.enableVertexAttribArray(positionLoc);
	gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	gl.enableVertexAttribArray(texCoordLoc);
	gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

	// Update texture
	gl.bindTexture(gl.TEXTURE_2D, videoTexture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		webcamElement,
	);

	// Draw
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Switch back to main program
	gl.useProgram(program.prog);
}

function setupUIControls() {
	const stepperTypes = ["u", "v"];

	// biome-ignore lint/complexity/noForEach: <explanation>
	stepperTypes.forEach((type) => {
		const stepper = document.getElementById(`${type}-stepper`);
		const counter = document.getElementById(`${type}-counter`);

		if (!stepper) {
			console.error(`Stepper element with id '${type}-stepper' not found`);
			return;
		}

		stepper.addEventListener("input", (e) => {
			if (counter) {
				counter.textContent = e.target.value;
			} else {
				console.warn(`Counter element with id '${type}-counter' not found`);
			}
			initSurface();
			draw();
		});
	});
}

function setupStereoControls() {
	const controls = ["eye-separation", "fov", "near-clip", "convergence"];
	controls.forEach((control) => {
		const slider = document.getElementById(control);
		const value = document.getElementById(`${control}-value`);
		slider.addEventListener("input", (e) => {
			const val = Number.parseFloat(e.target.value);
			value.textContent = val;
			renderingParams[
				control
					.split("-")
					.map((word, index) =>
						index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
					)
					.join("")
			] = val;
			draw();
		});
	});
}

// function animateLight(time) {
// 	const radius = 10.0;
// 	const speed = 0.001;
// 	const x = radius * Math.cos(time * speed);
// 	const z = radius * Math.sin(time * speed);
// 	const y = 5.0;

// 	if (program) {
// 		gl.uniform3f(program.lightDirectionUni, x, y, z);
// 		draw();
// 	}
// 	requestAnimationFrame(animateLight);
// }

function drawEye(eyeOffset) {
	console.log("renderingParams", renderingParams);
	const projection = m4.perspective(
		(renderingParams.fov * Math.PI) / 180,
		1,
		renderingParams.nearClip,
		100,
	);

	const modelView = ball.getViewMatrix();

	// Apply eye offset
	const eyeMatrix = m4.translation(eyeOffset, 0, 0);
	const viewMatrix = m4.multiply(eyeMatrix, modelView);

	const rotateToPointZero = m4.axisRotation(
		[Math.SQRT1_2, Math.SQRT1_2, 0],
		0.7,
	);
	const translateToPointZero = m4.translation(
		0,
		0,
		-renderingParams.convergence,
	);

	const matAcc0 = m4.multiply(rotateToPointZero, viewMatrix);
	const matAcc1 = m4.multiply(translateToPointZero, matAcc0);

	const modelViewProjection = m4.multiply(projection, matAcc1);

	// Draw filled model
	gl.uniformMatrix4fv(program.matrixUni, false, modelViewProjection);
	const normalMatrix = m4.transpose(m4.inverse(matAcc1));
	gl.uniformMatrix4fv(program.normalMatrixUni, false, normalMatrix);

	// Draw filled surface
	gl.uniform1i(program.isWireframeUni, false);
	surface.draw(gl, program);

	// Draw wireframe
	gl.enable(gl.POLYGON_OFFSET_FILL);
	gl.polygonOffset(1, 1);
	gl.uniform1i(program.isWireframeUni, true);
	surface.drawWireframe(gl, program);
	gl.disable(gl.POLYGON_OFFSET_FILL);
}

function draw() {
	gl.clearColor(1, 1, 1, 1);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw background video if available
	if (webcamElement && webcamElement.videoWidth > 0) {
		drawVideoBackground();
	}

	// Draw for left eye (red)
	gl.colorMask(true, false, false, true);
	drawEye(-renderingParams.eyeSeparation / 2);

	// Draw for right eye (cyan)
	gl.clear(gl.DEPTH_BUFFER_BIT);
	gl.colorMask(false, true, true, true);
	drawEye(renderingParams.eyeSeparation / 2);

	gl.colorMask(true, true, true, true);
}

async function init() {
	try {
		const canvas = document.querySelector("canvas");
		gl = canvas.getContext("webgl");
		if (!gl) {
			throw "Browser does not support WebGL";
		}

		ball = new TrackballRotator(canvas, draw, 0);

		await initWebcam();
		initShaderProgram();
		initSurface();
		gl.enable(gl.DEPTH_TEST);

		setupUIControls();
		setupStereoControls();
		draw();
		// animateLight(0);
	} catch (e) {
		console.error(`Initialization error: ${e}`);
	}
}

document.addEventListener("DOMContentLoaded", init);
