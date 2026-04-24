<template>
  <div class="showcase-example-case" v-if="exampleId === 'foundation-theme-tokens'">
    <template v-if="column === 'default'">
      <div class="token-swatch token-swatch--base">bg-base</div>
      <div class="token-swatch token-swatch--panel">bg-panel</div>
      <div class="token-swatch token-swatch--text">text-primary</div>
    </template>
    <template v-else-if="column === 'variants'">
      <div class="token-swatch token-swatch--accent">accent</div>
      <div class="token-swatch token-swatch--accent-soft">accent-soft</div>
      <div class="token-swatch token-swatch--highlight">text-highlight</div>
    </template>
    <template v-else-if="column === 'states'">
      <div class="token-swatch token-swatch--success">success</div>
      <div class="token-swatch token-swatch--warning">warning</div>
      <div class="token-swatch token-swatch--danger">danger</div>
    </template>
    <template v-else>
      <OcSurface variant="elevated" bordered radius="md" class="token-layout-box">
        <OcText tone="secondary" size="label">Surface + Border + Radius</OcText>
      </OcSurface>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'foundation-typography-scale'">
    <template v-if="column === 'default'">
      <OcText size="label" tone="muted">Label / 11px</OcText>
      <OcText size="body" tone="primary">Body / 12px</OcText>
      <OcText size="title" tone="primary">Title / 13px</OcText>
    </template>
    <template v-else-if="column === 'variants'">
      <OcText size="body" tone="primary">Primary</OcText>
      <OcText size="body" tone="secondary">Secondary</OcText>
      <OcText size="body" tone="info">Info</OcText>
    </template>
    <template v-else-if="column === 'states'">
      <OcText size="body" tone="muted">Muted text</OcText>
      <OcText size="body" tone="label">Label tone</OcText>
      <OcText size="body" tone="secondary" truncate class="truncate-box">Long text for truncate preview in UI kit
        matrix.</OcText>
    </template>
    <template v-else>
      <OcBox stack class="demo-stack">
        <OcText size="label" tone="muted">Section Label</OcText>
        <OcText size="title" tone="primary">Card Heading</OcText>
        <OcText size="body" tone="secondary">Support line with stable reading density.</OcText>
      </OcBox>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'foundation-radius-shadow'">
    <template v-if="column === 'default'">
      <OcSurface variant="panel" bordered radius="sm" class="shape-box">sm</OcSurface>
      <OcSurface variant="panel" bordered radius="md" class="shape-box">md</OcSurface>
      <OcSurface variant="panel" bordered radius="lg" class="shape-box">lg</OcSurface>
    </template>
    <template v-else-if="column === 'variants'">
      <OcSurface variant="elevated" bordered radius="md" shadow="sm" class="shape-box">shadow-sm</OcSurface>
      <OcSurface variant="elevated" bordered radius="md" shadow="md" class="shape-box">shadow-md</OcSurface>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="input" bordered radius="md" class="shape-box">input</OcSurface>
      <OcSurface variant="floating" bordered radius="md" class="shape-box">floating</OcSurface>
    </template>
    <template v-else>
      <OcBox class="shadow-layout">
        <OcSurface variant="panel" bordered radius="md" class="shadow-layout__top">Layer 1</OcSurface>
        <OcSurface variant="elevated" bordered radius="md" shadow="sm" class="shadow-layout__bottom">Layer 2</OcSurface>
      </OcBox>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'foundation-spacing-motion'">
    <template v-if="column === 'default'">
      <div class="spacing-stack">
        <div class="spacing-sample">
          <span>space-1</span>
          <div class="spacing-bar spacing-bar--1" />
        </div>
        <div class="spacing-sample">
          <span>space-3</span>
          <div class="spacing-bar spacing-bar--3" />
        </div>
        <div class="spacing-sample">
          <span>space-6</span>
          <div class="spacing-bar spacing-bar--6" />
        </div>
      </div>
    </template>
    <template v-else-if="column === 'variants'">
      <OcText size="label">label / --oc-label-size</OcText>
      <OcText size="body">body / --oc-body-size</OcText>
      <OcText size="title">title / --oc-title-size</OcText>
      <OcText class="font-token-sample font-token-sample--heading">heading / --oc-heading-size</OcText>
      <OcText class="font-token-sample font-token-sample--display">display / --oc-display-size</OcText>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="panel" bordered class="motion-token-chip">fast 120ms</OcSurface>
      <OcSurface variant="panel" bordered class="motion-token-chip">base 160ms</OcSurface>
      <OcSurface variant="panel" bordered class="motion-token-chip">slow 220ms</OcSurface>
    </template>
    <template v-else>
      <div class="motion-demo-row">
        <OcPressable variant="secondary" class="motion-demo-tile">hover me</OcPressable>
        <OcPressable variant="primary" class="motion-demo-tile">focus me</OcPressable>
      </div>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'primitive-oc-box'">
    <template v-if="column === 'default'">
      <OcBox class="demo-box">Box</OcBox>
    </template>
    <template v-else-if="column === 'variants'">
      <OcBox inline class="demo-box">inline</OcBox>
      <OcBox stack class="demo-box">stack</OcBox>
    </template>
    <template v-else-if="column === 'states'">
      <OcBox stack class="demo-box">
        <OcText size="label">stateless primitive</OcText>
      </OcBox>
    </template>
    <template v-else>
      <OcBox inline class="demo-row">
        <OcBox class="demo-box demo-box--grow">grow</OcBox>
        <OcBox class="demo-box">fixed</OcBox>
      </OcBox>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'primitive-oc-text'">
    <template v-if="column === 'default'">
      <OcText>Default text</OcText>
    </template>
    <template v-else-if="column === 'variants'">
      <OcText tone="secondary">Secondary</OcText>
      <OcText tone="muted">Muted</OcText>
      <OcText tone="info">Info</OcText>
    </template>
    <template v-else-if="column === 'states'">
      <OcText tone="label">Label style</OcText>
    </template>
    <template v-else>
      <OcText truncate class="truncate-box">This is a long line to verify truncation behavior in the layout cell.
      </OcText>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'primitive-oc-surface'">
    <template v-if="column === 'default'">
      <OcSurface variant="panel" bordered class="surface-sample">panel</OcSurface>
    </template>
    <template v-else-if="column === 'variants'">
      <OcSurface variant="elevated" bordered class="surface-sample">elevated</OcSurface>
      <OcSurface variant="input" bordered class="surface-sample">input</OcSurface>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="floating" bordered shadow="md" class="surface-sample">floating</OcSurface>
    </template>
    <template v-else>
      <OcSurface variant="panel" bordered class="surface-stack">
        <OcText size="label" tone="muted">title</OcText>
        <OcText size="body">body content</OcText>
      </OcSurface>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'primitive-oc-pressable'">
    <template v-if="column === 'default'">
      <OcPressable>Default</OcPressable>
    </template>
    <template v-else-if="column === 'variants'">
      <OcPressable variant="primary">Primary</OcPressable>
      <OcPressable variant="ghost">Ghost</OcPressable>
      <OcPressable variant="choice">Choice</OcPressable>
    </template>
    <template v-else-if="column === 'states'">
      <OcPressable variant="icon" icon-only active>
        <OcIcon name="icon.star-full" />
      </OcPressable>
      <OcPressable disabled>Disabled</OcPressable>
    </template>
    <template v-else>
      <OcPressable block>Block Action</OcPressable>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'primitive-oc-focus-ring'">
    <template v-if="column === 'default'">
      <OcFocusRing class="focus-shell">
        <OcButton variant="secondary">Tab Focus</OcButton>
      </OcFocusRing>
    </template>
    <template v-else-if="column === 'variants'">
      <OcFocusRing class="focus-shell">
        <OcPressable variant="primary">Action</OcPressable>
      </OcFocusRing>
    </template>
    <template v-else-if="column === 'states'">
      <OcFocusRing class="focus-shell">
        <OcFieldCore as="input" value="focus me" />
      </OcFocusRing>
    </template>
    <template v-else>
      <OcFocusRing class="focus-shell focus-shell--block">
        <OcPressable block>Row Focus Region</OcPressable>
      </OcFocusRing>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'primitive-oc-field-core'">
    <template v-if="column === 'default'">
      <OcFieldCore as="input" value="OpenCard Field 字体预览 123" />
    </template>
    <template v-else-if="column === 'variants'">
      <OcFieldCore as="select">
        <option selected>Option A</option>
        <option>Option B</option>
      </OcFieldCore>
    </template>
    <template v-else-if="column === 'states'">
      <OcFieldCore as="textarea" rows="2">Multi script: OpenCard 字段文本</OcFieldCore>
    </template>
    <template v-else>
      <OcBox stack class="demo-stack">
        <OcFieldCore as="input" value="first field" />
        <OcFieldCore as="input" value="second field" />
      </OcBox>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'primitive-oc-scroll-area'">
    <template v-if="column === 'default'">
      <OcSurface variant="elevated" bordered class="scroll-shell">
        <OcScrollArea axis="y" class="scroll-area">
          <OcText v-for="line in scrollLines" :key="`y-${line}`" tone="secondary">Line {{ line }}</OcText>
        </OcScrollArea>
      </OcSurface>
    </template>
    <template v-else-if="column === 'variants'">
      <OcSurface variant="elevated" bordered class="scroll-shell">
        <OcScrollArea axis="x" class="scroll-area scroll-area--x">
          <OcBox inline class="scroll-row">
            <OcSurface v-for="line in 6" :key="`x-${line}`" variant="panel" bordered class="scroll-chip">Item {{ line }}
            </OcSurface>
          </OcBox>
        </OcScrollArea>
      </OcSurface>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="panel" bordered class="scroll-shell">
        <OcText tone="muted" size="label">No state variant</OcText>
      </OcSurface>
    </template>
    <template v-else>
      <OcSurface variant="elevated" bordered class="scroll-shell scroll-shell--layout">
        <OcScrollArea axis="both" class="scroll-area">
          <div class="scroll-big-plane" />
        </OcScrollArea>
      </OcSurface>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'primitive-oc-icon'">
    <template v-if="column === 'default'">
      <OcIcon name="icon.symbol-color" />
    </template>
    <template v-else-if="column === 'variants'">
      <OcIcon name="icon.folder" tone="folder-default" />
      <OcIcon name="icon.folder-opened" tone="folder-open" />
      <OcIcon name="icon.warning" tone="warning" />
    </template>
    <template v-else-if="column === 'states'">
      <OcIcon name="icon.error" tone="danger" size="lg" />
      <OcIcon name="icon.check" tone="success" size="lg" />
    </template>
    <template v-else>
      <OcBox inline class="demo-row">
        <OcIcon name="icon.file-code" tone="typescript" />
        <OcText tone="secondary">src/main.ts</OcText>
      </OcBox>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-button'">
    <template v-if="column === 'default'">
      <OcButton variant="secondary">Button</OcButton>
    </template>
    <template v-else-if="column === 'variants'">
      <OcButton variant="primary">Primary</OcButton>
      <OcButton variant="ghost">Ghost</OcButton>
      <OcButton variant="choice">Choice</OcButton>
    </template>
    <template v-else-if="column === 'states'">
      <OcButton variant="icon" icon="icon.settings-gear" icon-only :active="true" />
      <OcButton disabled>Disabled</OcButton>
    </template>
    <template v-else>
      <OcButton block variant="primary">Block Action</OcButton>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-bar'">
    <template v-if="column === 'default'">
      <OcSurface variant="panel" bordered radius="md" class="bar-demo-shell">
        <OcBar kind="top" border="bottom">
          <template #start>
            <OcText size="title">OpenCard</OcText>
          </template>
          <OcText tone="secondary">Main Menu</OcText>
          <template #end>
            <OcChip tone="info">Ready</OcChip>
          </template>
        </OcBar>
      </OcSurface>
    </template>
    <template v-else-if="column === 'variants'">
      <OcSurface variant="panel" bordered radius="md" class="bar-demo-shell">
        <OcBar kind="status" border="top">
          <template #start>
            <OcChip>project.opencard</OcChip>
          </template>
          <template #end>
            <OcChip tone="info">Watching</OcChip>
          </template>
        </OcBar>
      </OcSurface>
      <OcSurface variant="panel" bordered radius="md" class="bar-demo-shell">
        <OcBar kind="section" border="bottom" spacing="compact" inset="compact">
          <OcText size="label" tone="muted">Section Header</OcText>
        </OcBar>
      </OcSurface>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="panel" bordered radius="md" class="bar-demo-shell">
        <OcBar kind="section" border="bottom">
          <template #start>
            <OcText size="label" tone="muted">Category</OcText>
          </template>
          <template #end>
            <OcButton variant="icon" icon="icon.add" icon-only />
          </template>
        </OcBar>
      </OcSurface>
    </template>
    <template v-else>
      <OcSurface variant="panel" bordered radius="md" class="bar-demo-shell">
        <OcBar kind="top" border="bottom">
          <template #start>
            <OcText size="title">Left</OcText>
          </template>
          <OcText tone="secondary">Center grows</OcText>
          <template #end>
            <OcToolButton kind="menu" label="Action" />
          </template>
        </OcBar>
      </OcSurface>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-chip'">
    <template v-if="column === 'default'">
      <OcChip>Default Chip</OcChip>
    </template>
    <template v-else-if="column === 'variants'">
      <OcChip size="sm">size-sm</OcChip>
      <OcChip size="md">size-md</OcChip>
      <OcChip tone="info">tone-info</OcChip>
    </template>
    <template v-else-if="column === 'states'">
      <OcChip truncate>Long chip value for truncation preview</OcChip>
    </template>
    <template v-else>
      <OcBox inline class="chip-demo-row">
        <OcChip>Deck A</OcChip>
        <OcChip>Deck B</OcChip>
        <OcChip tone="info">Synced</OcChip>
      </OcBox>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-empty-hint'">
    <template v-if="column === 'default'">
      <OcSurface variant="panel" bordered radius="md" class="empty-hint-shell">
        <OcEmptyHint>No selection.</OcEmptyHint>
      </OcSurface>
    </template>
    <template v-else-if="column === 'variants'">
      <OcSurface variant="panel" bordered radius="md" class="empty-hint-shell">
        <OcEmptyHint tone="muted" size="label">No files loaded.</OcEmptyHint>
      </OcSurface>
      <OcSurface variant="panel" bordered radius="md" class="empty-hint-shell">
        <OcEmptyHint tone="dim" size="body">Open a project to continue.</OcEmptyHint>
      </OcSurface>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="panel" bordered radius="md" class="empty-hint-shell">
        <OcEmptyHint align="start" inset="compact">Hint aligned to start.</OcEmptyHint>
      </OcSurface>
    </template>
    <template v-else>
      <OcSurface variant="panel" bordered radius="md" class="empty-hint-shell">
        <OcEmptyHint align="center" inset="comfortable">Use this in side panels and editors.</OcEmptyHint>
      </OcSurface>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-overlay'">
    <template v-if="column === 'default'">
      <OcOverlay class="overlay-demo-shell">
        <OcSurface variant="panel" bordered radius="md" class="overlay-demo-base">
          <OcText tone="secondary">Canvas Content</OcText>
        </OcSurface>
        <template #overlay>
          <OcSurface variant="transparent" radius="lg" shadow="overlay"
            class="overlay-demo-float ui-floating-shell ui-floating-shell--padding-sm">
            <OcText size="label">Overlay Layer</OcText>
          </OcSurface>
        </template>
      </OcOverlay>
    </template>
    <template v-else-if="column === 'variants'">
      <OcOverlay class="overlay-demo-shell" :visible="false">
        <OcSurface variant="panel" bordered radius="md" class="overlay-demo-base">
          <OcText tone="secondary">visible=false</OcText>
        </OcSurface>
        <template #overlay>
          <OcSurface variant="transparent" radius="lg" shadow="overlay"
            class="overlay-demo-float ui-floating-shell ui-floating-shell--padding-sm">
            <OcText size="label">Hidden Overlay</OcText>
          </OcSurface>
        </template>
      </OcOverlay>
      <OcOverlay class="overlay-demo-shell" :interactive="false" inset="var(--oc-space-2)">
        <OcSurface variant="panel" bordered radius="md" class="overlay-demo-base">
          <OcText tone="secondary">interactive=false</OcText>
        </OcSurface>
        <template #overlay>
          <OcSurface variant="transparent" radius="lg" shadow="overlay"
            class="overlay-demo-float ui-floating-shell ui-floating-shell--padding-sm">
            <OcText size="label">Click-through Overlay</OcText>
          </OcSurface>
        </template>
      </OcOverlay>
    </template>
    <template v-else-if="column === 'states'">
      <OcOverlay class="overlay-demo-shell" inset="var(--oc-space-2) var(--oc-space-3)">
        <OcSurface variant="panel" bordered radius="md" class="overlay-demo-base">
          <OcText tone="secondary">Inset space-2 / space-3</OcText>
        </OcSurface>
        <template #overlay>
          <OcSurface variant="floating" bordered radius="md" class="overlay-demo-chip">
            <OcText size="label">Overlay Inset</OcText>
          </OcSurface>
        </template>
      </OcOverlay>
    </template>
    <template v-else>
      <OcOverlay class="overlay-demo-shell">
        <OcSurface variant="elevated" bordered radius="md" class="overlay-demo-layout">
          <OcText size="title">Workspace</OcText>
          <OcText tone="secondary">Base keeps structure, overlay adds tools.</OcText>
        </OcSurface>
        <template #overlay>
          <OcAxisLayout axis="vertical" :regions="overlayLayoutRegions" class="overlay-demo-overlay-layout">
            <template #top-tools>
              <OcSurface variant="transparent" radius="lg" shadow="overlay"
                class="overlay-demo-float ui-floating-shell ui-floating-shell--padding-sm">
                <OcText size="label">Top Tool</OcText>
              </OcSurface>
            </template>
            <template #overlay-spacer>
              <div class="overlay-demo-spacer" />
            </template>
            <template #bottom-info>
              <OcSurface variant="floating" bordered radius="md" class="overlay-demo-chip">
                <OcText size="label">Bottom Info</OcText>
              </OcSurface>
            </template>
          </OcAxisLayout>
        </template>
      </OcOverlay>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-axis-layout'">
    <template v-if="column === 'default'">
      <OcAxisLayout axis="horizontal" :regions="axisHorizontalRegions" class="axis-demo-horizontal">
        <template #leftRail>
          <OcSurface variant="panel" bordered class="axis-demo-pane axis-demo-pane--left">Left</OcSurface>
        </template>
        <template #centerStage>
          <OcSurface variant="elevated" bordered class="axis-demo-pane axis-demo-pane--center">Center</OcSurface>
        </template>
        <template #rightInspector>
          <OcSurface variant="panel" bordered class="axis-demo-pane axis-demo-pane--right">Right</OcSurface>
        </template>
      </OcAxisLayout>
    </template>
    <template v-else-if="column === 'variants'">
      <OcAxisLayout axis="vertical" :regions="axisVerticalRegions" class="axis-demo-vertical">
        <template #topBar>
          <OcSurface variant="panel" bordered class="axis-demo-pane axis-demo-pane--top">Top</OcSurface>
        </template>
        <template #centerContent>
          <OcSurface variant="elevated" bordered class="axis-demo-pane axis-demo-pane--center">Center</OcSurface>
        </template>
        <template #bottomInfo>
          <OcSurface variant="panel" bordered class="axis-demo-pane axis-demo-pane--bottom">Bottom</OcSurface>
        </template>
      </OcAxisLayout>
    </template>
    <template v-else-if="column === 'states'">
      <OcAxisLayout axis="horizontal" :regions="axisStatesRegions" class="axis-demo-horizontal">
        <template #leftTools>
          <OcSurface variant="panel" bordered class="axis-demo-pane axis-demo-pane--left">72px</OcSurface>
        </template>
        <template #leftNav>
          <OcSurface variant="panel" bordered class="axis-demo-pane axis-demo-pane--left">96px</OcSurface>
        </template>
        <template #centerMain>
          <OcSurface variant="elevated" bordered class="axis-demo-pane axis-demo-pane--center">track=fill</OcSurface>
        </template>
      </OcAxisLayout>
    </template>
    <template v-else>
      <OcAxisLayout axis="horizontal" :regions="axisLayoutRegions" class="axis-demo-layout">
        <template #leftActivity>
          <OcSurface variant="panel" bordered class="axis-demo-pane axis-demo-pane--left">size-sm</OcSurface>
        </template>
        <template #leftExplorer>
          <OcSurface variant="panel" bordered class="axis-demo-pane axis-demo-pane--left">fill-2</OcSurface>
        </template>
        <template #centerCanvas>
          <OcSurface variant="elevated" bordered class="axis-demo-pane axis-demo-pane--center">fill</OcSurface>
        </template>
        <template #rightPanel>
          <OcSurface variant="panel" bordered class="axis-demo-pane axis-demo-pane--right">auto</OcSurface>
        </template>
      </OcAxisLayout>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-field-input'">
    <template v-if="column === 'default'">
      <OcFieldInput as="input" value="text input" />
    </template>
    <template v-else-if="column === 'variants'">
      <OcFieldInput as="select">
        <option selected>Selected Option</option>
        <option>Option B</option>
      </OcFieldInput>
    </template>
    <template v-else-if="column === 'states'">
      <OcFieldInput as="textarea" rows="2">multi-line</OcFieldInput>
    </template>
    <template v-else>
      <OcBox stack class="demo-stack">
        <OcFieldInput as="input" value="field A" />
        <OcFieldInput as="input" value="field B" />
      </OcBox>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-menu-item-button'">
    <template v-if="column === 'default'">
      <OcMenuItemButton label="Open Project" icon="icon.folder-opened" />
    </template>
    <template v-else-if="column === 'variants'">
      <OcMenuItemButton label="Export All" icon="icon.export" />
      <OcMenuItemButton label="Submenu Item" icon="icon.list-tree" has-children />
    </template>
    <template v-else-if="column === 'states'">
      <OcMenuItemButton label="Disabled Item" icon="icon.circle-slash" :disabled="true" />
    </template>
    <template v-else>
      <OcSurface variant="floating" bordered radius="md" class="menu-shell">
        <OcMenuItemButton label="Action One" icon="icon.play" />
        <OcMenuItemButton label="Action Two" icon="icon.debug-restart" />
      </OcSurface>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-option-group'">
    <template v-if="column === 'default'">
      <OcOptionGroup v-model="alignValue" :options="alignOptions" :columns="3" aria-label="align" />
    </template>
    <template v-else-if="column === 'variants'">
      <OcOptionGroup v-model="modeValue" :options="modeOptions" :columns="2" size="sm" aria-label="mode" />
    </template>
    <template v-else-if="column === 'states'">
      <OcOptionGroup v-model="alignValue" :options="alignOptions" :columns="3" :disabled="true"
        aria-label="align-disabled" />
    </template>
    <template v-else>
      <OcOptionGroup v-model="alignValue" :options="alignOptions" :columns="1" square aria-label="align-square" />
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-panel-section'">
    <template v-if="column === 'default'">
      <OcPanelSection title="Panel Title" class="panel-demo">
        <OcText tone="secondary">Panel content</OcText>
      </OcPanelSection>
    </template>
    <template v-else-if="column === 'variants'">
      <OcPanelSection title="Actions">
        <template #actions>
          <OcButton variant="icon" icon="icon.add" icon-only />
        </template>
        <OcText tone="secondary">With action slot</OcText>
      </OcPanelSection>
    </template>
    <template v-else-if="column === 'states'">
      <OcPanelSection :header="false">
        <OcText tone="muted">Header disabled mode</OcText>
      </OcPanelSection>
    </template>
    <template v-else>
      <OcPanelSection title="Scrollable" :scroll-body="true" class="panel-demo panel-demo--scroll">
        <OcText v-for="line in scrollLines" :key="`panel-${line}`">Row {{ line }}</OcText>
      </OcPanelSection>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-property-row'">
    <template v-if="column === 'default'">
      <OcPropertyRow label="Name" label-icon="icon.symbol-string">
        <OcFieldInput as="input" value="OpenCard" />
      </OcPropertyRow>
    </template>
    <template v-else-if="column === 'variants'">
      <OcPropertyRow label="Width" label-icon="icon.arrow-left-right">
        <OcFieldInput as="input" value="540" />
      </OcPropertyRow>
    </template>
    <template v-else-if="column === 'states'">
      <OcPropertyRow label="ReadOnly" label-icon="icon.lock">
        <OcFieldInput as="input" value="Locked value" readonly />
      </OcPropertyRow>
    </template>
    <template v-else>
      <OcBox stack class="demo-stack">
        <OcPropertyRow label="X">
          <OcFieldInput as="input" value="24" />
        </OcPropertyRow>
        <OcPropertyRow label="Y">
          <OcFieldInput as="input" value="48" />
        </OcPropertyRow>
      </OcBox>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-tab-bar'">
    <template v-if="column === 'default'">
      <OcSurface variant="elevated" bordered radius="md" class="tab-bar-shell">
        <OcTabBar aria-label="Editor tabs">
          <OcTab label="Uno.opencard" :active="tabValue === 'uno'" @select="tabValue = 'uno'" />
          <OcTab label="Blue.opencard" :active="tabValue === 'blue'" @select="tabValue = 'blue'" />
          <OcTab label="WildDraw4.opencard" :active="tabValue === 'wild'" @select="tabValue = 'wild'" />
        </OcTabBar>
      </OcSurface>
    </template>
    <template v-else-if="column === 'variants'">
      <OcSurface variant="elevated" bordered radius="md" class="tab-bar-shell">
        <OcTabBar aria-label="Editor variants">
          <OcTab label="Overview" :active="tabVariantValue === 'overview'" :closable="false"
            @select="tabVariantValue = 'overview'" />
          <OcTab label="Assets with a very long document name.opencard" :active="tabVariantValue === 'assets'"
            @select="tabVariantValue = 'assets'" />
          <OcTab label="Disabled" :active="tabVariantValue === 'disabled'" disabled
            @select="tabVariantValue = 'disabled'" />
        </OcTabBar>
      </OcSurface>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="elevated" bordered radius="md" class="tab-bar-shell">
        <OcTabBar aria-label="Editor states">
          <OcTab label="Active" active />
          <OcTab label="Dirty" dirty />
          <OcTab label="Disabled" disabled />
        </OcTabBar>
      </OcSurface>
    </template>
    <template v-else>
      <OcSurface variant="elevated" bordered radius="md" class="tab-bar-shell tab-bar-shell--narrow">
        <OcTabBar aria-label="Overflow tabs">
          <OcTab label="Card_01.opencard" :active="tabLayoutValue === 'card-1'" @select="tabLayoutValue = 'card-1'" />
          <OcTab label="Card_02.opencard" :active="tabLayoutValue === 'card-2'" dirty
            @select="tabLayoutValue = 'card-2'" />
          <OcTab label="Card_03.opencard" :active="tabLayoutValue === 'card-3'" @select="tabLayoutValue = 'card-3'" />
          <OcTab label="Card_04.opencard" :active="tabLayoutValue === 'card-4'" @select="tabLayoutValue = 'card-4'" />
          <OcTab label="Card_05.opencard" :active="tabLayoutValue === 'card-5'" @select="tabLayoutValue = 'card-5'" />
        </OcTabBar>
      </OcSurface>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-toolbar'">
    <template v-if="column === 'default'">
      <OcSurface variant="panel" bordered radius="md" class="toolbar-shell">
        <OcToolbar kind="menu" aria-label="Main menu">
          <OcToolButton kind="menu" label="File" />
          <OcToolButton kind="menu" label="Edit" />
          <OcToolButton kind="menu" label="UI Kit" />
        </OcToolbar>
      </OcSurface>
    </template>
    <template v-else-if="column === 'variants'">
      <OcSurface variant="panel" bordered radius="md" class="toolbar-shell toolbar-shell--activity">
        <OcToolbar kind="sidebar" aria-label="Activity tools">
          <OcToolButton kind="sidebar" icon-only :active="toolView === 'files'" aria-label="Files"
            @click="toolView = 'files'">
            <OcIcon name="icon.files" />
          </OcToolButton>
          <OcToolButton kind="sidebar" icon-only :active="toolView === 'search'" aria-label="Search"
            @click="toolView = 'search'">
            <OcIcon name="icon.search" />
          </OcToolButton>
          <OcToolButton kind="sidebar" icon-only :active="toolView === 'publish'" aria-label="Publish"
            @click="toolView = 'publish'">
            <OcIcon name="icon.rocket" />
          </OcToolButton>
        </OcToolbar>
      </OcSurface>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="panel" bordered radius="md" class="toolbar-shell">
        <OcToolbar kind="panel" aria-label="Panel actions">
          <OcToolButton kind="panel" icon="icon.list-tree" aria-label="Tree mode" :active="toolPanelMode === 'tree'"
            @click="toolPanelMode = 'tree'" />
          <OcToolButton kind="panel" icon="icon.symbol-string" aria-label="Alphabetical mode"
            :active="toolPanelMode === 'alpha'" @click="toolPanelMode = 'alpha'" />
          <OcToolButton kind="panel" icon="icon.lock" aria-label="Disabled action" disabled />
        </OcToolbar>
      </OcSurface>
    </template>
    <template v-else>
      <OcSurface variant="panel" bordered radius="md" class="toolbar-shell toolbar-shell--wide">
        <OcToolbar kind="menu" aria-label="Overflow menu tools">
          <OcToolButton kind="menu" label="Export 2x" />
          <OcToolButton kind="menu" label="Export All Views" />
          <OcToolButton kind="menu" label="Publish Package" />
          <OcToolButton kind="menu" label="Open UI Kit" />
        </OcToolbar>
      </OcSurface>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-split-pane'">
    <template v-if="column === 'default'">
      <OcSurface variant="panel" bordered radius="md" class="split-shell">
        <OcSplitPane orientation="horizontal" fixed-pane="secondary" fixed-size="calc(var(--oc-space-6) * 5)"
          secondary-min-size="calc(var(--oc-space-6) * 4)">
          <template #primary>
            <div class="split-demo-pane split-demo-pane--primary">Canvas</div>
          </template>
          <template #resizer>
            <OcResizer orientation="vertical" aria-label="Resize side panel" />
          </template>
          <template #secondary>
            <div class="split-demo-pane split-demo-pane--secondary">Inspector</div>
          </template>
        </OcSplitPane>
      </OcSurface>
    </template>
    <template v-else-if="column === 'variants'">
      <OcSurface variant="panel" bordered radius="md" class="split-shell split-shell--stack">
        <OcSplitPane orientation="vertical" fixed-pane="primary" fixed-size="calc(var(--oc-space-3) * 7)"
          primary-min-size="calc(var(--oc-space-4) * 4)" secondary-min-size="calc(var(--oc-space-6) * 4)">
          <template #primary>
            <div class="split-demo-pane split-demo-pane--secondary">Tree</div>
          </template>
          <template #resizer>
            <OcResizer orientation="horizontal" aria-label="Resize lower panel" />
          </template>
          <template #secondary>
            <div class="split-demo-pane split-demo-pane--primary">Properties</div>
          </template>
        </OcSplitPane>
      </OcSurface>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="panel" bordered radius="md" class="split-shell split-shell--states">
        <OcResizer orientation="vertical" aria-label="Hover resizer" />
        <OcResizer orientation="vertical" variant="edge" aria-label="Edge resizer" />
        <OcResizer orientation="vertical" :active="true" aria-label="Active resizer" />
      </OcSurface>
    </template>
    <template v-else>
      <OcSurface variant="panel" bordered radius="md" class="split-shell">
        <OcSplitPane orientation="horizontal" fixed-pane="secondary"
          :fixed-size="splitPaneMode === 'left' ? 'calc(var(--oc-space-6) * 4)' : 'calc(var(--oc-space-6) * 6)'"
          secondary-min-size="calc(var(--oc-space-6) * 4)">
          <template #primary>
            <div class="split-demo-pane split-demo-pane--primary">
              {{ splitPaneMode === 'left' ? 'Wide Canvas' : 'Compact Canvas' }}
            </div>
          </template>
          <template #resizer>
            <OcResizer orientation="vertical" :active="true" aria-label="Resize preview pane" />
          </template>
          <template #secondary>
            <div class="split-demo-pane split-demo-pane--secondary">
              <OcToolButton kind="panel" icon-only icon="icon.arrow-swap" aria-label="Toggle split preview"
                @click="splitPaneMode = splitPaneMode === 'left' ? 'right' : 'left'" />
            </div>
          </template>
        </OcSplitPane>
      </OcSurface>
    </template>
  </div>

  <div class="showcase-example-case" v-else-if="exampleId === 'base-oc-sidebar-frame'">
    <template v-if="column === 'default'">
      <OcSurface variant="panel" bordered radius="md" class="sidebar-frame-shell">
        <OcSidebarFrame>
          <template #activity>
            <OcToolbar kind="sidebar" aria-label="Sidebar activity">
              <OcToolButton kind="sidebar" icon-only icon="icon.files" aria-label="Files" :active="true" />
            </OcToolbar>
          </template>
          <template #panel>
            <OcEmptyHint align="start" inset="compact">Panel area</OcEmptyHint>
          </template>
        </OcSidebarFrame>
      </OcSurface>
    </template>
    <template v-else-if="column === 'variants'">
      <OcSurface variant="panel" bordered radius="md" class="sidebar-frame-shell">
        <OcSidebarFrame activity-size="compact" panel-size="compact">
          <template #activity>
            <OcToolbar kind="sidebar" aria-label="Sidebar activity compact">
              <OcToolButton kind="sidebar" icon-only icon="icon.search" aria-label="Search" :active="true" />
            </OcToolbar>
          </template>
          <template #panel>
            <OcEmptyHint align="start" inset="compact">Compact panel</OcEmptyHint>
          </template>
        </OcSidebarFrame>
      </OcSurface>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="panel" bordered radius="md" class="sidebar-frame-shell">
        <OcSidebarFrame :panel-visible="false">
          <template #activity>
            <OcToolbar kind="sidebar" aria-label="Sidebar activity hidden panel">
              <OcToolButton kind="sidebar" icon-only icon="icon.list-tree" aria-label="Tree" :active="true" />
            </OcToolbar>
          </template>
          <template #panel>
            <OcText>Hidden</OcText>
          </template>
        </OcSidebarFrame>
      </OcSurface>
    </template>
    <template v-else>
      <OcSurface variant="panel" bordered radius="md" class="sidebar-frame-shell">
        <OcSidebarFrame activity-size="spacious" panel-size="default">
          <template #activity>
            <OcToolbar kind="sidebar" aria-label="Sidebar activity layout">
              <OcToolButton kind="sidebar" icon-only icon="icon.rocket" aria-label="Publish" :active="true" />
            </OcToolbar>
          </template>
          <template #panel>
            <OcPanelSection title="Explorer" header-density="compact" fill>
              <OcEmptyHint align="start" inset="compact">Nested section in sidebar frame.</OcEmptyHint>
            </OcPanelSection>
          </template>
        </OcSidebarFrame>
      </OcSurface>
    </template>
  </div>

  <div v-else class="unknown-example">
    <OcText tone="muted" size="label">No renderer for {{ exampleId }} / {{ column }}</OcText>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import OcAxisLayout, { type AxisRegion } from '../base/OcAxisLayout.vue'
