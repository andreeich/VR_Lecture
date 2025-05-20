import { ShaderProgram } from "./ShaderProgram.js";
import { SurfaceModel } from "./SurfaceModel.js";
import { Audio } from "./audio.js"; // New import

let gl;
let surface;
let soundSphere; // New: sphere for sound source
let program;
let videoTexture;
let webcamElement;
let sensorSocket;
let orientationMatrix = m4.identity();
let audio; // New: audio instance
const renderingParams = {
	eyeSeparation: 0.5,
	fov: 45,
	nearClip: 0.1,
	convergence: 10.0,
};
const lightPosition = {
	x: 5,
	y: 10,
	z: 5,
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

	// Create a proper shader program instance
	const backgroundProgram = new ShaderProgram("Background");
	backgroundProgram.init(gl, backgroundVertexShader, backgroundFragmentShader);

	// Store the program object, not just the ID
	program.backgroundProgram = backgroundProgram;

	// Initialize background shader attributes and uniforms
	program.backgroundProgram.positionLoc = gl.getAttribLocation(
		program.backgroundProgram.prog,
		"position",
	);
	program.backgroundProgram.texCoordLoc = gl.getAttribLocation(
		program.backgroundProgram.prog,
		"texCoord",
	);
	program.backgroundProgram.textureLoc = gl.getUniformLocation(
		program.backgroundProgram.prog,
		"uTexture",
	);
}

function initSoundSphere() {
	soundSphere = new SurfaceModel("Sound Source Sphere", 20, 20);
	soundSphere.createSphereData(0.2);
	soundSphere.initBuffer(gl);
}

function drawVideoBackground() {
	if (!program.backgroundProgram) {
		initBackgroundShaders();
	}

	gl.useProgram(program.backgroundProgram.prog);

	// Set up a simple quad for the background
	const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

	// Flip the texture coordinates both horizontally and vertically
	// Original: [0, 0, 1, 0, 0, 1, 1, 1]
	// Horizontal flip: [1, 0, 0, 0, 1, 1, 0, 1]
	// Vertical flip: [1, 1, 0, 1, 1, 0, 0, 0]
	const texCoords = new Float32Array([1, 1, 0, 1, 1, 0, 0, 0]);

	// Create and bind buffers
	const vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

	const texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

	// Set up attributes
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.enableVertexAttribArray(program.backgroundProgram.positionLoc);
	gl.vertexAttribPointer(
		program.backgroundProgram.positionLoc,
		2,
		gl.FLOAT,
		false,
		0,
		0,
	);

	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	gl.enableVertexAttribArray(program.backgroundProgram.texCoordLoc);
	gl.vertexAttribPointer(
		program.backgroundProgram.texCoordLoc,
		2,
		gl.FLOAT,
		false,
		0,
		0,
	);

	// Set the texture unit
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, videoTexture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		webcamElement,
	);
	gl.uniform1i(program.backgroundProgram.textureLoc, 0);

	// Draw
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Clean up
	gl.deleteBuffer(vertexBuffer);
	gl.deleteBuffer(texCoordBuffer);

	gl.useProgram(program.prog);
}

function setupUIControls() {
	const stepperTypes = ["u", "v"];
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
			}
			initSurface();
			draw();
		});
	});

	// Audio filter controls
	const soundFilterCheckbox = document.getElementById("soundFilter");
	const filterFrequencySlider = document.getElementById("filterFrequency");
	const filterFrequencyCounter = document.getElementById(
		"filterFrequency-value",
	);
	const filterQSlider = document.getElementById("filterQ");
	const filterQCounter = document.getElementById("filterQ-value");
	const filterGainSlider = document.getElementById("filterGain");
	const filterGainCounter = document.getElementById("filterGain-value");
	const startAudioButton = document.getElementById("startAudio");

	// Disable filter controls until audio starts
	soundFilterCheckbox.disabled = true;
	filterFrequencySlider.disabled = true;
	filterQSlider.disabled = true;
	filterGainSlider.disabled = true;

	// Start audio on button click
	startAudioButton.addEventListener("click", async () => {
		if (!audio) {
			audio = new Audio("./media/song.mp3");
			await audio.start();
			console.log("Audio started");
			// Enable filter controls
			soundFilterCheckbox.disabled = false;
			filterFrequencySlider.disabled = false;
			filterQSlider.disabled = false;
			filterGainSlider.disabled = false;
			startAudioButton.disabled = true; // Disable button after starting
		}
	});

	soundFilterCheckbox.addEventListener("input", () => {
		if (audio) audio.enableFilter(soundFilterCheckbox.checked);
		if (soundFilterCheckbox.checked) {
			filterFrequencySlider.disabled = false;
			filterQSlider.disabled = false;
			filterGainSlider.disabled = false;
		} else {
			filterFrequencySlider.disabled = true;
			filterQSlider.disabled = true;
			filterGainSlider.disabled = true;
		}
	});
	filterFrequencySlider.addEventListener("input", () => {
		if (audio)
			audio.setFilterFrequency(Number.parseFloat(filterFrequencySlider.value));
		filterFrequencyCounter.textContent = filterFrequencySlider.value;
	});
	filterQSlider.addEventListener("input", () => {
		if (audio) audio.setFilterQ(Number.parseFloat(filterQSlider.value));
		if (filterQCounter) filterQCounter.textContent = filterQSlider.value;
	});
	filterGainSlider.addEventListener("input", () => {
		if (audio) audio.setFilterGain(Number.parseFloat(filterGainSlider.value));
		if (filterGainCounter)
			filterGainCounter.textContent = filterGainSlider.value;
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
			const paramName = control
				.split("-")
				.map((word, index) =>
					index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
				)
				.join("");
			console.log(`Setting ${paramName} to ${val}`);
			renderingParams[paramName] = val;
			draw();
		});
	});
}

