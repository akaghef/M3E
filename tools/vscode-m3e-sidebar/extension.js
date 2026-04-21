const vscode = require("vscode");
const path = require("path");

class ActionItem extends vscode.TreeItem {
  constructor(label, commandName, description) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = {
      command: commandName,
      title: label
    };
    this.description = description;
  }
}

class SectionItem extends vscode.TreeItem {
  constructor(label, children) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "m3eSection";
    this.children = children;
  }
}

class ActionsProvider {
  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (element && element.children) {
      return element.children;
    }
    return [
      new SectionItem("Beta", [
        new ActionItem("Launch Beta", "m3eSidebar.betaLaunch", "scripts/beta/launch.bat"),
        new ActionItem("Update And Launch", "m3eSidebar.betaUpdateAndLaunch", "scripts/beta/update-and-launch.bat")
      ]),
      new SectionItem("PJ03 Demo", [
        new ActionItem("Demo Full", "m3eSidebar.pj03DemoFull", "preflight + core + scope"),
        new ActionItem("Demo Core", "m3eSidebar.pj03DemoCore", "dogfood_run_02"),
        new ActionItem("Demo Scope", "m3eSidebar.pj03DemoScope", "dogfood_run_03"),
        new ActionItem("Demo Preflight", "m3eSidebar.pj03DemoPreflight", "test health check")
      ])
    ];
  }
}

function getWorkspaceRoot() {
  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  return folder ? folder.uri.fsPath : null;
}

function runInTerminal(name, cwd, command) {
  const terminal = vscode.window.createTerminal({ name, cwd });
  terminal.show(true);
  terminal.sendText(command, true);
}

function activate(context) {
  const provider = new ActionsProvider();
  vscode.window.registerTreeDataProvider("m3eSidebar.actions", provider);

  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showWarningMessage("M3E Sidebar: open the repository as a workspace folder.");
    return;
  }

  const betaDir = path.join(root, "beta");
  const betaLaunch = path.join(root, "scripts", "beta", "launch.bat");
  const betaUpdate = path.join(root, "scripts", "beta", "update-and-launch.bat");

  const register = (command, fn) => context.subscriptions.push(vscode.commands.registerCommand(command, fn));

  register("m3eSidebar.betaLaunch", () => {
    runInTerminal("M3E Beta Launch", root, `"${betaLaunch}"`);
  });

  register("m3eSidebar.betaUpdateAndLaunch", () => {
    runInTerminal("M3E Beta Update And Launch", root, `"${betaUpdate}"`);
  });

  register("m3eSidebar.pj03DemoFull", () => {
    runInTerminal("M3E PJ03 Demo Full", betaDir, "npm run demo:pj03");
  });

  register("m3eSidebar.pj03DemoCore", () => {
    runInTerminal("M3E PJ03 Demo Core", betaDir, "npm run build:node && node dist/node/pj03_demo.js --mode core");
  });

  register("m3eSidebar.pj03DemoScope", () => {
    runInTerminal("M3E PJ03 Demo Scope", betaDir, "npm run build:node && node dist/node/pj03_demo.js --mode scope");
  });

  register("m3eSidebar.pj03DemoPreflight", () => {
    runInTerminal("M3E PJ03 Demo Preflight", betaDir, "npm run build:node && node dist/node/pj03_demo.js --mode preflight");
  });

  register("m3eSidebar.refresh", () => {
    vscode.commands.executeCommand("workbench.view.extension.m3eSidebar");
  });
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
