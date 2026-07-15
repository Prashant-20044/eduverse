import { useEffect, useRef, useState } from 'react';

const NUM_PARTICLES = 50;
const MAX_Z = 2;
const MAX_R = 2;
const Z_SPD = 2;

class Particle {
  constructor(x, y, z) {
    this.pos = new Vector(x, y, z);
    this.vel = new Vector(0, 0, -Z_SPD);
    this.vel.scale(0.01);
    this.fill = 'rgba(255,255,255,0.3)';
    this.stroke = this.fill;
  }

  update() {
    this.pos.add(this.vel);
  }

  render(ctx, canvasWidth, canvasHeight) {
    const PIXEL = this.to2d(canvasWidth, canvasHeight),
      X = PIXEL[0],
      Y = PIXEL[1],
      R = ((MAX_Z - this.pos.z) / MAX_Z) * MAX_R;

    if (X < 0 || X > canvasWidth || Y < 0 || Y > canvasHeight || this.pos.z <= 0) {
      this.pos.z = MAX_Z;
    }

    this.update();
    ctx.beginPath();
    ctx.fillStyle = this.fill;
    ctx.strokeStyle = this.stroke;
    ctx.arc(X, Y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
  }

  to2d(w, h) {
    const XO = w / 2,
      YO = h / 2,
      X_COORD = this.pos.x - XO,
      Y_COORD = this.pos.y - YO,
      PX = X_COORD / this.pos.z,
      PY = Y_COORD / this.pos.z;
    return [PX + XO, PY + YO];
  }
}

class Vector {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
  }

  scale(n) {
    this.x *= n;
    this.y *= n;
    this.z *= n;
  }
}

export default function ParticleButton({ children = 'Click Me', onClick, className = '', ...props }) {
  const canvasRef = useRef(null);
  const buttonRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const isActiveRef = useRef(false);
  const particlesRef = useRef([]);
  const animationRef = useRef(null);
  const dimensionsRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const button = buttonRef.current;
    if (!canvas || !button) return undefined;

    let resizeObserver;
    const ctx = canvas.getContext('2d');

    const createParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const X = Math.random() * dimensionsRef.current.w,
          Y = Math.random() * dimensionsRef.current.h,
          Z = Math.random() * MAX_Z;
        particlesRef.current.push(new Particle(X, Y, Z));
      }
    };

    const syncCanvasSize = () => {
      const width = Math.max(1, Math.round(button.offsetWidth));
      const height = Math.max(1, Math.round(button.offsetHeight));

      if (dimensionsRef.current.w === width && dimensionsRef.current.h === height) return;

      dimensionsRef.current = { w: width, h: height };
      canvas.width = width;
      canvas.height = height;
      createParticles();
    };

    const render = () => {
      for (let i = 0; i < particlesRef.current.length; i++) {
        particlesRef.current[i].render(ctx, dimensionsRef.current.w, dimensionsRef.current.h);
      }
    };

    const loop = () => {
      animationRef.current = requestAnimationFrame(loop);
      if (isActiveRef.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(0, 0, dimensionsRef.current.w, dimensionsRef.current.h);
        render();
      } else {
        ctx.clearRect(0, 0, dimensionsRef.current.w, dimensionsRef.current.h);
      }
    };

    syncCanvasSize();

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(syncCanvasSize);
      resizeObserver.observe(button);
    } else {
      window.addEventListener('resize', syncCanvasSize);
    }

    loop();

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncCanvasSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleClick = (e) => {
    setIsActive((active) => !active);
    onClick?.(e);
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      type="button"
      className={`relative inline-flex min-h-[64px] min-w-[220px] items-center justify-center border border-transparent cursor-pointer px-8 py-4 sm:min-h-[78px] sm:min-w-[260px] sm:px-12 sm:py-5 rounded-full overflow-hidden transition-all duration-300 ${
        isActive
          ? 'bg-black border-white'
          : 'bg-white'
      } ${className}`}
      {...props}
    >
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none"
      />
      <span
        className={`relative z-20 inline-flex px-3 py-1 text-lg sm:px-6 sm:text-2xl font-bold uppercase leading-none transition-colors ${
          isActive ? 'text-white' : 'text-black'
        }`}
      >
        {children}
      </span>
    </button>
  );
}
