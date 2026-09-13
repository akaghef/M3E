import markup from "../cut/detail/markup.html?raw";
import logic from "../cut/detail/logic.js?raw";
import { installOtSafeFetch } from "../shared/safe_fetch";
import { executeVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT AGENT DETAIL", markup, "detail");
executeVerbatimCut(logic, "detail", "openPanel");
