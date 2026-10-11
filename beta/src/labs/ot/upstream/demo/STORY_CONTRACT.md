# Writing a story for the demo

A story is one self-contained cast, script and set of transcripts. The demo
plays whichever story is selected; everything else — the fixture, the
narration, the tests — works the same either way.

A story lives in its own file, `demo/story_<name>.js`, and registers itself:

```js
(function () {
  'use strict';
  window.AGENTSTACK_STORIES = window.AGENTSTACK_STORIES || {};
  window.AGENTSTACK_STORIES.<name> = { /* the object below */ };
})();
```

The file must run standalone: no imports, no reliance on load order beyond
`window` existing. It is loaded before `demo_api.js`.

## The object

```
{
  id:        'research',            // matches the filename suffix and ?story=
  label:     { en: 'Research', ja: '研究' },   // shown in the story picker
  loop:      240,                   // seconds; the whole story repeats
  opensAt:   9,                     // where a visitor comes in (see below)
  cast:      [ … ],                 // agents that live during the loop
  past:      [ … ],                 // agents that finished before it starts
  script:    [ … ],                 // the mail between them
  transcripts: { name: [ … ] },     // what each agent did, from inside
  deliverables: { name: [ … ] },    // what each left behind
  beats:     [ … ],                 // the narration strip
  ja:        { 'English string': '日本語', … },  // one table, see below
}
```

### cast

```
{ name: 'AmberKepler',        // Adjective + scientist surname, see portraits
  parent: 'MossSomerville',   // omit for a root agent
  role: 'schema', emoji: '🧩', group: 'demo',   // omit role for no chip
  model: 'Opus 5', model_raw: 'claude-opus-5', provider: 'anthropic',
  program: 'claude-code',     // or 'codex' with provider 'openai'
  born: 15,                   // seconds into the loop
  dies: 182,                  // or null to keep running
  ctx0: 12, ctxRate: 0.12,    // context % at birth, and % per second
  task: 'One line, what this agent was asked to do' }
```

`past` entries are the same minus timing: `{ name, parent, model, model_raw,
provider, program, task, retired: true, ago: 5400 }` where `ago` is seconds
before now.

**The surname must have a portrait.** `dashboard/portraits_64/` holds the
available ones, and `build.sh` fails if a cast surname has no file. Every
portrait shipped must be public domain — see `PORTRAITS.txt`. If a surname
you want is not there, pick another; do not add image files.

### states — waiting on a human

The product distinguishes four live states, and two of them are the ones an
operator actually watches for:

| `act_state` | what the page shows | what it means |
|---|---|---|
| `work`     | amber LED, elapsed time | generating |
| `wait`     | faint "last Ns"         | idle, waiting for input |
| `ask`      | **red LED, APPROVAL**, `!` ring on the graph | blocked on a permission prompt |
| `question` | **cyan `?`** ring, pulled into the attention group | asking the operator to choose between options |

A story that only ever shows `work` and `wait` leaves out the reason anyone
watches this screen. Put the two blocked states on the timeline explicitly:

```
{ name: 'IvoryNoether', …,
  states: [ [120, 128, 'ask'],        // from, to, state — seconds into the loop
            [140, 168, 'question'] ] }
```

Outside those windows the agent alternates work/wait on its own. Give at
least one agent an `ask` and one a `question`, and point a beat at each —
the narration is what tells a visitor that the red LED is the product doing
its job rather than something broken.

**A window must be at least 15 seconds, and it must cover the beat that
describes it.** A realistic human answers an approval prompt in a few
seconds, but a 7-second window in a 240-second loop is on screen 3% of the
time: a visitor watching for half a minute never sees it, which is the
complaint this whole section exists to answer. Worse, a caption that says
"the red APPROVAL state is deliberate" while the state has already cleared
points at nothing. Make the human take their time, and move the reply in the
transcript to match — the transcript and the state have to tell the same
story.

### script

