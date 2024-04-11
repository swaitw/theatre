import {getProject} from '@theatre/core'
import * as THREE from 'three'
import React, {useState, useEffect, useRef} from 'react'
import {useFrame, Canvas} from '@react-three/fiber'
import {Shadow, softShadows} from '@react-three/drei'
import studio from '@theatre/studio'
import {editable as e, SheetProvider} from '@theatre/r3f'
import extension from '@theatre/r3f/dist/extension'

if (process.env.NODE_ENV === 'development') {
  studio.extend(extension)
  studio.initialize()
}

// Soft shadows are expensive, comment and refresh when it's too slow
softShadows()

// credit: https://codesandbox.io/s/camera-pan-nsb7f

function Button() {
  const vec = new THREE.Vector3()
  const light = useRef(undefined)
  const [active, setActive] = useState(false)
  const [zoom, set] = useState(true)
  useEffect(
    () => void (document.body.style.cursor = active ? 'pointer' : 'auto'),
    [active],
  )

  useFrame((state) => {
    const step = 0.1
    const camera = state.camera
    camera.fov = THREE.MathUtils.lerp(camera.fov, zoom ? 10 : 42, step)
    camera.position.lerp(
      vec.set(zoom ? 25 : 10, zoom ? 1 : 5, zoom ? 0 : 10),
      step,
    )
    state.camera.lookAt(0, 0, 0)
    state.camera.updateProjectionMatrix()

    light.current.position.lerp(
      vec.set(zoom ? 4 : 0, zoom ? 3 : 8, zoom ? 3 : 5),
      step,
    )
  })

  return (
    <e.mesh
      receiveShadow
      castShadow
      onClick={() => set(!zoom)}
      onPointerOver={() => setActive(true)}
      onPointerOut={() => setActive(false)}
      theatreKey="The Button"
    >
      <sphereBufferGeometry args={[0.75, 64, 64]} />
      <meshPhysicalMaterial
        color={active ? 'purple' : '#e7b056'}
        clearcoat={1}
        clearcoatRoughness={0}
      />
      <Shadow
        position-y={-0.79}
        rotation-x={-Math.PI / 2}
        opacity={0.6}
        scale={[0.8, 0.8, 1]}
      />
      <directionalLight
        ref={light}
        castShadow
        intensity={1.5}
        shadow-camera-far={70}
      />
    </e.mesh>
  )
}

function Plane({color, theatreKey, ...props}) {
  return (
    <e.mesh receiveShadow castShadow {...props} theatreKey={theatreKey}>
      <boxBufferGeometry />
      <meshStandardMaterial color={color} />
    </e.mesh>
  )
}

function App() {
  return (
    <div>
      <Canvas
        // @ts-ignore
        shadowMap
        gl={{preserveDrawingBuffer: true}}
        linear
        frameloop="demand"
        dpr={[1.5, 2]}
      >
        <SheetProvider
          sheet={getProject('Playground - R3F').sheet('R3F-Canvas')}
        >
          {/* @ts-ignore */}
          <e.perspectiveCamera makeDefault theatreKey="Camera" />
          <ambientLight intensity={0.4} />
          <e.pointLight
            position={[-10, -10, 5]}
            intensity={2}
            color="#ff20f0"
            theatreKey="Light 1"
          />
          <e.pointLight
            position={[0, 0.5, -1]}
            distance={1}
            intensity={2}
            color="#e4be00"
            theatreKey="Light 2"
          />
          <group position={[0, -0.9, -3]}>
            <Plane
              color="hotpink"
              rotation-x={-Math.PI / 2}
              position-z={2}
              scale={[4, 20, 0.2]}
              theatreKey="plane1"
            />
            <Plane
              color="#e4be00"
              rotation-x={-Math.PI / 2}
              position-y={1}
              scale={[4.2, 0.2, 4]}
              theatreKey="plane2"
            />
            <Plane
              color="#736fbd"
              rotation-x={-Math.PI / 2}
              position={[-1.7, 1, 3.5]}
              scale={[0.5, 4, 4]}
              theatreKey="plane3"
            />
            <Plane
              color="white"
              rotation-x={-Math.PI / 2}
              position={[0, 4.5, 3]}
              scale={[2, 0.03, 4]}
              theatreKey="plane4"
            />
          </group>
          <Button />
        </SheetProvider>
      </Canvas>
    </div>
  )
}

export default App
