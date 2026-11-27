import * as THREE from 'three';

export const HORIZON = '#f59bb8';

export function makeSky(scene) {
  const sunDir = new THREE.Vector3(60, 24, 110).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#1c1a6e') },
      mid: { value: new THREE.Color('#b5409d') },
      hor: { value: new THREE.Color(HORIZON) },
      sun: { value: sunDir },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sun;
      void main(){
        vec3 d = normalize(vP);
        float h = max(d.y, 0.0);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h));
        c = mix(c, top, smoothstep(0.18, 0.85, h));
        // cyan haze band just above the horizon
        c = mix(c, vec3(0.25, 0.85, 0.95), smoothstep(0.02, 0.07, d.y) * (1.0 - smoothstep(0.07, 0.14, d.y)) * 0.45);
        float s = max(dot(d, normalize(sun)), 0.0);
        // retro striped sun disc
        float disc = smoothstep(0.9965, 0.9975, s);
        float stripe = step(0.5, fract(d.y * 90.0)) ;
        float cut = (d.y < 0.18) ? mix(1.0, stripe, smoothstep(0.18, 0.04, d.y)) : 1.0;
        vec3 sunC = mix(vec3(1.0, 0.85, 0.35), vec3(1.0, 0.3, 0.55), smoothstep(0.22, 0.02, d.y));
        c = mix(c, sunC, disc * cut);
        c += vec3(1.0, 0.45, 0.6) * (pow(s, 40.0) * 0.55 + pow(s, 6.0) * 0.18);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 14), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);

  const clouds = new THREE.Group();
  const cm = new THREE.MeshBasicMaterial({ color: '#ffb4dc', transparent: true, opacity: 0.55, fog: false, depthWrite: false });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(24 + Math.random() * 26, 5 + Math.random() * 4, 14 + Math.random() * 10), cm);
      b.position.set((j - n / 2) * 18 + Math.random() * 6, Math.random() * 4, Math.random() * 8);
      c.add(b);
    }
    const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 230;
    c.position.set(Math.cos(a) * r, 110 + Math.random() * 40, Math.sin(a) * r);
    clouds.add(c);
  }
  scene.add(clouds);
  return {
    update(dt, camPos) {
      dome.position.copy(camPos);
      for (const c of clouds.children) {
        c.position.x += dt * 2.2;
        if (c.position.x > 380) c.position.x = -380;
      }
    },
  };
}

// small procedural environment (sky gradient) so metallic car paint and glass reflect something
export function makeEnvMap(renderer) {
  const es = new THREE.Scene();
  const g = new THREE.SphereGeometry(50, 16, 12);
  const col = [];
  const pos = g.attributes.position;
  const top = new THREE.Color('#6a3fa8'), hor = new THREE.Color(HORIZON), gr = new THREE.Color('#6a4a7c');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 50;
    const c = y >= 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(gr, Math.min(1, -y * 3));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 4, 5) }));
  sunMesh.position.set(25, 15, 45); es.add(sunMesh);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(es, 0.02);
  pm.dispose();
  return rt.texture;
}
