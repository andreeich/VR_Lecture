export class Audio {
	constructor(fileName) {
		this.audioContext = null; // Delay creation
		this.panner = null;
		this.filter = null;
		this.source = null;
		this.useFilter = true;
		this.fileName = fileName;
	}

	async start() {
		// Create AudioContext after user gesture
		if (!this.audioContext) {
			this.audioContext = new AudioContext();
			this.panner = this.audioContext.createPanner();
			this.filter = this.audioContext.createBiquadFilter();

			// Configure panner
			this.panner.panningModel = "HRTF";
			this.panner.distanceModel = "inverse";
			this.panner.refDistance = 1;
			this.panner.maxDistance = 100;
			this.panner.rolloffFactor = 1;

			// Configure peak filter
			this.filter.type = "peaking";
			this.filter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
			this.filter.Q.setValueAtTime(1.0, this.audioContext.currentTime);
			this.filter.gain.setValueAtTime(6, this.audioContext.currentTime);

			// Set listener position and orientation
			const listener = this.audioContext.listener;
			listener.positionX.setValueAtTime(0, this.audioContext.currentTime);
			listener.positionY.setValueAtTime(0, this.audioContext.currentTime);
			listener.positionZ.setValueAtTime(0, this.audioContext.currentTime);
			listener.forwardX.setValueAtTime(0, this.audioContext.currentTime);
			listener.forwardY.setValueAtTime(1, this.audioContext.currentTime);
			listener.forwardZ.setValueAtTime(0, this.audioContext.currentTime);
			listener.upX.setValueAtTime(0, this.audioContext.currentTime);
			listener.upY.setValueAtTime(0, this.audioContext.currentTime);
			listener.upZ.setValueAtTime(1, this.audioContext.currentTime);
		}

		// Resume AudioContext if suspended
		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume();
			console.log("AudioContext resumed");
		}

		// Fetch and play audio
		await this.fetchAudio(this.fileName);
	}

	async fetchAudio(fileName) {
		try {
			const response = await fetch(fileName);
			const arrayBuffer = await response.arrayBuffer();
			const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
			this.play(audioBuffer);
		} catch (error) {
			console.error("Error loading audio file:", error);
		}
	}

	play(audioBuffer) {
		this.source = this.audioContext.createBufferSource();
		this.source.buffer = audioBuffer;
		this.source.loop = true;
		this.source.connect(this.panner);
		this.updateRouting();
		this.source.start();
	}

	updatePos(x, y, z) {
		if (this.panner) {
			this.panner.positionX.setValueAtTime(x, this.audioContext.currentTime);
			this.panner.positionY.setValueAtTime(y, this.audioContext.currentTime);
			this.panner.positionZ.setValueAtTime(z, this.audioContext.currentTime);
		}
	}

	setFilterFrequency(value) {
		if (this.filter) {
			this.filter.frequency.setValueAtTime(
				value,
				this.audioContext.currentTime,
			);
		}
	}

	setFilterQ(value) {
		if (this.filter) {
			this.filter.Q.setValueAtTime(value, this.audioContext.currentTime);
		}
	}

	setFilterGain(value) {
		if (this.filter) {
			this.filter.gain.setValueAtTime(value, this.audioContext.currentTime);
		}
	}

	enableFilter(enabled) {
		this.useFilter = enabled;
		this.updateRouting();
	}

	updateRouting() {
		if (!this.panner || !this.source) return;

		try {
			this.panner.disconnect();
		} catch (e) {
			// Ignore if not connected
		}

		if (this.useFilter) {
			this.panner.connect(this.filter);
			this.filter.connect(this.audioContext.destination);
		} else {
			this.panner.connect(this.audioContext.destination);
		}
	}
}
