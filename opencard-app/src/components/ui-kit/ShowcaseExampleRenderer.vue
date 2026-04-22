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
      <OcText size="body" tone="secondary" truncate class="truncate-box">Long text for truncate preview in UI kit matrix.</OcText>
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
      <OcText truncate class="truncate-box">This is a long line to verify truncation behavior in the layout cell.</OcText>
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
        <OcIcon name="codicon-star-full" />
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
            <OcSurface v-for="line in 6" :key="`x-${line}`" variant="panel" bordered class="scroll-chip">Item {{ line }}</OcSurface>
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
      <OcIcon name="codicon-symbol-color" />
    </template>
    <template v-else-if="column === 'variants'">
      <OcIcon name="codicon-folder" tone="folder-default" />
      <OcIcon name="codicon-folder-opened" tone="folder-open" />
      <OcIcon name="codicon-warning" tone="warning" />
    </template>
    <template v-else-if="column === 'states'">
      <OcIcon name="codicon-error" tone="danger" size="lg" />
      <OcIcon name="codicon-check" tone="success" size="lg" />
    </template>
    <template v-else>
      <OcBox inline class="demo-row">
        <OcIcon name="codicon-file-code" tone="typescript" />
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
      <OcButton variant="icon" icon="codicon-settings-gear" icon-only :active="true" />
      <OcButton disabled>Disabled</OcButton>
    </template>
    <template v-else>
      <OcButton block variant="primary">Block Action</OcButton>
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
      <OcMenuItemButton label="Open Project" icon="codicon-folder-opened" />
    </template>
    <template v-else-if="column === 'variants'">
      <OcMenuItemButton label="Export All" icon="codicon-export" />
      <OcMenuItemButton label="Submenu Item" icon="codicon-list-tree" has-children />
    </template>
    <template v-else-if="column === 'states'">
      <OcMenuItemButton label="Disabled Item" icon="codicon-circle-slash" :disabled="true" />
    </template>
    <template v-else>
      <OcSurface variant="floating" bordered radius="md" class="menu-shell">
        <OcMenuItemButton label="Action One" icon="codicon-play" />
        <OcMenuItemButton label="Action Two" icon="codicon-debug-restart" />
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
      <OcOptionGroup v-model="alignValue" :options="alignOptions" :columns="3" :disabled="true" aria-label="align-disabled" />
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
          <OcButton variant="icon" icon="codicon-add" icon-only />
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
      <OcPropertyRow label="Name" label-icon="codicon-symbol-string">
        <OcFieldInput as="input" value="OpenCard" />
      </OcPropertyRow>
    </template>
    <template v-else-if="column === 'variants'">
      <OcPropertyRow label="Width" label-icon="codicon-arrow-left-right">
        <OcFieldInput as="input" value="540" />
      </OcPropertyRow>
    </template>
    <template v-else-if="column === 'states'">
      <OcPropertyRow label="ReadOnly" label-icon="codicon-lock">
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
          <OcTab label="Overview" :active="tabVariantValue === 'overview'" :closable="false" @select="tabVariantValue = 'overview'" />
          <OcTab
            label="Assets with a very long document name.opencard"
            :active="tabVariantValue === 'assets'"
            @select="tabVariantValue = 'assets'"
          />
          <OcTab label="Disabled" :active="tabVariantValue === 'disabled'" disabled @select="tabVariantValue = 'disabled'" />
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
          <OcTab label="Card_02.opencard" :active="tabLayoutValue === 'card-2'" dirty @select="tabLayoutValue = 'card-2'" />
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
          <OcToolButton kind="sidebar" iconOnly :active="toolView === 'files'" aria-label="Files" @click="toolView = 'files'">
            <OcIcon name="codicon-files" />
          </OcToolButton>
          <OcToolButton kind="sidebar" iconOnly :active="toolView === 'search'" aria-label="Search" @click="toolView = 'search'">
            <OcIcon name="codicon-search" />
          </OcToolButton>
          <OcToolButton kind="sidebar" iconOnly :active="toolView === 'publish'" aria-label="Publish" @click="toolView = 'publish'">
            <OcIcon name="codicon-rocket" />
          </OcToolButton>
        </OcToolbar>
      </OcSurface>
    </template>
    <template v-else-if="column === 'states'">
      <OcSurface variant="panel" bordered radius="md" class="toolbar-shell">
        <OcToolbar kind="panel" aria-label="Panel actions">
          <OcToolButton kind="panel" icon="codicon-list-tree" aria-label="Tree mode" :active="toolPanelMode === 'tree'" @click="toolPanelMode = 'tree'" />
          <OcToolButton kind="panel" icon="codicon-symbol-string" aria-label="Alphabetical mode" :active="toolPanelMode === 'alpha'" @click="toolPanelMode = 'alpha'" />
          <OcToolButton kind="panel" icon="codicon-lock" aria-label="Disabled action" disabled />
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
        <OcSplitPane orientation="horizontal" fixedPane="secondary" fixedSize="120px" secondaryMinSize="96px">
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
        <OcSplitPane orientation="vertical" fixedPane="primary" fixedSize="84px" primaryMinSize="64px" secondaryMinSize="96px">
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
        <OcResizer orientation="vertical" :active="true" aria-label="Active resizer" />
      </OcSurface>
    </template>
    <template v-else>
      <OcSurface variant="panel" bordered radius="md" class="split-shell">
        <OcSplitPane orientation="horizontal" fixedPane="secondary" :fixedSize="splitPaneMode === 'left' ? '96px' : '144px'" secondaryMinSize="96px">
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
              <OcToolButton
                kind="panel"
                iconOnly
                icon="codicon-arrow-swap"
                aria-label="Toggle split preview"
                @click="splitPaneMode = splitPaneMode === 'left' ? 'right' : 'left'"
              />
            </div>
          </template>
        </OcSplitPane>
      </OcSurface>
    </template>
  </div>

  <div v-else class="unknown-example">
    <OcText tone="muted" size="label">No renderer for {{ exampleId }} / {{ column }}</OcText>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcMenuItemButton from '../base/OcMenuItemButton.vue'
import OcOptionGroup from '../base/OcOptionGroup.vue'
import OcPanelSection from '../base/OcPanelSection.vue'
import OcPropertyRow from '../base/OcPropertyRow.vue'
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

.unknown-example {
  width: 100%;
}
</style>