```
{ at: 16, from: 'AmberKepler', to: 'SlateHooke',
  subject: 'Task: map the old schema field by field',
  importance: 'high',        // or 'normal'
  ack: true,                 // optional
  body:    'Several lines.\n\nParagraphs are fine.',
  body_ja: '同じ内容の日本語。' }
```

`body` is what the drawer shows when someone opens the edge, and its first
line becomes the comet's excerpt. One-line bodies make the product look like
it does not store message contents — write what an agent would actually send:
what to do, what not to do, what to hand back.

### transcripts

`{ agentName: [ [at, role, kind, text], … ] }`

- `role` is `'user'` or `'assistant'`
- `kind` is `'text'`, `'thinking'`, `'tool_use'` or `'tool_result'`
- `tool_use` text is `'Name  arguments'` — **two spaces**, the page splits on
  them: `'Read  papers/2019-fold.pdf'`
- **The first line of every agent's transcript must be at or before its
  `born`**, otherwise a pane opened in the seconds after a spawn is empty.
  A test sweeps every second of the loop for this.

`tool_use` and `tool_result` are **not translated** — a terminal prints
English. Only `text` and `thinking` go through the `ja` table.

### deliverables

`{ agentName: [ [title, path, secondsAgo], … ] }` — what the agent left
behind. The count shows as a badge on the pane header.

### beats

The narration strip, one entry per moment worth pointing at:

```
{ at: 0, look: '.gauge.run', view: 'net',    // look/view optional
  en: 'What is happening, and where to look.',
  ja: '同じ内容の日本語。',
  net: {                                     // optional: wording for the graph
    en: 'The same moment, described as the graph shows it.',
    ja: 'グラフ表示での見え方に合わせた文。' } }
```

**A caption must describe the view the reader is actually in.** The two views
show the same state differently: a blocked agent is a red `APPROVAL` badge on
its deck card, and a `!` over its portrait on the graph. A caption that names
one of them is wrong half the time, and the reader has no way to know which
half they are in — they did not necessarily choose the view they are looking
at. Add `net` wording to any beat that describes something the graph draws
differently; beats about counts, tasks or timing usually need only one.

`look` is a CSS selector for the thing being described. `.bay[data-name="X"]`
rings a specific agent's card; `#v-net`, `.gauge.run`, `.gauge.tot` also work.
A selector that matches nothing costs the ring, not the caption.

**Name the agent.** Write "IvoryNoether has stopped and is asking to
overwrite derived data", not "an analysis child is waiting for approval".
The agents are named after scientists and those names are on the cards; a
caption that says "the second child" makes the reader search the screen for
whoever that is, and when a cyan `?` appears they cannot tell who it belongs
to or what it means. The name is the link between the sentence and the card.

The same goes for the state itself: say what the agent is waiting for in
plain words. `APPROVAL` and `?` are glyphs — the caption is where they get
explained, once, in terms anyone can follow.

### ja

One table keyed by the **exact English string**, covering every `task`,
`subject`, `deliverable title`, and every `text`/`thinking` transcript line.
Message bodies are not in this table — they use `body_ja` on the entry.

A test walks every reader-facing string and fails if one has no entry, so a
half-translated story cannot ship.

## Where a visitor comes in

`opensAt` is the second the story starts at when someone opens the page. Put
it a few seconds **before the first interesting thing**, not after it.

The first version of the migration story opened at 108, past every spawn. The
screen looked busy and the thing the product is for — a parent handing work to
a child — was 147 seconds away. A test now asserts an agent appears within 20
seconds of `opensAt`, and that at least two agents are already working at it
so the opening is not an empty page.

## What must not be in the file

The fixture is **written, not exported**. Read real logs for the shape of the
work if you like, then write something new. A test greps the file and fails on
any of: real personal or machine names, absolute paths under a home directory,
vault or repository names, or anything copied verbatim from a real transcript.

Concretely: no real people, no real institutions, no real project names, no
real file paths. Invented ones that read plausibly are the goal.

## Checking your work

```
node demo/test_demo_shapes.js      # runs against every registered story
bash demo/build.sh                 # fails if a portrait is missing
```
