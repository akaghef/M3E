import markup from "../cut/replay/markup.html?raw";
import logic from "../cut/replay/logic.js?raw";
import { installOtSafeFetch } from "../shared/safe_fetch";
import { executeVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT REPLAY", markup, "replay");
executeVerbatimCut(logic, "replay", "startReplay");
