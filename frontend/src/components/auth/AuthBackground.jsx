import { useEffect, useRef } from "react";

export const AuthBackground = () => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: null, y: null });
  const frameRef = useRef(0);
  const isMobileRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Определяем мобильное устройство
    isMobileRef.current = window.innerWidth < 768;
    
    const ctx = canvas.getContext("2d");
    let particles = [];
    let lastTime = 0;
    
    // Оптимизированные настройки для мобильных
    const PARTICLE_COUNT = isMobileRef.current ? 20 : (window.innerWidth < 768 ? 60 : 120);
    const CONNECTION_DISTANCE = 120;
    const MOUSE_RADIUS = 200;
    const FRAME_SKIP = isMobileRef.current ? 2 : 1; // На мобильных 30fps
    
    const COLORS = [
      { r: 64,  g: 224, b: 208 },
      { r: 139, g: 92,  b: 246 },
      { r: 236, g: 72,  b: 153 },
      { r: 56,  g: 189, b: 248 },
    ];

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Переопределяем мобильность при ресайзе
      isMobileRef.current = window.innerWidth < 768;
      initParticles();
    };

    const handleMouseMove = (event) => {
      mouseRef.current.x = event.x;
      mouseRef.current.y = event.y;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
    };

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.size = Math.random() * 1.5 + 0.5;
        this.baseSize = this.size;
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.alpha = Math.random() * 0.5 + 0.2;
        this.targetAlpha = this.alpha;
        this.pulseSpeed = 0.02;
        this.angle = Math.random() * Math.PI * 2;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;

        // Mouse Interaction (только на десктопе)
        if (!isMobileRef.current && mouseRef.current.x != null) {
          const dx = mouseRef.current.x - this.x;
          const dy = mouseRef.current.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < MOUSE_RADIUS) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS;
            
            this.x -= forceDirectionX * force * 2;
            this.y -= forceDirectionY * force * 2;
            
            this.targetAlpha = 1;
            this.size = this.baseSize * (1 + force * 1.5);
          } else {
            this.targetAlpha = Math.random() * 0.5 + 0.2;
            this.size = this.baseSize;
          }
        }

        this.alpha += (this.targetAlpha - this.alpha) * 0.1;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
        
        // На мобильных убираем shadowBlur для производительности
        if (!isMobileRef.current) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.5)`;
        }
        
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    function initParticles() {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
      }
    }

    function animate(currentTime) {
      // Throttling для мобильных
      if (isMobileRef.current) {
        const elapsed = currentTime - lastTime;
        if (elapsed < 33) { // ~30fps
          frameRef.current = requestAnimationFrame(animate);
          return;
        }
        lastTime = currentTime;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connections (только на десктопе)
      if (!isMobileRef.current) {
        particles.forEach((p1, i) => {
          particles.slice(i + 1).forEach(p2 => {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < CONNECTION_DISTANCE) {
              const opacity = 1 - distance / CONNECTION_DISTANCE;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              
              const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
              gradient.addColorStop(0, `rgba(${p1.color.r}, ${p1.color.g}, ${p1.color.b}, ${opacity * 0.2})`);
              gradient.addColorStop(1, `rgba(${p2.color.r}, ${p2.color.g}, ${p2.color.b}, ${opacity * 0.2})`);
              
              ctx.strokeStyle = gradient;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          });
        });
      }

      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });

      // Mouse Cursor Glow (только на десктопе)
      if (!isMobileRef.current && mouseRef.current.x != null) {
        const gradient = ctx.createRadialGradient(
          mouseRef.current.x, mouseRef.current.y, 0,
          mouseRef.current.x, mouseRef.current.y, 300
        );
        gradient.addColorStop(0, 'rgba(64, 224, 208, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      frameRef.current = requestAnimationFrame(animate);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseout", handleMouseLeave);

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseout", handleMouseLeave);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[var(--bg-primary)]">
      {/* Deep Atmospheric Background */}
      <div className="absolute inset-0">
        {/* Aurora / Nebula Effects - без анимации на мобильных */}
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-violet-900/20 blur-[120px] mix-blend-screen md:animate-blob" />
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-cyan-900/20 blur-[120px] mix-blend-screen md:animate-blob md:animation-delay-2000" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-fuchsia-900/20 blur-[120px] mix-blend-screen md:animate-blob md:animation-delay-4000" />
        
        {/* Subtle Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />
      </div>

      {/* Canvas Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* Cinematic Overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_40%,rgba(10,15,28,0.8)_100%)] pointer-events-none" />
      {/* Inline noise texture - replaces external grainy-gradients.vercel.app dependency for better performance */}
      <div 
        className="absolute inset-0 opacity-20 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px'
        }}
      />

      {/* Premium Glass Frame */}
      <div className="absolute inset-6 hidden sm:block [@media(max-height:600px)]:hidden border border-white/5 rounded-[2rem] pointer-events-none shadow-[inset_0_0_40px_rgba(255,255,255,0.03)]" />
    </div>
  );
};
