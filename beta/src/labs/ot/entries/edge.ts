import markup from "../cut/edge/markup.html?raw";
import logic from "../cut/edge/logic.js?raw";
import { installOtSafeFetch } from "../shared/safe_fetch";
import { executeVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT EDGE THREAD", markup, "edge");
executeVerbatimCut(logic, "edge", "openDrawer");
