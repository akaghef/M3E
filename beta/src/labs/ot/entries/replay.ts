import { installOtSafeFetch } from "../shared/safe_fetch";
import { loadVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT REPLAY", ["replayBar", "gsvg"]);
void loadVerbatimCut(new URL("../cut/replay/logic.js", import.meta.url));
