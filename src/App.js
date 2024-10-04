import React, { Suspense, useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useUpdate, useLoader } from "react-three-fiber";
import { Sky, OrbitControls, StandardEffects } from "drei";
import * as THREE from "three";
import simplex from "simplex-noise";

import grassTexturePath from "./resources/grass.jpg";
import rockTexturePath from "./resources/rock.jpg";

const noise = new simplex(80);
const width = 100;

function height(x, y) {
  return (
    noise.noise2D(x, y) / 5 +
    noise.noise2D(x / 10, y / 10) * 0.8 +
    noise.noise2D(x / 20, y / 20) * 0.2 +
    noise.noise2D(x / 40, y / 40) * 8
  );
}

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  #include <fog_pars_vertex>

  void main() {
    vUv = uv;
    vNormal = normal;
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
    vec3 c = Ca.rgb * amount + Cb.rgb * (1.0 - amount); 
    // float illum = dot(vNormal, vec3(0.0, 1.0, 0.0));
    float illum = 1.0;
    gl_FragColor = vec4(c * illum, 1.0);
    #include <fog_fragment>
  }
`;

function Ground({ patchResol = 256, offsetX = 0, offsetY = 0 }) {
  const [grass, rock] = useLoader(THREE.TextureLoader, [
    grassTexturePath,
    rockTexturePath,
  ]);

  const groundGeo = useMemo(() => {
    const geo = new THREE.PlaneBufferGeometry(
      width,
      width,
      patchResol,
      patchResol
    );
    geo.lookAt(new THREE.Vector3(0, 1, 0));
    for (let i = 0; i < geo.attributes.position.count; i++) {
      const vx = geo.attributes.position.array[i * 3];
      const vz = geo.attributes.position.array[i * 3 + 2];
      geo.attributes.position.array[i * 3 + 1] = height(
        vx + offsetX,
        vz + offsetY
      );
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [patchResol, offsetX, offsetY]);

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

        {/* <StandardEffects bloom={false} /> */}
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
