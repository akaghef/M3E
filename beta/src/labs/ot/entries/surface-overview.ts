import markup from "../cut/surface-overview/markup.html?raw";
import logic from "../cut/surface-overview/logic.js?raw";
import { mountHarness } from "../shared/render";
mountHarness("surface-overview", markup, logic);
