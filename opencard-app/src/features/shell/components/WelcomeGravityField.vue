<!-- 业务 欢迎页引力背景：远端生成的球体被中心按平方反比加速度吸进去，形状之间平滑融合。 -->
<template>
  <canvas ref="canvasElement" class="welcome-gravity-field" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { hexToRgba } from '../../../components/standard/colorModel'

defineOptions({ name: 'WelcomeGravityField' })

/** 长度都以画布短边为单位（1.0 = 短边）：投放半径、中心圆半径、球体半径。 */
const FALL_BLOB_COUNT = 16
const SPAWN_RADIUS = 0.62
const CENTER_RADIUS = 0.16
const BLOB_RADIUS = 0.022
/** 贴着中心圆边缘环绕的小球：它们让大圆的边缘一直在涌动。 */
const RIM_BLOB_COUNT = 6
const RIM_BLOB_RADIUS = 0.03
const RIM_ANGULAR_SPEED = 0.14
/** 环绕半径在中心圆两侧来回浮动，边缘才会一进一出地起伏。 */
const RIM_RADIUS_WOBBLE = 0.07
const RIM_WOBBLE_RATE = 0.35
const BLOB_COUNT = FALL_BLOB_COUNT + RIM_BLOB_COUNT
/** 从投放点到完全长出来走过的距离，避免球体在远端突然出现。 */
const GROWTH_DISTANCE = 0.16
/** 进入中心圆后至少走这么远才淡没，避免球体还压着中心圆边缘时突然消失。 */
const FADE_DISTANCE = 0.05
/** 中心质的 GM；加速度 = GM / r²，因此越接近中心下落越快。 */
const GRAVITY = 0.01
/** 每帧最多补算时间与子步长，保证不同帧率下坠落速度一致。 */
const MAX_FRAME_SECONDS = 0.05
const MAX_SUBSTEP_SECONDS = 1 / 240

type Blob = {
  angle: number
  radius: number
  velocity: number
  blobRadius: number
}

/** 边缘环绕的小球不需要积分：角度与半径都由经过的时间直接算出来。 */
type RimBlob = {
  phase: number
  angularSpeed: number
  blobRadius: number
}

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = (edgeSource: string) => `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_short_side;
uniform vec3 u_color;
uniform float u_center_radius;
uniform vec4 u_blobs[${BLOB_COUNT}];
${edgeSource}

void main() {
  vec2 point = (v_uv - 0.5) * u_resolution / u_short_side;
  point.y = -point.y;

  // 中心圆与球体共用同一个场：field 等于 1 的位置正好是形状边缘，
  // 相加之后靠近的形状会平滑连在一起，并最终并进中心圆。
  float field = (u_center_radius * u_center_radius) / max(dot(point, point), 1e-4);
  for (int index = 0; index < ${BLOB_COUNT}; index++) {
    vec4 blob = u_blobs[index];
    vec2 offset = point - blob.xy;
    field += (blob.z * blob.z) / max(dot(offset, offset), 1e-4);
  }

  // 纯背景色实心填充，只在边缘留一丝抗锯齿，不做半透明。
  float alpha = smoothstep(1.0 - edgeWidth(field), 1.0 + edgeWidth(field), field);
  gl_FragColor = vec4(u_color * alpha, alpha);
}
`

/** 小球只有几十像素，用基于屏幕导数的边缘宽度才不会出现锯齿或闪动。 */
const DERIVATIVE_EDGE = `#extension GL_OES_standard_derivatives : enable
float edgeWidth(float field) {
  return max(fwidth(field), 0.0008);
}`
const FALLBACK_EDGE = `float edgeWidth(float field) {
  return 0.05;
}`

const canvasElement = ref<HTMLCanvasElement | null>(null)
let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let positionBuffer: WebGLBuffer | null = null
let uniforms: Record<string, WebGLUniformLocation | null> = {}
const blobData = new Float32Array(BLOB_COUNT * 4)
let blobs: Blob[] = []
let rimBlobs: RimBlob[] = []
let elapsedSeconds = 0
let frameHandle = 0
let previousTime = 0
let documentVisible = true
let reducedMotion = false
let motionQuery: MediaQueryList | null = null
let themeObserver: MutationObserver | null = null

