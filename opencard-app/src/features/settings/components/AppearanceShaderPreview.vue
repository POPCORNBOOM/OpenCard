<template>
  <canvas ref="canvasRef" class="appearance-shader" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let frameId = 0
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null

const vertexSource = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`

const fragmentSource = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_accent;
uniform vec3 u_base;
uniform vec3 u_surface;
uniform vec3 u_secondary;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.12;
  float warp = noise(p * 1.45 + vec2(t, -t * 0.7));
  float ribbonA = 0.5 + 0.5 * sin(p.x * 2.8 + p.y * 1.4 + warp * 3.2 + t * 2.0);
  float ribbonB = 0.5 + 0.5 * cos(p.x * 1.3 - p.y * 2.4 - warp * 2.6 - t * 1.4);
  float glow = smoothstep(0.25, 0.95, ribbonA * 0.62 + ribbonB * 0.52);
  float grain = (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.035;
  vec3 base = mix(u_base, u_surface, 0.28 + uv.y * 0.22);
  vec3 secondary = mix(u_accent, u_secondary, 0.42);
  float colorWeight = 0.1 + ribbonA * 0.16 + glow * 0.2;
  vec3 color = mix(base, secondary, colorWeight);
  color = mix(color, u_accent, ribbonB * 0.1);
  color += grain;
  gl_FragColor = vec4(color, 1.0);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  gl.deleteShader(shader)
  return null
}

function parseThemeColor(token: string, fallback: [number, number, number]): [number, number, number] {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)
  return match
    ? [Number.parseInt(match[1], 16) / 255, Number.parseInt(match[2], 16) / 255, Number.parseInt(match[3], 16) / 255]
    : fallback
}

onMounted(() => {
  const canvas = canvasRef.value
  if (navigator.userAgent.includes('jsdom')) return
  const gl = canvas?.getContext('webgl', { alpha: false, antialias: false })
  if (!canvas || !gl) return

  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.useProgram(program)
  const position = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const resolution = gl.getUniformLocation(program, 'u_resolution')
  const time = gl.getUniformLocation(program, 'u_time')
  const accent = gl.getUniformLocation(program, 'u_accent')
  const base = gl.getUniformLocation(program, 'u_base')
  const surface = gl.getUniformLocation(program, 'u_surface')
  const secondary = gl.getUniformLocation(program, 'u_secondary')
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  const resize = () => {
    const ratio = Math.min(devicePixelRatio, 2)
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio))
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    }
  }

  const startedAt = performance.now()
  const draw = (now: number) => {
    resize()
    const accentColor = parseThemeColor('--oc-accent', [0.49, 0.42, 1])
    const baseColor = parseThemeColor('--oc-bg-base', [0.07, 0.07, 0.08])
    const surfaceColor = parseThemeColor('--oc-bg-surface', [0.15, 0.15, 0.15])
    const secondaryColor = parseThemeColor('--oc-fg-accent', accentColor)
    gl.uniform2f(resolution, canvas.width, canvas.height)
    gl.uniform1f(time, reducedMotion ? 0 : (now - startedAt) / 1000)
    gl.uniform3fv(accent, accentColor)
    gl.uniform3fv(base, baseColor)
    gl.uniform3fv(surface, surfaceColor)
    gl.uniform3fv(secondary, secondaryColor)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (!reducedMotion) frameId = requestAnimationFrame(draw)
  }

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  themeObserver = new MutationObserver(() => {
    if (reducedMotion) draw(performance.now())
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-oc-theme'] })
  draw(startedAt)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
})
</script>

<style scoped>
.appearance-shader {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--oc-bg-base), var(--oc-bg-accent-subtle));
}
</style>
