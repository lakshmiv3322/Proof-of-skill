import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface CprSkeletonSceneProps {
  isPlaying: boolean;
  traineeBpm?: number;
  traineeDepth?: number;
}

/**
 * Procedural Bone Segment between two 3D points
 */
function Bone({
  start,
  end,
  color,
  radius = 0.022,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  radius?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    if (length < 0.001) return;

    meshRef.current.scale.set(radius, length, radius);
    meshRef.current.position.copy(start).addScaledVector(direction, 0.5);

    // Orient cylinder towards end point (default Three.js cylinder is along Y axis)
    const orientation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    orientation.setFromUnitVectors(up, direction.normalize());
    meshRef.current.quaternion.copy(orientation);
  });

  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[1, 1, 1, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.65}
        roughness={0.2}
        metalness={0.8}
        wireframe={false}
      />
    </mesh>
  );
}

/**
 * Glowing Keypoint Joint Node (BlazePose landmark)
 */
function Joint({
  pos,
  color,
  size = 0.045,
}: {
  pos: THREE.Vector3;
  color: string;
  size?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(pos);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[size, 12, 12]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive={color}
        emissiveIntensity={1.4}
        roughness={0.1}
      />
    </mesh>
  );
}

/**
 * Articulated 3D Humanoid CPR Kinematic Rig
 */
