import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
export default function Panorama({ url }: { url: string }) {
  const holder = useRef<HTMLDivElement>(null),
    reset = useRef(() => {}),
    [error, setError] = useState(false);
  useEffect(() => {
    const host = holder.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(true);
      return;
    }
    let stopped = false,
      lon = 0,
      lat = 0,
      fov = 75,
      prev = 0;
    const points = new Map<number, [number, number]>();
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 10);
    const scene = new THREE.Scene(),
      geometry = new THREE.SphereGeometry(3, 48, 24),
      material = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    geometry.scale(-1, 1, 1);
    material.side = THREE.FrontSide;
    scene.add(new THREE.Mesh(geometry, material));
    host.appendChild(renderer.domElement);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    function draw() {
      if (stopped || !host) return;
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = fov;
      camera.updateProjectionMatrix();
      const a = THREE.MathUtils.degToRad(lon),
        b = THREE.MathUtils.degToRad(lat);
      camera.lookAt(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a));
      renderer.render(scene, camera);
    }
    const texture = new THREE.TextureLoader().load(
      url,
      (t) => {
        if (stopped) return;
        t.colorSpace = THREE.SRGBColorSpace;
        material.map = t;
        material.needsUpdate = true;
        draw();
      },
      undefined,
      () => {
        if (!stopped) setError(true);
      },
    );
    const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
    const down = (e: PointerEvent) => {
      host.setPointerCapture(e.pointerId);
      points.set(e.pointerId, [e.clientX, e.clientY]);
    };
    const move = (e: PointerEvent) => {
      const last = points.get(e.pointerId);
      if (!last) return;
      points.set(e.pointerId, [e.clientX, e.clientY]);
      const pts = [...points.values()];
      if (pts.length === 2) {
        const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
        if (prev && d) fov = clamp((fov * prev) / d, 30, 100);
        prev = d;
      } else {
        lon -= (e.clientX - last[0]) * 0.24;
        lat = clamp(lat + (e.clientY - last[1]) * 0.24, -85, 85);
      }
      draw();
    };
    const up = (e: PointerEvent) => {
      points.delete(e.pointerId);
      prev = 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      fov = clamp(fov + e.deltaY * 0.045, 30, 100);
      draw();
    };
    reset.current = () => {
      lon = lat = 0;
      fov = 75;
      draw();
    };
    const resize = new ResizeObserver(draw);
    resize.observe(host);
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
    host.addEventListener('wheel', wheel, { passive: false });
    draw();
    return () => {
      stopped = true;
      resize.disconnect();
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', up);
      host.removeEventListener('wheel', wheel);
      texture.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [url]);
  return (
    <>
      {error ? (
        <img src={url} alt="Panorama overview" />
      ) : (
        <div
          ref={holder}
          aria-label="Drag the panorama to look around"
          className="pilot-panorama"
        />
      )}
      <button onClick={() => reset.current()}>Reset view</button>
    </>
  );
}
