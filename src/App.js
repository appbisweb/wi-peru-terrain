import React, { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "react-three-fiber";
import { OrbitControls } from "drei";
import * as THREE from "three";
import simplex from "simplex-noise";

import grassTexturePath from "./resources/grass.jpg";
import rockTexturePath from "./resources/rock.jpg";

const noise = new simplex(80);
const width = 100;

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  #include <fog_pars_vertex>

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex> 
  }
`;

const fragmentShader = `
  #ifdef GL_ES
  precision highp float;
  #endif

  uniform sampler2D tOne;
  uniform sampler2D tSec;

  #include <fog_pars_fragment>

  varying vec2 vUv;
  varying vec3 vNormal;

  void main(void) {
    vec2 uv = mod(vUv * 4.0, 1.0);
    float amount = 1.0 - min(1.0, pow((1.0 - abs(vNormal.y)) * 3.0, 4.0));
    vec4 Ca = texture2D(tOne, uv);
    vec4 Cb = texture2D(tSec, uv);
    vec3 c = mix(Ca.rgb, Cb.rgb, amount);

    // Beleuchtungsberechnung
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5)); // Richtung der Lichtquelle
    float diff = max(dot(normalize(vNormal), lightDir), 0.0);
    vec3 diffuse = c * diff;

    gl_FragColor = vec4(diffuse, 1.0);
    #include <fog_fragment>
  }
`;

function Ground({ patchResol = 256, offsetX = 0, offsetY = 0 }) {
  const [grass, rock] = useLoader(THREE.TextureLoader, [
    grassTexturePath,
    rockTexturePath,
  ]);

  const coeff1 = useRef(1.0);
  const coeff2 = useRef(2.0);
  const coeff3 = useRef(8.0);

  // Erstellen der Geometrie nur einmal
  const groundGeo = useMemo(() => {
    const geo = new THREE.PlaneBufferGeometry(
      width,
      width,
      patchResol,
      patchResol
    );
    geo.lookAt(new THREE.Vector3(0, 1, 0));
    return geo;
  }, [patchResol]);

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();
    const t = (elapsedTime % 6) / 6;

    coeff1.current = 1.0 - t * (1.0 - 0.1);
    coeff2.current = 2.0 - t * (2.0 - 0.1);
    coeff3.current = 8.0 - t * (8.0 - 0.1);

    const positions = groundGeo.attributes.position.array;
    for (let i = 0; i < positions.length / 3; i++) {
      const vx = positions[i * 3];
      const vz = positions[i * 3 + 2];
      positions[i * 3 + 1] = height(
        vx + offsetX,
        vz + offsetY,
        coeff1.current,
        coeff2.current,
        coeff3.current
      );
    }
    groundGeo.attributes.position.needsUpdate = true;
    groundGeo.computeVertexNormals();
  });

  function height(x, y, c1 = 1.0, c2 = 2.0, c3 = 8.0) {
    return (
      noise.noise2D(x, y) / 60 +
      noise.noise2D(x / 10, y / 10) * c1 +
      noise.noise2D(x / 20, y / 20) * c2 +
      noise.noise2D(x / 40, y / 40) * c3
    );
  }

  return (
    <mesh geometry={groundGeo} receiveShadow position={[offsetX, 0, offsetY]}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          tOne: { value: grass },
          tSec: { value: rock },
          fogColor: { value: new THREE.Color(0x888888) },
          fogNear: { value: 1 },
          fogFar: { value: 20 },
        }}
        fog={true}
        wireframe={false}
      />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <pointLight position={[0, 10, 0]} castShadow />
      <fog attach="fog" color="#fff" near={1} far={20} />
      <Suspense fallback={null}>
        <Ground offsetX={-0.5 * width} offsetY={-0.5 * width} />
        <Ground offsetX={0.5 * width} offsetY={-0.5 * width} />
        <Ground offsetX={-0.5 * width} offsetY={0.5 * width} />
        <Ground offsetX={0.5 * width} offsetY={0.5 * width} />
      </Suspense>
      <OrbitControls />
    </>
  );
}

export default function App() {
  return (
    <>
      <Canvas
        shadowMap
        colorManagement
        camera={{ far: 500 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
      >
        <Scene />
      </Canvas>
    </>
  );
}