function HumanoidCprRig({
  position,
  color,
  accentColor,
  isPlaying,
  bpm = 110,
  compressionRatio = 1.0,
  phaseOffset = 0,
}: {
  position: [number, number, number];
  color: string;
  accentColor: string;
  isPlaying: boolean;
  bpm?: number;
  compressionRatio?: number;
  phaseOffset?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const rippleRef = useRef<THREE.Mesh>(null);

  // Dynamic landmark positions in local rig space
  const landmarks = useMemo(() => {
    return {
      hips: new THREE.Vector3(0, 0.35, -0.45),
      spineMid: new THREE.Vector3(0, 0.65, -0.3),
      chest: new THREE.Vector3(0, 0.95, -0.15),
      neck: new THREE.Vector3(0, 1.15, -0.1),
      head: new THREE.Vector3(0, 1.35, 0.02),
      leftEar: new THREE.Vector3(-0.14, 1.38, -0.02),
      rightEar: new THREE.Vector3(0.14, 1.38, -0.02),

      leftShoulder: new THREE.Vector3(-0.28, 1.08, -0.12),
      rightShoulder: new THREE.Vector3(0.28, 1.08, -0.12),

      leftElbow: new THREE.Vector3(-0.2, 0.68, 0.05),
      rightElbow: new THREE.Vector3(0.2, 0.68, 0.05),

      leftWrist: new THREE.Vector3(-0.06, 0.28, 0.22),
      rightWrist: new THREE.Vector3(0.06, 0.28, 0.22),
      hands: new THREE.Vector3(0, 0.22, 0.25),

      leftHip: new THREE.Vector3(-0.2, 0.35, -0.45),
      rightHip: new THREE.Vector3(0.2, 0.35, -0.45),

      leftKnee: new THREE.Vector3(-0.24, 0.05, -0.15),
      rightKnee: new THREE.Vector3(0.24, 0.05, -0.15),
    };
  }, []);

  // Update animation loop for CPR compression
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const cprFrequency = (bpm || 110) / 60;
    const rawCycle = isPlaying ? Math.sin((time * cprFrequency * Math.PI * 2) + phaseOffset) : 0.1;
    // Downward sternal compression stroke (half-rectified positive curve)
    const compression = Math.max(0, rawCycle) * compressionRatio;
    const compressY = compression * 0.18; // scaled ~5.4cm

    // Update joint positions based on kinematic forward kinematics
    // Shoulders drive downward directly over locked arms
    landmarks.neck.set(0, 1.15 - compressY * 0.9, -0.1 + compressY * 0.2);
    landmarks.head.set(0, 1.35 - compressY * 0.8, 0.02 + compressY * 0.15);
    landmarks.leftEar.set(-0.14, 1.38 - compressY * 0.8, -0.02 + compressY * 0.15);
    landmarks.rightEar.set(0.14, 1.38 - compressY * 0.8, -0.02 + compressY * 0.15);

    landmarks.leftShoulder.set(-0.28, 1.08 - compressY, -0.12 + compressY * 0.1);
    landmarks.rightShoulder.set(0.28, 1.08 - compressY, -0.12 + compressY * 0.1);

    // Straight locked arms (180 deg) transmit force directly to wrists and hands
    landmarks.leftElbow.set(-0.18, 0.65 - compressY * 0.9, 0.06);
    landmarks.rightElbow.set(0.18, 0.65 - compressY * 0.9, 0.06);

    landmarks.leftWrist.set(-0.05, 0.24 - compressY * 0.85, 0.22);
    landmarks.rightWrist.set(0.05, 0.24 - compressY * 0.85, 0.22);
    landmarks.hands.set(0, 0.18 - compressY * 0.85, 0.25);

    // Spine flexes slightly from stable hips
    landmarks.chest.set(0, 0.92 - compressY * 0.95, -0.16 + compressY * 0.15);
    landmarks.spineMid.set(0, 0.65 - compressY * 0.5, -0.3 + compressY * 0.1);

    // Compression contact pad ripple effect
    if (rippleRef.current) {
      const scale = 1 + compression * 1.5;
      rippleRef.current.scale.set(scale, scale, 1);
      const mat = rippleRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = compression > 0.1 ? compression * 0.6 : 0.05;
      }
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Patient mannequin chest base */}
      <mesh position={[0, 0.06, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.55, 0.4, 0.1]} />
        <meshStandardMaterial color="#0b1329" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Sternal target ring & compression wave */}
      <mesh position={[0, 0.115, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.08, 24]} />
        <meshBasicMaterial color={accentColor} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={rippleRef} position={[0, 0.118, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.11, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Kneeling Mat */}
      <mesh position={[0, 0.01, -0.28]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 0.7]} />
        <meshStandardMaterial color="#090d1a" roughness={0.9} />
      </mesh>

      {/* Keypoint Joints (33 BlazePose Nodes) */}
      <Joint pos={landmarks.head} color={color} size={0.06} />
      <Joint pos={landmarks.leftEar} color={color} size={0.03} />
      <Joint pos={landmarks.rightEar} color={color} size={0.03} />
      <Joint pos={landmarks.neck} color={color} size={0.038} />

      <Joint pos={landmarks.leftShoulder} color={color} size={0.045} />
      <Joint pos={landmarks.rightShoulder} color={color} size={0.045} />
      <Joint pos={landmarks.leftElbow} color={color} size={0.04} />
      <Joint pos={landmarks.rightElbow} color={color} size={0.04} />
      <Joint pos={landmarks.leftWrist} color={color} size={0.035} />
      <Joint pos={landmarks.rightWrist} color={color} size={0.035} />
      <Joint pos={landmarks.hands} color={accentColor} size={0.055} />

      <Joint pos={landmarks.chest} color={color} size={0.04} />
      <Joint pos={landmarks.spineMid} color={color} size={0.038} />
      <Joint pos={landmarks.hips} color={color} size={0.045} />
      <Joint pos={landmarks.leftHip} color={color} size={0.04} />
      <Joint pos={landmarks.rightHip} color={color} size={0.04} />
      <Joint pos={landmarks.leftKnee} color={color} size={0.042} />
      <Joint pos={landmarks.rightKnee} color={color} size={0.042} />

      {/* Bones (Skeletal Wireframe Links) */}
      <Bone start={landmarks.head} end={landmarks.neck} color={color} />
      <Bone start={landmarks.neck} end={landmarks.leftShoulder} color={color} />
      <Bone start={landmarks.neck} end={landmarks.rightShoulder} color={color} />

      <Bone start={landmarks.leftShoulder} end={landmarks.leftElbow} color={color} />
      <Bone start={landmarks.leftElbow} end={landmarks.leftWrist} color={color} />
      <Bone start={landmarks.leftWrist} end={landmarks.hands} color={color} />

      <Bone start={landmarks.rightShoulder} end={landmarks.rightElbow} color={color} />
      <Bone start={landmarks.rightElbow} end={landmarks.rightWrist} color={color} />
      <Bone start={landmarks.rightWrist} end={landmarks.hands} color={color} />

      <Bone start={landmarks.neck} end={landmarks.chest} color={color} />
      <Bone start={landmarks.chest} end={landmarks.spineMid} color={color} />
      <Bone start={landmarks.spineMid} end={landmarks.hips} color={color} />

      <Bone start={landmarks.hips} end={landmarks.leftHip} color={color} />
      <Bone start={landmarks.hips} end={landmarks.rightHip} color={color} />

      <Bone start={landmarks.leftHip} end={landmarks.leftKnee} color={color} />
      <Bone start={landmarks.rightHip} end={landmarks.rightKnee} color={color} />
    </group>
  );
}

