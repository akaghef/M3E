import { installOtSafeFetch } from "../shared/safe_fetch";
import { loadVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT AGENT DETAIL", ["term", "wrap"]);
void loadVerbatimCut(new URL("../cut/detail/logic.js", import.meta.url));
