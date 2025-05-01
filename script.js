// --- Strict Mode & DOM Ready ---
"use strict";

// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element References ---
    const container = document.getElementById('container');
    const loader = document.getElementById('loader');
    const shapeButtons = document.querySelectorAll('.shape-btn');
    const colorButtons = document.querySelectorAll('.color-btn');
    const presetButtons = document.querySelectorAll('.preset-btn');
    const shapeInfo = document.getElementById('shapeInfo');
    const pointSizeSlider = document.getElementById('pointSizeSlider');
    const pointSizeValue = document.getElementById('pointSizeValue');
    const morphSpeedSlider = document.getElementById('morphSpeedSlider');
    const morphSpeedValue = document.getElementById('morphSpeedValue');
    const bloomSlider = document.getElementById('bloomSlider');
    const bloomValue = document.getElementById('bloomValue');
    const autoRotateToggle = document.getElementById('autoRotateToggle');
    const audioToggleBtn = document.getElementById('audioToggleBtn');
    const audioStatus = document.getElementById('audioStatus');


    // --- Basic Checks ---
    if (!THREE) return console.error("THREE.js library not loaded!");
    if (!container) return console.error("Container element not found!");
    if (!loader) return console.error("Loader element not found!");
    // Add checks for other essential elements if needed

    // --- Configuration & State ---
    const config = {
        particleCount: 12000, // More particles!
        pointSizeBase: 2.5,
        morphDurationBase: 1800, // milliseconds
        bloomStrengthBase: 1.2,
        autoRotateSpeed: 0.0003,
        audioPulseFactor: 1.5 // How much size pulses with audio
    };

    let state = {
        currentShapeIndex: 0,
        isMorphing: false,
        isAutoRotating: true,
        isAudioEnabled: false,
        targetPointSize: config.pointSizeBase,
        targetMorphDuration: config.morphDurationBase,
        targetBloomStrength: config.bloomStrengthBase,
        currentPreset: 'default',
    };

    const shapeNames = ['Sphere', 'Cube', 'Torus', 'Plane', 'Spiral'];

    // --- Scene, Camera, Renderer ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    // --- Orbit Controls ---
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.04; // Slightly faster damping
    controls.screenSpacePanning = false;
    controls.minDistance = 3;
    controls.maxDistance = 150; // Allow zooming out further


    // --- Particle Geometry & Attributes ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const targetPositions = [];

    // --- Shape Generation Functions ---
    function generateSpherePositions(arr) {
        const radius = 12;
        for (let i = 0; i < config.particleCount; i++) {
            const i3 = i * 3;
            const phi = Math.acos(-1 + (2 * i) / config.particleCount);
            const theta = Math.sqrt(config.particleCount * Math.PI) * phi;
            arr[i3] = radius * Math.sin(phi) * Math.cos(theta);
            arr[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            arr[i3 + 2] = radius * Math.cos(phi);
        }
    }
    function generateCubePositions(arr) {
        const size = 18;
        const halfSize = size / 2;
        for (let i = 0; i < config.particleCount; i++) {
            const i3 = i * 3;
            const axis = Math.floor(Math.random() * 3);
            const side = Math.random() < 0.5 ? -1 : 1;
            arr[i3 + (axis % 3)] = side * halfSize;
            arr[i3 + ((axis + 1) % 3)] = (Math.random() - 0.5) * size;
            arr[i3 + ((axis + 2) % 3)] = (Math.random() - 0.5) * size;
        }
    }
    function generateTorusPositions(arr) {
        const radius = 10;
        const tube = 4;
        for (let i = 0; i < config.particleCount; i++) {
            const i3 = i * 3;
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI * 2;
            arr[i3] = (radius + tube * Math.cos(v)) * Math.cos(u);
            arr[i3 + 1] = (radius + tube * Math.cos(v)) * Math.sin(u);
            arr[i3 + 2] = tube * Math.sin(v);
        }
    }
    function generatePlanePositions(arr) {
        const size = 25;
        for (let i = 0; i < config.particleCount; i++) {
            const i3 = i * 3;
            arr[i3] = (Math.random() - 0.5) * size;
            arr[i3 + 1] = (Math.random() - 0.5) * size;
            arr[i3 + 2] = (Math.random() - 0.5) * 1.0; // Slightly more depth
        }
    }
    function generateSpiralPositions(arr) {
        const radius = 8;
        const height = 20;
        const turns = 5;
        const pointsPerTurn = config.particleCount / turns;

        for (let i = 0; i < config.particleCount; i++) {
            const i3 = i * 3;
            const angle = (i / pointsPerTurn) * Math.PI * 2 * turns;
            const currentRadius = radius * (i / config.particleCount); // Radius grows outwards
            const y = (i / config.particleCount - 0.5) * height; // From bottom to top

            arr[i3] = currentRadius * Math.cos(angle); // x
            arr[i3 + 1] = y; // y
            arr[i3 + 2] = currentRadius * Math.sin(angle); // z
        }
    }

    // Populate Target Positions & Geometry Attributes
    const generationFunctions = [generateSpherePositions, generateCubePositions, generateTorusPositions, generatePlanePositions, generateSpiralPositions];
    generationFunctions.forEach((func, index) => {
        const shapePosArray = new Float32Array(config.particleCount * 3);
        func(shapePosArray);
        targetPositions.push(shapePosArray);
        geometry.setAttribute(`aTarget${index}`, new THREE.BufferAttribute(shapePosArray, 3));
        if (index === 0) {
            positions.set(shapePosArray); // Initialize positions to the first shape
        }
    });
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // --- Mouse Position Tracking ---
    const mouse = new THREE.Vector2(999, 999); // Start offscreen
    const interactionRadius = 2.5;
    const repulsionStrength = 1.8;
    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }, { passive: true }); // Improve scroll performance
     window.addEventListener('mouseout', () => { // Move mouse offscreen when leaving window
        mouse.set(999, 999);
    });


    // --- Audio Reactivity Setup ---
    let audioContext, analyser, dataArray, source;
    let audioIntensity = 0.0; // Value from 0 to 1 based on volume

    function initAudio() {
        if (audioContext) return Promise.resolve(); // Already initialized

        return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                .then(stream => {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    analyser = audioContext.createAnalyser();
                    analyser.fftSize = 256; // Lower size for faster analysis
                    const bufferLength = analyser.frequencyBinCount;
                    dataArray = new Uint8Array(bufferLength);

                    source = audioContext.createMediaStreamSource(stream);
                    source.connect(analyser);
                    // We don't connect analyser to destination, so we don't hear the mic input

                    state.isAudioEnabled = true;
                    audioStatus.textContent = "(Mic Enabled)";
                    audioStatus.classList.add('enabled');
                    audioToggleBtn.textContent = "Disable Audio Pulse";
                    console.log("Audio context initialized.");
                    resolve();
                })
                .catch(err => {
                    console.error("Error accessing microphone:", err);
                    audioStatus.textContent = `(Error: ${err.name})`;
                    audioStatus.classList.remove('enabled');
                    state.isAudioEnabled = false;
                    reject(err);
                });
        });
    }

    function stopAudio() {
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().then(() => {
                audioContext = null;
                analyser = null;
                dataArray = null;
                source = null;
                state.isAudioEnabled = false;
                audioIntensity = 0; // Reset intensity
                material.uniforms.uAudioIntensity.value = 0; // Update uniform immediately
                audioStatus.textContent = "(Mic Disabled)";
                audioStatus.classList.remove('enabled');
                audioToggleBtn.textContent = "Enable Audio Pulse";
                console.log("Audio context closed.");
            });
        }
    }

    function getAudioIntensity() {
        if (!analyser || !dataArray) return 0;

        analyser.getByteFrequencyData(dataArray); // Faster than time domain for general volume

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        // Normalize the average (0-255) to a 0-1 range, maybe non-linearly
        return Math.pow(average / 128, 2); // Squaring emphasizes louder sounds
    }


    // --- Shader Material ---
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uPointSize: { value: state.targetPointSize * window.devicePixelRatio },
            uColor: { value: new THREE.Color(0xffd700) },
            uMorphProgress: { value: 0.0 },
            uFromShapeIndex: { value: 0 },
            uToShapeIndex: { value: 0 },
            uMouse: { value: mouse },
            uInteractionRadius: { value: interactionRadius },
            uRepulsionStrength: { value: repulsionStrength },
            uAudioIntensity: { value: 0.0 } // For audio reactivity
        },
        vertexShader: `
            uniform float uPointSize;
            uniform float uTime;
            uniform float uMorphProgress;
            uniform int uFromShapeIndex;
            uniform int uToShapeIndex;
            uniform vec2 uMouse;
            uniform float uInteractionRadius;
            uniform float uRepulsionStrength;
            uniform float uAudioIntensity; // Audio level 0-1

            attribute vec3 aTarget0; // Sphere
            attribute vec3 aTarget1; // Cube
            attribute vec3 aTarget2; // Torus
            attribute vec3 aTarget3; // Plane
            attribute vec3 aTarget4; // Spiral

            // Varying to pass audio intensity to fragment if needed
            varying float vAudioIntensity;

            vec3 getShapePosition(int index) {
                if (index == 0) return aTarget0;
                if (index == 1) return aTarget1;
                if (index == 2) return aTarget2;
                if (index == 3) return aTarget3;
                if (index == 4) return aTarget4;
                return aTarget0; // Fallback
            }

            // Smooth version of mix
            float smoothMix(float a, float b, float t) {
                // Use smoothstep or similar easing function for t
                float smoothT = t * t * (3.0 - 2.0 * t); // Smoothstep easing
                return mix(a, b, smoothT);
            }
             vec3 smoothMix(vec3 a, vec3 b, float t) {
                float smoothT = t * t * (3.0 - 2.0 * t);
                return mix(a, b, smoothT);
            }

            void main() {
                vec3 positionFrom = getShapePosition(uFromShapeIndex);
                vec3 positionTo = getShapePosition(uToShapeIndex);

                // Use smooth mixing for morphing
                vec3 basePosition = smoothMix(positionFrom, positionTo, uMorphProgress);


                // --- Mouse Interaction ---
                vec4 projectedPosition = projectionMatrix * modelViewMatrix * vec4(basePosition, 1.0);
                vec2 screenPos = projectedPosition.xy / projectedPosition.w;
                float dist = distance(screenPos, uMouse);
                vec3 displacement = vec3(0.0);
                if (dist < uInteractionRadius) {
                    vec3 repelDirWorld = normalize(basePosition - cameraPosition); // Repel from camera view direction
                    float strength = smoothstep(uInteractionRadius, 0.0, dist) * uRepulsionStrength;
                    displacement = repelDirWorld * strength * (1.0 - uMorphProgress * 0.5); // Reduce effect during morph
                }

                vec3 finalPosition = basePosition + displacement;

                 // --- Audio Pulse - affect position slightly outwards ---
                 // finalPosition += normalize(basePosition) * uAudioIntensity * 0.5; // Pulse outwards

                vec4 modelViewPosition = modelViewMatrix * vec4(finalPosition, 1.0);
                gl_Position = projectionMatrix * modelViewPosition;

                // --- Point Size Calculation ---
                float size = uPointSize;
                 // Pulse size with audio
                size *= (1.0 + uAudioIntensity * ${config.audioPulseFactor.toFixed(2)}); // Use config value
                // Attenuation based on distance
                gl_PointSize = size * ( 20.0 / -modelViewPosition.z );

                vAudioIntensity = uAudioIntensity; // Pass to fragment shader
            }
        `,
        fragmentShader: `
            uniform vec3 uColor;
            varying float vAudioIntensity; // Receive from vertex shader

            void main() {
                float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
                // float alpha = 1.0 - smoothstep(0.45, 0.5, distanceToCenter);
                 float alpha = smoothstep(0.5, 0.45, distanceToCenter); // Correct smoothstep for circle


                if(alpha <= 0.01) { // Use a small threshold
                    discard;
                }

                 // Make color slightly brighter overall for bloom, pulse with audio
                 float brightness = 1.2 + vAudioIntensity * 0.8;
                 gl_FragColor = vec4(uColor * brightness, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    // --- Particle System ---
    const particles = new THREE.Points(geometry, material);
    // Start slightly rotated for better initial view
    particles.rotation.x = 0.2;
    particles.rotation.y = -0.3;
    scene.add(particles);

    // --- Post Processing ---
    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        state.targetBloomStrength, // strength
        0.4,  // radius (keep relatively constant)
        0.75  // threshold (adjust if needed)
    );
    const composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);


    // --- Presets Definition ---
    const presets = {
        default: {
            name: 'Default', shapeIndex: 0, color: 0xffd700, pointSize: 2.5, morphSpeed: 1.8, bloom: 1.2, autoRotate: true
        },
        galaxy: {
            name: 'Galaxy', shapeIndex: 4, color: 0x8a2be2, pointSize: 1.8, morphSpeed: 2.5, bloom: 1.6, autoRotate: true
        },
        neonCube: {
            name: 'Neon Cube', shapeIndex: 1, color: 0x00ff00, pointSize: 3.0, morphSpeed: 1.5, bloom: 2.0, autoRotate: false
        },
        delicate: {
            name: 'Delicate', shapeIndex: 3, color: 0xffffff, pointSize: 1.2, morphSpeed: 3.0, bloom: 0.8, autoRotate: true
        },
        // Add more presets here
    };

    // --- Core Functions ---
    function morphToShape(targetShapeIndex) {
        if (state.isMorphing || targetShapeIndex === state.currentShapeIndex) return;
        state.isMorphing = true;

        material.uniforms.uFromShapeIndex.value = state.currentShapeIndex;
        material.uniforms.uToShapeIndex.value = targetShapeIndex;
        material.uniforms.uMorphProgress.value = 0.0; // Ensure progress starts at 0

        anime({
            targets: material.uniforms.uMorphProgress,
            value: 1.0,
            duration: state.targetMorphDuration, // Use state variable
            easing: 'easeInOutExpo', // Smoother easing
            complete: () => {
                state.currentShapeIndex = targetShapeIndex;
                state.isMorphing = false;
                updateActiveShapeButton();
                shapeInfo.textContent = `Shape: ${shapeNames[state.currentShapeIndex]}`;
                // Keep uMorphProgress at 1 until the next morph starts
            }
        });
    }

    function applyPreset(presetName) {
        const preset = presets[presetName];
        if (!preset) return;

        console.log("Applying preset:", presetName);
        state.currentPreset = presetName;

        // 1. Apply Shape (Morph)
        morphToShape(preset.shapeIndex);

        // 2. Apply Color (Animate)
        const targetColor = new THREE.Color(preset.color);
        anime({
            targets: material.uniforms.uColor.value,
            r: targetColor.r, g: targetColor.g, b: targetColor.b,
            duration: 800, // Color transition duration
            easing: 'easeInOutQuad'
        });
        updateSelectedColorButton(document.querySelector(`.color-btn[data-color="0x${preset.color.toString(16)}"]`));


        // 3. Apply Control Values (Update state, uniforms, and UI)
        state.targetPointSize = preset.pointSize;
        pointSizeSlider.value = preset.pointSize;
        pointSizeValue.textContent = preset.pointSize.toFixed(1);
        material.uniforms.uPointSize.value = state.targetPointSize * window.devicePixelRatio;

        state.targetMorphDuration = preset.morphSpeed * 1000; // Convert s to ms
        morphSpeedSlider.value = preset.morphSpeed;
        morphSpeedValue.textContent = `${preset.morphSpeed.toFixed(1)}s`;

        state.targetBloomStrength = preset.bloom;
        bloomSlider.value = preset.bloom;
        bloomValue.textContent = preset.bloom.toFixed(1);
        bloomPass.strength = state.targetBloomStrength; // Update bloom pass directly

        state.isAutoRotating = preset.autoRotate;
        autoRotateToggle.checked = preset.autoRotate;

        updateActivePresetButton();
    }

    // --- UI Update Functions ---
    function updateActiveShapeButton() {
        shapeButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.shapeIndex) === state.currentShapeIndex);
        });
    }

    function updateSelectedColorButton(selectedButton) {
        if (!selectedButton) { // Handle cases where color isn't in the picker
             colorButtons.forEach(btn => btn.classList.remove('selected'));
             return;
        }
        colorButtons.forEach(btn => btn.classList.toggle('selected', btn === selectedButton));
    }

     function updateActivePresetButton() {
        presetButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === state.currentPreset);
        });
    }

    // --- Event Listeners ---

    // Shape Buttons
    shapeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetIndex = parseInt(button.dataset.shapeIndex);
            morphToShape(targetIndex);
            // Deselect preset if manually changing shape
             state.currentPreset = null;
             updateActivePresetButton();
        });
    });

    // Color Buttons
    colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            const colorValue = parseInt(button.dataset.color);
            updateSelectedColorButton(button);
            const targetColor = new THREE.Color(colorValue);
            anime({
                targets: material.uniforms.uColor.value,
                r: targetColor.r, g: targetColor.g, b: targetColor.b,
                duration: 500, easing: 'easeInOutQuad'
            });
             // Deselect preset if manually changing color
             state.currentPreset = null;
             updateActivePresetButton();
        });
    });

     // Preset Buttons
     presetButtons.forEach(button => {
         button.addEventListener('click', () => {
             applyPreset(button.dataset.preset);
         });
     });

    // Sliders
    pointSizeSlider.addEventListener('input', (e) => {
        state.targetPointSize = parseFloat(e.target.value);
        pointSizeValue.textContent = state.targetPointSize.toFixed(1);
        material.uniforms.uPointSize.value = state.targetPointSize * window.devicePixelRatio;
         state.currentPreset = null; updateActivePresetButton();
    });
    morphSpeedSlider.addEventListener('input', (e) => {
        const speedInSeconds = parseFloat(e.target.value);
        state.targetMorphDuration = speedInSeconds * 1000;
        morphSpeedValue.textContent = `${speedInSeconds.toFixed(1)}s`;
         state.currentPreset = null; updateActivePresetButton();
    });
    bloomSlider.addEventListener('input', (e) => {
        state.targetBloomStrength = parseFloat(e.target.value);
        bloomValue.textContent = state.targetBloomStrength.toFixed(1);
        bloomPass.strength = state.targetBloomStrength; // Update bloom pass directly
         state.currentPreset = null; updateActivePresetButton();
    });

     // Toggles
     autoRotateToggle.addEventListener('change', (e) => {
         state.isAutoRotating = e.target.checked;
          state.currentPreset = null; updateActivePresetButton();
     });

     audioToggleBtn.addEventListener('click', () => {
         if (!state.isAudioEnabled) {
             initAudio().catch(err => { /* Handle error if needed, already logged */ });
         } else {
             stopAudio();
         }
          state.currentPreset = null; updateActivePresetButton();
     });


    // --- Handle Window Resize ---
    window.addEventListener('resize', () => {
        // Update camera
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        // Update renderer and composer
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Re-apply pixel ratio limit
        composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Update bloom pass resolution (usually handled by composer.setSize)
        // bloomPass.resolution.set(window.innerWidth, window.innerHeight);

        // Update point size uniform based on potentially changed pixel ratio
        material.uniforms.uPointSize.value = state.targetPointSize * Math.min(window.devicePixelRatio, 2);
    });

    // --- Animation Loop ---
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Update uniforms
        material.uniforms.uTime.value = elapsedTime;
        material.uniforms.uMouse.value.copy(mouse); // Use copy for vectors

        // Update audio intensity
        if (state.isAudioEnabled) {
            audioIntensity = getAudioIntensity();
            // Smooth the audio intensity value slightly
            material.uniforms.uAudioIntensity.value += (audioIntensity - material.uniforms.uAudioIntensity.value) * 0.1;
        } else {
             // Smoothly decay intensity when disabled
             material.uniforms.uAudioIntensity.value += (0.0 - material.uniforms.uAudioIntensity.value) * 0.1;
        }


        // Update controls
        controls.update();

        // Auto Rotation
        if (state.isAutoRotating && !state.isMorphing && !controls.manualRotation) { // Add check for manual rotation
             particles.rotation.y += config.autoRotateSpeed;
        }
         // Track if user is manually rotating
         controls.manualRotation = controls.getAzimuthalAngle() !== controls.previousAzimuthalAngle || controls.getPolarAngle() !== controls.previousPolarAngle;
         controls.previousAzimuthalAngle = controls.getAzimuthalAngle();
         controls.previousPolarAngle = controls.getPolarAngle();


        // Render scene with composer
        composer.render();
    }

    // --- Initial Setup ---
    function initializeApp() {
        try {
            // Apply the default preset initially
             applyPreset('default'); // This also updates UI elements

            // Hide loader
            loader.classList.add('hidden');

            // Start animation loop
            animate();
            console.log("App initialized successfully.");
        } catch (error) {
            console.error("Initialization failed:", error);
            loader.textContent = "Error initializing app. Please check console.";
            loader.style.color = "red";
        }
    }

     // Hacky way to detect if user is manually rotating - needs improvement
     controls.manualRotation = false;
     controls.previousAzimuthalAngle = controls.getAzimuthalAngle();
     controls.previousPolarAngle = controls.getPolarAngle();
     controls.addEventListener('start', () => controls.manualRotation = true);
     // controls.addEventListener('end', () => controls.manualRotation = false); // End event doesn't always fire reliably


    initializeApp();

}); // End DOMContentLoaded listener