/**
 * Central Optical Comparator Laser Divider in 3D
 */
function LaserDivider() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const pulse = 0.35 + Math.sin(clock.getElapsedTime() * 4) * 0.15;
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = pulse;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.75, 0]}>
      <planeGeometry args={[0.015, 2.0]} />
      <meshBasicMaterial
        color="#00f0ff"
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Floor Grid & Soft Ambient Shadow Field
 */
function GroundPlane() {
  return (
    <group position={[0, -0.01, 0]}>
      {/* Subtle floor grid */}
      <gridHelper
        args={[8, 24, '#1e293b', '#0f172a']}
        position={[0, 0, 0]}
      />
      {/* Radial fade shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[0, 3.5, 32]} />
        <meshBasicMaterial
          color="#05070e"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Master 3D CPR Kinematic Comparator Scene
 */
export function CprSkeletonScene({
  isPlaying,
  traineeBpm = 108.4,
  traineeDepth = 5.4,
}: CprSkeletonSceneProps) {
  const depthFactor = traineeDepth / 5.5;

  return (
    <div className="relative w-full h-full select-none" style={{ pointerEvents: 'auto' }}>
      <Canvas
        camera={{ position: [0, 1.25, 3.4], fov: 42 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        {/* Soft Ambient & Rim Lighting */}
        <ambientLight intensity={0.65} color="#0f172a" />
        <directionalLight
          position={[-2.5, 3.5, 2.5]}
          intensity={1.4}
          color="#00f0ff"
        />
        <pointLight
          position={[2.8, 2.2, -1.8]}
          intensity={2.2}
          color="#c084fc"
        />
        <pointLight
          position={[0, 0.5, 1.5]}
          intensity={0.8}
          color="#38bdf8"
        />

        {/* Optical Comparator: Trainee (Left, Cyan) vs Exemplar (Right, Violet) */}
        <HumanoidCprRig
          position={[-1.25, 0, 0]}
          color="#00f0ff"
          accentColor="#38bdf8"
          isPlaying={isPlaying}
          bpm={traineeBpm}
          compressionRatio={depthFactor}
          phaseOffset={0}
        />

        <LaserDivider />

        <HumanoidCprRig
          position={[1.25, 0, 0]}
          color="#c084fc"
          accentColor="#f59e0b"
          isPlaying={isPlaying}
          compressionRatio={1.0}
          phaseOffset={0.06} // Subtle natural DTW alignment difference
        />

        <GroundPlane />

        {/* Orbit Controls with strictly bounded rotation and no zoom-out */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          dampingFactor={0.06}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          minPolarAngle={Math.PI / 3.8}
          maxPolarAngle={Math.PI / 2.15}
        />
      </Canvas>
    </div>
  );
}

export default CprSkeletonScene;
