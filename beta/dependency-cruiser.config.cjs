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
