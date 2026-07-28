<template>
  <canvas ref="canvasRef" class="appearance-shader" :style="progressStyle" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue'

const props = withDefaults(defineProps<{
  progress?: number
}>(), {
  progress: 1,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const normalizedProgress = computed(() => Math.min(1, Math.max(0, props.progress)))
const progressStyle = computed<CSSProperties>(() => ({
  '--appearance-progress': `${normalizedProgress.value * 100}%`,
  opacity: normalizedProgress.value > 0 ? '1' : '0',
}))
let frameId = 0
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null
let windowResizeHandler: (() => void) | null = null

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

float n21(vec2 p) {
  return fract(sin(p.x * 21.281 + p.y * 93.182) * 5821.92);
}

float lineMask(float x, float length) {
  return smoothstep(0.0, 0.07, x) * (1.0 - smoothstep(length - 0.1, length, x));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 centered = uv * 2.0 - 1.0;
  vec2 offset = abs(centered.yx) / vec2(30.0, 5.2);
  centered += centered * offset * offset;
  uv = centered * 0.5 + 0.5;

  vec2 scale = vec2(
    max(32.0, floor(u_resolution.x / 12.0)),
    max(5.0, floor(u_resolution.y / 7.0))
  );
  vec2 baseGrid = uv * scale;
  float rowId = floor(baseGrid.y);
  float speedNoise = n21(vec2(0.0, rowId));
  float depthNoise = n21(vec2(17.3, rowId));
  float speed = 2.0 + pow(speedNoise, 1.35) * 10.0;
  baseGrid.x -= floor(u_time * speed);

  vec2 localUv = fract(baseGrid);
  vec2 gridId = floor(baseGrid);
  float cellNoise = n21(gridId);
  float blockLength = mix(0.36, 0.94, n21(gridId + vec2(13.7, 4.1)));
  float visibleBlock = step(0.4, cellNoise);
  float rail = smoothstep(0.16, 0.38, localUv.y)
    * (1.0 - smoothstep(0.62, 0.84, localUv.y));
  float block = lineMask(localUv.x, blockLength) * visibleBlock * rail;
  float leadingEdge = lineMask(localUv.x, min(blockLength, 0.16)) * visibleBlock * rail;
  float rowDepth = 0.18 + depthNoise * 0.82;
  float quietRail = rail * 0.025 * rowDepth;

  vec3 base = mix(u_base, u_surface, 0.25 + uv.y * 0.16);
  float accentWeight = quietRail + block * (0.07 + rowDepth * 0.27);
  vec3 color = mix(base, u_accent, accentWeight);
  color = mix(color, u_surface, leadingEdge * (0.04 + rowDepth * 0.11));
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
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  let accentColor: [number, number, number] = [0.49, 0.42, 1]
  let baseColor: [number, number, number] = [0.07, 0.07, 0.08]
  let surfaceColor: [number, number, number] = [0.15, 0.15, 0.15]

  const syncThemeColors = () => {
    accentColor = parseThemeColor('--oc-accent', accentColor)
    baseColor = parseThemeColor('--oc-bg-base', baseColor)
    surfaceColor = parseThemeColor('--oc-bg-surface', surfaceColor)
  }

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
    gl.uniform2f(resolution, canvas.width, canvas.height)
    gl.uniform1f(time, reducedMotion ? 0 : (now - startedAt) / 1000)
    gl.uniform3fv(accent, accentColor)
    gl.uniform3fv(base, baseColor)
    gl.uniform3fv(surface, surfaceColor)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (!reducedMotion) frameId = requestAnimationFrame(draw)
  }

  const resizeAndRedraw = () => {
    resize()
    if (reducedMotion) draw(performance.now())
  }

  syncThemeColors()
  resize()
  resizeObserver = new ResizeObserver(resizeAndRedraw)
  resizeObserver.observe(canvas)
  themeObserver = new MutationObserver(() => {
    syncThemeColors()
    if (reducedMotion) draw(performance.now())
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-oc-theme', 'class', 'style'],
  })
  windowResizeHandler = resizeAndRedraw
  window.addEventListener('resize', windowResizeHandler)
  draw(startedAt)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  if (windowResizeHandler) window.removeEventListener('resize', windowResizeHandler)
})
</script>

<style scoped>
@property --appearance-progress {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 100%;
}

.appearance-shader {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--oc-bg-base), var(--oc-bg-accent-subtle));
  transition: --appearance-progress 180ms linear, opacity 120ms ease;
  -webkit-mask-image:
    linear-gradient(to right, #000 0, #000 calc(var(--appearance-progress, 100%) - 48px), transparent var(--appearance-progress, 100%), transparent 100%),
    linear-gradient(to bottom, #000 0, #000 calc(100% - 2px), transparent 100%);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(to right, #000 0, #000 calc(var(--appearance-progress, 100%) - 48px), transparent var(--appearance-progress, 100%), transparent 100%),
    linear-gradient(to bottom, #000 0, #000 calc(100% - 2px), transparent 100%);
  mask-composite: intersect;
}
</style>
