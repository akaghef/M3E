function report = evaluateRapidCase(casePath, candidateOverride)
% evaluateRapidCase  MATLAB evaluator for M3E Rapid x Mapify teacher cases.
%
%   report = evaluateRapidCase("fixtures/cases/biology_expand_animals.case.json")
%   report = evaluateRapidCase("fixtures/cases/biology_expand_animals.case.json", ...
%                              "fixtures/biology/m3e_good_delta.json")
%
% This is intentionally schema-light. Codex should bind the same logic to the
% actual M3E AppState once repo details are known.

if nargin < 2
    candidateOverride = "";
end
casePath = string(casePath);
baseDir = fileparts(casePath);
caseObj = readJson(casePath);
before = readJson(fullfile(baseDir, string(caseObj.before)));
teacher = readJson(fullfile(baseDir, string(caseObj.teacherDelta)));
if strlength(candidateOverride) > 0
    candidate = readJson(candidateOverride);
else
    candidate = readJson(fullfile(baseDir, string(caseObj.candidateDelta)));
end
rubric = readJson(fullfile(baseDir, string(caseObj.rubric)));

selected = string(caseObj.selectedNodeId);
candNodes = collectDeltaNodes(candidate);
teacherNodes = collectDeltaNodes(teacher);
failures = strings(0,1);
recommendations = strings(0,1);

if isempty(candNodes)
    failures(end+1) = "F1_NO_LOCAL_DELTA";
    recommendations(end+1) = "Ensure the Rapid command produces an appendChildren delta.";
end

parents = strings(numel(candNodes),1);
for i = 1:numel(candNodes)
    parents(i) = string(candNodes(i).parentId);
end
if isempty(parents)
    locality = 0;
else
    locality = sum(parents == selected) / numel(parents);
end
if locality < 1
    failures(end+1) = "F2_WRONG_TARGET";
    recommendations(end+1) = "Append under selectedNodeId only.";
end

rootId = string(before.rootId);
if any(parents == rootId & parents ~= selected)
    failures(end+1) = "F3_GLOBAL_CONTAMINATION";
    recommendations(end+1) = "Rapid must not append to root/global map.";
end

labelScores = zeros(numel(candNodes),1);
for i = 1:numel(candNodes)
    labelScores(i) = isMapNativeLabel(string(candNodes(i).text));
end
if isempty(labelScores)
    labelQuality = 0;
else
    labelQuality = mean(labelScores);
end
if labelQuality < rubric.dimensions.label_quality.pass
    failures(end+1) = "F10_LABEL_SENTENCE_LIKE";
    recommendations(end+1) = "Use short noun labels, not sentences.";
end

roles = strings(numel(candNodes),1);
for i = 1:numel(candNodes)
    roles(i) = getSemanticRole(candNodes(i));
end
if isempty(roles)
    siblingConsistency = 0;
else
    u = unique(roles);
    counts = zeros(numel(u),1);
    for k = 1:numel(u)
        counts(k) = sum(roles == u(k));
    end
    siblingConsistency = max(counts) / numel(roles);
end
if siblingConsistency < rubric.dimensions.sibling_consistency.pass
    failures(end+1) = "F11_SIBLING_TYPE_MIX";
    recommendations(end+1) = "Keep siblings at the same semanticRole/granularity.";
end

candTexts = collectTexts(candNodes);
teacherTexts = collectTexts(teacherNodes);
existingTexts = collectExistingTexts(before);
duplicates = intersect(candTexts, existingTexts);
if isempty(candTexts)
    nonDuplication = 0;
else
    nonDuplication = 1 - numel(duplicates) / numel(candTexts);
end
if ~isempty(duplicates)
    failures(end+1) = "F12_DUPLICATE_EXISTING_NODE";
    recommendations(end+1) = "Filter existing labels before applying delta.";
end

unionTexts = union(candTexts, teacherTexts);
interTexts = intersect(candTexts, teacherTexts);
if isempty(unionTexts)
    teacherProximity = 0;
else
    teacherProximity = numel(interTexts) / numel(unionTexts);
end

if isfield(candidate, 'actions') && ~isempty(candidate.actions)
    ok = 0;
    for i = 1:numel(candidate.actions)
        a = candidate.actions(i);
        if string(a.type) == "appendChildren" && string(a.parentId) == selected
            ok = ok + 1;
        end
    end
    deltaDiscipline = ok / numel(candidate.actions);
else
    deltaDiscipline = 0;
end

score = locality * rubric.dimensions.locality.weight + ...
        labelQuality * rubric.dimensions.label_quality.weight + ...
        siblingConsistency * rubric.dimensions.sibling_consistency.weight + ...
        nonDuplication * rubric.dimensions.non_duplication.weight + ...
        teacherProximity * rubric.dimensions.teacher_proximity.weight + ...
        deltaDiscipline * rubric.dimensions.delta_discipline.weight;

critical = string(rubric.critical_failures);
passed = score >= 0.80 && isempty(intersect(unique(failures), critical));

report = struct();
report.caseId = string(caseObj.caseId);
report.score = score;
report.passed = passed;
report.dimensions = struct( ...
    'locality', locality, ...
    'label_quality', labelQuality, ...
    'sibling_consistency', siblingConsistency, ...
    'non_duplication', nonDuplication, ...
    'teacher_proximity', teacherProximity, ...
    'delta_discipline', deltaDiscipline);
report.failures = unique(failures);
report.recommendations = unique(recommendations);
report.teacherLabels = teacherTexts;
report.candidateLabels = candTexts;
end

function obj = readJson(path)
text = fileread(path);
obj = jsondecode(text);
end

function nodes = collectDeltaNodes(delta)
nodes = struct('text', {}, 'parentId', {}, 'attributes', {});
if ~isfield(delta, 'actions')
    return;
end
for i = 1:numel(delta.actions)
    a = delta.actions(i);
    if ~isfield(a, 'nodes')
        continue;
    end
    for j = 1:numel(a.nodes)
        n = a.nodes(j);
        n.parentId = a.parentId;
        nodes(end+1) = n; %#ok<AGROW>
    end
end
end

function ok = isMapNativeLabel(text)
text = strtrim(string(text));
hints = ["です", "ます", "とは", "について", "である", "を持つ", "は"];
if strlength(text) == 0 || strlength(text) > 12
    ok = 0; return;
end
if contains(text, ["。", "．", ".", "!", "?", "？", "！", "、", ",", ";", "；", ":", "："])
    ok = 0; return;
end
if any(contains(text, hints))
    ok = 0; return;
end
ok = 1;
end

function role = getSemanticRole(node)
role = "unknown";
if isfield(node, 'attributes') && isfield(node.attributes, 'semanticRole')
    role = string(node.attributes.semanticRole);
end
end

function texts = collectTexts(nodes)
texts = strings(0,1);
for i = 1:numel(nodes)
    t = strtrim(string(nodes(i).text));
    if strlength(t) > 0
        texts(end+1) = t; %#ok<AGROW>
    end
end
texts = unique(texts);
end

function texts = collectExistingTexts(tree)
texts = strings(0,1);
keys = fieldnames(tree.nodes);
for i = 1:numel(keys)
    n = tree.nodes.(keys{i});
    texts(end+1) = string(n.text); %#ok<AGROW>
end
texts = unique(texts);
end
