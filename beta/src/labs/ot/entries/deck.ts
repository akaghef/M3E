import markup from "../cut/deck/markup.html?raw";
import logic from "../cut/deck/logic.js?raw";
import { installOtSafeFetch } from "../shared/safe_fetch";
import { executeVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT DECK", markup, "deck");
executeVerbatimCut(logic, "deck", "render");
