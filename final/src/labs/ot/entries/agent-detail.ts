import markup from "../cut/agent-detail/markup.html?raw";
import logic from "../cut/agent-detail/logic.js?raw";
import { mountHarness } from "../shared/render";
import lovelace from "../upstream/portraits_64/Lovelace.png";
import turing from "../upstream/portraits_64/Turing.png";
import curie from "../upstream/portraits_64/Curie.png";

mountHarness("agent-detail", markup, logic, {
  Lovelace: lovelace,
  Turing: turing,
  Curie: curie,
});
