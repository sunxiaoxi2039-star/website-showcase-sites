// 开场三维场景：一间暗色展厅，六幅成品挂成半圆，中央底座上是一件会缓慢变形的金属雕塑。
// 镜头沿一条路线随滚动移动：远景 → 靠近雕塑 → 依次停在六幅作品前 → 升起俯瞰。
// 雕塑的位置就是 Tripo GLB 槽位：传入 glb 路径时加载模型替换它，保留模型自带的贴图和材质。
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Ashima Arts 3D simplex noise（MIT）
const SNOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// 小型值噪声，用来在 canvas 上画大理石和地面粗糙度贴图
function valueNoise(seed) {
  const N = 128, g = new Float32Array(N * N);
  let s = seed >>> 0;
  for (let i = 0; i < g.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; g[i] = s / 4294967296; }
  const at = (x, y) => g[((y & (N - 1)) * N) + (x & (N - 1))];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, x, y, oct = 5) {
  let a = .5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); f *= 2; a *= .5; }
  return s;
}
function canvasTexture(size, paint, srgb) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(size, size);
  paint(img.data, size); ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function marbleTexture(size) {
  const n = valueNoise(7);
  return canvasTexture(size, (d, S) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S * 8, v = y / S * 8;
      const t = fbm(n, u, v);
      const vein = Math.pow(Math.abs(Math.sin((u * .9 + v * .35 + t * 5.5) * 1.3)), .22);
      const fine = Math.pow(Math.abs(Math.sin((u * 2.2 - v * .6 + fbm(n, u + 9, v + 3) * 7) * 2.1)), .5);
      const k = (vein * .72 + fine * .28);
      const i = (y * S + x) * 4;
      d[i] = 26 + k * 150 + t * 20; d[i + 1] = 26 + k * 146 + t * 18; d[i + 2] = 30 + k * 140 + t * 16; d[i + 3] = 255;
    }
  }, true);
}
function roughTexture(size) {
  const n = valueNoise(21);
  return canvasTexture(size, (d, S) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const t = fbm(n, x / S * 16, y / S * 16, 4);
      const c = 110 + t * 120; const i = (y * S + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = c; d[i + 3] = 255;
    }
  }, false);
}
function plaqueTexture(ch) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 200;
  const g = cv.getContext('2d');
  g.fillStyle = '#101114'; g.fillRect(0, 0, 1024, 200);
  g.strokeStyle = 'rgba(214,180,120,.55)'; g.lineWidth = 3; g.strokeRect(10, 10, 1004, 180);
  g.fillStyle = ch.palette.accent; g.font = '600 76px "Iowan Old Style", Palatino, Georgia, serif';
  g.textBaseline = 'middle'; g.fillText(ch.nn, 44, 102);
  g.fillStyle = '#ece6da'; g.font = '600 50px "PingFang SC", "Hiragino Sans GB", "Songti SC", sans-serif';
  g.fillText(ch.zh, 180, 76);
  g.fillStyle = 'rgba(236,230,218,.62)'; g.font = 'italic 34px "Iowan Old Style", Palatino, Georgia, serif';
  g.fillText(ch.en, 182, 138);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createHero({ canvas, chapters, reduced = false, mobile = false, glb = '', glbYaw = 0, onFrame = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const BG = new THREE.Color('#07080b');
  scene.background = BG;
  scene.fog = new THREE.FogExp2(BG, 0.034);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 140);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const uTime = { value: 0 };
  let needsRender = true;

  // 灯光：暖色主光带阴影，冷色轮廓光，很弱的天光
  scene.add(new THREE.HemisphereLight('#2b3140', '#060607', 0.7));
  const key = new THREE.SpotLight('#ffd6a0', 110, 34, 0.36, 0.65, 1.5);
  key.position.set(2.2, 10.5, 4.2);
  key.target.position.set(0, 1.6, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 4; key.shadow.camera.far = 24;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#8fb2ff', 1.3);
  rim.position.set(-7, 5, -9);
  scene.add(rim);

  // 半透明地面 + 镜像副本，做出抛光石地的倒影
  const world = new THREE.Group(); scene.add(world);
  const mirror = new THREE.Group(); mirror.scale.y = -1; scene.add(mirror);
  const rough = roughTexture(mobile ? 128 : 256); rough.repeat.set(10, 10);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 96), new THREE.MeshStandardMaterial({
    color: '#0d0e12', roughness: 0.55, roughnessMap: rough, metalness: 0.1, envMap: env, envMapIntensity: 0.35,
    transparent: true, opacity: 0.84,
  }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.renderOrder = 1;
  scene.add(floor);
  const addBoth = (obj) => { world.add(obj); const m = obj.clone(); m.traverse(o => { o.castShadow = false; o.receiveShadow = false; }); mirror.add(m); return m; };

  // 底座：大理石柱身 + 黄铜顶板
  const marble = marbleTexture(mobile ? 256 : 512);
  marble.anisotropy = maxAniso;
  const marbleMat = new THREE.MeshStandardMaterial({ map: marble, roughness: 0.28, metalness: 0, envMap: env, envMapIntensity: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b48a52', metalness: 1, roughness: 0.3, roughnessMap: rough, envMap: env, envMapIntensity: 1.1 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.38, 1.1, 96), marbleMat);
  plinth.position.y = 0.55; plinth.castShadow = plinth.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.34, 0.08, 96), brass);
  cap.position.y = 1.14; cap.castShadow = cap.receiveShadow = true;
  addBoth(plinth); addBoth(cap);

  // 雕塑：在顶点着色器里用噪声推动球面，并用相邻点重算法线；材质是带薄膜干涉的抛光金属
  const blobMat = new THREE.MeshPhysicalMaterial({
    color: '#17181d', metalness: 1, roughness: 0.17, envMap: env, envMapIntensity: 1.7,
    iridescence: 1, iridescenceIOR: 1.45, iridescenceThicknessRange: [160, 720], clearcoat: 1, clearcoatRoughness: 0.08,
  });
  blobMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + SNOISE + `
vec3 blobPos(vec3 n){
  float d = snoise(n * 1.3 + vec3(0., uTime * .21, uTime * .13)) * .2 + snoise(n * 3.2 - vec3(uTime * .17)) * .045;
  return n * (1. + d);
}\n` + sh.vertexShader;
    sh.vertexShader = sh.vertexShader
      .replace('#include <beginnormal_vertex>', `
vec3 n0 = normalize(position);
vec3 tg = normalize(cross(n0, abs(n0.y) > .95 ? vec3(1., 0., 0.) : vec3(0., 1., 0.)));
vec3 bt = cross(n0, tg);
vec3 bp = blobPos(n0);
vec3 objectNormal = normalize(cross(blobPos(normalize(n0 + tg * .012)) - bp, blobPos(normalize(n0 + bt * .012)) - bp));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = bp * 1.05;');
  };
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, mobile ? 36 : 72), blobMat);
  blob.position.y = 2.45; blob.castShadow = true;
  const blobMirror = addBoth(blob);

  // 主光下方的体积光锥
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color('#ffcf94') }, uAlpha: { value: 0.11 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(vN, vV)), 2.2); float h = pow(vUv.y, 1.2) * smoothstep(1., .7, vUv.y);
        gl_FragColor = vec4(uColor, uAlpha * edge * h); }`,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.3, 8.2, 64, 1, true), coneMat);
  cone.position.set(0, 5.2, 0);
  world.add(cone);

  // 每章一幅作品：黄铜外框（带倒角）+ 深色卡纸 + 自发光画面 + 玻璃反光 + 铭牌 + 顶部光锥
  const PW = 3.2, PH = PW * 9 / 14, MAT = 0.2, BORDER = 0.16, R = 9;
  const outer = { w: PW + MAT * 2 + BORDER * 2, h: PH + MAT * 2 + BORDER * 2 };
  const shape = new THREE.Shape();
  shape.moveTo(-outer.w / 2, -outer.h / 2); shape.lineTo(outer.w / 2, -outer.h / 2); shape.lineTo(outer.w / 2, outer.h / 2); shape.lineTo(-outer.w / 2, outer.h / 2);
  const hole = new THREE.Path();
  const iw = PW + MAT * 2, ih = PH + MAT * 2;
  hole.moveTo(-iw / 2, -ih / 2); hole.lineTo(-iw / 2, ih / 2); hole.lineTo(iw / 2, ih / 2); hole.lineTo(iw / 2, -ih / 2);
  shape.holes.push(hole);
  const frameGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 4 });
  const matGeo = new THREE.PlaneGeometry(iw, ih);
  const picGeo = new THREE.PlaneGeometry(PW, PH);
  const backGeo = new THREE.BoxGeometry(outer.w - 0.05, outer.h - 0.05, 0.06);
  const matMat = new THREE.MeshStandardMaterial({ color: '#16171b', roughness: 0.92, envMap: env, envMapIntensity: 0.3 });
  const backMat = new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.05, envMap: env, envMapIntensity: 1.2, transparent: true, opacity: 0.09, depthWrite: false });
  const loader = new THREE.TextureLoader();
  const frames = [], keysPos = [], keysLook = [];
  const onTex = () => { needsRender = true; };
  chapters.forEach((ch, i) => {
    const th = THREE.MathUtils.degToRad(-165 + i * Math.min(30, 170 / Math.max(1, chapters.length - 1))); // 7 幅时每幅间隔约 28°，外框不相碰
    const pos = new THREE.Vector3(Math.cos(th) * R, 2.4, Math.sin(th) * R);
    const g = new THREE.Group(); g.position.copy(pos); g.lookAt(0, 2.4, 0);
    const tex = loader.load(`media/${ch.nn}-a.jpg`, onTex);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
    const pic = new THREE.Mesh(picGeo, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.9, 0.9, 0.9), toneMapped: false }));
    pic.position.z = 0.012;
    const mat = new THREE.Mesh(matGeo, matMat); mat.position.z = 0.0; mat.receiveShadow = true;
    const back = new THREE.Mesh(backGeo, backMat); back.position.z = -0.05;
    const fr = new THREE.Mesh(frameGeo, brass); fr.position.z = -0.04; fr.castShadow = true;
    const glass = new THREE.Mesh(picGeo, glassMat); glass.position.z = 0.05;
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9 * 200 / 1024), new THREE.MeshBasicMaterial({ map: plaqueTexture(ch), toneMapped: false }));
    plaque.position.set(0, -outer.h / 2 - 0.42, 0.02);
    g.add(back, mat, pic, fr, glass, plaque);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.6, 48, 1, true), coneMat.clone());
    beam.material.uniforms.uColor.value = new THREE.Color(ch.palette.accent).lerp(new THREE.Color('#ffffff'), 0.45);
    beam.material.uniforms.uAlpha.value = 0.05;
    beam.position.set(0, outer.h / 2 + 0.75, 0.9); beam.rotation.x = -0.22;
    g.add(beam);
    addBoth(g);
    frames.push(g);
    const dir = pos.clone().setY(0).normalize();
    keysPos.push(pos.clone().addScaledVector(dir, -6.4).setY(2.75));
    keysLook.push(pos.clone());
  });

  // 浮尘
  const DUST = mobile ? 450 : 1300;
  const dp = new Float32Array(DUST * 3), ds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 12;
    dp[i * 3] = Math.cos(a) * r; dp[i * 3 + 1] = Math.random() * 7; dp[i * 3 + 2] = Math.sin(a) * r; ds[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(ds, 1));
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `uniform float uTime; uniform float uPR; attribute float seed; varying float vA;
      void main(){ vec3 p = position;
        p.y = mod(p.y + uTime * (.05 + seed * .08), 7.);
        p.x += sin(uTime * .21 + seed * 40.) * .35; p.z += cos(uTime * .17 + seed * 30.) * .35;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = (1.2 + seed * 2.2) * uPR * 16. / -mv.z;
        vA = (.25 + .75 * seed) * smoothstep(0., .8, p.y) * smoothstep(7., 5.5, p.y) * (.55 + .45 * sin(uTime * 1.3 + seed * 90.));
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(1., .86, .66, vA * smoothstep(.5, .0, d) * .8); }`,
  }));
  world.add(dust);

  // 镜头路线：远景 → 靠近雕塑 → 六幅作品 → 升起俯瞰
  // 起始机位往左看，让雕塑落在画面右侧，给左边的标题留出位置（竖屏时正对）
  const narrow = () => canvas.clientWidth / Math.max(1, canvas.clientHeight) < 0.8;
  const P = [new THREE.Vector3(0, 3.4, 17.5), new THREE.Vector3(0.6, 2.9, 8.6), ...keysPos, new THREE.Vector3(0, 9.8, 13.5)];
  const L = [new THREE.Vector3(narrow() ? 0 : -3.4, narrow() ? 1.2 : 2.6, 0), new THREE.Vector3(0, 2.3, 0), ...keysLook, new THREE.Vector3(0, 1.4, -2.5)];
  const curveP = new THREE.CatmullRomCurve3(P, false, 'centripetal');
  const curveL = new THREE.CatmullRomCurve3(L, false, 'centripetal');
  const SEG = P.length - 1;
  const smooth = (x) => x * x * (3 - 2 * x);
  function pathAt(p) {
    const s = THREE.MathUtils.clamp(p, 0, 1) * SEG;
    const i = Math.min(Math.floor(s), SEG - 1), f = s - i;
    const e = smooth(THREE.MathUtils.clamp((f - 0.16) / 0.68, 0, 1)); // 每个机位前后各停一小段
    return { u: (i + e) / SEG, k: i + e };
  }

  // 可选：Tripo GLB 替换雕塑
  if (glb) {
    import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
      new GLTFLoader().load(glb, (gltf) => {
        const model = gltf.scene;
        model.rotation.y = THREE.MathUtils.degToRad(glbYaw); // 各家模型的「正面」朝向不同，先转到面向镜头
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model); const size = box.getSize(new THREE.Vector3());
        const s = 2.9 / Math.max(size.y, size.x * 0.8, size.z * 0.8);
        model.scale.setScalar(s);
        const b2 = new THREE.Box3().setFromObject(model); const c2 = b2.getCenter(new THREE.Vector3());
        model.position.set(-c2.x, 1.18 - b2.min.y, -c2.z);
        model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && !o.material.envMap) { o.material.envMap = env; o.material.envMapIntensity = 0.9; } } });
        blob.visible = false; blobMirror.visible = false;
        addBoth(model); needsRender = true;
      }, undefined, (err) => { console.warn('[hero] GLB 加载失败，保留程序化雕塑：', glb, err?.message || err); });
    });
  }

  // 后期：辉光只给最亮的部分
  let composer = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.55, 0.82));
    composer.addPass(new OutputPass());
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 58 : 40; // 竖屏把视角放宽，画框不至于被切掉
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
    needsRender = true;
  }
  resize();
  window.addEventListener('resize', resize);

  let target = 0, current = 0, active = false, raf = 0, last = performance.now(), lastFrame = -2;
  const mouse = new THREE.Vector2(), mouseS = new THREE.Vector2();
  if (!mobile && !reduced) window.addEventListener('pointermove', (e) => { mouse.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); });
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();

  function place(dt) {
    current = reduced ? target : current + (target - current) * (1 - Math.exp(-dt * 5));
    mouseS.lerp(mouse, 1 - Math.exp(-dt * 3));
    const { u, k } = pathAt(current);
    curveP.getPoint(u, tmpP); curveL.getPoint(u, tmpL);
    tmpP.x += mouseS.x * 0.35; tmpP.y -= mouseS.y * 0.2;
    camera.position.copy(tmpP); camera.lookAt(tmpL);
    const near = Math.round(k), idx = (Math.abs(k - near) < 0.3 && near >= 2 && near <= 7) ? near - 2 : -1;
    if (idx !== lastFrame) { lastFrame = idx; onFrame(idx); }
  }
  function draw() { if (composer) composer.render(); else renderer.render(scene, camera); needsRender = false; }
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (!reduced) {
      uTime.value += dt;
      blob.rotation.y += dt * 0.12; blobMirror.rotation.y = blob.rotation.y;
    }
    place(dt);
    if (!reduced || needsRender) draw();
  }
  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) { last = performance.now(); raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf);
  }
  place(0); draw();
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setActive(false); });

  return {
    setProgress(p) { target = p; needsRender = true; },
    setActive,
    get progress() { return current; },
    renderer,
  };
}
