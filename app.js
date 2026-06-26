/* ==========================================
   ZDOG STUDIO - APPLICATION CONTROLLER
   ========================================== */

// Global state
const state = {
  zoom: 3.6,
  autoSpinSpeedY: 0.003,
  isAnimating: true,
  bgColor: '#181c24',
  showGrid: true,
  selectedShapeId: null,
  activePreset: 'zdog',
  toolMode: 'select', // select, translate, rotate
  autoZoom: 'yes',
  cameraType: 'ortho',
  renderMode: 'canvas',
  animationStarted: false,
  currentFrame: 0,
  maxFrames: 120,
  isPlayingTimeline: false
};

// Scene Graph storage
let sceneGraph = [];

// History stacks for Undo / Redo
const undoStack = [];
const redoStack = [];
const maxHistorySize = 50;

function saveHistory() {
  // Push copy of current sceneGraph to undoStack
  undoStack.push(JSON.stringify(sceneGraph));
  if (undoStack.length > maxHistorySize) {
    undoStack.shift();
  }
  // Clear redoStack on new action
  redoStack.length = 0;
  updateUndoRedoButtons();
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(JSON.stringify(sceneGraph));
  const previousState = JSON.parse(undoStack.pop());
  sceneGraph = previousState;
  
  state.selectedShapeId = null; // Clear selection
  rebuildZdogScene();
  renderHierarchy();
  updatePropertiesPanel();
  generateCode();
  updateUndoRedoButtons();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.stringify(sceneGraph));
  const nextState = JSON.parse(redoStack.pop());
  sceneGraph = nextState;
  
  state.selectedShapeId = null; // Clear selection
  rebuildZdogScene();
  renderHierarchy();
  updatePropertiesPanel();
  generateCode();
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

// Zdog instances map (id -> Zdog object)
let zdogInstances = {};

// Keep track of animation angles/timers
let carTime = 0;
let robotTime = 0;

// Initialize Zdog Illustration
let illo;
let mainAnchor;

// Set up UI DOM references
let canvas = document.getElementById('zdog-canvas');
const treeContainer = document.getElementById('hierarchy-tree');
const activeNodeNameBadge = document.getElementById('active-node-name');
const codeOutput = document.getElementById('js-code-output');

// Properties DOM elements
const inputBgColor = document.getElementById('input-bg-color');
const inputBgColorText = document.getElementById('input-bg-color-text');
const inputGlobalZoom = document.getElementById('input-global-zoom');
const zoomVal = document.getElementById('zoom-val');
const inputSpinSpeedY = document.getElementById('input-spin-speed-y');
const spinYVal = document.getElementById('spin-y-val');

const sliderTx = document.getElementById('slider-tx');
const sliderTy = document.getElementById('slider-ty');
const sliderTz = document.getElementById('slider-tz');
const inputTx = document.getElementById('input-tx');
const inputTy = document.getElementById('input-ty');
const inputTz = document.getElementById('input-tz');

const sliderRx = document.getElementById('slider-rx');
const sliderRy = document.getElementById('slider-ry');
const sliderRz = document.getElementById('slider-rz');
const inputRx = document.getElementById('input-rx');
const inputRy = document.getElementById('input-ry');
const inputRz = document.getElementById('input-rz');

const inputSx = document.getElementById('input-sx');
const inputSy = document.getElementById('input-sy');
const inputSz = document.getElementById('input-sz');

const inputColor = document.getElementById('input-color');
const inputColorText = document.getElementById('input-color-text');
const inputStroke = document.getElementById('input-stroke');
const strokeVal = document.getElementById('stroke-val');
const inputFill = document.getElementById('input-fill');
const inputVisible = document.getElementById('input-visible');
const inputClosed = document.getElementById('input-closed');
const inputBackface = document.getElementById('input-backface');

const shapeSpecificBody = document.getElementById('shape-specific-body');

// Buttons
const btnDeleteNode = document.getElementById('btn-delete-node');
const btnCloneNode = document.getElementById('btn-clone-node');
const btnToggleGrid = document.getElementById('btn-toggle-grid');
const btnToggleAnimation = document.getElementById('btn-toggle-animation');
const playPauseIcon = document.getElementById('play-pause-icon');
const btnToggleView = document.getElementById('btn-toggle-view');

// Panels
const propertiesPanel = document.getElementById('properties-panel');
const codePanel = document.getElementById('code-panel');

// ==========================================
// PRESET SCENES DEFINITIONS
// ==========================================

