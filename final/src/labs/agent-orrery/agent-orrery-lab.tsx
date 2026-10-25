import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Bug,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileCheck2,
  GitBranch,
  ListFilter,
  LockKeyhole,
  MessageSquareText,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import {
  AGENT_ORRERY_FIXTURE as fixture,
  agentStateAt,
  taskStateAt,
  type Rg1Agent,
  type Rg1Task,
} from "./agent_orrery_fixture";
import "./agent-orrery-lab.css";

const releaseAt = 218;
const defaultAt = 94;

function elapsed(at: number): string {
  const minutes = Math.floor(at / 60);
  const seconds = at % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function statusAt(at: number): { label: string; tone: string } {
  if (at >= 218) return { label: "Resolved", tone: "resolved" };
  if (at >= 175) return { label: "Monitoring", tone: "monitoring" };
  if (at >= 154) return { label: "Decision", tone: "attention" };
  if (at >= 57 && at < 76) return { label: "Approval", tone: "attention" };
  return { label: at === 0 ? "New" : "In progress", tone: "active" };
}

function taskStateLabel(task: Rg1Task, at: number): string {
  const state = taskStateAt(task, at);
  return state === "done" ? "Done" : state === "active" ? "Active" : state === "blocked" ? "Blocked" : "Queued";
}

function selectOnKeyboard(event: React.KeyboardEvent, select: () => void): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select();
  }
}

