<map version="0.9.0">
<!--To view this file, download free mind mapping software Freeplane from https://www.freeplane.org -->
<bookmarks/>
<node TEXT="PJv34 Weekly Review System" COLOR="#000000" STYLE="oval" NUMBERED="false" FORMAT="STANDARD_FORMAT" TEXT_ALIGN="DEFAULT" TEXT_WRITING_DIRECTION="LEFT_TO_RIGHT" MAX_WIDTH="378" MAX_WIDTH_QUANTITY="10 cm" MIN_WIDTH="0" MIN_WIDTH_QUANTITY="0 cm" BORDER_WIDTH_LIKE_EDGE="false" BORDER_WIDTH="1 px" BORDER_COLOR_LIKE_EDGE="true" BORDER_COLOR="#808080" BORDER_DASH_LIKE_EDGE="false" BORDER_DASH="SOLID" FOLDED="false" ID="ID_1000000000" CREATED="1777680000000" MODIFIED="1777680000000" ICON_SIZE="12 pt">
<edge STYLE="bezier" COLOR="#808080" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="18" BOLD="false" UNDERLINED="false" STRIKETHROUGH="false" ITALIC="false"/>
<hook NAME="MapStyle" zoom="1.0">
    <properties edgeColorConfiguration="#808080ff,#ff0000ff,#0000ffff,#00ff00ff,#ff00ffff,#00ffffff,#7c0000ff,#00007cff,#007c00ff,#7c007cff,#007c7cff,#7c7c00ff" auto_compact_layout="true" fit_to_viewport="false" show_icons="BESIDE_NODES" associatedTemplateLocation="template:/standard-1.6.mm" showTagCategories="false" show_tags="UNDER_NODES" show_note_icons="true" show_icon_for_attributes="true"/>
    <tags category_separator="::"/>
</hook>
<hook NAME="AutomaticEdgeColor" COUNTER="6" RULE="ON_BRANCH_CREATION"/>

<node TEXT="Inputs (projects/)" COLOR="#000000" STYLE="fork" POSITION="bottom_or_left" ID="ID_1000000100" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="12" BOLD="true" UNDERLINED="false" STRIKETHROUGH="false" ITALIC="false"/>
<node TEXT="projects/PJ*/README.md (frontmatter: status, pj_id, project)" COLOR="#000000" STYLE="fork" ID="ID_1000000101" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="projects/PJ*/plan.md (status, progress lines)" COLOR="#000000" STYLE="fork" ID="ID_1000000102" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="projects/PJ*/tasks.yaml (status counts, pending targets)" COLOR="#000000" STYLE="fork" ID="ID_1000000103" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="projects/PJ*/reviews/*.md (review count)" COLOR="#000000" STYLE="fork" ID="ID_1000000104" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="discoverProjectDirs (depth&lt;=4, skip node_modules / dotfiles)" COLOR="#000000" STYLE="fork" ID="ID_1000000105" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
</node>

<node TEXT="Graph (init -&gt; load -&gt; context -&gt; report -&gt; write -&gt; done)" COLOR="#000000" STYLE="fork" POSITION="bottom_or_right" ID="ID_1000000200" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="2" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="12" BOLD="true"/>
<node TEXT="init :: createInitialState (root, projectsRoot, outputRoot, provider)" COLOR="#000000" STYLE="fork" ID="ID_1000000201" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="load_projects :: discoverProjectDirs -&gt; projectDirs[]" COLOR="#000000" STYLE="fork" ID="ID_1000000202" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="build_context :: summarizeProject x N -&gt; WeeklyReviewOutput" COLOR="#000000" STYLE="fork" ID="ID_1000000203" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
<node TEXT="ProjectSummary (id, status, taskCounts, recentProgress, nextActions, warnings)" COLOR="#000000" STYLE="fork" ID="ID_1000000204" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="9"/>
</node>
<node TEXT="questions[] = warnings -&gt; {project,title,reason}" COLOR="#000000" STYLE="fork" ID="ID_1000000205" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="9"/>
</node>
<node TEXT="summary {projectCount,active,paused,done,unknown}" COLOR="#000000" STYLE="fork" ID="ID_1000000206" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="9"/>
</node>
</node>
<node TEXT="generate_report :: provider branch" COLOR="#000000" STYLE="fork" ID="ID_1000000207" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
<node TEXT="local :: renderMarkdown(output) -&gt; localMarkdown" COLOR="#000000" STYLE="fork" ID="ID_1000000208" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="9"/>
</node>
<node TEXT="deepseek :: runDeepSeekReview(output) -&gt; deepSeekOutput (markdown | error)" COLOR="#000000" STYLE="fork" ID="ID_1000000209" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="9"/>
</node>
</node>
<node TEXT="write_artifacts :: fs.writeFileSync to tmp/" COLOR="#000000" STYLE="fork" ID="ID_1000000210" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="done :: trace push" COLOR="#000000" STYLE="fork" ID="ID_1000000211" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#0000ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
</node>

