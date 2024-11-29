import { useEffect, useRef } from 'react'
import Container from './Container'
import ContentLayout from './ContentLayout'
import Head from './Head'
import { NoticeFooter } from './NoticeFooter'

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ currentX: 0, currentY: 0, targetX: 0, targetY: 0 })
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl')
    if (!gl) {
      console.error('WebGL not supported')
      return
    }

    // Mouse movement smoothing
    const easing = 0.03
    function updateMousePosition() {
      const mouse = mouseRef.current
      let dx = mouse.targetX - mouse.currentX
      let dy = mouse.targetY - mouse.currentY

      mouse.currentX += dx * easing
      mouse.currentY += dy * easing

      animationFrameRef.current = requestAnimationFrame(updateMousePosition)
    }

    // Shader setup
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(
      vertexShader,
      `
      attribute vec2 position;
      void main() {
          gl_Position = vec4(position, 0.0, 1.0);
      }
    `
    )
    gl.compileShader(vertexShader)

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(
      fragmentShader,
      `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform vec2 iMouse;

      #define NUM_LAYERS 8.
      #define TAU 6.28318
      #define PI 3.141592
      #define Velocity .00625
      #define StarGlow 0.015
      #define StarSize 02.
      #define CanvasView 20.

      float Star(vec2 uv, float flare) {
          float d = length(uv);
          float m = sin(StarGlow*1.2)/d;
          
          float rays = max(0., .5-abs(uv.x*uv.y*1000.)) * 0.3;
          m += (rays*flare)*0.5;
          
          m *= smoothstep(1., .2, d);
          return m * 0.7;
      }

      float Hash21(vec2 p) {
          p = fract(p*vec2(123.34, 456.21));
          p += dot(p, p+45.32);
          return fract(p.x*p.y);
      }

      vec3 StarLayer(vec2 uv) {
          vec3 col = vec3(0);
          vec2 gv = fract(uv);
          vec2 id = floor(uv);
          for(int y=-1;y<=1;y++) {
              for(int x=-1; x<=1; x++) {
                  vec2 offs = vec2(x,y);
                  float n = Hash21(id+offs);
                  float size = fract(n);
                  
                  float star = Star(gv-offs-vec2(n, fract(n*34.))+.5, smoothstep(.1,.9,size)*.25);
                  vec3 color = sin(vec3(.2,.3,.9)*fract(n*2345.2)*TAU)*.25+.75;
                  color = color*vec3(.9,.59,.9+size);
                  
                  if (star * size < 0.1) {
                      star *= 0.7;
                  }
                  
                  col += star*size*color;
              }
          }
          return col;
      }

      void main() {
          vec2 fragCoord = gl_FragCoord.xy;
          vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;
          vec2 M = vec2(0);
          M -= vec2(M.x+sin(iTime*0.055), M.y-cos(iTime*0.055));
          
          vec2 smoothMouse = iMouse.xy;
          M += (smoothMouse-iResolution.xy*.5)/iResolution.y * 4.0;
          
          float t = iTime*Velocity; 
          vec3 col = vec3(0);  
          for(float i=0.; i<1.; i+=1./NUM_LAYERS) {
              float depth = fract(i+t);
              float scale = mix(CanvasView, .5, depth);
              float fade = depth*smoothstep(1.,.9,depth);
              col += StarLayer(uv*scale+i*453.2-iTime*.0125+M)*fade;
          }   
          gl_FragColor = vec4(col,1.0);
      }
    `
    )
    gl.compileShader(fragmentShader)

    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(program, 'position')
    const resolutionLocation = gl.getUniformLocation(program, 'iResolution')
    const timeLocation = gl.getUniformLocation(program, 'iTime')
    const mouseLocation = gl.getUniformLocation(program, 'iMouse')

    function resize() {
      if (!gl || !canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    function render(time: number) {
      time *= 0.001

      if (!gl || !canvas) return

      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
      gl.uniform1f(timeLocation, time)
      gl.uniform2f(
        mouseLocation,
        mouseRef.current.currentX,
        mouseRef.current.currentY
      )
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      animationFrameRef.current = requestAnimationFrame(render)
    }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', (e) => {
      mouseRef.current.targetX = e.clientX
      mouseRef.current.targetY = e.clientY
    })

    resize()
    updateMousePosition()
    requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', resize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <section className="fixed inset-0 w-screen h-screen overflow-hidden">
      <Head title="Starfield" />
      <Container>
        <ContentLayout
          header="Starfield"
          headerSize="max(20px, 3vw)"
          description="Interactive starfield visualization"
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="fixed inset-0 w-full h-full">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full mix-blend-multiply"
            />
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}
