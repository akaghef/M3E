const snippets = {
  modern: `from typing_extensions import TypedDict
from langgraph.graph import START, END, StateGraph

class State(TypedDict):
    user_input: str
    answer: str

def answer_once(state: State) -> dict[str, str]:
    return {"answer": f"received: {state['user_input']}"}

builder = StateGraph(State)
builder.add_node("answer_once", answer_once)
builder.add_edge(START, "answer_once")
builder.add_edge("answer_once", END)

graph = builder.compile()
print(graph.invoke({"user_input": "hello"}))`,

  task: `from typing import Literal
from typing_extensions import TypedDict
from langgraph.graph import START, END, StateGraph

class TaskState(TypedDict):
    raw_input: str
    tasks: list[str]
    prioritized: list[dict]
    summary: str

def parse_tasks(state: TaskState):
    return {"tasks": ["レポートを書く", "洗濯する"]}

def add_priority(state: TaskState):
    return {"prioritized": [{"task": t, "priority": "中"} for t in state["tasks"]]}

def route_after_priority(state: TaskState) -> Literal["deadline", "summary"]:
    return "deadline" if "今日" in state["raw_input"] else "summary"

def deadline_estimate(state: TaskState):
    return {"prioritized": [{**x, "due": "今日"} for x in state["prioritized"]]}

def summarize(state: TaskState):
    return {"summary": "期限が近いものから処理する。"}

builder = StateGraph(TaskState)
builder.add_node("parse", parse_tasks)
builder.add_node("priority", add_priority)
builder.add_node("deadline", deadline_estimate)
builder.add_node("summary", summarize)
builder.add_edge(START, "parse")
builder.add_edge("parse", "priority")
builder.add_conditional_edges("priority", route_after_priority, {
    "deadline": "deadline",
    "summary": "summary",
})
builder.add_edge("deadline", "summary")
builder.add_edge("summary", END)
graph = builder.compile()`,

  tools: `from typing_extensions import TypedDict, Annotated
from langchain_core.messages import ToolMessage
from langchain_core.tools import tool
from langgraph.graph import START, END, StateGraph
from langgraph.graph.message import add_messages

class ChatState(TypedDict):
    messages: Annotated[list, add_messages]

@tool
def multiply(x: int, y: int) -> int:
    return x * y

tools_by_name = {"multiply": multiply}

def chatbot(state: ChatState):
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def tool_node(state: ChatState):
    outputs = []
    for call in state["messages"][-1].tool_calls:
        result = tools_by_name[call["name"]].invoke(call["args"])
        outputs.append(ToolMessage(content=str(result), tool_call_id=call["id"]))
    return {"messages": outputs}

def route_tools(state: ChatState):
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else END

builder = StateGraph(ChatState)
builder.add_node("chatbot", chatbot)
builder.add_node("tools", tool_node)
builder.add_edge(START, "chatbot")
builder.add_conditional_edges("chatbot", route_tools, {"tools": "tools", END: END})
builder.add_edge("tools", "chatbot")
graph = builder.compile()`,
};

const traces = {
  deadline: [
    ["START", "入力 State を graph に渡す"],
    ["parse", "自然文から作業単位を抽出する"],
    ["priority", "各 task に優先度を付ける"],
    ["deadline", "期限語を見て due を補完し、今日・明日なら高優先度へ寄せる"],
    ["summary", "取り組み順の一文を作る"],
    ["END", "最終 State を返す"],
  ],
  plain: [
    ["START", "入力 State を graph に渡す"],
    ["parse", "自然文から作業単位を抽出する"],
    ["priority", "各 task に優先度を付ける"],
    ["summary", "期限推定を飛ばしてまとめる"],
    ["END", "最終 State を返す"],
  ],
  tool: [
    ["START", "user message を State.messages に入れる"],
    ["chatbot", "LLM が回答または tool call を返す"],
    ["tools", "tool call を実行し ToolMessage を追加する"],
    ["chatbot", "tool result を読んで最終回答を生成する"],
    ["END", "会話 State を返す"],
  ],
};

const diagrams = {
  deadline: `flowchart LR
  Start((START)) --> Parse["parse_tasks"]
  Parse --> Priority["add_priority"]
  Priority -->|"期限語あり"| Deadline["deadline_estimate"]
  Priority -.->|"期限語なし"| Summary["summarize"]
  Deadline --> Summary
  Summary --> End((END))`,
  plain: `flowchart LR
  Start((START)) --> Parse["parse_tasks"]
  Parse --> Priority["add_priority"]
  Priority -.->|"期限語あり"| Deadline["deadline_estimate"]
  Priority -->|"期限語なし"| Summary["summarize"]
  Deadline -.-> Summary
  Summary --> End((END))`,
  tool: `flowchart LR
  Start((START)) --> Chatbot["chatbot"]
  Chatbot -->|"tool_calls"| Tools["tool_node"]
  Tools --> Chatbot
  Chatbot -->|"no tool_calls"| End((END))`,
};

const codeBlock = document.getElementById("codeBlock");
const tabs = Array.from(document.querySelectorAll(".tab"));
const scenarioSelect = document.getElementById("scenarioSelect");
const traceList = document.getElementById("traceList");
const flowDiagram = document.getElementById("flowDiagram");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const checklist = document.getElementById("checklist");
const navLinks = Array.from(document.querySelectorAll(".rail-nav a"));

function renderCode(name) {
  codeBlock.textContent = snippets[name];
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
}

async function renderScenario(name) {
  flowDiagram.textContent = diagrams[name];
  traceList.innerHTML = traces[name]
    .map((item, index) => {
      const [label, detail] = item;
      return `<article class="trace-item"><span>${index + 1}</span><div><strong>${label}</strong><p>${detail}</p></div></article>`;
    })
    .join("");

  if (window.mermaid) {
    flowDiagram.removeAttribute("data-processed");
    await window.mermaid.run({ nodes: [flowDiagram] });
  }
}

function updateProgress() {
  const checks = Array.from(checklist.querySelectorAll("input"));
  const done = checks.filter((input) => input.checked).length;
  progressText.textContent = `${done} / ${checks.length}`;
  progressBar.style.width = `${(done / checks.length) * 100}%`;
}

function updateActiveNav() {
  const current = navLinks
    .map((link) => {
      const target = document.querySelector(link.getAttribute("href"));
      return { link, top: target.getBoundingClientRect().top };
    })
    .filter((item) => item.top < 180)
    .pop();

  navLinks.forEach((link) => link.removeAttribute("aria-current"));
  (current?.link ?? navLinks[0]).setAttribute("aria-current", "page");
}

tabs.forEach((tab) => tab.addEventListener("click", () => renderCode(tab.dataset.tab)));
scenarioSelect.addEventListener("change", () => renderScenario(scenarioSelect.value));
checklist.addEventListener("change", updateProgress);
document.addEventListener("scroll", updateActiveNav, { passive: true });

window.addEventListener("load", async () => {
  if (window.mermaid) {
    window.mermaid.initialize({ startOnLoad: false, theme: "base" });
  }
  renderCode("modern");
  await renderScenario("deadline");
  updateProgress();
  updateActiveNav();
});
