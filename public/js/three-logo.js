/**
 * Unified Gang Logo Engine
 * Supports:
 * 1. 'dynamic-2d': 2D Grounded Logo with Organic Float, Perspective Mouse Tilt, Holographic Shimmer, and Breathing Aura
 * 2. 'model': 3D Model (.GLB / .GLTF) loaded via Three.js
 * 3. 'coin': 3D Metallic Cylinder Coin
 */

class ThreeLogoViewer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.options = Object.assign({
      mode: 'dynamic-2d', // Default to 2D Dynamic Logo
      logoUrl: './uploads/logo.png',
      modelUrl: '',
      autoRotate: true,
      rotationSpeed: 0.008,
      floatingAnimation: true,
      floatSpeed: 1.5,
      floatHeight: 0.18,
      mouseFollow: true,
      mouseSensitivity: 1.2,
      lightColor: '#ffffff',
      lightIntensity: 2.0,
      metalness: 0.88,
      roughness: 0.22,
      scale: 1.05
    }, options);

    this.threeScene = null;
    this.animFrameId = null;

    this.init();
  }

  init() {
    this.container.innerHTML = '';

    if (this.options.mode === 'dynamic-2d') {
      this.initDynamic2DLogo();
    } else {
      this.initThreeJSScene();
    }
  }

  // ================= 2D DYNAMIC GROUNDED LOGO =================
  initDynamic2DLogo() {
    const stage = document.createElement('div');
    stage.className = 'dynamic-2d-stage';
    stage.id = 'dynamic-2d-stage';

    stage.innerHTML = `
      <div class="dynamic-2d-aura" id="dynamic-2d-aura"></div>
      <div class="dynamic-2d-orbit-ring"></div>
      <div class="dynamic-2d-card" id="dynamic-2d-card">
        <div class="dynamic-2d-brackets">
          <div class="bracket-corner t-top-l"></div>
          <div class="bracket-corner t-top-r"></div>
          <div class="bracket-corner t-bot-l"></div>
          <div class="bracket-corner t-bot-r"></div>
        </div>
        <div class="dynamic-2d-img-box">
          <img src="${this.options.logoUrl || './uploads/logo.png'}" id="dynamic-logo-element" alt="Gang Logo" onerror="this.onerror=null; this.src='./uploads/logo.png';" />
          <div class="dynamic-2d-shimmer"></div>
        </div>
      </div>
    `;

    this.container.appendChild(stage);

    // Mouse Perspective Parallax Tilt
    const card = stage.querySelector('#dynamic-2d-card');
    let currentTilt = { x: 0, y: 0 };
    let targetTilt = { x: 0, y: 0 };

    this.onMouseMove = (e) => {
      if (!this.options.mouseFollow) return;
      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const normX = (e.clientX - centerX) / (window.innerWidth / 2);
      const normY = (e.clientY - centerY) / (window.innerHeight / 2);

      const maxDegrees = 9 * (this.options.mouseSensitivity || 1.2);
      targetTilt.y = normX * maxDegrees;
      targetTilt.x = -normY * maxDegrees;
    };

    window.addEventListener('mousemove', this.onMouseMove);

    // Smooth Lerp Animation Loop
    const updateTilt = () => {
      currentTilt.x += (targetTilt.x - currentTilt.x) * 0.08;
      currentTilt.y += (targetTilt.y - currentTilt.y) * 0.08;

      if (card) {
        card.style.transform = `perspective(1000px) rotateX(${currentTilt.x.toFixed(2)}deg) rotateY(${currentTilt.y.toFixed(2)}deg)`;
      }
      this.animFrameId = requestAnimationFrame(updateTilt);
    };

    updateTilt();

    // Remove spinner
    const spinner = this.container.querySelector('.three-spinner');
    if (spinner) spinner.remove();
  }

  // ================= 3D THREE.JS SCENE =================
  initThreeJSScene() {
    if (typeof THREE === 'undefined') {
      console.warn('Three.js not loaded, switching to 2D Dynamic Logo');
      this.initDynamic2DLogo();
      return;
    }

    const width = this.container.clientWidth || 550;
    const height = this.container.clientHeight || 400;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 4.3);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.container.appendChild(this.renderer.domElement);

    // Setup Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambientLight);

    const colorHex = typeof this.options.lightColor === 'string'
      ? parseInt(this.options.lightColor.replace('#', '0x'))
      : this.options.lightColor;

    this.keyLight = new THREE.DirectionalLight(colorHex, this.options.lightIntensity);
    this.keyLight.position.set(4, 5, 5);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x00f0ff, 1.4);
    this.rimLight.position.set(-5, -4, -3);
    this.scene.add(this.rimLight);

    this.logoGroup = new THREE.Group();
    this.scene.add(this.logoGroup);

    if (this.options.mode === 'model' && this.options.modelUrl) {
      this.loadGLBModel(this.options.modelUrl);
    } else {
      this.createCoinFallback(this.options.logoUrl);
    }

    this.dragRotation = { x: 0, y: 0 };
    this.clock = new THREE.Clock();

    const animateThree = () => {
      this.animFrameId = requestAnimationFrame(animateThree);
      const elapsed = this.clock.getElapsedTime();

      if (this.options.autoRotate) {
        this.dragRotation.y += this.options.rotationSpeed;
      }
      if (this.logoGroup) {
        if (this.options.floatingAnimation) {
          this.logoGroup.position.y = Math.sin(elapsed * this.options.floatSpeed) * this.options.floatHeight;
        }
        this.logoGroup.rotation.y = this.dragRotation.y;
      }
      this.renderer.render(this.scene, this.camera);
    };

    animateThree();
  }

  loadGLBModel(modelUrl) {
    if (typeof THREE.GLTFLoader === 'undefined') return;
    const loader = new THREE.GLTFLoader();
    loader.load(modelUrl, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxAxis = Math.max(size.x, size.y, size.z);
      const targetScale = (2.3 / maxAxis) * this.options.scale;
      model.position.sub(center);
      model.scale.setScalar(targetScale);
      this.logoGroup.add(model);
    });
  }

  createCoinFallback(logoUrl) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(logoUrl, (texture) => {
      const geo = new THREE.CylinderGeometry(1.35, 1.35, 0.18, 64);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 });
      const faceMat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.05 });
      const mesh = new THREE.Mesh(geo, [rimMat, faceMat, faceMat]);
      mesh.rotation.x = Math.PI / 2;
      mesh.scale.setScalar(this.options.scale);
      this.logoGroup.add(mesh);
    });
  }

  updateConfig(newOptions) {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.onMouseMove) {
      window.removeEventListener('mousemove', this.onMouseMove);
    }
    Object.assign(this.options, newOptions);
    this.init();
  }
}

window.ThreeLogoViewer = ThreeLogoViewer;