import OcBar from '../base/OcBar.vue'
import OcButton from '../base/OcButton.vue'
import OcChip from '../base/OcChip.vue'
import OcEmptyHint from '../base/OcEmptyHint.vue'
import OcOverlay from '../base/OcOverlay.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcMenuItemButton from '../base/OcMenuItemButton.vue'
import OcOptionGroup from '../base/OcOptionGroup.vue'
import OcPanelSection from '../base/OcPanelSection.vue'
import OcPropertyRow from '../base/OcPropertyRow.vue'
import OcSidebarFrame from '../base/OcSidebarFrame.vue'
import OcTab from '../base/OcTab.vue'
import OcTabBar from '../base/OcTabBar.vue'
import OcToolButton from '../base/OcToolButton.vue'
import OcToolbar from '../base/OcToolbar.vue'
import OcResizer from '../base/OcResizer.vue'
import OcSplitPane from '../base/OcSplitPane.vue'
import type { ShowcaseMatrixColumn } from '../../views/ui-kit/catalog'
import {
  OcBox,
  OcFieldCore,
  OcFocusRing,
  OcIcon,
  OcPressable,
  OcScrollArea,
  OcSurface,
  OcText,
} from '../../shared/ui/primitives'

type OptionItem = {
  value: string
  label: string
  shortLabel?: string
}

