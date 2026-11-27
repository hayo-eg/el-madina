import * as THREE from 'three';

export const HORIZON = '#d6e8f4';

export function makeSky(scene) {
  const sunDir = new THREE.Vector3(80, 140, 50).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#2f76c8') },
      mid: { value: new THREE.Color('#7fb8ea') },
      hor: { value: new THREE.Color(HORIZON) },
      sun: { value: sunDir },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sun;
      void main(){
        vec3 d = normalize(vP);
        float h = max(d.y, 0.0);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.25, h));
        c = mix(c, top, smoothstep(0.2, 0.9, h));
        float s = max(dot(d, normalize(sun)), 0.0);
        c += vec3(1.0, 0.92, 0.7) * (pow(s, 600.0) * 1.6 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 14), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);

  const clouds = new THREE.Group();
  const cm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, fog: false, depthWrite: false });
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
