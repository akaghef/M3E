import { installOtSafeFetch } from "../shared/safe_fetch";
import { loadVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT EDGE THREAD", ["edrawer", "ed-list"]);
void loadVerbatimCut(new URL("../cut/edge/logic.js", import.meta.url));