<node TEXT="State (WeeklyReviewState)" COLOR="#000000" STYLE="fork" POSITION="bottom_or_left" ID="ID_1000000300" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#00aa00" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="12" BOLD="true"/>
<node TEXT="root / projectsRoot / outputRoot" COLOR="#000000" STYLE="fork" ID="ID_1000000301" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#00aa00" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="provider: local | deepseek (env WEEKLY_REVIEW_PROVIDER)" COLOR="#000000" STYLE="fork" ID="ID_1000000302" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#00aa00" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="projectDirs[] / output / localMarkdown / deepSeekOutput" COLOR="#000000" STYLE="fork" ID="ID_1000000303" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#00aa00" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="artifacts[] / errors[] / trace[]" COLOR="#000000" STYLE="fork" ID="ID_1000000304" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#00aa00" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
</node>

<node TEXT="Outputs (tmp/)" COLOR="#000000" STYLE="fork" POSITION="bottom_or_right" ID="ID_1000000400" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff00ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="12" BOLD="true"/>
<node TEXT="weekly-review-latest.json (WeeklyReviewOutput)" COLOR="#000000" STYLE="fork" ID="ID_1000000401" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff00ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="weekly-review-latest.md (local deterministic)" COLOR="#000000" STYLE="fork" ID="ID_1000000402" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff00ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="weekly-review-deepseek-latest.json (model, latency, usage, error)" COLOR="#000000" STYLE="fork" ID="ID_1000000403" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff00ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="weekly-review-deepseek-latest.md (DeepSeek markdown)" COLOR="#000000" STYLE="fork" ID="ID_1000000404" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff00ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="weekly-review-trace-latest.json (ok, trace[], errors[], artifacts[])" COLOR="#000000" STYLE="fork" ID="ID_1000000405" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#ff00ff" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
</node>

<node TEXT="Provider Boundary" COLOR="#000000" STYLE="fork" POSITION="bottom_or_left" ID="ID_1000000500" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#00cccc" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="12" BOLD="true"/>
<node TEXT="local :: deterministic, no key, no network" COLOR="#000000" STYLE="fork" ID="ID_1000000501" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#00cccc" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="deepseek :: M3E_AI_API_KEY / M3E_AI_BASE_URL / M3E_AI_MODEL" COLOR="#000000" STYLE="fork" ID="ID_1000000502" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#00cccc" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="failure -&gt; Result {ok:false, error{message,status}} (loop continues)" COLOR="#000000" STYLE="fork" ID="ID_1000000503" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#00cccc" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
</node>

<node TEXT="Constraints (Phase 0)" COLOR="#000000" STYLE="fork" POSITION="bottom_or_right" ID="ID_1000000600" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#7c0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="12" BOLD="true"/>
<node TEXT="key-less / network-less E2E" COLOR="#000000" STYLE="fork" ID="ID_1000000601" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#7c0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="failure -&gt; Result / Qn-like, never crash loop" COLOR="#000000" STYLE="fork" ID="ID_1000000602" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#7c0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="output limited to tmp/, no map/docs writeback" COLOR="#000000" STYLE="fork" ID="ID_1000000603" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#7c0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="ensureInside guards path escape" COLOR="#000000" STYLE="fork" ID="ID_1000000604" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#7c0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
<node TEXT="graph-shaped runner now, @langchain/langgraph later" COLOR="#000000" STYLE="fork" ID="ID_1000000605" CREATED="1777680000000" MODIFIED="1777680000000">
<edge STYLE="bezier" COLOR="#7c0000" WIDTH="1" DASH="SOLID"/>
<font NAME="SansSerif" SIZE="10"/>
</node>
</node>

</node>
</map>
