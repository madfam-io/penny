import { z } from 'zod';

// Base renderer configuration
export const RendererConfigSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  responsive: z.boolean().default(true),
  interactive: z.boolean().default(true),
  fullscreenEnabled: z.boolean().default(true),
  exportEnabled: z.boolean().default(true),
  shareEnabled: z.boolean().default(true),
  annotations: z.boolean().default(false),
  accessibility: z.object({
    enabled: z.boolean().default(true),
    screenReader: z.boolean().default(true),
    keyboardNavigation: z.boolean().default(true),
    highContrast: z.boolean().default(false)
  }).default({}),
  performance: z.object({
    lazyLoading: z.boolean().default(true),
    virtualization: z.boolean().default(false),
    debounceMs: z.number().default(300),
    cacheEnabled: z.boolean().default(true)
  }).default({})
});

export type RendererConfig = z.infer<typeof RendererConfigSchema>;

// Chart renderer configuration
export const ChartRendererConfigSchema = RendererConfigSchema.extend({
  library: z.enum(['chartjs', 'd3', 'plotly', 'echarts']).default('chartjs'),
  animations: z.boolean().default(true),
  zoom: z.object({
    enabled: z.boolean().default(false),
    mode: z.enum(['x', 'y', 'xy']).default('xy'),
    rangeMin: z.number().optional(),
    rangeMax: z.number().optional()
  }).optional(),
  pan: z.object({
    enabled: z.boolean().default(false),
    mode: z.enum(['x', 'y', 'xy']).default('xy')
  }).optional(),
  tooltip: z.object({
    enabled: z.boolean().default(true),
    custom: z.boolean().default(false),
    trigger: z.enum(['hover', 'click', 'both']).default('hover')
  }).default({}),
  legend: z.object({
    enabled: z.boolean().default(true),
    position: z.enum(['top', 'bottom', 'left', 'right']).default('top'),
    clickable: z.boolean().default(true)
  }).default({}),
  grid: z.object({
    enabled: z.boolean().default(true),
    color: z.string().optional(),
    opacity: z.number().min(0).max(1).default(0.1)
  }).default({})
});

export type ChartRendererConfig = z.infer<typeof ChartRendererConfigSchema>;

// Table renderer configuration
export const TableRendererConfigSchema = RendererConfigSchema.extend({
  library: z.enum(['ag-grid', 'react-table', 'antd-table']).default('ag-grid'),
  pagination: z.object({
    enabled: z.boolean().default(true),
    pageSize: z.number().min(10).max(1000).default(25),
    pageSizes: z.array(z.number()).default([10, 25, 50, 100]),
    showTotal: z.boolean().default(true)
  }).default({}),
  sorting: z.object({
    enabled: z.boolean().default(true),
    multiColumn: z.boolean().default(false),
    defaultSort: z.array(z.object({
      field: z.string(),
      direction: z.enum(['asc', 'desc'])
    })).optional()
  }).default({}),
  filtering: z.object({
    enabled: z.boolean().default(true),
    quickFilter: z.boolean().default(true),
    columnFilters: z.boolean().default(true),
    filterTypes: z.array(z.enum(['text', 'number', 'date', 'select', 'multi-select'])).default(['text'])
  }).default({}),
  selection: z.object({
    enabled: z.boolean().default(false),
    mode: z.enum(['single', 'multiple']).default('single'),
    checkboxes: z.boolean().default(false)
  }).default({}),
  columns: z.object({
    resizable: z.boolean().default(true),
    sortable: z.boolean().default(true),
    filterable: z.boolean().default(true),
    reorderable: z.boolean().default(false),
    pinnable: z.boolean().default(false)
  }).default({}),
  export: z.object({
    enabled: z.boolean().default(true),
    formats: z.array(z.enum(['csv', 'excel', 'pdf', 'json'])).default(['csv']),
    filename: z.string().optional()
  }).default({})
});

export type TableRendererConfig = z.infer<typeof TableRendererConfigSchema>;

// Code renderer configuration
export const CodeRendererConfigSchema = RendererConfigSchema.extend({
  library: z.enum(['monaco', 'codemirror', 'prism', 'highlight']).default('monaco'),
  editor: z.object({
    readOnly: z.boolean().default(true),
    lineNumbers: z.boolean().default(true),
    wordWrap: z.enum(['off', 'on', 'wordWrapColumn', 'bounded']).default('off'),
    minimap: z.boolean().default(false),
    folding: z.boolean().default(true),
    fontSize: z.number().min(8).max(24).default(14),
    tabSize: z.number().min(1).max(8).default(2),
    insertSpaces: z.boolean().default(true)
  }).default({}),
  syntax: z.object({
    highlighting: z.boolean().default(true),
    autoDetection: z.boolean().default(true),
    customTokens: z.record(z.string()).optional()
  }).default({}),
  features: z.object({
    search: z.boolean().default(true),
    replace: z.boolean().default(false),
    gotoLine: z.boolean().default(true),
    commandPalette: z.boolean().default(false),
    multiCursor: z.boolean().default(false)
  }).default({}),
  diff: z.object({
    enabled: z.boolean().default(false),
    inline: z.boolean().default(true),
    ignoreTrimWhitespace: z.boolean().default(true),
    ignoreWhitespace: z.boolean().default(false)
  }).optional()
});

