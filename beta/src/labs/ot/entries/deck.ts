import { installOtSafeFetch } from "../shared/safe_fetch";
import { loadVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT DECK", ["wrap"]);
void loadVerbatimCut(new URL("../cut/deck/logic.js", import.meta.url));
