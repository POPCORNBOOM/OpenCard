<template>
  <span ref="rootElement" class="oc-phase-image">
    <canvas
      ref="canvasElement"
      class="oc-phase-image__canvas"
      :aria-label="props.alt || undefined"
      :aria-hidden="props.alt ? undefined : 'true'"
      :role="props.alt ? 'img' : undefined"
    />
    <img
      v-if="props.placeholderSrc && (!renderReady || renderFailed)"
      class="oc-phase-image__fallback"
      :src="props.placeholderSrc"
      :alt="props.alt"
    />
  </span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

type OcPhaseImageDirection = 'forward' | 'reverse'

interface OcPhaseImageProps {
  src: string
  placeholderSrc?: string
  from?: string
  to?: string
  durationMs?: number
  phaseSpan?: number
  direction?: OcPhaseImageDirection
  playing?: boolean
  alt?: string
}

const props = withDefaults(defineProps<OcPhaseImageProps>(), {
  placeholderSrc: '',
  from: '#5EA8FD',
  to: '#A05DFB',
  durationMs: 10_000,
  phaseSpan: 1,
  direction: 'forward',
  playing: true,
  alt: '',
})

const rootElement = ref<HTMLElement | null>(null)
const canvasElement = ref<HTMLCanvasElement | null>(null)
const renderFailed = ref(false)
const renderReady = ref(false)

let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let positionBuffer: WebGLBuffer | null = null
let phaseTexture: WebGLTexture | null = null
let paletteTexture: WebGLTexture | null = null
let phaseUniform: WebGLUniformLocation | null = null
let phaseSpanUniform: WebGLUniformLocation | null = null
let imageRequestId = 0
let animationFrame = 0
let previousTime = 0
let phase = 0
let textureReady = false
let visible = true
let documentVisible = true
let reducedMotion = false
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let motionQuery: MediaQueryList | null = null

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D u_phase_map;
  uniform sampler2D u_palette;
  uniform float u_phase;
  uniform float u_phase_span;
  varying vec2 v_uv;

  void main() {
    vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
    vec4 phase_map = texture2D(u_phase_map, uv);
    float progress = dot(phase_map.rgb, vec3(0.2126, 0.7152, 0.0722));
    float color_phase = fract(progress * u_phase_span - u_phase);
    vec3 color = texture2D(u_palette, vec2(color_phase, 0.5)).rgb;
    float alpha = smoothstep(0.12, 0.88, phase_map.a);
    gl_FragColor = vec4(color * alpha, alpha);
  }
