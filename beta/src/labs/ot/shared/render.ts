import { OT_NATIVE_FIXTURES } from "../fixtures/ot_native_fixtures";
import { installOtSafeFetch } from "./safe_fetch";
import lovelace from "../upstream/portraits_64/Lovelace.png";
import turing from "../upstream/portraits_64/Turing.png";
import curie from "../upstream/portraits_64/Curie.png";
import anthropic from "../upstream/assets/anthropic.svg";
import openai from "../upstream/assets/openai.svg";
import google from "../upstream/assets/google.svg";

/** Host, fixtures, and upstream's existing static-asset hooks only. */
export function mountHarness(component: string, markup: string, logic: string): void {
  const root = document.querySelector<HTMLElement>("#ot-lab-root");
  if (!root) throw new Error("OT lab root missing");
  installOtSafeFetch();
  const portraits: Record<string, string> = { Lovelace: lovelace, Turing: turing, Curie: curie };
  const assets: Record<string, string> = { anthropic, openai, google };
  Object.assign(window, {
    OT_NATIVE_FIXTURES,
    AGENTSTACK_DEMO: {
      portraitURL: (name: string) => portraits[name],
      assetURL: (name: string) => assets[name],
    },
  });
  root.dataset.otComponent = component;
  root.innerHTML = markup;
  const script = document.createElement("script");
  script.dataset.otCut = component;
  script.textContent = logic;
  document.head.append(script);
}
