import { installOtSafeFetch } from "../shared/safe_fetch";
import { loadVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT NETWORK", ["net", "gsvg", "wrap"]);
void loadVerbatimCut(new URL("../cut/network/logic.js", import.meta.url));