function spawnBlob(angle = Math.random() * Math.PI * 2): Blob {
  return {
    angle,
    // 远端生成、初速为 0，之后完全靠向心引力加速。
    radius: SPAWN_RADIUS * (0.98 + Math.random() * 0.04),
    velocity: 0,
    blobRadius: BLOB_RADIUS * (0.8 + Math.random() * 0.4),
  }
}

/** 从投放点到长满走过的比例，用于淡入。 */
function growthOf(radius: number): number {
  return smoothStep((SPAWN_RADIUS - radius) / GROWTH_DISTANCE)
}

/**
 * 完全没入中心圆的位置：球心到这里时整个球体都在圆内，而且已经淡到 0，
 * 因此回收时看不到任何突变。
 */
function absorbedRadiusOf(blobRadius: number): number {
  return CENTER_RADIUS - Math.max(blobRadius, FADE_DISTANCE)
}

/** 进入中心圆后逐渐淡出，避免球体还压着中心圆边缘时被瞬间抹掉。 */
function fadeOf(radius: number, blobRadius: number): number {
  if (radius >= CENTER_RADIUS) return 1
  const absorbedRadius = absorbedRadiusOf(blobRadius)
  return smoothStep((radius - absorbedRadius) / (CENTER_RADIUS - absorbedRadius))
}

function smoothStep(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return clamped * clamped * (3 - 2 * clamped)
}

function stepBlobs(deltaSeconds: number): void {
  const stepCount = Math.min(8, Math.max(1, Math.ceil(deltaSeconds / MAX_SUBSTEP_SECONDS)))
  const step = deltaSeconds / stepCount
  for (const blob of blobs) {
    for (let index = 0; index < stepCount; index += 1) {
      const distance = Math.max(blob.radius, CENTER_RADIUS * 0.5)
      // 与 r² 成反比的加速度：越靠近中心，下落越快。
      blob.velocity -= (GRAVITY / (distance * distance)) * step
      blob.radius += blob.velocity * step
    }
    // 已经淡到 0 且完全没入中心圆之后才重新投放。
    if (blob.radius <= absorbedRadiusOf(blob.blobRadius)) Object.assign(blob, spawnBlob())
  }
}

/** 边缘环绕的小球均匀铺开，相邻两颗反向绕行，绕行速度各不相同。 */
function createRimBlobs(): RimBlob[] {
  return Array.from({ length: RIM_BLOB_COUNT }, (_, index) => ({
    phase: (index / RIM_BLOB_COUNT) * Math.PI * 2,
    angularSpeed: (index % 2 === 0 ? 1 : -1) * RIM_ANGULAR_SPEED * (0.7 + Math.random() * 0.6),
    blobRadius: RIM_BLOB_RADIUS * (0.8 + Math.random() * 0.5),
  }))
}

function writeBlobData(): void {
  for (const [index, blob] of blobs.entries()) {
    blobData[index * 4] = Math.cos(blob.angle) * blob.radius
    blobData[index * 4 + 1] = Math.sin(blob.angle) * blob.radius
    blobData[index * 4 + 2] = blob.blobRadius * growthOf(blob.radius) * fadeOf(blob.radius, blob.blobRadius)
    blobData[index * 4 + 3] = 0
  }
  // 边缘小球贴着中心圆来回起伏，让大圆的边界一直在涌动。
  for (const [index, rim] of rimBlobs.entries()) {
    const slot = (FALL_BLOB_COUNT + index) * 4
    const angle = rim.phase + elapsedSeconds * rim.angularSpeed
    const radius = CENTER_RADIUS * (1 + RIM_RADIUS_WOBBLE * Math.sin(elapsedSeconds * RIM_WOBBLE_RATE + rim.phase))
    blobData[slot] = Math.cos(angle) * radius
    blobData[slot + 1] = Math.sin(angle) * radius
    blobData[slot + 2] = rim.blobRadius
    blobData[slot + 3] = 0
  }
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

function createProgram(context: WebGLRenderingContext): WebGLProgram | null {
  const vertex = compileShader(context, context.VERTEX_SHADER, VERTEX_SHADER)
  const edge = context.getExtension('OES_standard_derivatives') ? DERIVATIVE_EDGE : FALLBACK_EDGE
  const fragment = compileShader(context, context.FRAGMENT_SHADER, FRAGMENT_SHADER(edge))
  const program = context.createProgram()
  if (!program) return null
  context.attachShader(program, vertex)
  context.attachShader(program, fragment)
  context.linkProgram(program)
  context.deleteShader(vertex)
  context.deleteShader(fragment)
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    context.deleteProgram(program)
    return null
  }
  return program
}

