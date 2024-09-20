import { useEffect, useRef } from 'react';

const BackgroundEffect = () => {
  const ballRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ballX = mouseX;
    let ballY = mouseY;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const animate = () => {
      ballX += (mouseX - ballX) * 0.1;
      ballY += (mouseY - ballY) * 0.1;

      if (ballRef.current) {
        const size = Math.max(window.innerWidth, window.innerHeight) * 0.5; // 50vw equivalent
        ballRef.current.style.transform = `translate3d(${ballX - size / 2}px, ${ballY - size / 2}px, 0)`;
      }

      requestAnimationFrame(animate);
    };

    document.addEventListener('mousemove', handleMouseMove);
    animate();

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    // <>
    //   <div id="ball" ref={ballRef}></div>
    //   <div className="gradient-overlay"></div>
    // </>
    null
  );
};

export default BackgroundEffect;
