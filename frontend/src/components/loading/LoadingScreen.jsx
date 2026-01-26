/**
 * LoadingScreen.jsx
 * 
 * Впечатляющий 3D экран загрузки с вращающимся геометрическим кубом.
 * Использует Three.js для рендеринга 3D-сцены с эффектами свечения.
 */

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, Environment, Stars } from '@react-three/drei';
import * as THREE from 'three';
import './LoadingScreen.css';

/**
 * Внутренние частицы внутри куба
 */
const InnerParticles = () => {
  const particlesRef = useRef();
  const count = 50;
  
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1.5;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.3;
      particlesRef.current.rotation.x = state.clock.elapsedTime * 0.2;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#e879f9"
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
};

/**
 * Светящееся ядро внутри куба
 */
const GlowingCore = () => {
  const coreRef = useRef();
  
  useFrame((state) => {
    if (coreRef.current) {
      const scale = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      coreRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={coreRef}>
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshBasicMaterial color="#c084fc" transparent opacity={0.6} />
    </mesh>
  );
};

/**
 * Основной вращающийся куб с эффектом стекла
 */
const GlassCube = () => {
  const cubeRef = useRef();
  const edgesRef = useRef();

  useFrame((state) => {
    if (cubeRef.current) {
      cubeRef.current.rotation.x = state.clock.elapsedTime * 0.3;
      cubeRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
    if (edgesRef.current) {
      edgesRef.current.rotation.x = state.clock.elapsedTime * 0.3;
      edgesRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <Float
      speed={2}
      rotationIntensity={0.3}
      floatIntensity={0.5}
    >
      <group>
        {/* Прозрачный куб с эффектом преломления */}
        <mesh ref={cubeRef}>
          <boxGeometry args={[2, 2, 2]} />
          <MeshTransmissionMaterial
            backside
            samples={16}
            thickness={0.5}
            chromaticAberration={0.1}
            anisotropy={0.3}
            distortion={0.2}
            distortionScale={0.2}
            temporalDistortion={0.1}
            iridescence={1}
            iridescenceIOR={1.5}
            iridescenceThicknessRange={[100, 400]}
            color="#a855f7"
            transmission={0.95}
            roughness={0.1}
            ior={1.5}
          />
        </mesh>
        
        {/* Светящиеся грани куба */}
        <lineSegments ref={edgesRef}>
          <edgesGeometry args={[new THREE.BoxGeometry(2.02, 2.02, 2.02)]} />
          <lineBasicMaterial color="#e879f9" transparent opacity={0.6} />
        </lineSegments>

        {/* Внутреннее свечение */}
        <GlowingCore />
        
        {/* Частицы внутри */}
        <InnerParticles />
      </group>
    </Float>
  );
};

/**
 * Орбитальные кольца вокруг куба
 */
const OrbitalRings = () => {
  const ring1Ref = useRef();
  const ring2Ref = useRef();

  useFrame((state) => {
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = state.clock.elapsedTime * 0.5;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -state.clock.elapsedTime * 0.3;
      ring2Ref.current.rotation.x = state.clock.elapsedTime * 0.2;
    }
  });

  return (
    <>
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.02, 16, 100]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.4} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[2.8, 0.015, 16, 100]} />
        <meshBasicMaterial color="#d946ef" transparent opacity={0.3} />
      </mesh>
    </>
  );
};

/**
 * 3D Сцена
 */
const Scene = () => {
  return (
    <>
      {/* Окружение и освещение */}
      <Environment preset="night" />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#a855f7" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#06b6d4" />
      
      {/* Звёздное небо на заднем плане */}
      <Stars 
        radius={50} 
        depth={50} 
        count={2000} 
        factor={4} 
        saturation={0.5} 
        fade 
        speed={1}
      />
      
      {/* Основные элементы */}
      <GlassCube />
      <OrbitalRings />
    </>
  );
};

/**
 * Главный компонент экрана загрузки
 */
const LoadingScreen = () => {
  useEffect(() => {
    // Сохраняем текущие стили body
    const originalBackgroundImage = document.body.style.backgroundImage;
    const originalBackgroundColor = document.body.style.backgroundColor;

    // Принудительно убираем фоновое изображение и устанавливаем темный фон
    // Это предотвращает просвечивание старого фона через анимации лоадера
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = '#0c0015';

    // Возвращаем стили при размонтировании
    return () => {
      document.body.style.backgroundImage = originalBackgroundImage;
      document.body.style.backgroundColor = originalBackgroundColor;
    };
  }, []);

  return (
    <div className="loading-screen-3d">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
      
      {/* Наложение с градиентом */}
      <div className="loading-overlay" />
      
      {/* Текст загрузки */}
      <div className="loading-content">
        <p className="loading-text-3d">
          Подключаем ваших персонажей...
        </p>
        <div className="loading-bar">
          <div className="loading-bar-fill" />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
