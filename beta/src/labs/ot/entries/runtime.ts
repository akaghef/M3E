import markup from "../cut/runtime/markup.html?raw";
import logic from "../cut/runtime/logic.js?raw";
import { installOtSafeFetch } from "../shared/safe_fetch";
import { executeVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT RUNTIME CONTROL", markup, "runtime");
executeVerbatimCut(logic, "runtime", "openSpawnModal");
