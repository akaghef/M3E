import { installOtSafeFetch } from "../shared/safe_fetch";
import { loadVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT MAIL SIGNAL", ["wrap"]);
void loadVerbatimCut(new URL("../cut/mail/logic.js", import.meta.url));
