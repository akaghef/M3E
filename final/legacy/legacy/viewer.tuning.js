const VIEWER_TUNING = {
  palette: {
    edgeColors: ["#7a35ff", "#e34ad7", "#5d3cff", "#a146ff", "#6d5dff"],
  },
  typography: {
    rootFont: 42,
    nodeFont: 44,
    maxNodeTextChars: 55,
  },
  layout: {
    rootHeight: 120,
    columnGap: 170,
    leafHeight: 94,
    siblingGap: 20,
    leftPad: 80,
    topPad: 90,
    nodeHitHeight: 64,
    minCanvasWidth: 1400,
    minCanvasHeight: 760,
    canvasRightPad: 220,
    canvasBottomPad: 60,
    nodeRightPad: 260,
    nodeBottomPad: 80,
    edgeStartPad: 10,
    edgeEndPad: 14,
    rootIndicatorPad: 16,
    nodeIndicatorPad: 10,
  },
  zoom: {
    min: 0.15,
    max: 2.5,
    buttonFactor: 1.32,
    wheelIntensityCap: 1.00,
    wheelIntensityDivisor: 260,
  },
  pan: {
    wheelFactor: 1,
    initialCameraX: 40,
    initialCameraY: 40,
  },
  drag: {
    reparentThreshold: 10,
  },
};
