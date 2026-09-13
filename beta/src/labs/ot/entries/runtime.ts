import { installOtSafeFetch } from "../shared/safe_fetch";
import { loadVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT RUNTIME CONTROL", ["spawnmd", "spm-stat"]);
void loadVerbatimCut(new URL("../cut/runtime/logic.js", import.meta.url));