const presets = {
  // Zdog mascot preset
  zdog: [
    { id: 'bigGroup', type: 'Group', name: 'Big Group', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'backGroup', type: 'Group', name: 'Back Group', parentId: 'bigGroup', translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    
    // Top
    { id: 'topSide', type: 'Rect', name: 'Top Side', parentId: 'backGroup', translate: { x: 0, y: -20, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: true, visible: true, closed: true, backface: true, width: 40, height: 20 },
    { id: 'bottomSide', type: 'Rect', name: 'Bottom Side', parentId: 'backGroup', translate: { x: 0, y: 20, z: 0 }, rotate: { x: -90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: true, visible: true, closed: true, backface: true, width: 40, height: 20 },
    
    // End caps
    { id: 'endCapLeft', type: 'Rect', name: 'End Cap Left', parentId: 'backGroup', translate: { x: -20, y: -16, z: 0 }, rotate: { x: 0, y: 90, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: true, visible: true, closed: true, backface: false, width: 20, height: 8 },
    { id: 'endCapRight', type: 'Rect', name: 'End Cap Right', parentId: 'backGroup', translate: { x: 20, y: 16, z: 0 }, rotate: { x: 0, y: -90, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: true, visible: true, closed: true, backface: false, width: 20, height: 8 },
    
    // Corner caps
    { id: 'cornerCapLeft', type: 'Rect', name: 'Corner Cap Left', parentId: 'backGroup', translate: { x: -20, y: 15, z: 0 }, rotate: { x: 0, y: 90, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: true, visible: true, closed: true, backface: false, width: 20, height: 10 },
    { id: 'cornerCapRight', type: 'Rect', name: 'Corner Cap Right', parentId: 'backGroup', translate: { x: 20, y: -15, z: 0 }, rotate: { x: 0, y: -90, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: true, visible: true, closed: true, backface: false, width: 20, height: 10 },
    
    // Undersides
    { id: 'undersideLeft', type: 'Rect', name: 'Underside Left', parentId: 'backGroup', translate: { x: -5, y: -12, z: 0 }, rotate: { x: -90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: true, visible: true, closed: true, backface: true, width: 30, height: 20 },
    { id: 'undersideRight', type: 'Rect', name: 'Underside Right', parentId: 'backGroup', translate: { x: 5, y: 12, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: true, visible: true, closed: true, backface: true, width: 30, height: 20 },
    
    // Slopes
    { id: 'slopeLeft', type: 'Rect', name: 'Slope Left', parentId: 'backGroup', translate: { x: -5, y: -1, z: 0 }, rotate: { x: 90, y: 36.27, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: true, visible: true, closed: true, backface: false, width: 37.2, height: 20 },
    { id: 'slopeRight', type: 'Rect', name: 'Slope Right', parentId: 'backGroup', translate: { x: 5, y: 1, z: 0 }, rotate: { x: -90, y: -36.27, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: true, visible: true, closed: true, backface: false, width: 37.2, height: 20 },
    
    // Tail
    { id: 'tail', type: 'Ellipse', name: 'Tail', parentId: 'backGroup', translate: { x: 22, y: -4, z: 0 }, rotate: { x: 0, y: 0, z: 90 }, scale: { x: 1, y: 1, z: 1 }, color: '#E62', stroke: 8, fill: false, visible: true, closed: false, backface: true, diameter: 32, quarters: 1 },
    
    // Tongue Anchor & Tongue
    { id: 'tongueAnchor', type: 'Anchor', name: 'Tongue Anchor', parentId: 'backGroup', translate: { x: -6, y: -7, z: 0 }, rotate: { x: 0, y: 90, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'tongue', type: 'Shape', name: 'Tongue', parentId: 'tongueAnchor', translate: { x: 0, y: 0, z: 0 }, rotate: { x: 53.97, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#636', stroke: 4, fill: true, visible: true, closed: true, backface: true, path: [ { x: -5, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 12 }, { arc: [ { x: 5, y: 17 }, { x: 0, y: 17 } ] }, { arc: [ { x: -5, y: 17 }, { x: -5, y: 12 } ] } ] },
    
    // Forehead Group & Face
    { id: 'foreGroup', type: 'Group', name: 'Fore Group', parentId: 'bigGroup', translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'zFaceFront', type: 'Shape', name: 'Z Face Front', parentId: 'foreGroup', translate: { x: 0, y: 0, z: 10 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#EA0', stroke: 8, fill: true, visible: true, closed: true, backface: false, path: [ { x: -20, y: -20 }, { x: 20, y: -20 }, { x: 20, y: -10 }, { x: -10, y: 12 }, { x: 20, y: 12 }, { x: 20, y: 20 }, { x: -20, y: 20 }, { x: -20, y: 10 }, { x: 10, y: -12 }, { x: -20, y: -12 } ] },
    { id: 'zFaceBack', type: 'Shape', name: 'Z Face Back', parentId: 'foreGroup', translate: { x: 0, y: 0, z: -10 }, rotate: { x: 0, y: 180, z: 0 }, scale: { x: -1, y: 1, z: 1 }, color: '#EA0', stroke: 8, fill: true, visible: true, closed: true, backface: false, path: [ { x: -20, y: -20 }, { x: 20, y: -20 }, { x: 20, y: -10 }, { x: -10, y: 12 }, { x: 20, y: 12 }, { x: 20, y: 20 }, { x: -20, y: 20 }, { x: -20, y: 10 }, { x: 10, y: -12 }, { x: -20, y: -12 } ] },
    
    // Nose
    { id: 'nose', type: 'Ellipse', name: 'Nose', parentId: 'backGroup', translate: { x: -26, y: -20, z: 0 }, rotate: { x: 0, y: 90, z: 90 }, scale: { x: 8, y: 8, z: 8 }, color: '#636', stroke: 5, fill: true, visible: true, closed: true, backface: true, diameter: 2, quarters: 2 },
    
    // Ears
    { id: 'earGroupLeft', type: 'Group', name: 'Ear Group Left', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'earLeft', type: 'Ellipse', name: 'Ear Left', parentId: 'earGroupLeft', translate: { x: 10, y: -14, z: 20 }, rotate: { x: 22.5, y: 90, z: -22.5 }, scale: { x: 24, y: 24, z: 24 }, color: '#636', stroke: 5, fill: true, visible: true, closed: true, backface: true, diameter: 2, quarters: 2 },
    
    { id: 'earGroupRight', type: 'Group', name: 'Ear Group Right', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: -1 } },
    { id: 'earRight', type: 'Ellipse', name: 'Ear Right', parentId: 'earGroupRight', translate: { x: 10, y: -14, z: 20 }, rotate: { x: 22.5, y: 90, z: -22.5 }, scale: { x: 24, y: 24, z: 24 }, color: '#636', stroke: 5, fill: true, visible: true, closed: true, backface: true, diameter: 2, quarters: 2 }
  ],
  // 1. SOLAR SYSTEM PRESET (Layout Page)
  solar: [
    { id: 'sun', type: 'Anchor', name: 'Sun Core', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'sun_sphere', type: 'Hemisphere', name: 'Sun Front', parentId: 'sun', translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#ff7300', stroke: 28, fill: true, visible: true, closed: true, backface: true, diameter: 10 },
    { id: 'sun_back', type: 'Hemisphere', name: 'Sun Back', parentId: 'sun', translate: { x: 0, y: 0, z: 0 }, rotate: { x: 180, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#e11d48', stroke: 28, fill: true, visible: true, closed: true, backface: true, diameter: 10 },
    
    // Mercury
    { id: 'mercury_orbit', type: 'Anchor', name: 'Mercury Orbit Rotation', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'mercury_path', type: 'Ellipse', name: 'Mercury Orbit Path', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: 'rgba(255,255,255,0.06)', stroke: 1, fill: false, visible: true, closed: true, backface: true, diameter: 70 },
    { id: 'mercury', type: 'Ellipse', name: 'Mercury Planet', parentId: 'mercury_orbit', translate: { x: 35, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#94a3b8', stroke: 6, fill: true, visible: true, closed: true, backface: true, diameter: 4 },
    
    // Venus
    { id: 'venus_orbit', type: 'Anchor', name: 'Venus Orbit Rotation', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'venus_path', type: 'Ellipse', name: 'Venus Orbit Path', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: 'rgba(255,255,255,0.06)', stroke: 1, fill: false, visible: true, closed: true, backface: true, diameter: 110 },
    { id: 'venus', type: 'Ellipse', name: 'Venus Planet', parentId: 'venus_orbit', translate: { x: 55, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#d97706', stroke: 10, fill: true, visible: true, closed: true, backface: true, diameter: 6 },
    
    // Earth
    { id: 'earth_orbit', type: 'Anchor', name: 'Earth Orbit Rotation', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'earth_path', type: 'Ellipse', name: 'Earth Orbit Path', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: 'rgba(255,255,255,0.06)', stroke: 1, fill: false, visible: true, closed: true, backface: true, diameter: 160 },
    { id: 'earth', type: 'Ellipse', name: 'Earth Planet', parentId: 'earth_orbit', translate: { x: 80, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#3b82f6', stroke: 12, fill: true, visible: true, closed: true, backface: true, diameter: 8 },
    
    // Moon
    { id: 'moon_orbit', type: 'Anchor', name: 'Moon Orbit Rotation', parentId: 'earth_orbit', translate: { x: 80, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'moon', type: 'Ellipse', name: 'Moon', parentId: 'moon_orbit', translate: { x: 12, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#e2e8f0', stroke: 3, fill: true, visible: true, closed: true, backface: true, diameter: 2 },
    
    // Saturn
    { id: 'saturn_orbit', type: 'Anchor', name: 'Saturn Orbit Rotation', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'saturn_path', type: 'Ellipse', name: 'Saturn Orbit Path', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: 'rgba(255,255,255,0.06)', stroke: 1, fill: false, visible: true, closed: true, backface: true, diameter: 240 },
    { id: 'saturn', type: 'Ellipse', name: 'Saturn Planet', parentId: 'saturn_orbit', translate: { x: 120, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#eab308', stroke: 16, fill: true, visible: true, closed: true, backface: true, diameter: 10 },
    { id: 'saturn_ring', type: 'Ellipse', name: 'Saturn Ring', parentId: 'saturn_orbit', translate: { x: 120, y: 0, z: 0 }, rotate: { x: 80, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#b45309', stroke: 3, fill: false, visible: true, closed: true, backface: true, diameter: 30 }
  ],

  // 2. TOY ROBOT PRESET (Modeling Page)
  robot: [
    // Base body
    { id: 'robot_body', type: 'Box', name: 'Chassis Body', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#475569', stroke: 1, fill: true, visible: true, closed: true, backface: true, width: 34, height: 38, depth: 24 },
    
    // Head
    { id: 'head', type: 'Box', name: 'Robot Head', parentId: 'robot_body', translate: { x: 0, y: -30, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#64748b', stroke: 1, fill: true, visible: true, closed: true, backface: true, width: 24, height: 18, depth: 20 },
    { id: 'eye_l', type: 'Ellipse', name: 'Eye Left', parentId: 'head', translate: { x: -6, y: -2, z: 10.5 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#06b6d4', stroke: 4, fill: true, visible: true, closed: true, backface: true, diameter: 3 },
    { id: 'eye_r', type: 'Ellipse', name: 'Eye Right', parentId: 'head', translate: { x: 6, y: -2, z: 10.5 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#06b6d4', stroke: 4, fill: true, visible: true, closed: true, backface: true, diameter: 3 },
    { id: 'antenna', type: 'Cylinder', name: 'Antenna Pole', parentId: 'head', translate: { x: 0, y: -12, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#94a3b8', stroke: 1, fill: true, visible: true, closed: true, backface: true, diameter: 2, length: 8 },
    { id: 'antenna_tip', type: 'Ellipse', name: 'Antenna Bulb', parentId: 'head', translate: { x: 0, y: -17, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#ef4444', stroke: 5, fill: true, visible: true, closed: true, backface: true, diameter: 2 },
    
    // Body decorations
    { id: 'chest_panel', type: 'Rect', name: 'Chest Display', parentId: 'robot_body', translate: { x: 0, y: -2, z: 12.5 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#1e293b', stroke: 1, fill: true, visible: true, closed: true, backface: true, width: 22, height: 14 },
    { id: 'chest_meter', type: 'Ellipse', name: 'Dial Gauge', parentId: 'chest_panel', translate: { x: -5, y: 0, z: 1 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#10b981', stroke: 2, fill: true, visible: true, closed: true, backface: true, diameter: 4 },
    
    // Arms
    { id: 'arm_left', type: 'Anchor', name: 'Left Arm Joint', parentId: 'robot_body', translate: { x: -20, y: -10, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'arm_l_limb', type: 'Cylinder', name: 'Left Arm Limb', parentId: 'arm_left', translate: { x: 0, y: 10, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#f59e0b', stroke: 1, fill: true, visible: true, closed: true, backface: true, diameter: 5, length: 20 },
    
    { id: 'arm_right', type: 'Anchor', name: 'Right Arm Joint', parentId: 'robot_body', translate: { x: 20, y: -10, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'arm_r_limb', type: 'Cylinder', name: 'Right Arm Limb', parentId: 'arm_right', translate: { x: 0, y: 10, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#f59e0b', stroke: 1, fill: true, visible: true, closed: true, backface: true, diameter: 5, length: 20 },
    
    // Legs
    { id: 'leg_l', type: 'Cylinder', name: 'Left Leg Joint', parentId: 'robot_body', translate: { x: -8, y: 24, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#334155', stroke: 1, fill: true, visible: true, closed: true, backface: true, diameter: 7, length: 14 },
    { id: 'foot_l', type: 'Box', name: 'Left Foot', parentId: 'robot_body', translate: { x: -8, y: 32, z: 4 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#1e293b', stroke: 1, fill: true, visible: true, closed: true, backface: true, width: 10, height: 6, depth: 16 },
    
    { id: 'leg_r', type: 'Cylinder', name: 'Right Leg Joint', parentId: 'robot_body', translate: { x: 8, y: 24, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#334155', stroke: 1, fill: true, visible: true, closed: true, backface: true, diameter: 7, length: 14 },
    { id: 'foot_r', type: 'Box', name: 'Right Foot', parentId: 'robot_body', translate: { x: 8, y: 32, z: 4 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#1e293b', stroke: 1, fill: true, visible: true, closed: true, backface: true, width: 10, height: 6, depth: 16 }
  ],

  // 3. MECHANICAL GYROSCOPE PRESET (UV Editing Page)
  gyro: [
    { id: 'ring_outer', type: 'Ellipse', name: 'Outer Ring (Gold)', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#ff5c00', stroke: 6, fill: false, visible: true, closed: true, backface: true, diameter: 130 },
    { id: 'ring_middle', type: 'Ellipse', name: 'Middle Ring (Silver)', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#94a3b8', stroke: 5, fill: false, visible: true, closed: true, backface: true, diameter: 100 },
    { id: 'ring_inner', type: 'Ellipse', name: 'Inner Ring (Bronze)', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#b45309', stroke: 4, fill: false, visible: true, closed: true, backface: true, diameter: 70 },
    
    // Core (Spherical shape via shape stroke)
    { id: 'gyro_core', type: 'Ellipse', name: 'Plasma Core', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#3b82f6', stroke: 22, fill: true, visible: true, closed: true, backface: true, diameter: 2 },
    
    // Support bar
    { id: 'center_spindle', type: 'Cylinder', name: 'Main Spindle', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 90, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#475569', stroke: 1, fill: true, visible: true, closed: true, backface: true, diameter: 3, length: 140 }
  ],

  // 4. CYBERPUNK CITY PRESET (Textures Page)
  cyber: [
    // Ground
    { id: 'ground', type: 'Rect', name: 'Ground Plane', parentId: null, translate: { x: 0, y: 50, z: 0 }, rotate: { x: 90, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#11141b', stroke: 4, fill: true, visible: true, closed: true, backface: true, width: 220, height: 220 },
    
    // Buildings
    { id: 'build1', type: 'Box', name: 'Tower Violet', parentId: null, translate: { x: -50, y: 10, z: -50 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#312e81', stroke: 1, fill: true, visible: true, closed: true, backface: true, width: 34, height: 80, depth: 34 },
    { id: 'build1_top', type: 'Box', name: 'Tower Neon Top', parentId: 'build1', translate: { x: 0, y: -40, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#c084fc', stroke: 2, fill: true, visible: true, closed: true, backface: true, width: 20, height: 8, depth: 20 },
    
    { id: 'build2', type: 'Box', name: 'Building Green', parentId: null, translate: { x: 50, y: 20, z: -40 }, rotate: { x: 0, y: 20, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#064e3b', stroke: 1, fill: true, visible: true, closed: true, backface: true, width: 44, height: 60, depth: 44 },
    
    { id: 'build3', type: 'Box', name: 'Corporate Block', parentId: null, translate: { x: -20, y: 25, z: 50 }, rotate: { x: 0, y: -10, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#1e3a8a', stroke: 1, fill: true, visible: true, closed: true, backface: true, width: 30, height: 50, depth: 30 },
    
    // Flying car group
    { id: 'flying_car', type: 'Group', name: 'Hover Car Group', parentId: null, translate: { x: 0, y: -35, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { id: 'car_chassis', type: 'Box', name: 'Car Chassis', parentId: 'flying_car', translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#ff5c00', stroke: 1, fill: true, visible: true, closed: true, backface: true, width: 32, height: 10, depth: 16 },
    { id: 'car_cabin', type: 'Box', name: 'Car Cabin', parentId: 'flying_car', translate: { x: 4, y: -6, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#38bdf8', stroke: 1, fill: true, visible: true, closed: true, backface: true, width: 14, height: 6, depth: 12 },
    { id: 'thruster_l', type: 'Cylinder', name: 'Left Thruster', parentId: 'flying_car', translate: { x: -14, y: 2, z: -7 }, rotate: { x: 0, y: 90, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#1e293b', stroke: 1, fill: true, visible: true, closed: true, backface: true, diameter: 5, length: 8 },
    { id: 'thruster_r', type: 'Cylinder', name: 'Right Thruster', parentId: 'flying_car', translate: { x: -14, y: 2, z: 7 }, rotate: { x: 0, y: 90, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#1e293b', stroke: 1, fill: true, visible: true, closed: true, backface: true, diameter: 5, length: 8 }
  ],

  // 5. EMPTY SANDBOX PRESET (Nodes Page)
  empty: [
    { id: 'box_root', type: 'Box', name: 'Starter Box', parentId: null, translate: { x: 0, y: 0, z: 0 }, rotate: { x: 25, y: 45, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#ff5c00', stroke: 2, fill: true, visible: true, closed: true, backface: true, width: 40, height: 40, depth: 40 }
  ]
};

// ==========================================
// SCENE COMPILING & RENDERING
// ==========================================

function initZdog() {
  // Re-create canvas and SVG elements to clear old Zdog Dragger listeners
  const oldCanvas = document.getElementById('zdog-canvas');
  const oldSvg = document.getElementById('zdog-svg');
  if (oldCanvas) {
    const newCanvas = oldCanvas.cloneNode(true);
    oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
    canvas = newCanvas;
  }
  if (oldSvg) {
    const newSvg = oldSvg.cloneNode(true);
    oldSvg.parentNode.replaceChild(newSvg, oldSvg);
  }

  const targetElement = state.renderMode === 'canvas' ? canvas : document.getElementById('zdog-svg');
  
  if (state.renderMode === 'canvas') {
    canvas.style.display = 'block';
    document.getElementById('zdog-svg').style.display = 'none';
  } else {
    canvas.style.display = 'none';
    document.getElementById('zdog-svg').style.display = 'block';
  }

  illo = new Zdog.Illustration({
    element: targetElement,
    zoom: state.zoom,
    dragRotate: true,
    onDragStart: () => {
      state.wasAnimatingBeforeDrag = state.isAnimating;
      state.isAnimating = false; // pause rotation during drag
    },
    onDragMove: () => {
      // Sync rotation angles back to UI controls if global is selected
      if (!state.selectedShapeId) {
        let rx_deg = Math.round((illo.rotate.x * 180 / Math.PI) % 360);
        let ry_deg = Math.round((illo.rotate.y * 180 / Math.PI) % 360);
        let rz_deg = Math.round((illo.rotate.z * 180 / Math.PI) % 360);
        if (rx_deg < 0) rx_deg += 360;
        if (ry_deg < 0) ry_deg += 360;
        if (rz_deg < 0) rz_deg += 360;
        
        document.getElementById('input-rx').value = rx_deg;
        document.getElementById('slider-rx').value = rx_deg;
        document.getElementById('input-ry').value = ry_deg;
        document.getElementById('slider-ry').value = ry_deg;
      }
    },
    onDragEnd: () => {
      state.isAnimating = state.wasAnimatingBeforeDrag;
    }
  });

  mainAnchor = new Zdog.Anchor({
    addTo: illo
  });

  // Re-build all shapes inside the illustration
  rebuildZdogScene();

  if (!state.animationStarted) {
    state.animationStarted = true;
    animate();
  }
}

function loadPreset(name) {
  state.activePreset = name;
  sceneGraph = JSON.parse(JSON.stringify(presets[name]));
  state.selectedShapeId = null;
  
  // Clear history stacks since we loaded a fresh preset
  undoStack.length = 0;
  redoStack.length = 0;
  updateUndoRedoButtons();
  
  // Set default rotation/zoom based on preset
  illo.rotate.x = -0.35;
  illo.rotate.y = 0.6;
  illo.rotate.z = 0;
  
  if (name === 'zdog') {
    state.zoom = 3.6;
    state.autoSpinSpeedY = 0.003;
    illo.rotate.x = 20/360 * Zdog.TAU;
    illo.rotate.y = -50/360 * Zdog.TAU;
    illo.rotate.z = 0;
  } else if (name === 'solar') {
    state.zoom = 2.4;
    state.autoSpinSpeedY = 0.005;
  } else if (name === 'cyber') {
    state.zoom = 2.2;
    state.autoSpinSpeedY = 0.002;
    illo.rotate.x = -0.45;
    illo.rotate.y = 0.65;
  } else if (name === 'gyro') {
    state.zoom = 3.0;
    state.autoSpinSpeedY = 0.003;
  } else if (name === 'robot') {
    state.zoom = 3.2;
    state.autoSpinSpeedY = 0.004;
    illo.rotate.x = -0.2;
    illo.rotate.y = 0.45;
  } else {
    state.zoom = 4.0;
    state.autoSpinSpeedY = 0.005;
  }
  
  // Sync global settings inputs
  inputGlobalZoom.value = state.zoom;
  zoomVal.innerText = state.zoom.toFixed(1);
  inputSpinSpeedY.value = state.autoSpinSpeedY;
  spinYVal.innerText = state.autoSpinSpeedY;

  rebuildZdogScene();
  renderHierarchy();
  updatePropertiesPanel();
  generateCode();
}

let penPoints = [];
let penCurrentMousePoint = null;
let firstPointScreenX = 0;
let firstPointScreenY = 0;

function rebuildZdogScene() {
  // Clear mainAnchor children
  while (mainAnchor.children.length > 0) {
    mainAnchor.children[0].remove();
  }
  
  zdogInstances = {};
  
  // Re-draw grid if active
  if (state.showGrid) {
    drawGridAndAxes(mainAnchor);
  }

  // Compile root nodes
  const rootNodes = sceneGraph.filter(n => n.parentId === null || n.parentId === '');
  rootNodes.forEach(node => {
    createZdogNode(node, mainAnchor);
  });

  // Render Pen Tool temporary path and handles
  if (state.toolMode === 'pen' && penPoints.length > 0) {
    const tempPath = [...penPoints];
    if (penCurrentMousePoint) {
      tempPath.push(penCurrentMousePoint);
    }
    new Zdog.Shape({
      addTo: mainAnchor,
      path: tempPath,
      stroke: 3,
      color: '#d946ef', // Neon magenta
      closed: false
    });
    // Draw point handles
    penPoints.forEach((pt, idx) => {
      new Zdog.Shape({
        addTo: mainAnchor,
        translate: pt,
        stroke: idx === 0 ? 10 : 6, // Larger start dot
        color: idx === 0 ? '#10b981' : '#ec4899', // Green start dot, pink others
        fill: true
      });
    });
  }

  illo.updateRenderGraph();
}

function drawGridAndAxes(parent) {
  const gridAnchor = new Zdog.Anchor({
    addTo: parent
  });

  const gridSize = 160;
  const gridStep = 20;
  
  // Fine Grid Lines
  for (let i = -gridSize; i <= gridSize; i += gridStep) {
    new Zdog.Shape({
      addTo: gridAnchor,
      path: [ { x: -gridSize, z: i }, { x: gridSize, z: i } ],
      stroke: 0.5,
      color: '#282c35',
      closed: false
    });
    new Zdog.Shape({
      addTo: gridAnchor,
      path: [ { x: i, z: -gridSize }, { x: i, z: gridSize } ],
      stroke: 0.5,
      color: '#282c35',
      closed: false
    });
  }

  // Draw X/Y/Z Axes at Center
  // X Axis (Red)
  new Zdog.Shape({
    addTo: gridAnchor,
    path: [{ x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }],
    stroke: 1.5,
    color: '#f43f5e',
    closed: false
  });
  // Y Axis (Green, Zdog Y points down, negative Y points up)
  new Zdog.Shape({
    addTo: gridAnchor,
    path: [{ x: 0, y: 0, z: 0 }, { x: 0, y: -40, z: 0 }],
    stroke: 1.5,
    color: '#10b981',
    closed: false
  });
  // Z Axis (Blue)
  new Zdog.Shape({
    addTo: gridAnchor,
    path: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 40 }],
    stroke: 1.5,
    color: '#3b82f6',
    closed: false
  });
}

function createZdogNode(node, parentZdogAnchor) {
  let options = {
    addTo: parentZdogAnchor,
    translate: {
      x: Number(node.translate.x || 0),
      y: Number(node.translate.y || 0),
      z: Number(node.translate.z || 0)
    },
    rotate: {
      x: Number(node.rotate.x || 0) * Math.PI / 180,
      y: Number(node.rotate.y || 0) * Math.PI / 180,
      z: Number(node.rotate.z || 0) * Math.PI / 180
    },
    scale: {
      x: Number(node.scale.x || 1),
      y: Number(node.scale.y || 1),
      z: Number(node.scale.z || 1)
    }
  };

  if (node.type !== 'Anchor' && node.type !== 'Group') {
    options.color = node.color || '#ff5c00';
    options.stroke = node.stroke !== undefined ? Number(node.stroke) : 8;
    options.fill = node.fill !== undefined ? Boolean(node.fill) : true;
    options.visible = node.visible !== undefined ? Boolean(node.visible) : true;
    options.closed = node.closed !== undefined ? Boolean(node.closed) : true;
    options.backface = node.backface !== undefined ? Boolean(node.backface) : true;
  }

  switch (node.type) {
    case 'Box':
      options.width = Number(node.width !== undefined ? node.width : 20);
      options.height = Number(node.height !== undefined ? node.height : 20);
      options.depth = Number(node.depth !== undefined ? node.depth : 20);
      break;
    case 'Cylinder':
      options.diameter = Number(node.diameter !== undefined ? node.diameter : 20);
      options.length = Number(node.length !== undefined ? node.length : 30);
      break;
    case 'Cone':
      options.diameter = Number(node.diameter !== undefined ? node.diameter : 20);
      options.length = Number(node.length !== undefined ? node.length : 30);
      break;
    case 'Hemisphere':
      options.diameter = Number(node.diameter !== undefined ? node.diameter : 20);
      break;
    case 'Ellipse':
      options.diameter = Number(node.diameter !== undefined ? node.diameter : 25);
      options.quarters = Number(node.quarters !== undefined ? node.quarters : 4);
      break;
    case 'Rect':
      options.width = Number(node.width !== undefined ? node.width : 20);
      options.height = Number(node.height !== undefined ? node.height : 20);
      break;
    case 'RoundedRect':
      options.width = Number(node.width !== undefined ? node.width : 20);
      options.height = Number(node.height !== undefined ? node.height : 20);
      options.cornerRadius = Number(node.cornerRadius !== undefined ? node.cornerRadius : 4);
      break;
    case 'Polygon':
      options.sides = Number(node.sides !== undefined ? node.sides : 6);
      options.radius = Number(node.radius !== undefined ? node.radius : 15);
      break;
    case 'Shape':
      options.path = node.path || [{ x: 0, y: 0, z: 0 }];
      break;
  }

  let zdogObj;
  try {
    switch (node.type) {
      case 'Anchor': zdogObj = new Zdog.Anchor(options); break;
      case 'Group': zdogObj = new Zdog.Group(options); break;
      case 'Box': zdogObj = new Zdog.Box(options); break;
      case 'Cylinder': zdogObj = new Zdog.Cylinder(options); break;
      case 'Cone': zdogObj = new Zdog.Cone(options); break;
      case 'Hemisphere': zdogObj = new Zdog.Hemisphere(options); break;
      case 'Ellipse': zdogObj = new Zdog.Ellipse(options); break;
      case 'Rect': zdogObj = new Zdog.Rect(options); break;
      case 'RoundedRect': zdogObj = new Zdog.RoundedRect(options); break;
      case 'Polygon': zdogObj = new Zdog.Polygon(options); break;
      case 'Shape': zdogObj = new Zdog.Shape(options); break;
    }
  } catch (err) {
    console.error("Zdog node error", err);
    zdogObj = new Zdog.Anchor(options);
  }

  zdogInstances[node.id] = zdogObj;

  const children = sceneGraph.filter(n => n.parentId === node.id);
  children.forEach(child => {
    createZdogNode(child, zdogObj);
  });
}

function animate() {
  if (illo) {
    illo.zoom = state.cameraType === 'persp' ? state.zoom * 1.3 : state.zoom;
  }
  updateSceneAnimations();
  illo.updateRenderGraph();
  requestAnimationFrame(animate);
}

function interpolateTransform(node, frame) {
  if (!node.keyframes || Object.keys(node.keyframes).length === 0) {
    return {
      translate: { ...node.translate },
      rotate: { ...node.rotate },
      scale: { ...node.scale }
    };
  }

  const frames = Object.keys(node.keyframes).map(Number).sort((a, b) => a - b);
  
  if (frames.length === 1) {
    const kf = node.keyframes[frames[0]];
    return {
      translate: { ...kf.translate },
      rotate: { ...kf.rotate },
      scale: { ...kf.scale }
    };
  }

  let prevFrame = null;
  let nextFrame = null;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f <= frame) {
      prevFrame = f;
    }
    if (f >= frame && nextFrame === null) {
      nextFrame = f;
    }
  }

  if (prevFrame === null) {
    prevFrame = frames[frames.length - 1];
    nextFrame = frames[0];
  } else if (nextFrame === null) {
    prevFrame = frames[frames.length - 1];
    nextFrame = frames[0];
  }

  if (prevFrame === nextFrame) {
    const kf = node.keyframes[prevFrame];
    return {
      translate: { ...kf.translate },
      rotate: { ...kf.rotate },
      scale: { ...kf.scale }
    };
  }

  let alpha = 0;
  if (nextFrame > prevFrame) {
    alpha = (frame - prevFrame) / (nextFrame - prevFrame);
  } else {
    const totalDist = (state.maxFrames - prevFrame) + nextFrame;
    const curDist = frame >= prevFrame ? (frame - prevFrame) : ((state.maxFrames - prevFrame) + frame);
    alpha = curDist / totalDist;
  }

  const kfPrev = node.keyframes[prevFrame];
  const kfNext = node.keyframes[nextFrame];

  const lerp = (a, b, t) => a + (b - a) * t;

  return {
    translate: {
      x: lerp(kfPrev.translate.x, kfNext.translate.x, alpha),
      y: lerp(kfPrev.translate.y, kfNext.translate.y, alpha),
      z: lerp(kfPrev.translate.z, kfNext.translate.z, alpha)
    },
    rotate: {
      x: lerp(kfPrev.rotate.x, kfNext.rotate.x, alpha),
      y: lerp(kfPrev.rotate.y, kfNext.rotate.y, alpha),
      z: lerp(kfPrev.rotate.z, kfNext.rotate.z, alpha)
    },
    scale: {
      x: lerp(kfPrev.scale.x, kfNext.scale.x, alpha),
      y: lerp(kfPrev.scale.y, kfNext.scale.y, alpha),
      z: lerp(kfPrev.scale.z, kfNext.scale.z, alpha)
    }
  };
}

function renderKeyframeMarkers() {
  const container = document.getElementById('keyframe-markers');
  if (!container) return;
  container.innerHTML = '';
  
  if (!state.selectedShapeId) return;
  const node = sceneGraph.find(n => n.id === state.selectedShapeId);
  if (!node || !node.keyframes) return;

  Object.keys(node.keyframes).forEach(frame => {
    const fNum = Number(frame);
    const percent = (fNum / state.maxFrames) * 100;
    const dot = document.createElement('div');
    dot.className = 'keyframe-dot';
    dot.style.left = `${percent}%`;
    container.appendChild(dot);
  });
}

function updateSceneAnimations() {
  if (!state.isAnimating && !state.isPlayingTimeline) return;

  // Increment timeline frame if playing
  if (state.isPlayingTimeline) {
    state.currentFrame++;
    if (state.currentFrame > state.maxFrames) {
      state.currentFrame = 0;
    }
    
    // Sync slider and labels
    const timelineSlider = document.getElementById('timeline-slider');
    if (timelineSlider) timelineSlider.value = state.currentFrame;
    const frameDisplay = document.getElementById('frame-display');
    if (frameDisplay) frameDisplay.innerText = `${state.currentFrame} / ${state.maxFrames}`;
  }

  // Node-specific animations (Keyframes / Spin / Hover)
  sceneGraph.forEach(node => {
    const zdogObj = zdogInstances[node.id];
    if (!zdogObj) return;

    if (node.keyframes && Object.keys(node.keyframes).length > 0) {
      const transform = interpolateTransform(node, state.currentFrame);
      zdogObj.translate.x = Number(transform.translate.x || 0);
      zdogObj.translate.y = Number(transform.translate.y || 0);
      zdogObj.translate.z = Number(transform.translate.z || 0);
      
      zdogObj.rotate.x = Number(transform.rotate.x || 0) * Math.PI / 180;
      zdogObj.rotate.y = Number(transform.rotate.y || 0) * Math.PI / 180;
      zdogObj.rotate.z = Number(transform.rotate.z || 0) * Math.PI / 180;
      
      zdogObj.scale.x = Number(transform.scale.x || 1);
      zdogObj.scale.y = Number(transform.scale.y || 1);
      zdogObj.scale.z = Number(transform.scale.z || 1);
    } else {
      // Auto Spin
      if (node.spinX) zdogObj.rotate.x += Number(node.spinX);
      if (node.spinY) zdogObj.rotate.y += Number(node.spinY);
      if (node.spinZ) zdogObj.rotate.z += Number(node.spinZ);

      // Hover
      if (node.hoverSpeed && node.hoverAmplitude) {
        if (!node.hoverTime) node.hoverTime = 0;
        node.hoverTime += Number(node.hoverSpeed);
        zdogObj.translate.y = Number(node.translate.y || 0) + Math.sin(node.hoverTime) * Number(node.hoverAmplitude);
      }
    }
  });

  // Global illustration spin (prevent conflict with Zdog mascot specific rotation)
  if (state.isAnimating && Number(state.autoSpinSpeedY) !== 0 && state.activePreset !== 'zdog') {
    illo.rotate.y += Number(state.autoSpinSpeedY);
    if (!state.selectedShapeId) {
      let ry_deg = Math.round((illo.rotate.y * 180 / Math.PI) % 360);
      if (ry_deg < 0) ry_deg += 360;
      inputRy.value = ry_deg;
      sliderRy.value = ry_deg;
    }
  }

  // Preset animations
  if (state.activePreset === 'zdog') {
    if (state.isAnimating) {
      if (typeof window.zdogTicker === 'undefined') window.zdogTicker = 0;
      const cycleCount = 180;
      const initRotateY = -50/360 * Zdog.TAU;
      const keyframes = [
        { y: 0 + initRotateY, z: 0 },
        { y: Zdog.TAU + initRotateY, z: 0 },
        { y: Zdog.TAU + initRotateY, z: Zdog.TAU },
      ];
      const turnLimit = keyframes.length - 1;
      
      const progress = window.zdogTicker / cycleCount;
      const tween = Zdog.easeInOut( progress % 1, 4 );
      const turn = Math.floor( progress % turnLimit );
      const keyA = keyframes[ turn ];
      const keyB = keyframes[ turn + 1 ];
      
      illo.rotate.y = Zdog.lerp( keyA.y, keyB.y, tween );
      illo.rotate.z = Zdog.lerp( keyA.z, keyB.z, tween );
      window.zdogTicker++;
      
      // Sync rotation inputs
      if (!state.selectedShapeId) {
        let ry_deg = Math.round((illo.rotate.y * 180 / Math.PI) % 360);
        let rz_deg = Math.round((illo.rotate.z * 180 / Math.PI) % 360);
        if (ry_deg < 0) ry_deg += 360;
        if (rz_deg < 0) rz_deg += 360;
        inputRy.value = ry_deg;
        sliderRy.value = ry_deg;
        inputRz.value = rz_deg;
        sliderRz.value = rz_deg;
      }
    }
  }
  else if (state.activePreset === 'solar') {
    if (zdogInstances['mercury_orbit']) zdogInstances['mercury_orbit'].rotate.y += 0.035;
    if (zdogInstances['venus_orbit']) zdogInstances['venus_orbit'].rotate.y += 0.022;
    if (zdogInstances['earth_orbit']) zdogInstances['earth_orbit'].rotate.y += 0.015;
    if (zdogInstances['moon_orbit']) zdogInstances['moon_orbit'].rotate.y += 0.05;
    if (zdogInstances['saturn_orbit']) zdogInstances['saturn_orbit'].rotate.y += 0.007;
  } 
  else if (state.activePreset === 'cyber') {
    carTime += 0.04;
    if (zdogInstances['flying_car']) {
      zdogInstances['flying_car'].translate.y = -35 + Math.sin(carTime) * 6;
      zdogInstances['flying_car'].translate.x = Math.sin(carTime * 0.5) * 15;
      zdogInstances['flying_car'].rotate.y += 0.01;
    }
  } 
  else if (state.activePreset === 'gyro') {
    if (zdogInstances['ring_outer']) zdogInstances['ring_outer'].rotate.x += 0.012;
    if (zdogInstances['ring_middle']) zdogInstances['ring_middle'].rotate.y += 0.018;
    if (zdogInstances['ring_inner']) zdogInstances['ring_inner'].rotate.z += 0.026;
    if (zdogInstances['gyro_core']) zdogInstances['gyro_core'].rotate.x -= 0.02;
  } 
  else if (state.activePreset === 'robot') {
    robotTime += 0.05;
    if (zdogInstances['robot_body']) zdogInstances['robot_body'].translate.y = Math.sin(robotTime) * 2;
    if (zdogInstances['arm_left']) zdogInstances['arm_left'].rotate.x = Math.sin(robotTime) * 0.5;
    if (zdogInstances['arm_right']) zdogInstances['arm_right'].rotate.x = -Math.sin(robotTime) * 0.5;
    if (zdogInstances['head']) zdogInstances['head'].rotate.y = Math.sin(robotTime * 0.3) * 0.2;
  }
}

// ==========================================
// HIERARCHY TREE RENDERER
// ==========================================

function renderHierarchy() {
  treeContainer.innerHTML = '';
  
  const rootNodes = sceneGraph.filter(n => n.parentId === null || n.parentId === '');
  if (rootNodes.length === 0) {
    treeContainer.innerHTML = '<li class="empty-tip">No shapes in hierarchy</li>';
    return;
  }

  rootNodes.forEach(node => {
    appendHierarchyItem(node, 0);
  });

  lucide.createIcons();
}

function appendHierarchyItem(node, depth) {
  const li = document.createElement('li');
  const isSelected = state.selectedShapeId === node.id;
  
  let iconName = 'box';
  if (node.type === 'Anchor') iconName = 'target';
  else if (node.type === 'Group') iconName = 'folder';
  else if (node.type === 'Cylinder') iconName = 'cylinder';
  else if (node.type === 'Cone') iconName = 'cone';
  else if (node.type === 'Ellipse') iconName = 'circle';
  else if (node.type === 'Rect' || node.type === 'RoundedRect') iconName = 'square';
  else if (node.type === 'Polygon') iconName = 'hexagon';

  li.className = `hierarchy-item indent-${depth} ${isSelected ? 'selected' : ''}`;
  li.dataset.id = node.id;

  li.innerHTML = `
    <i data-lucide="${iconName}" class="node-type-icon"></i>
    <span class="node-name" title="${node.name}">${node.name}</span>
    <div class="node-actions">
      <button class="hierarchy-action-btn visibility-toggle ${node.visible === false ? 'muted' : ''}" title="Toggle Visibility">
        <i data-lucide="${node.visible !== false ? 'eye' : 'eye-off'}"></i>
      </button>
    </div>
  `;

  li.addEventListener('click', (e) => {
    if (e.target.closest('.visibility-toggle')) {
      toggleNodeVisibility(node.id);
      return;
    }
    selectNode(node.id);
  });

  treeContainer.appendChild(li);

  const children = sceneGraph.filter(n => n.parentId === node.id);
  children.forEach(child => {
    appendHierarchyItem(child, depth + 1);
  });
}

function toggleNodeVisibility(id) {
  const node = sceneGraph.find(n => n.id === id);
  if (node) {
    node.visible = node.visible === undefined ? false : !node.visible;
    rebuildZdogScene();
    renderHierarchy();
    generateCode();
    if (state.selectedShapeId === id) {
      inputVisible.checked = node.visible;
    }
  }
}

function selectNode(id) {
  state.selectedShapeId = id;
  
  const items = treeContainer.querySelectorAll('.hierarchy-item');
  items.forEach(el => {
    if (el.dataset.id === id) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });

  if (id) {
    btnDeleteNode.disabled = false;
    btnCloneNode.disabled = false;
    const node = sceneGraph.find(n => n.id === id);
    activeNodeNameBadge.innerText = node.name;
    document.getElementById('active-viewport-mode').innerText = node.type;
  } else {
    btnDeleteNode.disabled = true;
    btnCloneNode.disabled = true;
    activeNodeNameBadge.innerText = 'Object';
    document.getElementById('active-viewport-mode').innerText = 'Modeling';
  }

  updatePropertiesPanel();
  renderKeyframeMarkers();
  if (typeof window.updateKeyframeButtonsState === 'function') {
    window.updateKeyframeButtonsState();
  }
}

// ==========================================
// PROPERTIES PANEL BINDING
// ==========================================

function updatePropertiesPanel() {
  if (!state.selectedShapeId) {
    let rx_deg = Math.round((illo.rotate.x * 180 / Math.PI) % 360);
    let ry_deg = Math.round((illo.rotate.y * 180 / Math.PI) % 360);
    let rz_deg = Math.round((illo.rotate.z * 180 / Math.PI) % 360);
    if (rx_deg < 0) rx_deg += 360;
    if (ry_deg < 0) ry_deg += 360;
    if (rz_deg < 0) rz_deg += 360;

    inputTx.value = 0; inputTy.value = 0; inputTz.value = 0;
    sliderTx.value = 0; sliderTy.value = 0; sliderTz.value = 0;
    inputRx.value = rx_deg; inputRy.value = ry_deg; inputRz.value = rz_deg;
    sliderRx.value = rx_deg; sliderRy.value = ry_deg; sliderRz.value = rz_deg;
    inputSx.value = 1; inputSy.value = 1; inputSz.value = 1;
    
    document.getElementById('card-material').style.opacity = '0.3';
    document.getElementById('card-material').querySelectorAll('input').forEach(i => i.disabled = true);
    document.getElementById('card-animation').style.opacity = '0.3';
    document.getElementById('card-animation').querySelectorAll('input').forEach(i => i.disabled = true);
    if (shapeSpecificBody) {
      shapeSpecificBody.innerHTML = '<p class="empty-tip">Global Viewport Selected.</p>';
    }
    return;
  }

  document.getElementById('card-material').style.opacity = '1';
  document.getElementById('card-material').querySelectorAll('input').forEach(i => i.disabled = false);
  document.getElementById('card-animation').style.opacity = '1';
  document.getElementById('card-animation').querySelectorAll('input').forEach(i => i.disabled = false);

  const node = sceneGraph.find(n => n.id === state.selectedShapeId);
  if (!node) return;

  // Position
  inputTx.value = node.translate.x; sliderTx.value = node.translate.x;
  inputTy.value = node.translate.y; sliderTy.value = node.translate.y;
  inputTz.value = node.translate.z; sliderTz.value = node.translate.z;

  // Rotation
  inputRx.value = node.rotate.x; sliderRx.value = node.rotate.x;
  inputRy.value = node.rotate.y; sliderRy.value = node.rotate.y;
  inputRz.value = node.rotate.z; sliderRz.value = node.rotate.z;

  // Scale
  inputSx.value = node.scale.x;
  inputSy.value = node.scale.y;
  inputSz.value = node.scale.z;

  // Styles
  if (node.type !== 'Anchor' && node.type !== 'Group') {
    inputColor.value = node.color || '#ff5c00';
    inputColorText.value = node.color || '#ff5c00';
    inputStroke.value = node.stroke !== undefined ? node.stroke : 8;
    strokeVal.innerText = node.stroke !== undefined ? node.stroke : 8;
    inputFill.checked = node.fill !== false;
    inputVisible.checked = node.visible !== false;
    inputClosed.checked = node.closed !== false;
    inputBackface.checked = node.backface !== false;
  }

  // Populate Animation Sliders
  const spinX = node.spinX || 0;
  const spinY = node.spinY || 0;
  const spinZ = node.spinZ || 0;
  const hoverSpeed = node.hoverSpeed || 0;
  const hoverAmp = node.hoverAmplitude || 0;

  document.getElementById('input-spin-x').value = spinX;
  document.getElementById('spin-x-val').innerText = Number(spinX).toFixed(3);
  document.getElementById('input-spin-y').value = spinY;
  document.getElementById('spin-y-val').innerText = Number(spinY).toFixed(3);
  document.getElementById('input-spin-z').value = spinZ;
  document.getElementById('spin-z-val').innerText = Number(spinZ).toFixed(3);
  document.getElementById('input-hover-speed').value = hoverSpeed;
  document.getElementById('hover-speed-val').innerText = Number(hoverSpeed).toFixed(3);
  document.getElementById('input-hover-amp').value = hoverAmp;
  document.getElementById('hover-amp-val').innerText = hoverAmp;

  injectShapeGeometryFields(node);
}

function injectShapeGeometryFields(node) {
  if (!shapeSpecificBody) return;
  shapeSpecificBody.innerHTML = '';
  if (node.type === 'Anchor' || node.type === 'Group') {
    shapeSpecificBody.innerHTML = '<p class="empty-tip">Structural node. No geometry settings.</p>';
    return;
  }

  let html = '';
  if (node.type === 'Box') {
    html = `
      <div class="property-row">
        <label>Width</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="width" min="1" max="150" value="${node.width !== undefined ? node.width : 20}">
          <span class="value-text">${node.width !== undefined ? node.width : 20}</span>
        </div>
      </div>
      <div class="property-row">
        <label>Height</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="height" min="1" max="150" value="${node.height !== undefined ? node.height : 20}">
          <span class="value-text">${node.height !== undefined ? node.height : 20}</span>
        </div>
      </div>
      <div class="property-row">
        <label>Depth</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="depth" min="1" max="150" value="${node.depth !== undefined ? node.depth : 20}">
          <span class="value-text">${node.depth !== undefined ? node.depth : 20}</span>
        </div>
      </div>
    `;
  } 
  else if (node.type === 'Cylinder' || node.type === 'Cone') {
    html = `
      <div class="property-row">
        <label>Diameter</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="diameter" min="1" max="150" value="${node.diameter !== undefined ? node.diameter : 20}">
          <span class="value-text">${node.diameter !== undefined ? node.diameter : 20}</span>
        </div>
      </div>
      <div class="property-row">
        <label>Length</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="length" min="1" max="150" value="${node.length !== undefined ? node.length : 30}">
          <span class="value-text">${node.length !== undefined ? node.length : 30}</span>
        </div>
      </div>
    `;
  } 
  else if (node.type === 'Hemisphere') {
    html = `
      <div class="property-row">
        <label>Diameter</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="diameter" min="1" max="150" value="${node.diameter !== undefined ? node.diameter : 20}">
          <span class="value-text">${node.diameter !== undefined ? node.diameter : 20}</span>
        </div>
      </div>
    `;
  } 
  else if (node.type === 'Ellipse') {
    html = `
      <div class="property-row">
        <label>Diameter</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="diameter" min="1" max="250" value="${node.diameter !== undefined ? node.diameter : 25}">
          <span class="value-text">${node.diameter !== undefined ? node.diameter : 25}</span>
        </div>
      </div>
      <div class="property-row">
        <label>Quarters</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="quarters" min="1" max="4" step="1" value="${node.quarters !== undefined ? node.quarters : 4}">
          <span class="value-text">${node.quarters !== undefined ? node.quarters : 4}</span>
        </div>
      </div>
    `;
  } 
  else if (node.type === 'Rect') {
    html = `
      <div class="property-row">
        <label>Width</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="width" min="1" max="200" value="${node.width !== undefined ? node.width : 20}">
          <span class="value-text">${node.width !== undefined ? node.width : 20}</span>
        </div>
      </div>
      <div class="property-row">
        <label>Height</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="height" min="1" max="200" value="${node.height !== undefined ? node.height : 20}">
          <span class="value-text">${node.height !== undefined ? node.height : 20}</span>
        </div>
      </div>
    `;
  } 
  else if (node.type === 'RoundedRect') {
    html = `
      <div class="property-row">
        <label>Width</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="width" min="1" max="200" value="${node.width !== undefined ? node.width : 20}">
          <span class="value-text">${node.width !== undefined ? node.width : 20}</span>
        </div>
      </div>
      <div class="property-row">
        <label>Height</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="height" min="1" max="200" value="${node.height !== undefined ? node.height : 20}">
          <span class="value-text">${node.height !== undefined ? node.height : 20}</span>
        </div>
      </div>
      <div class="property-row">
        <label>Radius</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="cornerRadius" min="0" max="50" value="${node.cornerRadius !== undefined ? node.cornerRadius : 4}">
          <span class="value-text">${node.cornerRadius !== undefined ? node.cornerRadius : 4}</span>
        </div>
      </div>
    `;
  } 
  else if (node.type === 'Polygon') {
    html = `
      <div class="property-row">
        <label>Radius</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="radius" min="1" max="150" value="${node.radius !== undefined ? node.radius : 15}">
          <span class="value-text">${node.radius !== undefined ? node.radius : 15}</span>
        </div>
      </div>
      <div class="property-row">
        <label>Sides</label>
        <div class="slider-wrapper">
          <input type="range" class="geom-slider" data-prop="sides" min="3" max="12" step="1" value="${node.sides !== undefined ? node.sides : 6}">
          <span class="value-text">${node.sides !== undefined ? node.sides : 6}</span>
        </div>
      </div>
    `;
  } else if (node.type === 'Shape') {
    html = `
      <div class="property-row">
        <label>Points</label>
        <span class="value-text" style="font-weight: 600;">${node.path ? node.path.length : 0} points</span>
      </div>
    `;
  }

  shapeSpecificBody.innerHTML = html;

  shapeSpecificBody.querySelectorAll('.geom-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const prop = e.target.dataset.prop;
      const val = Number(e.target.value);
      node[prop] = val;
      e.target.nextElementSibling.innerText = val;
      rebuildZdogScene();
      generateCode();
    });
  });
}

function setupPropertyListeners() {
  inputColor.addEventListener('input', (e) => {
    inputColorText.value = e.target.value.toUpperCase();
    updateSelectedNodeProp('color', e.target.value);
  });
  inputColorText.addEventListener('input', (e) => {
    let color = e.target.value;
    if (color.startsWith('#') && color.length === 7) {
      inputColor.value = color;
      updateSelectedNodeProp('color', color);
    }
  });

  inputBgColor.addEventListener('input', (e) => {
    inputBgColorText.value = e.target.value.toUpperCase();
    canvas.style.backgroundColor = e.target.value;
    state.bgColor = e.target.value;
    generateCode();
  });
  inputBgColorText.addEventListener('input', (e) => {
    let color = e.target.value;
    if (color.startsWith('#') && color.length === 7) {
      inputBgColor.value = color;
      canvas.style.backgroundColor = color;
      state.bgColor = color;
      generateCode();
    }
  });

  // Global Zoom Slider
  inputGlobalZoom.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    state.zoom = val;
    zoomVal.innerText = val.toFixed(1);
    generateCode();
  });

  // Global Auto Spin
  inputSpinSpeedY.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    state.autoSpinSpeedY = val;
    spinYVal.innerText = val.toFixed(3);
  });

  // Sync range inputs with number boxes
  function setupInputSync(slider, numInput, axis, transformType) {
    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      numInput.value = val;
      if (!state.selectedShapeId) {
        if (transformType === 'rotate') {
          illo.rotate[axis] = val * Math.PI / 180;
          illo.updateRenderGraph();
        }
      } else {
        updateSelectedNodeTransform(transformType, axis, val);
      }
    });

    numInput.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      slider.value = val;
      if (!state.selectedShapeId) {
        if (transformType === 'rotate') {
          illo.rotate[axis] = val * Math.PI / 180;
          illo.updateRenderGraph();
        }
      } else {
        updateSelectedNodeTransform(transformType, axis, val);
      }
    });
  }

  setupInputSync(sliderTx, inputTx, 'x', 'translate');
  setupInputSync(sliderTy, inputTy, 'y', 'translate');
  setupInputSync(sliderTz, inputTz, 'z', 'translate');

  setupInputSync(sliderRx, inputRx, 'x', 'rotate');
  setupInputSync(sliderRy, inputRy, 'y', 'rotate');
  setupInputSync(sliderRz, inputRz, 'z', 'rotate');

  // Scale bindings
  const bindScale = (inputEl, axis) => {
    inputEl.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      updateSelectedNodeTransform('scale', axis, val);
    });
  };
  bindScale(inputSx, 'x');
  bindScale(inputSy, 'y');
  bindScale(inputSz, 'z');

  // Aesthetic adjustments
  inputStroke.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    strokeVal.innerText = val;
    updateSelectedNodeProp('stroke', val);
  });

  inputFill.addEventListener('change', (e) => {
    updateSelectedNodeProp('fill', e.target.checked);
  });
  inputVisible.addEventListener('change', (e) => {
    updateSelectedNodeProp('visible', e.target.checked);
    renderHierarchy();
  });
  inputClosed.addEventListener('change', (e) => {
    updateSelectedNodeProp('closed', e.target.checked);
  });
  inputBackface.addEventListener('change', (e) => {
    updateSelectedNodeProp('backface', e.target.checked);
  });

  // Segmented control toggling for Auto Zoom
  const autoZoomSegment = document.getElementById('toggle-auto-zoom');
  autoZoomSegment.querySelectorAll('.segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      autoZoomSegment.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.autoZoom = btn.dataset.value;
      if (state.autoZoom === 'yes') {
        fitToScreen();
      }
    });
  });

  // Selector mappings
  document.getElementById('select-frame-size').addEventListener('change', (e) => {
    const size = e.target.value;
    if (size === 'responsive') {
      canvas.width = 850;
      canvas.height = 650;
    } else if (size === '1080') {
      canvas.width = 1200;
      canvas.height = 700;
    } else if (size === '720') {
      canvas.width = 960;
      canvas.height = 540;
    } else {
      canvas.width = 700;
      canvas.height = 700;
    }
    illo.updateRenderGraph();
  });

  document.getElementById('select-camera-type').addEventListener('change', (e) => {
    const cam = e.target.value;
    toggleCameraView(cam);
  });

  // Save history on change of control elements (slider release, checkbox toggle, number input blur)
  const sliders = [sliderTx, sliderTy, sliderTz, sliderRx, sliderRy, sliderRz, inputStroke, inputGlobalZoom, inputSpinSpeedY];
  sliders.forEach(slider => {
    if (slider) {
      slider.addEventListener('change', () => {
        saveHistory();
      });
    }
  });

  const inputsToTrack = [inputTx, inputTy, inputTz, inputRx, inputRy, inputRz, inputSx, inputSy, inputSz, inputColor, inputColorText, inputBgColor, inputBgColorText];
  inputsToTrack.forEach(inputEl => {
    if (inputEl) {
      inputEl.addEventListener('change', () => {
        saveHistory();
      });
    }
  });

  const togglesToTrack = [inputFill, inputVisible, inputClosed, inputBackface];
  togglesToTrack.forEach(toggleEl => {
    if (toggleEl) {
      toggleEl.addEventListener('change', () => {
        saveHistory();
      });
    }
  });

  // Node-specific Animation inputs listeners
  const bindAnimSlider = (sliderId, labelId, propName) => {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (label) {
          label.innerText = propName === 'hoverAmplitude' ? val : val.toFixed(3);
        }
        updateSelectedNodeProp(propName, val);
      });
      slider.addEventListener('change', () => {
        saveHistory();
      });
    }
  };

  bindAnimSlider('input-spin-x', 'spin-x-val', 'spinX');
  bindAnimSlider('input-spin-y', 'spin-y-val', 'spinY');
  bindAnimSlider('input-spin-z', 'spin-z-val', 'spinZ');
  bindAnimSlider('input-hover-speed', 'hover-speed-val', 'hoverSpeed');
  bindAnimSlider('input-hover-amp', 'hover-amp-val', 'hoverAmplitude');
}

function fitToScreen() {
  // Center shapes or adjust zoom
  state.zoom = state.activePreset === 'solar' ? 2.4 : state.activePreset === 'cyber' ? 2.2 : 3.0;
  inputGlobalZoom.value = state.zoom;
  zoomVal.innerText = state.zoom.toFixed(1);
}

function toggleCameraView(mode) {
  state.cameraType = mode;
  document.getElementById('select-camera-type').value = mode;
  
  // Highlight in top hud dropdown
  document.querySelectorAll('#camera-dropdown-menu .menu-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cam === mode);
  });
}

function updateSelectedNodeTransform(type, axis, value) {
  if (!state.selectedShapeId) return;
  const node = sceneGraph.find(n => n.id === state.selectedShapeId);
  if (node) {
    node[type][axis] = value;
    rebuildZdogScene();
    generateCode();
  }
}

function updateSelectedNodeProp(prop, value) {
  if (!state.selectedShapeId) return;
  const node = sceneGraph.find(n => n.id === state.selectedShapeId);
  if (node) {
    node[prop] = value;
    rebuildZdogScene();
    generateCode();
  }
}

// ==========================================
// SCENE MODIFICATIONS (ADD, DELETE, CLONE)
// ==========================================

function addShapeToScene(type) {
  saveHistory();
  const newId = `${type.toLowerCase()}_${Date.now().toString().slice(-4)}`;
  let parentId = null;
  if (state.selectedShapeId) {
    const parentNode = sceneGraph.find(n => n.id === state.selectedShapeId);
    if (parentNode) {
      if (parentNode.type === 'Group' || parentNode.type === 'Anchor') {
        parentId = parentNode.id;
      } else {
        parentId = parentNode.parentId;
      }
    }
  }

  const newNode = {
    id: newId,
    type: type,
    name: `New ${type}`,
    parentId: parentId,
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  };

  if (type !== 'Anchor' && type !== 'Group') {
    newNode.color = '#ff5c00';
    newNode.stroke = 8;
    newNode.fill = true;
    newNode.visible = true;
    newNode.closed = true;
    newNode.backface = true;
  }

  if (type === 'Box') {
    newNode.width = 25; newNode.height = 25; newNode.depth = 25;
  } else if (type === 'Cylinder' || type === 'Cone') {
    newNode.diameter = 20; newNode.length = 30;
  } else if (type === 'Hemisphere') {
    newNode.diameter = 20;
  } else if (type === 'Ellipse') {
    newNode.diameter = 30; newNode.quarters = 4;
  } else if (type === 'Rect' || type === 'RoundedRect') {
    newNode.width = 30; newNode.height = 20;
    if (type === 'RoundedRect') newNode.cornerRadius = 4;
  } else if (type === 'Polygon') {
    newNode.radius = 18; newNode.sides = 6;
  }

  sceneGraph.push(newNode);
  rebuildZdogScene();
  renderHierarchy();
  selectNode(newId);
  generateCode();
}

function deleteSelectedNode() {
  if (!state.selectedShapeId) return;
  saveHistory();
  const idToDelete = state.selectedShapeId;
  const idsToDelete = [idToDelete];
  
  function collectDescendants(parentId) {
    const children = sceneGraph.filter(n => n.parentId === parentId);
    children.forEach(child => {
      idsToDelete.push(child.id);
      collectDescendants(child.id);
    });
  }
  collectDescendants(idToDelete);

  sceneGraph = sceneGraph.filter(n => !idsToDelete.includes(n.id));
  state.selectedShapeId = null;
  rebuildZdogScene();
  renderHierarchy();
  selectNode(null);
  generateCode();
}

function cloneSelectedNode() {
  if (!state.selectedShapeId) return;
  saveHistory();
  const sourceNode = sceneGraph.find(n => n.id === state.selectedShapeId);
  if (!sourceNode) return;

  const cloneMap = {};
  const nodesToDuplicate = [];

  function collectNodeAndChildren(nodeId, newParentId) {
    const node = sceneGraph.find(n => n.id === nodeId);
    if (!node) return;

    const newId = `${node.type.toLowerCase()}_${Date.now().toString().slice(-4)}_${Math.round(Math.random() * 100)}`;
    cloneMap[nodeId] = newId;

    const duplicate = JSON.parse(JSON.stringify(node));
    duplicate.id = newId;
    duplicate.name = `${node.name} Copy`;
    duplicate.parentId = newParentId;
    
    if (nodeId === state.selectedShapeId) {
      duplicate.translate.x += 15;
      duplicate.translate.y += 15;
    }

    nodesToDuplicate.push(duplicate);

    const children = sceneGraph.filter(n => n.parentId === nodeId);
    children.forEach(child => {
      collectNodeAndChildren(child.id, newId);
    });
  }

  collectNodeAndChildren(state.selectedShapeId, sourceNode.parentId);
  sceneGraph.push(...nodesToDuplicate);

  rebuildZdogScene();
  renderHierarchy();
  selectNode(cloneMap[state.selectedShapeId]);
  generateCode();
}

// ==========================================
// CODE GENERATION ENGINE
// ==========================================

function generateCode() {
  if (!illo) return;
  let code = `// Zdog Pseudo-3D Illustration
// Live Export from Zdog Studio

const illo = new Zdog.Illustration({
  element: '.zdog-canvas',
  zoom: ${state.zoom.toFixed(1)},
  dragRotate: true,
  rotate: { x: ${illo.rotate.x.toFixed(3)}, y: ${illo.rotate.y.toFixed(3)}, z: ${illo.rotate.z.toFixed(3)} }
});

const mainScene = new Zdog.Anchor({
  addTo: illo
});

const shapes = {};
`;

  let hasKeyframes = sceneGraph.some(n => n.keyframes && Object.keys(n.keyframes).length > 0);
  if (hasKeyframes) {
    code += `
const lerp = (a, b, t) => a + (b - a) * t;
function interpolate(kfs, frame, maxFrames) {
  const frames = Object.keys(kfs).map(Number).sort((a, b) => a - b);
  if (frames.length === 1) return kfs[frames[0]];
  let prev = null, next = null;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i] <= frame) prev = frames[i];
    if (frames[i] >= frame && next === null) next = frames[i];
  }
  if (prev === null) { prev = frames[frames.length - 1]; next = frames[0]; }
  else if (next === null) { prev = frames[frames.length - 1]; next = frames[0]; }
  if (prev === next) return kfs[prev];
  let alpha = 0;
  if (next > prev) alpha = (frame - prev) / (next - prev);
  else alpha = (frame >= prev ? (frame - prev) : ((maxFrames - prev) + frame)) / ((maxFrames - prev) + next);
  const kfPrev = kfs[prev];
  const kfNext = kfs[next];
  return {
    translate: { x: lerp(kfPrev.translate.x, kfNext.translate.x, alpha), y: lerp(kfPrev.translate.y, kfNext.translate.y, alpha), z: lerp(kfPrev.translate.z, kfNext.translate.z, alpha) },
    rotate: { x: lerp(kfPrev.rotate.x, kfNext.rotate.x, alpha), y: lerp(kfPrev.rotate.y, kfNext.rotate.y, alpha), z: lerp(kfPrev.rotate.z, kfNext.rotate.z, alpha) },
    scale: { x: lerp(kfPrev.scale.x, kfNext.scale.x, alpha), y: lerp(kfPrev.scale.y, kfNext.scale.y, alpha), z: lerp(kfPrev.scale.z, kfNext.scale.z, alpha) }
  };
}
`;
  }

  const sortedNodes = [];
  const visited = new Set();

  function visit(node) {
    if (visited.has(node.id)) return;
    if (node.parentId) {
      const parent = sceneGraph.find(n => n.id === node.parentId);
      if (parent) visit(parent);
    }
    visited.add(node.id);
    sortedNodes.push(node);
  }

  sceneGraph.forEach(n => visit(n));

  sortedNodes.forEach(node => {
    let parentVar = node.parentId ? `shapes['${node.parentId}']` : 'mainScene';
    code += `\n// ${node.name}\nshapes['${node.id}'] = new Zdog.${node.type}({\n`;
    code += `  addTo: ${parentVar},\n`;
    
    if (node.translate.x !== 0 || node.translate.y !== 0 || node.translate.z !== 0) {
      code += `  translate: { x: ${node.translate.x}, y: ${node.translate.y}, z: ${node.translate.z} },\n`;
    }
    if (node.rotate.x !== 0 || node.rotate.y !== 0 || node.rotate.z !== 0) {
      let rx_rad = (node.rotate.x * Math.PI / 180).toFixed(4);
      let ry_rad = (node.rotate.y * Math.PI / 180).toFixed(4);
      let rz_rad = (node.rotate.z * Math.PI / 180).toFixed(4);
      code += `  rotate: { x: ${rx_rad}, y: ${ry_rad}, z: ${rz_rad} },\n`;
    }
    if (node.scale.x !== 1 || node.scale.y !== 1 || node.scale.z !== 1) {
      code += `  scale: { x: ${node.scale.x}, y: ${node.scale.y}, z: ${node.scale.z} },\n`;
    }

    if (node.type !== 'Anchor' && node.type !== 'Group') {
      code += `  color: '${node.color}',\n`;
      code += `  stroke: ${node.stroke},\n`;
      if (node.fill !== true) code += `  fill: false,\n`;
      if (node.visible === false) code += `  visible: false,\n`;
      if (node.closed === false) code += `  closed: false,\n`;
      if (node.backface === false) code += `  backface: false,\n`;
    }

    if (node.type === 'Box') {
      code += `  width: ${node.width || 20},\n`;
      code += `  height: ${node.height || 20},\n`;
      code += `  depth: ${node.depth || 20},\n`;
    } else if (node.type === 'Cylinder' || node.type === 'Cone') {
      code += `  diameter: ${node.diameter || 20},\n`;
      code += `  length: ${node.length || 30},\n`;
    } else if (node.type === 'Hemisphere') {
      code += `  diameter: ${node.diameter || 20},\n`;
    } else if (node.type === 'Ellipse') {
      code += `  diameter: ${node.diameter || 25},\n`;
      if (node.quarters !== 4) code += `  quarters: ${node.quarters},\n`;
    } else if (node.type === 'Rect') {
      code += `  width: ${node.width || 20},\n`;
      code += `  height: ${node.height || 20},\n`;
    } else if (node.type === 'RoundedRect') {
      code += `  width: ${node.width || 20},\n`;
      code += `  height: ${node.height || 20},\n`;
      code += `  cornerRadius: ${node.cornerRadius || 4},\n`;
    } else if (node.type === 'Polygon') {
      code += `  radius: ${node.radius || 15},\n`;
      code += `  sides: ${node.sides || 6},\n`;
    } else if (node.type === 'Shape') {
      const pathStr = JSON.stringify(node.path || []);
      code += `  path: ${pathStr},\n`;
    }

    if (code.endsWith(',\n')) {
      code = code.slice(0, -2) + '\n';
    }
    code += `});\n`;
  });

  code += `\n// Animation loop\n`;
  code += `function animate() {\n`;
  if (state.autoSpinSpeedY !== 0) {
    code += `  illo.rotate.y += ${state.autoSpinSpeedY};\n`;
  }
  
  if (hasKeyframes) {
    code += `  if (typeof currentFrame === 'undefined') window.currentFrame = 0;\n`;
    code += `  window.currentFrame = (window.currentFrame + 1) % ${state.maxFrames};\n`;
  }

  sceneGraph.forEach(node => {
    const isAnimated = node.spinX || node.spinY || node.spinZ || (node.hoverSpeed && node.hoverAmplitude) || (node.keyframes && Object.keys(node.keyframes).length > 0);
    if (isAnimated) {
      code += `  if (shapes['${node.id}']) {\n`;
      if (node.keyframes && Object.keys(node.keyframes).length > 0) {
        code += `    const transform = interpolate(${JSON.stringify(node.keyframes)}, window.currentFrame, ${state.maxFrames});\n`;
        code += `    shapes['${node.id}'].translate = transform.translate;\n`;
        code += `    shapes['${node.id}'].rotate = {\n`;
        code += `      x: transform.rotate.x * Math.PI / 180,\n`;
        code += `      y: transform.rotate.y * Math.PI / 180,\n`;
        code += `      z: transform.rotate.z * Math.PI / 180\n`;
        code += `    };\n`;
        code += `    shapes['${node.id}'].scale = transform.scale;\n`;
      } else {
        if (node.spinX) code += `    shapes['${node.id}'].rotate.x += ${node.spinX};\n`;
        if (node.spinY) code += `    shapes['${node.id}'].rotate.y += ${node.spinY};\n`;
        if (node.spinZ) code += `    shapes['${node.id}'].rotate.z += ${node.spinZ};\n`;
        if (node.hoverSpeed && node.hoverAmplitude) {
          code += `    if (!shapes['${node.id}'].hoverTime) shapes['${node.id}'].hoverTime = 0;\n`;
          code += `    shapes['${node.id}'].hoverTime += ${node.hoverSpeed};\n`;
          code += `    shapes['${node.id}'].translate.y = ${node.translate.y} + Math.sin(shapes['${node.id}'].hoverTime) * ${node.hoverAmplitude};\n`;
        }
      }
      code += `  }\n`;
    }
  });
  
  if (state.activePreset === 'zdog') {
    code += `  if (typeof zdogTicker === 'undefined') window.zdogTicker = 0;\n`;
    code += `  const cycleCount = 180;\n`;
    code += `  const initRotateY = -50/360 * Zdog.TAU;\n`;
    code += `  const keyframes = [\n`;
    code += `    { y: 0 + initRotateY, z: 0 },\n`;
    code += `    { y: Zdog.TAU + initRotateY, z: 0 },\n`;
    code += `    { y: Zdog.TAU + initRotateY, z: Zdog.TAU }\n`;
    code += `  ];\n`;
    code += `  const turnLimit = keyframes.length - 1;\n`;
    code += `  const progress = window.zdogTicker / cycleCount;\n`;
    code += `  const tween = Zdog.easeInOut( progress % 1, 4 );\n`;
    code += `  const turn = Math.floor( progress % turnLimit );\n`;
    code += `  const keyA = keyframes[ turn ];\n`;
    code += `  const keyB = keyframes[ turn + 1 ];\n`;
    code += `  illo.rotate.y = Zdog.lerp( keyA.y, keyB.y, tween );\n`;
    code += `  illo.rotate.z = Zdog.lerp( keyA.z, keyB.z, tween );\n`;
    code += `  window.zdogTicker++;\n`;
  } else if (state.activePreset === 'solar') {
    code += `  if (shapes['mercury_orbit']) shapes['mercury_orbit'].rotate.y += 0.035;\n`;
    code += `  if (shapes['venus_orbit']) shapes['venus_orbit'].rotate.y += 0.022;\n`;
    code += `  if (shapes['earth_orbit']) shapes['earth_orbit'].rotate.y += 0.015;\n`;
    code += `  if (shapes['moon_orbit']) shapes['moon_orbit'].rotate.y += 0.05;\n`;
    code += `  if (shapes['saturn_orbit']) shapes['saturn_orbit'].rotate.y += 0.007;\n`;
  } else if (state.activePreset === 'cyber') {
    code += `  if (typeof carTime === 'undefined') window.carTime = 0;\n`;
    code += `  window.carTime += 0.04;\n`;
    code += `  if (shapes['flying_car']) {\n`;
    code += `    shapes['flying_car'].translate.y = -35 + Math.sin(window.carTime) * 6;\n`;
    code += `    shapes['flying_car'].translate.x = Math.sin(window.carTime * 0.5) * 15;\n`;
    code += `    shapes['flying_car'].rotate.y += 0.01;\n`;
    code += `  }\n`;
  } else if (state.activePreset === 'gyro') {
    code += `  if (shapes['ring_outer']) shapes['ring_outer'].rotate.x += 0.012;\n`;
    code += `  if (shapes['ring_middle']) shapes['ring_middle'].rotate.y += 0.018;\n`;
    code += `  if (shapes['ring_inner']) shapes['ring_inner'].rotate.z += 0.026;\n`;
  } else if (state.activePreset === 'robot') {
    code += `  if (typeof robotTime === 'undefined') window.robotTime = 0;\n`;
    code += `  window.robotTime += 0.05;\n`;
    code += `  if (shapes['robot_body']) shapes['robot_body'].translate.y = Math.sin(window.robotTime) * 2;\n`;
    code += `  if (shapes['arm_left']) shapes['arm_left'].rotate.x = Math.sin(window.robotTime) * 0.5;\n`;
    code += `  if (shapes['arm_right']) shapes['arm_right'].rotate.x = -Math.sin(window.robotTime) * 0.5;\n`;
    code += `  if (shapes['head']) shapes['head'].rotate.y = Math.sin(window.robotTime * 0.3) * 0.2;\n`;
  }

  code += `  illo.updateRenderGraph();\n`;
  code += `  requestAnimationFrame(animate);\n`;
  code += `}\n`;
  code += `animate();\n`;

  codeOutput.innerHTML = highlightJS(code);
}

function highlightJS(codeText) {
  return codeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(['"`][^'`"]*['"`])/g, '<span class="code-string">$1</span>')
    .replace(/(\/\/.*)/g, '<span class="code-comment">$1</span>')
    .replace(/\b(let|const|var|new|function|return|false|true)\b/g, '<span class="code-keyword">$1</span>')
    .replace(/\b(Zdog\.[a-zA-Z]+)\b/g, '<span class="code-class">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="code-number">$1</span>')
    .replace(/\b([a-zA-Z0-9_]+)(?=\s*:)/g, '<span class="code-property">$1</span>');
}

// ==========================================
// EXPORTS & TRIGGER EFFECTS
// ==========================================

function exportSVG() {
  const svgWrapper = document.createElement('div');
  const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tempSvg.setAttribute('width', '800');
  tempSvg.setAttribute('height', '600');
  svgWrapper.appendChild(tempSvg);

  const tempIllo = new Zdog.Illustration({
    element: tempSvg,
    zoom: state.zoom,
    rotate: illo.rotate
  });

  const tempAnchor = new Zdog.Anchor({ addTo: tempIllo });
  const rootNodes = sceneGraph.filter(n => n.parentId === null || n.parentId === '');
  
  function tempCreateNode(node, parentAnchor) {
    let options = {
      addTo: parentAnchor,
      translate: node.translate,
      rotate: {
        x: Number(node.rotate.x || 0) * Math.PI / 180,
        y: Number(node.rotate.y || 0) * Math.PI / 180,
        z: Number(node.rotate.z || 0) * Math.PI / 180
      },
      scale: node.scale
    };

    if (node.type !== 'Anchor' && node.type !== 'Group') {
      options.color = node.color;
      options.stroke = node.stroke;
      options.fill = node.fill;
      options.visible = node.visible;
      options.closed = node.closed;
      options.backface = node.backface;
    }

    if (node.type === 'Box') {
      options.width = node.width; options.height = node.height; options.depth = node.depth;
    } else if (node.type === 'Cylinder' || node.type === 'Cone') {
      options.diameter = node.diameter; options.length = node.length;
    } else if (node.type === 'Hemisphere') {
      options.diameter = node.diameter;
    } else if (node.type === 'Ellipse') {
      options.diameter = node.diameter; options.quarters = node.quarters;
    } else if (node.type === 'Rect') {
      options.width = node.width; options.height = node.height;
    } else if (node.type === 'RoundedRect') {
      options.width = node.width; options.height = node.height; options.cornerRadius = node.cornerRadius;
    } else if (node.type === 'Polygon') {
      options.radius = node.radius; options.sides = node.sides;
    } else if (node.type === 'Shape') {
      options.path = node.path || [{ x: 0, y: 0, z: 0 }];
    }

    let obj;
    switch (node.type) {
      case 'Anchor': obj = new Zdog.Anchor(options); break;
      case 'Group': obj = new Zdog.Group(options); break;
      case 'Box': obj = new Zdog.Box(options); break;
      case 'Cylinder': obj = new Zdog.Cylinder(options); break;
      case 'Cone': obj = new Zdog.Cone(options); break;
      case 'Hemisphere': obj = new Zdog.Hemisphere(options); break;
      case 'Ellipse': obj = new Zdog.Ellipse(options); break;
      case 'Rect': obj = new Zdog.Rect(options); break;
      case 'RoundedRect': obj = new Zdog.RoundedRect(options); break;
      case 'Polygon': obj = new Zdog.Polygon(options); break;
      case 'Shape': obj = new Zdog.Shape(options); break;
    }

    const children = sceneGraph.filter(n => n.parentId === node.id);
    children.forEach(child => tempCreateNode(child, obj));
  }

  rootNodes.forEach(node => tempCreateNode(node, tempAnchor));
  tempIllo.updateRenderGraph();

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(tempSvg);
  source = source.replace('<svg', `<svg style="background-color: ${state.bgColor};"`);

  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zdog_scene_${state.activePreset}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPNG() {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const ctx = tempCanvas.getContext('2d');
  
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  ctx.drawImage(canvas, 0, 0);

  const url = tempCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `zdog_scene_${state.activePreset}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function triggerRenderFlash() {
  const wrapper = document.getElementById('canvas-wrapper');
  wrapper.style.transition = 'none';
  wrapper.style.boxShadow = '0 0 100px rgba(255, 92, 0, 0.4)';
  setTimeout(() => {
    wrapper.style.transition = 'box-shadow 0.8s ease-out';
    wrapper.style.boxShadow = 'none';
  }, 50);
}

function saveProjectZD3D() {
  const projectData = {
    version: "1.0",
    state: {
      zoom: state.zoom,
      autoSpinSpeedY: state.autoSpinSpeedY,
      bgColor: state.bgColor,
      showGrid: state.showGrid,
      cameraType: state.cameraType
    },
    sceneGraph: sceneGraph
  };
  const jsonString = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `project.zd3d`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadProjectZD3D(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && Array.isArray(data.sceneGraph)) {
        saveHistory(); // save history before loading
        sceneGraph = data.sceneGraph;
        
        // Restore state if available
        if (data.state) {
          if (data.state.zoom !== undefined) state.zoom = Number(data.state.zoom);
          if (data.state.autoSpinSpeedY !== undefined) state.autoSpinSpeedY = Number(data.state.autoSpinSpeedY);
          if (data.state.bgColor !== undefined) {
            state.bgColor = data.state.bgColor;
            canvas.style.backgroundColor = state.bgColor;
            if (inputBgColor) inputBgColor.value = state.bgColor;
            if (inputBgColorText) inputBgColorText.value = state.bgColor.toUpperCase();
          }
          if (data.state.showGrid !== undefined) {
            state.showGrid = Boolean(data.state.showGrid);
            btnToggleGrid.classList.toggle('active', state.showGrid);
          }
          if (data.state.cameraType !== undefined) {
            state.cameraType = data.state.cameraType;
            toggleCameraView(state.cameraType);
          }
        }
        
        // Reset selections
        state.selectedShapeId = null;
        
        // Clear history stacks since we loaded a fresh file
        undoStack.length = 0;
        redoStack.length = 0;
        updateUndoRedoButtons();
        
        // Rebuild and render
        rebuildZdogScene();
        renderHierarchy();
        updatePropertiesPanel();
        generateCode();
        
        console.log("Project loaded successfully!");
      } else {
        alert("Invalid .zd3d project file.");
      }
    } catch (err) {
      console.error(err);
      alert("Error parsing .zd3d file: " + err.message);
    }
  };
  reader.readAsText(file);
}

function getLocal3DCoordinates(mouseX, mouseY) {
  // 1. Scale down by zoom
  let x = mouseX / state.zoom;
  let y = mouseY / state.zoom;
  let z = 0; // Assume screen plane has z = 0

  // Get current illo rotation
  const rx = illo.rotate.x || 0;
  const ry = illo.rotate.y || 0;
  const rz = illo.rotate.z || 0;

  // Apply inverse rotations in reverse order: Z -> Y -> X
  
  // Un-rotate Z (angle: -rz)
  const cosZ = Math.cos(-rz);
  const sinZ = Math.sin(-rz);
  let x1 = x * cosZ - y * sinZ;
  let y1 = x * sinZ + y * cosZ;
  let z1 = z;

  // Un-rotate Y (angle: -ry)
  const cosY = Math.cos(-ry);
  const sinY = Math.sin(-ry);
  let x2 = x1 * cosY + z1 * sinY;
  let y2 = y1;
  let z2 = -x1 * sinY + z1 * cosY;

  // Un-rotate X (angle: -rx)
  const cosX = Math.cos(-rx);
  const sinX = Math.sin(-rx);
  let x3 = x2;
  let y3 = y2 * cosX - z2 * sinX;
  let z3 = y2 * sinX + z2 * cosX;

  return {
    x: Math.round(x3 * 10) / 10,
    y: Math.round(y3 * 10) / 10,
    z: Math.round(z3 * 10) / 10
  };
}

function enterPenMode() {
  state.toolMode = 'pen';
  penPoints = [];
  penCurrentMousePoint = null;
  if (illo) illo.dragRotate = false;
  
  // Update toolbar active class
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  const penBtn = document.getElementById('tool-pen');
  if (penBtn) penBtn.classList.add('active');

  // Update HUD text
  document.getElementById('active-viewport-mode').innerText = 'Pen Drawing';
  document.getElementById('active-node-name').innerText = 'Click viewport to place points';

  // Deselect current shape
  selectNode(null);

  rebuildZdogScene();
}

function exitPenMode() {
  state.toolMode = 'select';
  penPoints = [];
  penCurrentMousePoint = null;
  if (illo) illo.dragRotate = true;

  // Restore select tool active class
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  const selectBtn = document.getElementById('tool-select');
  if (selectBtn) selectBtn.classList.add('active');

  // Restore HUD text
  document.getElementById('active-viewport-mode').innerText = 'Modeling';
  document.getElementById('active-node-name').innerText = 'Object';

  rebuildZdogScene();
}

function getCanvasMouseCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX - canvas.width / 2;
  const mouseY = (e.clientY - rect.top) * scaleY - canvas.height / 2;
  return { mouseX, mouseY };
}

function handlePenClick(e) {
  const { mouseX, mouseY } = getCanvasMouseCoords(e);

  // Check if we are clicking near the first point to close
  if (penPoints.length >= 3) {
    const distToFirst = Math.hypot(mouseX - firstPointScreenX, mouseY - firstPointScreenY);
    if (distToFirst < 15) {
      finishPenDrawing(true);
      return;
    }
  }

  // Add new point
  const pt3d = getLocal3DCoordinates(mouseX, mouseY);
  penPoints.push(pt3d);

  // If this is the first point, store its screen position to detect closing click later
  if (penPoints.length === 1) {
    firstPointScreenX = mouseX;
    firstPointScreenY = mouseY;
  }

  // Re-render
  rebuildZdogScene();
}

function finishPenDrawing(shouldClose) {
  if (penPoints.length < 2) {
    // Too few points, just exit
    exitPenMode();
    return;
  }

  saveHistory();

  // Create custom Shape node
  const newId = `shape_${Date.now().toString().slice(-4)}`;
  const newNode = {
    id: newId,
    type: 'Shape',
    name: `Custom Path`,
    parentId: null, // Add to root
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    path: [...penPoints],
    color: '#ff5c00',
    stroke: 8,
    fill: false, // Default to outline for custom paths
    visible: true,
    closed: shouldClose,
    backface: true
  };

  sceneGraph.push(newNode);
  
  // Select the newly created path and exit pen mode
  exitPenMode();
  selectNode(newId);
}

// ==========================================
// EVENT LISTENERS & SETUP
// ==========================================

function setupUIEventHandlers() {
  // Sample selector tabs (Layout, Modeling, UV Editing, Textures, Nodes)
  document.querySelectorAll('.sample-item').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sample-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const presetName = tab.dataset.preset;
      loadPreset(presetName);
    });
  });

  // Hierarchy search
  const searchInput = document.getElementById('hierarchy-search');
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const items = treeContainer.querySelectorAll('.hierarchy-item');
    items.forEach(el => {
      const name = el.querySelector('.node-name').innerText.toLowerCase();
      el.style.display = name.includes(term) ? 'flex' : 'none';
    });
  });

  // Collapsible cards toggle
  document.querySelectorAll('.card-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.collapsible-card');
      card.classList.toggle('collapsed');
    });
  });

  // Top viewport camera dropdown
  const camDropdownBtn = document.getElementById('btn-camera-dropdown');
  const camDropdownMenu = document.getElementById('camera-dropdown-menu');
  camDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    camDropdownMenu.classList.toggle('show');
  });

  camDropdownMenu.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const mode = item.dataset.cam;
      toggleCameraView(mode);
      camDropdownMenu.classList.remove('show');
    });
  });

  // Close dropdowns on document click
  document.addEventListener('click', () => {
    const camDropdownMenu = document.getElementById('camera-dropdown-menu');
    if (camDropdownMenu) camDropdownMenu.classList.remove('show');
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
  });

  // View toggle button (Toggles properties panel vs code panel)
  btnToggleView.addEventListener('click', () => {
    btnToggleView.classList.toggle('active');
    
    const isShowingCode = !codePanel.classList.contains('hide');
    if (isShowingCode) {
      codePanel.classList.add('hide');
      propertiesPanel.classList.remove('hide');
    } else {
      generateCode(); // refresh code
      propertiesPanel.classList.add('hide');
      codePanel.classList.remove('hide');
    }
  });

  // Handle new separated dropdown menus
  const setupDropdown = (btnId, menuId) => {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other dropdowns first
        document.querySelectorAll('.dropdown-menu').forEach(m => {
          if (m !== menu) m.classList.remove('show');
        });
        menu.classList.toggle('show');
      });

      menu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const type = e.currentTarget.dataset.type;
          addShapeToScene(type);
          menu.classList.remove('show');
        });
      });
    }
  };

  setupDropdown('btn-add-mesh', 'add-mesh-menu');
  setupDropdown('btn-add-2d', 'add-2d-menu');
  setupDropdown('btn-add-struct', 'add-struct-menu');

  // Deletion & Cloning
  btnDeleteNode.addEventListener('click', deleteSelectedNode);
  btnCloneNode.addEventListener('click', cloneSelectedNode);

  // HUD grid and play triggers
  btnToggleGrid.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    btnToggleGrid.classList.toggle('active', state.showGrid);
    rebuildZdogScene();
  });

  btnToggleAnimation.addEventListener('click', () => {
    state.isAnimating = !state.isAnimating;
    btnToggleAnimation.classList.toggle('active', state.isAnimating);
    btnToggleAnimation.innerHTML = `<i data-lucide="${state.isAnimating ? 'pause' : 'play'}" id="play-pause-icon"></i>`;
    lucide.createIcons();
  });

  // Keyboard shortcuts for presets (Ctrl/Cmd + 1..6)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
      e.preventDefault();
      const presetKeys = ['zdog', 'solar', 'robot', 'gyro', 'cyber', 'empty'];
      const index = parseInt(e.key) - 1;
      const targetPreset = presetKeys[index];
      
      // Update UI active tab state
      const tabs = document.querySelectorAll('.sample-item');
      if (tabs[index]) {
        tabs.forEach(t => t.classList.remove('active'));
        tabs[index].classList.add('active');
      }
      
      loadPreset(targetPreset);
    }
  });

  // Copy code button
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    const rawCode = codeOutput.innerText;
    navigator.clipboard.writeText(rawCode).then(() => {
      const btn = document.getElementById('btn-copy-code');
      btn.innerHTML = '<i data-lucide="check"></i> Copied!';
      lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="copy"></i> Copy';
        lucide.createIcons();
      }, 2000);
    });
  });

  // Download code button
  document.getElementById('btn-download-code').addEventListener('click', () => {
    const rawCode = codeOutput.innerText;
    const blob = new Blob([rawCode], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zdog_scene_${state.activePreset}.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const btn = document.getElementById('btn-download-code');
    btn.innerHTML = '<i data-lucide="check"></i> Saved!';
    lucide.createIcons();
    setTimeout(() => {
      btn.innerHTML = '<i data-lucide="download"></i> Download';
      lucide.createIcons();
    }, 2000);
  });

  // Renderer mode segmented control toggle
  const rendererSegment = document.getElementById('toggle-renderer-mode');
  rendererSegment.querySelectorAll('.segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      rendererSegment.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.renderMode = btn.dataset.value;
      initZdog();
    });
  });

  // Export buttons
  document.getElementById('btn-export-svg').addEventListener('click', exportSVG);
  document.getElementById('btn-export-png').addEventListener('click', exportPNG);
  document.getElementById('btn-render-action').addEventListener('click', () => {
    triggerRenderFlash();
    exportPNG();
  });

  // Import Zdog Code button
  const btnImportJs = document.getElementById('btn-import-js');
  const importModalOverlay = document.getElementById('import-modal-overlay');
  const btnCloseImportModal = document.getElementById('btn-close-import-modal');
  const btnCancelImport = document.getElementById('btn-cancel-import');
  const btnSubmitImport = document.getElementById('btn-submit-import');
  const importCodeInput = document.getElementById('import-code-input');

  if (btnImportJs && importModalOverlay) {
    btnImportJs.addEventListener('click', () => {
      importCodeInput.value = '';
      importModalOverlay.classList.remove('hide');
    });

    const hideModal = () => {
      importModalOverlay.classList.add('hide');
    };

    if (btnCloseImportModal) btnCloseImportModal.addEventListener('click', hideModal);
    if (btnCancelImport) btnCancelImport.addEventListener('click', hideModal);

    if (btnSubmitImport) {
      btnSubmitImport.addEventListener('click', () => {
        const code = importCodeInput.value.trim();
        if (code) {
          const success = importZdogCode(code);
          if (success) {
            hideModal();
          }
        } else {
          alert("Please paste some Zdog Javascript code first.");
        }
      });
    }
  }

  // Save .zd3d project button
  const saveZd3dBtn = document.getElementById('btn-save-zd3d');
  if (saveZd3dBtn) {
    saveZd3dBtn.addEventListener('click', () => {
      saveProjectZD3D();
    });
  }

  // Load .zd3d project button
  const loadZd3dBtn = document.getElementById('btn-load-zd3d');
  const fileInputZd3d = document.getElementById('input-file-zd3d');
  if (loadZd3dBtn && fileInputZd3d) {
    loadZd3dBtn.addEventListener('click', () => {
      fileInputZd3d.click();
    });

    fileInputZd3d.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        loadProjectZD3D(e.target.files[0]);
        // Reset file input so same file can be loaded again
        e.target.value = '';
      }
    });
  }

  // Delete key shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && state.selectedShapeId && document.activeElement.tagName !== 'INPUT') {
      deleteSelectedNode();
    }
  });

  // Viewport scroll wheel zoom handler
  const canvasWrapper = document.getElementById('canvas-wrapper');
  canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    let zoomDelta = e.deltaY < 0 ? 0.25 : -0.25;
    let newVal = Math.max(0.4, Math.min(10.0, state.zoom + zoomDelta));
    
    state.zoom = newVal;
    if (inputGlobalZoom) {
      inputGlobalZoom.value = newVal;
    }
    if (zoomVal) {
      zoomVal.innerText = newVal.toFixed(1);
    }
    generateCode();
  }, { passive: false });

  // Canvas / SVG click clears selection
  canvasWrapper.addEventListener('click', (e) => {
    if (state.toolMode === 'pen') return; // Let pen handle clicks
    if (e.target === canvas || e.target.id === 'zdog-svg') {
      selectNode(null);
    }
  });

  // Pen Tool interaction canvas listeners
  let penMouseDownPos = { x: 0, y: 0 };
  canvasWrapper.addEventListener('mousedown', (e) => {
    if (state.toolMode !== 'pen') return;
    penMouseDownPos = { x: e.clientX, y: e.clientY };
  });

  canvasWrapper.addEventListener('mouseup', (e) => {
    if (state.toolMode !== 'pen') return;
    if (e.target !== canvas && e.target.id !== 'zdog-svg') return;
    const dist = Math.hypot(e.clientX - penMouseDownPos.x, e.clientY - penMouseDownPos.y);
    if (dist < 5) {
      handlePenClick(e);
    }
  });

  canvasWrapper.addEventListener('mousemove', (e) => {
    if (state.toolMode !== 'pen') return;
    const { mouseX, mouseY } = getCanvasMouseCoords(e);
    penCurrentMousePoint = getLocal3DCoordinates(mouseX, mouseY);
    rebuildZdogScene();
  });

  canvasWrapper.addEventListener('dblclick', (e) => {
    if (state.toolMode !== 'pen') return;
    e.preventDefault();
    finishPenDrawing(false); // finish open path
  });

  // Enter/Escape keyboard keys during Pen drawing
  document.addEventListener('keydown', (e) => {
    if (state.toolMode === 'pen') {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishPenDrawing(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        exitPenMode();
      }
    }
  });

  // Keyboard shortcut 'P' to select Pen tool
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      if (state.toolMode === 'pen') {
        exitPenMode();
      } else {
        enterPenMode();
      }
    }
  });

  // Tool buttons click handlers
  const toolSelect = document.getElementById('tool-select');
  if (toolSelect) {
    toolSelect.addEventListener('click', () => {
      if (state.toolMode === 'pen') exitPenMode();
      state.toolMode = 'select';
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      toolSelect.classList.add('active');
    });
  }

  const toolMove = document.getElementById('tool-move');
  if (toolMove) {
    toolMove.addEventListener('click', () => {
      if (state.toolMode === 'pen') exitPenMode();
      state.toolMode = 'translate';
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      toolMove.classList.add('active');
    });
  }

  const toolRotate = document.getElementById('tool-rotate');
  if (toolRotate) {
    toolRotate.addEventListener('click', () => {
      if (state.toolMode === 'pen') exitPenMode();
      state.toolMode = 'rotate';
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      toolRotate.classList.add('active');
    });
  }

  const toolPen = document.getElementById('tool-pen');
  if (toolPen) {
    toolPen.addEventListener('click', () => {
      if (state.toolMode === 'pen') {
        exitPenMode();
      } else {
        enterPenMode();
      }
    });
  }

  // Theme toggle button click handler
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
    });
  }

  // New Project Button click
  const newProjectBtn = document.getElementById('btn-new-project');
  if (newProjectBtn) {
    newProjectBtn.addEventListener('click', () => {
      saveHistory(); // Save current project state in case of accidental click
      loadPreset('empty');
    });
  }

  // Undo and Redo Button clicks
  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      undo();
    });
  }

  const redoBtn = document.getElementById('btn-redo');
  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      redo();
    });
  }

  // Keyboard undo/redo shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    }
  });

  // Reset Project Button click
  const resetProjectBtn = document.getElementById('btn-reset-project');
  if (resetProjectBtn) {
    resetProjectBtn.addEventListener('click', () => {
      saveHistory();
      loadPreset(state.activePreset);
    });
  }

  // Keyframe Timeline UI Bindings
  const timelinePlayBtn = document.getElementById('timeline-play-btn');
  const timelinePlayIcon = document.getElementById('timeline-play-icon');
  const timelineSlider = document.getElementById('timeline-slider');
  const frameDisplay = document.getElementById('frame-display');
  const btnAddKeyframe = document.getElementById('btn-add-keyframe');
  const btnDeleteKeyframe = document.getElementById('btn-delete-keyframe');

  if (timelinePlayBtn) {
    timelinePlayBtn.addEventListener('click', () => {
      state.isPlayingTimeline = !state.isPlayingTimeline;
      timelinePlayBtn.innerHTML = `<i data-lucide="${state.isPlayingTimeline ? 'pause' : 'play'}" id="timeline-play-icon"></i>`;
      lucide.createIcons();
    });
  }

  if (timelineSlider) {
    timelineSlider.addEventListener('input', (e) => {
      state.currentFrame = parseInt(e.target.value);
      if (frameDisplay) {
        frameDisplay.innerText = `${state.currentFrame} / ${state.maxFrames}`;
      }
      
      // Update shapes to reflect manual scrubbed frame transforms
      sceneGraph.forEach(node => {
        const zdogObj = zdogInstances[node.id];
        if (zdogObj && node.keyframes && Object.keys(node.keyframes).length > 0) {
          const transform = interpolateTransform(node, state.currentFrame);
          zdogObj.translate.x = Number(transform.translate.x || 0);
          zdogObj.translate.y = Number(transform.translate.y || 0);
          zdogObj.translate.z = Number(transform.translate.z || 0);
          zdogObj.rotate.x = Number(transform.rotate.x || 0) * Math.PI / 180;
          zdogObj.rotate.y = Number(transform.rotate.y || 0) * Math.PI / 180;
          zdogObj.rotate.z = Number(transform.rotate.z || 0) * Math.PI / 180;
          zdogObj.scale.x = Number(transform.scale.x || 1);
          zdogObj.scale.y = Number(transform.scale.y || 1);
          zdogObj.scale.z = Number(transform.scale.z || 1);
        }
      });
      illo.updateRenderGraph();
      
      // Sync delete button availability
      updateKeyframeButtonsState();
    });
  }

  if (btnAddKeyframe) {
    btnAddKeyframe.addEventListener('click', () => {
      if (!state.selectedShapeId) return;
      saveHistory();
      const node = sceneGraph.find(n => n.id === state.selectedShapeId);
      if (node) {
        if (!node.keyframes) node.keyframes = {};
        node.keyframes[state.currentFrame] = {
          translate: { ...node.translate },
          rotate: { ...node.rotate },
          scale: { ...node.scale }
        };
        renderKeyframeMarkers();
        updateKeyframeButtonsState();
        generateCode();
      }
    });
  }

  if (btnDeleteKeyframe) {
    btnDeleteKeyframe.addEventListener('click', () => {
      if (!state.selectedShapeId) return;
      saveHistory();
      const node = sceneGraph.find(n => n.id === state.selectedShapeId);
      if (node && node.keyframes && node.keyframes[state.currentFrame] !== undefined) {
        delete node.keyframes[state.currentFrame];
        renderKeyframeMarkers();
        updateKeyframeButtonsState();
        generateCode();
      }
    });
  }

  function updateKeyframeButtonsState() {
    if (!state.selectedShapeId) {
      if (btnAddKeyframe) btnAddKeyframe.disabled = true;
      if (btnDeleteKeyframe) btnDeleteKeyframe.disabled = true;
      return;
    }
    
    if (btnAddKeyframe) btnAddKeyframe.disabled = false;
    
    const node = sceneGraph.find(n => n.id === state.selectedShapeId);
    const hasKeyframe = node && node.keyframes && node.keyframes[state.currentFrame] !== undefined;
    if (btnDeleteKeyframe) btnDeleteKeyframe.disabled = !hasKeyframe;
  }

  window.updateKeyframeButtonsState = updateKeyframeButtonsState;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('zdog-studio-theme', theme);
  
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) {
    icon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
    lucide.createIcons();
  }

  // Update canvas background to match default theme background
  if (theme === 'light') {
    if (state.bgColor === '#181c24') {
      state.bgColor = '#f0f3f8';
      canvas.style.backgroundColor = '#f0f3f8';
      if (inputBgColor) inputBgColor.value = '#f0f3f8';
      if (inputBgColorText) inputBgColorText.value = '#F0F3F8';
    }
  } else {
    if (state.bgColor === '#f0f3f8') {
      state.bgColor = '#181c24';
      canvas.style.backgroundColor = '#181c24';
      if (inputBgColor) inputBgColor.value = '#181c24';
      if (inputBgColorText) inputBgColorText.value = '#181C24';
    }
  }
  generateCode();
}

function initLogo() {
  const logoCanvas = document.getElementById('logo-canvas');
  if (!logoCanvas) return;

  const logoIllo = new Zdog.Illustration({
    element: logoCanvas,
    zoom: 0.35, // zoom to fit 32x32 canvas
    rotate: { x: 20/360 * Zdog.TAU, y: -50/360 * Zdog.TAU },
    dragRotate: false
  });

  const orange = '#E62';
  const gold = '#EA0';
  const eggplant = '#636';
  const depth = 20;
  const lineWidth = 8;
  const TAU = Zdog.TAU;

  const bigGroup = new Zdog.Group({
    addTo: logoIllo,
  });

  const backGroup = new Zdog.Group({
    addTo: bigGroup,
    updateSort: true,
  });

  // top
  const topSide = new Zdog.Rect({
    addTo: backGroup,
    width: 40,
    height: depth,
    translate: { y: -20 },
    rotate: { x: TAU/4 },
    fill: true,
    stroke: lineWidth,
    color: orange,
  });
  topSide.copy({
    translate: { y: 20 },
    rotate: { x: -TAU/4 },
  });

  const endCap = new Zdog.Rect({
    addTo: backGroup,
    width: depth,
    height: 8,
    translate: { x: -20, y: -16 },
    rotate: { y: TAU/4 },
    fill: true,
    color: orange,
    stroke: lineWidth,
    backface: false,
  });
  endCap.copy({
    translate: { x: 20, y: 16 },
    rotate: { y: -TAU/4 },
  });

  const cornerCap = endCap.copy({
    height: 10,
    translate: { x: -20, y: 15 },
  });
  cornerCap.copy({
    translate: { x: 20, y: -15 },
    rotate: { y: -TAU/4 },
  });

  const underside = new Zdog.Rect({
    addTo: backGroup,
    width: 30,
    height: depth,
    translate: { x: -5, y: -12 },
    rotate: { x: -TAU/4 },
    stroke: lineWidth,
    fill: true,
    color: orange,
  });
  underside.copy({
    translate: { x: 5, y: 12 },
    rotate: { x: TAU/4 },
  });

  const slopeW = 30;
  const slopeH = 22;
  const slopeAngle = Math.atan( slopeH/slopeW );

  const slope = new Zdog.Rect({
    addTo: backGroup,
    width: Math.sqrt( slopeH*slopeH + slopeW*slopeW ),
    height: depth,
    translate: { x: -5, y: -1 },
    rotate: { x: TAU/4, y: slopeAngle },
    stroke: lineWidth,
    fill: true,
    color: orange,
    backface: false,
  });

  slope.copy({
    translate: { x: 5, y: 1 },
    rotate: { x: -TAU/4, y: -slopeAngle },
  });

  // tail
  new Zdog.Ellipse({
    addTo: backGroup,
    diameter: 32,
    quarters: 1,
    closed: false,
    translate: { x: 22, y: -4 },
    rotate: { z: TAU/4 },
    color: orange,
    stroke: lineWidth,
  });

  // tongue
  const tongueAnchor = new Zdog.Anchor({
    addTo: backGroup,
    translate: { x: -6, y: -7 },
    rotate: { y: TAU/4 },
  });

  const tongueH = 12;
  const tongueS = 5;
  const tongueTip = tongueH + tongueS;

  new Zdog.Shape({
    addTo: tongueAnchor,
    path: [
      { x: -tongueS, y: 0 },
      { x:  tongueS, y: 0 },
      { x:  tongueS, y: tongueH },
      { arc: [
        { x: tongueS, y: tongueTip },
        { x: 0, y: tongueTip },
      ]},
      { arc: [
        { x: -tongueS, y: tongueTip },
        { x: -tongueS, y: tongueH },
      ]},
    ],
    rotate: { x: TAU/4 - Math.atan(16/22) },
    fill: true,
    stroke: 4,
    color: eggplant,
  });

  const foreGroup = new Zdog.Group({
    addTo: bigGroup,
    updateSort: true,
  });

  const zFace = new Zdog.Shape({
    addTo: foreGroup,
    path: [
      { x: -20, y: -20 },
      { x:  20, y: -20 },
      { x:  20, y: -10 },
      { x: -10, y:  12 },
      { x:  20, y:  12 },
      { x:  20, y:  20 },
      { x: -20, y:  20 },
      { x: -20, y:  10 },
      { x:  10, y: -12 },
      { x: -20, y: -12 },
    ],
    translate: { z: depth/2 },
    fill: true,
    color: gold,
    stroke: lineWidth,
    backface: false,
  });

  zFace.copy({
    scale: { x: -1 },
    translate: { z: -depth/2 },
    rotate: { y: TAU/2 },
  });

  // nose
  const semiCircle = new Zdog.Ellipse({
    addTo: backGroup,
    quarters: 2,
    scale: 8,
    translate: { x: -26, y: -20 },
    rotate: { y: TAU/4, z: TAU/4 },
    fill: true,
    stroke: 5,
    color: eggplant,
    closed: true,
  });

  // ears
  const earGroup = new Zdog.Group({
    addTo: logoIllo,
  });

  const ear = semiCircle.copy({
    addTo: earGroup,
    quarters: 2,
    scale: 24,
    rotate: { z: -TAU/16, x: TAU/16 },
    translate: { x: 10, y: -14, z: depth },
  });

  new Zdog.Shape({
    visible: false,
    addTo: ear,
    translate: { z: 0.5, x: -0.5 },
  });

  earGroup.copyGraph({
    scale: { z: -1 },
  });

  // animation loop
  let ticker = 0;
  const cycleCount = 180;
  const initRotateY = -50/360 * TAU;
  const keyframes = [
    { y:   0 + initRotateY, z:   0 },
    { y: TAU + initRotateY, z:   0 },
    { y: TAU + initRotateY, z: TAU },
  ];
  const turnLimit = keyframes.length - 1;

  function animateLogo() {
    const progress = ticker / cycleCount;
    const tween = Zdog.easeInOut( progress % 1, 4 );
    const turn = Math.floor( progress % turnLimit );
    const keyA = keyframes[ turn ];
    const keyB = keyframes[ turn + 1 ];
    logoIllo.rotate.y = Zdog.lerp( keyA.y, keyB.y, tween );
    logoIllo.rotate.z = Zdog.lerp( keyA.z, keyB.z, tween );
    logoIllo.updateRenderGraph();
    ticker++;
    requestAnimationFrame(animateLogo);
  }

  animateLogo();
}

let importedShapes = [];

function makeMockClass(type) {
  return class {
    constructor(options = {}) {
      this.id = options.id || `${type.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      this.type = type;
      this.name = options.name || `Imported ${type}`;
      
      // Determine parentId
      this.parentId = (options.addTo && options.addTo.id) ? options.addTo.id : null;
      
      // Translate
      this.translate = {
        x: options.translate && options.translate.x !== undefined ? options.translate.x : 0,
        y: options.translate && options.translate.y !== undefined ? options.translate.y : 0,
        z: options.translate && options.translate.z !== undefined ? options.translate.z : 0
      };
      
      // Rotate
      const radToDeg = (rad) => rad !== undefined ? Math.round(rad * 180 / Math.PI) : 0;
      this.rotate = {
        x: options.rotate && options.rotate.x !== undefined ? radToDeg(options.rotate.x) : 0,
        y: options.rotate && options.rotate.y !== undefined ? radToDeg(options.rotate.y) : 0,
        z: options.rotate && options.rotate.z !== undefined ? radToDeg(options.rotate.z) : 0
      };
      
      // Scale
      let sx = 1, sy = 1, sz = 1;
      if (options.scale !== undefined) {
        if (typeof options.scale === 'number') {
          sx = sy = sz = options.scale;
        } else {
          sx = options.scale.x !== undefined ? options.scale.x : 1;
          sy = options.scale.y !== undefined ? options.scale.y : 1;
          sz = options.scale.z !== undefined ? options.scale.z : 1;
        }
      }
      this.scale = { x: sx, y: sy, z: sz };
      
      // Geometry options
      if (type === 'Box') {
        this.width = options.width !== undefined ? options.width : 20;
        this.height = options.height !== undefined ? options.height : 20;
        this.depth = options.depth !== undefined ? options.depth : 20;
      } else if (type === 'Cylinder' || type === 'Cone') {
        this.diameter = options.diameter !== undefined ? options.diameter : 20;
        this.length = options.length !== undefined ? options.length : 30;
      } else if (type === 'Hemisphere') {
        this.diameter = options.diameter !== undefined ? options.diameter : 20;
      } else if (type === 'Ellipse') {
        this.diameter = options.diameter !== undefined ? options.diameter : 25;
        this.quarters = options.quarters !== undefined ? options.quarters : 4;
      } else if (type === 'Rect') {
        this.width = options.width !== undefined ? options.width : 20;
        this.height = options.height !== undefined ? options.height : 20;
      } else if (type === 'RoundedRect') {
        this.width = options.width !== undefined ? options.width : 20;
        this.height = options.height !== undefined ? options.height : 20;
        this.cornerRadius = options.cornerRadius !== undefined ? options.cornerRadius : 4;
      } else if (type === 'Polygon') {
        this.radius = options.radius !== undefined ? options.radius : 15;
        this.sides = options.sides !== undefined ? options.sides : 6;
      } else if (type === 'Shape') {
        this.path = options.path || [{ x: 0, y: 0, z: 0 }];
      }
      
      // Material options
      if (type !== 'Anchor' && type !== 'Group') {
        this.color = options.color || '#ff5c00';
        this.stroke = options.stroke !== undefined ? options.stroke : 8;
        this.fill = options.fill !== undefined ? options.fill : true;
        this.visible = options.visible !== undefined ? options.visible : true;
        this.closed = options.closed !== undefined ? options.closed : true;
        this.backface = options.backface !== undefined ? options.backface : true;
      }
      
      importedShapes.push(this);
    }
    
    copy(copyOptions = {}) {
      const clone = JSON.parse(JSON.stringify(this));
      clone.id = copyOptions.id || `${this.type.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      clone.name = copyOptions.name || `${this.name} Copy`;
      
      if (copyOptions.addTo) clone.parentId = copyOptions.addTo.id;
      if (copyOptions.translate) {
        clone.translate = {
          x: copyOptions.translate.x !== undefined ? copyOptions.translate.x : clone.translate.x,
          y: copyOptions.translate.y !== undefined ? copyOptions.translate.y : clone.translate.y,
          z: copyOptions.translate.z !== undefined ? copyOptions.translate.z : clone.translate.z
        };
      }
      if (copyOptions.rotate) {
        const radToDeg = (rad) => rad !== undefined ? Math.round(rad * 180 / Math.PI) : 0;
        clone.rotate = {
          x: copyOptions.rotate.x !== undefined ? radToDeg(copyOptions.rotate.x) : clone.rotate.x,
          y: copyOptions.rotate.y !== undefined ? radToDeg(copyOptions.rotate.y) : clone.rotate.y,
          z: copyOptions.rotate.z !== undefined ? radToDeg(copyOptions.rotate.z) : clone.rotate.z
        };
      }
      if (copyOptions.scale) {
        let sx = clone.scale.x, sy = clone.scale.y, sz = clone.scale.z;
        if (typeof copyOptions.scale === 'number') {
          sx = sy = sz = copyOptions.scale;
        } else {
          sx = copyOptions.scale.x !== undefined ? copyOptions.scale.x : sx;
          sy = copyOptions.scale.y !== undefined ? copyOptions.scale.y : sy;
          sz = copyOptions.scale.z !== undefined ? copyOptions.scale.z : sz;
        }
        clone.scale = { x: sx, y: sy, z: sz };
      }
      
      if (copyOptions.width !== undefined) clone.width = copyOptions.width;
      if (copyOptions.height !== undefined) clone.height = copyOptions.height;
      if (copyOptions.depth !== undefined) clone.depth = copyOptions.depth;
      if (copyOptions.diameter !== undefined) clone.diameter = copyOptions.diameter;
      if (copyOptions.length !== undefined) clone.length = copyOptions.length;
      if (copyOptions.quarters !== undefined) clone.quarters = copyOptions.quarters;
      if (copyOptions.cornerRadius !== undefined) clone.cornerRadius = copyOptions.cornerRadius;
      if (copyOptions.radius !== undefined) clone.radius = copyOptions.radius;
      if (copyOptions.sides !== undefined) clone.sides = copyOptions.sides;
      if (copyOptions.path !== undefined) clone.path = copyOptions.path;
      if (copyOptions.color !== undefined) clone.color = copyOptions.color;
      if (copyOptions.stroke !== undefined) clone.stroke = copyOptions.stroke;
      if (copyOptions.fill !== undefined) clone.fill = copyOptions.fill;
      if (copyOptions.visible !== undefined) clone.visible = copyOptions.visible;
      if (copyOptions.closed !== undefined) clone.closed = copyOptions.closed;
      if (copyOptions.backface !== undefined) clone.backface = copyOptions.backface;
      
      importedShapes.push(clone);
      return clone;
    }
  };
}

function importZdogCode(codeText) {
  importedShapes = [];

  const MockZdog = {
    TAU: Math.PI * 2,
    easeInOut: (t, p) => Zdog.easeInOut(t, p),
    lerp: (a, b, t) => Zdog.lerp(a, b, t),
    Illustration: class {
      constructor(options) {
        // Stub
      }
      updateRenderGraph() {}
    },
    Anchor: class extends makeMockClass('Anchor') {
      copyGraph(copyOptions = {}) {
        const clonedParent = this.copy(copyOptions);
        const cloneChildren = (originalParentId, newParentId) => {
          const children = importedShapes.filter(s => s.parentId === originalParentId);
          children.forEach(child => {
            if (child === clonedParent) return; // guard duplicate
            const duplicate = JSON.parse(JSON.stringify(child));
            duplicate.id = `${child.type.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            duplicate.parentId = newParentId;
            importedShapes.push(duplicate);
            cloneChildren(child.id, duplicate.id);
          });
        };
        cloneChildren(this.id, clonedParent.id);
        return clonedParent;
      }
    },
    Group: class extends makeMockClass('Group') {
      copyGraph(copyOptions = {}) {
        const clonedParent = this.copy(copyOptions);
        const cloneChildren = (originalParentId, newParentId) => {
          const children = importedShapes.filter(s => s.parentId === originalParentId);
          children.forEach(child => {
            if (child === clonedParent) return; // guard duplicate
            const duplicate = JSON.parse(JSON.stringify(child));
            duplicate.id = `${child.type.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            duplicate.parentId = newParentId;
            importedShapes.push(duplicate);
            cloneChildren(child.id, duplicate.id);
          });
        };
        cloneChildren(this.id, clonedParent.id);
        return clonedParent;
      }
    },
    Box: makeMockClass('Box'),
    Cylinder: makeMockClass('Cylinder'),
    Cone: makeMockClass('Cone'),
    Hemisphere: makeMockClass('Hemisphere'),
    Ellipse: makeMockClass('Ellipse'),
    Rect: makeMockClass('Rect'),
    RoundedRect: makeMockClass('RoundedRect'),
    Polygon: makeMockClass('Polygon'),
    Shape: makeMockClass('Shape')
  };

  const originalRequestAnimationFrame = window.requestAnimationFrame;
  window.requestAnimationFrame = () => {};

  try {
    const sandboxFunction = new Function('Zdog', 'window', 'document', `
      let illo = { updateRenderGraph() {}, rotate: { x: 0, y: 0, z: 0 } };
      let mainScene = {};
      let shapes = {};
      ${codeText}
    `);
    
    sandboxFunction(MockZdog, window, document);
    window.requestAnimationFrame = originalRequestAnimationFrame;

    if (importedShapes.length === 0) {
      alert("No Zdog shapes were found in the imported code.");
      return false;
    }

    saveHistory();

    sceneGraph = importedShapes.map(s => {
      const node = {
        id: s.id,
        type: s.type,
        name: s.name,
        parentId: s.parentId,
        translate: s.translate,
        rotate: s.rotate,
        scale: s.scale
      };

      if (s.type !== 'Anchor' && s.type !== 'Group') {
        node.color = s.color;
        node.stroke = s.stroke;
        node.fill = s.fill;
        node.visible = s.visible;
        node.closed = s.closed;
        node.backface = s.backface;
      }

      if (s.type === 'Box') {
        node.width = s.width; node.height = s.height; node.depth = s.depth;
      } else if (s.type === 'Cylinder' || s.type === 'Cone') {
        node.diameter = s.diameter; node.length = s.length;
      } else if (s.type === 'Hemisphere') {
        node.diameter = s.diameter;
      } else if (s.type === 'Ellipse') {
        node.diameter = s.diameter; node.quarters = s.quarters;
      } else if (s.type === 'Rect') {
        node.width = s.width; node.height = s.height;
      } else if (s.type === 'RoundedRect') {
        node.width = s.width; node.height = s.height; node.cornerRadius = s.cornerRadius;
      } else if (s.type === 'Polygon') {
        node.radius = s.radius; node.sides = s.sides;
      } else if (s.type === 'Shape') {
        node.path = s.path;
      }

      return node;
    });

    state.selectedShapeId = null;
    state.activePreset = 'custom';

    rebuildZdogScene();
    renderHierarchy();
    updatePropertiesPanel();
    generateCode();

    return true;
  } catch (err) {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    console.error(err);
    alert("Error compiling Zdog code: " + err.message);
    return false;
  }
}

// Start everything
window.addEventListener('DOMContentLoaded', () => {
  initZdog();
  initLogo();

  // Load initial theme
  const savedTheme = localStorage.getItem('zdog-studio-theme') || 'dark';
  applyTheme(savedTheme);

  setupPropertyListeners();
  setupUIEventHandlers();
  loadPreset(state.activePreset);
  canvas.style.backgroundColor = state.bgColor;
  lucide.createIcons();
});