export type CodeRendererConfig = z.infer<typeof CodeRendererConfigSchema>;

// Image renderer configuration
export const ImageRendererConfigSchema = RendererConfigSchema.extend({
  zoom: z.object({
    enabled: z.boolean().default(true),
    min: z.number().min(0.1).default(0.1),
    max: z.number().max(10).default(5),
    step: z.number().min(0.1).default(0.1),
    wheel: z.boolean().default(true),
    pinch: z.boolean().default(true)
  }).default({}),
  pan: z.object({
    enabled: z.boolean().default(true),
    mouse: z.boolean().default(true),
    touch: z.boolean().default(true)
  }).default({}),
  rotation: z.object({
    enabled: z.boolean().default(false),
    angle: z.number().default(0),
    step: z.number().default(90)
  }).optional(),
  filters: z.object({
    enabled: z.boolean().default(false),
    brightness: z.number().min(0).max(2).default(1),
    contrast: z.number().min(0).max(2).default(1),
    saturation: z.number().min(0).max(2).default(1),
    blur: z.number().min(0).max(10).default(0),
    grayscale: z.boolean().default(false),
    sepia: z.boolean().default(false),
    invert: z.boolean().default(false)
  }).optional(),
  overlay: z.object({
    enabled: z.boolean().default(false),
    color: z.string().default('rgba(0, 0, 0, 0.8)'),
    closeOnClick: z.boolean().default(true),
    showNavigation: z.boolean().default(true),
    showZoom: z.boolean().default(true)
  }).optional(),
  metadata: z.object({
    show: z.boolean().default(false),
    fields: z.array(z.string()).default(['filename', 'size', 'dimensions', 'format'])
  }).default({})
});

export type ImageRendererConfig = z.infer<typeof ImageRendererConfigSchema>;

// Video renderer configuration
export const VideoRendererConfigSchema = RendererConfigSchema.extend({
  player: z.enum(['html5', 'videojs', 'plyr', 'jwplayer']).default('html5'),
  controls: z.object({
    play: z.boolean().default(true),
    pause: z.boolean().default(true),
    volume: z.boolean().default(true),
    mute: z.boolean().default(true),
    fullscreen: z.boolean().default(true),
    progress: z.boolean().default(true),
    currentTime: z.boolean().default(true),
    duration: z.boolean().default(true),
    playbackRate: z.boolean().default(false),
    quality: z.boolean().default(false),
    captions: z.boolean().default(true),
    pip: z.boolean().default(false) // Picture-in-picture
  }).default({}),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
  muted: z.boolean().default(false),
  preload: z.enum(['none', 'metadata', 'auto']).default('metadata'),
  poster: z.string().optional(),
  playbackRates: z.array(z.number()).default([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]),
  hotkeys: z.object({
    enabled: z.boolean().default(true),
    space: z.boolean().default(true), // Play/pause
    arrows: z.boolean().default(true), // Seek
    volume: z.boolean().default(true), // Up/down arrows
    fullscreen: z.boolean().default(true), // F key
    mute: z.boolean().default(true) // M key
  }).default({})
});

export type VideoRendererConfig = z.infer<typeof VideoRendererConfigSchema>;

// Audio renderer configuration
export const AudioRendererConfigSchema = RendererConfigSchema.extend({
  player: z.enum(['html5', 'wavesurfer', 'howler']).default('html5'),
  waveform: z.object({
    enabled: z.boolean().default(false),
    color: z.string().default('#007bff'),
    progressColor: z.string().default('#ffc107'),
    height: z.number().min(50).max(500).default(100),
    barWidth: z.number().min(1).max(10).default(2),
    barGap: z.number().min(0).max(5).default(1),
    responsive: z.boolean().default(true)
  }).optional(),
  controls: z.object({
    play: z.boolean().default(true),
    pause: z.boolean().default(true),
    stop: z.boolean().default(false),
    volume: z.boolean().default(true),
    mute: z.boolean().default(true),
    progress: z.boolean().default(true),
    currentTime: z.boolean().default(true),
    duration: z.boolean().default(true),
    playbackRate: z.boolean().default(false),
    loop: z.boolean().default(true),
    shuffle: z.boolean().default(false),
    download: z.boolean().default(true)
  }).default({}),
  playlist: z.object({
    enabled: z.boolean().default(false),
    autoPlay: z.boolean().default(false),
    repeat: z.enum(['off', 'one', 'all']).default('off')
  }).optional(),
  visualization: z.object({
    enabled: z.boolean().default(false),
    type: z.enum(['bars', 'wave', 'circle']).default('bars'),
    color: z.string().default('#007bff'),
    sensitivity: z.number().min(1).max(10).default(5)
  }).optional()
});

