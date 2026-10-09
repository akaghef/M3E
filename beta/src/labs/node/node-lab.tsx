import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AGENT_LIFECYCLE_STATES,
  renderAgentCard,
  renderPetSprite,
  type AgentCardData,
  type AgentCardLod,
  type AgentLifecycleState,
} from "./agent_node";
import {
  initialLifecycleAnimationMapping,
  isPetGridConfirmed,
  petAnimationNames,
  petCatalog,
  resolvePetSprite,
  resolvePetRowSprite,
  type LifecycleAnimationMapping,
  type PetAnimationName,
} from "./pet_catalog";
import fixture from "./fixtures/agent_cards.sample.json";
import sessionExample from "./fixtures/current-session.json";
import "./node-lab.css";

interface FixtureCard extends AgentCardData {
  provider: string;
  extraction: {
    recordKind: string;
    sourceId: string;
    sourceKinds: string[];
    reasons: string[];
    syntheticFields: string[];
    basedOnId?: string;
    titleProvenance?: string;
    titleTruncated?: boolean;
  };
}

type AttentionOverride = "card" | "all-on" | "all-off";
type ActorOverride = "card" | "all-on" | "all-off";

const referenceCards = fixture.cards as FixtureCard[];
const WIDTHS = [280, 320, 360, 420, 520, 620] as const;
const confirmedPetCount = petCatalog.filter((pet) => pet.gridStatus === "visually-verified-regions").length;
const manifestFramePetCount = petCatalog.filter((pet) => pet.states && Object.keys(pet.states).length > 0).length;

