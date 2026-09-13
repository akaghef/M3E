import markup from "../cut/mail/markup.html?raw";
import logic from "../cut/mail/logic.js?raw";
import { installOtSafeFetch } from "../shared/safe_fetch";
import { executeVerbatimCut, mountHarness } from "../shared/render";
installOtSafeFetch();
mountHarness("OT MAIL SIGNAL", markup, "mail");
executeVerbatimCut(logic, "mail", "mailDrain");