/** 形状填成纯页面底色（或指定的次级背景色），因此读一个主题色即可。 */
function uploadColor(): void {
  if (!gl || !program) return
  // uniform 必须写入当前程序，否则调用会被静默忽略、颜色停在默认值（纯黑）。
  gl.useProgram(program)
  const themed = document.documentElement.style.getPropertyValue('--oc-bg-base').trim()
  const parsed = hexToRgba(themed || '#1e1e1e')
  gl.uniform3fv(
    uniforms.color ?? null,
    parsed
      ? [parsed.red / 255, parsed.green / 255, parsed.blue / 255]
      : [0.12, 0.12, 0.12],
  )
}

function draw(): void {
  const canvas = canvasElement.value
  if (!gl || !program || !canvas) return
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio))
  const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(program)
  gl.uniform2f(uniforms.resolution ?? null, width, height)
  gl.uniform1f(uniforms.shortSide ?? null, Math.min(width, height))
  gl.uniform1f(uniforms.centerRadius ?? null, CENTER_RADIUS)
  gl.uniform4fv(uniforms.blobs ?? null, blobData)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

function start(): void {
  stop()
  if (!documentVisible || reducedMotion) return
  previousTime = 0
  frameHandle = window.requestAnimationFrame(function loop(time) {
    const elapsed = previousTime ? (time - previousTime) / 1000 : 0
    previousTime = time
    const delta = Math.min(MAX_FRAME_SECONDS, Math.max(0, elapsed))
    elapsedSeconds += delta
    stepBlobs(delta)
    writeBlobData()
    draw()
    frameHandle = window.requestAnimationFrame(loop)
  })
}

function stop(): void {
  if (!frameHandle) return
  window.cancelAnimationFrame(frameHandle)
  frameHandle = 0
}

function handleVisibilityChange(): void {
  documentVisible = !document.hidden
  if (documentVisible) start()
  else stop()
}

function handleMotionChange(event: MediaQueryListEvent): void {
  reducedMotion = event.matches
  if (reducedMotion) stop()
  else start()
}

onMounted(() => {
  const canvas = canvasElement.value
  const context = canvas?.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true })
  // 没有 WebGL 时保持透明背景，欢迎页内容照常显示。
  if (!canvas || !context) return

  gl = context
  program = createProgram(context)
  if (!program) {
    gl = null
    return
  }

  positionBuffer = context.createBuffer()
  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer)
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    context.STATIC_DRAW,
  )
  const position = context.getAttribLocation(program, 'a_position')
  context.enableVertexAttribArray(position)
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)
  uniforms = {
    resolution: context.getUniformLocation(program, 'u_resolution'),
    shortSide: context.getUniformLocation(program, 'u_short_side'),
    centerRadius: context.getUniformLocation(program, 'u_center_radius'),
    color: context.getUniformLocation(program, 'u_color'),
    blobs: context.getUniformLocation(program, 'u_blobs[0]'),
  }
  uploadColor()

  blobs = Array.from({ length: FALL_BLOB_COUNT }, () => spawnBlob())
  rimBlobs = createRimBlobs()
  // 初始半径打散，让远处、坠落中、临近中心的球体同时存在。
  for (const [index, blob] of blobs.entries()) {
    blob.radius = SPAWN_RADIUS * (1 - (index + Math.random()) / (FALL_BLOB_COUNT + 1))
  }
  writeBlobData()

  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion = motionQuery.matches
  motionQuery.addEventListener('change', handleMotionChange)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  themeObserver = new MutationObserver(() => {
    uploadColor()
    draw()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-oc-theme'] })

  handleVisibilityChange()
  if (reducedMotion) draw()
})

onBeforeUnmount(() => {
  stop()
  motionQuery?.removeEventListener('change', handleMotionChange)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  themeObserver?.disconnect()
  if (gl && program) gl.deleteProgram(program)
  if (gl && positionBuffer) gl.deleteBuffer(positionBuffer)
  gl = null
  program = null
  positionBuffer = null
})
</script>

<style scoped>
.welcome-gravity-field {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