`

function parseHexColor(value: string): [number, number, number] | null {
  const normalized = value.trim().replace(/^#/, '')
  const expanded = normalized.length === 3
    ? normalized.split('').map(character => character + character).join('')
    : normalized
  if (!/^[\da-f]{6}$/i.test(expanded)) return null
  return [
    Number.parseInt(expanded.slice(0, 2), 16) / 255,
    Number.parseInt(expanded.slice(2, 4), 16) / 255,
    Number.parseInt(expanded.slice(4, 6), 16) / 255,
  ]
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
}

function srgbToOklab(color: [number, number, number]): [number, number, number] {
  const [red, green, blue] = color.map(srgbToLinear)
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)
  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ]
}

function oklabToSrgb(color: [number, number, number]): [number, number, number] {
  const [lightness, a, b] = color
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

function createPalette(from: string, to: string): Uint8Array | null {
  const fromRgb = parseHexColor(from)
  const toRgb = parseHexColor(to)
  if (!fromRgb || !toRgb) return null
  const fromLab = srgbToOklab(fromRgb)
  const toLab = srgbToOklab(toRgb)
  const palette = new Uint8Array(256 * 3)

  for (let index = 0; index < 256; index += 1) {
    const cyclicProgress = index / 255
    const progress = cyclicProgress <= 0.5 ? cyclicProgress * 2 : (1 - cyclicProgress) * 2
    const color = oklabToSrgb([
      fromLab[0] + (toLab[0] - fromLab[0]) * progress,
      fromLab[1] + (toLab[1] - fromLab[1]) * progress,
      fromLab[2] + (toLab[2] - fromLab[2]) * progress,
    ])
    palette[index * 3] = Math.round(color[0] * 255)
    palette[index * 3 + 1] = Math.round(color[1] * 255)
    palette[index * 3 + 2] = Math.round(color[2] * 255)
  }
  return palette
}

function compileShader(context: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = context.createShader(type)
  if (!shader) throw new Error('Unable to create shader')
  context.shaderSource(shader, source)
  context.compileShader(shader)
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    const message = context.getShaderInfoLog(shader) || 'Unable to compile shader'
    context.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function createProgram(context: WebGLRenderingContext): WebGLProgram {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)
  const nextProgram = context.createProgram()
  if (!nextProgram) throw new Error('Unable to create WebGL program')
  context.attachShader(nextProgram, vertexShader)
  context.attachShader(nextProgram, fragmentShader)
  context.linkProgram(nextProgram)
  context.deleteShader(vertexShader)
  context.deleteShader(fragmentShader)
  if (!context.getProgramParameter(nextProgram, context.LINK_STATUS)) {
    const message = context.getProgramInfoLog(nextProgram) || 'Unable to link WebGL program'
    context.deleteProgram(nextProgram)
    throw new Error(message)
  }
  return nextProgram
}

function configureTexture(context: WebGLRenderingContext, texture: WebGLTexture, wrapS: number): void {
  context.bindTexture(context.TEXTURE_2D, texture)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, wrapS)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR)
}

function resolvePowerOfTwoSize(value: number): number {
  return 2 ** Math.floor(Math.log2(Math.max(1, Math.min(value, 2048))))
}

function createMipmappedPhaseSource(image: HTMLImageElement): HTMLCanvasElement {
  const source = document.createElement('canvas')
  source.width = resolvePowerOfTwoSize(image.naturalWidth)
  source.height = resolvePowerOfTwoSize(image.naturalHeight)
  const context = source.getContext('2d')
  if (!context) throw new Error('Unable to create phase-map resampling context')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.clearRect(0, 0, source.width, source.height)
  context.drawImage(image, 0, 0, source.width, source.height)
  return source
}

function initializeRenderer(): boolean {
  const canvas = canvasElement.value
  if (!canvas) return false
  const context = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  })
  if (!context) return false

  try {
    gl = context
    program = createProgram(context)
    context.useProgram(program)

    positionBuffer = context.createBuffer()
    phaseTexture = context.createTexture()
    paletteTexture = context.createTexture()
    if (!positionBuffer || !phaseTexture || !paletteTexture) throw new Error('Unable to allocate WebGL resources')

    context.bindBuffer(context.ARRAY_BUFFER, positionBuffer)
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      context.STATIC_DRAW,
    )
    const position = context.getAttribLocation(program, 'a_position')
    context.enableVertexAttribArray(position)
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)

    const phaseMapUniform = context.getUniformLocation(program, 'u_phase_map')
    const paletteUniform = context.getUniformLocation(program, 'u_palette')
    phaseUniform = context.getUniformLocation(program, 'u_phase')
    phaseSpanUniform = context.getUniformLocation(program, 'u_phase_span')

    context.activeTexture(context.TEXTURE0)
    configureTexture(context, phaseTexture, context.CLAMP_TO_EDGE)
    context.uniform1i(phaseMapUniform, 0)
    context.activeTexture(context.TEXTURE1)
    configureTexture(context, paletteTexture, context.REPEAT)
    context.uniform1i(paletteUniform, 1)
    return true
  } catch (error) {
    console.warn('[OcPhaseImage] WebGL initialization failed.', error)
    disposeRenderer()
    return false
  }
}

function uploadPalette(): boolean {
  if (!gl || !paletteTexture) return false
  const palette = createPalette(props.from, props.to)
  if (!palette) {
    console.warn('[OcPhaseImage] Colors must use #RGB or #RRGGBB format.')
    return false
  }
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, paletteTexture)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 256, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, palette)
  return true
}

function loadPhaseMap(): void {
  if (!gl || !phaseTexture) return
  const requestId = ++imageRequestId
  textureReady = false
  renderReady.value = false
  const image = new Image()
  image.onload = () => {
    if (requestId !== imageRequestId || !gl || !phaseTexture) return
    try {
      const source = createMipmappedPhaseSource(image)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, phaseTexture)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      textureReady = true
      renderFailed.value = false
      requestDraw()
    } catch (error) {
      console.warn('[OcPhaseImage] Phase map upload failed.', error)
      renderFailed.value = true
      textureReady = false
    }
  }
  image.onerror = () => {
    if (requestId !== imageRequestId) return
    renderFailed.value = true
    textureReady = false
  }
  image.crossOrigin = 'anonymous'
  image.src = props.src
}

function resizeCanvas(): void {
  const canvas = canvasElement.value
  if (!canvas || !gl) return
  const bounds = canvas.getBoundingClientRect()
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.round(bounds.width * ratio))
  const height = Math.max(1, Math.round(bounds.height * ratio))
  if (canvas.width === width && canvas.height === height) return
  canvas.width = width
  canvas.height = height
  gl.viewport(0, 0, width, height)
}

function shouldAnimate(): boolean {
  return props.playing && !reducedMotion && visible && documentVisible && textureReady
}

function draw(time: number): void {
  animationFrame = 0
  if (!gl || !program) return
  resizeCanvas()
  const elapsed = previousTime ? Math.min(50, time - previousTime) : 0
  previousTime = time
  if (shouldAnimate()) {
    const duration = Math.max(1, props.durationMs)
    const direction = props.direction === 'forward' ? 1 : -1
    phase = (phase + elapsed / duration * direction) % 1
  }
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  if (textureReady) {
    gl.useProgram(program)
    gl.uniform1f(phaseUniform, phase)
    gl.uniform1f(phaseSpanUniform, Math.max(0.0001, props.phaseSpan))
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    renderReady.value = true
  }
  if (shouldAnimate()) requestDraw()
}

function requestDraw(): void {
  if (animationFrame) return
  animationFrame = requestAnimationFrame(draw)
}

function handleVisibilityChange(): void {
  documentVisible = !document.hidden
  previousTime = 0
  requestDraw()
}

function handleMotionChange(event: MediaQueryListEvent): void {
  reducedMotion = event.matches
  previousTime = 0
  requestDraw()
}

function disposeRenderer(): void {
  imageRequestId += 1
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = 0
  if (gl) {
    if (positionBuffer) gl.deleteBuffer(positionBuffer)
    if (phaseTexture) gl.deleteTexture(phaseTexture)
    if (paletteTexture) gl.deleteTexture(paletteTexture)
    if (program) gl.deleteProgram(program)
  }
  positionBuffer = null
  phaseTexture = null
  paletteTexture = null
  program = null
  gl = null
}

watch(() => props.src, loadPhaseMap)
watch(() => [props.from, props.to], () => {
  if (!uploadPalette()) renderFailed.value = true
  requestDraw()
})
watch(() => [props.playing, props.durationMs, props.phaseSpan, props.direction], () => {
  previousTime = 0
  requestDraw()
})

onMounted(() => {
  documentVisible = !document.hidden
  if (!initializeRenderer() || !uploadPalette()) {
    renderFailed.value = true
    return
  }
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion = motionQuery.matches
  motionQuery.addEventListener('change', handleMotionChange)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  resizeObserver = new ResizeObserver(requestDraw)
  if (rootElement.value) resizeObserver.observe(rootElement.value)
  intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true
    previousTime = 0
    requestDraw()
  })
  if (rootElement.value) intersectionObserver.observe(rootElement.value)
  loadPhaseMap()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  motionQuery?.removeEventListener('change', handleMotionChange)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  disposeRenderer()
})
</script>

<style scoped>
.oc-phase-image {
  position: relative;
  display: inline-block;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 1;
}

.oc-phase-image__canvas,
.oc-phase-image__fallback {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.oc-phase-image__fallback {
  position: absolute;
  inset: 0;
}
</style>
