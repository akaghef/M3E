const fileInput = document.getElementById("file-input");
      const loadDefaultBtn = document.getElementById("load-default");
      const loadAirplaneBtn = document.getElementById("load-airplane");
      const loadAircraftMmBtn = document.getElementById("load-aircraft-mm");
      const runAircraftVisualCheckBtn = document.getElementById("run-aircraft-visual-check");
      const stopVisualCheckBtn = document.getElementById("stop-visual-check");
      const fitAllBtn = document.getElementById("fit-all");
      const focusSelectedBtn = document.getElementById("focus-selected");
      const addChildBtn = document.getElementById("add-child");
      const addSiblingBtn = document.getElementById("add-sibling");
      const toggleCollapseBtn = document.getElementById("toggle-collapse");
      const deleteNodeBtn = document.getElementById("delete-node");
      const markReparentBtn = document.getElementById("mark-reparent");
      const applyReparentBtn = document.getElementById("apply-reparent");
      const zoomOutBtn = document.getElementById("zoom-out");
      const zoomResetBtn = document.getElementById("zoom-reset");
      const zoomInBtn = document.getElementById("zoom-in");
      const downloadBtn = document.getElementById("download-btn");
      const applyEditBtn = document.getElementById("apply-edit");
      const editInput = document.getElementById("edit-input");
      const metaEl = document.getElementById("meta");
      const statusEl = document.getElementById("status");
      const visualCheckEl = document.getElementById("visual-check");
      const board = document.getElementById("board");
      const canvas = document.getElementById("canvas");
      const MAX_UNDO_STEPS = 100;

      let doc = null;
      let visibleOrder = [];
      let statusTimer = null;
      let contentWidth = 1600;
      let contentHeight = 900;
      let lastLayout = null;
      let visualCheckRunId = 0;
      let undoStack = [];
      let redoStack = [];
      let viewState = {
        selectedNodeId: "",
        zoom: 1,
        cameraX: VIEWER_TUNING.pan.initialCameraX,
        cameraY: VIEWER_TUNING.pan.initialCameraY,
        panState: null,
        reparentSourceId: "",
        dragState: null,
      };

      function nowIso() {
        return new Date().toISOString();
      }

      function createNodeRecord(id, parentId, text = "New Node") {
        return {
          id,
          parentId,
          children: [],
          text,
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        };
      }

      function createEmptyDoc() {
        const rootId = newId();
        return {
          version: 1,
          savedAt: nowIso(),
          state: {
            rootId,
            nodes: {
              [rootId]: createNodeRecord(rootId, null, "Research Root"),
            },
          },
        };
      }

      function ensureDocShape(payload) {
        const candidate = payload && payload.state ? payload : { version: 1, savedAt: nowIso(), state: payload };
        if (!candidate || !candidate.state || !candidate.state.nodes || !candidate.state.rootId) {
          throw new Error("Invalid JSON format");
        }
        Object.values(candidate.state.nodes).forEach((node) => {
          node.children = Array.isArray(node.children) ? node.children : [];
          node.text = node.text || "";
          node.collapsed = Boolean(node.collapsed);
          node.details = node.details || "";
          node.note = node.note || "";
          node.attributes = node.attributes && typeof node.attributes === "object" ? node.attributes : {};
          node.link = node.link || "";
        });
        return candidate;
      }

      function newId() {
        return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }

      function escapeXml(text) {
        return String(text)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      function textWidth(str, fontSize) {
        return Math.max(80, String(str || "").length * fontSize * 0.56);
      }

      function richContentText(element, type) {
        const richNodes = Array.from(element.children).filter((child) => {
          return child.tagName === "richcontent" && (child.getAttribute("TYPE") || "").toUpperCase() === type;
        });
        return richNodes
          .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join("\n");
      }

      function parseMmText(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "application/xml");
        const parserError = xml.querySelector("parsererror");
        if (parserError) {
          throw new Error("Invalid .mm XML");
        }

        const mapNode = xml.querySelector("map > node");
        if (!mapNode) {
          throw new Error("No root node found in .mm file");
        }

        const state = {
          rootId: "",
          nodes: {},
        };

        function convertNode(mmNode, parentId = null) {
          const id = newId();
          const text =
            mmNode.getAttribute("TEXT") ||
            richContentText(mmNode, "NODE") ||
            "(empty)";
          const record = createNodeRecord(id, parentId, text);
          record.collapsed = (mmNode.getAttribute("FOLDED") || "").toLowerCase() === "true";
          record.link = mmNode.getAttribute("LINK") || "";
          record.details = richContentText(mmNode, "DETAILS");
          record.note = richContentText(mmNode, "NOTE");

          const attributesEl = Array.from(mmNode.children).find((child) => child.tagName === "attributes");
          if (attributesEl) {
            Array.from(attributesEl.children)
              .filter((child) => child.tagName === "attribute")
              .forEach((attribute) => {
                const key = attribute.getAttribute("NAME");
                if (!key) {
                  return;
                }
                record.attributes[key] = attribute.getAttribute("VALUE") || "";
              });
          }

          state.nodes[id] = record;
          if (!state.rootId) {
            state.rootId = id;
          }

          Array.from(mmNode.children)
            .filter((child) => child.tagName === "node")
            .forEach((childNode) => {
              const childId = convertNode(childNode, id);
              record.children.push(childId);
            });

          return id;
        }

        convertNode(mapNode, null);

        return {
          version: 1,
          savedAt: nowIso(),
          state,
        };
      }

      function getNode(nodeId) {
        const node = doc.state.nodes[nodeId];
        if (!node) {
          throw new Error(`Node not found: ${nodeId}`);
        }
        return node;
      }

      function cloneState(state) {
        return JSON.parse(JSON.stringify(state));
      }

      function pushUndoSnapshot() {
        if (!doc) {
          return;
        }
        undoStack.push({
          state: cloneState(doc.state),
          selectedNodeId: viewState.selectedNodeId,
          reparentSourceId: viewState.reparentSourceId,
        });
        if (undoStack.length > MAX_UNDO_STEPS) {
          undoStack.shift();
        }
        redoStack = [];
      }

      function undoLastChange() {
        if (!doc || undoStack.length === 0) {
          setStatus("Nothing to undo.");
          return;
        }

        redoStack.push({
          state: cloneState(doc.state),
          selectedNodeId: viewState.selectedNodeId,
          reparentSourceId: viewState.reparentSourceId,
        });
        if (redoStack.length > MAX_UNDO_STEPS) {
          redoStack.shift();
        }

        const snapshot = undoStack.pop();
        doc.state = snapshot.state;
        viewState.selectedNodeId = doc.state.nodes[snapshot.selectedNodeId] ? snapshot.selectedNodeId : doc.state.rootId;
        viewState.reparentSourceId = snapshot.reparentSourceId && doc.state.nodes[snapshot.reparentSourceId]
          ? snapshot.reparentSourceId
          : "";
        doc.savedAt = nowIso();
        render();
        setStatus("Undo applied.");
        board.focus();
      }

      function redoLastChange() {
        if (!doc || redoStack.length === 0) {
          setStatus("Nothing to redo.");
          return;
        }

        undoStack.push({
          state: cloneState(doc.state),
          selectedNodeId: viewState.selectedNodeId,
          reparentSourceId: viewState.reparentSourceId,
        });
        if (undoStack.length > MAX_UNDO_STEPS) {
          undoStack.shift();
        }

        const snapshot = redoStack.pop();
        doc.state = snapshot.state;
        viewState.selectedNodeId = doc.state.nodes[snapshot.selectedNodeId] ? snapshot.selectedNodeId : doc.state.rootId;
        viewState.reparentSourceId = snapshot.reparentSourceId && doc.state.nodes[snapshot.reparentSourceId]
          ? snapshot.reparentSourceId
          : "";
        doc.savedAt = nowIso();
        render();
        setStatus("Redo applied.");
        board.focus();
      }

      function setStatus(message, isError = false) {
        clearTimeout(statusTimer);
        statusEl.textContent = message;
        statusEl.style.color = isError ? "var(--danger)" : "#5d5d5d";
        if (message) {
          statusTimer = setTimeout(() => {
            statusEl.textContent = "";
          }, 2500);
        }
      }

      function clampZoom(nextZoom) {
        return Math.min(VIEWER_TUNING.zoom.max, Math.max(VIEWER_TUNING.zoom.min, nextZoom));
      }

      function setVisualCheckStatus(lines) {
        if (!visualCheckEl) {
          return;
        }
        visualCheckEl.textContent = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
      }

      function applyZoom() {
        canvas.style.width = `${contentWidth}px`;
        canvas.style.height = `${contentHeight}px`;
        canvas.style.transform = `translate(${viewState.cameraX}px, ${viewState.cameraY}px) scale(${viewState.zoom})`;
      }

      function setZoom(nextZoom, anchorClientX = null, anchorClientY = null) {
        const previousZoom = viewState.zoom;
        viewState.zoom = clampZoom(nextZoom);

        const boardRect = board.getBoundingClientRect();
        const pointerX = anchorClientX ?? boardRect.left + boardRect.width / 2;
        const pointerY = anchorClientY ?? boardRect.top + boardRect.height / 2;
        const localViewportX = pointerX - boardRect.left;
        const localViewportY = pointerY - boardRect.top;
        const contentX = (localViewportX - viewState.cameraX) / previousZoom;
        const contentY = (localViewportY - viewState.cameraY) / previousZoom;

        viewState.cameraX = localViewportX - contentX * viewState.zoom;
        viewState.cameraY = localViewportY - contentY * viewState.zoom;
        applyZoom();
        setStatus(`Zoom ${Math.round(viewState.zoom * 100)}%`);
      }

      function visibleChildren(node) {
        if (!node || node.collapsed) {
          return [];
        }
        return node.children || [];
      }

      function buildLayout(state) {
        const metrics = {};
        const depthOf = {};
        const depthMaxWidth = {};
        let maxDepth = 0;

        function visit(nodeId, depth) {
          const node = state.nodes[nodeId];
          if (!node) {
            return;
          }

          maxDepth = Math.max(maxDepth, depth);
          depthOf[nodeId] = depth;

          if (nodeId === state.rootId) {
            metrics[nodeId] = {
              w: Math.max(280, textWidth(node.text || "", VIEWER_TUNING.typography.rootFont) + 120),
              h: VIEWER_TUNING.layout.rootHeight,
            };
          } else {
            metrics[nodeId] = {
              w: textWidth(node.text || "", VIEWER_TUNING.typography.nodeFont) + 20,
              h: 56,
            };
          }

          depthMaxWidth[depth] = Math.max(depthMaxWidth[depth] || 0, metrics[nodeId].w);
          visibleChildren(node).forEach((childId) => visit(childId, depth + 1));
        }

        visit(state.rootId, 0);

        const xByDepth = {};
        let cursorX = VIEWER_TUNING.layout.leftPad;
        for (let d = 0; d <= maxDepth; d += 1) {
          xByDepth[d] = cursorX;
          cursorX += (depthMaxWidth[d] || 120) + VIEWER_TUNING.layout.columnGap;
        }

        const subtreeHeightCache = {};
        function subtreeHeight(nodeId) {
          if (subtreeHeightCache[nodeId] !== undefined) {
            return subtreeHeightCache[nodeId];
          }

          const node = state.nodes[nodeId];
          if (!node) {
            return VIEWER_TUNING.layout.leafHeight;
          }

          const children = visibleChildren(node);
          if (children.length === 0) {
            subtreeHeightCache[nodeId] = VIEWER_TUNING.layout.leafHeight;
            return VIEWER_TUNING.layout.leafHeight;
          }

          let sum = 0;
          children.forEach((childId, i) => {
            sum += subtreeHeight(childId);
            if (i < children.length - 1) {
              sum += VIEWER_TUNING.layout.siblingGap;
            }
          });

          const result = Math.max(sum, metrics[nodeId].h + 24);
          subtreeHeightCache[nodeId] = result;
          return result;
        }

        const pos = {};
        const order = [];

        function place(nodeId, topY) {
          const node = state.nodes[nodeId];
          if (!node) {
            return VIEWER_TUNING.layout.leafHeight;
          }

          const depth = depthOf[nodeId] || 0;
          const h = subtreeHeight(nodeId);
          const centerY = topY + h / 2;

          pos[nodeId] = {
            x: xByDepth[depth],
            y: centerY,
            depth,
            w: metrics[nodeId].w,
            h: metrics[nodeId].h,
          };
          order.push(nodeId);

          let cursorY = topY;
          visibleChildren(node).forEach((childId, i, arr) => {
            const childH = place(childId, cursorY);
            cursorY += childH;
            if (i < arr.length - 1) {
              cursorY += VIEWER_TUNING.layout.siblingGap;
            }
          });

          return h;
        }

        const totalHeight = place(state.rootId, VIEWER_TUNING.layout.topPad);
        return {
          pos,
          order,
          totalHeight,
          totalWidth: cursorX + VIEWER_TUNING.layout.canvasRightPad,
        };
      }

      function syncEditInput() {
        if (!doc) {
          editInput.value = "";
          return;
        }
        const selected = doc.state.nodes[viewState.selectedNodeId];
        editInput.value = selected ? selected.text || "" : "";
      }

      function render() {
        if (!doc) {
          metaEl.textContent = "No data loaded";
          canvas.innerHTML = "";
          return;
        }

        const state = doc.state;
        const layout = buildLayout(state);
        lastLayout = layout;
        visibleOrder = layout.order;

        const pos = layout.pos;
        let maxX = Math.max(VIEWER_TUNING.layout.minCanvasWidth, layout.totalWidth);
        let maxY = Math.max(
          VIEWER_TUNING.layout.minCanvasHeight,
          layout.totalHeight + VIEWER_TUNING.layout.topPad + VIEWER_TUNING.layout.canvasBottomPad
        );
        let edges = "";
        let nodes = "";

        function drawNode(nodeId) {
          const node = state.nodes[nodeId];
          const p = pos[nodeId];
          if (!node || !p) {
            return;
          }

          maxX = Math.max(maxX, p.x + p.w + VIEWER_TUNING.layout.nodeRightPad);
          maxY = Math.max(maxY, p.y + p.h + VIEWER_TUNING.layout.nodeBottomPad);

          const children = visibleChildren(node);
          children.forEach((childId, i) => {
            const child = pos[childId];
            if (!child) {
              return;
            }

            const stroke =
              VIEWER_TUNING.palette.edgeColors[(p.depth + i) % VIEWER_TUNING.palette.edgeColors.length];
            const startX = p.x + p.w + VIEWER_TUNING.layout.edgeStartPad;
            const startY = p.y;
            const endX = child.x - VIEWER_TUNING.layout.edgeEndPad;
            const endY = child.y;
            const curve = Math.max(48, (endX - startX) * 0.45);
            const c1x = startX + curve;
            const c1y = startY;
            const c2x = endX - curve;
            const c2y = endY;
            edges += `<path class="edge" stroke="${stroke}" d="M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}" />`;
          });

          const classNames = ["node-hit"];
          if (nodeId === viewState.selectedNodeId) {
            classNames.push("selected");
          }
          if (viewState.dragState && nodeId === viewState.dragState.targetNodeId) {
            classNames.push("drop-target");
          }
          if (viewState.dragState && nodeId === viewState.dragState.sourceNodeId) {
            classNames.push("drag-source");
          }
          const hitX = nodeId === state.rootId ? p.x : p.x - 8;
          const hitY = p.y - VIEWER_TUNING.layout.nodeHitHeight / 2;
          const hitW = nodeId === state.rootId ? p.w : p.w + 36;
          nodes += `<rect class="${classNames.join(" ")}" data-node-id="${nodeId}" x="${hitX}" y="${hitY}" width="${hitW}" height="${VIEWER_TUNING.layout.nodeHitHeight}" rx="12" />`;

          if (nodeId === state.rootId) {
            const label = escapeXml(node.text || "(empty)");
            const w = p.w;
            const h = p.h;
            const rx = 60;
            const x = p.x;
            const y = p.y - h / 2;
            nodes += `<rect class="root-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" />`;
            nodes += `<text class="label-root" x="${x + w / 2}" y="${p.y}" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
          } else {
            const label = escapeXml(node.text || "(empty)");
            const selectedStyle = nodeId === viewState.selectedNodeId ? " style=\"fill:#6f39ff;font-weight:600;\"" : "";
            nodes += `<text class="label-node" x="${p.x}" y="${p.y}" text-anchor="start" dominant-baseline="middle"${selectedStyle}>${label}</text>`;
          }

          if (node.collapsed && (node.children || []).length > 0) {
            const indicatorX =
              nodeId === state.rootId
                ? p.x + p.w + VIEWER_TUNING.layout.rootIndicatorPad
                : p.x + p.w + VIEWER_TUNING.layout.nodeIndicatorPad;
            nodes += `<text class="collapsed-indicator" x="${indicatorX}" y="${p.y}" dominant-baseline="middle">+</text>`;
          }

          children.forEach((cid) => drawNode(cid));
        }

        drawNode(state.rootId);

        contentWidth = maxX;
        contentHeight = maxY;
        canvas.setAttribute("width", String(maxX));
        canvas.setAttribute("height", String(maxY));
        canvas.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
        canvas.innerHTML = `${edges}${nodes}`;
        applyZoom();

        const version = doc.version || "n/a";
        const savedAt = doc.savedAt || "n/a";
        const nodeCount = Object.keys(state.nodes).length;
        const selected = state.nodes[viewState.selectedNodeId];
        const moveNode = state.nodes[viewState.reparentSourceId];
        const dragTarget = viewState.dragState ? state.nodes[viewState.dragState.targetNodeId] : null;
        metaEl.textContent = `version: ${version} | savedAt: ${savedAt} | nodes: ${nodeCount} | selected: ${selected ? selected.text : "n/a"} | move-node: ${moveNode ? moveNode.text : "none"} | drop-target: ${dragTarget ? dragTarget.text : "none"}`;
        syncEditInput();
      }

      function selectNode(nodeId) {
        getNode(nodeId);
        viewState.selectedNodeId = nodeId;
        render();
      }

      function addChild() {
        const parentId = viewState.selectedNodeId;
        const parent = getNode(parentId);
        pushUndoSnapshot();
        const id = newId();
        doc.state.nodes[id] = createNodeRecord(id, parentId, "New Node");
        parent.children.push(id);
        parent.collapsed = false;
        viewState.selectedNodeId = id;
        doc.savedAt = nowIso();
        render();
        board.focus();
      }

      function addSibling() {
        const node = getNode(viewState.selectedNodeId);
        if (node.parentId === null) {
          addChild();
          return;
        }
        const parent = getNode(node.parentId);
        pushUndoSnapshot();
        const currentIndex = parent.children.indexOf(node.id);
        const id = newId();
        doc.state.nodes[id] = createNodeRecord(id, parent.id, "New Sibling");
        parent.children.splice(currentIndex + 1, 0, id);
        viewState.selectedNodeId = id;
        doc.savedAt = nowIso();
        render();
        board.focus();
      }

      function applyEdit() {
        const node = getNode(viewState.selectedNodeId);
        const next = String(editInput.value || "").trim();
        if (next === "") {
          setStatus("Node text cannot be empty.", true);
          syncEditInput();
          return;
        }
        if (node.text === next) {
          return;
        }
        pushUndoSnapshot();
        node.text = next;
        doc.savedAt = nowIso();
        render();
      }

      function deleteSelected() {
        const node = getNode(viewState.selectedNodeId);
        if (node.parentId === null) {
          setStatus("Root node cannot be deleted.", true);
          return;
        }
        pushUndoSnapshot();
        const parent = getNode(node.parentId);
        parent.children = parent.children.filter((id) => id !== node.id);
        const stack = [node.id];
        while (stack.length > 0) {
          const currentId = stack.pop();
          const current = doc.state.nodes[currentId];
          if (!current) {
            continue;
          }
          stack.push(...(current.children || []));
          delete doc.state.nodes[currentId];
        }
        if (viewState.reparentSourceId === node.id) {
          viewState.reparentSourceId = "";
        }
        viewState.selectedNodeId = parent.id;
        doc.savedAt = nowIso();
        render();
      }

      function toggleCollapse() {
        const node = getNode(viewState.selectedNodeId);
        if ((node.children || []).length === 0) {
          return;
        }
        pushUndoSnapshot();
        node.collapsed = !node.collapsed;
        doc.savedAt = nowIso();
        render();
      }

      function downloadJson() {
        const blob = new Blob([JSON.stringify({ version: doc.version, savedAt: nowIso(), state: doc.state }, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "rapid-edited.json";
        anchor.click();
        URL.revokeObjectURL(url);
      }

      function selectRelative(offset) {
        if (!visibleOrder.length) {
          return;
        }
        const currentIndex = Math.max(0, visibleOrder.indexOf(viewState.selectedNodeId));
        const nextIndex = Math.min(visibleOrder.length - 1, Math.max(0, currentIndex + offset));
        selectNode(visibleOrder[nextIndex]);
      }

      function selectParent() {
        if (!doc) {
          return;
        }
        const node = getNode(viewState.selectedNodeId);
        if (node.parentId) {
          selectNode(node.parentId);
        }
      }

      function selectChild() {
        if (!doc) {
          return;
        }
        const node = getNode(viewState.selectedNodeId);
        const children = visibleChildren(node);
        if (children.length === 0) {
          return;
        }
        selectNode(children[0]);
      }

      function selectVertical(direction) {
        if (!doc || !lastLayout) {
          selectRelative(direction);
          return;
        }

        const currentId = viewState.selectedNodeId;
        const currentNode = getNode(currentId);
        if (currentNode.parentId) {
          const parent = getNode(currentNode.parentId);
          const siblings = visibleChildren(parent);
          const siblingIndex = siblings.indexOf(currentId);
          const nextSiblingIndex = siblingIndex + direction;
          if (nextSiblingIndex >= 0 && nextSiblingIndex < siblings.length) {
            selectNode(siblings[nextSiblingIndex]);
            return;
          }
        }

        const currentPos = lastLayout.pos[currentId];
        if (!currentPos) {
          selectRelative(direction);
          return;
        }

        const sameDepth = visibleOrder
          .filter((id) => id !== currentId)
          .filter((id) => (lastLayout.pos[id] || {}).depth === currentPos.depth)
          .sort((a, b) => lastLayout.pos[a].y - lastLayout.pos[b].y);

        const target = direction < 0
          ? [...sameDepth].reverse().find((id) => lastLayout.pos[id].y < currentPos.y)
          : sameDepth.find((id) => lastLayout.pos[id].y > currentPos.y);

        if (target) {
          selectNode(target);
          return;
        }

        selectRelative(direction);
      }

      function loadPayload(payload) {
        try {
          doc = ensureDocShape(payload);
          undoStack = [];
          redoStack = [];
          viewState.selectedNodeId = doc.state.rootId;
          viewState.reparentSourceId = "";
          render();
          setStatus("Loaded.");
        } catch (err) {
          setStatus(err.message, true);
        }
      }

      function resetCamera() {
        viewState.zoom = 1;
        viewState.cameraX = VIEWER_TUNING.pan.initialCameraX;
        viewState.cameraY = VIEWER_TUNING.pan.initialCameraY;
        applyZoom();
      }

      function centerOnNode(nodeId, zoom = viewState.zoom) {
        if (!doc || !lastLayout || !lastLayout.pos[nodeId]) {
          return false;
        }
        const nodePos = lastLayout.pos[nodeId];
        const boardRect = board.getBoundingClientRect();
        viewState.zoom = clampZoom(zoom);
        viewState.cameraX = boardRect.width / 2 - (nodePos.x + nodePos.w / 2) * viewState.zoom;
        viewState.cameraY = boardRect.height / 2 - nodePos.y * viewState.zoom;
        applyZoom();
        return true;
      }

      function fitDocument() {
        if (!doc) {
          return false;
        }
        render();
        const boardRect = board.getBoundingClientRect();
        if (!boardRect.width || !boardRect.height || !contentWidth || !contentHeight) {
          return false;
        }
        const fitX = boardRect.width / contentWidth;
        const fitY = boardRect.height / contentHeight;
        const zoom = clampZoom(Math.min(fitX, fitY) * 0.92);
        viewState.zoom = zoom;
        viewState.cameraX = (boardRect.width - contentWidth * zoom) / 2;
        viewState.cameraY = (boardRect.height - contentHeight * zoom) / 2;
        applyZoom();
        return true;
      }

      function findNodeIdByText(text) {
        if (!doc) {
          return "";
        }
        const target = String(text || "").trim().toLowerCase();
        const node = Object.values(doc.state.nodes).find((entry) => String(entry.text || "").trim().toLowerCase() === target);
        return node ? node.id : "";
      }

      async function loadAircraftMmDemo() {
        const response = await fetch("./data/aircraft.mm", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = parseMmText(await response.text());
        loadPayload(payload);
        setStatus("aircraft.mm demo loaded.");
      }

      function stopVisualCheck(message = "Visual check stopped.") {
        visualCheckRunId += 1;
        setVisualCheckStatus(message);
      }

      async function runAircraftVisualCheck() {
        const runId = visualCheckRunId + 1;
        visualCheckRunId = runId;

        const steps = [
          { label: "Load aircraft.mm", run: async () => { await loadAircraftMmDemo(); resetCamera(); centerOnNode(doc.state.rootId, 1); } },
          { label: "Zoom out for whole-map scan", run: async () => { centerOnNode(doc.state.rootId, 0.72); } },
          { label: "Select Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); centerOnNode(nodeId, 0.95); } },
          { label: "Collapse Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); if (!getNode(nodeId).collapsed) { toggleCollapse(); } centerOnNode(nodeId, 0.95); } },
          { label: "Expand Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); if (getNode(nodeId).collapsed) { toggleCollapse(); } centerOnNode(nodeId, 0.95); } },
          { label: "Select Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); centerOnNode(nodeId, 0.92); } },
          { label: "Collapse Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); if (!getNode(nodeId).collapsed) { toggleCollapse(); } centerOnNode(nodeId, 0.92); } },
          { label: "Expand Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); if (getNode(nodeId).collapsed) { toggleCollapse(); } centerOnNode(nodeId, 0.92); } },
          { label: "Inspect Main Wing label scale", run: async () => { const nodeId = findNodeIdByText("Main Wing"); selectNode(nodeId); centerOnNode(nodeId, 1.15); } },
          { label: "Inspect Propeller label scale", run: async () => { const nodeId = findNodeIdByText("Propeller"); selectNode(nodeId); centerOnNode(nodeId, 1.15); } },
          { label: "Return to root overview", run: async () => { selectNode(doc.state.rootId); centerOnNode(doc.state.rootId, 0.8); } },
        ];

        function renderProgress(activeIndex) {
          setVisualCheckStatus(steps.map((step, index) => {
            if (index < activeIndex) return `[done] ${step.label}`;
            if (index === activeIndex) return `[run ] ${step.label}`;
            return `[todo] ${step.label}`;
          }));
        }

        try {
          renderProgress(0);
          for (let index = 0; index < steps.length; index += 1) {
            if (visualCheckRunId !== runId) {
              return;
            }
            renderProgress(index);
            await steps[index].run();
            await new Promise((resolve) => setTimeout(resolve, 900));
          }
          if (visualCheckRunId !== runId) {
            return;
          }
          setVisualCheckStatus(steps.map((step) => `[done] ${step.label}`).concat("Completed: aircraft visual check"));
          setStatus("Aircraft visual check completed.");
        } catch (err) {
          if (visualCheckRunId !== runId) {
            return;
          }
          setVisualCheckStatus(`Aircraft visual check failed: ${err.message}`);
          setStatus(`Aircraft visual check failed (${err.message}).`, true);
        }
      }

      function isDescendant(candidateParentId, nodeId) {
        let currentId = candidateParentId;
        while (currentId) {
          if (currentId === nodeId) {
            return true;
          }
          const current = doc.state.nodes[currentId];
          currentId = current ? current.parentId : null;
        }
        return false;
      }

      function markReparentSource() {
        if (!viewState.selectedNodeId) {
          return;
        }
        viewState.reparentSourceId = viewState.selectedNodeId;
        setStatus(`Marked move node: ${getNode(viewState.reparentSourceId).text}`);
        render();
      }

      function applyReparent() {
        const sourceId = viewState.reparentSourceId;
        const targetParentId = viewState.selectedNodeId;
        if (!sourceId) {
          setStatus("No move node marked.", true);
          return;
        }
        if (sourceId === targetParentId) {
          setStatus("Cannot move a node under itself.", true);
          return;
        }
        const sourceNode = getNode(sourceId);
        if (sourceNode.parentId === null) {
          setStatus("Root node cannot be moved.", true);
          return;
        }
        if (isDescendant(targetParentId, sourceId)) {
          setStatus("Cannot move a node under its descendant.", true);
          return;
        }

        pushUndoSnapshot();
        const oldParent = getNode(sourceNode.parentId);
        const newParent = getNode(targetParentId);
        oldParent.children = oldParent.children.filter((id) => id !== sourceId);
        newParent.children.push(sourceId);
        newParent.collapsed = false;
        sourceNode.parentId = targetParentId;
        viewState.reparentSourceId = "";
        doc.savedAt = nowIso();
        setStatus(`Moved "${sourceNode.text}" under "${newParent.text}".`);
        render();
      }

      function canReparent(sourceId, targetParentId) {
        if (!sourceId || !targetParentId) {
          return false;
        }
        if (sourceId === targetParentId) {
          return false;
        }
        const sourceNode = getNode(sourceId);
        if (sourceNode.parentId === null) {
          return false;
        }
        if (isDescendant(targetParentId, sourceId)) {
          return false;
        }
        return true;
      }

      function applyReparentByIds(sourceId, targetParentId) {
        if (!canReparent(sourceId, targetParentId)) {
          return false;
        }
        pushUndoSnapshot();
        const sourceNode = getNode(sourceId);
        const oldParent = getNode(sourceNode.parentId);
        const newParent = getNode(targetParentId);
        oldParent.children = oldParent.children.filter((id) => id !== sourceId);
        newParent.children.push(sourceId);
        newParent.collapsed = false;
        sourceNode.parentId = targetParentId;
        viewState.reparentSourceId = "";
        doc.savedAt = nowIso();
        setStatus(`Moved "${sourceNode.text}" under "${newParent.text}".`);
        render();
        return true;
      }

      loadDefaultBtn?.addEventListener("click", async () => {
        try {
          const response = await fetch("./data/rapid-sample.json", { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const payload = await response.json();
          loadPayload(payload);
        } catch (err) {
          setStatus(`Default load failed (${err.message}). Use file picker.`, true);
        }
      });

      loadAirplaneBtn?.addEventListener("click", async () => {
        try {
          const response = await fetch("./data/airplane-parts-demo.json", { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const payload = await response.json();
          loadPayload(payload);
          setStatus("Airplane demo loaded.");
        } catch (err) {
          setStatus(`Airplane demo load failed (${err.message}).`, true);
        }
      });

      loadAircraftMmBtn?.addEventListener("click", async () => {
        try {
          await loadAircraftMmDemo();
        } catch (err) {
          setStatus(`aircraft.mm load failed (${err.message}).`, true);
        }
      });

      runAircraftVisualCheckBtn?.addEventListener("click", () => {
        runAircraftVisualCheck();
      });

      stopVisualCheckBtn?.addEventListener("click", () => {
        stopVisualCheck();
      });

      fileInput.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const text = String(reader.result || "");
            const isMm = file.name.toLowerCase().endsWith(".mm");
            const payload = isMm ? parseMmText(text) : JSON.parse(text);
            loadPayload(payload);
            if (isMm) {
              setStatus(`Imported .mm file: ${file.name}`);
            }
          } catch (err) {
            setStatus(`Import error: ${err.message}`, true);
          }
        };
        reader.readAsText(file, "utf-8");
      });

      addChildBtn?.addEventListener("click", () => {
        if (!doc) return;
        addChild();
      });

      addSiblingBtn?.addEventListener("click", () => {
        if (!doc) return;
        addSibling();
      });

      toggleCollapseBtn?.addEventListener("click", () => {
        if (!doc) return;
        toggleCollapse();
      });

      deleteNodeBtn?.addEventListener("click", () => {
        if (!doc) return;
        deleteSelected();
      });

      markReparentBtn?.addEventListener("click", () => {
        if (!doc) return;
        markReparentSource();
      });

      applyReparentBtn?.addEventListener("click", () => {
        if (!doc) return;
        applyReparent();
      });

      downloadBtn?.addEventListener("click", () => {
        if (!doc) return;
        downloadJson();
      });

      zoomOutBtn?.addEventListener("click", () => {
        setZoom(viewState.zoom / VIEWER_TUNING.zoom.buttonFactor);
      });

      zoomResetBtn?.addEventListener("click", () => {
        setZoom(1);
      });

      zoomInBtn?.addEventListener("click", () => {
        setZoom(viewState.zoom * VIEWER_TUNING.zoom.buttonFactor);
      });

      fitAllBtn?.addEventListener("click", () => {
        fitDocument();
      });

      focusSelectedBtn?.addEventListener("click", () => {
        if (!doc || !viewState.selectedNodeId) {
          return;
        }
        centerOnNode(viewState.selectedNodeId, Math.max(1, viewState.zoom));
      });

      applyEditBtn?.addEventListener("click", () => {
        if (!doc) return;
        applyEdit();
      });

      editInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (doc) {
            applyEdit();
            board.focus();
          }
        }
        if (event.key === "Escape") {
          event.preventDefault();
          syncEditInput();
          board.focus();
        }
      });

      canvas.addEventListener("pointerdown", (event) => {
        const nodeId = event.target && event.target.dataset ? event.target.dataset.nodeId : null;
        if (!doc || !nodeId || event.button !== 0) {
          return;
        }
        viewState.dragState = {
          pointerId: event.pointerId,
          sourceNodeId: nodeId,
          targetNodeId: null,
          startX: event.clientX,
          startY: event.clientY,
          dragged: false,
        };
        canvas.setPointerCapture?.(event.pointerId);
      });

      canvas.addEventListener("pointermove", (event) => {
        if (!viewState.dragState || event.pointerId !== viewState.dragState.pointerId) {
          return;
        }
        const dx = event.clientX - viewState.dragState.startX;
        const dy = event.clientY - viewState.dragState.startY;
        const distance = Math.hypot(dx, dy);
        if (!viewState.dragState.dragged && distance < VIEWER_TUNING.drag.reparentThreshold) {
          return;
        }
        viewState.dragState.dragged = true;
        const el = document.elementFromPoint(event.clientX, event.clientY);
        const targetNodeId = el && el.dataset ? el.dataset.nodeId || null : null;
        viewState.dragState.targetNodeId = canReparent(viewState.dragState.sourceNodeId, targetNodeId) ? targetNodeId : null;
        render();
      });

      function finishNodeDrag(event) {
        if (!viewState.dragState || event.pointerId !== viewState.dragState.pointerId) {
          return;
        }
        const { sourceNodeId, targetNodeId, dragged } = viewState.dragState;
        viewState.dragState = null;
        canvas.releasePointerCapture?.(event.pointerId);

        if (!dragged) {
          selectNode(sourceNodeId);
          board.focus();
          return;
        }

        if (targetNodeId && applyReparentByIds(sourceNodeId, targetNodeId)) {
          viewState.selectedNodeId = sourceNodeId;
          render();
          board.focus();
          return;
        }

        setStatus("No valid drop target.", true);
        render();
        board.focus();
      }

      canvas.addEventListener("pointerup", finishNodeDrag);
      canvas.addEventListener("pointercancel", finishNodeDrag);

      board.addEventListener("wheel", (event) => {
        event.preventDefault();
        if (!event.ctrlKey && !event.metaKey) {
          viewState.cameraX -= event.deltaX * VIEWER_TUNING.pan.wheelFactor;
          viewState.cameraY -= event.deltaY * VIEWER_TUNING.pan.wheelFactor;
          applyZoom();
          return;
        }
        const intensity = Math.min(
          VIEWER_TUNING.zoom.wheelIntensityCap,
          Math.abs(event.deltaY) / VIEWER_TUNING.zoom.wheelIntensityDivisor
        );
        const factor = Math.exp(-Math.sign(event.deltaY) * intensity);
        setZoom(viewState.zoom * factor, event.clientX, event.clientY);
      }, { passive: false });

      board.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }
        const onNode = event.target && event.target.dataset && event.target.dataset.nodeId;
        if (onNode) {
          return;
        }
        viewState.panState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          cameraX: viewState.cameraX,
          cameraY: viewState.cameraY,
        };
        board.classList.add("panning");
        board.setPointerCapture?.(event.pointerId);
      });

      board.addEventListener("pointermove", (event) => {
        if (!viewState.panState || event.pointerId !== viewState.panState.pointerId) {
          return;
        }
        viewState.cameraX = viewState.panState.cameraX + (event.clientX - viewState.panState.startX);
        viewState.cameraY = viewState.panState.cameraY + (event.clientY - viewState.panState.startY);
        applyZoom();
      });

      function endPan(event) {
        if (!viewState.panState || event.pointerId !== viewState.panState.pointerId) {
          return;
        }
        viewState.panState = null;
        board.classList.remove("panning");
        board.releasePointerCapture?.(event.pointerId);
      }

      board.addEventListener("pointerup", endPan);
      board.addEventListener("pointercancel", endPan);

      document.addEventListener("keydown", (event) => {
        if (!doc) {
          return;
        }

        const activeTag = document.activeElement ? document.activeElement.tagName : "";
        const editingInput = activeTag === "INPUT" && document.activeElement === editInput;

        if (editingInput) {
          if (event.key === "Escape") {
            syncEditInput();
            board.focus();
          }
          return;
        }

        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
          event.preventDefault();
          undoLastChange();
          return;
        }

        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z") {
          event.preventDefault();
          redoLastChange();
          return;
        }

        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "y") {
          event.preventDefault();
          redoLastChange();
          return;
        }

        if (event.key === "Tab") {
          event.preventDefault();
          addChild();
          return;
        }

        if (event.key === "Enter") {
          if (event.shiftKey) {
            event.preventDefault();
            editInput.focus();
            editInput.select();
            return;
          }
          event.preventDefault();
          addSibling();
          return;
        }

        if (event.key === "F2") {
          event.preventDefault();
          editInput.focus();
          editInput.select();
          return;
        }

        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          deleteSelected();
          return;
        }

        if (event.key.toLowerCase() === "m") {
          event.preventDefault();
          markReparentSource();
          return;
        }

        if (event.key.toLowerCase() === "p") {
          event.preventDefault();
          applyReparent();
          return;
        }

        if (event.key === " ") {
          event.preventDefault();
          toggleCollapse();
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          selectVertical(-1);
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          selectVertical(1);
          return;
        }

        if (event.key === "ArrowLeft") {
          event.preventDefault();
          selectParent();
          return;
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          selectChild();
        }
      });

      loadPayload(createEmptyDoc());
      setVisualCheckStatus("Visual check idle");
      fitDocument() || applyZoom();