function animateLight(time) {
	const radius = 10.0;
	const speed = 0.001;

	lightPosition.x = radius * Math.cos(time * speed);
	lightPosition.y = 5.0;
	lightPosition.z = radius * Math.sin(time * speed);

	requestAnimationFrame(animateLight);
}

function animate() {
	draw();
	requestAnimationFrame(animate);
}

function quaternionToMatrix(q) {
	// Extract quaternion components: q = [w, x, y, z]
	const q0 = q[0]; // w (cos(θ/2))
	const q1 = q[1]; // x (x*sin(θ/2))
	const q2 = q[2]; // y (y*sin(θ/2))
	const q3 = q[3]; // z (z*sin(θ/2))

	// Normalize quaternion to ensure unit length
	const norm = Math.sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3);
	const w = norm > 0 ? q0 / norm : 0;
	const x = norm > 0 ? q1 / norm : 0;
	const y = norm > 0 ? q2 / norm : 0;
	const z = norm > 0 ? q3 / norm : 0;

	// Compute 3x3 rotation matrix elements
	const r00 = 2 * (w * w + x * x) - 1;
	const r01 = 2 * (x * y - w * z);
	const r02 = 2 * (x * z + w * y);

	const r10 = 2 * (x * y + w * z);
	const r11 = 2 * (w * w + y * y) - 1;
	const r12 = 2 * (y * z - w * x);

	const r20 = 2 * (x * z - w * y);
	const r21 = 2 * (y * z + w * x);
	const r22 = 2 * (w * w + z * z) - 1;

	// Create 4x4 matrix (column-major for WebGL)
	const R = new Float32Array(16);
	R[0] = r00; // m00
	R[1] = r10; // m10
	R[2] = r20; // m20
	R[3] = 0; // m30
	R[4] = r01; // m01
	R[5] = r11; // m11
	R[6] = r21; // m21
	R[7] = 0; // m31
	R[8] = r02; // m02
	R[9] = r12; // m12
	R[10] = r22; // m22
	R[11] = 0; // m32
	R[12] = 0; // m03
	R[13] = 0; // m13
	R[14] = 0; // m23
	R[15] = 1; // m33

	// Apply coordinate system correction
	// Original mapping (R_x(π/2)):
	//   Sensor X (east) → WebGL X (right)
	//   Sensor Y (north) → WebGL Z (up)
	//   Sensor Z (up) → WebGL -Y (backward)
	// Desired mapping (swap Y and Z):
	//   Sensor X (east) → WebGL X (right)
	//   Sensor Y (north) → WebGL -Y (backward)
	//   Sensor Z (up) → WebGL Z (up)
	let correctionMatrix = new Float32Array([
		1,
		0,
		0,
		0, // X → X
		0,
		0,
		-1,
		0, // Y → -Y
		0,
		1,
		0,
		0, // Z → Z
		0,
		0,
		0,
		1, // Homogeneous coordinate
	]);
	let resultMatrix = m4.multiply(correctionMatrix, R);
	// Apply coordinate system correction (rotate 90 degrees around X-axis)
	correctionMatrix = m4.axisRotation([1, 0, 0], Math.PI / 2);
	resultMatrix = m4.multiply(correctionMatrix, R);
	return resultMatrix;
}

function initSensorWebSocket() {
	const wsUrl =
		"ws://192.168.0.216:8080/sensor/connect?type=android.sensor.game_rotation_vector";
	sensorSocket = new WebSocket(wsUrl);

	sensorSocket.onopen = () => {
		console.log("Connected to Sensor Server WebSocket");
	};

	sensorSocket.onmessage = (event) => {
		const data = JSON.parse(event.data);
		if (data.values && data.values.length >= 4) {
			// Sensor data: [x*sin(θ/2), y*sin(θ/2), z*sin(θ/2), cos(θ/2)]
			// Reorder to [w, x, y, z] for quaternionToMatrix
			const quaternion = [
				data.values[3],
				data.values[0],
				data.values[1],
				data.values[2],
			];
			// console.log("Quaternion:", quaternion); // Debug: verify order
			orientationMatrix = quaternionToMatrix(quaternion);
		}
	};

	sensorSocket.onerror = (error) => {
		console.error("WebSocket error:", error);
	};

	sensorSocket.onclose = () => {
		console.log("WebSocket closed. Attempting to reconnect...");
		setTimeout(initSensorWebSocket, 5000);
	};
}

