/**
 * LoadingScreen.jsx
 * 
 * Впечатляющий 3D экран загрузки с вращающимся геометрическим кубом.
 * Использует Three.js для рендеринга 3D-сцены с эффектами свечения.
 */

import { useRef, useMemo, useEffect, useState } from 'react';
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
      pos[i * 3] = (Math.random() - 0.5) * 0.75;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.75;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.75;
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
        size={0.025}
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
      const scale = 0.15 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      coreRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={coreRef}>
      <sphereGeometry args={[0.15, 32, 32]} />
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
          <boxGeometry args={[1, 1, 1]} />
          <MeshTransmissionMaterial
            backside
            samples={16}
            thickness={0.25}
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
          <edgesGeometry args={[new THREE.BoxGeometry(1.02, 1.02, 1.02)]} />
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
    </>
  );
};

/**
 * Preloader для заранее загрузки 3D ресурсов
 */
const LoadingScreenPreloader = () => {
  const [isPreloaded, setIsPreloaded] = useState(false);
  
  useEffect(() => {
    // Создаем скрытый canvas для предзагрузки ресурсов Three.js
    const preloadCanvas = document.createElement('canvas');
    preloadCanvas.style.position = 'absolute';
    preloadCanvas.style.top = '-1000px';
    preloadCanvas.style.left = '-1000px';
    preloadCanvas.width = 1;
    preloadCanvas.height = 1;
    document.body.appendChild(preloadCanvas);
    
    try {
      // Инициализируем WebGL контекст для предварительной загрузки
      const gl = preloadCanvas.getContext('webgl') || preloadCanvas.getContext('experimental-webgl');
      if (gl) {
        // Создаем базовые шейдеры и программы для прогрева
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, `
          attribute vec3 position;
          void main() {
            gl_Position = vec4(position, 1.0);
          }
        `);
        gl.compileShader(vertexShader);
        
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, `
          void main() {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
          }
        `);
        gl.compileShader(fragmentShader);
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        // Создаем простой буфер для тестирования
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0]), gl.STATIC_DRAW);
        
        console.log('[LoadingScreen] WebGL resources preloaded successfully');
      }
    } catch (error) {
      console.warn('[LoadingScreen] WebGL preloading failed:', error);
    }
    
    // Задержка для полной инициализации контекста и ресурсов
    const timer = setTimeout(() => {
      if (document.body.contains(preloadCanvas)) {
        document.body.removeChild(preloadCanvas);
      }
      setIsPreloaded(true);
      console.log('[LoadingScreen] Preloading complete');
    }, 150); // 150ms для уверенности в полной инициализации
    
    return () => {
      clearTimeout(timer);
      if (document.body.contains(preloadCanvas)) {
        document.body.removeChild(preloadCanvas);
      }
    };
  }, []);
  
  return null; // Этот компонент ничего не рендерит в DOM
};

/**
 * Главный компонент экрана загрузки
 */
const LoadingScreen = ({ isVisible = true }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Эффект для плавного появления после полной загрузки
  useEffect(() => {
    if (isVisible) {
      // Небольшая задержка для уверенности в готовности всех ресурсов
      // Даже при предзагрузке добавляем минимальную задержку для плавности
      const timer = setTimeout(() => {
        setIsLoaded(true);
      }, 30); // 30ms для плавного появления
      
      return () => clearTimeout(timer);
    } else {
      // При скрытии сбрасываем состояние для следующего появления
      setIsLoaded(false);
    }
  }, [isVisible]);
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className="loading-screen-3d">
      {/* 3D Canvas с плавным появлением */}
      <div 
        className="canvas-container"
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 6], fov: 45 }}
          dpr={[1, 2]}
          gl={{ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance" // Оптимизация производительности
          }}
        >
          <Scene />
        </Canvas>
      </div>
      
      {/* Наложение с градиентом */}
      <div className="loading-overlay" />
    </div>
  );
};

// Экспортируем также preloader для использования на уровне приложения
LoadingScreen.Preloader = LoadingScreenPreloader;

export default LoadingScreen;