defineOptions({ name: 'ShowcaseExampleRenderer' })

defineProps<{
  exampleId: string
  column: ShowcaseMatrixColumn
}>()

const scrollLines = Array.from({ length: 8 }, (_, index) => index + 1)

const alignValue = ref('center')
const modeValue = ref('color')
const tabValue = ref('uno')
const tabVariantValue = ref('overview')
const tabLayoutValue = ref('card-1')
const toolView = ref('files')
const toolPanelMode = ref('tree')
const splitPaneMode = ref('left')

const overlayLayoutRegions: AxisRegion[] = [
  { slot: 'top-tools', track: 'auto' },
  { slot: 'overlay-spacer', track: 'fill' },
  { slot: 'bottom-info', track: 'auto' },
]

const axisHorizontalRegions: AxisRegion[] = [
  { slot: 'leftRail', track: 'auto' },
  { slot: 'centerStage', track: 'fill' },
  { slot: 'rightInspector', track: 'size-xl' },
]

const axisVerticalRegions: AxisRegion[] = [
  { slot: 'topBar', track: 'size-sm' },
  { slot: 'centerContent', track: 'fill' },
  { slot: 'bottomInfo', track: 'size-xs' },
]

const axisStatesRegions: AxisRegion[] = [
  { slot: 'leftTools', track: 'size-md' },
  { slot: 'leftNav', track: 'size-lg' },
  { slot: 'centerMain', track: 'fill' },
]