function drawEye(eyeOffset) {
	const projection = m4.perspective(
		(renderingParams.fov * Math.PI) / 180,
		1,
		renderingParams.nearClip,
		100,
	);

	// Surface is static: use identity matrix (no rotation from phone)
	const modelView = m4.identity();

	// Apply eye offset for stereo
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

	// Draw surface
	gl.uniformMatrix4fv(program.matrixUni, false, modelViewProjection);
	let normalMatrix = m4.transpose(m4.inverse(matAcc1));
	gl.uniformMatrix4fv(program.normalMatrixUni, false, normalMatrix);
	gl.uniform3f(
		program.lightDirectionUni,
		lightPosition.x,
		lightPosition.y,
		lightPosition.z,
	);
	gl.uniform3fv(program.viewPositionUni, [0, 0, 5]);

	gl.uniform1i(program.isWireframeUni, false);
	surface.draw(gl, program);

	gl.enable(gl.POLYGON_OFFSET_FILL);
	gl.polygonOffset(1, 1);
	gl.uniform1i(program.isWireframeUni, true);
	surface.drawWireframe(gl, program);
	gl.disable(gl.POLYGON_OFFSET_FILL);

	// Draw sound source sphere
	// Orbit around surface center (0, 0, 0) at radius 1, controlled by phone orientation
	const radius = 1.0; // Orbit radius
	const basePosition = [radius, 0, 0]; // Start on X-axis
	// Apply orientationMatrix to rotate base position
	const rotatedPosition = m4.transformPoint(orientationMatrix, basePosition);
	// console.log("rotatedPosition", rotatedPosition);
	const sphereTranslation = m4.translation(
		rotatedPosition[0],
		rotatedPosition[1],
		rotatedPosition[2],
	);
	const sphereMat0 = m4.multiply(rotateToPointZero, viewMatrix);
	const sphereMat1 = m4.multiply(sphereTranslation, sphereMat0);
	const sphereMat2 = m4.multiply(translateToPointZero, sphereMat1);
	const sphereMVP = m4.multiply(projection, sphereMat2);

	// Update audio panner position (same as sphere)
	if (audio)
		audio.updatePos(rotatedPosition[0], rotatedPosition[1], rotatedPosition[2]);

	// Draw sphere (red to distinguish)
	gl.uniformMatrix4fv(program.matrixUni, false, sphereMVP);
	normalMatrix = m4.transpose(m4.inverse(sphereMat2));
	gl.uniformMatrix4fv(program.normalMatrixUni, false, normalMatrix);
	gl.uniform3f(program.ambientColorUni, 0.5, 0.1, 0.1); // Reddish ambient
	gl.uniform3f(program.diffuseColorUni, 0.8, 0.2, 0.2); // Reddish diffuse
	gl.uniform1i(program.isWireframeUni, false);
	soundSphere.draw(gl, program);
	gl.uniform1i(program.isWireframeUni, true);
	soundSphere.drawWireframe(gl, program);

	// Restore lighting for next draw
	gl.uniform3f(program.ambientColorUni, 0.3, 0.3, 0.3);
	gl.uniform3f(program.diffuseColorUni, 0.8, 0.8, 0.8);
}

function draw() {
	gl.clearColor(1, 1, 1, 1);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	if (webcamElement && webcamElement.videoWidth > 0) {
		drawVideoBackground();
	}

	gl.uniform3f(program.specularColorUni, 1.0, 1.0, 1.0);
	gl.uniform1f(program.shininessUni, 32.0);

	// Draw left eye (red)
	gl.colorMask(true, false, false, true);
	gl.clear(gl.DEPTH_BUFFER_BIT);
	drawEye(-renderingParams.eyeSeparation / 2);

	// Draw right eye (cyan)
	gl.colorMask(false, true, true, true);
	gl.clear(gl.DEPTH_BUFFER_BIT);
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

		await initWebcam();
		initShaderProgram();
		initSurface();
		initSoundSphere();
		gl.enable(gl.DEPTH_TEST);

		setupUIControls();
		setupStereoControls();

		initSensorWebSocket();

		// Audio is initialized via button click, not here
		animateLight(0);
		animate();
	} catch (e) {
		console.error(`Initialization error: ${e}`);
	}
}

document.addEventListener("DOMContentLoaded", init);