export type AudioRendererConfig = z.infer<typeof AudioRendererConfigSchema>;

// PDF renderer configuration
export const PDFRendererConfigSchema = RendererConfigSchema.extend({
  library: z.enum(['pdfjs', 'react-pdf', 'pdfobject']).default('pdfjs'),
  display: z.object({
    scale: z.number().min(0.25).max(3).default(1),
    fit: z.enum(['width', 'height', 'auto']).default('width'),
    rotation: z.number().multipleOf(90).default(0)
  }).default({}),
  navigation: z.object({
    enabled: z.boolean().default(true),
    thumbnails: z.boolean().default(true),
    outline: z.boolean().default(true),
    search: z.boolean().default(true),
    pageNumbers: z.boolean().default(true)
  }).default({}),
  tools: z.object({
    zoom: z.boolean().default(true),
    pan: z.boolean().default(true),
    select: z.boolean().default(true),
    print: z.boolean().default(true),
    download: z.boolean().default(true)
  }).default({}),
  annotations: z.object({
    enabled: z.boolean().default(false),
    types: z.array(z.enum(['highlight', 'note', 'stamp', 'drawing'])).default(['highlight', 'note'])
  }).optional(),
  text: z.object({
    selectable: z.boolean().default(true),
    searchable: z.boolean().default(true),
    copyable: z.boolean().default(true)
  }).default({})
});

export type PDFRendererConfig = z.infer<typeof PDFRendererConfigSchema>;

// 3D Model renderer configuration
export const ModelRendererConfigSchema = RendererConfigSchema.extend({
  library: z.enum(['threejs', 'babylonjs', 'aframe']).default('threejs'),
  camera: z.object({
    type: z.enum(['perspective', 'orthographic']).default('perspective'),
    position: z.object({
      x: z.number().default(0),
      y: z.number().default(0),
      z: z.number().default(5)
    }).default({}),
    target: z.object({
      x: z.number().default(0),
      y: z.number().default(0),
      z: z.number().default(0)
    }).default({}),
    fov: z.number().min(10).max(120).default(75),
    near: z.number().default(0.1),
    far: z.number().default(1000)
  }).default({}),
  controls: z.object({
    orbit: z.boolean().default(true),
    pan: z.boolean().default(true),
    zoom: z.boolean().default(true),
    rotate: z.boolean().default(true),
    autoRotate: z.boolean().default(false),
    autoRotateSpeed: z.number().default(1)
  }).default({}),
  lighting: z.object({
    ambient: z.object({
      enabled: z.boolean().default(true),
      color: z.string().default('#ffffff'),
      intensity: z.number().min(0).max(2).default(0.4)
    }).default({}),
    directional: z.object({
      enabled: z.boolean().default(true),
      color: z.string().default('#ffffff'),
      intensity: z.number().min(0).max(2).default(1),
      position: z.object({
        x: z.number().default(1),
        y: z.number().default(1),
        z: z.number().default(1)
      }).default({})
    }).default({})
  }).default({}),
  rendering: z.object({
    shadows: z.boolean().default(false),
    wireframe: z.boolean().default(false),
    transparency: z.boolean().default(true),
    antialias: z.boolean().default(true),
    background: z.string().optional()
  }).default({}),
  animation: z.object({
    enabled: z.boolean().default(true),
    autoStart: z.boolean().default(false),
    loop: z.boolean().default(true),
    speed: z.number().min(0.1).max(5).default(1)
  }).optional()
});

export type ModelRendererConfig = z.infer<typeof ModelRendererConfigSchema>;

// Map renderer configuration
export const MapRendererConfigSchema = RendererConfigSchema.extend({
  library: z.enum(['mapbox', 'leaflet', 'googlemaps', 'openlayers']).default('leaflet'),
  style: z.enum(['streets', 'satellite', 'terrain', 'dark', 'light']).default('streets'),
  controls: z.object({
    zoom: z.boolean().default(true),
    fullscreen: z.boolean().default(true),
    layers: z.boolean().default(false),
    scale: z.boolean().default(false),
    attribution: z.boolean().default(true),
    search: z.boolean().default(false),
    location: z.boolean().default(false)
  }).default({}),
  interactions: z.object({
    doubleClickZoom: z.boolean().default(true),
    dragPan: z.boolean().default(true),
    scrollZoom: z.boolean().default(true),
    touchZoom: z.boolean().default(true),
    keyboard: z.boolean().default(true)
  }).default({}),
  markers: z.object({
    clustering: z.boolean().default(false),
    popup: z.boolean().default(true),
    tooltip: z.boolean().default(false),
    animation: z.boolean().default(true)
  }).default({}),
  drawing: z.object({
    enabled: z.boolean().default(false),
    tools: z.array(z.enum(['marker', 'polyline', 'polygon', 'circle', 'rectangle'])).default([])
  }).optional()
});

export type MapRendererConfig = z.infer<typeof MapRendererConfigSchema>;