const axisLayoutRegions: AxisRegion[] = [
  { slot: 'leftActivity', track: 'size-sm' },
  { slot: 'leftExplorer', track: 'fill-2' },
  { slot: 'centerCanvas', track: 'fill' },
  { slot: 'rightPanel', track: 'auto' },
]

const alignOptions: OptionItem[] = [
  { value: 'left', label: 'Left', shortLabel: 'L' },
  { value: 'center', label: 'Center', shortLabel: 'C' },
  { value: 'right', label: 'Right', shortLabel: 'R' },
]

const modeOptions: OptionItem[] = [
  { value: 'color', label: 'Color' },
  { value: 'image', label: 'Image' },
]
</script>

<style scoped>
.showcase-example-case {
  display: contents;
}

.demo-row {
  width: 100%;
  gap: 8px;
}

.demo-stack {
  width: 100%;
  gap: 8px;
}

.demo-box {
  border: 1px dashed var(--oc-border-subtle);
  border-radius: 8px;
  background: var(--oc-bg-panel);
  padding: 8px;
  min-width: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.demo-box--grow {
  flex: 1;
}

.truncate-box {
  max-width: 200px;
}

.token-swatch {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--oc-border-subtle);
  padding: 8px;
  font-size: var(--oc-label-size);
}

.token-swatch--base {
  background: var(--oc-bg-base);
  color: var(--oc-text-primary);
}

