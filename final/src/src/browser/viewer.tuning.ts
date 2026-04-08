interface ViewerTuning {
  palette: {
    edgeColors: string[];
  };
  typography: {
    rootFont: number;
    nodeFont: number;
    maxNodeTextChars: number;
  };
  layout: {
    rootHeight: number;
    columnGap: number;
    leafHeight: number;
    siblingGap: number;
    leftPad: number;
    topPad: number;
    nodeHitHeight: number;
    minCanvasWidth: number;
    minCanvasHeight: number;
    canvasRightPad: number;
    canvasBottomPad: number;
    nodeRightPad: number;
    nodeBottomPad: number;
    edgeStartPad: number;
    edgeEndPad: number;
    rootIndicatorPad: number;
    nodeIndicatorPad: number;
  };
  zoom: {
    min: number;
    max: number;
    buttonFactor: number;
    wheelIntensityCap: number;
    wheelIntensityDivisor: number;
  };
  pan: {
    wheelFactor: number;
    initialCameraX: number;
    initialCameraY: number;
  };
  drag: {
    reparentThreshold: number;
  };
}

// Centralized viewer constants. Keep these values behavior-focused so layout/zoom
// tuning can change without scattering magic numbers through the renderer.
const VIEWER_TUNING: ViewerTuning = {
  palette: {
    // Ordered edge colors by depth to keep branch separation visually obvious.
    edgeColors: ["#7a35ff", "#e34ad7", "#5d3cff", "#a146ff", "#6d5dff"],
  },
  typography: {
    // Font size for the root node label.
    rootFont: 42,
    // Font size for non-root node labels.
    nodeFont: 44,
    // Hard cap used before truncation/wrapping logic prevents layout blowout.
    maxNodeTextChars: 55,
  },
  layout: {
    // Baseline block height reserved for the root node.
    rootHeight: 104,
    // Depth-axis distance between parent and child columns.
    columnGap: 170,
    // Baseline block height for leaf and regular nodes.
    leafHeight: 38,
    // Breadth-axis spacing between sibling nodes.
    siblingGap: 1,
    // Left margin before the rendered map begins.
    leftPad: 80,
    // Top margin before the rendered map begins.
    topPad: 10,
    // Minimum hit area height for node interaction.
    nodeHitHeight: 38,
    // Smallest canvas width even for tiny documents.
    minCanvasWidth: 1400,
    // Smallest canvas height even for tiny documents.
    minCanvasHeight: 760,
    // Extra canvas space on the right to avoid clipping during navigation.
    canvasRightPad: 220,
    // Extra canvas space at the bottom to avoid clipping during navigation.
    canvasBottomPad: 60,
    // Right-side label padding included in node bounds.
    nodeRightPad: 260,
    // Bottom-side padding included in node bounds.
    nodeBottomPad: 80,
    // Offset from the parent node where an edge begins.
    edgeStartPad: 10,
    // Offset from the child node where an edge terminates.
    edgeEndPad: 14,
    // Spacing for root-specific expand/collapse or status indicators.
    rootIndicatorPad: 16,
    // Spacing for non-root expand/collapse or status indicators.
    nodeIndicatorPad: 10,
  },
  zoom: {
    // Minimum zoom-out level allowed in the viewer.
    min: 0.15,
    // Maximum zoom-in level allowed in the viewer.
    max: 2.5,
    // Multiplicative zoom step for toolbar/button controls.
    buttonFactor: 1.32,
    // Upper bound on wheel-derived zoom intensity per event.
    wheelIntensityCap: 1.32,
    // Divisor that converts wheel delta into a usable zoom intensity.
    wheelIntensityDivisor: 100,
  },
  pan: {
    // Scale factor applied to wheel-based panning.
    wheelFactor: 1,
    // Initial depth-axis (left-right) camera offset on first load.
    initialCameraX: 40,
    // Initial breadth-axis (up-down) camera offset on first load.
    initialCameraY: 40,
  },
  drag: {
    // Minimum drag distance before reparent mode is treated as intentional.
    reparentThreshold: 10,
  },
};