function App(): React.ReactElement {
  const [at, setAt] = useState(defaultAt);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>("task-impact");
  const [playing, setPlaying] = useState(false);
  const selectedTask = fixture.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedAgentId = selectedTask?.assigneeId ?? null;
  const issueStatus = statusAt(at);

  React.useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setAt((current) => {
        if (current >= releaseAt) {
          setPlaying(false);
          return releaseAt;
        }
        return Math.min(releaseAt, current + 1);
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [playing]);

  const currentEvent = useMemo(
    () => [...fixture.timeline].reverse().find((event) => event.at <= at) ?? fixture.timeline[0],
    [at],
  );

  const visibleChat = useMemo(() => {
    const available = fixture.chat.filter((message) => message.at <= at);
    if (!selectedTaskId) return available;
    const related = available.filter((message) => message.taskId === selectedTaskId);
    return related.length ? related : available;
  }, [at, selectedTaskId]);

  const producedCount = fixture.deliverables.filter((deliverable) => deliverable.producedAt <= at).length;
  const doneCount = fixture.tasks.filter((task) => taskStateAt(task, at) === "done").length;
  const gateOpen = at >= 175;

  const selectTask = (task: Rg1Task): void => setSelectedTaskId(task.id);
  const selectAgent = (agent: Rg1Agent): void => setSelectedTaskId(agent.taskId);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><Sparkles size={17} /></div>
        <div className="brand-block">
          <strong>AgentStack</strong><span>× M3E</span>
        </div>
        <div className="story-chip"><span className="live-dot" /> RG1 · fixture story</div>
        <div className="topbar-spacer" />
        <div className="boundary-chip"><ShieldCheck size={14} /> Mock only · no agent runtime</div>
      </header>

      <section className="workspace">
        <aside className="issue-rail" data-testid="issue-list">
          <div className="rail-heading">
            <div><span className="section-label">Workspace</span><h2>Issue List</h2></div>
            <button className="icon-button" aria-label="Filter issues"><ListFilter size={17} /></button>
          </div>
          <div className="issue-counts"><span>1 open</span><span>Payments</span></div>
          <button className="issue-row selected" data-testid={`issue-row-${fixture.issue.id}`}>
            <span className="severity-mark">S1</span>
            <span className="issue-copy">
              <span className="issue-id">{fixture.issue.id}</span>
              <strong>{fixture.issue.title}</strong>
              <span className="issue-meta">{fixture.issue.source} · {fixture.issue.openedAt}</span>
            </span>
            <ChevronRight size={16} />
          </button>
          <div className="rail-empty">
            <CheckCircle2 size={17} />
            <span>No other incidents in this fixture</span>
          </div>
          <div className="rail-legend">
            <span className="section-label">Trace</span>
            <p><i className="legend-line assignment" /> Assignment link</p>
            <p><FileCheck2 size={14} className="legend-evidence" /> Evidence badge</p>
            <p><UserRoundCheck size={14} className="legend-authority" /> Authority event</p>
          </div>
        </aside>

        <section className="case-area">
          <div className="case-header">
            <div className="case-title-row">
              <div className="case-icon"><Bug size={20} /></div>
              <div>
                <div className="breadcrumb">Issues <ChevronRight size={13} /> {fixture.issue.id}</div>
                <h1>{fixture.title}</h1>
              </div>
              <span className={`status-badge ${issueStatus.tone}`} data-testid="issue-status">{issueStatus.label}</span>
            </div>
            <p className="case-summary">A customer pressed Pay once. Two charge records appeared after confirmation was delayed.</p>
            <div className="case-tags">
              <span className="tag severity"><AlertTriangle size={13} /> {fixture.issue.severity}</span>
              <span className="tag">{fixture.case.scope}</span>
              <span className="tag"><GitBranch size={13} /> {fixture.case.id}</span>
            </div>
          </div>

          <div className="metrics-row">
            <div className="metric"><span>Tasks</span><strong>{doneCount}<small> / {fixture.tasks.length}</small></strong></div>
            <div className="metric"><span>Agents assigned</span><strong>{fixture.agents.filter((agent) => at >= agent.bornAt).length}<small> / {fixture.agents.length}</small></strong></div>
            <div className="metric"><span>Evidence</span><strong>{producedCount}<small> / {fixture.deliverables.length}</small></strong></div>
            <div className={`metric gate-metric ${gateOpen ? "open" : "closed"}`} data-testid="release-gate">
              <span>{gateOpen ? <CheckCircle2 size={14} /> : <LockKeyhole size={14} />} Release gate</span>
              <strong>{gateOpen ? "Released" : "Closed"}</strong>
            </div>
          </div>

          <section className="orchestration-board" data-testid="case-board">
            <div className="board-heading">
              <div><span className="section-label">Case topology</span><h2>Work → Agent → Evidence</h2></div>
              <span className="board-note"><CircleDot size={14} /> Select either side to trace ownership</span>
            </div>

            <div data-testid="m3e-map-path" className="map-path">{fixture.mapPath}</div>
            <div data-testid="surface-mode" className="map-path">Disperse · static Orrery reference · no force solver</div>
            <svg data-testid="m3e-surface" viewBox="0 0 1000 700" className="reference-map" aria-label="Incident map reference">
              {fixture.scopes.map(scope=><g key={scope.id} data-scope-boundary={scope.id}>
                <rect x={scope.x} y={scope.y} width={scope.width} height={scope.height} rx="12" fill="#0c1722" stroke="#314258" strokeDasharray="5 4" />
                <text x={scope.x+12} y={scope.y+20} fill="#a8b5c7" fontSize="14">{scope.label}</text>
              </g>)}
              {fixture.graphLinks.map(link=>{
                const from=fixture.graphNodes.find(n=>n.id===link.from)!,to=fixture.graphNodes.find(n=>n.id===link.to)!;
                const x1=from.x+(from.width??100)/2,y1=from.y+20,x2=to.x+(to.width??100)/2,y2=to.y+20;
                return <path key={link.id} data-link-class={link.class} data-relation={link.relation}
                  d={`M${x1} ${y1} C${(x1+x2)/2} ${y1},${(x1+x2)/2} ${y2},${x2} ${y2}`} fill="none"
                  stroke={link.taskId===selectedTaskId?"#51d7e8":link.class==="edge"?"#48576b":"#557e76"}
                  strokeWidth={link.taskId===selectedTaskId?2.5:1.3} strokeDasharray={link.class==="GraphLink"?"4 3":undefined} />;
              })}
              {fixture.graphNodes.filter(n=>!["case-root","evidence-root"].includes(n.id)).map(n=>{
                const selected=Boolean(n.taskId&&n.taskId===selectedTaskId),task=fixture.tasks.find(t=>t.id===n.taskId);
                return <g key={n.id} data-node-kind={n.kind} data-testid={n.agentId?`agent-${n.agentId}`:task&&n.id===`graph-${task.id}`?`task-${task.id}`:n.id}
                  role={task?"button":undefined} tabIndex={task?0:undefined} aria-selected={task?selected:undefined}
                  onClick={()=>task&&selectTask(task)} onKeyDown={event=>task&&selectOnKeyboard(event,()=>selectTask(task))}
                  transform={`translate(${n.x},${n.y})`} style={{cursor:task?"pointer":"default"}}>
                  <title>{n.label}</title>
                  <rect width={n.width??140} height="44" rx={n.kind==="agent"?22:7} fill={selected?"#193c48":"#142333"} stroke={selected?"#51d7e8":"#60718a"} />
                  <text x="8" y="27" fill="#edf2f8" fontSize="14">{n.label.length>20?n.label.slice(0,19)+"…":n.label}</text>
                </g>;
              })}
            </svg>
            <div data-testid="m3e-inspector" className="map-inspector">
              <strong>{selectedTask?.title??"Incident map"}</strong>
              <p>{selectedTask?.description??"Select a node to trace its work and evidence."}</p>
              <span>GraphLinks: {fixture.graphLinks.filter(l=>l.class==="GraphLink"&&(!selectedTaskId||l.taskId===selectedTaskId)).map(l=>l.relation).join(" · ")}</span>
            </div>
          </section>
        </section>

        <aside className="chat-panel" data-testid="chat-panel">
          <div className="chat-header">
            <div>
              <span className="section-label">Linked activity</span>
              <h2><MessageSquareText size={18} /> Incident Chat</h2>
            </div>
            <span className="message-count">{visibleChat.length}</span>
          </div>
          <div className="chat-context">
            <span>{fixture.issue.id}</span><ChevronRight size={12} />
            <strong>{selectedTask?.shortTitle ?? "All activity"}</strong>
            {selectedTaskId && <button onClick={() => setSelectedTaskId(null)}>Show all</button>}
          </div>
          <div className="messages" aria-live="polite">
            {visibleChat.map((message) => (
              <article key={message.id} className={`message kind-${message.kind ?? "message"}`}>
                <div className="message-avatar">{message.from === "M3E" ? <Sparkles size={14} /> : message.from === "Human authority" ? <UserRoundCheck size={14} /> : <Bot size={14} />}</div>
                <div className="message-body">
                  <div className="message-meta"><strong>{message.from}</strong><span>{elapsed(message.at)}</span></div>
                  <h3>{message.subject}</h3>
                  <p>{message.body}</p>
                  {message.agentId && <span className="message-link"><ArrowRight size={11} /> linked to assignment</span>}
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="replay-dock">
        <button className="play-button" aria-label={playing ? "Pause replay" : "Play replay"} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
        <div className="time-code"><span>Replay</span><strong>{elapsed(at)}</strong></div>
        <div className="timeline-control">
          <input aria-label="Incident replay time" type="range" min="0" max={releaseAt} value={at} onChange={(event) => { setPlaying(false); setAt(Number(event.target.value)); }} />
          <div className="timeline-ticks">{fixture.timeline.map((event) => <i key={`${event.at}-${event.kind}`} style={{ left: `${(event.at / releaseAt) * 100}%` }} title={event.label} />)}</div>
        </div>
        <div className="current-event" data-testid="timeline-current">
          <span className={`event-symbol kind-${currentEvent.kind}`}><Radio size={13} /></span>
          <div><strong>{currentEvent.label}</strong><span>{currentEvent.detail}</span></div>
        </div>
        <button className="jump-button" onClick={() => { setPlaying(false); setAt(releaseAt); setSelectedTaskId(null); }}>Jump to release</button>
      </section>
    </main>
  );
}

createRoot(document.getElementById("agent-orrery-root")!).render(<App />);