.token-swatch--panel {
  background: var(--oc-bg-panel);
}

.token-swatch--text {
  background: var(--oc-bg-elevated);
  color: var(--oc-text-primary);
}

.token-swatch--accent {
  background: var(--oc-bg-accent);
  color: var(--oc-accent-contrast);
}

.token-swatch--accent-soft {
  background: var(--oc-bg-accent-soft);
}

.token-swatch--highlight {
  background: var(--oc-bg-hover);
  color: var(--oc-text-highlight);
}

.token-swatch--success {
  background: var(--oc-bg-panel);
  color: var(--icon-success);
}

.token-swatch--warning {
  background: var(--oc-bg-panel);
  color: var(--icon-warning);
}

.token-swatch--danger {
  background: var(--oc-bg-panel);
  color: var(--oc-danger);
}

.token-layout-box {
  width: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shape-box {
  min-width: 68px;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--oc-label-size);
}

.shadow-layout {
  width: 100%;
  display: grid;
  gap: 8px;
}

.shadow-layout__top,
.shadow-layout__bottom {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--oc-label-size);
}

.surface-sample {
  min-height: 42px;
  min-width: 86px;
  padding: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.surface-stack {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
}

.focus-shell {
  width: 100%;
  border: 1px dashed var(--oc-border-subtle);
  border-radius: 8px;
  padding: 8px;
}

.focus-shell--block {
  display: block;
}

.scroll-shell {
  width: 100%;
  min-height: 76px;
  padding: 8px;
}

.scroll-shell--layout {
  min-height: 116px;
}

.scroll-area {
  max-height: 58px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scroll-area--x {
  max-height: unset;
  overflow-y: hidden;
}

.scroll-row {
  gap: 6px;
  width: max-content;
}

.scroll-chip {
  min-width: 70px;
  padding: 6px 10px;
}

.scroll-big-plane {
  width: 280px;
  height: 180px;
  border-radius: 8px;
  border: 1px dashed var(--oc-border-subtle);
  background: var(--oc-bg-elevated);
}

.menu-shell {
  width: 100%;
  padding: 6px;
  display: grid;
  gap: 4px;
}

.bar-demo-shell {
  width: 100%;
  overflow: hidden;
}

.chip-demo-row {
  width: 100%;
  gap: var(--oc-space-2);
}

.empty-hint-shell {
  width: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
}

.tab-bar-shell {
  width: 100%;
  overflow: hidden;
}

.tab-bar-shell--narrow {
  max-width: 220px;
}

.toolbar-shell {
  width: 100%;
  padding: var(--oc-space-1);
}

.toolbar-shell--activity {
  max-width: 60px;
  padding: 0;
}

.toolbar-shell--wide {
  max-width: 240px;
  overflow: hidden;
}

.split-shell {
  width: 100%;
  min-height: 110px;
  padding: var(--oc-space-1);
}

.split-shell--stack {
  min-height: 180px;
}

.split-shell--states {
  min-height: 76px;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: var(--oc-space-4);
}

.split-demo-pane {
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--oc-label-size);
  color: var(--oc-text-secondary);
  border-radius: var(--oc-radius-md);
}

.split-demo-pane--primary {
  background: var(--oc-bg-elevated);
}

.split-demo-pane--secondary {
  background: var(--oc-bg-panel);
  border: 1px solid var(--oc-border-subtle);
}

.sidebar-frame-shell {
  width: 100%;
  min-height: 124px;
  overflow: hidden;
}

.panel-demo {
  width: 100%;
  min-height: 100px;
}

.panel-demo--scroll {
  max-height: 120px;
}

.spacing-stack {
  width: 100%;
  display: grid;
  gap: var(--oc-space-2);
}

.spacing-sample {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: center;
  gap: var(--oc-space-2);
  font-size: var(--oc-label-size);
  color: var(--oc-text-secondary);
}

.spacing-bar {
  height: 10px;
  border-radius: var(--oc-radius-pill);
  background: var(--oc-bg-accent-tint-strong);
  border: 1px solid var(--oc-bg-accent);
}

.spacing-bar--1 {
  width: var(--oc-space-1);
  min-width: var(--oc-space-1);
}

.spacing-bar--3 {
  width: var(--oc-space-3);
  min-width: var(--oc-space-3);
}

.spacing-bar--6 {
  width: var(--oc-space-6);
  min-width: var(--oc-space-6);
}

.font-token-sample {
  width: 100%;
}

.font-token-sample--heading {
  font-size: var(--oc-heading-size);
}

.font-token-sample--display {
  font-size: var(--oc-display-size);
  line-height: 1;
}

.motion-token-chip {
  padding: var(--oc-space-2) var(--oc-space-3);
  border-radius: var(--oc-radius-pill);
  font-size: var(--oc-label-size);
}

.motion-demo-row {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--oc-space-2);
}