function App(): React.ReactElement {
  const [currentSession, setCurrentSession] = useState<FixtureCard>(sessionExample as FixtureCard);
  useEffect(() => {
    let active = true;
    fetch("/agent-node-session.local.json").then(response => response.ok ? response.json() : null).then(value => {
      if (active && value && typeof value.id === "string" && typeof value.title === "string" && value.extraction) setCurrentSession(value);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [dataset, setDataset] = useState("session");
  const [sessionState, setSessionState] = useState("all");
  const cards = useMemo(() => {
    const states = sessionState === "all" ? [...AGENT_LIFECYCLE_STATES] : [sessionState];
    const sessions = states.map(state => {
      const session = { ...currentSession } as FixtureCard;
      if (state !== "observed") {
        session.id = `${currentSession.id}-${state}`;
        session.lifecycleState = state as AgentLifecycleState;
        session.semanticColor = ({ "awaiting-user": "awaiting", blocked: "stalled", failed: "error", completed: "done", disconnected: "archived", unobservable: "unset" } as Record<string, AgentCardData["semanticColor"]>)[state] || "normal";
        session.extraction = { ...session.extraction, syntheticFields: [...session.extraction.syntheticFields, "lifecycleState"], recordKind: "current-session-preview-override", basedOnId: currentSession.id };
      }
      return session;
    });
    return dataset === "session" ? sessions : dataset === "reference" ? referenceCards : [...sessions, ...referenceCards];
  }, [dataset, sessionState, currentSession]);
  const [lod, setLod] = useState<AgentCardLod>("near");
  const [width, setWidth] = useState<number>(320);
  const [attentionOverride, setAttentionOverride] = useState<AttentionOverride>("card");
  const [actorOverride, setActorOverride] = useState<ActorOverride>("card");
  const [petOverride, setPetOverride] = useState("card");
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [animationMapping, setAnimationMapping] = useState<LifecycleAnimationMapping>({ ...initialLifecycleAnimationMapping });
  const [previewPetId, setPreviewPetId] = useState("black-dragon-pet");
  const [previewRow, setPreviewRow] = useState(0);
  const [displayAt, setDisplayAt] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState(cards[0]?.id || "");
  const selected = cards.find((card) => card.id === selectedId) || cards[0];
  const previewPet = petCatalog.find((pet) => pet.id === previewPetId) || petCatalog[0];
  const previewSprite = resolvePetRowSprite(previewPet.id, previewRow, animationEnabled);
  const previewAnimationName = petAnimationNames.find((name) => previewPet.states?.[name]?.row === previewSprite.row);

  const renderedById = useMemo(() => new Map(cards.map((card) => {
    const petId = petOverride === "card" ? card.icon : petOverride;
    const sprite = resolvePetSprite(petId, card.lifecycleState, animationMapping, animationEnabled);
    const attention = attentionOverride === "card" ? undefined : attentionOverride === "all-on";
    const actorCount = actorOverride === "card" ? undefined : actorOverride === "all-on" ? 3 : 1;
    return [card.id, {
      output: renderAgentCard({ card, width, lod, attention, actorCount, displayAt, sprite }),
      sprite,
    }] as const;
  })), [cards, width, lod, attentionOverride, actorOverride, petOverride, animationEnabled, animationMapping, displayAt]);

  return (
    <main className="node-lab">
      <aside className="lab-panel">
        <a className="lab-back" href="/src/labs/index.html">← M3E Seam Labs</a>
        <a className="lab-back" href="/viewer.html?preview=agent-nodes">Agent node をマップで見る →</a>
        <h1 className="lab-title">Agent node · Session Lab</h1>
        <ControlSelect id="dataset" label="表示データ" value={dataset} onChange={(value) => { setDataset(value); setSelectedId(value === "reference" ? referenceCards[0].id : currentSession.id); }}>
          <option value="session">{currentSession.extraction.recordKind === "synthetic-example" ? "表示サンプル" : "このセッション"} · {currentSession.title}</option><option value="reference">既存の比較データ</option><option value="all">両方</option>
        </ControlSelect>
        <ControlSelect id="session-state" label="このセッションの状態プレビュー" value={sessionState} onChange={setSessionState}>
          <option value="all">全状態を並べる</option><option value="observed">取得値 · working</option>{AGENT_LIFECYCLE_STATES.map(state => <option key={state} value={state}>{state}</option>)}
        </ControlSelect>
        <p className="lab-note">{cards.length} nodes · セッションは取得時点のスナップショット（自動更新なし）</p>

        <fieldset className="control-group segmented">
          <legend>LOD</legend>
          {(["far", "middle", "near"] as const).map((value) => (
            <label key={value}><input type="radio" name="lod" checked={lod === value} onChange={() => setLod(value)} />{value}</label>
          ))}
        </fieldset>

        <ControlSelect id="card-width" label="Node width" value={String(width)} onChange={(value) => setWidth(Number(value))}>
          {WIDTHS.map((value) => <option key={value} value={value}>{value}px</option>)}
        </ControlSelect>

        <ControlSelect id="attention-override" label="Attention override" value={attentionOverride} onChange={(value) => setAttentionOverride(value as AttentionOverride)}>
          <option value="card">ノード値に従う</option><option value="all-on">全部 on</option><option value="all-off">全部 off</option>
        </ControlSelect>

        <ControlSelect id="actor-override" label="Actor multiplicity override" value={actorOverride} onChange={(value) => setActorOverride(value as ActorOverride)}>
          <option value="card">ノード値に従う</option><option value="all-on">全部 on（3枚）</option><option value="all-off">全部 off（1枚）</option>
        </ControlSelect>

        <ControlSelect id="pet-override" label="Hermes pet" value={petOverride} onChange={setPetOverride}>
          <option value="card">Node icon（fixture値）</option>
          {petCatalog.map((pet) => <option key={pet.id} value={pet.id}>{pet.displayName} · {pet.gridStatus === "visually-verified-regions" ? "verified frame regions" : "未取り込み · 素材確認のみ"}</option>)}
        </ControlSelect>

        <label className="toggle"><input type="checkbox" checked={animationEnabled} onChange={(event) => setAnimationEnabled(event.currentTarget.checked)} />Animation on</label>
        <button className="refresh-button" type="button" onClick={() => setDisplayAt(Date.now())}>Refresh elapsed time</button>

        <div className="lab-status" data-testid="node-lab-status">
          <div className="lab-status-pass">renderer: shared typed AgentCardData</div>
          <div>pet assets: {petCatalog.length}/13 copied read-only</div>
          <div>frame regions verified: {confirmedPetCount} · pending import: {petCatalog.length - confirmedPetCount}</div>
          <div>frame counts: {manifestFramePetCount} verified regions · {petCatalog.length - manifestFramePetCount} pending → playback disabled</div>
          <div>synthetic actorCount: {fixture.selectionStats.syntheticActorCountCards}</div>
          <div>registry-truncated Title: {fixture.selectionStats.titleRegistryTruncated}</div>
        </div>

        <h2 className="panel-heading">Lifecycle → pet animation（推定・未検証）</h2>
        <div className="mapping-list">
          {AGENT_LIFECYCLE_STATES.map((state) => (
            <label key={state}><span>{state}</span><select value={animationMapping[state] || "static"} onChange={(event) => { const value = event.currentTarget.value; setAnimationMapping((current) => ({ ...current, [state]: value === "static" ? null : value as PetAnimationName })); }}>
              <option value="static">static</option>
              {petAnimationNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select></label>
          ))}
        </div>
        <p className="lab-warning">Black Dragon は切り出し・再生確認済み。ほか12種は未取り込みです。ノードでは未取り込み表示、検査欄では元画像全体を表示します。</p>

        <h2 className="panel-heading">Pet row inspector</h2>
        <section className="pet-row-inspector" aria-label="Pet row animation inspector">
          <div className="pet-row-controls">
            <ControlSelect id="preview-pet" label="Pet" value={previewPet.id} onChange={(value) => { setPreviewPetId(value); setPreviewRow(0); }}>
              {petCatalog.map((pet) => <option key={pet.id} value={pet.id}>{pet.displayName}</option>)}
            </ControlSelect>
            <ControlSelect id="preview-row" label="Row" value={String(previewSprite.row)} onChange={(value) => setPreviewRow(Number(value))}>
              {Array.from({ length: previewPet.grid?.rows || 1 }, (_, row) => <option key={row} value={row}>{row}</option>)}
            </ControlSelect>
          </div>
          <div className="pet-row-preview-shell">
            <svg className="pet-row-preview" viewBox={`0 0 ${previewSprite.frameWidth} ${previewSprite.frameHeight}`} role="img" aria-label={`${previewPet.displayName}, row ${previewSprite.row}`} dangerouslySetInnerHTML={{ __html: isPetGridConfirmed(previewPet) ? renderPetSprite(previewSprite, 0, 0, previewSprite.frameWidth, previewSprite.frameHeight, "row-inspector") : `<image href="${previewSprite.imageUrl}" width="${previewSprite.sheetWidth}" height="${previewSprite.sheetHeight}" />` }} />
          </div>
          <p className="pet-row-caption">row {previewSprite.row} · {previewAnimationName ? `${previewAnimationName}（動作）` : "state 未確認"} · {previewSprite.frames} frame{previewSprite.frames === 1 ? "" : "s"} · {previewSprite.frameCountStatus === "visually-verified-regions" ? "元画像との切り出し照合済み" : "未取り込み: 元画像全体（コマを推測しない）"}</p>
        </section>
      </aside>

      <section className={`stage stage-${lod}`} aria-label="Agent nodes">
        <div className="card-grid">
          {cards.map((card) => {
            const rendered = renderedById.get(card.id)!;
            return <button type="button" className={`card-cell${card.id === selected.id ? " selected" : ""}`} key={card.id} onClick={() => setSelectedId(card.id)}>
              <svg width={rendered.output.bounds.w} height={rendered.output.bounds.h} viewBox={`0 0 ${rendered.output.bounds.w} ${rendered.output.bounds.h}`} role="img" aria-label={`${card.name || "unnamed"}: ${card.lifecycleState || "no lifecycle state"}`}>
                <g dangerouslySetInnerHTML={{ __html: rendered.output.svg }} />
              </svg>
            </button>;
          })}
        </div>
      </section>

      <aside className="lab-panel right">
        <h2 className="lab-title">Selected typed input</h2>
        <p className="lab-note">{selected.provider} · {selected.extraction.recordKind}<br />取得値・プレビュー設定・素材の根拠はこの検査欄で確認します。このセッションのRealmはMac、teamはM3E。Roleは未指定。ペット・Attention・Actor枚数はプレビュー設定です。</p>
        <div className="json-block"><pre>{JSON.stringify({sprite: renderedById.get(selected.id)?.sprite, attentionOverride, actorOverride, sessionState}, null, 2)}</pre></div>
        <div className="json-block"><pre>{JSON.stringify(selected, null, 2)}</pre></div>
        <h2 className="panel-heading">Pet grid evidence</h2>
        <div className="pet-evidence">
          {petCatalog.map((pet) => <div key={pet.id}><b>{pet.displayName}</b><span>{pet.sheet.width}×{pet.sheet.height} · {pet.gridStatus === "visually-verified-regions" ? "9 animations · explicit frame regions" : pet.grid ? `${pet.grid.columns}×${pet.grid.rows} grid（未検証）` : pet.gridStatus}</span><small>{pet.evidence}</small></div>)}
        </div>
        <h2 className="panel-heading">Extraction totals</h2>
        <div className="json-block compact"><pre>{JSON.stringify({ sourceStats: fixture.sourceStats, selectionStats: fixture.selectionStats, colorSteering: fixture.colorSteering }, null, 2)}</pre></div>
      </aside>
    </main>
  );
}

function ControlSelect(props: { id: string; label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }): React.ReactElement {
  return <div className="control-group"><label htmlFor={props.id}>{props.label}</label><select id={props.id} value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)}>{props.children}</select></div>;
}

const root = document.getElementById("node-lab-root");
if (!root) throw new Error("node-lab-root not found");
createRoot(root).render(<App />);
