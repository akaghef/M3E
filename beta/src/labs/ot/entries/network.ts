import markup from "../cut/network/markup.html?raw";
import logic from "../cut/network/logic.js?raw";
import { installOtSafeFetch } from "../shared/safe_fetch";
import { executeVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT NETWORK", markup, "network");
executeVerbatimCut(logic, "network", "buildEls");
