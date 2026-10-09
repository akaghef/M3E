import markup from "../cut/agent-detail/markup.html?raw";
import logic from "../cut/agent-detail/logic.js?raw";
import { mountHarness } from "../shared/render";
mountHarness("agent-detail", markup, logic);
