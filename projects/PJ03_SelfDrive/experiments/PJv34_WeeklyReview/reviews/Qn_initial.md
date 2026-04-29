# Qn Initial — PJv34 WeeklyReview

## Qn1. Phase 0 の入力境界

### 問い

Phase 0 で `projects/` 内のどのファイルを読むか。

### Option A: README / plan / tasks.yaml / reviews のみ

- pros: sub-PJ protocol と整合し、読み取り範囲が狭い。
- cons: sessions / artifacts にある実績を拾えない。

### Option B: projects/ 配下を広く読む

- pros: 情報量が多い。
- cons: ノイズと機微情報混入リスクが増える。

### Tentative Default

Option A。Phase 0 は最小入力で loop を通す。

## Qn2. PJ status の判定源

### 問い

PJ の active / paused / done 判定を README frontmatter だけで行うか、plan.md も見るか。

### Tentative Default

Phase 0 は README frontmatter を第一候補にし、不足時だけ plan.md の `status` を見る。

## Qn3. proposal 保存先

### 問い

生成した review proposal を `tmp/` にどう保存するか。

### Tentative Default

Phase 0 は `tmp/weekly-review-latest.md` と `tmp/weekly-review-latest.json` を上書き保存する。必要なら timestamp 版を追加する。

## Qn4. LangGraph 導入タイミング

### 問い

Phase 1 で `@langchain/langgraph` を直接導入するか、まずは自前のGraph-shaped runnerで形を固めるか。

### Tentative Default

まず自前のGraph-shaped runnerで `State -> Node -> Edge -> Result` の境界を固める。依存追加が問題なければ `@langchain/langgraph` へ移す。