.motion-demo-tile {
  transition:
    transform var(--oc-motion-duration-base) var(--oc-motion-ease-standard),
    box-shadow var(--oc-motion-duration-base) var(--oc-motion-ease-standard);
}

.motion-demo-tile:hover,
.motion-demo-tile:focus-visible {
  transform: translateY(-2px);
  box-shadow: var(--oc-shadow-sm);
}

.overlay-demo-shell {
  width: 100%;
  min-height: 96px;
}

.overlay-demo-base,
.overlay-demo-layout {
  width: 100%;
  min-height: 96px;
  padding: var(--oc-space-3);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--oc-space-1);
}

.overlay-demo-float {
  width: fit-content;
}

.ui-floating-shell {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--oc-border-overlay-soft);
  background: var(--oc-bg-overlay-soft);
  backdrop-filter: blur(14px);
}

.ui-floating-shell--padding-sm {
  padding: var(--oc-space-2);
}

.overlay-demo-chip {
  width: fit-content;
  padding: var(--oc-space-1) var(--oc-space-2);
}

.overlay-demo-spacer {
  width: 100%;
  height: 100%;
}

.overlay-demo-overlay-layout {
  width: 100%;
  height: 100%;
  padding: var(--oc-space-2);
}

.axis-demo-horizontal,
.axis-demo-layout {
  width: 100%;
  min-height: 92px;
}

.axis-demo-vertical {
  width: 100%;
  min-height: 132px;
}

.axis-demo-pane {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--oc-label-size);
  color: var(--oc-text-secondary);
}

.axis-demo-pane--center {
  color: var(--oc-text-primary);
}

.unknown-example {
  width: 100%;
}
</style>
