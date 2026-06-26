module.exports = {
  forbidden: [
    {
      name: "no-layout-internal-imports",
      severity: "error",
      from: { path: "^src/(browser|labs|shared)" },
      to: {
        path: "^src/shared/layout_.*",
        pathNot: "^src/shared/layout_port\\.ts$",
      },
    },
    {
      name: "labs-must-not-import-browser-implementation",
      severity: "error",
      from: { path: "^src/labs/" },
      to: { path: "^src/browser/" },
    },
    {
      name: "labs-use-shared-layout-port-only",
      severity: "error",
      from: { path: "^src/labs/layout/" },
      to: {
        path: "^src/shared/(?!layout_port\\.ts$)",
      },
    },
    {
      name: "edge-port-lab-must-not-import-browser-implementation",
      severity: "error",
      from: { path: "^src/labs/edge-port/" },
      to: { path: "^src/browser/" },
    },
    {
      name: "node-lab-must-not-import-browser-implementation",
      severity: "error",
      from: { path: "^src/labs/node/" },
      to: { path: "^src/browser/" },
    },
    {
      name: "node-lab-uses-node-draw-only",
      severity: "error",
      from: { path: "^src/labs/node/" },
      to: {
        path: "^src/shared/(?!node_draw_port\\.ts$|node_draw_svg\\.ts$|layout_port\\.ts$)",
      },
    },
    {
      name: "pn-edge-bypass-forbidden",
      severity: "error",
      from: { path: "^src/browser/workbench-ui\\.tsx$|^src/labs/pn/|^src/shared/pn_layout\\.ts$" },
      to: { path: "^src/browser/edge_geometry\\.ts$" },
    },
    {
      name: "pn-lab-must-not-import-browser-implementation",
      severity: "error",
      from: { path: "^src/labs/pn/" },
      to: { path: "^src/browser/" },
    },
    {
      name: "shared-pn-layout-must-not-import-browser-react-or-labs",
      severity: "error",
      from: { path: "^src/shared/pn_layout\\.ts$" },
      to: { path: "^src/(browser|labs)/|node_modules/react" },
    },
    {
      name: "node-draw-svg-must-not-import-viewer-markdown-edge-or-labs",
      severity: "error",
      from: { path: "^src/shared/node_draw_svg\\.ts$" },
      to: {
        path: "^src/(browser|labs/)|^src/shared/(edge_|parent_child_edge|graph_)",
      },
    },
    {
      name: "parent-child-edge-must-not-import-graphlink-endpoint-edit",
      severity: "error",
      from: { path: "^src/shared/parent_child_edge_adapter\\.ts$" },
      to: { path: "src/browser/edge_adapters/graphlink_endpoint_edit\\.ts$" },
    },
    {
      name: "shared-edge-port-must-not-import-browser",
      severity: "error",
      from: { path: "^src/shared/edge_(port|route)\\.ts$" },
      to: { path: "^src/browser/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: {
      path: "^(dist|node_modules|tests/fixtures)/",
    },
    tsConfig: {
      fileName: "tsconfig.layout.json",
    },
  },
};
